import { GitLabRouter } from '../gitlab/router.js';
import { K8sRouter } from '../k8s/router.js';
import { NOT_CONFIGURED_MSG, resolveGitLabConfig, resolveK8sConfig } from '../runtime-config.js';
function notConfigured() {
    throw new Error(NOT_CONFIGURED_MSG);
}
export function createLazyGitLabService(ctx, cordisRaw) {
    function router() {
        const cfg = resolveGitLabConfig(cordisRaw);
        if (!cfg) notConfigured();
        try {
            return new GitLabRouter(cfg.baseUrl, cfg.projects, cfg.defaultProject);
        } catch (err) {
            ctx.log?.warn?.(`[dsh-devops] GitLab router build failed: ${err.message}`);
            throw err;
        }
    }
    return {
        listProjects: ()=>{
            const r = router();
            return r ? r.list() : [];
        },
        createMR: (p, s, t, title, desc)=>router().resolve(p).createMR(s, t, title, desc),
        approveMR: (p, iid)=>router().resolve(p).approveMR(iid),
        requestChanges: (p, iid, c)=>router().resolve(p).requestChanges(iid, c),
        commentMR: (p, iid, body)=>router().resolve(p).commentMR(iid, body),
        listMRs: (p)=>router().resolve(p).listMRs(),
        createTag: (p, name, ref, msg)=>router().resolve(p).createTag(name, ref, msg),
        getPipeline: (p, id)=>router().resolve(p).getPipeline(id),
        getLatestPipelineByRef: (p, ref)=>router().resolve(p).getLatestPipelineByRef(ref),
        listPipelineJobs: (p, id)=>router().resolve(p).listPipelineJobs(id),
        getJobLog: (p, id)=>router().resolve(p).getJobLog(id)
    };
}
export function createLazyK8sService(ctx, cordisRaw) {
    function router() {
        const cfg = resolveK8sConfig(cordisRaw);
        if (!cfg) notConfigured();
        try {
            return new K8sRouter(cfg.kubeconfigs, cfg.defaultContext, cfg.defaultNamespace);
        } catch (err) {
            ctx.log?.warn?.(`[dsh-devops] K8s router build failed: ${err.message}`);
            throw err;
        }
    }
    return {
        listClusters: ()=>{
            const r = router();
            return r ? r.list() : [];
        },
        getDefaultNamespace: (cluster)=>router().getDefaultNamespace(cluster),
        getDeploymentStatus: (c, ns, name)=>router().resolve(c).getDeployment(ns, name),
        getDeploymentStatusList: (c, ns)=>router().resolve(c).getDeployments(ns),
        getPodList: (c, ns)=>router().resolve(c).getPods(ns),
        getEvents: (c, ns, limit)=>router().resolve(c).getEvents(ns, limit),
        getPodLogs: (c, ns, podName, container, tailLines)=>router().resolve(c).getPodLogs(ns, podName, container, tailLines)
    };
}
