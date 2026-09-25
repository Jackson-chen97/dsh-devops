/**
 * Webhook event parsing and message generation for the dsh-devops plugin.
 */

import type { WebhookEvent } from '../../types.ts'

// ─── Internal helpers ────────────────────────────────────────────────────────────

/**
 * Safely read a nested property from an unknown object by dot-path.
 * Returns undefined when any segment in the path is missing or non-object.
 */
function safeGet(obj: unknown, path: string): unknown {
  if (obj == null || typeof obj !== 'object') return undefined
  let current: unknown = obj
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/** Coerce an unknown value to a display string; empty string for null/undefined. */
function str(value: unknown): string {
  return value == null ? '' : String(value)
}

// Known merge-request actions accepted by GitLab
const MR_ACTIONS: ReadonlySet<string> = new Set([
  'open', 'update', 'close', 'merge', 'approval', 'unapproval',
])

// ─── Public API ──────────────────────────────────────────────────────────────────

/**
 * Parse the X-Gitlab-Event header into a WebhookEvent.
 *
 * Returns null for:
 *  - "Merge Request Hook" (deferred — requires payload inspection via
 *    {@link parseMergeRequestEvent})
 *  - Any unknown or missing header
 */
export function parseEvent(header: string | undefined): WebhookEvent | null {
  switch (header) {
    case 'Merge Request Hook':
      // Deferred: the action field lives in the payload, not the header.
      return null
    case 'Pipeline Hook':
      return { type: 'pipeline', action: 'created' }
    case 'Tag Push Hook':
      return { type: 'tag_push' }
    case 'Note Hook':
      return { type: 'note', action: 'create' }
    default:
      return null
  }
}

/**
 * Inspect a Merge Request Hook payload and return the corresponding WebhookEvent.
 *
 * Reads `payload.object_attributes.action` and maps it to one of the known
 * merge-request actions. Returns null when the action is missing or unrecognized.
 */
export function parseMergeRequestEvent(payload: any): WebhookEvent | null {
  if (payload == null || typeof payload !== 'object') return null

  const action = payload.object_attributes?.action
  if (typeof action !== 'string' || !MR_ACTIONS.has(action)) return null

  // Narrow `action` (a string) to the accepted union so the literal type checks.
  const mrAction:
    | 'open' | 'update' | 'close' | 'merge' | 'approval' | 'unapproval'
    = action as 'open' | 'update' | 'close' | 'merge' | 'approval' | 'unapproval'

  return { type: 'merge_request', action: mrAction }
}

/**
 * Generate a human-readable follow-up message for a parsed WebhookEvent.
 *
 * Returns null for "silent" events that should not produce a notification:
 *  - merge_request open / update
 *  - pipeline created / skipped
 */
export function toFollowupMessage(event: WebhookEvent, payload: unknown): string | null {
  switch (event.type) {
    // ── merge_request ──────────────────────────────────────────────────────────
    case 'merge_request': {
      const iid   = str(safeGet(payload, 'object_attributes.iid'))
      const title = str(safeGet(payload, 'object_attributes.title'))
      const target = str(safeGet(payload, 'object_attributes.target_branch'))

      switch (event.action) {
        case 'merge':
          return `✅ MR !${iid} "${title}" 已合并到 ${target}`
        case 'approval':
          return `👍 MR !${iid} 获得审批`
        case 'unapproval':
          return `👎 MR !${iid} 审批被撤回`
        case 'close':
          return `🔒 MR !${iid} "${title}" 已关闭`
        default:
          // open / update — silent
          return null
      }
    }

    // ── pipeline ─────────────────────────────────────────────────────────────
    case 'pipeline': {
      const id     = str(safeGet(payload, 'object_attributes.id'))
      const ref    = str(safeGet(payload, 'object_attributes.ref'))
      const webUrl = str(safeGet(payload, 'object_attributes.web_url'))

      switch (event.action) {
        case 'success':
          return `✅ Pipeline #${id} 在 ${ref} 成功`
        case 'failed':
          return `⚠️ Pipeline #${id} 在 ${ref} 失败! ${webUrl}`
        case 'canceled':
          return `🚫 Pipeline #${id} 被取消`
        default:
          // created / skipped — silent
          return null
      }
    }

    // ── tag_push ───────────────────────────────────────────────────────────────
    case 'tag_push': {
      const ref = str(safeGet(payload, 'ref'))
      return `🏷️ 新 Tag: ${ref}`
    }

    // ── note ───────────────────────────────────────────────────────────────────
    case 'note': {
      // Prefer merge_request.iid (standard MR-note payload),
      // fall back to object_attributes.merge_request_id.
      const mrId =
        str(safeGet(payload, 'merge_request.iid')) ||
        str(safeGet(payload, 'object_attributes.merge_request_id'))

      const note = str(safeGet(payload, 'object_attributes.note'))
      const truncated = note.length > 200 ? `${note.slice(0, 200)}…` : note

      return `💬 MR !${mrId} 新评论: ${truncated}`
    }
  }
}

/**
 * Normalise the X-Gitlab-Event header value into a short event-type name
 * suitable for matching against `config.quietEvents`.
 *
 * Known mappings:
 *   "Merge Request Hook" → "merge_request"
 *   "Pipeline Hook"      → "pipeline"
 *   "Tag Push Hook"      → "tag_push"
 *   "Note Hook"          → "note"
 *   "Push Hook"          → "push"
 *   "Issue Hook"         → "issue"
 *
 * Unknown headers are normalised by lowercasing, stripping the trailing
 * " hook", and replacing spaces with underscores.
 */
export function getEventType(header: string | undefined): string {
  if (!header) return 'unknown'

  const known: Record<string, string> = {
    'Merge Request Hook': 'merge_request',
    'Pipeline Hook':      'pipeline',
    'Tag Push Hook':      'tag_push',
    'Note Hook':          'note',
    'Push Hook':          'push',
    'Issue Hook':         'issue',
  }

  if (known[header] !== undefined) return known[header]

  // Fallback normalisation for unlisted event types
  return header
    .toLowerCase()
    .replace(/\s*hook\s*$/, '')
    .replace(/\s+/g, '_')
}
