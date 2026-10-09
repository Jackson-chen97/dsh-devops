// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

const CSS_ATTR = 'data-dsh-devops-theme-css'

function injectedTags(): NodeListOf<HTMLStyleElement> {
  return document.head.querySelectorAll<HTMLStyleElement>(`style[${CSS_ATTR}="1"]`)
}

describe('THEME_CSS', () => {
  it('declares the bridge on body, with a body[data-ds-dark-theme] override block', async () => {
    const { THEME_CSS } = await import('../../src/client/theme.ts')
    expect(THEME_CSS).toMatch(/^\s*body \{/)
    expect(THEME_CSS).toContain('body[data-ds-dark-theme] {')
    // Host tokens are body-declared; a :root bridge could never resolve them.
    expect(THEME_CSS).not.toContain(':root')
  })

  it('bridges the console variables to the host alias tokens', async () => {
    const { THEME_CSS } = await import('../../src/client/theme.ts')
    expect(THEME_CSS).toContain('var(--dsw-alias-border-l3,')
    expect(THEME_CSS).toContain('var(--dsw-alias-label-primary,')
    expect(THEME_CSS).toContain('var(--dsw-alias-bg-layer-3,')
    expect(THEME_CSS).toContain('var(--dsw-alias-brand-primary-new-colorprimary-new-color,')
    expect(THEME_CSS).toContain('var(--dsw-alias-button-primary-fill,')
    expect(THEME_CSS).toContain('var(--dsw-alias-toast-bg,')
    expect(THEME_CSS).toContain('var(--dsw-elevation-prominent,')
    expect(THEME_CSS).toContain('var(--dsw-mask-blur,')
    expect(THEME_CSS).toContain('var(--ds-font-family-code,')
  })

  it('gives every bridged variable a per-theme raw fallback', async () => {
    const { THEME_CSS } = await import('../../src/client/theme.ts')
    const darkIdx = THEME_CSS.indexOf('body[data-ds-dark-theme]')
    expect(darkIdx).toBeGreaterThan(0)
    const blocks = [THEME_CSS.slice(0, darkIdx), THEME_CSS.slice(darkIdx)]
    // Self-owned values with no host token: the toast text is fixed light
    // (the chip is dark in both themes) and the log match highlight has no
    // host counterpart.
    const selfOwned = new Set(['--dsh-devops-toast-fg', '--dsh-devops-log-match'])

    const [lightLines, darkLines] = blocks.map((block) =>
      block.split('\n').filter((l) => /^\s*--dsh-devops-/.test(l)),
    ) as [string[], string[]]
    expect(lightLines.length).toBe(darkLines.length)
    expect(lightLines.length).toBeGreaterThanOrEqual(30)
    for (const lines of [lightLines, darkLines]) {
      for (const line of lines) {
        const name = line.trim().split(':')[0] ?? ''
        if (selfOwned.has(name)) {
          expect(line).toMatch(/:\s*(#[0-9a-f]+|rgba?\()/)
          continue
        }
        // Font scale: base/secondary bridge the host's content font tokens,
        // micro and display steps are delta-linked so a host font-size
        // adjustment scales the console too. Identical in both blocks.
        if (/--dsh-devops-font(-[a-z0-9]+)?$/.test(name)) {
          expect(line).toMatch(
            /:\s*(var\(--dsh-content-font-size(?:-secondary)?, 1[34]px\)|calc\((11|18)px \+ var\(--dsh-content-font-delta, 0px\)\));$/,
          )
          continue
        }
        // `var(<host token>, <fallback>)` — the raw fallback keeps the
        // console styled in token-less environments (jsdom, old hosts).
        expect(line).toMatch(/:\s*var\(--ds[a-z0-9-]*,\s*\S/)
      }
    }
  })
})

describe('initDevopsTheme', () => {
  afterEach(() => {
    document.head
      .querySelectorAll(`style[${CSS_ATTR}="1"]`)
      .forEach((s) => s.remove())
    vi.resetModules()
  })

  it('injects the bridge stylesheet exactly once and writes no theme attribute', async () => {
    const { initDevopsTheme, THEME_CSS } = await import('../../src/client/theme.ts')
    initDevopsTheme()
    initDevopsTheme()
    const tags = injectedTags()
    expect(tags).toHaveLength(1)
    expect(tags.item(0)?.textContent).toBe(THEME_CSS)
    // The host's own body[data-ds-dark-theme] attribute drives the theme —
    // the plugin must not paint its own marker anywhere.
    expect(document.documentElement.hasAttribute('data-dsh-devops-theme')).toBe(false)
    expect(document.body.hasAttribute('data-dsh-devops-theme')).toBe(false)
  })

  it('replaces a stale stylesheet left by an older plugin version', async () => {
    const pre = document.createElement('style')
    pre.setAttribute(CSS_ATTR, '1')
    pre.textContent = 'stale'
    document.head.appendChild(pre)
    const { initDevopsTheme, THEME_CSS } = await import('../../src/client/theme.ts')
    initDevopsTheme()
    const tags = injectedTags()
    expect(tags).toHaveLength(1)
    expect(tags.item(0)?.textContent).toBe(THEME_CSS)
  })
})
