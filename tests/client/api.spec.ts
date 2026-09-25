import { describe, it, expect } from 'vitest'
import { DevopsClient, resolveGlServer, resolveK8sKc } from '../../src/client/api.ts'
import { DEVOPS_READ_CHANNEL, DEVOPS_WRITE_CHANNEL } from '../../src/protocol.ts'
import { ZH, EN } from '../../src/client/locales.ts'
import { translate } from '../../src/client/locales.ts'
import type { ClientConnection, RpcResult } from '../../src/client/dsh-context.ts'

function mockConnection(results: Map<string, RpcResult>) {
  const calls: { channel: string; endpoint: string; payload: unknown }[] = []
  const connection: ClientConnection = {
    rpc: {
      call: async (channel: string, endpoint: string, payload: unknown) => {
        calls.push({ channel, endpoint, payload })
        return results.get(endpoint) ?? { ok: false, error: { code: 'internal', message: 'unexpected', details: {} } }
      },
    },
  }
  return { connection, calls }
}

describe('DevopsClient', () => {
  it('routes reads to the read channel and writes to the write channel', async () => {
    const { connection, calls } = mockConnection(
      new Map([
        ['config-load', { ok: true, value: { ok: true, config: null } }],
        ['config-save', { ok: true, value: { ok: true } }],
      ]),
    )
    const client = new DevopsClient(connection)
    const loaded = await client.loadConfig()
    const saved = await client.saveConfig({ k8s: { kubeconfigs: [] } })
    expect(loaded.ok).toBe(true)
    expect(saved.ok).toBe(true)
    expect(calls[0]).toMatchObject({ channel: DEVOPS_READ_CHANNEL, endpoint: 'config-load' })
    expect(calls[1]).toMatchObject({ channel: DEVOPS_WRITE_CHANNEL, endpoint: 'config-save' })
  })

  it('rejects with the RPC error message on failure envelopes', async () => {
    const { connection } = mockConnection(new Map())
    const client = new DevopsClient(connection)
    await expect(client.loadConfig()).rejects.toThrow('unexpected')
  })

  it('maps dashboard endpoints', async () => {
    const { connection, calls } = mockConnection(
      new Map([['gitlab-mrs', { ok: true, value: { ok: true, mergeRequests: [] } }]]),
    )
    const client = new DevopsClient(connection)
    await client.gitlabMRs({ baseUrl: 'https://g', token: 't', projectPath: 'g/p' })
    expect(calls[0]).toMatchObject({ channel: DEVOPS_READ_CHANNEL, endpoint: 'gitlab-mrs' })
  })
})

describe('settings-file helpers', () => {
  it('resolveGlServer / resolveK8sKc pick the active entries', () => {
    const cfg = {
      gitlab: {
        servers: [
          { id: 'a', label: 'A', baseUrl: 'https://a', token: 't', projectPath: '', branch: '' },
        ],
        activeServerId: 'a',
      },
      k8s: {
        kubeconfigs: [{ id: 'k', label: 'K', path: '/kube', context: '', namespace: '' }],
        activeKubeconfigId: 'k',
      },
    }
    expect(resolveGlServer(cfg)?.id).toBe('a')
    expect(resolveK8sKc(cfg)?.path).toBe('/kube')
    expect(resolveGlServer(null)).toBeNull()
    expect(resolveK8sKc(undefined)).toBeNull()
  })
})

describe('locales', () => {
  it('zh and en dictionaries cover the same key set', () => {
    const zhKeys = Object.keys(ZH).sort()
    const enKeys = Object.keys(EN).sort()
    expect(enKeys).toEqual(zhKeys)
  })

  it('interpolates {n} placeholders and falls back to zh', () => {
    expect(translate('zh', 'minAgo', { n: 5 })).toBe('5 分钟前')
    expect(translate('en', 'minAgo', { n: 5 })).toBe('5 min ago')
    expect(translate('fr', 'saved')).toBe(ZH.saved)
  })
})
