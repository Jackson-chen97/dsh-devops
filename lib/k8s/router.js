import { K8sClient } from './client.js';
import { parseKubeconfig } from './kubeconfig.js';
export class K8sRouter {
    clusters = new Map();
    defaultClientId;
    defaultNamespace;
    constructor(kubeconfigs, defaultContext, defaultNamespace){
        if (!kubeconfigs.length) {
            throw new Error('[k8s] router requires at least one kubeconfig');
        }
        for (const ref of kubeconfigs){
            const ctx = parseKubeconfig(ref.path, ref.context ?? defaultContext);
            this.clusters.set(ref.id, {
                client: new K8sClient(ctx),
                contextNamespace: ctx.namespace,
                refNamespace: ref.namespace
            });
        }
        const ids = [
            ...this.clusters.keys()
        ];
        this.defaultClientId = defaultContext && this.clusters.has(defaultContext) ? defaultContext : ids[0];
        this.defaultNamespace = defaultNamespace;
    }
    list() {
        return [
            ...this.clusters.keys()
        ];
    }
    resolve(id) {
        return this.entry(id).client;
    }
    getDefaultNamespace(id) {
        const e = this.entry(id);
        if (e.refNamespace) return e.refNamespace;
        if (e.contextNamespace !== 'default') return e.contextNamespace;
        return this.defaultNamespace ?? 'default';
    }
    entry(id) {
        const key = id ?? this.defaultClientId;
        const e = this.clusters.get(key);
        if (!e) {
            throw new Error(`[k8s] unknown cluster id "${key}" (configured: ${[
                ...this.clusters.keys()
            ].join(', ')})`);
        }
        return e;
    }
}
