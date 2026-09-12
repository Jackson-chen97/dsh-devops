import { describe, it, expect } from 'vitest'
import { parseConfig } from '../src/config.js'

describe('parseConfig', () => {
  it('should throw when raw is not an object', () => {
    expect(() => parseConfig(null)).toThrow('config must be an object')
    expect(() => parseConfig(undefined)).toThrow('config must be an object')
    expect(() => parseConfig('string')).toThrow('config must be an object')
    expect(() => parseConfig(42)).toThrow('config must be an object')
  })

  it('should throw when gitlab section has no baseUrl', () => {
    expect(() =>
      parseConfig({
        gitlab: { projects: [{ id: 'a', path: 'g/a', tokenEnv: 'T' }] },
      }),
    ).toThrow('gitlab.baseUrl is required')
  })

  it('should throw when gitlab.projects is empty', () => {
    expect(() =>
      parseConfig({
        gitlab: { baseUrl: 'https://gitlab.example.com', projects: [] },
      }),
    ).toThrow('gitlab.projects must be a non-empty array')
  })

  it('should throw when gitlab project has no id/path/tokenEnv', () => {
    const base = { baseUrl: 'https://gitlab.example.com' }
    expect(() =>
      parseConfig({ gitlab: { ...base, projects: [{ path: 'g/a', tokenEnv: 'T' }] } }),
    ).toThrow('gitlab project must have an id')

    expect(() =>
      parseConfig({ gitlab: { ...base, projects: [{ id: 'a', tokenEnv: 'T' }] } }),
    ).toThrow('gitlab project "a" must have a path')

    expect(() =>
      parseConfig({ gitlab: { ...base, projects: [{ id: 'a', path: 'g/a' }] } }),
    ).toThrow('gitlab project "a" must have a tokenEnv')
  })

  it('should throw when k8s.kubeconfigs is empty', () => {
    expect(() =>
      parseConfig({ k8s: { kubeconfigs: [] } }),
    ).toThrow('k8s.kubeconfigs must be a non-empty array')
  })

  it('should throw when k8s kubeconfig ref has no id/path', () => {
    expect(() =>
      parseConfig({ k8s: { kubeconfigs: [{ path: '/home/u/.kube/config' }] } }),
    ).toThrow('k8s kubeconfig ref must have an id')

    expect(() =>
      parseConfig({ k8s: { kubeconfigs: [{ id: 'c1' }] } }),
    ).toThrow('k8s kubeconfig "c1" must have a path')
  })

  it('should throw when webhook has no secret', () => {
    expect(() =>
      parseConfig({
        gitlab: {
          baseUrl: 'https://gitlab.example.com',
          projects: [{ id: 'a', path: 'g/a', tokenEnv: 'T' }],
        },
        webhook: {},
      }),
    ).toThrow('webhook.secret is required')
  })

  it('should throw when webhook section is present without gitlab', () => {
    expect(() =>
      parseConfig({ webhook: { secret: 's3cret' } }),
    ).toThrow('webhook requires gitlab section to be configured')
  })

  it('should throw when monitor is present without gitlab/k8s', () => {
    expect(() => parseConfig({ monitor: { pollIntervalSec: 30 } })).toThrow(
      'monitor requires at least gitlab or k8s to be configured',
    )
  })

  it('should return valid config when gitlab is correctly configured', () => {
    const raw = {
      gitlab: {
        baseUrl: 'https://gitlab.example.com',
        defaultProject: 'a',
        projects: [{ id: 'a', path: 'group/proj-a', tokenEnv: 'GITLAB_TOKEN' }],
      },
      webhook: { secret: 's3cret' },
      monitor: { pollIntervalSec: 30 },
    }
    const config = parseConfig(raw)
    expect(config).toEqual(raw)
    expect(config.gitlab?.baseUrl).toBe('https://gitlab.example.com')
    expect(config.gitlab?.projects).toHaveLength(1)
    expect(config.webhook?.secret).toBe('s3cret')
    expect(config.monitor?.pollIntervalSec).toBe(30)
  })

  it('should return valid config when only k8s is configured', () => {
    const raw = {
      k8s: {
        kubeconfigs: [{ id: 'prod', path: '~/.kube/config' }],
        defaultContext: 'prod-ctx',
      },
    }
    const config = parseConfig(raw)
    expect(config).toEqual(raw)
    expect(config.gitlab).toBeUndefined()
    expect(config.k8s?.kubeconfigs).toEqual([{ id: 'prod', path: '~/.kube/config' }])
  })
})
