import { request as httpsRequest } from 'node:https';
const CONDITION_TYPES = [
    'Available',
    'Progressing',
    'ReplicaFailure'
];
const CONDITION_STATUSES = [
    'True',
    'False',
    'Unknown'
];
const POD_PHASES = [
    'Pending',
    'Running',
    'Succeeded',
    'Failed',
    'Unknown'
];
function inSet(value, set) {
    return set.includes(value);
}
function truncate(s, max = 300) {
    return s.length > max ? `${s.slice(0, max)}…` : s;
}
function toDeploymentCondition(c) {
    const typeStr = c.type ?? '';
    const statusStr = c.status ?? '';
    return {
        type: inSet(typeStr, CONDITION_TYPES) ? typeStr : 'Progressing',
        status: inSet(statusStr, CONDITION_STATUSES) ? statusStr : 'Unknown',
        reason: c.reason ?? '',
        message: c.message ?? '',
        lastUpdateTime: c.lastUpdateTime ?? ''
    };
}
function toDeploymentStatus(d, fallbackNamespace) {
    const s = d.status ?? {};
    return {
        name: d.metadata?.name ?? '',
        namespace: d.metadata?.namespace ?? fallbackNamespace,
        readyReplicas: s.readyReplicas ?? 0,
        availableReplicas: s.availableReplicas ?? 0,
        desiredReplicas: d.spec?.replicas ?? 0,
        updatedReplicas: s.updatedReplicas ?? 0,
        conditions: (s.conditions ?? []).map(toDeploymentCondition)
    };
}
function toPodInfo(p, fallbackNamespace) {
    const s = p.status ?? {};
    const containers = (s.containerStatuses ?? []).map((c)=>({
            name: c.name ?? '',
            ready: c.ready ?? false,
            restartCount: c.restartCount ?? 0
        }));
    const phaseStr = s.phase ?? '';
    return {
        name: p.metadata?.name ?? '',
        namespace: p.metadata?.namespace ?? fallbackNamespace,
        phase: inSet(phaseStr, POD_PHASES) ? phaseStr : 'Unknown',
        nodeName: s.nodeName,
        restartCount: containers.reduce((sum, c)=>sum + c.restartCount, 0),
        containers,
        startTime: s.startTime
    };
}
function toK8sEvent(e, fallbackNamespace) {
    return {
        type: e.type === 'Warning' ? 'Warning' : 'Normal',
        reason: e.reason ?? '',
        message: e.message ?? '',
        object: {
            kind: e.involvedObject?.kind ?? '',
            name: e.involvedObject?.name ?? '',
            namespace: e.involvedObject?.namespace ?? fallbackNamespace
        },
        count: e.count,
        lastTimestamp: e.lastTimestamp ?? ''
    };
}
export class K8sClient {
    ctx;
    server;
    constructor(ctx){
        this.ctx = ctx;
        this.server = ctx.server.replace(/\/+$/, '');
    }
    async getJson(path) {
        const res = await this.fetch(path, 'application/json');
        return await res.json();
    }
    async getText(path) {
        const res = await this.fetch(path, 'application/json');
        return res.text();
    }
    async fetch(path, accept) {
        const url = new URL(`${this.server}${path}`);
        const ca = this.ctx.caData ? Buffer.from(this.ctx.caData, 'base64') : undefined;
        const res = await new Promise((resolve, reject)=>{
            const req = httpsRequest({
                hostname: url.hostname,
                port: url.port || 443,
                path: `${url.pathname}${url.search}`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.ctx.token}`,
                    Accept: accept
                },
                ...this.ctx.insecureSkipTlsVerify ? {
                    rejectUnauthorized: false
                } : ca ? {
                    ca,
                    rejectUnauthorized: true,
                    checkServerIdentity: ()=>undefined
                } : {}
            }, (upstream)=>{
                const chunks = [];
                upstream.on('data', (c)=>chunks.push(c));
                upstream.on('end', ()=>{
                    const body = Buffer.concat(chunks).toString('utf8');
                    const status = upstream.statusCode ?? 0;
                    const bodyless = status === 204 || status === 304;
                    resolve(new Response(bodyless ? null : body, {
                        status,
                        statusText: upstream.statusMessage ?? ''
                    }));
                });
            });
            req.on('error', reject);
            req.end();
        }).catch((err)=>{
            throw new Error(`[k8s] request to ${path} failed: ${err.message}`);
        });
        if (!res.ok) {
            const body = await res.text().catch(()=>'');
            throw new Error(`[k8s] GET ${path} failed: ${res.status} ${res.statusText}${body ? ` — ${truncate(body)}` : ''}`);
        }
        return res;
    }
    async getDeployments(namespace) {
        const data = await this.getJson(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments`);
        return data.items.map((d)=>toDeploymentStatus(d, namespace));
    }
    async getDeployment(namespace, name) {
        const d = await this.getJson(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`);
        return toDeploymentStatus(d, namespace);
    }
    async getPods(namespace) {
        const data = await this.getJson(`/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`);
        return data.items.map((p)=>toPodInfo(p, namespace));
    }
    async getEvents(namespace, limit) {
        const q = limit ? `?limit=${limit}` : '';
        const data = await this.getJson(`/api/v1/namespaces/${encodeURIComponent(namespace)}/events${q}`);
        return data.items.map((e)=>toK8sEvent(e, namespace));
    }
    async getPodLogs(namespace, podName, container, tailLines) {
        const params = new URLSearchParams();
        if (container) params.set('container', container);
        if (tailLines != null) params.set('tailLines', String(tailLines));
        const qs = params.toString();
        const path = `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log${qs ? `?${qs}` : ''}`;
        return this.getText(path);
    }
}
