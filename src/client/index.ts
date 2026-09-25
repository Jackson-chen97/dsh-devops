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
import type { DevopsClientContext } from './dsh-context.ts'

export const inject = ['slots', 'locale', 'connection']

export function apply(ctx: DevopsClientContext): void {
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
}
