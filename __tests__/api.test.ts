import * as github from '@actions/github'
import {getChangedFilesFromApi} from '../src/main'
import {ChangeStatus} from '../src/file'
import {PullRequestEvent} from '@octokit/webhooks-types'

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn()
}))

jest.mock('@actions/github', () => ({
  context: {repo: {owner: 'owner', repo: 'repo'}},
  getOctokit: jest.fn()
}))

describe('getChangedFilesFromApi', () => {
  test('handles copied status', async () => {
    // For "copied", GitHub sets filename to the destination and previous_filename to the source
    const mockResponse = {
      status: 200,
      data: [
        {filename: 'src/file1.ts', status: ChangeStatus.Copied, from: 'src/file.ts', previous_filename: 'src/file.ts'}
      ]
    }

    const iterator = {
      async *[Symbol.asyncIterator]() {
        yield mockResponse
      }
    }

    const mockClient = {
      rest: {
        pulls: {listFiles: {endpoint: {merge: jest.fn()}}}
      },
      paginate: {
        iterator: jest.fn().mockReturnValue(iterator)
      }
    }

    ;(github.getOctokit as jest.Mock).mockReturnValue(mockClient)

    const pr = {number: 1} as unknown as PullRequestEvent

    const files = await getChangedFilesFromApi('token', pr)

    // Expect "from" to be set
    expect(files).toEqual([
      {filename: 'src/file1.ts', status: ChangeStatus.Copied, from: 'src/file.ts', to: 'src/file1.ts'}
    ])
  })

  test('normalizes removed and renamed statuses', async () => {
    const iterator = jest.fn().mockImplementation(async function* () {
      yield {
        status: 200,
        data: [
          {filename: 'deleted.txt', status: 'removed', from: 'deleted.txt'},
          {filename: 'new.txt', status: ChangeStatus.Renamed, previous_filename: 'old.txt'},
          {filename: 'cp.txt', status: ChangeStatus.Copied, previous_filename: 'orig.txt'}
        ]
      }
    })
    const merge = jest.fn().mockReturnValue({})
    ;(github.getOctokit as jest.Mock).mockReturnValue({
      paginate: {iterator},
      rest: {pulls: {listFiles: {endpoint: {merge}}}}
    })

    const files = await getChangedFilesFromApi('token', {number: 7} as any)

    // Renamed files return a single entry with both source and destination
    // Copied files retain their source path in "from"
    expect(files).toEqual([
      {filename: 'deleted.txt', status: ChangeStatus.Deleted, from: 'deleted.txt'},
      {filename: 'new.txt', status: ChangeStatus.Renamed, from: 'old.txt', to: 'new.txt'},
      {filename: 'cp.txt', status: ChangeStatus.Copied, from: 'orig.txt', to: 'cp.txt'}
    ])

    expect(merge).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 7,
      per_page: 100
    })
  })
})
