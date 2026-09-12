/**
 * Lazy service wrappers — GitLab/K8s services that resolve their configuration
 * on every call instead of at plugin load time.
 *
 * This is what makes "install → configure in Settings → AI tools work" possible
 * with no restart: tools are registered unconditionally, and each execute()
 * re-reads the same config.json the dashboard writes.
 */
import { GitLabRouter } from '../gitlab/router.js'
import { K8sRouter } from '../k8s/router.js'
import type { GitLabService } from '../gitlab/index.js'
import type { K8sService } from '../k8s/index.js'
import { NOT_CONFIGURED_MSG, resolveGitLabConfig, resolveK8sConfig } from '../runtime-config.js'

interface DshContext {
  log?: { warn(...args: unknown[]): void }
}

function notConfigured(): never {
  throw new Error(NOT_CONFIGURED_MSG)
}

/**
 * GitLab service that rebuilds its router from the effective config on every
 * call. Cheap: the underlying client is stateless HTTP.
 */
export function createLazyGitLabService(ctx: DshContext, cordisRaw: unknown): GitLabService {
  function router(): GitLabRouter {
    const cfg = resolveGitLabConfig(cordisRaw)
    if (!cfg) notConfigured()
    try {
      return new GitLabRouter(cfg!.baseUrl, cfg!.projects, cfg!.defaultProject)
    } catch (err: any) {
      ctx.log?.warn?.(`[dsh-devops] GitLab router build failed: ${err.message}`)
      throw err
    }
  }
  return {
    listProjects: () => {
      const r = router()
      return r ? r.list() : []
    },
    createMR: (p, s, t, title, desc) => router().resolve(p).createMR(s!, t!, title!, desc),
    approveMR: (p, iid) => router().resolve(p).approveMR(iid!),
    requestChanges: (p, iid, c) => router().resolve(p).requestChanges(iid!, c!),
    commentMR: (p, iid, body) => router().resolve(p).commentMR(iid!, body!),
    listMRs: (p) => router().resolve(p).listMRs(),
    createTag: (p, name, ref, msg) => router().resolve(p).createTag(name!, ref!, msg),
    getPipeline: (p, id) => router().resolve(p).getPipeline(id!),
    getLatestPipelineByRef: (p, ref) => router().resolve(p).getLatestPipelineByRef(ref!),
    listPipelineJobs: (p, id) => router().resolve(p).listPipelineJobs(id!),
    getJobLog: (p, id) => router().resolve(p).getJobLog(id!),
  }
}

/**
 * K8s service that rebuilds its router from the effective config on every
 * call. Re-parses kubeconfig files per call (~ms file IO) in exchange for
 * always-current cluster/context/namespace selection.
 */
export function createLazyK8sService(ctx: DshContext, cordisRaw: unknown): K8sService {
  function router(): K8sRouter {
    const cfg = resolveK8sConfig(cordisRaw)
    if (!cfg) notConfigured()
    try {
      return new K8sRouter(cfg!.kubeconfigs, cfg!.defaultContext, cfg!.defaultNamespace)
    } catch (err: any) {
      ctx.log?.warn?.(`[dsh-devops] K8s router build failed: ${err.message}`)
      throw err
    }
  }
  return {
    listClusters: () => {
      const r = router()
      return r ? r.list() : []
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
