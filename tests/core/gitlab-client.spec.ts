import { describe, it, expect, vi, afterEach } from 'vitest'
import { GitLabClient } from '../../src/core/gitlab/client.ts'

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
