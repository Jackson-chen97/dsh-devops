/**
 * Theme detection and self-owned theme variables for the DevOps console.
 *
 * The DSH host exposes no theme API and does not define light values for the
 * `--ds-alias-*` CSS variables, so the console owns a small `--dsh-devops-*`
 * variable layer: a dark palette (the default `:root` block) and a
 * self-contained light palette keyed on `:root[data-dsh-devops-theme="light"]`.
 * The light block intentionally never references `--ds-alias-*` — a host that
 * only ever defines the dark values must not leak them into light mode.
 *
 * The active theme is detected in priority order:
 *   1. explicit DOM markers — a `data-theme` or `data-ds-theme-source`
 *      attribute (exact `light`/`dark`; anything else, e.g. `system`, is no
 *      signal), an exact `light`/`dark` class token,
 *      `<meta name="color-scheme">`, or the cascaded / inline `color-scheme`
 *      declaration on `<html>`;
 *   2. luminance of the host's computed `--ds-alias-surface` /
 *      `--ds-alias-foreground` values;
 *   3. the system `prefers-color-scheme` media query.
 *
 * `initDevopsTheme()` injects the CSS once, writes the detected theme to the
 * `data-dsh-devops-theme` attribute on `<html>`, and re-detects live via a
 * MutationObserver plus a matchMedia change listener. Every color the console
 * renders resolves through `var(--dsh-devops-*)`, so flipping the attribute
 * re-themes CSS and inline styles alike — no React re-render is needed.
 */

export type DevopsTheme = 'light' | 'dark'

export const THEME_ATTR = 'data-dsh-devops-theme'

export const THEME_CSS = `
:root {
  --dsh-devops-border: var(--ds-alias-border, #2a2a2a);
  --dsh-devops-fg: var(--ds-alias-foreground, #eee);
  --dsh-devops-fg-2: #ccc;
  --dsh-devops-fg-3: #888;
  --dsh-devops-fg-4: #666;
  --dsh-devops-surface: var(--ds-alias-surface, #141414);
  --dsh-devops-surface-inset: var(--ds-alias-surface-inset, #1a1a1a);
  --dsh-devops-input-bg: var(--ds-alias-input-bg, #1a1a1a);
  --dsh-devops-primary: var(--ds-alias-primary, #4a9eff);
  --dsh-devops-hover: rgba(255, 255, 255, 0.05);
  --dsh-devops-overlay: rgba(0, 0, 0, 0.55);
  --dsh-devops-ok: #34c759;
  --dsh-devops-warn: #fbbf24;
  --dsh-devops-err: #ff8a80;
  --dsh-devops-err-strong: #ff453a;
  --dsh-devops-accent: #5aa8ff;
  --dsh-devops-log-bg: #0d0d0d;
  --dsh-devops-log-info: #8f8;
  --dsh-devops-log-warn: #fbbf24;
  --dsh-devops-log-err: #ff453a;
  --dsh-devops-log-match: rgba(255, 193, 7, 0.28);
}
:root[data-dsh-devops-theme="light"] {
  --dsh-devops-border: #d9d9d9;
  --dsh-devops-fg: #1f1f1f;
  --dsh-devops-fg-2: #444;
  --dsh-devops-fg-3: #666;
  --dsh-devops-fg-4: #999;
  --dsh-devops-surface: #ffffff;
  --dsh-devops-surface-inset: #f5f5f5;
  --dsh-devops-input-bg: #ffffff;
  --dsh-devops-primary: #0a84ff;
  --dsh-devops-hover: rgba(0, 0, 0, 0.05);
  --dsh-devops-overlay: rgba(0, 0, 0, 0.4);
  --dsh-devops-ok: #1a7f37;
  --dsh-devops-warn: #b45309;
  --dsh-devops-err: #d93025;
  --dsh-devops-err-strong: #d93025;
  --dsh-devops-accent: #0a63c9;
  --dsh-devops-log-bg: #f6f8fa;
  --dsh-devops-log-info: #1a7f37;
  --dsh-devops-log-warn: #b45309;
  --dsh-devops-log-err: #d93025;
  --dsh-devops-log-match: rgba(255, 193, 7, 0.55);
}
`

/**
 * Parse a CSS color (`#rgb`/`#rrggbb`, `rgb()`/`rgba()`) to 0..1 relative
 * luminance (BT.709 weights); null for anything unparseable (var references,
 * named colors, empty strings).
 */
export function colorLuminance(value: string): number | null {
  const v = (value ?? '').trim().toLowerCase()
  if (!v) return null
  let r = 0
  let g = 0
  let b = 0
  if (v.startsWith('#')) {
    let hex = v.slice(1)
    if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c)
    if (!/^[0-9a-f]{6}$/.test(hex)) return null
    r = parseInt(hex.slice(0, 2), 16)
    g = parseInt(hex.slice(2, 4), 16)
    b = parseInt(hex.slice(4, 6), 16)
  } else {
    const m = /^rgba?\(([^)]*)\)$/.exec(v)
    if (!m) return null
    const parts = (m[1] ?? '')
      .split(/[\s,/]+/)
      .filter((p) => p !== '')
      .map(Number)
    if (parts.length < 3) return null
    const nr = Number(parts[0])
    const ng = Number(parts[1])
    const nb = Number(parts[2])
    if ([nr, ng, nb].some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
    ;[r, g, b] = [nr, ng, nb]
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** DOM markers the host (or a regression harness) may set on <html>/<body>. */
function domSignal(): DevopsTheme | null {
  if (typeof document === 'undefined') return null
  const roots: (HTMLElement | null)[] = [document.documentElement, document.body]
  for (const attr of ['data-theme', 'data-ds-theme-source']) {
    for (const el of roots) {
      const t = el?.getAttribute(attr)?.toLowerCase()
      if (t === 'light' || t === 'dark') return t
    }
  }
  for (const el of roots) {
    if (el?.classList.contains('light')) return 'light'
    if (el?.classList.contains('dark')) return 'dark'
  }
  const meta = document.querySelector('meta[name="color-scheme"]')
  if (meta) {
    const c = meta.getAttribute('content')?.toLowerCase() ?? ''
    if (c.includes('light') && !c.includes('dark')) return 'light'
    if (c.includes('dark') && !c.includes('light')) return 'dark'
  }
  // The host also declares the scheme in CSS (an inline
  // `style="color-scheme: light"` or a `:root { color-scheme: ... }` rule);
  // the cascaded value wins, with the raw inline value as fallback.
  const colorScheme = (
    getComputedStyle(document.documentElement).getPropertyValue('color-scheme') ||
    document.documentElement.style.getPropertyValue('color-scheme') ||
    ''
  ).trim().toLowerCase()
  if (colorScheme === 'light' || colorScheme === 'dark') return colorScheme
  return null
}

/** Luminance of the host's own alias variables, when they resolve to colors. */
function hostAliasSignal(): DevopsTheme | null {
  if (typeof document === 'undefined') return null
  const style = getComputedStyle(document.documentElement)
  for (const name of ['--ds-alias-surface', '--ds-alias-foreground']) {
    const lum = colorLuminance(style.getPropertyValue(name))
    if (lum !== null) return lum > 0.5 ? 'light' : 'dark'
  }
  return null
}

function systemSignal(): DevopsTheme {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
  } catch {
    // fall through to the dark default
  }
  return 'dark'
}

/** Detection chain: DOM markers → host alias luminance → system setting. */
export function detectTheme(): DevopsTheme {
  return domSignal() ?? hostAliasSignal() ?? systemSignal()
}

let initialized = false

/**
 * Inject the theme stylesheet, apply the detected theme, and keep
 * `data-dsh-devops-theme` in sync with later host/theme changes. Idempotent;
 * safe to call from a non-DOM environment (no-op).
 */
export function initDevopsTheme(): void {
  if (typeof document === 'undefined' || initialized) return
  initialized = true

  // Plain (non-module) string CSS: no lightningcss scope or hashing, so it can
  // be injected verbatim at runtime.
  const head = document.head
  if (head) {
    const tag = document.createElement('style')
    tag.setAttribute('data-dsh-devops-theme-css', '1')
    tag.textContent = THEME_CSS
    const stale = head.querySelector('style[data-dsh-devops-theme-css="1"]')
    if (stale) stale.replaceWith(tag)
    else head.appendChild(tag)
  }

  const applyTheme = (): void => {
    const theme = detectTheme()
    const root = document.documentElement
    if (root.getAttribute(THEME_ATTR) !== theme) root.setAttribute(THEME_ATTR, theme)
  }
  applyTheme()

  try {
    const observer = new MutationObserver(applyTheme)
    observer.observe(document.documentElement, { attributes: true })
    if (document.body) observer.observe(document.body, { attributes: true })
  } catch {
    // No MutationObserver (odd environment) — the one-shot detection above
    // already ran.
  }

  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
    }
  } catch {
    // matchMedia unsupported — DOM/alias detection still applies.
  }
}
