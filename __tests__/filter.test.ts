import * as path from 'path'
import { File, ChangeStatus } from '../src/file'
import { createFilter } from './helpers'
import { PredicateQuantifier } from '../src/filter'

describe('yaml filter parsing tests', () => {
  test('throws if yaml is not a dictionary', () => {
    const yaml = 'not a dictionary'
    const t = () => createFilter(yaml)
    expect(t).toThrow(/^Invalid filter.*/)
  })
  test('throws if pattern is not a string', () => {
    const yaml = `
    src:
      - src/**/*.js
      - dict:
          some: value
    `
    const t = () => createFilter(yaml)
    expect(t).toThrow(/^Invalid filter.*/)
  })
})

describe('matching tests', () => {
  test('matches single inline rule', () => {
    const yaml = `
    src: "src/**/*.js"
    `
    let filter = createFilter(yaml)
    const files = modified(['src/app/module/file.js'])
    const match = filter.match(files)
    expect(match.src).toEqual(files)
  })
  test('matches single rule in single group', () => {
    const yaml = `
    src:
      - src/**/*.js
    `
    const filter = createFilter(yaml)
    const files = modified(['src/app/module/file.js'])
    const match = filter.match(files)
    expect(match.src).toEqual(files)
  })

  test('no match when file is in different folder', () => {
    const yaml = `
    src:
      - src/**/*.js
    `
    const filter = createFilter(yaml)
    const match = filter.match(modified(['not_src/other_file.js']))
    expect(match.src).toEqual([])
  })

  test('match only within second groups ', () => {
    const yaml = `
    src:
      - src/**/*.js
    test:
      - test/**/*.js
    `
    const filter = createFilter(yaml)
    const files = modified(['test/test.js'])
    const match = filter.match(files)
    expect(match.src).toEqual([])
    expect(match.test).toEqual(files)
  })

  test('match only withing second rule of single group', () => {
    const yaml = `
    src:
      - src/**/*.js
      - test/**/*.js
    `
    const filter = createFilter(yaml)
    const files = modified(['test/test.js'])
    const match = filter.match(files)
    expect(match.src).toEqual(files)
  })

  test('matches anything', () => {
    const yaml = `
    any:
      - "**"
    `
    const filter = createFilter(yaml)
    const files = modified(['test/test.js'])
    const match = filter.match(files)
    expect(match.any).toEqual(files)
  })

  test('globbing matches path where file or folder name starts with dot', () => {
    const yaml = `
    dot:
      - "**/*.js"
    `
    const filter = createFilter(yaml)
    const files = modified(['.test/.test.js'])
    const match = filter.match(files)
    expect(match.dot).toEqual(files)
  })

  test('does not match when only negated pattern matches', () => {
    const yaml = `
    backend:
      - src/backend/**
      - '!src/frontend/**'
    `
    const filter = createFilter(yaml)
    const files = modified(['vitest.setup.ts'])
    const match = filter.match(files)
    expect(match.backend).toEqual([])
  })

  test('does not match unrelated files with complex filter combinations', () => {
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
    const filter = createFilter(yaml)
    const files = modified(['vitest.setup.ts'])
    const match = filter.match(files)
    expect(match.backend).toEqual([])
  })

  test('negated pattern excludes matching files', () => {
    const yaml = `
    backend:
      - '**/*'
      - '!src/frontend/**'
    `
    const filter = createFilter(yaml)
    const backendFile = modified(['src/backend/main.ts'])
    const frontendFile = modified(['src/frontend/main.ts'])
    expect(filter.match(backendFile).backend).toEqual(backendFile)
    expect(filter.match(frontendFile).backend).toEqual([])
  })

  test('global ignore patterns remove matching files before rule evaluation', () => {
    const yaml = `
    app:
      - '**/*.ts'
    `
    const globalIgnorePath = path.join(__dirname, 'fixtures', 'global-ignore.txt')
    const filter = createFilter(yaml, { globalIgnore: globalIgnorePath })

    const files = modified(['src/index.ts', 'ignored/app.ts'])
    const match = filter.match(files)

    expect(match.app).toEqual(modified(['src/index.ts']))
  })

  test('strict excludes drop all files when an excluded pattern matches', () => {
    const yaml = `
    app:
      - '**/*.ts'
      - '!src/frontend/**'
    `
    const filter = createFilter(yaml, { strictExcludes: true })

    const files = modified(['src/backend/main.ts', 'src/frontend/main.ts'])
    const match = filter.match(files)

    expect(match.app).toEqual([])

    const backendOnlyMatch = filter.match(modified(['src/backend/main.ts']))
    expect(backendOnlyMatch.app).toEqual(modified(['src/backend/main.ts']))
  })

  test('matches all except tsx and less files (negate a group with or-ed parts)', () => {
    const yaml = `
    backend:
      - '!(**/*.tsx|**/*.less)'
      - '**/*'
      - '!**/*.tsx'
      - '!**/*.less'
    `
    const filter = createFilter(yaml)
    const tsxFiles = modified(['src/ui.tsx'])
    const lessFiles = modified(['src/ui.less'])
    const pyFiles = modified(['src/server.py'])

    const tsxMatch = filter.match(tsxFiles)
    const lessMatch = filter.match(lessFiles)
    const pyMatch = filter.match(pyFiles)

    expect(tsxMatch.backend).toEqual([])
    expect(lessMatch.backend).toEqual([])
    expect(pyMatch.backend).toEqual(pyFiles)
  })

  test('matches only files that are matching EVERY pattern when set to PredicateQuantifier.EVERY', () => {
    const yaml = `
    backend:
      - 'pkg/a/b/c/**'
      - '!**/*.jpeg'
      - '!**/*.md'
    `
    const filter = createFilter(yaml, { predicateQuantifier: PredicateQuantifier.EVERY })

    const typescriptFiles = modified(['pkg/a/b/c/some-class.ts', 'pkg/a/b/c/src/main/some-class.ts'])
    const otherPkgTypescriptFiles = modified(['pkg/x/y/z/some-class.ts', 'pkg/x/y/z/src/main/some-class.ts'])
    const otherPkgJpegFiles = modified(['pkg/x/y/z/some-pic.jpeg', 'pkg/x/y/z/src/main/jpeg/some-pic.jpeg'])
    const docsFiles = modified([
      'pkg/a/b/c/some-pics.jpeg',
      'pkg/a/b/c/src/main/jpeg/some-pic.jpeg',
      'pkg/a/b/c/src/main/some-docs.md',
      'pkg/a/b/c/some-docs.md',
    ])

    const typescriptMatch = filter.match(typescriptFiles)
    const otherPkgTypescriptMatch = filter.match(otherPkgTypescriptFiles)
    const docsMatch = filter.match(docsFiles)
    const otherPkgJpegMatch = filter.match(otherPkgJpegFiles)

    expect(typescriptMatch.backend).toEqual(typescriptFiles)
    expect(otherPkgTypescriptMatch.backend).toEqual([])
    expect(docsMatch.backend).toEqual([])
    expect(otherPkgJpegMatch.backend).toEqual([])
  })

  test('matches renamed files using the destination path', () => {
    const yaml = `
    rename:
      - renamed: 'pkg/renamed/**'
    `
    const filter = createFilter(yaml)
    const files = [
      {
        filename: 'pkg/renamed/file.ts',
        status: ChangeStatus.Renamed,
        from: 'pkg/original/file.ts',
        to: 'pkg/renamed/file.ts',
      },
    ]

    const match = filter.match(files)
    expect(match.rename).toEqual(files)
  })

  test('matches copied files using their destination path', () => {
    const yaml = `
    copyDestination:
      - copied: 'pkg/**/*'
    copySource:
      - copied: 'lib/**/*'
    `
    const filter = createFilter(yaml)
    const files = [
      {
        filename: 'pkg/utils/file.ts',
        status: ChangeStatus.Copied,
        from: 'lib/utils/file.ts',
        to: 'pkg/utils/file.ts',
      },
    ]

    const match = filter.match(files)
    expect(match.copyDestination).toEqual(files)
    expect(match.copySource).toEqual([])
  })

  test('negated status rules evaluate only destination paths for renamed files', () => {
    const yaml = `
    rename:
      - renamed: '**/*.ts'
      - renamed: '!legacy/**'
    `
    const filter = createFilter(yaml)
    const files = [
      {
        filename: 'pkg/renamed/file.ts',
        status: ChangeStatus.Renamed,
        from: 'legacy/file.ts',
        to: 'pkg/renamed/file.ts',
      },
    ]

    const match = filter.match(files)
    expect(match.rename).toEqual(files)
  })

  test('matches path based on rules included using YAML anchor', () => {
    const yaml = `
    shared: &shared
      - common/**/*
      - config/**/*
    src:
      - *shared
      - src/**/*
    `
    const filter = createFilter(yaml)
    const files = modified(['config/settings.yml'])
    const match = filter.match(files)
    expect(match.src).toEqual(files)
  })
})

describe('matching specific change status', () => {
  test('does not match modified file as added', () => {
    const yaml = `
    add:
      - added: "**/*"
    `
    let filter = createFilter(yaml)
    const match = filter.match(modified(['file.js']))
    expect(match.add).toEqual([])
  })

  test('match added file as added', () => {
    const yaml = `
    add:
      - added: "**/*"
    `
    let filter = createFilter(yaml)
    const files = [{ status: ChangeStatus.Added, filename: 'file.js', from: 'file.js' }]
    const match = filter.match(files)
    expect(match.add).toEqual(files)
  })

  test('matches when multiple statuses are configured', () => {
    const yaml = `
    addOrModify:
      - added|modified: "**/*"
    `
    let filter = createFilter(yaml)
    const files = [{ status: ChangeStatus.Modified, filename: 'file.js', from: 'file.js' }]
    const match = filter.match(files)
    expect(match.addOrModify).toEqual(files)
  })

  test('matches when renamed status is configured', () => {
    const yaml = `
    rename:
      - renamed: "file.js"
      - "test.txt"
    `
    let filter = createFilter(yaml)
    const files = [{ status: ChangeStatus.Renamed, filename: 'file.js', from: 'file.js' }]
    const match = filter.match(files)
    expect(match.rename).toEqual(files)
  })

  test('matches when using an anchor', () => {
    const yaml = `
    shared: &shared
      - common/**/*
      - config/**/*
    src:
      - modified: *shared
    `
    let filter = createFilter(yaml)
    const files = modified(['config/file', 'common/anotherFile.js'])
    const match = filter.match(files)
    expect(match.src).toEqual(files)
  })
})

function modified(paths: string[]): File[] {
  return paths.map((filename) => {
    return { filename, status: ChangeStatus.Modified, from: filename }
  })
}

function renamed(paths: string[]): File[] {
  return paths.map((filename) => {
    return { filename, status: ChangeStatus.Renamed, from: filename }
  })
}
