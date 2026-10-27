import { describe, it, expect, vi, afterEach } from 'vitest'
import { testGitLab, gitlabProjects, gitlabCreateMR } from '../../src/host/endpoints-gitlab.ts'
import { registerDevopsRpc, type DevopsRpcContext } from '../../src/host/rpc.ts'
import { DEVOPS_READ_CHANNEL, DEVOPS_WRITE_CHANNEL } from '../../src/protocol.ts'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GitLab RPC endpoints', () => {
  it('test-gitlab reports the authenticated user', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ username: 'jackson' })))
    const r = await testGitLab({ baseUrl: 'https://gitlab.example.com', token: 'glpat-x' })
    expect(r.ok).toBe(true)
    expect(r.message).toContain('jackson')
  })

  it('test-gitlab fails softly on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    const r = await testGitLab({ baseUrl: 'https://gitlab.example.com', token: 'bad' })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('401')
  })

  it('test-gitlab fails softly when params are missing', async () => {
    const r = await testGitLab({ baseUrl: '', token: '' })
    expect(r.ok).toBe(false)
  })

  it('gitlab-projects maps the raw API shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          { id: 7, name: 'Proj', path_with_namespace: 'grp/proj', default_branch: 'main' },
        ]),
      ),
    )
    const r = await gitlabProjects({ baseUrl: 'https://gitlab.example.com', token: 't' })
    expect(r.ok).toBe(true)
    expect(r.projects).toEqual([{ id: '7', name: 'Proj', path: 'grp/proj', defaultBranch: 'main' }])
  })

  describe('gitlab-create-mr reviewer warning', () => {
    const params = {
      baseUrl: 'https://gitlab.example.com',
      token: 't',
      projectPath: 'grp/proj',
      sourceBranch: 'feat/x',
      targetBranch: 'main',
      title: 't',
    }
    const mrOk = {
      id: 1,
      iid: 10,
      title: 't',
      state: 'opened',
      source_branch: 'feat/x',
      target_branch: 'main',
      web_url: 'https://gitlab.example.com/grp/proj/-/merge_requests/10',
    }

    it('applies via assignees on GitLab < 12.8 (no reviewers field) without warning', async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).includes('/users?search=')
          ? jsonResponse([{ id: 7, username: 'alice' }])
          : jsonResponse({ ...mrOk, assignees: [{ id: 7, username: 'alice' }] }), // < 12.8: no `reviewers` key
      )
      vi.stubGlobal('fetch', fetchMock)
      const r = await gitlabCreateMR({ ...params, reviewers: 'alice' })
      if (!r.ok) throw new Error(r.message)
      expect('reviewerWarning' in r).toBe(false)
      // both id fields are sent: assignee_ids takes effect on every version
      const postCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/merge_requests'))
      expect(postCall).toBeDefined()
      const body = JSON.parse(String(postCall![1]!.body)) as Record<string, unknown>
      expect(body.assignee_ids).toEqual([7])
      expect(body.reviewer_ids).toEqual([7])
    })

    it('warns with the missing usernames when a requested reviewer was not applied', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) =>
          String(input).includes('/users?search=')
            ? jsonResponse([]) // alice unresolvable -> no ids sent
            : jsonResponse({ ...mrOk, assignees: [], reviewers: [] }),
        ),
      )
      const r = await gitlabCreateMR({ ...params, reviewers: 'alice' })
      if (!r.ok) throw new Error(r.message)
      expect(r.reviewerWarning).toContain('alice')
    })

    it('warns only the missing subset when some requested reviewers were applied', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input)
          if (url.includes('/users?search=')) {
            const name = decodeURIComponent(url.split('search=')[1]!.split('&')[0]!)
            return jsonResponse(name === 'alice' ? [{ id: 7, username: 'alice' }] : [])
          }
          return jsonResponse({
            ...mrOk,
            assignees: [],
            reviewers: [{ id: 7, username: 'alice' }], // bob never applied
          })
        }),
      )
      const r = await gitlabCreateMR({ ...params, reviewers: 'alice, bob' })
      if (!r.ok) throw new Error(r.message)
      expect(r.reviewerWarning).toContain('bob')
      expect(r.reviewerWarning).not.toContain('alice')
    })

    it('stays silent when every requested reviewer was applied', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input)
          if (url.includes('/users?search=')) {
            const name = decodeURIComponent(url.split('search=')[1]!.split('&')[0]!)
            return jsonResponse([{ id: name === 'alice' ? 7 : 8, username: name }])
          }
          return jsonResponse({
            ...mrOk,
            assignees: [
              { id: 7, username: 'alice' },
              { id: 8, username: 'bob' },
            ],
            reviewers: [
              { id: 7, username: 'alice' },
              { id: 8, username: 'bob' },
            ],
          })
        }),
      )
      const r = await gitlabCreateMR({ ...params, reviewers: 'alice, bob' })
      expect(r.ok).toBe(true)
      expect('reviewerWarning' in r).toBe(false)
    })

    it('omits reviewerWarning entirely when no reviewers were requested', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ ...mrOk, assignees: [], reviewers: [] })),
      )
      const r = await gitlabCreateMR({ ...params })
      expect(r.ok).toBe(true)
      expect('reviewerWarning' in r).toBe(false)
    })
  })
})

describe('registerDevopsRpc', () => {
  function makeCtx() {
    const handled: { channel: string; handler: unknown; options: unknown }[] = []
    const ctx: DevopsRpcContext = {
      inject: (services, callback) => {
        callback({
          connection: {
            rpc: {
              handle: (channel: string, handler: unknown, options: unknown) => {
                handled.push({ channel, handler, options })
                return () => Promise.resolve()
              },
            },
          },
        })
      },
    }
    return { ctx, handled }
  }

  it('mounts the read and write channels on connection.rpc', () => {
    const { ctx, handled } = makeCtx()
    registerDevopsRpc(ctx)
    expect(handled.map((h) => h.channel).sort()).toEqual(
      [DEVOPS_READ_CHANNEL, DEVOPS_WRITE_CHANNEL].sort(),
    )
  })

  it('dispatches a read endpoint to its handler and wraps the value', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ username: 'jackson' })))
    const { ctx, handled } = makeCtx()
    registerDevopsRpc(ctx)
    const read = handled.find((h) => h.channel === DEVOPS_READ_CHANNEL)!.handler as (
      endpoint: string,
      payload: unknown,
    ) => Promise<{ ok: boolean; value?: unknown }>
    const result = await read('test-gitlab', { baseUrl: 'https://gitlab.example.com', token: 'glpat-x' })
    expect(result.ok).toBe(true)
    expect((result.value as { message: string }).message).toContain('jackson')
  })

  it('returns an error envelope for unknown endpoints', async () => {
    const { ctx, handled } = makeCtx()
    registerDevopsRpc(ctx)
    const write = handled.find((h) => h.channel === DEVOPS_WRITE_CHANNEL)!.handler as (
      endpoint: string,
      payload: unknown,
    ) => Promise<{ ok: boolean; error?: { message: string } }>
    const result = await write('not-an-endpoint', {})
    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain('Unknown dsh-devops endpoint')
  })

  it('skips registration when connection.rpc is absent (headless)', () => {
    const warns: unknown[] = []
    const ctx: DevopsRpcContext = {
      inject: (_services, callback) => {
        callback({ connection: undefined })
      },
    }
    expect(() => registerDevopsRpc(ctx)).not.toThrow()
  })
})
