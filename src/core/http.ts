/**
 * HTTP helpers shared by the GitLab/K8s clients and the RPC endpoints.
 *
 * `requestWithTls` exists because native `fetch` cannot pin a per-request CA
 * (needed for kubeconfig `certificate-authority-data`) — those requests go
 * through `node:https` with the cluster CA pinned (or verification skipped on
 * `insecure-skip-tls-verify`).
 */

import { request as httpRequest } from 'node:https'

export interface TlsOptions {
  /** Base64-encoded cluster CA (from kubeconfig `certificate-authority-data`). */
  caData?: string
  /** Skip TLS verification entirely (kubeconfig `insecure-skip-tls-verify`). */
  insecureSkipTlsVerify?: boolean
}

export interface RequestOptions extends RequestInit {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Per-request timeout in ms (default 5000). */
  timeoutMs?: number
  /** TLS pinning options (node:https path). */
  tls?: TlsOptions
  /** Plain request body string (node:https path). */
  bodyText?: string
}

/** Mask secret header values for logging. */
export function maskHeaders(headers: Record<string, string> | Headers | undefined): string {
  if (!headers) return '{}'
  try {
    const h = new Headers(headers as HeadersInit)
    const out: Record<string, string> = {}
    h.forEach((v, k) => { out[k] = /token|authorization|key|cookie/i.test(k) ? v.slice(0, 6) + '***' : v })
    return JSON.stringify(out)
  } catch {
    return '{}'
  }
}

/** Request via node:https with an optional pinned CA (fetch cannot set a per-request CA). */
function httpsRequest(
  url: string,
  opts: {
    method?: string
    headers?: Record<string, string>
    body?: string
    signal?: AbortSignal
    ca?: Buffer
    insecureSkipTlsVerify?: boolean
  },
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = httpRequest(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: opts.method ?? 'GET',
        headers: opts.body
          ? { ...opts.headers, 'Content-Length': Buffer.byteLength(opts.body) }
          : opts.headers,
        ...(opts.insecureSkipTlsVerify
          ? { rejectUnauthorized: false }
          : opts.ca
            ? { ca: opts.ca, rejectUnauthorized: true, checkServerIdentity: () => undefined }
            : {}),
      },
      (upstream) => {
        const chunks: Buffer[] = []
        upstream.on('data', (c: Buffer) => chunks.push(c))
        upstream.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          const status = upstream.statusCode ?? 0
          // Body-less statuses must get an explicit null body or the Response
          // constructor throws.
          const bodyless = status === 204 || status === 304
          resolve(
            new Response(bodyless ? null : body, {
              status,
              statusText: upstream.statusMessage ?? '',
            }),
          )
        })
      },
    )
    req.on('error', reject)
    opts.signal?.addEventListener('abort', () => req.destroy(new Error('AbortError')))
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

/**
 * Fetch with timeout via AbortController.
 * When `tls` is given (a resolved kubeconfig context), the cluster CA is
 * pinned (or verification skipped on insecureSkipTlsVerify) via node:https.
 * String bodies work on both paths (`body` for fetch, `bodyText` for the
 * node:https call — either form is accepted).
 */
export async function requestWithTimeout(url: string, init: RequestOptions = {}): Promise<Response> {
  const ms = init.timeoutMs ?? 5000
  const bodyText = init.bodyText ?? (typeof init.body === 'string' ? init.body : undefined)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    if (init.tls?.caData || init.tls?.insecureSkipTlsVerify) {
      return await httpsRequest(url, {
        method: init.method,
        headers: init.headers as Record<string, string> | undefined,
        body: bodyText,
        signal: ctrl.signal,
        ca: init.tls.caData ? Buffer.from(init.tls.caData, 'base64') : undefined,
        insecureSkipTlsVerify: init.tls.insecureSkipTlsVerify,
      })
    }
    return await fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}
