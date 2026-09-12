import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GitLabClient, GitLabError } from '../../src/gitlab/client.js'

// ─── Fetch mock helper ────────────────────────────────────────────────────────

function mockFetch(data: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
      text: async () => JSON.stringify(data),
    }),
  )
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const rawMR = {
  id: 1001,
  iid: 42,
  title: 'Fix login bug',
  state: 'merged',
  source_branch: 'fix/login',
  target_branch: 'main',
  web_url: 'https://gitlab.example.com/group/proj/-/merge_requests/42',
  approvals_required: 2,
  approvals_count: 2,
  approved: true,
}

const rawPipeline = {
  id: 555,
  status: 'success',
  ref: 'main',
  sha: 'abc123',
  web_url: 'https://gitlab.example.com/group/proj/-/pipelines/555',
  created_at: '2026-01-01T00:00:00Z',
  finished_at: '2026-01-01T00:05:00Z',
}

function makeClient() {
  return new GitLabClient('https://gitlab.example.com', 'group/proj', 'token-123')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GitLabClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createMR', () => {
    it('returns a mapped MergeRequest', async () => {
      mockFetch(rawMR)
      const client = makeClient()

      const mr = await client.createMR('fix/login', 'main', 'Fix login bug', 'Fixes #1')

      expect(mr).toEqual({
        iid: 42,
        title: 'Fix login bug',
        state: 'merged',
        sourceBranch: 'fix/login',
        targetBranch: 'main',
        webUrl: 'https://gitlab.example.com/group/proj/-/merge_requests/42',
        approvals: { approved: true, required: 2, given: 2 },
      })

      // Verify the fetch call used POST with the right path
      const fetchMock = vi.mocked(fetch)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/api/v4/projects/group%2Fproj/merge_requests')
      expect(init?.method).toBe('POST')
      const body = JSON.parse(String(init?.body))
      expect(body).toEqual({
        source_branch: 'fix/login',
        target_branch: 'main',
        title: 'Fix login bug',
        description: 'Fixes #1',
      })
      expect(init?.headers).toMatchObject({ 'PRIVATE-TOKEN': 'token-123' })
    })
  })

  describe('listMRs', () => {
    it('returns an array of mapped MergeRequests', async () => {
      mockFetch([rawMR, { ...rawMR, iid: 43, id: 1002, title: 'Another MR', state: 'opened' }])
      const client = makeClient()

      const mrs = await client.listMRs()

      expect(Array.isArray(mrs)).toBe(true)
      expect(mrs).toHaveLength(2)
      expect(mrs[0].iid).toBe(42)
      expect(mrs[1].iid).toBe(43)
      expect(mrs[1].state).toBe('opened')
    })
  })

  describe('error handling', () => {
    it('throws GitLabError with status when fetch returns non-2xx', async () => {
      mockFetch({ message: 'Forbidden' }, 403)
      const client = makeClient()

      await expect(client.listMRs()).rejects.toThrow(GitLabError)
      try {
        await client.listMRs()
      } catch (err) {
        expect(err).toBeInstanceOf(GitLabError)
        expect((err as GitLabError).status).toBe(403)
        expect((err as GitLabError).message).toBe('Forbidden')
      }
    })

    it('throws GitLabError with 404 status', async () => {
      mockFetch({ message: '404 Not Found' }, 404)
      const client = makeClient()

      await expect(client.getPipeline(123)).rejects.toThrow(GitLabError)
      await expect(client.getPipeline(123)).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('getLatestPipelineByRef', () => {
    it('returns undefined when response is an empty array', async () => {
      mockFetch([])
      const client = makeClient()

      const pipeline = await client.getLatestPipelineByRef('main')
      expect(pipeline).toBeUndefined()
    })

    it('returns the first pipeline when array has items', async () => {
      mockFetch([rawPipeline, { ...rawPipeline, id: 554 }])
      const client = makeClient()

      const pipeline = await client.getLatestPipelineByRef('main')
      expect(pipeline).toEqual({
        id: 555,
        status: 'success',
        ref: 'main',
        sha: 'abc123',
        webUrl: 'https://gitlab.example.com/group/proj/-/pipelines/555',
        createdAt: '2026-01-01T00:00:00Z',
        finishedAt: '2026-01-01T00:05:00Z',
      })

      // Verify the ref is encoded in the query string
      const fetchMock = vi.mocked(fetch)
      const [url] = fetchMock.mock.calls[0]
      expect(String(url)).toContain(`/pipelines?ref=${encodeURIComponent('main')}`)
    })
  })
})
