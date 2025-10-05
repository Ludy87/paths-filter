import { ChangeStatus } from '../src/file'
import { exportResults } from '../src/main'
import * as core from '@actions/core'

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  setOutput: jest.fn(),
}))

describe('exportResults file listing formats', () => {
  const files = [
    { filename: 'simple.txt', status: ChangeStatus.Modified, from: 'simple.txt' },
    { filename: 'file with space.txt', status: ChangeStatus.Added, from: 'file with space.txt' },
  ]
  const results = { sample: files }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('exports csv formatted list', () => {
    exportResults(results, 'csv', false)
    expect(core.setOutput).toHaveBeenCalledWith('sample_files', 'simple.txt,"file with space.txt"')
  })

  test('exports json formatted list', () => {
    exportResults(results, 'json', false)
    expect(core.setOutput).toHaveBeenCalledWith('sample_files', JSON.stringify(['simple.txt', 'file with space.txt']))
  })

  test('exports detailed json formatted list', () => {
    exportResults(results, 'json-detailed')
    expect(core.setOutput).toHaveBeenCalledWith(
      'sample_files',
      JSON.stringify([
        { filename: 'simple.txt', status: ChangeStatus.Modified, from: 'simple.txt' },
        { filename: 'file with space.txt', status: ChangeStatus.Added, from: 'file with space.txt' },
      ]),
    )
  })

  test('exports shell escaped list', () => {
    exportResults(results, 'shell', false)
    expect(core.setOutput).toHaveBeenCalledWith('sample_files', "simple.txt 'file with space.txt'")
  })

  test('exports escape formatted list', () => {
    exportResults(results, 'escape', false)
    expect(core.setOutput).toHaveBeenCalledWith('sample_files', 'simple.txt file\\ with\\ space.txt')
  })

  test('exports newline separated list', () => {
    exportResults(results, 'lines', false)
    expect(core.setOutput).toHaveBeenCalledWith('sample_files', 'simple.txt\nfile with space.txt')
  })
})
