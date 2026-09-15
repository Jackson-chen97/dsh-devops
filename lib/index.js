import { parseConfig } from './config.js';
import { registerGitLab } from './gitlab/index.js';
import { registerK8s } from './k8s/index.js';
import { registerTools } from './tools/index.js';
import { registerWebhook } from './webhook/index.js';
import { startMonitor } from './monitor/index.js';
import { registerDevopsApi } from './api.js';
import { createLazyGitLabService, createLazyK8sService } from './runtime/lazy.js';
export const name = 'dsh-devops';
export { Config } from './config.js';
export const inject = [
    'webServer',
    'tools'
];
export function apply(ctx, rawConfig) {
    const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const config = parseConfig(raw);
    const gitlabService = createLazyGitLabService(ctx, raw);
    const k8sService = createLazyK8sService(ctx, raw);
    registerTools(ctx, {
        gitlab: gitlabService,
        k8s: k8sService
    });
    if (config.webhook) {
        registerWebhook(ctx, config.webhook);
    }
    if (config.monitor) {
        const eagerGitlab = config.gitlab ? registerGitLab(ctx, config.gitlab) : gitlabService;
        const eagerK8s = config.k8s ? registerK8s(ctx, config.k8s) : k8sService;
        startMonitor(ctx, config.monitor, {
            gitlab: eagerGitlab,
            k8s: eagerK8s
        });
    }
    registerDevopsApi(ctx);
}
