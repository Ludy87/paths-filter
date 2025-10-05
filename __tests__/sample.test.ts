import { ChangeStatus } from '../src/file'
import { createFilter } from './helpers'

describe('sample filter usage', () => {
  test('matches files in sample folder', () => {
    const yaml = `
    sample:
      - sample/**
    `
    const filter = createFilter(yaml)
    const files = [{ filename: 'sample/example.ts', status: ChangeStatus.Modified, from: 'sample/example.ts' }]
    const match = filter.match(files)
    expect(match.sample).toEqual(files)
  })

  test('does not match files outside sample folder', () => {
    const yaml = `
    sample:
      - sample/**
    `
    const filter = createFilter(yaml)
    const files = [{ filename: 'other/example.ts', status: ChangeStatus.Modified, from: 'other/example.ts' }]
    const match = filter.match(files)
    expect(match.sample).toEqual([])
  })
})
