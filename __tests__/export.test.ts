import * as fs from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import { File, ChangeStatus } from '../src/file'
import { exportResults } from '../src/main'
import { createFilter } from './helpers'

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  setFailed: jest.fn(),
  startGroup: jest.fn(),
  setOutput: jest.fn(),
  endGroup: jest.fn(),
  warning: jest.fn(),
}))

describe('set output post filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('correctly sets output', () => {
    const yaml = `
    backend:
      - '**/*'
      - '!**/*.tsx'
      - '!**/*.less'
    `
    const filter = createFilter(yaml)
    const files = modified(['config/settings.yml'])
    const match = filter.match(files)
    exportResults(match, 'none', false)

    expect(core.setOutput).toHaveBeenCalledWith('changes', '["backend"]')
  })

  test('writes matched files to disk when enabled', () => {
    const yaml = `
    backend:
      - 'backend/**'
    `
    const filter = createFilter(yaml)
    const files = modified(['backend/src/index.ts'])
    const match = filter.match(files)

    exportResults(match, 'json', true)

    const setOutputMock = core.setOutput as jest.MockedFunction<typeof core.setOutput>
    const filePathCall = setOutputMock.mock.calls.find(([name]) => name === 'backend_files_path')
    expect(filePathCall).toBeDefined()

    const [, filePath] = filePathCall as [string, string]
    expect(path.basename(filePath)).toBe('backend_files.json')
    expect(fs.existsSync(filePath)).toBe(true)
    expect(fs.readFileSync(filePath, 'utf8')).toBe(JSON.stringify(['backend/src/index.ts']))
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true })
  })

  test('correctly filters out shared from output', () => {
    const yaml = `
    shared: &shared
      - common/**/*
      - config/**/*
    src:
      - *shared
      - src/**/*
    backend:
      - '!(**/*.tsx|**/*.less)'
      - '**/*'
      - '!**/*.tsx'
      - '!**/*.less'
    `
    const filter = createFilter(yaml)
    const files = modified(['config/settings.yml'])
    const match = filter.match(files)
    exportResults(match, 'none', false)

    expect(core.setOutput).toHaveBeenCalledWith('changes', '["src","backend"]')
  })
})

function modified(paths: readonly string[]): File[] {
  return paths.map((filename) => {
    return { filename, status: ChangeStatus.Modified, from: filename }
  })
}
