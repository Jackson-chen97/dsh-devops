/**
 * Icon contributed to the DSH native sidebar (`sidebar.panellist` row).
 *
 * The host owns the button, typography, tooltip, selection and collapsed
 * layout; it renders the component with `{ size, active }`. The stroke
 * follows the sidebar's `currentColor` so it themes with dark/light
 * automatically; the active row gets heavier strokes and filled markers.
 *
 * Glyph: git branch — the DevOps / source-control mark.
 */
export interface DevopsPanelIconProps {
  size: number
  active?: boolean
}

export function DevopsPanelIcon({ size, active = false }: DevopsPanelIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" fill={active ? 'currentColor' : 'none'} />
      <circle cx="6" cy="18" r="3" fill={active ? 'currentColor' : 'none'} />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}
