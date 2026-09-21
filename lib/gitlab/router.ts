/**
 * GitLab project router — resolves a {@link GitLabClient} by project id.
 */
import type { GitLabProjectConfig } from '../config.js'
import { GitLabClient } from './client.js'

export class GitLabRouter {
  private readonly clients: Map<string, GitLabClient>

  constructor(
    private readonly baseUrl: string,
    projects: GitLabProjectConfig[],
    private readonly defaultProject?: string,
  ) {
    this.clients = new Map()

    for (const p of projects) {
      const token = p.token ?? (p.tokenEnv ? process.env[p.tokenEnv] : undefined)
      if (!token) {
        throw new Error(
          `[dsh-devops] GitLab project "${p.id}": no direct token and environment variable "${p.tokenEnv}" is not set`,
        )
      }
      this.clients.set(p.id, new GitLabClient(baseUrl, p.path, token))
    }
  }

  /**
   * Resolve a {@link GitLabClient} for the given project id,
   * or fall back to the configured default project.
   */
  resolve(id?: string): GitLabClient {
    const key = id ?? this.defaultProject
    if (!key) {
      throw new Error('[dsh-devops] GitLab: no project id provided and no defaultProject configured')
    }
    const client = this.clients.get(key)
    if (!client) {
      const available = [...this.clients.keys()].join(', ')
      throw new Error(`[dsh-devops] GitLab: unknown project id "${key}". Available: ${available}`)
    }
    return client
  }

  /** Return all configured project ids. */
  list(): string[] {
    return [...this.clients.keys()]
  }
}
