/**
 * SECURITY GUARD — disposition item 13: bound the BFF service-key blast radius.
 *
 * Each of the four credential-injecting edge proxies rewrites `/bff/<x>/*` to an
 * upstream prefix and injects a service key/bearer. Before this guard the rewrite
 * was BLIND: any path under the seam (or an encoded traversal out of it) became an
 * authenticated service caller across the whole upstream surface — for `/bff/cee/*`
 * that is ~24 `/assist/v1/*` routes, ~20 of them LLM-invoking, reachable with no
 * UUID and (for cee/collab) no Origin.
 *
 * This spec drives the ACTUAL handlers (Deno + fetch stubbed) and asserts, by
 * IDENTITY on the exact route strings:
 *   • an ON-LIST path is forwarded WITH the injected credential;
 *   • an OFF-LIST path is answered 404 and fetch is NEVER called, so NO key leaves
 *     the edge;
 *   • an encoded-traversal path is answered 404 and fetch is never called.
 *
 * The two guards are independently load-bearing (see the mutant notes in the PR):
 *   • remove the allowlist  → the plain OFF-LIST cases forward (RED);
 *   • remove the traversal check → the encoded-slash cases forward (RED), because
 *     the dynamic id segment is deliberately permissive (`[^/]+`) so real UUIDs
 *     never false-404.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

import ceeHandler from '../../netlify/edge-functions/cee-proxy.ts'
import orchestratorHandler from '../../netlify/edge-functions/orchestrator-proxy.ts'
import collabHandler from '../../netlify/edge-functions/collab-proxy.ts'
import islHandler from '../../netlify/edge-functions/isl-proxy.ts'

const ALLOWED_ORIGIN = 'https://staging--olumi.netlify.app'
const FAKE_KEY = 'FAKE_SERVICE_KEY_VALUE'

type Handler = (request: Request, context: unknown) => Promise<Response>

interface InvokeResult {
  status: number
  fetchCalled: boolean
  calledUrl: string | null
  requestHeaders: Headers | null
}

/** Invoke a handler with Deno + fetch stubbed; report status and upstream call. */
async function invoke(
  handler: Handler,
  opts: { path: string; method?: string; withOrigin?: boolean },
): Promise<InvokeResult> {
  ;(globalThis as unknown as { Deno: unknown }).Deno = {
    env: { get: (_k: string) => FAKE_KEY },
  }

  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('upstream-ok', { status: 200 }))

  const method = opts.method ?? 'POST'
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.withOrigin !== false) headers.origin = ALLOWED_ORIGIN
  // collab participant routes require this header to build; harmless elsewhere.
  headers['x-collab-participant-token'] = 'ptoken'

  const init: RequestInit = { method, headers }
  if (method !== 'GET' && method !== 'HEAD') init.body = '{}'

  const req = new Request(`https://staging--olumi.netlify.app${opts.path}`, init)
  const res = await handler(req, {})

  const call = fetchSpy.mock.calls[0]
  return {
    status: res.status,
    fetchCalled: fetchSpy.mock.calls.length > 0,
    calledUrl: call ? String(call[0]) : null,
    requestHeaders: call ? ((call[1] as RequestInit)?.headers as Headers) ?? null : null,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete (globalThis as unknown as { Deno?: unknown }).Deno
})

/* ── /bff/cee/* → /assist/v1/* — the HIGH blast-radius seam ─────────────────── */
describe('cee-proxy path allowlist (/bff/cee/* → /assist/v1/*)', () => {
  it('ON-LIST /bff/cee/graph-readiness forwards to /assist/v1/graph-readiness WITH the injected key', async () => {
    const r = await invoke(ceeHandler as Handler, { path: '/bff/cee/graph-readiness' })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe('https://cee-staging.onrender.com/assist/v1/graph-readiness')
    expect(r.requestHeaders?.get('X-Olumi-Assist-Key')).toBe(FAKE_KEY)
    expect(r.status).toBe(200)
  })

  it('ON-LIST /bff/cee/scenarios/{uuid}/graph forwards (dynamic id honoured)', async () => {
    const uuid = 'd495a487-6ed7-4a90-a220-17a6986acc1d'
    const r = await invoke(ceeHandler as Handler, { path: `/bff/cee/scenarios/${uuid}/graph` })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe(`https://cee-staging.onrender.com/assist/v1/scenarios/${uuid}/graph`)
  })

  it('OFF-LIST /bff/cee/decision-review (a real LLM route the UI never calls) is 404 with NO key sent', async () => {
    const r = await invoke(ceeHandler as Handler, { path: '/bff/cee/decision-review' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('OFF-LIST /bff/cee/anything-not-enumerated is 404 with NO key sent', async () => {
    const r = await invoke(ceeHandler as Handler, { path: '/bff/cee/prompts/preload-all' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('TRAVERSAL /bff/cee/scenarios/abc%2f..%2fsecret/graph is 404 with NO key sent', async () => {
    const r = await invoke(ceeHandler as Handler, {
      path: '/bff/cee/scenarios/abc%2f..%2fsecret/graph',
    })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('TRAVERSAL /bff/cee/%2e%2e/assist/v1/decision-review is 404 with NO key sent', async () => {
    const r = await invoke(ceeHandler as Handler, {
      path: '/bff/cee/%2e%2e/assist/v1/decision-review',
    })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })
})

/* ── /bff/orchestrate/* → /orchestrate/* — the three turn routes ───────────── */
describe('orchestrator-proxy path allowlist (/bff/orchestrate/* → /orchestrate/*)', () => {
  it('ON-LIST /bff/orchestrate/v2/turn forwards WITH the injected key', async () => {
    const r = await invoke(orchestratorHandler as Handler, {
      path: '/bff/orchestrate/v2/turn',
    })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe('https://cee-staging.onrender.com/orchestrate/v2/turn')
    expect(r.requestHeaders?.get('X-Olumi-Assist-Key')).toBe(FAKE_KEY)
  })

  it('ON-LIST /bff/orchestrate/v2/turn/stream forwards', async () => {
    const r = await invoke(orchestratorHandler as Handler, {
      path: '/bff/orchestrate/v2/turn/stream',
    })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe('https://cee-staging.onrender.com/orchestrate/v2/turn/stream')
  })

  it('ON-LIST /bff/orchestrate/v2/turn/stop forwards', async () => {
    const r = await invoke(orchestratorHandler as Handler, {
      path: '/bff/orchestrate/v2/turn/stop',
    })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe('https://cee-staging.onrender.com/orchestrate/v2/turn/stop')
  })

  it('OFF-LIST /bff/orchestrate/v2/turn/replay is 404 with NO key sent', async () => {
    const r = await invoke(orchestratorHandler as Handler, {
      path: '/bff/orchestrate/v2/turn/replay',
    })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('OFF-LIST /bff/orchestrate/admin is 404 with NO key sent', async () => {
    const r = await invoke(orchestratorHandler as Handler, { path: '/bff/orchestrate/admin' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })
})

/* ── /bff/collab/* → /collab/v1/* — person-authed, but still key-injecting ──── */
describe('collab-proxy path allowlist (/bff/collab/* → /collab/v1/*)', () => {
  it('ON-LIST /bff/collab/rounds forwards WITH the injected key', async () => {
    const r = await invoke(collabHandler as Handler, { path: '/bff/collab/rounds' })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe('https://cee-staging.onrender.com/collab/v1/rounds')
    expect(r.requestHeaders?.get('X-Olumi-Assist-Key')).toBe(FAKE_KEY)
  })

  it('ON-LIST /bff/collab/packet/{uuid} (GET) forwards', async () => {
    const uuid = 'c261b74a-c7ce-4aad-96ca-04f0fdfd0fce'
    const r = await invoke(collabHandler as Handler, {
      path: `/bff/collab/packet/${uuid}`,
      method: 'GET',
    })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe(`https://cee-staging.onrender.com/collab/v1/packet/${uuid}`)
  })

  it('OFF-LIST /bff/collab/admin is 404 with NO key sent', async () => {
    const r = await invoke(collabHandler as Handler, { path: '/bff/collab/admin' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('TRAVERSAL /bff/collab/rounds/abc%2f..%2fadmin/close is 404 with NO key sent', async () => {
    const r = await invoke(collabHandler as Handler, {
      path: '/bff/collab/rounds/abc%2f..%2fadmin/close',
    })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })
})

/* ── /bff/isl/* → /* — route table unread; permissive-prefix allowlist ──────── */
describe('isl-proxy path allowlist (/bff/isl/* → /*)', () => {
  it('ON-LIST /bff/isl/health forwards WITH the injected bearer', async () => {
    const r = await invoke(islHandler as Handler, { path: '/bff/isl/health', method: 'GET' })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe('https://isl-staging.onrender.com/health')
    expect(r.requestHeaders?.get('Authorization')).toBe(`Bearer ${FAKE_KEY}`)
  })

  it('ON-LIST /bff/isl/api/v1/robustness/analyze forwards', async () => {
    const r = await invoke(islHandler as Handler, { path: '/bff/isl/api/v1/robustness/analyze' })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe('https://isl-staging.onrender.com/api/v1/robustness/analyze')
  })

  it('OFF-LIST /bff/isl/admin/secrets is 404 with NO bearer sent', async () => {
    const r = await invoke(islHandler as Handler, { path: '/bff/isl/admin/secrets' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('TRAVERSAL /bff/isl/api/v1/robustness%2f..%2f..%2fadmin is 404 with NO bearer sent', async () => {
    const r = await invoke(islHandler as Handler, {
      path: '/bff/isl/api/v1/robustness%2f..%2f..%2fadmin',
    })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })
})
