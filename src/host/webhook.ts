/**
 * Webhook registration for the dsh-devops plugin.
 *
 * Exposes {@link registerWebhook} which wires a GitLab webhook handler into
 * the DSH context. The module is defensive: if the DSH context lacks both
 * `ctx.webhook` and `ctx.http` registration APIs it logs a warning and
 * returns without crashing.
 */

import type { WebhookConfig } from '../config.ts'
import {
  parseEvent,
  parseMergeRequestEvent,
  toFollowupMessage,
  getEventType,
} from '../core/webhook/handler.ts'

// ─── DshContext ──────────────────────────────────────────────────────────────────

/**
 * Minimal DSH context shape required by the webhook module.
 * The real DSH context is wider; this interface captures only what
 * registerWebhook and the request handler need.
 */
export interface DshContext {
  /**
   * Register a lifecycle effect. The `execute` callback runs on registration;
   * it may return a cleanup function that is called on session teardown.
   */
  effect(execute: () => any, label?: string): any
  /** Send a follow-up message to the user (optional in minimal contexts). */
  followup?(message: string): void
  /** Structured logger (optional). */
  log?: {
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }
  /** Preferred webhook registration API (handles secret verification internally). */
  webhook?: {
    register(opts: { path: string; method: string; secret: string }): {
      onEvent(handler: (req: any, res: any) => void): void
    }
  }
  /** Fallback HTTP registration API (no built-in secret verification). */
  http?: {
    register(opts: { path: string; method: string }): {
      onEvent(handler: (req: any, res: any) => void): void
    }
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────────

/**
 * Read a header value from an untyped req object, trying both the original
 * case and the lower-case form (Node.js normalises to lower-case, but some
 * frameworks preserve the original case).
 */
function getHeader(req: any, name: string): string | undefined {
  const headers: Record<string, unknown> = req?.headers ?? {}
  if (headers[name] != null) return String(headers[name])
  const lower = name.toLowerCase()
  if (headers[lower] != null) return String(headers[lower])
  return undefined
}

/**
 * Attempt to parse the request body as JSON.
 * Handles both pre-parsed objects (some frameworks) and raw strings.
 */
function parseBody(req: any): unknown {
  const body = req?.body
  if (body == null) return {}
  if (typeof body === 'object') return body
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Check whether the incoming request passes the project-path filter.
 * Returns true when the filter is not configured or the project matches.
 */
function matchesProjectFilter(payload: unknown, projectPaths: string[] | undefined): boolean {
  if (!projectPaths || projectPaths.length === 0) return true

  const p = payload as Record<string, any>
  const projectPath: string =
    p?.project?.path_with_namespace ??
    p?.project?.path ??
    ''

  if (!projectPath) return true // no project info — allow through

  return projectPaths.some(
    (pp) => projectPath === pp || projectPath.endsWith(`/${pp}`),
  )
}

/**
 * Core webhook request handler shared by both registration paths.
 * Called for every incoming webhook POST after the framework has dispatched it.
 */
function handleWebhookRequest(
  req: any,
  res: any,
  ctx: DshContext,
  config: WebhookConfig,
): void {
  try {
    // ── 1. Verify secret ───────────────────────────────────────────────────────
    // When using ctx.webhook (which takes a `secret` in register()), the
    // framework may already have verified the token. We still check defensively
    // in case ctx.http is used (no built-in verification).
    const token = getHeader(req, 'X-Gitlab-Token') ?? ''
    if (token !== config.secret) {
      res.writeHead?.(401, { 'Content-Type': 'application/json' })
      res.end?.(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    // ── 2. Parse event type from header ────────────────────────────────────────
    const rawEventHeader = getHeader(req, 'X-Gitlab-Event')
    const eventTypeName = getEventType(rawEventHeader)

    // ── 3. Check quiet events ──────────────────────────────────────────────────
    if (config.quietEvents?.includes(eventTypeName)) {
      res.writeHead?.(200)
      res.end?.()
      return
    }

    // ── 4. Parse body ─────────────────────────────────────────────────────────
    const payload = parseBody(req)

    // ── 5. Check project filter ────────────────────────────────────────────────
    if (!matchesProjectFilter(payload, config.projectPaths)) {
      res.writeHead?.(200)
      res.end?.()
      return
    }

    // ── 6. Determine the WebhookEvent ──────────────────────────────────────────
    // Non-MR events are fully determined by the header.
    // MR events require payload inspection.
    let event = parseEvent(rawEventHeader)

    if (rawEventHeader === 'Merge Request Hook') {
      event = parseMergeRequestEvent(payload as any)
    }

    if (event == null) {
      // Unknown or non-actionable event — acknowledge and stop.
      res.writeHead?.(200)
      res.end?.()
      return
    }

    // ── 7. Generate follow-up message ──────────────────────────────────────────
    const message = toFollowupMessage(event, payload)
    if (message != null) {
      ctx.followup?.(`[GitLab] ${message}`)
    }

    res.writeHead?.(200)
    res.end?.()
  } catch (err) {
    console.error('[dsh-devops:webhook] Error handling webhook request', err)
    res.writeHead?.(500)
    res.end?.()
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────────

/**
 * Register the GitLab webhook handler on the DSH context.
 *
 * Registration strategy (first match wins):
 *  1. `ctx.webhook.register()`  — preferred; passes the secret so the
 *     framework can verify it before invoking the handler.
 *  2. `ctx.http.register()`     — fallback; the handler performs its own
 *     secret check on every request.
 *  3. Neither available         — logs a warning and returns silently.
 *
 * The handler:
 *  - Verifies `X-Gitlab-Token` matches `config.secret` (401 on mismatch)
 *  - Normalises `X-Gitlab-Event` into an event type name
 *  - Silently drops events listed in `config.quietEvents`
 *  - Filters by `config.projectPaths` when set
 *  - Generates a follow-up message via `toFollowupMessage` and calls
 *    `ctx.followup` with a `[GitLab]`-prefixed string
 *
 * Lifecycle: registration is wrapped in `ctx.effect` so the DSH session
 * teardown can cancel the endpoint if needed.
 */
export function registerWebhook(ctx: DshContext, config: WebhookConfig): void {
  const WEBHOOK_PATH = '/gitlab-webhook'

  ctx.effect(() => {
    // ── Strategy 1: ctx.webhook (preferred) ─────────────────────────────────
    if (ctx.webhook?.register) {
      const endpoint = ctx.webhook.register({
        path: WEBHOOK_PATH,
        method: 'POST',
        secret: config.secret,
      })

      endpoint.onEvent((req: any, res: any) => {
        handleWebhookRequest(req, res, ctx, config)
      })

      console.warn(`[dsh-devops:webhook] Registered webhook via ctx.webhook at ${WEBHOOK_PATH}`)
      return
    }

    // ── Strategy 2: ctx.http (fallback) ──────────────────────────────────────
    if (ctx.http?.register) {
      const endpoint = ctx.http.register({
        path: WEBHOOK_PATH,
        method: 'POST',
      })

      endpoint.onEvent((req: any, res: any) => {
        handleWebhookRequest(req, res, ctx, config)
      })

      console.warn(`[dsh-devops:webhook] Registered webhook via ctx.http fallback at ${WEBHOOK_PATH}`)
      return
    }

    // ── Strategy 3: neither available ────────────────────────────────────────
    console.warn(
      '[dsh-devops:webhook] Neither ctx.webhook nor ctx.http is available; ' +
        'skipping webhook registration. Webhook notifications will not work.',
    )
  }, 'webhook-register')
}
