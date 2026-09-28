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

const { NOT_CONFIGURED_MSG } = await import('../../src/host/runtime-config.ts')
const { registerConfigTool } = await import('../../src/host/tools-config.ts')

const CONFIG_DIR = join(tmpHome, '.dsh-devops')

function writeConfig(json: unknown): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(join(CONFIG_DIR, 'config.json'), JSON.stringify(json), 'utf8')
}

/** Fake tool context that captures every registered definition. */
function makeCtx() {
  const registered: any[] = []
  const ctx = { tools: { register: (def: unknown) => registered.push(def) } }
  return { ctx, registered }
}

/** Register into a fresh ctx and run the devops_config tool with no args. */
async function runConfigTool(): Promise<any> {
  const { ctx, registered } = makeCtx()
  registerConfigTool(ctx as never)
  const def = registered.find((d) => d.name === 'devops_config')
  expect(def).toBeDefined()
  return def.execute({}, {} as never)
}

beforeEach(() => {
  rmSync(CONFIG_DIR, { recursive: true, force: true })
})

afterEach(() => {
  rmSync(CONFIG_DIR, { recursive: true, force: true })
})

describe('registerConfigTool', () => {
  it('registers exactly one parameterless tool named devops_config', () => {
    const { ctx, registered } = makeCtx()
    registerConfigTool(ctx as never)
    expect(registered).toHaveLength(1)
    expect(registered[0].name).toBe('devops_config')
    expect(registered[0].description).toContain('GitLab')
    expect(registered[0].description).toContain('Kubernetes')
    expect(registered[0].parameters).toMatchObject({ type: 'object' })
  })

  it('warns and skips when no register method is available', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerConfigTool({} as never)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

describe('devops_config execute', () => {
  it('reports not configured when the file is missing or empty', async () => {
    expect(await runConfigTool()).toEqual({ configured: false, message: NOT_CONFIGURED_MSG })
    writeConfig({})
    expect(await runConfigTool()).toEqual({ configured: false, message: NOT_CONFIGURED_MSG })
  })

  it('lists every server and kubeconfig with labels and the active selection', async () => {
    writeConfig({
      gitlab: {
        servers: [
          { id: 'lessos', label: 'Lesso', baseUrl: 'https://gitlab.prod', token: 'secret-gl', projectPath: 'group/a', branch: 'dev' },
          { id: 'ci', label: 'CI', baseUrl: 'https://ci.gitlab', token: '', projectPath: 'group/b', branch: '' },
        ],
        // "ci" has no token → the resolver (and the view) fall back to the
        // first usable server, "lessos" — same rule the tools apply.
        activeServerId: 'ci',
      },
      k8s: {
        kubeconfigs: [
          { id: 'ztc-dev', label: 'ZTC-DEV', path: 'D:\\kube\\dev.yaml', context: 'ctx-dev', namespace: 'ns-dev' },
          { id: 'ztc-prod', label: 'ZTC-PROD', path: 'D:\\kube\\prod.yaml', context: 'ctx-prod', namespace: 'ns-prod' },
        ],
        activeKubeconfigId: 'ztc-dev',
      },
    })
    const result = await runConfigTool()
    expect(result.configured).toBe(true)
    expect(result.gitlab.activeServerId).toBe('lessos')
    expect(result.gitlab.servers).toEqual([
      { id: 'lessos', label: 'Lesso', baseUrl: 'https://gitlab.prod', projectPath: 'group/a', branch: 'dev', tokenConfigured: true },
      { id: 'ci', label: 'CI', baseUrl: 'https://ci.gitlab', projectPath: 'group/b', branch: '', tokenConfigured: false },
    ])
    expect(result.k8s.activeKubeconfigId).toBe('ztc-dev')
    expect(result.k8s.kubeconfigs).toEqual([
      { id: 'ztc-dev', label: 'ZTC-DEV', path: 'D:\\kube\\dev.yaml', context: 'ctx-dev', namespace: 'ns-dev' },
      { id: 'ztc-prod', label: 'ZTC-PROD', path: 'D:\\kube\\prod.yaml', context: 'ctx-prod', namespace: 'ns-prod' },
    ])
    expect(result.hint).toContain('`project`')
    expect(result.hint).toContain('`cluster`')
  })

  it('never includes token values in the output', async () => {
    writeConfig({
      gitlab: {
        servers: [{ id: 's1', label: 'One', baseUrl: 'https://one', token: 'super-secret-token', projectPath: 'g/f', branch: 'main' }],
        activeServerId: 's1',
      },
    })
    const json = JSON.stringify(await runConfigTool())
    expect(json).not.toContain('super-secret-token')
    expect(json).toContain('tokenConfigured')
  })

  it('omits empty sections (only GitLab configured → no k8s key)', async () => {
    writeConfig({
      gitlab: {
        servers: [{ id: 's1', label: 'One', baseUrl: 'https://one', token: 't', projectPath: 'g/f', branch: 'main' }],
        activeServerId: 's1',
      },
    })
    const result = await runConfigTool()
    expect(result.configured).toBe(true)
    expect(result.gitlab).toBeDefined()
    expect(result.gitlab.activeServerId).toBe('s1')
    expect(result.k8s).toBeUndefined()
  })

  it('renders the result as a lossless JSON text block', async () => {
    const { ctx, registered } = makeCtx()
    registerConfigTool(ctx as never)
    const def = registered[0]
    const value = await def.execute({}, {} as never)
    const blocks = def.output.render({}, value)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
    expect(JSON.parse(blocks[0].text)).toEqual(value)
  })
})
