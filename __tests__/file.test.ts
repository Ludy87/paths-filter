import { ChangeStatus, statusMap } from '../src/file'

describe('ChangeStatus enum', () => {
  const cases: Array<[keyof typeof ChangeStatus, string]> = [
    ['Added', 'added'],
    ['Copied', 'copied'],
    ['Deleted', 'deleted'],
    ['Modified', 'modified'],
    ['Renamed', 'renamed'],
    ['Unmerged', 'unmerged'],
  ]

  it.each(cases)("%s should resolve to '%s'", (key, expected) => {
    expect(ChangeStatus[key]).toBe(expected)
  })
})

describe('statusMap', () => {
  it('should include all supported git status codes', () => {
    expect(Object.keys(statusMap).sort()).toEqual(['A', 'C', 'D', 'M', 'R', 'U'])
  })

  const mapCases: Array<[keyof typeof statusMap, ChangeStatus]> = [
    ['A', ChangeStatus.Added],
    ['M', ChangeStatus.Modified],
    ['D', ChangeStatus.Deleted],
    ['R', ChangeStatus.Renamed],
    ['C', ChangeStatus.Copied],
    ['U', ChangeStatus.Unmerged],
  ]

  it.each(mapCases)('maps %s to %s', (key, expected) => {
    expect(statusMap[key]).toBe(expected)
  })
})
