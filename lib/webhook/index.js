import { parseEvent, parseMergeRequestEvent, toFollowupMessage, getEventType } from './handler.js';
function getHeader(req, name) {
    const headers = req?.headers ?? {};
    if (headers[name] != null) return String(headers[name]);
    const lower = name.toLowerCase();
    if (headers[lower] != null) return String(headers[lower]);
    return undefined;
}
function parseBody(req) {
    const body = req?.body;
    if (body == null) return {};
    if (typeof body === 'object') return body;
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch  {
            return {};
        }
    }
    return {};
}
function matchesProjectFilter(payload, projectPaths) {
    if (!projectPaths || projectPaths.length === 0) return true;
    const p = payload;
    const projectPath = p?.project?.path_with_namespace ?? p?.project?.path ?? '';
    if (!projectPath) return true;
    return projectPaths.some((pp)=>projectPath === pp || projectPath.endsWith(`/${pp}`));
}
function handleWebhookRequest(req, res, ctx, config) {
    try {
        const token = getHeader(req, 'X-Gitlab-Token') ?? '';
        if (token !== config.secret) {
            res.writeHead?.(401, {
                'Content-Type': 'application/json'
            });
            res.end?.(JSON.stringify({
                error: 'Unauthorized'
            }));
            return;
        }
        const rawEventHeader = getHeader(req, 'X-Gitlab-Event');
        const eventTypeName = getEventType(rawEventHeader);
        if (config.quietEvents?.includes(eventTypeName)) {
            res.writeHead?.(200);
            res.end?.();
            return;
        }
        const payload = parseBody(req);
        if (!matchesProjectFilter(payload, config.projectPaths)) {
            res.writeHead?.(200);
            res.end?.();
            return;
        }
        let event = parseEvent(rawEventHeader);
        if (rawEventHeader === 'Merge Request Hook') {
            event = parseMergeRequestEvent(payload);
        }
        if (event == null) {
            res.writeHead?.(200);
            res.end?.();
            return;
        }
        const message = toFollowupMessage(event, payload);
        if (message != null) {
            ctx.followup?.(`[GitLab] ${message}`);
        }
        res.writeHead?.(200);
        res.end?.();
    } catch (err) {
        ctx.log?.error('[dsh-devops:webhook] Error handling webhook request', err);
        res.writeHead?.(500);
        res.end?.();
    }
}
export function registerWebhook(ctx, config) {
    const WEBHOOK_PATH = '/gitlab-webhook';
    ctx.effect(()=>{
        if (ctx.webhook?.register) {
            const endpoint = ctx.webhook.register({
                path: WEBHOOK_PATH,
                method: 'POST',
                secret: config.secret
            });
            endpoint.onEvent((req, res)=>{
                handleWebhookRequest(req, res, ctx, config);
            });
            ctx.log?.warn(`[dsh-devops:webhook] Registered webhook via ctx.webhook at ${WEBHOOK_PATH}`);
            return;
        }
        if (ctx.http?.register) {
            const endpoint = ctx.http.register({
                path: WEBHOOK_PATH,
                method: 'POST'
            });
            endpoint.onEvent((req, res)=>{
                handleWebhookRequest(req, res, ctx, config);
            });
            ctx.log?.warn(`[dsh-devops:webhook] Registered webhook via ctx.http fallback at ${WEBHOOK_PATH}`);
            return;
        }
        ctx.log?.warn('[dsh-devops:webhook] Neither ctx.webhook nor ctx.http is available; ' + 'skipping webhook registration. Webhook notifications will not work.');
    }, 'webhook-register');
}
