/**
 * dsh-devops web console entry — loaded by the DSH client ModuleLoader.
 *
 * Exports the DSH client contract: `inject` (services to mount on ctx) and
 * `apply` (slot registrations). The bundle is wrapped by tsdown into
 * `window.__ModuleLoader__.load({ id, factory })`.
 *
 * Slot registration follows the declarative pattern: `ctx.slots.inject(name,
 * setup)` declares participation in a slot and runs `setup` (which registers
 * the component) only once the parent slot exists — registering directly into
 * an undeclared slot throws.
 */
import { ZH, EN } from './locales.ts'
import { DevopsSettings } from './DevopsSettings.tsx'
import { DevopsDashboard } from './DevopsDashboard.tsx'
import { DevopsPanelIcon } from './DevopsPanelIcon.tsx'
import { initDevopsTheme } from './theme.ts'
import type { DevopsClientContext } from './dsh-context.ts'

/** Native sidebar panel id: the `main` keyed seat and the `sidebar.panellist` row share it. */
const DEVOPS_PANEL_ID = 'devops'

/** Sidebar row position (rows sort by order among contributed panels). */
const DEVOPS_PANEL_ORDER = 30

export const inject = ['slots', 'locale', 'connection']

export function apply(ctx: DevopsClientContext): void {
  // 0. Theme: inject the dual-theme CSS variables and follow the host theme
  //    live (the host exposes no theme API of its own).
  initDevopsTheme()

  // 1. Locale dictionaries — the console follows the app language setting.
  ctx.locale.register('dsh-devops', 'zh', ZH as unknown as Record<string, string>)
  ctx.locale.register('dsh-devops', 'en', EN as unknown as Record<string, string>)
  const translate = ctx.locale.bind('dsh-devops')

  // 2. Settings → DevOps section (connection wizard)
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: 'dsh-devops',
        order: 100,
        label: 'DevOps',
        inject: () => ({ connection: ctx.connection, locale: ctx.locale, t: translate }),
      },
      DevopsSettings,
    ),
  )

  // 3. Conversation top tab (DevOps dashboard)
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'devops',
        order: 50,
        label: () => 'DevOps',
        inject: () => ({ connection: ctx.connection, locale: ctx.locale, t: translate }),
      },
      DevopsDashboard,
    ),
  )

  // 4. Native sidebar panel (row below New Session): a `sidebar.panellist`
  //    entry paired with the matching `main` seat. DSH owns the button,
  //    typography, tooltip, selection and collapsed layout; we contribute
  //    the icon, the label and the page itself. The nested inject is the
  //    declaration guard: setup runs only once both slots exist (the layout
  //    AppFrame and the sidebar), which replacement shells may not declare.
  ctx.slots.inject('main', () =>
    ctx.slots.inject('sidebar.panellist', () => {
      const stopMain = ctx.slots.register(
        {
          name: 'main',
          key: DEVOPS_PANEL_ID,
          inject: () => ({ connection: ctx.connection, locale: ctx.locale, t: translate }),
        },
        DevopsDashboard,
      )
      const stopIcon = ctx.slots.register(
        {
          name: 'sidebar.panellist',
          id: DEVOPS_PANEL_ID,
          order: DEVOPS_PANEL_ORDER,
          label: () => translate('panelLabel'),
          locale: 'dsh-devops',
        },
        DevopsPanelIcon,
      )
      return () => {
        stopIcon()
        stopMain()
      }
    }),
  )
}
