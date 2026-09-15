const lastFired = new Map();
export function throttled(key, cooldownSec) {
    const now = Date.now();
    const last = lastFired.get(key);
    if (last !== undefined && now - last < cooldownSec * 1000) {
        return true;
    }
    lastFired.set(key, now);
    return false;
}
export function clearThrottle() {
    lastFired.clear();
}
