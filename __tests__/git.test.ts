import * as git from '../src/git'
import {ChangeStatus} from '../src/file'

describe('parsing output of the git diff command', () => {
  test('parseGitDiffOutput returns files with correct change status', async () => {
    const files = git.parseGitDiffOutput(
      'A\u0000LICENSE\u0000' + 'M\u0000src/index.ts\u0000' + 'D\u0000src/main.ts\u0000'
    )
    expect(files.length).toBe(3)
    expect(files[0].filename).toBe('LICENSE')
    expect(files[0].status).toBe(ChangeStatus.Added)
    expect(files[1].filename).toBe('src/index.ts')
    expect(files[1].status).toBe(ChangeStatus.Modified)
    expect(files[2].filename).toBe('src/main.ts')
    expect(files[2].status).toBe(ChangeStatus.Deleted)
  })

  test('parseGitDiffOutput handles copied, renamed and unmerged statuses', async () => {
    const payload = [
      'C75',
      'src/copied75.ts',
      'src/c/copied75.ts',
      'R100',
      'src/renamed100_old.ts',
      'src/renamed100.ts',
      'U',
      'src/conflict.ts',
      'C',
      'src/copied.ts',
      'src/c/copied.ts',
      'R',
      'src/renamed_old.ts',
      'src/renamed.ts'
    ].join('\u0000')

    const files = git.parseGitDiffOutput(payload)

    expect(files).toEqual([
      {filename: 'src/c/copied75.ts', status: ChangeStatus.Copied},
      {filename: 'src/renamed100.ts', status: ChangeStatus.Renamed},
      {filename: 'src/conflict.ts', status: ChangeStatus.Unmerged},
      {filename: 'src/c/copied.ts', status: ChangeStatus.Copied},
      {filename: 'src/renamed.ts', status: ChangeStatus.Renamed}
    ])
  })

  test('getChangeStatus throws on unknown status', () => {
    expect(() => git.getChangeStatus('X')).toThrow(/Unknown change status/)
  })

  test('groupFilesByStatus groups files by their change status', () => {
    const grouped = git.groupFilesByStatus([
      {filename: 'a', status: ChangeStatus.Added},
      {filename: 'b', status: ChangeStatus.Added},
      {filename: 'c', status: ChangeStatus.Modified}
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
