import * as fs from 'fs'
import * as jsyaml from 'js-yaml'
import picomatch from 'picomatch'
import * as core from '@actions/core'
import { File, ChangeStatus } from './file'

// Type definition of object we expect to load from YAML
interface FilterYaml {
  [name: string]: FilterItemYaml
}
type FilterItemYaml =
  // Filename pattern, e.g. "path/to/*.js"
  | string
  // Change status and filename, e.g. added|modified: "path/to/*.js"
  | { [changeTypes: string]: string | string[] }
  // Ignore patterns, e.g. paths-ignore: "docs/**"
  | { pathsIgnore?: string | string[] }
  // Supports referencing another rule via YAML anchor
  | FilterItemYaml[]

// Minimatch options used in all matchers
const MatchOptions = {
  dot: true,
}

// Internal representation of one item in named filter rule
// Created as simplified form of data in FilterItemYaml
interface FilterRuleItem {
  status?: ChangeStatus[] // Required change status of the matched files
  isMatch: (str: string) => boolean // Matches the filename
  negate?: boolean // When true, this rule excludes matching files
}

interface IgnorePattern {
  matcher: (filename: string) => boolean
  negated: boolean
}

/**
 * Enumerates the possible logic quantifiers that can be used when determining
 * if a file is a match or not with multiple patterns.
 *
 * The YAML configuration property that is parsed into one of these values is
 * 'predicate-quantifier' on the top level of the configuration object of the
 * action.
 *
 * The default is to use 'some' which used to be the hardcoded behavior prior to
 * the introduction of the new mechanism.
 *
 * @see https://en.wikipedia.org/wiki/Quantifier_(logic)
 */
export enum PredicateQuantifier {
  /**
   * When choosing 'every' in the config it means that files will only get matched
   * if all the patterns are satisfied by the path of the file, not just at least one of them.
   */
  EVERY = 'every',
  /**
   * When choosing 'some' in the config it means that files will get matched as long as there is
   * at least one pattern that matches them. This is the default behavior if you don't
   * specify anything as a predicate quantifier.
   */
  SOME = 'some',
}

/**
 * Used to define customizations for how the file filtering should work at runtime.
 */
export type FilterConfig = {
  readonly predicateQuantifier: PredicateQuantifier
  globalIgnore?: string // Path to global ignore file
  strictExcludes?: boolean // New: If true, any match against exclude patterns disables the entire filter
}

/**
 * An array of all supported predicate quantifiers.
 */
export const SUPPORTED_PREDICATE_QUANTIFIERS = Object.values(PredicateQuantifier)

/**
 * Check if value is one of supported predicate quantifiers.
 */
export function isPredicateQuantifier(value: string): value is PredicateQuantifier {
  return SUPPORTED_PREDICATE_QUANTIFIERS.includes(value as PredicateQuantifier)
}

/**
 * The Filter class is responsible for parsing the YAML configuration and matching
 * files against the defined rules. It supports complex filtering logic including
 * status-based matching, negation, and global ignores.
 */
const DEFAULT_FILTER_CONFIG: FilterConfig = {
  predicateQuantifier: PredicateQuantifier.SOME,
}

export class Filter {
  private readonly rules: Map<string, FilterRuleItem[]> = new Map()
  private readonly globalIgnorePatterns: IgnorePattern[] = []
  private readonly filterConfig: FilterConfig

  constructor(yaml: string, filterConfig?: FilterConfig) {
    core.info(`yaml: ${yaml} filterConfig: ${JSON.stringify(filterConfig)}`)
    this.filterConfig = filterConfig ? { ...DEFAULT_FILTER_CONFIG, ...filterConfig } : { ...DEFAULT_FILTER_CONFIG }
    const parsed = jsyaml.load(yaml) as FilterYaml
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid filter YAML format: Expected object')
    }

    // Load global ignore patterns if path provided
    if (this.filterConfig.globalIgnore) {
      const globalIgnoreContent = fs.readFileSync(this.filterConfig.globalIgnore, 'utf8')
      const globalIgnores = globalIgnoreContent
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'))
      this.globalIgnorePatterns = globalIgnores.map((pattern) => {
        const negated = pattern.startsWith('!')
        const pat = negated ? pattern.slice(1) : pattern
        return { matcher: picomatch(pat, MatchOptions), negated }
      })
    }

    // Parse each filter rule
    for (const [key, item] of Object.entries(parsed)) {
      this.rules.set(key, this.parseFilterItemYaml(item))
    }
  }

  /**
   * Matches the provided files against the filter rules and returns results
   * grouped by filter key.
   */
  match(files: File[]): FilterResults {
    const results: FilterResults = {}
    core.info(`Files: ${files.map((f) => f.filename).join(', ')}`)

    // Apply global ignores first
    let filteredFiles = files.filter(
      (file) => !this.globalIgnorePatterns.some((ignore) => ignore.matcher(file.filename) && !ignore.negated),
    )
    core.info(
      `Files after global ignore: ${filteredFiles.map((f) => f.filename).join(', ')} Files: ${files.map((f) => f.filename).join(', ')}`,
    )

    // New: Strict excludes check - if enabled, check if any file matches a negative pattern across all rules
    if (this.filterConfig.strictExcludes) {
      const allNegativePatterns = Array.from(this.rules.values())
        .flat()
        .filter((rule) => rule.negate)
        .map((rule) => rule.isMatch)

      const hasExcludedFile = filteredFiles.some((file) =>
        allNegativePatterns.some((negPattern) => negPattern(file.filename)),
      )
      if (hasExcludedFile) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        ;(core.warning as any)(
          'Strict excludes triggered: At least one changed file matches an exclude pattern across filters. No files will be processed for this filter set.',
        )
        filteredFiles = []
      }
    }

    for (const [key, rules] of this.rules) {
      const matchingFiles: File[] = []
      for (const file of filteredFiles) {
        if (this.isMatch(file, rules)) {
          matchingFiles.push(file)
        }
      }
      results[key] = matchingFiles
    }

    return results
  }

  private isMatch(file: File, rules: FilterRuleItem[]): boolean {
    const positives = rules.filter((r) => !r.negate)
    const negatives = rules.filter((r) => r.negate)

    const aPredicate = (rule: FilterRuleItem): boolean => {
      const statusMatch = !rule.status || rule.status.includes(file.status)
      if (!statusMatch) {
        return false
      }

      const pathVariants = this.getFilePathVariants(file, rule)
      return pathVariants.some((variant) => rule.isMatch(variant))
    }

    const positiveMatch =
      positives.length === 0
        ? true
        : this.filterConfig.predicateQuantifier === PredicateQuantifier.EVERY
          ? positives.every(aPredicate)
          : positives.some(aPredicate)

    const negativeMatch = negatives.some(aPredicate)

    return positiveMatch && !negativeMatch
  }

  private getFilePathVariants(file: File, rule: FilterRuleItem): string[] {
    const variants = new Set<string>()
    variants.add(file.filename)

    if (file.to) {
      variants.add(file.to)
    }

    const statuses = rule.status ?? []
    const targetsRenamedStatus = statuses.includes(ChangeStatus.Renamed)

    const shouldIncludeSourcePaths =
      (!rule.negate && targetsRenamedStatus) ||
      (!targetsRenamedStatus && file.status !== ChangeStatus.Renamed && file.status !== ChangeStatus.Copied)

    if (shouldIncludeSourcePaths && file.from) {
      variants.add(file.from)
    }

    if (shouldIncludeSourcePaths && file.previous_filename) {
      variants.add(file.previous_filename)
    }

    return Array.from(variants)
  }

  private parseFilterItemYaml(item: FilterItemYaml): FilterRuleItem[] {
    if (Array.isArray(item)) {
      return item.map((i) => this.parseFilterItemYaml(i)).flat()
    }

    if (typeof item === 'string') {
      const negated = item.startsWith('!')
      const pattern = negated ? item.slice(1) : item
      return [{ status: undefined, isMatch: picomatch(pattern, MatchOptions), negate: negated }]
    }

    if (typeof item === 'object' && item !== null) {
      // Handle paths-ignore
      if ('paths-ignore' in item) {
        const patterns = Array.isArray(item['paths-ignore']) ? item['paths-ignore'] : [item['paths-ignore']]
        return patterns.map((p: string) => {
          const negated = p.startsWith('!')
          const pat = negated ? p.slice(1) : p
          return {
            status: undefined,
            isMatch: picomatch(pat, MatchOptions),
            negate: true, // paths-ignore always negates
          }
        })
      }

      return Object.entries(item).flatMap(([key, pattern]) => {
        if (typeof key !== 'string' || (typeof pattern !== 'string' && !Array.isArray(pattern))) {
          this.throwInvalidFormatError(
            `Expected [key:string]= pattern:string | string[], but [${key}:${typeof key}]= ${String(pattern)}:${typeof pattern} found`,
          )
        }

        const patterns = Array.isArray(pattern) ? pattern : [pattern]
        return patterns.map((p) => {
          const negated = p.startsWith('!')
          const pat = negated ? p.slice(1) : p
          return {
            status: key
              .split('|')
              .map((x) => x.trim())
              .filter((x) => x.length > 0)
              .map((x) => x.toLowerCase()) as ChangeStatus[],
            isMatch: picomatch(pat, MatchOptions),
            negate: negated,
          }
        })
      })
    }

    this.throwInvalidFormatError(`Unexpected element type '${typeof item}'`)
  }

  private throwInvalidFormatError(message: string): never {
    throw new Error(`Invalid filter YAML format: ${message}.`)
  }
}

/**
 * The result of matching files against filters. Each key corresponds to a filter
 * name from the YAML, and the value is an array of matching File objects.
 */
export interface FilterResults {
  [key: string]: File[]
}
