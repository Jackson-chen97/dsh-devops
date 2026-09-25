/**
 * Alert throttling — suppresses duplicate alerts within a cooldown window.
 */

const lastFired = new Map<string, number>()

/**
 * Returns true if the alert for `key` should be suppressed (within cooldown).
 * Records the fire time if it should not be suppressed.
 */
export function throttled(key: string, cooldownSec: number): boolean {
  const now = Date.now()
  const last = lastFired.get(key)
  if (last !== undefined && now - last < cooldownSec * 1000) {
    return true
  }
  lastFired.set(key, now)
  return false
}

/**
 * Clears all throttle entries. Called on plugin unload.
 */
export function clearThrottle(): void {
  lastFired.clear()
}
