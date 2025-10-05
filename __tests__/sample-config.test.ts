import * as fs from 'fs'
import * as path from 'path'
import { ChangeStatus } from '../src/file'
import { createFilter } from './helpers'

describe('sample configuration file', () => {
  test('parses filter rules from sample file', () => {
    const yamlPath = path.join(__dirname, 'fixtures', 'sample-filter.yml')
    const yaml = fs.readFileSync(yamlPath, 'utf8')
    const filter = createFilter(yaml)
    const files = [{ filename: 'src/index.ts', status: ChangeStatus.Modified, from: 'src/index.ts' }]
    const match = filter.match(files)
    expect(match.sample).toEqual(files)
  })
})
