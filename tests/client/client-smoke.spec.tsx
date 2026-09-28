// @vitest-environment jsdom
/// <reference types="@testing-library/react" />
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import { DevopsSettings } from '../../src/client/DevopsSettings.tsx'
import { DevopsDashboard } from '../../src/client/DevopsDashboard.tsx'
import { apply as clientApply, inject as clientInject } from '../../src/client/index.ts'
import { ZH } from '../../src/client/locales.ts'
import type { DevopsClientContext, ClientLocale, ClientSlots } from '../../src/client/dsh-context.ts'

const t = (key: string, vars?: Record<string, unknown>) => {
  let s: string = ZH[key as keyof typeof ZH] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

function makeLocale(): ClientLocale {
  return {
    register: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    bind: (ns: string) => t,
    getSnapshot: () => ({ revision: 1 }),
    subscribe: () => () => {},
  }
}

function makeSlots() {
  const registered: { options: unknown; component: unknown }[] = []
  const injected: string[] = []
  const slots: ClientSlots = {
    inject: (name, setup) => {
      injected.push(name)
      // The real slot runtime invokes the setup as soon as the parent slot
      // exists; mirror that so the test sees the nested registration.
      setup()
      return () => {}
    },
    register: (options, component) => {
      registered.push({ options, component })
      return () => {}
    },
  }
  return { slots, registered, injected }
}

function makeCtx(rpcValue: unknown) {
  const { slots, registered, injected } = makeSlots()
  const connection = {
    rpc: {
      call: vi.fn(async (): Promise<{ ok: true; value: unknown }> => ({ ok: true, value: rpcValue })),
    },
  }
  const ctx: DevopsClientContext = {
    slots,
    locale: makeLocale(),
    connection,
    effect: (fn) => fn(),
  }
  return { ctx, registered, injected, connection }
}

describe('client entry', () => {
  it('declares its injected services and registers both slots', () => {
    expect(clientInject).toEqual(['slots', 'locale', 'connection'])
    const { ctx, registered, injected } = makeCtx({ ok: true, config: null })
    clientApply(ctx)
    expect(injected).toEqual(['settings.section', 'conversation.view'])
    const ids = registered.map((r) => (r.options as { id: string }).id)
    expect(ids).toContain('dsh-devops')
    expect(ids).toContain('devops')
  })

  it('registers the locale dictionaries', () => {
    const { ctx } = makeCtx({ ok: true, config: null })
    const register = vi.fn()
    ctx.locale.register = register
    clientApply(ctx)
    expect(register).toHaveBeenCalledWith('dsh-devops', 'zh', expect.anything())
    expect(register).toHaveBeenCalledWith('dsh-devops', 'en', expect.anything())
  })
})

describe('DevopsSettings (jsdom smoke)', () => {
  it('renders the GitLab / Kubernetes sections and loads the saved config', async () => {
    const { ctx } = makeCtx({ ok: true, config: null })
    const props = { connection: ctx.connection, locale: ctx.locale, t }
    render(createElement(DevopsSettings, props))
    await waitFor(() => expect(ctx.connection.rpc.call).toHaveBeenCalled())
    expect(screen.getByText('GitLab')).toBeTruthy()
    expect(screen.getByText('Kubernetes')).toBeTruthy()
    expect(screen.getByText(ZH.saveConfig)).toBeTruthy()
  })

  it('card flow: empty state → add → fill → save persists servers', async () => {
    const calls: { channel: string; endpoint: string; payload: unknown }[] = []
    const connection = {
      rpc: {
        call: vi.fn(
          async (channel: string, endpoint: string, payload: unknown): Promise<{ ok: true; value: unknown }> => {
            calls.push({ channel, endpoint, payload })
            if (endpoint === 'config-load') return { ok: true, value: { ok: true, config: null } }
            return { ok: true, value: { ok: true } }
          },
        ),
      },
    }
    const props = { connection, locale: makeLocale(), t }
    render(createElement(DevopsSettings, props))
    await waitFor(() => expect(screen.getByText('+ ' + ZH.addServer)).toBeTruthy())

    // 空态点击 → 出现展开的空卡（编辑表单直接在卡片内）
    fireEvent.click(screen.getByText('+ ' + ZH.addServer))
    const nameInput = await waitFor(() => screen.getByPlaceholderText(ZH.nameGlPh) as HTMLInputElement)
    expect(nameInput).toBeTruthy()

    // 填写并保存 → save-config 收到 servers 列表
    fireEvent.change(nameInput, { target: { value: '本地 GitLab' } })
    fireEvent.change(screen.getByPlaceholderText('https://gitlab.example.com'), { target: { value: 'http://localhost:8080' } })
    fireEvent.click(screen.getByText(ZH.saveConfig))
    await waitFor(() => {
      const save = calls.find((c) => c.endpoint === 'config-save')
      expect(save).toBeTruthy()
      const servers = (save!.payload as { gitlab: { servers: { label: string; baseUrl: string }[] } }).gitlab.servers
      expect(servers[0]!.label).toBe('本地 GitLab')
      expect(servers[0]!.baseUrl).toBe('http://localhost:8080')
    })
  })
})

describe('DevopsDashboard (jsdom smoke)', () => {
  it('shows the not-configured empty state when no config is saved', async () => {
    const { ctx } = makeCtx({ ok: true, config: null })
    const props = { connection: ctx.connection, locale: ctx.locale, t }
    render(createElement(DevopsDashboard, props))
    await waitFor(() => expect(screen.getByText(ZH.notCfgBig)).toBeTruthy())
    expect(screen.getByText(ZH.goCfg)).toBeTruthy()
  })

  it('renders deployments and filters them via the search box', async () => {
    const config = {
      k8s: {
        kubeconfigs: [{ id: 'kc1', label: '测试集群', path: '/tmp/kc.yaml', context: '', namespace: 'ns1' }],
        activeKubeconfigId: 'kc1',
      },
    }
    const deployments = [
      { name: 'order-server', ready: 2, replicas: 2, image: 'registry/order-server:1.0.0', imageTag: '1.0.0', updated: '2026-01-01T00:00:00Z' },
      { name: 'mall-gateway', ready: 1, replicas: 1, image: 'registry/mall-gateway:2.0.0', imageTag: '2.0.0', updated: '2026-01-01T00:00:00Z' },
    ]
    const connection = {
      rpc: {
        call: vi.fn(async (_channel: string, endpoint: string): Promise<{ ok: true; value: unknown }> => {
          if (endpoint === 'config-load') return { ok: true, value: { ok: true, config } }
          if (endpoint === 'k8s-deployments') return { ok: true, value: { ok: true, deployments } }
          if (endpoint === 'k8s-pods') return { ok: true, value: { ok: true, pods: [] } }
          if (endpoint === 'k8s-events') return { ok: true, value: { ok: true, events: [] } }
          return { ok: true, value: { ok: false } }
        }),
      },
    }
    render(createElement(DevopsDashboard, { connection, locale: makeLocale(), t }))
    // 切到 K8s tab（'K8s' 文本同时出现在 SwitchCard 标题里，取 tab 按钮）
    const k8sTab = await waitFor(() => {
      const btn = screen
        .getAllByText('K8s')
        .map((el) => el.closest('button'))
        .find((b) => b && b.textContent === 'K8s')
      expect(btn).toBeTruthy()
      return btn!
    })
    fireEvent.click(k8sTab)
    // 两个部署都渲染
    await waitFor(() => expect(screen.getByText('order-server')).toBeTruthy())
    expect(screen.getByText('mall-gateway')).toBeTruthy()
    // 搜索过滤
    fireEvent.change(screen.getByPlaceholderText(ZH.searchDepsPh), { target: { value: 'order' } })
    expect(screen.getByText('order-server')).toBeTruthy()
    expect(screen.queryByText('mall-gateway')).toBeNull()
    // 无匹配提示
    fireEvent.change(screen.getByPlaceholderText(ZH.searchDepsPh), { target: { value: 'zzz' } })
    expect(screen.getByText(ZH.noMatchDeps)).toBeTruthy()
  })
})
