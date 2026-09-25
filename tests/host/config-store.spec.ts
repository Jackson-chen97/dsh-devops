import { describe, it, expect } from 'vitest'
import {
  migrateSettingsFile,
  resolveGitLabServer,
  resolveKubeconfigEntry,
} from '../../src/host/config-store.ts'

describe('migrateSettingsFile', () => {
  it('passes an already-migrated config through unchanged (modulo labels)', () => {
    const migrated = migrateSettingsFile({
      gitlab: {
        servers: [{ id: 's1', label: 'Corp', baseUrl: 'https://gitlab.corp', token: 't', projectPath: 'g/p', branch: 'main' }],
        activeServerId: 's1',
      },
      k8s: {
        kubeconfigs: [{ id: 'k1', label: 'Prod', path: '~/.kube/config', context: 'prod', namespace: 'api' }],
        activeKubeconfigId: 'k1',
      },
    })
    expect(migrated.gitlab?.activeServerId).toBe('s1')
    expect(migrated.gitlab?.servers).toHaveLength(1)
    expect(migrated.k8s?.activeKubeconfigId).toBe('k1')
  })

  it('migrates the legacy single-server gitlab shape', () => {
    const migrated = migrateSettingsFile({
      gitlab: { baseUrl: 'https://gitlab.legacy', token: 't0', projects: [{ path: 'g/old', defaultBranch: 'develop' }] },
    })
    expect(migrated.gitlab?.servers).toEqual([
      { id: 's1', label: 'GitLab', baseUrl: 'https://gitlab.legacy', token: 't0', projectPath: 'g/old', branch: 'develop' },
    ])
    expect(migrated.gitlab?.activeServerId).toBe('s1')
    expect(migrated.gitlab?.servers[0]).not.toHaveProperty('projects')
  })

  it('migrates the legacy single kubeconfig shape', () => {
    const migrated = migrateSettingsFile({
      k8s: { kubeconfigPath: '~/.kube/config', context: 'ctx', namespace: 'ns' },
    })
    expect(migrated.k8s?.kubeconfigs).toEqual([
      { id: 'k1', label: 'config', path: '~/.kube/config', context: 'ctx', namespace: 'ns' },
    ])
    expect(migrated.k8s?.activeKubeconfigId).toBe('k1')
  })

  it('drops a stale activeServerId and falls back to the first server', () => {
    const migrated = migrateSettingsFile({
      gitlab: {
        servers: [
          { id: 'a', label: 'A', baseUrl: 'https://a', token: 't', projectPath: '', branch: '' },
          { id: 'b', label: 'B', baseUrl: 'https://b', token: 't', projectPath: '', branch: '' },
        ],
        activeServerId: 'gone',
      },
    })
    expect(migrated.gitlab?.activeServerId).toBe('a')
  })
})

describe('resolveGitLabServer / resolveKubeconfigEntry', () => {
  it('returns the active entries', () => {
    const cfg = {
      gitlab: {
        servers: [
          { id: 'a', label: 'A', baseUrl: 'https://a', token: 't', projectPath: '', branch: '' },
          { id: 'b', label: 'B', baseUrl: 'https://b', token: 't', projectPath: 'p', branch: '' },
        ],
        activeServerId: 'b',
      },
      k8s: {
        kubeconfigs: [{ id: 'k', label: '', path: '~/.kube/config', context: '', namespace: '' }],
        activeKubeconfigId: 'k',
      },
    }
    expect(resolveGitLabServer(cfg)?.id).toBe('b')
    expect(resolveKubeconfigEntry(cfg)?.path).toBe('~/.kube/config')
  })

  it('returns null for empty configs', () => {
    expect(resolveGitLabServer(null)).toBeNull()
    expect(resolveGitLabServer({})).toBeNull()
    expect(resolveKubeconfigEntry({})).toBeNull()
  })
})
