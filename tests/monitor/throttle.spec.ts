import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { throttled, clearThrottle } from '../../src/monitor/throttle.js'

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    clearThrottle()
  })

  afterEach(() => {
    clearThrottle()
    vi.useRealTimers()
  })

  it('first call for a key should return false (not throttled)', () => {
    expect(throttled('key-a', 60)).toBe(false)
  })

  it('second call for the same key within cooldown should return true (throttled)', () => {
    expect(throttled('key-a', 60)).toBe(false)
    // 30 seconds later — still within the 60s cooldown
    vi.setSystemTime(new Date('2026-01-01T00:00:30.000Z'))
    expect(throttled('key-a', 60)).toBe(true)
  })

  it('call after cooldown expiry should return false again', () => {
    expect(throttled('key-a', 60)).toBe(false)
    vi.setSystemTime(new Date('2026-01-01T00:01:01.000Z'))
    expect(throttled('key-a', 60)).toBe(false)
  })

  it('different keys should not interfere', () => {
    expect(throttled('key-a', 60)).toBe(false) // registers key-a at time 0
    // key-b has NOT been registered yet
    vi.setSystemTime(new Date('2026-01-01T00:00:30.000Z'))
    expect(throttled('key-a', 60)).toBe(true) // key-a still in cooldown
    expect(throttled('key-b', 60)).toBe(false) // key-b is new, not throttled
  })

  it('clearThrottle should reset all keys', () => {
    expect(throttled('key-a', 60)).toBe(false)
    expect(throttled('key-b', 60)).toBe(false)
    // without clearing, both would be throttled within the cooldown
    clearThrottle()
    vi.setSystemTime(new Date('2026-01-01T00:00:30.000Z'))
    expect(throttled('key-a', 60)).toBe(false)
    expect(throttled('key-b', 60)).toBe(false)
  })
})
