import { describe, it, expect } from 'vitest'
import {
  parseEvent,
  parseMergeRequestEvent,
  getEventType,
  toFollowupMessage,
} from '../../src/core/webhook/handler.ts'
import type { WebhookEvent } from '../../src/types.js'

describe('parseEvent', () => {
  it('returns null for "Merge Request Hook"', () => {
    expect(parseEvent('Merge Request Hook')).toBeNull()
  })

  it('returns {type: pipeline, action: created} for "Pipeline Hook"', () => {
    expect(parseEvent('Pipeline Hook')).toEqual({ type: 'pipeline', action: 'created' })
  })

  it('returns {type: tag_push} for "Tag Push Hook"', () => {
    expect(parseEvent('Tag Push Hook')).toEqual({ type: 'tag_push' })
  })

  it('returns {type: note, action: create} for "Note Hook"', () => {
    expect(parseEvent('Note Hook')).toEqual({ type: 'note', action: 'create' })
  })

  it('returns null for undefined', () => {
    expect(parseEvent(undefined)).toBeNull()
  })

  it('returns null for unknown headers', () => {
    expect(parseEvent('Push Hook')).toBeNull()
    expect(parseEvent('Something Else Hook')).toBeNull()
    expect(parseEvent('')).toBeNull()
  })
})

describe('parseMergeRequestEvent', () => {
  it('returns null for null payload', () => {
    expect(parseMergeRequestEvent(null)).toBeNull()
  })

  it('returns null for payload with no action', () => {
    expect(parseMergeRequestEvent({})).toBeNull()
    expect(parseMergeRequestEvent({ object_attributes: { iid: 1 } })).toBeNull()
  })

  it('returns {type: merge_request, action: merge} for valid merge payload', () => {
    const payload = {
      object_attributes: { action: 'merge', iid: 42, title: 'Fix bug' },
    }
    expect(parseMergeRequestEvent(payload)).toEqual({
      type: 'merge_request',
      action: 'merge',
    })
  })

  it('returns null for unknown action', () => {
    expect(
      parseMergeRequestEvent({ object_attributes: { action: 'explode' } }),
    ).toBeNull()
  })
})

describe('getEventType', () => {
  it('maps "Merge Request Hook" to "merge_request"', () => {
    expect(getEventType('Merge Request Hook')).toBe('merge_request')
  })

  it('maps "Pipeline Hook" to "pipeline"', () => {
    expect(getEventType('Pipeline Hook')).toBe('pipeline')
  })

  it('maps "Tag Push Hook" to "tag_push"', () => {
    expect(getEventType('Tag Push Hook')).toBe('tag_push')
  })

  it('maps "Note Hook" to "note"', () => {
    expect(getEventType('Note Hook')).toBe('note')
  })

  it('returns "unknown" for undefined', () => {
    expect(getEventType(undefined)).toBe('unknown')
  })
})

describe('toFollowupMessage', () => {
  it('returns message with "已合并" for merge action', () => {
    const event: WebhookEvent = { type: 'merge_request', action: 'merge' }
    const payload = {
      object_attributes: { iid: 42, title: 'Fix bug', target_branch: 'main' },
    }
    const msg = toFollowupMessage(event, payload)
    expect(msg).not.toBeNull()
    expect(msg).toContain('已合并')
    expect(msg).toContain('!42')
    expect(msg).toContain('Fix bug')
    expect(msg).toContain('main')
  })

  it('returns null for "open" action', () => {
    const event: WebhookEvent = { type: 'merge_request', action: 'open' }
    const payload = { object_attributes: { iid: 1, title: 'New MR', target_branch: 'main' } }
    expect(toFollowupMessage(event, payload)).toBeNull()
  })

  it('returns message with "获得审批" for approval action', () => {
    const event: WebhookEvent = { type: 'merge_request', action: 'approval' }
    const payload = { object_attributes: { iid: 7, title: 'Feature' } }
    const msg = toFollowupMessage(event, payload)
    expect(msg).not.toBeNull()
    expect(msg).toContain('获得审批')
    expect(msg).toContain('!7')
  })

  it('returns null for pipeline "created" action', () => {
    const event: WebhookEvent = { type: 'pipeline', action: 'created' }
    const payload = {
      object_attributes: { id: 99, ref: 'main', web_url: 'https://gitlab.example.com/pipelines/99' },
    }
    expect(toFollowupMessage(event, payload)).toBeNull()
  })
})
