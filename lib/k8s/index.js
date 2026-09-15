import { K8sRouter } from './router.js';
export function registerK8s(ctx, config) {
    const router = new K8sRouter(config.kubeconfigs, config.defaultContext, config.defaultNamespace);
    ctx.effect(()=>{
        const ids = router.list();
        ctx.log?.warn?.(`[dsh-devops:k8s] ready — ${ids.length} cluster(s): ${ids.join(', ')}`);
        return ()=>{};
    }, 'dsh-devops:k8s');
    const service = {
        listClusters: ()=>router.list(),
        getDefaultNamespace: (cluster)=>router.getDefaultNamespace(cluster),
        getDeploymentStatus: (cluster, namespace, name)=>router.resolve(cluster).getDeployment(namespace, name),
        getDeploymentStatusList: (cluster, namespace)=>router.resolve(cluster).getDeployments(namespace),
        getPodList: (cluster, namespace)=>router.resolve(cluster).getPods(namespace),
        getEvents: (cluster, namespace, limit)=>router.resolve(cluster).getEvents(namespace, limit),
        getPodLogs: (cluster, namespace, podName, container, tailLines)=>router.resolve(cluster).getPodLogs(namespace, podName, container, tailLines)
    };
    return service;
}
