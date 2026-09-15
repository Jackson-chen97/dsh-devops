import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
export function expandPath(p) {
    if (p === '~') return homedir();
    if (p.startsWith('~/') || p.startsWith('~\\')) {
        return join(homedir(), p.slice(2));
    }
    return p;
}
export function parseKubeconfig(filePath, contextName) {
    const expanded = expandPath(filePath);
    let raw;
    try {
        raw = readFileSync(expanded, 'utf8');
    } catch (err) {
        throw new Error(`[k8s] cannot read kubeconfig file at "${expanded}": ${err.message}`);
    }
    let doc;
    try {
        doc = parse(raw);
    } catch (err) {
        throw new Error(`[k8s] failed to parse YAML in kubeconfig "${expanded}": ${err.message}`);
    }
    if (!doc || typeof doc !== 'object') {
        throw new Error(`[k8s] kubeconfig "${expanded}" did not parse to a mapping`);
    }
    const clusters = doc.clusters ?? [];
    const users = doc.users ?? [];
    const contexts = doc.contexts ?? [];
    const targetName = contextName ?? doc['current-context'];
    if (!targetName) {
        throw new Error(`[k8s] kubeconfig "${expanded}" has no current-context and no context name was provided`);
    }
    const ctx = contexts.find((c)=>c.name === targetName);
    if (!ctx) {
        const available = contexts.map((c)=>c.name).filter(Boolean).join(', ') || 'none';
        throw new Error(`[k8s] context "${targetName}" not found in kubeconfig "${expanded}" (available: ${available})`);
    }
    const inner = ctx.context ?? {};
    const clusterName = inner['cluster'];
    const userRef = inner['user'];
    if (!clusterName) {
        throw new Error(`[k8s] context "${targetName}" does not reference a cluster`);
    }
    if (!userRef) {
        throw new Error(`[k8s] context "${targetName}" does not reference a user`);
    }
    const clusterEntry = clusters.find((c)=>c.name === clusterName);
    if (!clusterEntry) {
        throw new Error(`[k8s] cluster "${clusterName}" (referenced by context "${targetName}") not found in kubeconfig "${expanded}"`);
    }
    const cluster = clusterEntry.cluster ?? {};
    const server = cluster['server'];
    if (!server) {
        throw new Error(`[k8s] cluster "${clusterName}" does not specify a server`);
    }
    const userEntry = users.find((u)=>u.name === userRef);
    if (!userEntry) {
        throw new Error(`[k8s] user "${userRef}" (referenced by context "${targetName}") not found in kubeconfig "${expanded}"`);
    }
    const user = userEntry.user ?? {};
    const token = user['token'] ?? user['auth-provider']?.config?.['access-token'];
    if (!token) {
        throw new Error(`[k8s] user "${userRef}" does not provide a token (looked for "token" and "auth-provider.config.access-token")`);
    }
    return {
        server,
        token,
        caData: cluster['certificate-authority-data'] || undefined,
        insecureSkipTlsVerify: cluster['insecure-skip-tls-verify'] || undefined,
        namespace: inner['namespace'] ?? 'default'
    };
}
