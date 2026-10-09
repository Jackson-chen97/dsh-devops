/**
 * Shared UI primitives for the DevOps console (CSS Modules based).
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useSyncExternalStore, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import css from './DevopsUI.module.css'
import type { ClientLocale } from './dsh-context.ts'

/**
 * Re-render on DSH locale switches: the bound `t` resolves at call time, so a
 * revision bump from the LocaleRuntime snapshot is enough to refresh strings.
 */
export function useLocaleRevision(locale: ClientLocale): number {
  const subscribe = useCallback((cb: () => void) => locale.subscribe(cb), [locale])
  const getSnapshot = useCallback(() => {
    const snapshot = locale.getSnapshot() as { revision?: number } | null
    return snapshot?.revision ?? 0
  }, [locale])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export const DOT_COLOR: Record<string, string> = {
  ok: 'var(--dsh-devops-ok)',
  warn: 'var(--dsh-devops-warn)',
  err: 'var(--dsh-devops-err-strong)',
  neutral: 'var(--dsh-devops-fg-3)',
}

export function Dot({ tone = 'neutral', pulse }: { tone?: string; pulse?: boolean }) {
  return (
    <span
      className={`${css.dot}${pulse ? ` ${css.dotPulse}` : ''}`}
      style={{ background: DOT_COLOR[tone] ?? 'var(--dsh-devops-fg-3)' }}
    />
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <label className={css.label}>{children}</label>
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={css.input} />
}

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface NormalizedOption {
  value: string
  label: string
  disabled: boolean
}

/**
 * Searchable combobox (replaces the native `<select>`).
 *
 * The trigger shows the selected label; opening reveals a filtered list with
 * a search input (case-insensitive substring match). Interactions inside the
 * root stop propagation so DSH's global handlers never close or steal them;
 * clicks outside close the list.
 */
export function Select({
  options,
  value,
  onChange,
  disabled,
  placeholder,
  t,
}: {
  options: (string | SelectOption)[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  /** Optional translate fn for the built-in search/empty strings (falls back to zh). */
  t?: (key: string, vars?: Record<string, unknown>) => string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const normalized: NormalizedOption[] = useMemo(
    () =>
      (options ?? [])
        .filter((opt) => opt != null)
        .map((opt) =>
          typeof opt === 'string'
            ? { value: opt, label: opt, disabled: false }
            : { value: opt.value ?? '', label: opt.label ?? opt.value ?? '', disabled: !!opt.disabled },
        )
        .filter((o) => o.value !== ''),
    [options],
  )

  const selected = normalized.find((o) => o.value === value)
  const keyword = query.trim().toLowerCase()
  const filtered = keyword ? normalized.filter((o) => o.label.toLowerCase().includes(keyword)) : normalized

  // Outside mousedown (capture) or Escape closes the list.
  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setQuery('')
    const selectedIdx = Math.max(
      0,
      filtered.findIndex((o) => o.value === value),
    )
    setActive(selectedIdx)
    const focusTimer = setTimeout(() => searchRef.current?.focus(), 0)
    return () => clearTimeout(focusTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keep the active option visible while arrow-navigating.
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[active] as HTMLElement | undefined
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function pick(o: NormalizedOption) {
    if (o.disabled) return
    onChange(o.value)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, Math.max(0, filtered.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const o = filtered[active]
      if (o && !o.disabled) pick(o)
    }
  }

  if (disabled) {
    return (
      <div className={css.searchWrap}>
        <button type="button" className={`${css.searchTrigger} ${css.searchTriggerDisabled}`} disabled>
          <span className={css.searchTriggerValue}>{selected?.label ?? placeholder ?? ''}</span>
          <span className={css.searchCaret}>▾</span>
        </button>
      </div>
    )
  }

  const searchPh = t ? t('searchPh') : '搜索...'
  const emptyText = t ? t('searchEmpty') : '无匹配结果'

  return (
    <div
      ref={rootRef}
      className={css.searchWrap}
      // 阻止事件冒泡，防止被 DSH 的全局事件拦截（否则下拉会在会话期间被关闭）
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={css.searchTrigger}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`${css.searchTriggerValue}${selected ? '' : ` ${css.searchTriggerPlaceholder}`}`}>
          {selected?.label ?? placeholder ?? '...'}
        </span>
        <span className={css.searchCaret}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className={css.searchPop} onKeyDown={onKeyDown}>
          <input
            ref={searchRef}
            className={css.searchInput}
            placeholder={searchPh}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
          />
          <div className={css.searchList} ref={listRef}>
            {filtered.length === 0 ? (
              <div className={css.searchEmpty}>{emptyText}</div>
            ) : (
              filtered.map((o, i) => {
                return (
                  <div
                    key={o.value}
                    className={`${css.searchOption}${o.disabled ? ` ${css.searchOptionDisabled}` : i === active ? ` ${css.searchOptionActive}` : ''}${o.value === value ? ` ${css.searchOptionSelected}` : ''}`}
                    onMouseEnter={() => {
                      if (!o.disabled) setActive(i)
                    }}
                    onClick={() => pick(o)}
                  >
                    {o.label}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Lightweight modal dialog (portal to document.body). Interactions inside
 * stop propagation so DSH global handlers ignore them; overlay click and
 * Escape close.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidth,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  maxWidth?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div
      className={css.modalOverlay}
      onMouseDown={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={css.modalCard} style={maxWidth ? { maxWidth } : undefined}>
        <div className={css.modalHeader} onMouseDown={(e) => e.stopPropagation()}>
          <span className={css.modalTitle}>{title}</span>
          <button type="button" className={css.modalClose} onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className={css.modalBody}>{children}</div>
        {footer ? (
          <div className={css.modalFooter} onMouseDown={(e) => e.stopPropagation()}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export function Btn({
  children,
  onClick,
  disabled,
  tone = 'primary',
  variant = 'solid',
  small,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'primary' | 'secondary' | 'success'
  variant?: 'solid' | 'outline'
  small?: boolean
}) {
  let cls = css.btn
  if (small) cls += ` ${css.btnSmall}`
  if (variant === 'outline') cls += ` ${css.btnOutline}`
  else if (tone === 'success') cls += ` ${css.btnSuccess}`
  if (disabled) cls += ` ${css.btnDisabled}`
  return (
    <button type="button" className={cls} onClick={disabled ? undefined : onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function Status({ status, msg }: { status?: string; msg?: string }) {
  if (!status) return null
  const cls = status === 'ok' ? css.statusOk : status === 'error' ? css.statusError : css.statusIdle
  return (
    <div className={`${css.status} ${cls}`}>
      <span style={{ fontSize: 'var(--dsh-devops-font)' }}>{status === 'ok' ? '✓' : status === 'error' ? '✗' : '⏳'}</span>
      <span>{msg ?? ''}</span>
    </div>
  )
}

export function Section({
  title,
  badge,
  children,
}: {
  title: string
  badge?: string
  children: ReactNode
}) {
  return (
    <div className={css.section}>
      <div className={css.sectionTitle}>
        <h3 className={css.sectionTitleText}>{title}</h3>
        {badge ? <span className={css.sectionBadge}>{badge}</span> : null}
      </div>
      <div className={css.fieldGap}>{children}</div>
    </div>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: string; children: ReactNode }) {
  const cls =
    tone === 'ok' ? css.badgeOk : tone === 'warn' ? css.badgeWarn : tone === 'err' ? css.badgeErr : tone === 'accent' ? css.badgeAccent : css.badgeNeutral
  return <span className={`${css.badge} ${cls}`}>{children}</span>
}

export function ChipBtn({
  children,
  onClick,
  tone = 'ghost',
  title,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  tone?: 'ghost' | 'primary' | 'danger'
  title?: string
  disabled?: boolean
}) {
  let cls = css.chipBtn
  if (tone === 'primary') cls += ` ${css.chipBtnPrimary}`
  else if (tone === 'danger') cls += ` ${css.chipBtnDanger}`
  if (disabled) cls += ` ${css.chipBtnDisabled}`
  return (
    <button type="button" title={title} disabled={disabled} className={cls} onClick={disabled ? undefined : onClick}>
      {children}
    </button>
  )
}

export function StatCard({
  icon,
  title,
  value,
  sub,
  tone = 'neutral',
  subTone,
  onClick,
}: {
  icon?: string
  title: string
  value: ReactNode
  sub?: string
  tone?: string
  subTone?: string
  /** 提供时卡片可点击（跳转对应 tab/子 tab） */
  onClick?: () => void
}) {
  const color =
    tone === 'ok'
      ? 'var(--dsh-devops-ok)'
      : tone === 'err'
        ? 'var(--dsh-devops-err)'
        : tone === 'warn'
          ? 'var(--dsh-devops-warn)'
          : 'var(--dsh-devops-fg)'
  return (
    <div
      className={css.statCard + (onClick ? ` ${css.statCardClickable}` : '')}
      onClick={onClick}
    >
      <div className={css.statCardTitle}>
        {icon ? <span>{icon}</span> : null}
        <span>{title}</span>
      </div>
      <div className={css.statCardValue} style={{ color }}>
        {value != null ? value : '—'}
      </div>
      {sub ? (
        <div className={css.statCardSub} style={subTone ? { color: subTone } : undefined}>
          {sub}
        </div>
      ) : null}
    </div>
  )
}

export function SecHeader({
  icon,
  title,
  badge,
  badgeTone = 'neutral',
  onNew,
  newLabel,
  right,
}: {
  icon: string
  title: string
  badge?: ReactNode
  badgeTone?: string
  onNew?: () => void
  newLabel?: string
  right?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 'var(--dsh-devops-font-2)' }}>{icon}</span>
      <span style={{ fontSize: 'var(--dsh-devops-font-2)', fontWeight: 600 }}>{title}</span>
      {badge != null ? <Badge tone={badgeTone}>{badge}</Badge> : null}
      <span style={{ flex: 1 }} />
      {right}
      {onNew ? (
        <Btn onClick={onNew} small variant="outline">
          {newLabel ?? '+ New'}
        </Btn>
      ) : null}
    </div>
  )
}

export function TabBar({
  tabs,
  active,
  onChange,
  small,
}: {
  tabs: { id: string; label: ReactNode; badge?: ReactNode }[]
  active: string
  onChange: (id: string) => void
  /** 二级 tab 栏：更小的尺寸 */
  small?: boolean
}) {
  return (
    <div className={css.tabBar}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`${css.tab}${small ? ` ${css.tabSmall}` : ''}${active === tab.id ? ` ${css.tabActive}` : ''}`}
        >
          {tab.label}
          {tab.badge != null ? <span className={css.tabBadge}>{tab.badge}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <div className={css.emptyHint}>{children}</div>
}

export function SwitchCard({
  icon,
  title,
  status,
  t,
  children,
}: {
  icon: string
  title: string
  status: string
  t: TranslateFn
  children: ReactNode
}) {
  const st =
    status === 'ok'
      ? { tone: 'ok', text: t('connected') }
      : status === 'err'
        ? { tone: 'err', text: t('connectFailed') }
        : null
  return (
    <div className={css.switchCard}>
      <div className={css.switchCardHeader}>
        <span style={{ fontSize: 'var(--dsh-devops-font-2)' }}>{icon}</span>
        <span className={css.switchCardTitle}>{title}</span>
        <span style={{ flex: 1 }} />
        {st ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--dsh-devops-font-3)', color: st.tone === 'ok' ? 'var(--dsh-devops-ok)' : 'var(--dsh-devops-err-strong)' }}>
            <Dot tone={st.tone} pulse={st.tone === 'err'} />
            {st.text}
          </span>
        ) : (
          <span style={{ fontSize: 'var(--dsh-devops-font-3)', color: 'var(--dsh-devops-fg-4)' }}>{status === '' ? t('detecting') : t('notConfigured')}</span>
        )}
      </div>
      {children}
    </div>
  )
}

export function Toast({ toast }: { toast: { msg: string; tone: string } | null }) {
  if (!toast) return null
  const fg =
    toast.tone === 'err' ? 'var(--dsh-devops-err)' : toast.tone === 'warn' ? 'var(--dsh-devops-warn)' : 'var(--dsh-devops-ok)'
  return (
    <div className={css.toast}>
      <span style={{ color: fg }}>{toast.tone === 'err' ? '✗' : toast.tone === 'warn' ? '!' : '✓'}</span>
      <span className={css.toastMsg}>{toast.msg}</span>
    </div>
  )
}

/** Imperative controls exposed by {@link LogViewer} through the `ref` handle. */
export interface LogViewerHandle {
  /** Re-fetch via the caller-provided `onRefresh`. */
  refresh: () => void
  /** Scroll the panel to the bottom and re-enable tail-follow. */
  toBottom: () => void
}

export interface LogViewerProps {
  lines: string[]
  /** CSS class per line (e.g. log level tone); defaults to the info tone. */
  classify?: (line: string) => string | undefined
  loading?: boolean
  err?: string
  onRefresh?: () => void
  /**
   * Don't render the refresh / scroll-to-bottom buttons in the toolbar —
   * the caller renders them itself (e.g. in a modal footer) and drives them
   * through the `ref` handle.
   */
  externalControls?: boolean
  /** Extra toolbar content rendered before the buttons (e.g. a line count). */
  toolbarExtra?: ReactNode
  maxHeight?: number
  emptyText: string
  t: TranslateFn
}

/**
 * Shared log viewer: per-line rendering (with optional per-line tone class),
 * a search box that filters lines case-insensitively and highlights the
 * matches, an optional refresh button, and a scroll-to-bottom button. The
 * panel auto-follows the tail while the user stays scrolled to the bottom;
 * scrolling up pauses the follow until the button is used again.
 */
export const LogViewer = forwardRef<LogViewerHandle, LogViewerProps>(function LogViewer(
  { lines, classify, loading, err, onRefresh, externalControls, toolbarExtra, maxHeight = 420, emptyText, t },
  ref,
) {
  const [query, setQuery] = useState('')
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const followRef = useRef(true)
  const keyword = query.trim().toLowerCase()
  const shown = keyword ? lines.filter((l) => l.toLowerCase().includes(keyword)) : lines

  // The handle stays stable across renders; onRefresh is read through a ref so
  // the caller's latest closure (e.g. re-created on modal state change) is used.
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  useImperativeHandle(
    ref,
    () => ({
      refresh: () => {
        followRef.current = true
        onRefreshRef.current?.()
      },
      toBottom: () => {
        followRef.current = true
        scrollToBottom()
      },
    }),
    [],
  )

  function scrollToBottom() {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  // Follow the tail while the user stays at the bottom (new data, or the
  // panel just mounted / finished loading).
  useEffect(() => {
    if (followRef.current) scrollToBottom()
  }, [shown.length, loading, err])

  function onScroll() {
    const el = bodyRef.current
    if (el) followRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
  }

  function highlight(line: string): ReactNode {
    if (!keyword) return line
    const lower = line.toLowerCase()
    const out: ReactNode[] = []
    let from = 0
    let idx = lower.indexOf(keyword)
    let key = 0
    while (idx !== -1) {
      if (idx > from) out.push(line.slice(from, idx))
      out.push(
        <span key={key++} className={css.logMatch}>
          {line.slice(idx, idx + keyword.length)}
        </span>,
      )
      from = idx + keyword.length
      idx = lower.indexOf(keyword, from)
    }
    if (from < line.length) out.push(line.slice(from))
    return out
  }

  const refreshClick = () => {
    followRef.current = true
    onRefresh?.()
  }
  const bottomClick = () => {
    followRef.current = true
    scrollToBottom()
  }

  // 刷新时保留现有内容（面板整体变暗表示加载中），仅在无内容可显示时才出
  // loading 占位——避免点刷新后整块内容被替换导致的闪烁。
  const body =
    loading && lines.length === 0 && !err ? (
      <div style={{ color: 'var(--dsh-devops-fg-4)' }}>{t('loadingLogs')}</div>
    ) : err ? (
      <div style={{ color: 'var(--dsh-devops-err)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{err}</div>
    ) : lines.length === 0 ? (
      <div style={{ color: 'var(--dsh-devops-fg-4)', textAlign: 'center', padding: 20 }}>{emptyText}</div>
    ) : shown.length === 0 ? (
      <div style={{ color: 'var(--dsh-devops-fg-4)', textAlign: 'center', padding: 20 }}>{t('searchEmpty')}</div>
    ) : (
      shown.map((line, i) => (
        <div
          key={i}
          className={classify?.(line) ?? css.logLineInfo}
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
        >
          {highlight(line)}
        </div>
      ))
    )

  const panel = (
    <div
      ref={bodyRef}
      onScroll={onScroll}
      className={css.logPanel}
      style={{ maxHeight, opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}
    >
      {body}
    </div>
  )

  return (
    <div>
      <div className={css.logToolbar}>
        <input
          className={`${css.input} ${css.logSearch}`}
          placeholder={t('searchLogs')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {keyword ? <span className={css.logMatchCount}>{t('logMatch', { n: shown.length, m: lines.length })}</span> : null}
        <span style={{ flex: 1 }} />
        {toolbarExtra}
        {!externalControls && onRefresh ? (
          <Btn onClick={refreshClick} small variant="outline" disabled={loading}>
            {t('refresh')}
          </Btn>
        ) : null}
        {!externalControls ? (
          <ChipBtn tone="ghost" title={t('toBottom')} onClick={bottomClick}>
            ⬇
          </ChipBtn>
        ) : null}
      </div>
      {panel}
    </div>
  )
})

/** Relative "time ago" label. */
export function timeAgo(ts: string | undefined, t: TranslateFn): string {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  if (isNaN(diff) || diff < 0) return ''
  const s = Math.floor(diff / 1000)
  if (s < 60) return t('justNow')
  const m = Math.floor(s / 60)
  if (m < 60) return t('minAgo', { n: m })
  const hr = Math.floor(m / 60)
  if (hr < 24) return t('hourAgo', { n: hr })
  return t('dayAgo', { n: Math.floor(hr / 24) })
}

/** Local "YYYY-MM-DD HH:mm:ss" for an ISO timestamp; '' when missing/invalid. */
export function formatDateTime(ts: string | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * Uncontrolled input that keeps its DOM value across parent re-renders
 * (the DSH settings panel remounts controlled inputs aggressively).
 */
export function useUncontrolledRef(): React.RefObject<HTMLInputElement | null> {
  return useRef<HTMLInputElement | null>(null)
}

export type TranslateFn = (key: string, vars?: Record<string, unknown>) => string

export type { CSSProperties }
