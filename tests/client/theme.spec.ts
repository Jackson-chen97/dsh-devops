// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { colorLuminance, detectTheme } from '../../src/client/theme.ts'

const THEME_ATTR = 'data-dsh-devops-theme'
const STALE_CSS_ATTR = 'data-dsh-devops-theme-css'

/** Let queued MutationObserver callbacks run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('colorLuminance', () => {
  it('parses 3-digit and 6-digit hex', () => {
    expect(colorLuminance('#fff')).toBeCloseTo(1, 6)
    expect(colorLuminance('#000')).toBe(0)
    expect(colorLuminance('#ff0000')).toBeCloseTo(0.2126, 10)
    expect(colorLuminance('#141414')).toBeCloseTo(20 / 255, 6)
    const abc = colorLuminance('#ABC')
    const aabbcc = colorLuminance('#aabbcc')
    expect(abc).not.toBeNull()
    expect(aabbcc).not.toBeNull()
    expect(abc).toBeCloseTo(aabbcc as number, 10)
  })

  it('parses rgb()/rgba(), ignoring alpha', () => {
    expect(colorLuminance('rgb(30, 30, 30)')).toBeCloseTo(30 / 255, 6)
    expect(colorLuminance('rgba(255, 255, 255, 0.9)')).toBeCloseTo(1, 6)
    expect(colorLuminance('RGB( 0, 0, 0 )')).toBe(0)
    expect(colorLuminance('rgb(128,128,128)')).toBeCloseTo(128 / 255, 6)
  })

  it('returns null for unparseable values', () => {
    expect(colorLuminance('')).toBeNull()
    expect(colorLuminance('   ')).toBeNull()
    expect(colorLuminance('var(--x)')).toBeNull()
    expect(colorLuminance('rebeccapurple')).toBeNull()
    expect(colorLuminance('#12345')).toBeNull()
    expect(colorLuminance('#zzzzzz')).toBeNull()
    expect(colorLuminance('rgb(30, 30)')).toBeNull()
    expect(colorLuminance('rgb(300, 0, 0)')).toBeNull()
    expect(colorLuminance('rgb(-1, 0, 0)')).toBeNull()
  })
})

describe('detectTheme', () => {
  const de = document.documentElement

  function clearMarkers(): void {
    de.removeAttribute('data-theme')
    de.removeAttribute('data-ds-theme-source')
    de.removeAttribute(THEME_ATTR)
    de.classList.remove('light', 'dark')
    de.style.removeProperty('color-scheme')
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-ds-theme-source')
    document.body.classList.remove('light', 'dark')
    document.head
      .querySelectorAll('meta[name="color-scheme"]')
      .forEach((m) => m.remove())
    de.style.removeProperty('--ds-alias-surface')
    de.style.removeProperty('--ds-alias-foreground')
  }

  function stubSystem(dark: boolean): void {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: dark,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
  }

  beforeEach(() => {
    clearMarkers()
    stubSystem(false)
  })

  afterEach(() => {
    clearMarkers()
    vi.unstubAllGlobals()
  })

  it('data-theme on <html> beats the host alias luminance', () => {
    de.setAttribute('data-theme', 'light')
    de.style.setProperty('--ds-alias-surface', '#141414')
    expect(detectTheme()).toBe('light')
  })

  it('data-theme on <body> is read too', () => {
    document.body.setAttribute('data-theme', 'dark')
    expect(detectTheme()).toBe('dark')
  })

  it('treats data-theme="system" as no signal and falls through', () => {
    de.setAttribute('data-theme', 'system')
    stubSystem(true)
    expect(detectTheme()).toBe('dark')
  })

  it('reads exact light/dark class tokens', () => {
    de.classList.add('light')
    expect(detectTheme()).toBe('light')
    de.classList.remove('light')
    document.body.classList.add('dark')
    expect(detectTheme()).toBe('dark')
  })

  it('reads meta[name=color-scheme] when unambiguous', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'color-scheme')
    meta.setAttribute('content', 'light')
    document.head.appendChild(meta)
    expect(detectTheme()).toBe('light')
    meta.setAttribute('content', 'dark')
    expect(detectTheme()).toBe('dark')
    // Ambiguous "light dark" is no signal → system fallback.
    meta.setAttribute('content', 'light dark')
    stubSystem(true)
    expect(detectTheme()).toBe('dark')
  })

  it('reads the host data-ds-theme-source attribute (beats alias luminance)', () => {
    de.setAttribute('data-ds-theme-source', 'light')
    de.style.setProperty('--ds-alias-surface', '#141414')
    expect(detectTheme()).toBe('light')
    de.setAttribute('data-ds-theme-source', 'dark')
    expect(detectTheme()).toBe('dark')
  })

  it('treats data-ds-theme-source="system" as no signal and falls through', () => {
    de.setAttribute('data-ds-theme-source', 'system')
    stubSystem(true)
    expect(detectTheme()).toBe('dark')
  })

  it('reads the cascaded/inline color-scheme on <html>', () => {
    de.style.setProperty('--ds-alias-surface', '#141414')
    de.style.setProperty('color-scheme', 'light')
    expect(detectTheme()).toBe('light')
    de.style.setProperty('color-scheme', 'dark')
    expect(detectTheme()).toBe('dark')
    // "normal" (the initial value) is no signal → system fallback.
    de.style.setProperty('color-scheme', 'normal')
    stubSystem(true)
    expect(detectTheme()).toBe('dark')
  })

  it('falls back to the host alias surface/foreground luminance', () => {
    de.style.setProperty('--ds-alias-surface', '#ffffff')
    expect(detectTheme()).toBe('light')
    de.style.setProperty('--ds-alias-surface', '#141414')
    expect(detectTheme()).toBe('dark')
    // Surface absent → foreground is the second key.
    de.style.removeProperty('--ds-alias-surface')
    de.style.setProperty('--ds-alias-foreground', '#ffffff')
    expect(detectTheme()).toBe('light')
  })

  it('falls back to the system preference when nothing else resolves', () => {
    stubSystem(true)
    expect(detectTheme()).toBe('dark')
    stubSystem(false)
    expect(detectTheme()).toBe('light')
  })
})

describe('initDevopsTheme', () => {
  function clearInjections(): void {
    document.head
      .querySelectorAll(`style[${STALE_CSS_ATTR}="1"]`)
      .forEach((s) => s.remove())
    document.documentElement.removeAttribute(THEME_ATTR)
  }

  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-ds-theme-source')
    document.documentElement.style.removeProperty('color-scheme')
    document.body.removeAttribute('data-theme')
    clearInjections()
  })

  afterEach(() => {
    clearInjections()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('injects the stylesheet exactly once (idempotent) and applies the theme', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const { initDevopsTheme, THEME_CSS } = await import('../../src/client/theme.ts')
    initDevopsTheme()
    initDevopsTheme()
    const tags = document.head.querySelectorAll('style[data-dsh-devops-theme-css="1"]')
    expect(tags).toHaveLength(1)
    expect(tags.item(0)?.textContent).toBe(THEME_CSS)
    expect(document.documentElement.getAttribute(THEME_ATTR)).toBe('dark')
  })

  it('replaces a stale injected stylesheet', async () => {
    const pre = document.createElement('style')
    pre.setAttribute(STALE_CSS_ATTR, '1')
    pre.textContent = 'stale'
    document.head.appendChild(pre)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const { initDevopsTheme, THEME_CSS } = await import('../../src/client/theme.ts')
    initDevopsTheme()
    const tags = document.head.querySelectorAll('style[data-dsh-devops-theme-css="1"]')
    expect(tags).toHaveLength(1)
    expect(tags.item(0)?.textContent).toBe(THEME_CSS)
  })

  it('re-detects when the host flips its theme markers (MutationObserver)', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const { initDevopsTheme } = await import('../../src/client/theme.ts')
    initDevopsTheme()
    const root = document.documentElement
    expect(root.getAttribute(THEME_ATTR)).toBe('light')

    root.setAttribute('data-theme', 'dark')
    await flush()
    expect(root.getAttribute(THEME_ATTR)).toBe('dark')

    root.removeAttribute('data-theme')
    document.body.setAttribute('data-theme', 'light')
    await flush()
    expect(root.getAttribute(THEME_ATTR)).toBe('light')

    // The host's own marker: flipping data-ds-theme-source re-detects too.
    document.body.removeAttribute('data-theme')
    root.setAttribute('data-ds-theme-source', 'dark')
    await flush()
    expect(root.getAttribute(THEME_ATTR)).toBe('dark')
  })

  it('re-detects when the system preference changes (matchMedia change)', async () => {
    let dark = true
    const changeListeners: EventListener[] = []
    vi.stubGlobal(
      'matchMedia',
      vi.fn((media: string) => ({
        matches: dark,
        media,
        onchange: null,
        addEventListener: (type: string, cb: EventListener) => {
          if (type === 'change') changeListeners.push(cb)
        },
        removeEventListener: vi.fn(),
      })),
    )
    const { initDevopsTheme } = await import('../../src/client/theme.ts')
    initDevopsTheme()
    expect(document.documentElement.getAttribute(THEME_ATTR)).toBe('dark')
    expect(changeListeners.length).toBeGreaterThan(0)

    dark = false
    changeListeners.forEach((cb) => cb(new Event('change')))
    expect(document.documentElement.getAttribute(THEME_ATTR)).toBe('light')
  })
})
