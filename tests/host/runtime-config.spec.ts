import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Isolate the settings-file location: runtime-config + config-store resolve
// ~/.dsh-devops/config.json from homedir() at import time, so point homedir
// at a per-test temp dir BEFORE importing the modules under test.
const tmpHome = mkdtempSync(join(tmpdir(), 'dsh-devops-test-'))
vi.mock('node:os', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:os')>()),
  homedir: () => tmpHome,
}))

const { resolveGitLabConfig, resolveK8sConfig } = await import('../../src/host/runtime-config.ts')
const { saveSettingsFile } = await import('../../src/host/config-store.ts')

const CONFIG_DIR = join(tmpHome, '.dsh-devops')

function writeConfig(json: unknown): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(join(CONFIG_DIR, 'config.json'), JSON.stringify(json), 'utf8')
}

beforeEach(() => {
  rmSync(CONFIG_DIR, { recursive: true, force: true })
})

afterEach(() => {
  rmSync(CONFIG_DIR, { recursive: true, force: true })
})

describe('resolveGitLabConfig', () => {
  it('prefers the cordis config override over the settings file', () => {
    writeConfig({
      gitlab: {
        servers: [{ id: 's1', label: 'File', baseUrl: 'https://file.gitlab', token: 't', projectPath: 'g/f', branch: '' }],
        activeServerId: 's1',
      },
    })
    const cfg = resolveGitLabConfig({
      gitlab: {
        baseUrl: 'https://cordis.gitlab',
        token: 'env-token',
        defaultProject: 'a',
        projects: [{ id: 'a', path: 'g/a', tokenEnv: 'SOME_TOKEN' }],
      },
    })
    expect(cfg?.baseUrl).toBe('https://cordis.gitlab')
    expect(cfg?.defaultProject).toBe('a')
  })

  it('resolves the active server from the settings file', () => {
    writeConfig({
      gitlab: {
        servers: [
          { id: 's1', label: 'One', baseUrl: 'https://one.gitlab', token: 't1', projectPath: 'g/one', branch: 'main' },
          { id: 's2', label: 'Two', baseUrl: 'https://two.gitlab', token: 't2', projectPath: 'g/two', branch: '' },
        ],
        activeServerId: 's2',
      },
    })
    const cfg = resolveGitLabConfig(undefined)
    expect(cfg?.baseUrl).toBe('https://two.gitlab')
    expect(cfg?.defaultProject).toBe('s2')
    expect(cfg?.projects.map((p) => p.id)).toEqual(['s1', 's2'])
  })

  it('returns null when neither source is configured (fresh install)', () => {
    expect(resolveGitLabConfig({})).toBeNull()
    expect(resolveGitLabConfig(undefined)).toBeNull()
    expect(resolveGitLabConfig({ gitlab: {} })).toBeNull()
  })
})

describe('resolveK8sConfig', () => {
  it('prefers the cordis config override', () => {
    const cfg = resolveK8sConfig({
      k8s: { kubeconfigs: [{ id: 'c1', path: '/tmp/kube.yaml' }], defaultContext: 'c1' },
    })
    expect(cfg?.kubeconfigs).toHaveLength(1)
    expect(cfg?.defaultContext).toBe('c1')
  })

  it('resolves the active kubeconfig from the settings file', () => {
    writeConfig({
      k8s: {
        kubeconfigs: [{ id: 'k1', label: 'K', path: '~/.kube/config', context: 'ctx', namespace: 'ns' }],
        activeKubeconfigId: 'k1',
      },
    })
    const cfg = resolveK8sConfig(undefined)
    expect(cfg?.kubeconfigs[0]?.path).toBe('~/.kube/config')
    expect(cfg?.defaultContext).toBe('k1')
  })

  it('returns null when unconfigured', () => {
    expect(resolveK8sConfig({})).toBeNull()
    expect(resolveK8sConfig({ k8s: {} })).toBeNull()
  })
})

describe('saveSettingsFile', () => {
  it('shallow-merges sections and persists them', async () => {
    const { saveSettingsFile: save } = await import('../../src/host/config-store.ts')
    void save
    const r1 = saveSettingsFile({ gitlab: { servers: [], activeServerId: null } })
    expect(r1.ok).toBe(true)
    const r2 = saveSettingsFile({ k8s: { kubeconfigs: [], activeKubeconfigId: null } })
    expect(r2.ok).toBe(true)
    const file = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(join(CONFIG_DIR, 'config.json'), 'utf8')))
    expect(file.gitlab).toBeDefined()
    expect(file.k8s).toBeDefined()
  })
})
