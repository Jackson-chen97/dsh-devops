/**
 * Regression test for the desktop host.
 *
 * Connection mounts each RPC channel through `owner.webServer`, where `owner`
 * is derived from the *reading* scope rather than from Connection's own
 * provider scope. When this plugin only injected `connection`, that read
 * happened in Connection's provider scope, which on the desktop app cannot
 * resolve `webServer` — `rpc.handle` threw and both channels stayed unmounted
 * (HTTP 404) while the rest of the plugin loaded.
 *
 * The fakes mirror the parts of the real host this depends on:
 * - webServer and connection are provided by sibling plugin fibers (Connection
 *   is not loaded below the web runtime), like the desktop host;
 * - `FakeConnection.rpc.handle` mounts through `owner.webServer`, taking
 *   `owner` from `this.ctx` so Cordis' traceable service proxy rebinds it to
 *   the caller's context;
 * - `FakeWebServer.register` is the route table the channels land in.
 */
import { describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import { registerDevopsRpc, type DevopsRpcContext } from '../../src/host/rpc.ts'
import { DEVOPS_READ_CHANNEL, DEVOPS_WRITE_CHANNEL } from '../../src/protocol.ts'

class FakeWebServer extends Service {
  readonly routes = new Map<string, unknown>()

  constructor(ctx: Context) {
    super(ctx, 'webServer')
  }

  register(channel: string, handler: unknown): () => void {
    this.routes.set(channel, handler)
    return () => {
      this.routes.delete(channel)
    }
  }
}

class FakeConnection extends Service {
  constructor(ctx: Context) {
    super(ctx, 'connection')
  }

  get rpc() {
    // `this.ctx` is the reading scope once Cordis' traceable proxy wraps this
    // service, exactly like dsh-client-connection's own rpc getter.
    const owner = this.ctx
    return {
      handle: (channel: string, handler: unknown): (() => void) =>
        owner.effect(
          () => (owner as unknown as { webServer: FakeWebServer }).webServer.register(channel, handler),
          `fake-connection: ${channel} rpc channel`,
        ),
    }
  }
}

/** Cordis starts injected plugins on a microtask; let it settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('registerDevopsRpc on a Cordis host', () => {
  it('mounts both channels when Connection cannot see webServer from its provider scope', async () => {
    const root = new Context()
    let webServer!: FakeWebServer
    await root.plugin(function webRuntimePlugin(ctx: Context) {
      webServer = new FakeWebServer(ctx)
    })
    await root.plugin(function connectionPlugin(ctx: Context) {
      new FakeConnection(ctx)
    })
    // Sanity check: nothing is mounted before the plugin registers.
    expect([...webServer.routes.keys()]).toEqual([])

    registerDevopsRpc(root as unknown as DevopsRpcContext)
    await flush()

    expect([...webServer.routes.keys()].sort()).toEqual(
      [DEVOPS_READ_CHANNEL, DEVOPS_WRITE_CHANNEL].sort(),
    )
  })
})
