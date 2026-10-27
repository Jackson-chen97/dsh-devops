import { describe, it, expect, vi, afterEach } from 'vitest'
import { GitLabClient, parseReviewerNames } from '../../src/core/gitlab/client.ts'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GitLabClient.jobUrl', () => {
  it('builds the GitLab web UI URL: {baseUrl}/{projectPath}/-/jobs/{id}', () => {
    const client = new GitLabClient('https://gitlab.example.com', 'tok')
    expect(client.jobUrl('operation-isztc-group/ztc-mall-order-server', 1459281)).toBe(
      'https://gitlab.example.com/operation-isztc-group/ztc-mall-order-server/-/jobs/1459281',
    )
  })

  it('strips trailing slashes from baseUrl', () => {
    const client = new GitLabClient('https://gitlab.example.com/', 'tok')
    expect(client.jobUrl('grp/proj', 7)).toBe('https://gitlab.example.com/grp/proj/-/jobs/7')
  })
})

describe('GitLabClient.listTags mapping', () => {
  it('maps tag commit author/date fields from the raw payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          {
            name: 'v1.2.0',
            target: 'aaaabbbb',
            message: 'release 1.2.0',
            commit: {
              id: 'abcdef1234567890',
              created_at: '2026-01-01T00:00:00.000Z',
              committed_date: '2026-01-02T03:04:05.000Z',
              title: 'fix: broken link',
              author_name: 'Ann',
              committer_name: 'Bob',
            },
          },
        ]),
      ),
    )
    const client = new GitLabClient('https://gitlab.example.com', 'tok')
    const tags = await client.listTags('grp/proj')
    expect(tags).toHaveLength(1)
    expect(tags[0]!.name).toBe('v1.2.0')
    expect(tags[0]!.commitId).toBe('abcdef1234567890')
    expect(tags[0]!.commitAuthor).toBe('Bob')
    expect(tags[0]!.commitDate).toBe('2026-01-02T03:04:05.000Z')
    expect(tags[0]!.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(tags[0]!.commitTitle).toBe('fix: broken link')
    expect(tags[0]!.webUrl).toBe('https://gitlab.example.com/grp/proj/tags/v1.2.0')
  })

  it('falls back to author_name / created_at when committer fields are absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          { name: 'v2.0.0', target: 'x', commit: { id: 'y', created_at: '2026-02-01T00:00:00.000Z', author_name: 'Ann' } },
        ]),
      ),
    )
    const client = new GitLabClient('https://gitlab.example.com', 'tok')
    const tags = await client.listTags('grp/proj')
    expect(tags[0]!.commitAuthor).toBe('Ann')
    expect(tags[0]!.commitDate).toBe('2026-02-01T00:00:00.000Z')
    expect(tags[0]!.commitTitle).toBe('')
  })

  it('maps pipeline jobs with their GitLab web URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([{ id: 1459281, name: 'build', status: 'success', stage: 'build', duration: 12.5 }]),
      ),
    )
    const client = new GitLabClient('https://gitlab.example.com', 'tok')
    const jobs = await client.listPipelineJobs('grp/proj', 42)
    expect(jobs[0]!.id).toBe(1459281)
    expect(jobs[0]!.webUrl).toBe('https://gitlab.example.com/grp/proj/-/jobs/1459281')
  })
})

describe('parseReviewerNames', () => {
  it('splits on half/full-width comma and whitespace, strips @ prefix', () => {
    expect(parseReviewerNames('alice, bob，@carl  dave')).toEqual(['alice', 'bob', 'carl', 'dave'])
  })

  it('returns empty array for blank or undefined input', () => {
    expect(parseReviewerNames(undefined)).toEqual([])
    expect(parseReviewerNames('   ')).toEqual([])
    expect(parseReviewerNames('')).toEqual([])
  })
})

describe('GitLabClient.createMR reviewer verification', () => {
  const mrBase = {
    id: 1,
    iid: 10,
    title: 't',
    state: 'opened',
    source_branch: 'feat/x',
    target_branch: 'main',
    web_url: 'https://gitlab.example.com/grp/proj/-/merge_requests/10',
  }

  function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
    const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init))
    vi.stubGlobal('fetch', mock)
    return mock
  }

  function postBody(mock: ReturnType<typeof stubFetch>): Record<string, unknown> {
    const call = mock.mock.calls.find((c) => String(c[0]).includes('/merge_requests'))
    expect(call).toBeDefined()
    const init = call![1]
    expect(init).toBeDefined()
    return JSON.parse(String(init!.body)) as Record<string, unknown>
  }

  it('sends assignee_ids + reviewer_ids and reports the applied users on a modern GitLab', async () => {
    const mock = stubFetch((url) =>
      url.includes('/users?search=')
        ? jsonResponse([{ id: 7, username: 'alice' }])
        : jsonResponse({ ...mrBase, assignees: [{ id: 7, username: 'alice' }], reviewers: [{ id: 7, username: 'alice' }] }),
    )
    const client = new GitLabClient('https://gitlab.example.com', 'tok')
    const mr = await client.createMR('grp/proj', 'feat/x', 'main', 't', 'desc', 'alice')
    expect(postBody(mock).assignee_ids).toEqual([7])
    expect(postBody(mock).reviewer_ids).toEqual([7])
    expect(mr.reviewerSupported).toBe(true)
    // union of assignees + reviewers, deduped
    expect(mr.appliedUsernames).toEqual(['alice'])
  })

  it('applies via assignees on GitLab < 12.8 (response has assignees but no reviewers field)', async () => {
    stubFetch((url) =>
      url.includes('/users?search=')
        ? jsonResponse([{ id: 7, username: 'alice' }])
        : jsonResponse({ ...mrBase, assignees: [{ id: 7, username: 'alice' }] }),
    )
    const client = new GitLabClient('https://gitlab.example.com', 'tok')
    const mr = await client.createMR('grp/proj', 'feat/x', 'main', 't', undefined, 'alice')
    expect(mr.reviewerSupported).toBe(false)
    expect(mr.appliedUsernames).toEqual(['alice'])
  })

  it('omits assignee_ids/reviewer_ids entirely when no reviewers are requested', async () => {
    const mock = stubFetch(() => jsonResponse({ ...mrBase, assignees: [], reviewers: [] }))
    const client = new GitLabClient('https://gitlab.example.com', 'tok')
    const mr = await client.createMR('grp/proj', 'feat/x', 'main', 't')
    expect(postBody(mock).assignee_ids).toBeUndefined()
    expect(postBody(mock).reviewer_ids).toBeUndefined()
    expect(mr.reviewerSupported).toBe(true)
    expect(mr.appliedUsernames).toEqual([])
  })

  it('still creates the MR when every reviewer fails to resolve (no ids sent)', async () => {
    const mock = stubFetch((url) => {
      if (url.includes('/users?search=')) return jsonResponse([])
      return jsonResponse({ ...mrBase, assignees: [], reviewers: [] })
    })
    const client = new GitLabClient('https://gitlab.example.com', 'tok')
    const mr = await client.createMR('grp/proj', 'feat/x', 'main', 't', undefined, 'ghost')
    expect(postBody(mock).assignee_ids).toBeUndefined()
    expect(postBody(mock).reviewer_ids).toBeUndefined()
    expect(mr.appliedUsernames).toEqual([])
  })
})
