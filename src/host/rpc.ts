/**
 * RPC channel registration: mounts the DevOps read/write channels on the DSH
 * Connection service so the web client can call endpoints without a raw HTTP
 * API (same pattern as dsh-mnemon's host rpc).
 *
 * Handlers return the ConnectionRpcResult envelope themselves:
 * `{ ok: true, value } | { ok: false, error: { code, message, details } }`.
 */
import type {
  DevopsReadEndpoint,
  DevopsWriteEndpoint,
} from '../protocol.ts'
import {
  DEVOPS_READ_CHANNEL,
  DEVOPS_WRITE_CHANNEL,
} from '../protocol.ts'
import * as gitlab from './endpoints-gitlab.ts'
import * as k8s from './endpoints-k8s.ts'
import * as app from './endpoints-app.ts'

type RpcResult = { ok: true; value: unknown } | { ok: false; error: { code: string; message: string; details: object } }
type EndpointHandler = (payload: any) => Promise<unknown>
type ConnectionRpcHandler = (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RpcResult>

function success(value: unknown): RpcResult {
  return { ok: true, value }
}

function failure(error: unknown): RpcResult {
  return {
    ok: false,
    error: {
      code: 'internal',
      message: error instanceof Error ? error.message : String(error),
      details: {},
    },
  }
}

const READ_ENDPOINTS: Record<DevopsReadEndpoint, EndpointHandler> = {
  'test-gitlab': gitlab.testGitLab,
  'gitlab-projects': gitlab.gitlabProjects,
  'gitlab-branches': gitlab.gitlabBranches,
  'gitlab-members': gitlab.gitlabMembers,
  'gitlab-last-commit': gitlab.gitlabLastCommit,
  'gitlab-mrs': gitlab.gitlabMRs,
  'gitlab-pipelines': gitlab.gitlabPipelines,
  'gitlab-tags': gitlab.gitlabTags,
  'gitlab-pipeline-jobs': gitlab.gitlabPipelineJobs,
  'gitlab-job-log': gitlab.gitlabJobLog,
  'test-k8s': k8s.testK8s,
  'k8s-contexts': k8s.k8sContexts,
  'k8s-namespaces': k8s.k8sNamespaces,
  'k8s-deployments': k8s.k8sDeployments,
  'k8s-pods': k8s.k8sPods,
  'k8s-events': k8s.k8sEvents,
  'k8s-pod-logs': k8s.k8sPodLogs,
  'config-load': app.configLoad,
  logs: app.logs,
  'browse-file': app.browseFile,
}

const WRITE_ENDPOINTS: Record<DevopsWriteEndpoint, EndpointHandler> = {
  'gitlab-create-mr': gitlab.gitlabCreateMR,
  'gitlab-create-tag': gitlab.gitlabCreateTag,
  'gitlab-pipeline-action': gitlab.gitlabPipelineAction,
  'gitlab-mr-approve': gitlab.gitlabMRApprove,
  'gitlab-mr-action': gitlab.gitlabMRAction,
  'k8s-set-image': k8s.k8sSetImage,
  'k8s-restart': k8s.k8sRestart,
  'config-save': app.configSave,
}

function createChannelHandler(endpoints: Record<string, EndpointHandler>): ConnectionRpcHandler {
  return async (endpoint, payload) => {
    const handler = endpoints[endpoint]
    if (!handler) return failure(new Error(`Unknown dsh-devops endpoint: ${endpoint}`))
    try {
      return success(await handler(payload))
    } catch (err) {
      return failure(err)
    }
  }
}

/** Minimal context surface needed to mount the channels. */
export interface DevopsRpcContext {
  inject?: (services: string[], callback: (context: any) => void) => unknown
}

/**
 * Mount the DevOps RPC channels on the Connection service.
 *
 * Uses `ctx.inject(['connection'], ...)` so headless profiles (no web
 * runtime) simply skip registration instead of failing to load.
 */
export function registerDevopsRpc(ctx: DevopsRpcContext): void {
  ctx.inject?.(['connection'], (webContext: any) => {
    const connection = webContext?.connection
    if (!connection?.rpc?.handle) {
      console.warn('[dsh-devops] connection.rpc not available; web console disabled')
      return
    }
    const readHandler = createChannelHandler(READ_ENDPOINTS)
    const writeHandler = createChannelHandler(WRITE_ENDPOINTS)
    const disposeRead = connection.rpc.handle(DEVOPS_READ_CHANNEL, readHandler, { authority: 'trusted-host' })
    const disposeWrite = connection.rpc.handle(DEVOPS_WRITE_CHANNEL, writeHandler, { authority: 'loopback' })
    return () => {
      for (const dispose of [disposeRead, disposeWrite]) {
        try {
          const result = typeof dispose === 'function' ? dispose() : undefined
          void result
        } catch {
          /* already disposed */
        }
      }
    }
  })
}
