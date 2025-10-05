import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types'
import { PushEvent, PullRequest, MergeGroupEvent, PullRequestEvent, ReleaseEvent } from '@octokit/webhooks-types'

import {
  isPredicateQuantifier,
  Filter,
  FilterConfig,
  FilterResults,
  PredicateQuantifier,
  SUPPORTED_PREDICATE_QUANTIFIERS,
} from './filter'
import { File, ChangeStatus } from './file'
import * as git from './git'
import { backslashEscape, shellEscape } from './list-format/shell-escape'
import { csvEscape } from './list-format/csv-escape'

type ExportFormat = 'none' | 'csv' | 'json' | 'json-detailed' | 'shell' | 'escape' | 'lines'

async function run(): Promise<void> {
  try {
    const workingDirectory = core.getInput('working-directory', { required: false })
    if (workingDirectory) {
      process.chdir(workingDirectory)
    }

    const token = core.getInput('token', { required: false })
    const ref = core.getInput('ref', { required: false })
    const base = core.getInput('base', { required: false })
    const filtersInput = core.getInput('filters', { required: true })
    const filtersYaml = isPathInput(filtersInput) ? getConfigFileContent(filtersInput) : filtersInput
    const listFiles = core.getInput('list-files', { required: false }).toLowerCase() || 'none'
    const writeToFiles = core.getInput('write-to-files', { required: false }) === 'true'
    const strictExcludesInput = core.getInput('strict-excludes', { required: false })
    const strictExcludes = strictExcludesInput
      ? strictExcludesInput.toLowerCase() === 'true'
      : false
    const filesInput = core.getInput('files', { required: false }) // New: Custom files list
    const globalIgnore = core.getInput('global-ignore', { required: false }) // New: Global ignore file
    const initialFetchDepth = parseInt(core.getInput('initial-fetch-depth', { required: false })) || 10
    const predicateQuantifier = core.getInput('predicate-quantifier', { required: false }) || PredicateQuantifier.SOME

    if (!isExportFormat(listFiles)) {
      core.setFailed(`Input parameter 'list-files' is set to invalid value '${listFiles}'`)
      return
    }

    if (writeToFiles && listFiles === 'none') {
      core.warning('write-to-files is true, but list-files is "none". No file will be written.')
    }

    if (!isPredicateQuantifier(predicateQuantifier)) {
      const predicateQuantifierInvalidErrorMsg =
        `Input parameter 'predicate-quantifier' is set to invalid value ` +
        `'${predicateQuantifier}'. Valid values: ${SUPPORTED_PREDICATE_QUANTIFIERS.join(', ')}`
      throw new Error(predicateQuantifierInvalidErrorMsg)
    }

    // Determine files: Use custom input if provided, else compute via Git/API
    let files: File[]
    if (filesInput) {
      core.info(`Using custom files input (${filesInput.split('\n').filter(Boolean).length} files)`)
      files = filesInput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((filename) => ({
          filename,
          status: ChangeStatus.Modified, // Default status for custom files
          from: filename,
        }))
    } else {
      files = await getChangedFiles(token, base, ref, initialFetchDepth)
    }

    core.info(`Detected ${files.length} changed files`)

    const filterConfig: FilterConfig = {
      predicateQuantifier,
      globalIgnore: globalIgnore || undefined,
      strictExcludes,
    }
    const filter = new Filter(filtersYaml, filterConfig)
    const results = filter.match(files)
    exportResults(results, listFiles, writeToFiles)
  } catch (error) {
    core.setFailed(getErrorMessage(error))
  }
}

function isPathInput(text: string): boolean {
  return !(text.includes('\n') || text.includes(':'))
}

function getConfigFileContent(configPath: string): string {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file '${configPath}' not found`)
  }

  if (!fs.lstatSync(configPath).isFile()) {
    throw new Error(`'${configPath}' is not a file.`)
  }

  return fs.readFileSync(configPath, { encoding: 'utf8' })
}

async function getChangedFiles(token: string, base: string, ref: string, initialFetchDepth: number): Promise<File[]> {
  // if base is 'HEAD' only local uncommitted changes will be detected
  // This is the simplest case as we don't need to fetch more commits or evaluate current/before refs
  if (base === git.HEAD) {
    if (ref) {
      core.notice(`'ref' input parameter is ignored when 'base' is set to HEAD`)
    }
    return await git.getChangesOnHead()
  }

  const prEvents = ['pull_request', 'pull_request_review', 'pull_request_review_comment', 'pull_request_target']
  if (prEvents.includes(github.context.eventName)) {
    if (ref) {
      core.notice(`'ref' input parameter is ignored when action is triggered by pull request event`)
    }
    if (base) {
      core.notice(`'base' input parameter is ignored when action is triggered by pull request event`)
    }
    const pr = github.context.payload.pull_request as PullRequest
    if (token) {
      return await getChangedFilesFromApi(token, pr)
    }
    if (github.context.eventName === 'pull_request_target') {
      // pull_request_target is executed in context of base branch and GITHUB_SHA points to last commit in base branch
      // Therefor it's not possible to look at changes in last commit
      // At the same time we don't want to fetch any code from forked repository
      throw new Error(`'token' input parameter is required if action is triggered by 'pull_request_target' event`)
    }
    core.info('GitHub token is not available - changes will be detected using git diff')
    const baseSha = (github.context.payload as PullRequestEvent).pull_request?.base.sha
    const defaultBranch: string | undefined = (github.context.payload.repository as { default_branch?: string })
      ?.default_branch
    const currentRef = await git.getCurrentRef()
    const safeBase = typeof baseSha === 'string' ? baseSha : typeof defaultBranch === 'string' ? defaultBranch : ''
    return await git.getChanges(base || safeBase, currentRef)
  }

  if (github.context.eventName === 'release') {
    const releasePayload = github.context.payload as ReleaseEvent
    const currentTag = releasePayload.release?.tag_name
    if (currentTag) {
      if (!ref) {
        ref = currentTag
        core.info(`Using tag_name from release event as ref: ${ref}`)
      }
      if (!base) {
        const previousTag = await git.getPreviousTag(currentTag)
        base = previousTag
        core.info(`Using previous tag from release event as base: ${base}`)
      }
    } else {
      core.warning('No tag_name found in release payload; falling back to default handling')
    }
  }

  if (github.context.eventName === 'merge_group') {
    // To keep backward compatibility, manual inputs take precedence over
    // commits in GitHub merge queue event.
    const mergeGroup = github.context.payload as MergeGroupEvent
    if (!base && mergeGroup.merge_group?.base_sha) {
      base = mergeGroup.merge_group.base_sha
      core.info(`Using base_sha from merge_group event: ${base}`)
    }
    if (!ref && mergeGroup.merge_group?.head_sha) {
      ref = mergeGroup.merge_group.head_sha
      core.info(`Using head_sha from merge_group event: ${ref}`)
    }
  }

  return getChangedFilesFromGit(base, ref, initialFetchDepth)
}

async function getChangedFilesFromGit(base: string, head: string, initialFetchDepth: number): Promise<File[]> {
  const repository = github.context.payload.repository as { default_branch?: string } | undefined
  const defaultBranch: string | undefined = repository?.default_branch

  let beforeSha: string | null = null
  if (github.context.eventName === 'push') {
    beforeSha = (github.context.payload as PushEvent).before
  }

  const currentRef = await git.getCurrentRef()

  head = git.getShortName(head || github.context.ref || currentRef)
  base = git.getShortName(base || (typeof defaultBranch === 'string' ? defaultBranch : ''))

  if (!head) {
    throw new Error(
      "This action requires 'head' input to be configured, 'ref' to be set in the event payload or branch/tag checked out in current git repository",
    )
  }

  if (!base) {
    throw new Error(
      "This action requires 'base' input to be configured or 'repository.default_branch' to be set in the event payload",
    )
  }

  const isBaseSha = git.isGitSha(base)
  const isBaseSameAsHead = base === head

  // If base is commit SHA we will do comparison against the referenced commit
  // Or if base references same branch it was pushed to, we will do comparison against the previously pushed commit
  if (isBaseSha || (isBaseSameAsHead && beforeSha !== null && beforeSha !== git.NULL_SHA)) {
    const baseSha = isBaseSha ? base : beforeSha!
    core.info(`Changes will be detected between ${baseSha} and ${head}`)
    return await git.getChanges(baseSha, head)
  }

  if (isBaseSameAsHead && beforeSha !== null && beforeSha === git.NULL_SHA) {
    core.warning(
      `'before' field is NULL_SHA (initial push) - will use merge base comparison instead of previous commit`,
    )
  } else if (isBaseSameAsHead && beforeSha === null) {
    core.warning(
      `'before' field is missing in event payload - will use merge base comparison instead of previous commit`,
    )
  }

  core.info(`Changes will be detected between ${base} and ${head}`)
  return await git.getChangesSinceMergeBase(base, head, initialFetchDepth)
}

// Uses github REST api to get list of files changed in PR
async function getChangedFilesFromApi(token: string, pullRequest: PullRequest): Promise<File[]> {
  core.startGroup(`Fetching list of changed files for PR#${pullRequest.number} from GitHub API`)
  try {
    const client = github.getOctokit(token)
    const per_page = 100
    const files: File[] = []
    let totalPages = 0

    core.info(`Invoking listFiles(pull_number: ${pullRequest.number}, per_page: ${per_page})`)
    for await (const response of client.paginate.iterator(
      client.rest.pulls.listFiles.endpoint.merge({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: pullRequest.number,
        per_page,
      }),
    )) {
      if (response.status !== 200) {
        throw new Error(`Fetching list of changed files from GitHub API failed with error code ${response.status}`)
      }
      totalPages++
      core.info(`Received ${response.data.length} items`)

      for (const row of response.data as GetResponseDataTypeFromEndpointMethod<typeof client.rest.pulls.listFiles>) {
        core.info(`[${row.status}] ${row.filename}`)
        // There's no obvious use-case for detection of renames
        // Therefore we treat it as if rename detection in git diff was turned off.
        // Rename is replaced by delete of original filename and add of new filename
        const previousFilename = 'previous_filename' in row ? (row.previous_filename as string) : undefined
        if ((row.status as ChangeStatus) === ChangeStatus.Renamed) {
          core.info(`Renamed file detected: ${row.filename} (previous: ${previousFilename})`)
          if (previousFilename === undefined) {
            core.warning(`Renamed file detected but previous filename is missing: ${row.filename}`)
            files.push({
              filename: row.filename,
              status: ChangeStatus.Added,
              from: row.filename,
            })
          } else {
            files.push({
              from: previousFilename,
              to: row.filename,
              status: ChangeStatus.Renamed,
              filename: row.filename,
            })
          }
        } else if ((row.status as ChangeStatus) === ChangeStatus.Copied) {
          core.info(`Copied file detected: ${row.filename} (previous: ${previousFilename})`)
          if (previousFilename === undefined) {
            core.warning(`Copied file detected but previous filename is missing: ${row.filename}`)
            files.push({
              from: row.filename,
              filename: row.filename,
              status: ChangeStatus.Added,
            })
          } else {
            files.push({
              filename: row.filename,
              to: row.filename,
              status: ChangeStatus.Copied,
              from: previousFilename,
            })
          }
        } else {
          // GitHub status and git status variants are same except for deleted files
          const status = row.status === 'removed' ? ChangeStatus.Deleted : (row.status as ChangeStatus)
          files.push({
            from: row.filename,
            filename: row.filename,
            status,
          })
        }
      }
    }

    core.info(`Fetched ${files.length} files over ${totalPages} pages`)

    // New: Fallback for large PRs if API fetch seems incomplete (e.g., < 4000 files threshold from issue reports)
    if (files.length < 4000 && pullRequest.number > 0) {
      const baseSha = pullRequest.base?.sha
      const headSha = pullRequest.head?.sha
      if (baseSha && headSha) {
        core.warning(
          `Incomplete API fetch detected (${files.length} files); falling back to Git diff for full detection`,
        )
        return await git.getChanges(baseSha, headSha)
      }
    }

    return files
  } finally {
    core.endGroup()
  }
}

function getExtension(format: ExportFormat): string {
  switch (format) {
    case 'json':
      return 'json'
    case 'csv':
      return 'csv'
    case 'shell':
    case 'escape':
    case 'lines':
      return 'txt'
    default:
      return 'txt'
  }
}

export function exportResults(results: FilterResults, format: ExportFormat, writeToFiles: boolean): void {
  core.info('Results:')
  const changes: string[] = []
  let anyChanged = false
  const resultsObjLength = Object.keys(results).length
  let counter = 0
  for (const [key, files] of Object.entries(results)) {
    const value = files.length > 0
    if (value) {
      counter++
    }
    core.startGroup(`Filter ${key} = ${value}`)
    core.info(`Filter ${key} matched ${files.length} files`)
    if (files.length > 0) {
      changes.push(key)
      anyChanged = true
      core.info('Matching files:')
      for (const file of files) {
        const filePrevious = 'previous_filename' in file ? (file.previous_filename as string) : undefined
        if (filePrevious === undefined) {
          if (file.status === ChangeStatus.Renamed || file.status === ChangeStatus.Copied) {
            core.info(`${file.from} -> ${file.filename} [${file.status}]`)
          } else {
            core.info(`${file.filename} [${file.status}]`)
          }
        } else {
          core.info(`[Trigger file: ${filePrevious}] - ${file.filename} [${file.status}]`)
        }
      }
    } else {
      core.info('Matching files: none')
    }

    // Always set outputs, regardless of value (Backward Compatibility)
    core.setOutput(key, value)
    core.setOutput(`${key}_count`, files.length)
    if (format !== 'none') {
      const filesValue = serializeExport(files, format)
      core.setOutput(`${key}_files`, filesValue)

      // New write-to-files logic: Write file if writeToFiles is true and matches are present
      if (writeToFiles && value) {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paths-filter-'))
        const ext = getExtension(format)
        const fileName = `${key}_files.${ext}`
        const filePath = path.join(tempDir, fileName)
        try {
          fs.writeFileSync(filePath, filesValue, { encoding: 'utf8' })
          core.setOutput(`${key}_files_path`, filePath)
          core.info(`Wrote matching files to: ${filePath}`)
        } catch (error) {
          // Fixed: Extract message first to satisfy ESLint (unknown -> string)
          const errorMsg = getErrorMessage(error)
          core.error(`Failed to write file for filter ${key}: ${errorMsg}`)
        }
      }
    }
    core.endGroup()
  }

  const allChanged = resultsObjLength === counter ? true : false
  core.setOutput('all_changed', allChanged)
  core.setOutput('any_changed', anyChanged)

  if (results['changes'] === undefined) {
    const filteredShared = changes.filter((change) => change !== 'shared')
    const changesJson = JSON.stringify(filteredShared)
    core.info(`Changes output set to ${changesJson}`)
    core.setOutput('changes', changesJson)
  } else {
    core.info('Cannot set changes output variable - name already used by filter output')
  }
}

function serializeExport(files: File[], format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return files
        .map((file) => file.filename)
        .map(csvEscape)
        .join(',')
    case 'json':
      return JSON.stringify(files.map((file) => file.filename))
    case 'json-detailed':
      return JSON.stringify(
        files.map(({ filename, status, from, to, similarity, previous_filename }) => {
          const detailed: Record<string, string | number> = {
            filename,
            status,
            from,
          }
          if (typeof to === 'string') {
            detailed.to = to
          }
          if (typeof similarity === 'number') {
            detailed.similarity = similarity
          }
          if (typeof previous_filename === 'string') {
            detailed.previous_filename = previous_filename
          }
          return detailed
        }),
      )
    case 'escape':
      return files
        .map((file) => file.filename)
        .map(backslashEscape)
        .join(' ')
    case 'shell':
      return files
        .map((file) => file.filename)
        .map(shellEscape)
        .join(' ')
    case 'lines':
      return files.map((file) => file.filename).join('\n')
    default:
      return ''
  }
}

function isExportFormat(value: string): value is ExportFormat {
  return ['none', 'csv', 'shell', 'json', 'json-detailed', 'escape', 'lines'].includes(value)
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

if (require.main === module) {
  void run()
}

export { run, getChangedFilesFromApi }
