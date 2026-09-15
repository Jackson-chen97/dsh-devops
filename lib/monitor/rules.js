import { throttled } from './throttle.js';
export async function checkPipelineAlerts(ctx, gitlab, rules, config) {
    const cooldown = config.cooldownSec ?? 300;
    const projects = gitlab.listProjects();
    for (const project of projects){
        for (const rule of rules){
            if (rule.projects && !rule.projects.includes(project)) continue;
            const branches = rule.branches ?? [
                'HEAD'
            ];
            for (const branch of branches){
                const pipeline = await gitlab.getLatestPipelineByRef(project, branch);
                if (!pipeline) continue;
                if (!matchesPipelineTrigger(pipeline.status, rule.trigger)) continue;
                const key = `pipeline:${project}:${pipeline.ref}:${pipeline.id}:${rule.trigger}`;
                if (throttled(key, cooldown)) continue;
                const message = await formatPipelineAlert(rule, project, pipeline, gitlab);
                ctx.followup?.(message);
            }
        }
    }
}
function matchesPipelineTrigger(status, trigger) {
    return status === trigger;
}
async function formatPipelineAlert(rule, project, pipeline, gitlab) {
    const lines = [];
    lines.push(`🔔 Pipeline ${rule.trigger}: ${project} @ ${pipeline.ref}`);
    lines.push(`   Pipeline #${pipeline.id} | ${pipeline.status}`);
    if (pipeline.webUrl) {
        lines.push(`   ${pipeline.webUrl}`);
    }
    if (rule.includeFailedJobs) {
        try {
            const jobs = await gitlab.listPipelineJobs(project, pipeline.id);
            const failed = jobs.filter((j)=>j.status === 'failed');
            if (failed.length > 0) {
                lines.push('   Failed jobs:');
                for (const job of failed){
                    lines.push(`     - ${job.name} (${job.status})`);
                }
            }
        } catch  {}
    }
    if (rule.message) {
        lines.push(`   ${rule.message}`);
    }
    return lines.join('\n');
}
export async function checkPodAlerts(ctx, k8s, rules, config) {
    const cooldown = config.cooldownSec ?? 300;
    const clusters = k8s.listClusters();
    for (const cluster of clusters){
        for (const rule of rules){
            if (rule.clusters && !rule.clusters.includes(cluster)) continue;
            const namespaces = rule.namespaces ?? [
                k8s.getDefaultNamespace(cluster)
            ];
            for (const namespace of namespaces){
                const pods = await k8s.getPodList(cluster, namespace);
                for (const pod of pods){
                    await evaluatePodRule(ctx, k8s, rule, config, cluster, namespace, pod, cooldown);
                }
            }
        }
    }
}
async function evaluatePodRule(ctx, k8s, rule, config, cluster, namespace, pod, cooldown) {
    let triggered = false;
    let detail = '';
    switch(rule.trigger){
        case 'crash':
            if (pod.phase === 'Failed') {
                triggered = true;
                detail = 'Pod crashed (phase: Failed)';
            }
            break;
        case 'restart':
            {
                const threshold = rule.restartThreshold ?? 3;
                if (pod.restartCount > threshold) {
                    triggered = true;
                    detail = `Pod restarts exceeded threshold (${pod.restartCount} > ${threshold})`;
                }
                break;
            }
        case 'pending_stuck':
            {
                const timeoutSec = rule.pendingTimeoutSec ?? 300;
                if (pod.phase === 'Pending') {
                    const startMs = pod.startTime ? new Date(pod.startTime).getTime() : undefined;
                    if (startMs !== undefined) {
                        const pendingMs = Date.now() - startMs;
                        if (pendingMs > timeoutSec * 1000) {
                            triggered = true;
                            detail = `Pod stuck in Pending for ${Math.round(pendingMs / 1000)}s (timeout: ${timeoutSec}s)`;
                        }
                    }
                }
                break;
            }
    }
    if (!triggered) return;
    const key = `pod:${cluster}:${namespace}:${pod.name}:${rule.trigger}`;
    if (throttled(key, cooldown)) return;
    const message = formatPodAlert(rule, cluster, namespace, pod, detail);
    ctx.followup?.(message);
}
function formatPodAlert(rule, cluster, namespace, pod, detail) {
    const lines = [];
    lines.push(`🐳 Pod alert [${rule.trigger}]: ${pod.name} in ${cluster}/${namespace}`);
    lines.push(`   ${detail}`);
    lines.push(`   Phase: ${pod.phase} | Restarts: ${pod.restartCount}`);
    if (rule.message) {
        lines.push(`   ${rule.message}`);
    }
    return lines.join('\n');
}
