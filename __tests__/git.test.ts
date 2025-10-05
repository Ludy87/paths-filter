import * as core from '@actions/core'
import { getExecOutput } from '@actions/exec'
import * as git from '../src/git'
import { ChangeStatus } from '../src/file'

jest.mock('@actions/core', () => ({
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
}))

jest.mock('@actions/exec', () => ({
  getExecOutput: jest.fn(),
}))

describe('git diff parsing helpers', () => {
  const getExecOutputMock = getExecOutput as jest.MockedFunction<typeof getExecOutput>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('getChangesInLastCommit returns files with correct change status', async () => {
    const diffOutput =
      [
        ['A', 'LICENSE'],
        ['M', 'src/index.ts'],
        ['D', 'src/main.ts'],
      ]
        .map(([status, filename]) => `${status} ${filename}`)
        .join(String.fromCharCode(0)) + String.fromCharCode(0)
    getExecOutputMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: diffOutput,
      stderr: '',
    })

    const files = await git.getChangesInLastCommit()

    expect(files).toEqual([
      { filename: 'LICENSE', status: ChangeStatus.Added, from: 'LICENSE' },
      { filename: 'src/index.ts', status: ChangeStatus.Modified, from: 'src/index.ts' },
      { filename: 'src/main.ts', status: ChangeStatus.Deleted, from: 'src/main.ts' },
    ])
    expect(core.startGroup).toHaveBeenCalled()
    expect(core.endGroup).toHaveBeenCalled()
  })

  test('getChanges handles diff between two refs', async () => {
    // base ref resolution succeeds on the first check
    getExecOutputMock.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
    // head ref resolution succeeds on the first check
    getExecOutputMock.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
    // diff command output
    const diffOutput = ['M src/utils.ts', ''].join(String.fromCharCode(0))
    getExecOutputMock.mockResolvedValueOnce({ exitCode: 0, stdout: diffOutput, stderr: '' })

    const files = await git.getChanges('base', 'head')

    expect(files).toEqual([{ filename: 'src/utils.ts', status: ChangeStatus.Modified, from: 'src/utils.ts' }])
    expect(getExecOutputMock).toHaveBeenLastCalledWith(
      'git',
      expect.arrayContaining(['refs/heads/base..refs/heads/head']),
    )
  })

  test('getChanges preserves source path for renamed files', async () => {
    getExecOutputMock.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
    getExecOutputMock.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
    const diffOutput = ['R100', 'src/old.ts', 'src/new.ts', ''].join(String.fromCharCode(0))
    getExecOutputMock.mockResolvedValueOnce({ exitCode: 0, stdout: diffOutput, stderr: '' })

    const files = await git.getChanges('base', 'head')
    expect(files).toEqual([
      {
        filename: 'src/new.ts',
        status: ChangeStatus.Renamed,
        from: 'src/old.ts',
        to: 'src/new.ts',
        similarity: 100,
      },
    ])
  })

  test('getLocalRef accepts commit SHAs without failing lookups', async () => {
    getExecOutputMock.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' })
    getExecOutputMock.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' })
    getExecOutputMock.mockResolvedValueOnce({ exitCode: 0, stdout: 'abcdef\n', stderr: '' })

    const ref = await git.getLocalRef('abcdef')

    expect(ref).toBe('abcdef')
    expect(getExecOutputMock).toHaveBeenNthCalledWith(1, 'git', ['show-ref', '--verify', '-q', 'refs/heads/abcdef'], {
      ignoreReturnCode: true,
    })
    expect(getExecOutputMock).toHaveBeenNthCalledWith(2, 'git', ['show-ref', '--verify', '-q', 'refs/tags/abcdef'], {
      ignoreReturnCode: true,
    })
    expect(getExecOutputMock).toHaveBeenNthCalledWith(3, 'git', ['rev-parse', '--verify', 'abcdef'], {
      ignoreReturnCode: true,
    })
  })

  test('getChangeStatus throws on unknown status', () => {
    expect(() => git.getChangeStatus('X')).toThrow(/Unknown change status/)
  })

  test('groupFilesByStatus groups files by their change status', () => {
    const grouped = git.groupFilesByStatus([
      { filename: 'a', status: ChangeStatus.Added, from: 'a' },
      { filename: 'b', status: ChangeStatus.Added, from: 'b' },
      { filename: 'c', status: ChangeStatus.Modified, from: 'c' },
    ])

    expect(grouped[ChangeStatus.Added].length).toBe(2)
    expect(grouped[ChangeStatus.Modified].length).toBe(1)
    expect(grouped[ChangeStatus.Deleted].length).toBe(0)
  })
})

describe('git utility function tests (those not invoking git)', () => {
  test('Trims "refs/" and "heads/" from ref', () => {
    expect(git.getShortName('refs/heads/master')).toBe('master')
    expect(git.getShortName('heads/master')).toBe('heads/master')
    expect(git.getShortName('master')).toBe('master')

    expect(git.getShortName('refs/tags/v1')).toBe('v1')
    expect(git.getShortName('tags/v1')).toBe('tags/v1')
    expect(git.getShortName('v1')).toBe('v1')
  })

  test('isGitSha(ref) returns true only for 40 characters of a-z and 0-9', () => {
    expect(git.isGitSha('8b399ed1681b9efd6b1e048ca1c5cba47edf3855')).toBeTruthy()
    expect(git.isGitSha('This_is_very_long_name_for_a_branch_1111')).toBeFalsy()
    expect(git.isGitSha('master')).toBeFalsy()
  })
})
