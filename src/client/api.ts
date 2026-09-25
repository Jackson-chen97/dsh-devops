/**
 * DevopsClient — the web console's business RPC client.
 *
 * Every method maps to one endpoint on the plugin's read/write channels.
 * Endpoint payloads keep the historical `{ ok, ... }` soft-failure shape
 * (upstream connectivity problems are results, not RPC errors); only
 * transport/dispatch failures reject.
 */
import {
  DEVOPS_READ_CHANNEL,
  DEVOPS_WRITE_CHANNEL,
} from '../protocol.ts'
import type { ClientConnection } from './dsh-context.ts'
import type { DevopsSettingsFile, GitLabServerEntry, KubeconfigEntry } from '../types.ts'

export class DevopsClient {
  constructor(private readonly connection: ClientConnection) {}

  private async read<T>(endpoint: string, payload: unknown): Promise<T> {
    const response = await this.connection.rpc.call(DEVOPS_READ_CHANNEL, endpoint, payload)
    if (!response.ok) throw new Error(response.error.message)
    return response.value as T
  }

  private async write<T>(endpoint: string, payload: unknown): Promise<T> {
    const response = await this.connection.rpc.call(DEVOPS_WRITE_CHANNEL, endpoint, payload)
    if (!response.ok) throw new Error(response.error.message)
    return response.value as T
  }

  // ─── App ─────────────────────────────────────────────────────────────────────

  loadConfig(): Promise<{ ok: boolean; config: DevopsSettingsFile | null }> {
    return this.read('config-load', {})
  }

  saveConfig(patch: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
    return this.write('config-save', patch)
  }

  logs(params: { lines?: number } = {}): Promise<{ ok: boolean; lines: string[] }> {
    return this.read('logs', params)
  }

  browseFile(): Promise<{ ok: boolean; path: string; message?: string }> {
    return this.read('browse-file', {})
  }

  // ─── GitLab ──────────────────────────────────────────────────────────────────

  testGitLab(params: { baseUrl: string; token: string }) {
    return this.read<{ ok: boolean; message: string }>('test-gitlab', params)
  }

  gitlabProjects(params: { baseUrl: string; token: string; search?: string }) {
    return this.read<{ ok: boolean; projects: { id: string; name: string; path: string; defaultBranch: string }[]; message?: string }>(
      'gitlab-projects',
      params,
    )
  }

  gitlabBranches(params: { baseUrl: string; token: string; path: string; search?: string }) {
    return this.read<{ ok: boolean; branches: { name: string; isDefault: boolean }[]; message?: string }>(
      'gitlab-branches',
      params,
    )
  }

  gitlabMembers(params: { baseUrl: string; token: string; path: string }) {
    return this.read<{ ok: boolean; members: { username: string; name: string }[]; message?: string }>(
      'gitlab-members',
      params,
    )
  }

  gitlabLastCommit(params: { baseUrl: string; token: string; path: string; branch: string }) {
    return this.read<{ ok: boolean; shortId?: string; title?: string; message?: string; author?: string; date?: string }>(
      'gitlab-last-commit',
      params,
    )
  }

  gitlabMRs(params: { baseUrl: string; token: string; projectPath: string }) {
    return this.read<{ ok: boolean; mergeRequests: DashboardMR[]; message?: string }>('gitlab-mrs', params)
  }

  gitlabPipelines(params: { baseUrl: string; token: string; projectPath: string; perPage?: number }) {
    return this.read<{ ok: boolean; pipelines: DashboardPipeline[]; message?: string }>('gitlab-pipelines', params)
  }

  gitlabTags(params: { baseUrl: string; token: string; projectPath: string }) {
    return this.read<{ ok: boolean; tags: DashboardTag[]; message?: string }>('gitlab-tags', params)
  }

  gitlabPipelineJobs(params: { baseUrl: string; token: string; projectPath: string; pipelineId: number }) {
    return this.read<{ ok: boolean; jobs: DashboardJob[]; message?: string }>('gitlab-pipeline-jobs', params)
  }

  gitlabJobLog(params: { baseUrl: string; token: string; projectPath: string; jobId: number }) {
    return this.read<{ ok: boolean; logs: string; jobUrl: string; message?: string }>('gitlab-job-log', params)
  }

  gitlabCreateMR(params: {
    baseUrl: string
    token: string
    projectPath: string
    sourceBranch: string
    targetBranch: string
    title: string
    description?: string
    reviewers?: string
  }) {
    return this.write<{ ok: boolean; mergeRequest?: { iid: number; title: string; webUrl: string }; message?: string }>(
      'gitlab-create-mr',
      params,
    )
  }

  gitlabCreateTag(params: {
    baseUrl: string
    token: string
    projectPath: string
    tagName: string
    ref: string
    message?: string
  }) {
    return this.write<{ ok: boolean; tag?: { name: string }; message?: string }>('gitlab-create-tag', params)
  }

  gitlabPipelineAction(params: { baseUrl: string; token: string; projectPath: string; pipelineId: number; action: 'cancel' | 'retry' }) {
    return this.write<{ ok: boolean; message?: string }>('gitlab-pipeline-action', params)
  }

  gitlabMRApprove(params: { baseUrl: string; token: string; projectPath: string; mrIid: number }) {
    return this.write<{ ok: boolean; approvalsBeforeMerge?: number | null; message?: string }>('gitlab-mr-approve', params)
  }

  gitlabMRAction(params: { baseUrl: string; token: string; projectPath: string; mrIid: number; action: 'close' | 'reopen' }) {
    return this.write<{ ok: boolean; state?: string; message?: string }>('gitlab-mr-action', params)
  }

  // ─── Kubernetes ──────────────────────────────────────────────────────────────

  testK8s(params: { kubeconfigPath: string; context?: string }) {
    return this.read<{ ok: boolean; message: string; namespace?: string; contexts?: { name: string; namespace: string }[] }>(
      'test-k8s',
      params,
    )
  }

  k8sContexts(params: { kubeconfigPath: string }) {
    return this.read<{ ok: boolean; contexts: { name: string; namespace: string }[]; message?: string }>(
      'k8s-contexts',
      params,
    )
  }

  k8sNamespaces(params: { kubeconfigPath: string; context?: string }) {
    return this.read<{ ok: boolean; namespaces: string[]; message?: string }>('k8s-namespaces', params)
  }

  k8sDeployments(params: { kubeconfigPath: string; context?: string; namespace: string }) {
    return this.read<{ ok: boolean; deployments: DashboardDeployment[]; message?: string }>('k8s-deployments', params)
  }

  k8sPods(params: { kubeconfigPath: string; context?: string; namespace: string }) {
    return this.read<{ ok: boolean; pods: DashboardPod[]; message?: string }>('k8s-pods', params)
  }

  k8sEvents(params: { kubeconfigPath: string; context?: string; namespace: string; limit?: number }) {
    return this.read<{ ok: boolean; events: DashboardEvent[]; message?: string }>('k8s-events', params)
  }

  k8sPodLogs(params: { kubeconfigPath: string; context?: string; namespace: string; podName: string; tailLines?: number }) {
    return this.read<{ ok: boolean; logs: string; message?: string }>('k8s-pod-logs', params)
  }

  k8sSetImage(params: { kubeconfigPath: string; context?: string; namespace: string; name: string; image: string }) {
    return this.write<{ ok: boolean; message?: string }>('k8s-set-image', params)
  }

  k8sRestart(params: { kubeconfigPath: string; context?: string; namespace: string; name: string }) {
    return this.write<{ ok: boolean; message?: string }>('k8s-restart', params)
  }
}

// ─── Dashboard payload shapes ──────────────────────────────────────────────────

export interface DashboardMR {
  iid: number
  title: string
  state: string
  author: string
  sourceBranch: string
  targetBranch: string
  createdAt: string
  updatedAt: string
  approvalsBeforeMerge: number | null
  mergeStatus: string
  workInProgress: boolean
  draft: boolean
  webUrl: string
}

export interface DashboardPipeline {
  id: number
  status: string
  ref: string
  sha: string
  createdAt: string
  updatedAt: string
  duration: number | null
}

export interface DashboardTag {
  name: string
  message: string
  createdAt: string
}

export interface DashboardJob {
  id: number
  name: string
  stage: string
  status: string
  duration: number | undefined
  failureReason: string
}

export interface DashboardDeployment {
  name: string
  ready: number
  replicas: number
  image: string
  imageTag: string
  updated: string
}

export interface DashboardPod {
  name: string
  phase: string
  ready: number
  total: number
  restarts: number
  node: string
  reason: string
  startedAt: string
}

export interface DashboardEvent {
  type: string
  reason: string
  message: string
  object: string
  kind: string
  time: string
}

// ─── Settings-file helpers ─────────────────────────────────────────────────────

/** Active GitLab server entry (by activeServerId, else the first). */
export function resolveGlServer(cfg: DevopsSettingsFile | null | undefined): GitLabServerEntry | null {
  const gl = cfg?.gitlab
  if (!gl || !Array.isArray(gl.servers)) return null
  return gl.servers.find((s) => s.id === gl.activeServerId) ?? gl.servers[0] ?? null
}

/** Active kubeconfig entry (by activeKubeconfigId, else the first). */
export function resolveK8sKc(cfg: DevopsSettingsFile | null | undefined): KubeconfigEntry | null {
  const k8s = cfg?.k8s
  if (!k8s || !Array.isArray(k8s.kubeconfigs)) return null
  return k8s.kubeconfigs.find((k) => k.id === k8s.activeKubeconfigId) ?? k8s.kubeconfigs[0] ?? null
}
