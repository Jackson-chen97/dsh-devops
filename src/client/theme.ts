/**
 * Theme bridge for the DevOps console.
 *
 * The DSH host is a dual-theme design system: it declares `--dsw-alias-*`
 * semantic tokens on `body`, with the dark theme a single attribute away
 * (`body[data-ds-dark-theme]`). The console consumes those tokens through a
 * small `--dsh-devops-*` layer, declared on `body` (never `:root` — the host
 * tokens are body-declared, and `var()` substitution happens at the declaring
 * element, so a `:root` bridge could never see them).
 *
 * Every declaration is `var(<host token>, <fallback>)`: when the host provides
 * the token the console follows its light/dark attribute automatically with no
 * JS detection; when the token is absent (old hosts, jsdom) the per-theme
 * fallback below — the host's own resolved values — keeps the console looking
 * native under the same `body[data-ds-dark-theme]` attribute.
 *
 * `initDevopsTheme()` injects the bridge CSS once (idempotent, replaces a
 * stale tag from a previous plugin version). All colors the console renders
 * resolve through `var(--dsh-devops-*)`, so theme flips re-style CSS and
 * inline styles alike with no React re-render.
 */

export const THEME_CSS = `
body {
  --dsh-devops-border: var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12));
  --dsh-devops-border-l1: var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.04));
  --dsh-devops-border-l2: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  --dsh-devops-border-l4: var(--dsw-alias-border-l4, rgba(0, 0, 0, 0.16));
  --dsh-devops-fg: var(--dsw-alias-label-primary, #0f1115);
  --dsh-devops-fg-2: var(--dsw-alias-label-secondary, #61666b);
  --dsh-devops-fg-3: var(--dsw-alias-label-tertiary, #81858c);
  --dsh-devops-fg-4: var(--dsw-alias-label-dimmed, #e1e5ee);
  --dsh-devops-surface: var(--dsw-alias-bg-layer-3, #ffffff);
  --dsh-devops-surface-inset: var(--dsw-alias-bg-module-platform, #f5f6f7);
  --dsh-devops-input-bg: var(--dsw-alias-bg-layer-1, #ffffff);
  --dsh-devops-layer-2: var(--dsw-alias-bg-layer-2, #ffffff);
  --dsh-devops-primary: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6);
  --dsh-devops-accent: var(--dsw-alias-state-business-primary, #4176e6);
  --dsh-devops-chip-bg: var(--dsw-alias-state-business-tertiary, #e4edfd);
  --dsh-devops-btn: var(--dsw-alias-button-primary-fill, #0f1115);
  --dsh-devops-btn-hover: var(--dsw-alias-button-primary-hover, #43454a);
  --dsh-devops-btn-fg: var(--dsw-alias-label-primary-foreground, #ffffff);
  --dsh-devops-hover: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06));
  --dsh-devops-overlay: var(--dsw-alias-bg-mask-1, rgba(0, 0, 0, 0.24));
  --dsh-devops-ok: var(--dsw-alias-state-success-primary, #22c55e);
  --dsh-devops-warn: var(--dsw-alias-state-warn-primary, #f59e0b);
  --dsh-devops-err: var(--dsw-alias-state-error-secondary, #f25a5a);
  --dsh-devops-err-strong: var(--dsw-alias-state-error-primary, #ec1313);
  --dsh-devops-toast-bg: var(--dsw-alias-toast-bg, #353638);
  --dsh-devops-toast-fg: #f9fafb;
  --dsh-devops-log-bg: var(--dsw-alias-markdown-code-block, #f9fafb);
  --dsh-devops-log-info: var(--dsw-alias-state-success-primary, #22c55e);
  --dsh-devops-log-warn: var(--dsw-alias-state-warn-primary, #f59e0b);
  --dsh-devops-log-err: var(--dsw-alias-state-error-primary, #ec1313);
  --dsh-devops-log-match: rgba(245, 158, 11, 0.45);
  --dsh-devops-mask-blur: var(--dsw-mask-blur, blur(2px));
  --dsh-devops-elevation-panel: var(--dsw-elevation-panel, 0 8px 24px rgba(0, 0, 0, 0.25));
  --dsh-devops-elevation-prominent: var(--dsw-elevation-prominent, 0 16px 48px rgba(0, 0, 0, 0.35));
  --dsh-devops-code-font: var(--ds-font-family-code, 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', Menlo, Courier, 'PingFang SC', 'Microsoft YaHei');
  /* Font scale — base/secondary bridge the host's content font tokens, the
     micro and display steps are delta-linked so a host font-size adjustment
     scales the console too. Theme-independent (same values in both blocks). */
  --dsh-devops-font: var(--dsh-content-font-size, 14px);
  --dsh-devops-font-2: var(--dsh-content-font-size-secondary, 13px);
  --dsh-devops-font-3: calc(11px + var(--dsh-content-font-delta, 0px));
  --dsh-devops-font-xl: calc(18px + var(--dsh-content-font-delta, 0px));
}
body[data-ds-dark-theme] {
  --dsh-devops-border: var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.16));
  --dsh-devops-border-l1: var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.06));
  --dsh-devops-border-l2: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  --dsh-devops-border-l4: var(--dsw-alias-border-l4, rgba(255, 255, 255, 0.2));
  --dsh-devops-fg: var(--dsw-alias-label-primary, #f9fafb);
  --dsh-devops-fg-2: var(--dsw-alias-label-secondary, #cfd3da);
  --dsh-devops-fg-3: var(--dsw-alias-label-tertiary, #adb2b8);
  --dsh-devops-fg-4: var(--dsw-alias-label-dimmed, #43454a);
  --dsh-devops-surface: var(--dsw-alias-bg-layer-3, #353638);
  --dsh-devops-surface-inset: var(--dsw-alias-bg-layer-2, #2c2c2e);
  --dsh-devops-input-bg: var(--dsw-alias-bg-layer-1, #232324);
  --dsh-devops-layer-2: var(--dsw-alias-bg-layer-2, #2c2c2e);
  --dsh-devops-primary: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #5686fe);
  --dsh-devops-accent: var(--dsw-alias-state-business-primary, #679efe);
  --dsh-devops-chip-bg: var(--dsw-alias-state-business-tertiary, #34415b);
  --dsh-devops-btn: var(--dsw-alias-button-primary-fill, #f9fafb);
  --dsh-devops-btn-hover: var(--dsw-alias-button-primary-hover, #ebeef2);
  --dsh-devops-btn-fg: var(--dsw-alias-label-primary-foreground, #0f1115);
  --dsh-devops-hover: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
  --dsh-devops-overlay: var(--dsw-alias-bg-mask-1, rgba(0, 0, 0, 0.5));
  --dsh-devops-ok: var(--dsw-alias-state-success-primary, #22c55e);
  --dsh-devops-warn: var(--dsw-alias-state-warn-primary, #f59e0b);
  --dsh-devops-err: var(--dsw-alias-state-error-secondary, #f25a5a);
  --dsh-devops-err-strong: var(--dsw-alias-state-error-primary, #f25a5a);
  --dsh-devops-toast-bg: var(--dsw-alias-toast-bg, #43454a);
  --dsh-devops-toast-fg: #f9fafb;
  --dsh-devops-log-bg: var(--dsw-alias-markdown-code-block, #1b1b1c);
  --dsh-devops-log-info: var(--dsw-alias-state-success-primary, #22c55e);
  --dsh-devops-log-warn: var(--dsw-alias-state-warn-primary, #f59e0b);
  --dsh-devops-log-err: var(--dsw-alias-state-error-primary, #f25a5a);
  --dsh-devops-log-match: rgba(245, 158, 11, 0.3);
  --dsh-devops-mask-blur: var(--dsw-mask-blur, blur(2px));
  --dsh-devops-elevation-panel: var(--dsw-elevation-panel, 0 8px 24px rgba(0, 0, 0, 0.45));
  --dsh-devops-elevation-prominent: var(--dsw-elevation-prominent, 0 16px 48px rgba(0, 0, 0, 0.55));
  --dsh-devops-code-font: var(--ds-font-family-code, 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', Menlo, Courier, 'PingFang SC', 'Microsoft YaHei');
  --dsh-devops-font: var(--dsh-content-font-size, 14px);
  --dsh-devops-font-2: var(--dsh-content-font-size-secondary, 13px);
  --dsh-devops-font-3: calc(11px + var(--dsh-content-font-delta, 0px));
  --dsh-devops-font-xl: calc(18px + var(--dsh-content-font-delta, 0px));
}
`

let initialized = false

/**
 * Inject the theme bridge stylesheet. Idempotent (replaces a stale tag left
 * by a previous plugin version); safe to call from a non-DOM environment
 * (no-op). The bridge declares plain (non-module) string CSS, so it can be
 * injected verbatim at runtime without hashing or scoping.
 */
export function initDevopsTheme(): void {
  if (typeof document === 'undefined' || initialized) return
  initialized = true

  const head = document.head
  if (!head) return
  const tag = document.createElement('style')
  tag.setAttribute('data-dsh-devops-theme-css', '1')
  tag.textContent = THEME_CSS
  const stale = head.querySelector('style[data-dsh-devops-theme-css="1"]')
  if (stale) stale.replaceWith(tag)
  else head.appendChild(tag)
}
