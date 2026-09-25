import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { expandPath, parseKubeconfig } from '../../src/core/k8s/kubeconfig.ts'

vi.mock('node:fs', () => ({ readFileSync: vi.fn() }))

const mockReadFileSync = vi.mocked(readFileSync)

// ─── Sample kubeconfig ─────────────────────────────────────────────────────────

const validKubeconfig = `current-context: test-ctx
clusters:
  - name: test-cluster
    cluster:
      server: https://api.example.com:6443
      certificate-authority-data: dGVzdA==
      insecure-skip-tls-verify: true
users:
  - name: test-user
    user:
      token: my-token
contexts:
  - name: test-ctx
    context:
      cluster: test-cluster
      user: test-user
      namespace: production
`

const kubeconfigWithoutToken = `current-context: test-ctx
clusters:
  - name: test-cluster
    cluster:
      server: https://api.example.com:6443
users:
  - name: test-user
    user:
      username: some-user
contexts:
  - name: test-ctx
    context:
      cluster: test-cluster
      user: test-user
`

describe('expandPath', () => {
  it('expands "~" to the home directory', () => {
    expect(expandPath('~')).toBe(homedir())
  })

  it('expands "~/path" correctly', () => {
    expect(expandPath('~/.kube/config')).toBe(join(homedir(), '.kube/config'))
    expect(expandPath('~/kube/config.yaml')).toBe(join(homedir(), 'kube/config.yaml'))
  })

  it('returns absolute paths unchanged', () => {
    expect(expandPath('/home/user/.kube/config')).toBe('/home/user/.kube/config')
    expect(expandPath('C:\\Users\\u\\.kube\\config')).toBe('C:\\Users\\u\\.kube\\config')
  })

  it('returns relative paths unchanged', () => {
    expect(expandPath('./kube/config')).toBe('./kube/config')
    expect(expandPath('kube/config.yaml')).toBe('kube/config.yaml')
  })
})

describe('parseKubeconfig', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('parses a valid kubeconfig (cluster + user + context)', () => {
    mockReadFileSync.mockReturnValue(validKubeconfig)

    const ctx = parseKubeconfig('/home/user/.kube/config')

    expect(ctx).toEqual({
      server: 'https://api.example.com:6443',
      token: 'my-token',
      caData: 'dGVzdA==',
      insecureSkipTlsVerify: true,
      namespace: 'production',
    })
    expect(mockReadFileSync).toHaveBeenCalledWith('/home/user/.kube/config', 'utf8')
  })

  it('expands ~ in the file path before reading', () => {
    mockReadFileSync.mockReturnValue(validKubeconfig)

    const ctx = parseKubeconfig('~/.kube/config')

    expect(ctx.server).toBe('https://api.example.com:6443')
    expect(mockReadFileSync).toHaveBeenCalledWith(join(homedir(), '.kube/config'), 'utf8')
  })

  it('uses an explicitly provided context name', () => {
    mockReadFileSync.mockReturnValue(validKubeconfig)

    const ctx = parseKubeconfig('/path/config', 'test-ctx')
    expect(ctx.token).toBe('my-token')
  })

  it('throws when the file cannot be read (not found)', () => {
    mockReadFileSync.mockImplementation(() => {
      const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException
      throw err
    })

    expect(() => parseKubeconfig('/missing/config')).toThrow(
      'cannot read kubeconfig file at "/missing/config"',
    )
  })

  it('throws when the context is not found', () => {
    mockReadFileSync.mockReturnValue(validKubeconfig)

    expect(() => parseKubeconfig('/path/config', 'no-such-ctx')).toThrow(
      'context "no-such-ctx" not found',
    )
    expect(() => parseKubeconfig('/path/config', 'no-such-ctx')).toThrow(/available: test-ctx/)
  })

  it('throws when no context can be selected', () => {
    // kubeconfig without current-context and no explicit name provided
    const noCurrentContext = validKubeconfig.replace('current-context: test-ctx\n', '')
    mockReadFileSync.mockReturnValue(noCurrentContext)

    expect(() => parseKubeconfig('/path/config')).toThrow(
      'has no current-context and no context name was provided',
    )
  })

  it('throws when the token is missing', () => {
    mockReadFileSync.mockReturnValue(kubeconfigWithoutToken)

    expect(() => parseKubeconfig('/path/config')).toThrow(
      'does not provide a token',
    )
  })
})
