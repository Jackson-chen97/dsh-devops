import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GitLabRouter } from '../../src/gitlab/router.js'
import { GitLabClient } from '../../src/gitlab/client.js'
import type { GitLabProjectConfig } from '../../src/config.js'

const projects: GitLabProjectConfig[] = [
  { id: 'proj-a', path: 'group/proj-a', tokenEnv: 'TEST_GITLAB_TOKEN' },
  { id: 'proj-b', path: 'group/proj-b', tokenEnv: 'TEST_GITLAB_TOKEN' },
]

describe('GitLabRouter', () => {
  beforeEach(() => {
    process.env.TEST_GITLAB_TOKEN = 'test-token'
  })

  afterEach(() => {
    delete process.env.TEST_GITLAB_TOKEN
  })

  it('list() returns configured project ids', () => {
    const router = new GitLabRouter('https://gitlab.example.com', projects, 'proj-a')
    expect(router.list()).toEqual(['proj-a', 'proj-b'])
  })

  it('resolve() returns a GitLabClient for a valid id', () => {
    const router = new GitLabRouter('https://gitlab.example.com', projects, 'proj-a')
    const client = router.resolve('proj-a')
    expect(client).toBeInstanceOf(GitLabClient)
  })

  it('resolve() throws for unknown id', () => {
    const router = new GitLabRouter('https://gitlab.example.com', projects, 'proj-a')
    expect(() => router.resolve('nope')).toThrow(
      'unknown project id "nope". Available: proj-a, proj-b',
    )
  })

  it('resolve() falls back to defaultProject when id is undefined', () => {
    const router = new GitLabRouter('https://gitlab.example.com', projects, 'proj-b')
    const client = router.resolve()
    expect(client).toBeInstanceOf(GitLabClient)
    // Fallback client should be identical to the explicit one
    expect(router.resolve()).toBe(router.resolve('proj-b'))
  })

  it('resolve() throws when no id and no defaultProject configured', () => {
    const router = new GitLabRouter('https://gitlab.example.com', projects)
    expect(() => router.resolve()).toThrow(
      'no project id provided and no defaultProject configured',
    )
  })

  it('throws when the token env var is not set', () => {
    delete process.env.TEST_GITLAB_TOKEN
    expect(() =>
      new GitLabRouter('https://gitlab.example.com', projects, 'proj-a'),
    ).toThrow('environment variable "TEST_GITLAB_TOKEN" is not set')
  })
})
