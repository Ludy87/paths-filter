import * as fs from 'fs'
import * as jsyaml from 'js-yaml'
import picomatch from 'picomatch'
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
}

/**
 * An array of strings (at runtime) that contains the valid/accepted values for
 * the configuration parameter 'predicate-quantifier'.
 */
export const SUPPORTED_PREDICATE_QUANTIFIERS = Object.values(PredicateQuantifier)

export function isPredicateQuantifier(x: unknown): x is PredicateQuantifier {
  return SUPPORTED_PREDICATE_QUANTIFIERS.includes(x as PredicateQuantifier)
}

export interface FilterResults {
  [key: string]: File[]
}

export class Filter {
  rules: { [key: string]: FilterRuleItem[] } = {}
  private globalIgnorePatterns: ((str: string) => boolean)[] = [] // Cached global ignore matchers

  // Creates instance of Filter and load rules from YAML if it's provided
  constructor(
    yaml?: string,
    readonly filterConfig?: FilterConfig,
  ) {
    if (yaml) {
      this.load(yaml)
    }
    // Load global ignores if provided
    if (this.filterConfig?.globalIgnore) {
      this.loadGlobalIgnores(this.filterConfig.globalIgnore)
    }
  }

  // Load rules from YAML string
  load(yaml: string): void {
    if (!yaml) {
      return
    }

    const doc = jsyaml.load(yaml) as FilterYaml
    if (typeof doc !== 'object') {
      this.throwInvalidFormatError('Root element is not an object')
    }

    for (const [key, item] of Object.entries(doc)) {
      this.rules[key] = this.parseFilterItemYaml(item)
    }
  }

  // Load global ignore patterns from file
  private loadGlobalIgnores(globalIgnorePath: string): void {
    try {
      const ignoreContent = fs.readFileSync(globalIgnorePath, 'utf8')
      const patterns = ignoreContent
        .split(/\r?\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && !p.startsWith('#'))
      // Fixed: No 'negate: true' in options – invert logic in match() instead
      this.globalIgnorePatterns = patterns.map((pattern) => picomatch(pattern, MatchOptions))
    } catch (error) {
      throw new Error(`Failed to load global-ignore file '${globalIgnorePath}': ${error}`)
    }
  }

  match(files: File[]): FilterResults {
    // Apply global ignores first (invert match for exclusion)
    const filteredFiles =
      this.globalIgnorePatterns.length > 0
        ? files.filter((file) => !this.globalIgnorePatterns.some((isMatch) => isMatch(file.filename)))
        : files

    const result: FilterResults = {}
    for (const [key, patterns] of Object.entries(this.rules)) {
      result[key] = filteredFiles.filter((file) => this.isMatch(file, patterns))
    }
    return result
  }

  private isMatch(file: File, patterns: FilterRuleItem[]): boolean {
    const filePaths = Array.from(
      new Set(
        [file.filename, file.from, file.to, file.previous_filename].filter(
          (path): path is string => typeof path === 'string' && path.length > 0,
        ),
      ),
    )
    const aPredicate = (rule: Readonly<FilterRuleItem>): boolean => {
      return (
        (rule.status === undefined || rule.status.includes(file.status)) && filePaths.some((path) => rule.isMatch(path))
      )
    }

    const positives = patterns.filter((p) => !p.negate)
    const negatives = patterns.filter((p) => p.negate)

    const positiveMatch =
      positives.length === 0
        ? true
        : this.filterConfig?.predicateQuantifier === PredicateQuantifier.EVERY
          ? positives.every(aPredicate)
          : positives.some(aPredicate)

    const negativeMatch = negatives.some(aPredicate)

    return positiveMatch && !negativeMatch
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
