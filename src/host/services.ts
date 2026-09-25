/**
 * Lazy service wrappers — GitLab/K8s services that resolve their configuration
 * on every call instead of at plugin load time.
 *
 * This is what makes "install → configure in Settings → AI tools work" possible
 * with no restart: tools are registered unconditionally, and each execute()
 * re-reads the same settings file the dashboard writes.
 */
import { GitLabRouter, type GitLabService } from '../core/gitlab/service.ts'
import { K8sRouter, type K8sService } from '../core/k8s/service.ts'
import { NOT_CONFIGURED_MSG, resolveGitLabConfig, resolveK8sConfig } from './runtime-config.ts'

export interface DshHostLog {
  warn(...args: unknown[]): void
}

function notConfigured(): never {
  throw new Error(NOT_CONFIGURED_MSG)
}

/**
 * GitLab service resolving its config + rebuilding the router on every call.
 * Cheap: the underlying client is stateless HTTP, and per-call rebuild keeps
 * project/cluster switches from the dashboard immediately effective.
 */
export function createLazyGitLabService(log?: DshHostLog): GitLabService {
  function router(): GitLabRouter {
    const cfg = resolveGitLabConfig(undefined)
    if (!cfg) notConfigured()
    try {
      return new GitLabRouter(cfg!.baseUrl, cfg!.projects, cfg!.defaultProject)
    } catch (err) {
      log?.warn?.(`[dsh-devops] GitLab router build failed: ${(err as Error).message}`)
      throw err
    }
  }
  return {
    listProjects: () => {
      const cfg = resolveGitLabConfig(undefined)
      return cfg ? new GitLabRouter(cfg.baseUrl, cfg.projects, cfg.defaultProject).list() : []
    },
    createMR: (p, source, target, title, description, reviewers) => {
      const r = router().resolve(p)
      return r.client.createMR(r.projectPath, source, target, title, description, reviewers)
    },
    approveMR: (p, iid) => {
      const r = router().resolve(p)
      return r.client.approveMR(r.projectPath, iid).then(() => undefined)
    },
    requestChanges: (p, iid, comment) => {
      const r = router().resolve(p)
      return r.client.requestChanges(r.projectPath, iid, comment)
    },
    commentMR: (p, iid, body) => {
      const r = router().resolve(p)
      return r.client.commentMR(r.projectPath, iid, body)
    },
    listMRs: (p) => {
      const r = router().resolve(p)
      return r.client.listMRs(r.projectPath)
    },
    createTag: (p, name, ref, message) => {
      const r = router().resolve(p)
      return r.client.createTag(r.projectPath, name, ref, message)
    },
    getPipeline: (p, id) => {
      const r = router().resolve(p)
      return r.client.getPipeline(r.projectPath, id)
    },
    getLatestPipelineByRef: (p, ref) => {
      const r = router().resolve(p)
      return r.client.getLatestPipelineByRef(r.projectPath, ref)
    },
    listPipelineJobs: (p, id) => {
      const r = router().resolve(p)
      return r.client.listPipelineJobs(r.projectPath, id)
    },
    getJobLog: (p, id) => {
      const r = router().resolve(p)
      return r.client.getJobLog(r.projectPath, id).then((x) => x.logs)
    },
  }
}

/**
 * K8s service resolving its config + rebuilding the router on every call.
 * Re-parses kubeconfig files per call (~ms file IO) in exchange for
 * always-current cluster/context/namespace selection.
 */
export function createLazyK8sService(log?: DshHostLog): K8sService {
  function router(): K8sRouter {
    const cfg = resolveK8sConfig(undefined)
    if (!cfg) notConfigured()
    try {
      return new K8sRouter(cfg!.kubeconfigs, cfg!.defaultContext, cfg!.defaultNamespace)
    } catch (err) {
      log?.warn?.(`[dsh-devops] K8s router build failed: ${(err as Error).message}`)
      throw err
    }
  }
  return {
    listClusters: () => {
      const cfg = resolveK8sConfig(undefined)
      return cfg ? new K8sRouter(cfg.kubeconfigs, cfg.defaultContext, cfg.defaultNamespace).list() : []
    },
    getDefaultNamespace: (cluster) => router().getDefaultNamespace(cluster),
    getDeploymentStatus: (c, ns, name) => router().resolve(c).getDeployment(ns, name),
    getDeploymentStatusList: (c, ns) => router().resolve(c).getDeployments(ns),
    getPodList: (c, ns) => router().resolve(c).getPods(ns),
    getEvents: (c, ns, limit) => router().resolve(c).getEvents(ns, limit),
    getPodLogs: (c, ns, podName, container, tailLines) =>
      router().resolve(c).getPodLogs(ns, podName, container, tailLines),
  }
}
