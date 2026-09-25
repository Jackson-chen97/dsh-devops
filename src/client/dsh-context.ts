/**
 * Client-side DSH context: structural types for the services the client
 * runtime injects (declared via the module's `inject` export), so the web
 * console does not depend on @deepseek-ai/* type packages at build time.
 */
import type { DevopsKey } from './locales.ts'

/** DSH Connection RPC result envelope. */
export type RpcResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }

export interface ClientConnection {
  rpc: {
    call(channel: string, endpoint: string, payload: unknown): Promise<RpcResult>
  }
}

export interface ClientLocale {
  register(ns: string, dicts: Record<string, Record<string, string>>): () => void
  register(ns: string, locale: string, dict: Record<string, string>): () => void
  bind(ns: string): (key: string, vars?: Record<string, unknown>) => string
  getSnapshot(): unknown
  subscribe(fn: () => void): () => void
}

export interface ClientSlots {
  inject(name: string, setup: () => () => void): () => void
  register(
    options: {
      name: string
      id: string
      order?: number
      label?: string | (() => string)
      inject?: (...args: unknown[]) => Record<string, unknown>
    },
    component: unknown,
  ): () => void
}

/** The ctx handed to the client module's `apply`. */
export interface DevopsClientContext {
  slots: ClientSlots
  locale: ClientLocale
  connection: ClientConnection
  effect(execute: () => unknown, label?: string): unknown
}
