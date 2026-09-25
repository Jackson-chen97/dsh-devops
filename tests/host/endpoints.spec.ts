import { describe, it, expect, vi, afterEach } from 'vitest'
import { testGitLab, gitlabProjects } from '../../src/host/endpoints-gitlab.ts'
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
