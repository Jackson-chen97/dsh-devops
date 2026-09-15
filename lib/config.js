import Schema from '@deepseek-ai/schemastery';
export const Config = Schema.object({
    gitlab: Schema.object({
        baseUrl: Schema.string(),
        token: Schema.string(),
        defaultProject: Schema.string(),
        projects: Schema.array(Schema.object({
            id: Schema.string(),
            path: Schema.string(),
            defaultBranch: Schema.string()
        }))
    }),
    k8s: Schema.object({
        kubeconfigs: Schema.array(Schema.object({
            id: Schema.string(),
            path: Schema.string(),
            context: Schema.string(),
            namespace: Schema.string()
        })),
        defaultContext: Schema.string(),
        defaultNamespace: Schema.string()
    }),
    webhook: Schema.object({
        secret: Schema.string(),
        projectPaths: Schema.array(Schema.string()),
        quietEvents: Schema.array(Schema.string())
    }),
    monitor: Schema.object({
        pollIntervalSec: Schema.number().default(30),
        cooldownSec: Schema.number().default(300),
        pipeline: Schema.array(Schema.object({
            projects: Schema.array(Schema.string()),
            branches: Schema.array(Schema.string()),
            trigger: Schema.union([
                'failed',
                'canceled',
                'success'
            ]),
            message: Schema.string(),
            includeFailedJobs: Schema.boolean()
        })),
        pod: Schema.array(Schema.object({
            clusters: Schema.array(Schema.string()),
            namespaces: Schema.array(Schema.string()),
            trigger: Schema.union([
                'crash',
                'restart',
                'pending_stuck'
            ]),
            restartThreshold: Schema.number(),
            pendingTimeoutSec: Schema.number(),
            message: Schema.string(),
            includeLogs: Schema.boolean()
        }))
    })
});
export function parseConfig(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error('[dsh-devops] config must be an object');
    }
    const config = {
        ...raw
    };
    if (config.gitlab && !config.gitlab.baseUrl) {
        delete config.gitlab;
    }
    if (config.k8s && (!config.k8s.kubeconfigs || config.k8s.kubeconfigs.length === 0)) {
        delete config.k8s;
    }
    if (config.webhook && !config.webhook.secret) {
        delete config.webhook;
    }
    if (config.monitor) {
        const hasRules = (config.monitor.pipeline?.length ?? 0) > 0 || (config.monitor.pod?.length ?? 0) > 0;
        if (!hasRules) delete config.monitor;
    }
    if (config.gitlab) {
        if (!config.gitlab.baseUrl) {
            throw new Error('[dsh-devops] gitlab.baseUrl is required when gitlab section is present');
        }
        if (!config.gitlab.token) {
            throw new Error('[dsh-devops] gitlab.token is required when gitlab section is present');
        }
        if (!config.gitlab.projects?.length) {
            throw new Error('[dsh-devops] gitlab.projects must be a non-empty array');
        }
        for (const p of config.gitlab.projects){
            if (!p.id) throw new Error('[dsh-devops] gitlab project must have an id');
            if (!p.path) throw new Error(`[dsh-devops] gitlab project "${p.id}" must have a path`);
        }
    }
    if (config.k8s) {
        if (!config.k8s.kubeconfigs?.length) {
            throw new Error('[dsh-devops] k8s.kubeconfigs must be a non-empty array when k8s section is present');
        }
        for (const ref of config.k8s.kubeconfigs){
            if (!ref.id) throw new Error('[dsh-devops] k8s kubeconfig ref must have an id');
            if (!ref.path) throw new Error(`[dsh-devops] k8s kubeconfig "${ref.id}" must have a path`);
        }
    }
    if (config.webhook) {
        if (!config.webhook.secret) {
            throw new Error('[dsh-devops] webhook.secret is required');
        }
        if (!config.gitlab) {
            throw new Error('[dsh-devops] webhook requires gitlab section to be configured');
        }
    }
    if (config.monitor) {
        if (!config.gitlab && !config.k8s) {
            throw new Error('[dsh-devops] monitor requires at least gitlab or k8s to be configured');
        }
    }
    return config;
}
