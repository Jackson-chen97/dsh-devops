import { describe, it, expect } from 'vitest'
import { parseConfig } from '../../src/config.ts'

describe('parseConfig', () => {
  it('should throw when raw is not an object', () => {
    expect(() => parseConfig(null)).toThrow('config must be an object')
    expect(() => parseConfig(undefined)).toThrow('config must be an object')
    expect(() => parseConfig('string')).toThrow('config must be an object')
    expect(() => parseConfig(42)).toThrow('config must be an object')
  })

  it('strips sections that are effectively empty (unconfigured plugin loads clean)', () => {
    // Schemastery fills every declared section with empty objects/arrays even
    // when the user did not configure it — those must be dropped, not rejected.
    const config = parseConfig({
      gitlab: {},
      k8s: { kubeconfigs: [] },
      webhook: {},
      monitor: { pollIntervalSec: 30 },
    })
    expect(config.gitlab).toBeUndefined()
    expect(config.k8s).toBeUndefined()
    expect(config.webhook).toBeUndefined()
    expect(config.monitor).toBeUndefined()
  })

  it('throws when a gitlab section has a baseUrl but no token', () => {
    expect(() =>
      parseConfig({
        gitlab: { baseUrl: 'https://gitlab.example.com', projects: [{ id: 'a', path: 'g/a' }] },
      }),
    ).toThrow('gitlab.token is required')
  })

  it('throws when gitlab.projects is empty but the section is real', () => {
    expect(() =>
      parseConfig({
        gitlab: { baseUrl: 'https://gitlab.example.com', token: 't', projects: [] },
      }),
    ).toThrow('gitlab.projects must be a non-empty array')
  })

  it('throws when a gitlab project has no id or path', () => {
    const base = { baseUrl: 'https://gitlab.example.com', token: 't' }
    expect(() => parseConfig({ gitlab: { ...base, projects: [{ path: 'g/a' }] } })).toThrow(
      'gitlab project must have an id',
    )
    expect(() => parseConfig({ gitlab: { ...base, projects: [{ id: 'a' }] } })).toThrow(
      'gitlab project "a" must have a path',
    )
  })

  it('throws when a k8s kubeconfig ref has no id or path', () => {
    expect(() => parseConfig({ k8s: { kubeconfigs: [{ path: '/home/u/.kube/config' }] } })).toThrow(
      'k8s kubeconfig ref must have an id',
    )
    expect(() => parseConfig({ k8s: { kubeconfigs: [{ id: 'c1', path: '' }] } })).toThrow(
      'k8s kubeconfig "c1" must have a path',
    )
  })

  it('throws when the webhook section is present without gitlab', () => {
    expect(() => parseConfig({ webhook: { secret: 's3cret' } })).toThrow(
      'webhook requires gitlab section to be configured',
    )
  })

  it('throws when monitor is present with rules but no gitlab/k8s', () => {
    expect(() =>
      parseConfig({ monitor: { pollIntervalSec: 30, pipeline: [{ trigger: 'failed' }] } }),
    ).toThrow('monitor requires at least gitlab or k8s to be configured')
  })

  it('returns a valid full config', () => {
    const config = parseConfig({
      gitlab: {
        baseUrl: 'https://gitlab.example.com',
        defaultProject: 'a',
        token: 'glpat-x',
        projects: [{ id: 'a', path: 'group/proj-a', tokenEnv: 'GITLAB_TOKEN' }],
      },
      webhook: { secret: 's3cret' },
      monitor: { pollIntervalSec: 30, pipeline: [{ trigger: 'failed' }] },
    })
    expect(config.gitlab?.baseUrl).toBe('https://gitlab.example.com')
    expect(config.gitlab?.projects).toHaveLength(1)
    expect(config.webhook?.secret).toBe('s3cret')
    expect(config.monitor?.pipeline).toHaveLength(1)
  })

  it('returns a valid k8s-only config', () => {
    const config = parseConfig({
      k8s: {
        kubeconfigs: [{ id: 'prod', path: '~/.kube/config' }],
        defaultContext: 'prod-ctx',
      },
    })
    expect(config.gitlab).toBeUndefined()
    expect(config.k8s?.kubeconfigs).toEqual([{ id: 'prod', path: '~/.kube/config' }])
  })
})
