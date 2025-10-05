import { getExecOutput } from '@actions/exec'
import * as core from '@actions/core'
import { File, ChangeStatus } from './file'

export const NULL_SHA = '0000000000000000000000000000000000000000'
export const HEAD = 'HEAD'

export async function getChangesInLastCommit(): Promise<File[]> {
  core.startGroup(`Change detection in last commit`)
  let output = ''
  try {
    // output = (await getExecOutput('git', ['log', '--format=', '--no-renames', '--name-status', '-z', '-n', '1'])).stdout
    output = (await getExecOutput('git', ['log', '--format=', '--name-status', '-z', '-M', '-C', '-n', '1'])).stdout
  } finally {
    fixStdOutNullTermination()
    core.endGroup()
  }

  return parseGitDiffOutput(output)
}

export async function getChanges(base: string, head: string): Promise<File[]> {
  const baseRef = await ensureRefAvailable(base)
  const headRef = await ensureRefAvailable(head)

  // Get differences between ref and HEAD
  core.startGroup(`Change detection ${base}..${head}`)
  let output = ''
  try {
    // Two dots '..' change detection - directly compares two versions
    // output = (await getExecOutput('git', ['diff', '--no-renames', '--name-status', '-z', `${baseRef}..${headRef}`])).stdout
    output = (
      await getExecOutput('git', [
        'diff',
        '--name-status',
        '--find-copies-harder',
        '-z',
        '-M',
        `${baseRef}..${headRef}`,
      ])
    ).stdout
  } finally {
    fixStdOutNullTermination()
    core.endGroup()
  }

  return parseGitDiffOutput(output)
}

export async function getChangesOnHead(): Promise<File[]> {
  // Get current changes - both staged and unstaged
  core.startGroup(`Change detection on HEAD`)
  let output = ''
  try {
    // output = (await getExecOutput('git', ['diff', '--no-renames', '--name-status', '-z', 'HEAD'])).stdout
    output = (await getExecOutput('git', ['diff', '--name-status', '--find-copies-harder', '-z', '-M', 'HEAD'])).stdout
  } finally {
    fixStdOutNullTermination()
    core.endGroup()
  }

  return parseGitDiffOutput(output)
}

export async function getChangesSinceMergeBase(
  base: string,
  head: string,
  _initialFetchDepth: number,
): Promise<File[]> {
  core.startGroup(`Ensuring deep enough history for merge-base`)
  try {
    await getExecOutput('git', ['fetch', '--unshallow'])
  } finally {
    core.endGroup()
  }

  const mergeBase = (await getExecOutput('git', ['merge-base', base, head])).stdout.trim()
  if (!mergeBase) {
    throw new Error(`No merge base found between ${base} and ${head}`)
  }

  core.startGroup(`Change detection ${base}..${head}`)
  let output = ''
  try {
    output = (
      await getExecOutput('git', ['diff', '--name-status', '--find-copies-harder', '-z', '-M', `${mergeBase}..${head}`])
    ).stdout
  } finally {
    fixStdOutNullTermination()
    core.endGroup()
  }

  return parseGitDiffOutput(output)
}

export async function getCurrentRef(): Promise<string> {
  const ref = (await getExecOutput('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
  if (ref === 'HEAD') {
    return (await getExecOutput('git', ['rev-parse', 'HEAD'])).stdout.trim()
  }
  return ref
}

export function getShortName(ref: string): string {
  if (!ref) {
    return ref
  }
  const match = ref.match(/refs\/(?:heads|tags|remotes\/[^/]+)\/(.+)/)
  return match ? match[1] : ref
}

export function isGitSha(ref: string): boolean {
  return /^[0-9a-f]{40}$/.test(ref)
}

export async function getLocalRef(name: string): Promise<string | undefined> {
  const refs = await getExecOutput('git', ['show-ref', '--verify', '-q', `refs/heads/${name}`])
  if (refs.exitCode === 0) {
    return `refs/heads/${name}`
  }

  const tags = await getExecOutput('git', ['show-ref', '--verify', '-q', `refs/tags/${name}`])
  if (tags.exitCode === 0) {
    return `refs/tags/${name}`
  }

  const shas = await getExecOutput('git', ['rev-parse', '--verify', name])
  if (shas.exitCode === 0) {
    return shas.stdout.trim()
  }

  const allRefs = await getExecOutput('git', ['for-each-ref', '--format=%(refname)', `refs/*/${name}`])
  const match = allRefs.stdout.match(/^refs\/(.+?)\/${name}$/m)
  if (match) {
    return `refs/${match[1]}/${name}`
  }

  return undefined
}

// New: Helper for release events to get previous tag
export async function getPreviousTag(currentTag: string): Promise<string> {
  core.startGroup(`Fetching tags for previous tag detection`)
  try {
    const tagsOutput = (await getExecOutput('git', ['tag', '--sort=-creatordate'])).stdout
    const tags = tagsOutput.split('\n').filter(Boolean).slice(0, 2) // Top 2 tags
    if (tags.length < 2) {
      core.warning(`Insufficient tags found; using fallback base 'v0.0.0' for release diff`)
      return 'v0.0.0'
    }
    const previousTag = tags[1]
    core.info(`Previous tag to ${currentTag}: ${previousTag}`)
    return previousTag
  } finally {
    core.endGroup()
  }
}

async function ensureRefAvailable(name: string): Promise<string> {
  core.startGroup(`Ensuring ${name} is fetched from origin`)
  try {
    let ref = await getLocalRef(name)
    if (ref === undefined) {
      await getExecOutput('git', ['fetch', '--depth=1', '--no-tags', 'origin', name])
      ref = await getLocalRef(name)
      if (ref === undefined) {
        await getExecOutput('git', ['fetch', '--depth=1', '--tags', 'origin', name])
        ref = await getLocalRef(name)
        if (ref === undefined) {
          throw new Error(`Could not determine what is ${name} - fetch works but it's not a branch, tag or commit SHA`)
        }
      }
    }

    return ref
  } finally {
    core.endGroup()
  }
}

function fixStdOutNullTermination(): void {
  // Previous command uses NULL as delimiters and output is printed to stdout.
  // We have to make sure next thing written to stdout will start on new line.
  // Otherwise things like ::set-output wouldn't work.
  core.info('')
}

const statusMap: { [char: string]: ChangeStatus } = {
  A: ChangeStatus.Added,
  C: ChangeStatus.Copied,
  D: ChangeStatus.Deleted,
  M: ChangeStatus.Modified,
  R: ChangeStatus.Renamed,
  U: ChangeStatus.Unmerged,
}

export function getChangeStatus(code: string): ChangeStatus {
  const status = statusMap[code]
  if (status === undefined) {
    throw new Error(`Unknown change status '${code}'`)
  }
  return status
}

export function groupFilesByStatus(files: File[]): Record<ChangeStatus, File[]> {
  const grouped: Record<ChangeStatus, File[]> = {
    [ChangeStatus.Added]: [],
    [ChangeStatus.Copied]: [],
    [ChangeStatus.Deleted]: [],
    [ChangeStatus.Modified]: [],
    [ChangeStatus.Renamed]: [],
    [ChangeStatus.Unmerged]: [],
  }

  for (const file of files) {
    grouped[file.status].push(file)
  }

  return grouped
}

const parseNullTerminated = (output: string, startIndex: number): [string, number] => {
  let i = startIndex
  let value = ''
  while (i < output.length && output.charAt(i) !== '\0') {
    value += output.charAt(i)
    i++
  }
  if (i < output.length && output.charAt(i) === '\0') {
    i++
  }
  return [value, i]
}

export function parseGitDiffOutput(output: string): File[] {
  const files: File[] = []
  let index = 0
  while (index < output.length) {
    const [rawStatusToken, nextIndex] = parseNullTerminated(output, index)
    index = nextIndex

    if (!rawStatusToken) {
      break
    }

    let statusToken = rawStatusToken
    let inlineFirstPath: string | undefined
    let inlineSecondPath: string | undefined

    const firstSeparatorIndex = statusToken.search(/[\s\t]/)
    if (firstSeparatorIndex !== -1) {
      const inlinePathText = statusToken.slice(firstSeparatorIndex + 1)
      statusToken = statusToken.slice(0, firstSeparatorIndex)

      // Git can separate inline paths with either spaces or tabs depending on the flags used.
      const tabSeparated = inlinePathText.split('\t')
      if (tabSeparated.length > 1) {
        ;[inlineFirstPath, inlineSecondPath] = tabSeparated
      } else {
        inlineFirstPath = inlinePathText
      }

      if (inlineSecondPath === undefined && inlineFirstPath !== undefined) {
        const spaceIndex = inlineFirstPath.indexOf(' ')
        if (spaceIndex !== -1) {
          inlineSecondPath = inlineFirstPath.slice(spaceIndex + 1)
          inlineFirstPath = inlineFirstPath.slice(0, spaceIndex)
        }
      }

      if (inlineFirstPath !== undefined) {
        inlineFirstPath = inlineFirstPath.trim()
      }
      if (inlineSecondPath !== undefined) {
        inlineSecondPath = inlineSecondPath.trim()
      }
    }

    const statusCode = statusToken.charAt(0)
    const similarityText = statusToken.slice(1)
    const similarity = similarityText ? Number.parseInt(similarityText, 10) : undefined

    let firstPath: string | undefined
    if (inlineFirstPath !== undefined) {
      firstPath = inlineFirstPath
    } else {
      const [parsedFirstPath, afterFirstPath] = parseNullTerminated(output, index)
      firstPath = parsedFirstPath
      index = afterFirstPath
    }

    if (!firstPath) {
      continue
    }

    const status = getChangeStatus(statusCode)

    if (status === ChangeStatus.Copied || status === ChangeStatus.Renamed) {
      let secondPath: string | undefined
      if (inlineSecondPath !== undefined) {
        secondPath = inlineSecondPath
      } else {
        const [parsedSecondPath, afterSecondPath] = parseNullTerminated(output, index)
        secondPath = parsedSecondPath
        index = afterSecondPath
      }

      const destination = secondPath || firstPath
      const similarityScore = Number.isNaN(similarity) ? undefined : similarity

      files.push({
        filename: destination,
        status,
        from: firstPath,
        to: destination,
        ...(similarityScore !== undefined ? { similarity: similarityScore } : {}),
      })
    } else {
      files.push({
        filename: firstPath,
        status,
        from: firstPath,
      })
    }
  }

  return files
}
