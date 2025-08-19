import {ChangeStatus} from '../src/file'
import {Filter} from '../src/filter'
import {exportResults} from '../src/main'
import * as core from '@actions/core'

jest.mock('@actions/core', () => ({
  setOutput: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  info: jest.fn()
}))

describe('all_changed and any_changed outputs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('reports true when all filters changed', () => {
    const results = {
      src: [{filename: 'src/file.ts', status: ChangeStatus.Modified}],
      docs: [{filename: 'docs/readme.md', status: ChangeStatus.Added}]
    }
    exportResults(results, 'none')
    expect(core.setOutput).toHaveBeenCalledWith('all_changed', true)
    expect(core.setOutput).toHaveBeenCalledWith('any_changed', true)
  })

  test('reports false for all_changed when some filters unchanged', () => {
    const results = {
      src: [{filename: 'src/file.ts', status: ChangeStatus.Modified}],
      docs: []
    }
    exportResults(results, 'none')
    expect(core.setOutput).toHaveBeenCalledWith('all_changed', false)
    expect(core.setOutput).toHaveBeenCalledWith('any_changed', true)
  })

  test('reports false for any_changed when no filter changed', () => {
    const results = {
      src: [],
      docs: []
    }
    exportResults(results, 'none')
    expect(core.setOutput).toHaveBeenCalledWith('all_changed', true)
    expect(core.setOutput).toHaveBeenCalledWith('any_changed', false)
  })
})

describe('filter outputs with negated patterns', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('does not report filter when file is excluded by negated pattern', () => {
    const yaml = `
    backend:
      - '**/*backend*'
      - 'src/backend/**'
      - 'src/shared/**'
      - '**/Cargo*'
      - '**/*rust*'
      - 'Dockerfile'
      - 'docker/**'
      - '!src/frontend/**'
    `
    const filter = new Filter(yaml)
    const match = filter.match(modified(['vitest.setup.ts']))
    exportResults(match, 'none')
    expect(core.setOutput).toHaveBeenCalledWith('backend', false)
  })
})

function modified(paths: string[]) {
  return paths.map(filename => ({filename, status: ChangeStatus.Modified}))
}
