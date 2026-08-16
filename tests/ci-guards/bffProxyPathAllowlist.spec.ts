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
import plotHandler from '../../netlify/edge-functions/plot-proxy.ts'

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

  it('ON-LIST /bff/collab/rounds/{uuid}/preview (GET) forwards — D1 name resolution', async () => {
    // The roster read behind render-time participant names. It was OFF-LIST
    // until 14 Aug 2026 while two comments in the proxy advertised it, so the
    // route CEE had exposed all along answered 404 at the edge.
    const uuid = 'c261b74a-c7ce-4aad-96ca-04f0fdfd0fce'
    const r = await invoke(collabHandler as Handler, {
      path: `/bff/collab/rounds/${uuid}/preview`,
      method: 'GET',
    })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe(
      `https://cee-staging.onrender.com/collab/v1/rounds/${uuid}/preview`,
    )
    expect(r.requestHeaders?.get('X-Olumi-Assist-Key')).toBe(FAKE_KEY)
  })

  it('ON-LIST /bff/collab/rounds/{uuid}/disagreement (GET) forwards — D2 owner view', async () => {
    /**
     * ⚠ THIS CASE EXISTS BECAUSE THE ESTATE HAS ALREADY MADE THIS EXACT MISTAKE
     * ONCE THIS WEEK — see the `preview` case above, OFF-LIST while two comments
     * in the proxy advertised it. A CEE route plus a UI caller plus a green
     * suite on both sides is fully consistent with every request 404ing HERE,
     * and nothing in either repo names the cause. The allowlist is a derived-then-
     * frozen list: it is a hand-maintained mirror and it needs a test per entry.
     */
    const uuid = 'c261b74a-c7ce-4aad-96ca-04f0fdfd0fce'
    const r = await invoke(collabHandler as Handler, {
      path: `/bff/collab/rounds/${uuid}/disagreement`,
      method: 'GET',
    })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe(
      `https://cee-staging.onrender.com/collab/v1/rounds/${uuid}/disagreement`,
    )
    expect(r.requestHeaders?.get('X-Olumi-Assist-Key')).toBe(FAKE_KEY)
  })

  it('ON-LIST /bff/collab/packet/{uuid}/disagreement (GET) forwards — D2 participant view', async () => {
    const uuid = 'c261b74a-c7ce-4aad-96ca-04f0fdfd0fce'
    const r = await invoke(collabHandler as Handler, {
      path: `/bff/collab/packet/${uuid}/disagreement`,
      method: 'GET',
    })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe(
      `https://cee-staging.onrender.com/collab/v1/packet/${uuid}/disagreement`,
    )
  })

  it('OFF-LIST /bff/collab/rounds/{uuid}/disagreements is 404 — the D2 entry is exact', async () => {
    // The DISCRIMINATING half. One character longer, and it must still 404: a
    // regex written without its `$` anchor, or with the segment loosened, would
    // admit this and every other sibling under /rounds/{id}/.
    const uuid = 'c261b74a-c7ce-4aad-96ca-04f0fdfd0fce'
    const r = await invoke(collabHandler as Handler, {
      path: `/bff/collab/rounds/${uuid}/disagreements`,
      method: 'GET',
    })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('OFF-LIST /bff/collab/rounds/{uuid}/participants is 404 — preview did not widen the segment', async () => {
    // The DISCRIMINATING half of the pair above. `preview` was added as a
    // literal final segment; had it been written permissively (or the id
    // segment loosened), every sibling sub-route under /rounds/{id}/ would have
    // opened with it. This case fails if the new entry admits more than one word.
    const uuid = 'c261b74a-c7ce-4aad-96ca-04f0fdfd0fce'
    const r = await invoke(collabHandler as Handler, {
      path: `/bff/collab/rounds/${uuid}/participants`,
      method: 'GET',
    })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
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

  /**
   * D1 (review of #685) — the wildcard forms admitted the whole surface they were
   * meant to narrow. The original off-list case (`/bff/isl/admin/secrets`) picked
   * the ONE shape that avoids the wildcard, so it was a guard agreeing with itself:
   * it passed while `/api/v1/admin/secrets` forwarded WITH the bearer. These bind
   * the anchored-literal set by identity.
   */
  it('D1 OFF-LIST /bff/isl/api/v1/admin/secrets (UNDER the old /api/v1/.+ wildcard) is 404, NO bearer', async () => {
    const r = await invoke(islHandler as Handler, { path: '/bff/isl/api/v1/admin/secrets' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('D1 OFF-LIST /bff/isl/explain/anything/at/all (UNDER the old /explain/.+ wildcard) is 404, NO bearer', async () => {
    const r = await invoke(islHandler as Handler, { path: '/bff/isl/explain/anything/at/all' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('D1 ON-LIST /bff/isl/api/v1/causal/counterfactual/conformal still forwards (literal, not wildcard)', async () => {
    const r = await invoke(islHandler as Handler, {
      path: '/bff/isl/api/v1/causal/counterfactual/conformal',
    })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe(
      'https://isl-staging.onrender.com/api/v1/causal/counterfactual/conformal',
    )
  })

  it('D1 ON-LIST /bff/isl/explain/contrastive still forwards (literal, not wildcard)', async () => {
    const r = await invoke(islHandler as Handler, { path: '/bff/isl/explain/contrastive' })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe('https://isl-staging.onrender.com/explain/contrastive')
  })

  /**
   * D2 (review of #685) — isl-proxy had NO method gate while injecting a bearer,
   * the exact posture `cee-proxy.ts` names as "the gap not to copy". PUT/DELETE
   * forwarded with the credential.
   */
  it('D2 PUT on an ON-LIST isl path is 405 with NO bearer sent', async () => {
    const r = await invoke(islHandler as Handler, { path: '/bff/isl/validate', method: 'PUT' })
    expect(r.status).toBe(405)
    expect(r.fetchCalled).toBe(false)
  })

  it('D2 DELETE on an ON-LIST isl path is 405 with NO bearer sent', async () => {
    const r = await invoke(islHandler as Handler, { path: '/bff/isl/validate', method: 'DELETE' })
    expect(r.status).toBe(405)
    expect(r.fetchCalled).toBe(false)
  })

  it('D2 the advertised Access-Control-Allow-Methods matches what is ENFORCED (no false guarantee)', async () => {
    ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => FAKE_KEY } }
    const res = await (islHandler as Handler)(
      new Request('https://staging--olumi.netlify.app/bff/isl/health', {
        method: 'OPTIONS',
        headers: { origin: ALLOWED_ORIGIN },
      }),
      {},
    )
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, POST, OPTIONS')
  })
})

/* ── D3 + regex-tightening pins (review of #685) ────────────────────────────── */
describe('traversal check is scoped to the PATH, not the query string (D3)', () => {
  it('ON-LIST /bff/cee/ask?q=a%2Fb forwards — an encoded slash in the QUERY must not 404', async () => {
    const r = await invoke(ceeHandler as Handler, { path: '/bff/cee/ask?q=a%2Fb' })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe('https://cee-staging.onrender.com/assist/v1/ask?q=a%2Fb')
    expect(r.requestHeaders?.get('X-Olumi-Assist-Key')).toBe(FAKE_KEY)
  })

  it('the PATH form is still rejected — scoping to pathname does not weaken the guard', async () => {
    const r = await invoke(ceeHandler as Handler, { path: '/bff/cee/scenarios/a%2Fb/graph' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })
})

describe('orchestrator v1 turn family is allowed (pins the v\\d+ regex against a tightening)', () => {
  // turnService.ts builds `/bff/orchestrate/v1/turn` and derives `/stream` from it.
  it.each([
    ['/bff/orchestrate/v1/turn', 'https://cee-staging.onrender.com/orchestrate/v1/turn'],
    [
      '/bff/orchestrate/v1/turn/stream',
      'https://cee-staging.onrender.com/orchestrate/v1/turn/stream',
    ],
    ['/bff/orchestrate/v1/turn/stop', 'https://cee-staging.onrender.com/orchestrate/v1/turn/stop'],
  ])('ON-LIST %s forwards WITH the injected key', async (path, expectedUrl) => {
    const r = await invoke(orchestratorHandler as Handler, { path })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe(expectedUrl)
    expect(r.requestHeaders?.get('X-Olumi-Assist-Key')).toBe(FAKE_KEY)
  })
})

/* ── /bff/engine/* → PLoT — the seam the published bearer used to authenticate ── */
describe('plot-proxy path allowlist (/bff/engine/* → plot-lite-service)', () => {
  /**
   * ⚠ THIS PROXY SHIPPED WITHOUT AN ALLOWLIST AND WAS THE ONLY ONE OF FIVE THAT DID.
   *
   * It was added to move PLoT's bearer out of the browser bundle, where Vite had
   * been inlining it as a public literal. That fixed WHO HOLDS the credential and
   * left WHAT IT REACHES unbounded: every path under `/bff/engine/*` was forwarded
   * with the bearer attached, so any visitor was an authenticated caller across
   * PLoT's entire surface. Narrower than a published credential, and still the same
   * blast-radius shape — moved to the edge rather than removed.
   *
   * The bearer here rides `Authorization`, not `X-Olumi-Assist-Key`, so these cases
   * assert on that header by name; a copy-paste of the sibling assertions above
   * would have passed vacuously on a header this proxy never sets.
   */
  it('ON-LIST /bff/engine/v2/run forwards WITH the injected bearer', async () => {
    const r = await invoke(plotHandler as Handler, { path: '/bff/engine/v2/run' })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe('https://plot-lite-service-staging.onrender.com/v2/run')
    expect(r.requestHeaders?.get('Authorization')).toBe(`Bearer ${FAKE_KEY}`)
    expect(r.status).toBe(200)
  })

  it('ON-LIST /bff/engine/v1/cee/draft-graph forwards — the retired cross-origin seam', async () => {
    // The one call that used to go browser→PLoT directly, via VITE_CEE_DRAFT_BASE.
    // It now traverses this proxy, so it must be on the list or drafting 404s.
    const r = await invoke(plotHandler as Handler, {
      path: '/bff/engine/v1/cee/draft-graph',
    })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe(
      'https://plot-lite-service-staging.onrender.com/v1/cee/draft-graph',
    )
    expect(r.requestHeaders?.get('Authorization')).toBe(`Bearer ${FAKE_KEY}`)
  })

  it('OFF-LIST /bff/engine/v1/run/{id}/cancel is 404 with NO bearer sent', async () => {
    // FLIPPED FROM ON-LIST TO OFF-LIST, deliberately. `/v1/run/:id/cancel` was
    // removed from the allowlist when its caller was deleted — there is no
    // browser→PLoT run to cancel any more.
    //
    // ⚠ This test was the PLoT handler's ONLY dynamic-segment case, so flipping
    // it would have silently dropped that coverage. The replacement below pins
    // the same property on the surviving dynamic route rather than asserting,
    // as an earlier draft of this comment wrongly did, that it was covered
    // somewhere else already.
    const runId = 'run-2f9c1a4e'
    const r = await invoke(plotHandler as Handler, {
      path: `/bff/engine/v1/run/${runId}/cancel`,
    })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
    expect(r.requestHeaders?.get('Authorization')).toBeFalsy()
  })

  it('ON-LIST /bff/engine/v1/templates/{id}/graph forwards (dynamic id honoured)', async () => {
    // Replaces the dynamic-segment coverage lost when `/v1/run/:id/cancel` left
    // the list. Template LOADING survives the run-seam retirement, so this is
    // now the PLoT handler's live dynamic route.
    const templateId = 'pricing-strategy'
    const r = await invoke(plotHandler as Handler, {
      path: `/bff/engine/v1/templates/${templateId}/graph`,
    })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe(
      `https://plot-lite-service-staging.onrender.com/v1/templates/${templateId}/graph`,
    )
    expect(r.requestHeaders?.get('Authorization')).toBe(`Bearer ${FAKE_KEY}`)
  })

  it('ON-LIST a query string does NOT change the route decision', async () => {
    // The allowlist matches the pathname only. `?schema=v3` rides draft-graph on
    // every real call, so a matcher that included the query would 404 the live seam.
    const r = await invoke(plotHandler as Handler, {
      path: '/bff/engine/v1/cee/draft-graph?schema=v3',
    })
    expect(r.fetchCalled).toBe(true)
    expect(r.calledUrl).toBe(
      'https://plot-lite-service-staging.onrender.com/v1/cee/draft-graph?schema=v3',
    )
  })

  it('OFF-LIST /bff/engine/v1/counterfactual is 404 with NO bearer sent', async () => {
    // A REAL registered PLoT route the UI does not call — the discriminating case.
    // An off-list test that picked a nonsense path would pass against a wildcard.
    const r = await invoke(plotHandler as Handler, { path: '/bff/engine/v1/counterfactual' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('OFF-LIST /bff/engine/v1/admin/secrets is 404 with NO bearer sent', async () => {
    const r = await invoke(plotHandler as Handler, { path: '/bff/engine/v1/admin/secrets' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('OFF-LIST the bare mount /bff/engine is 404 with NO bearer sent', async () => {
    const r = await invoke(plotHandler as Handler, { path: '/bff/engine' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('OFF-LIST /bff/engine/v2/run/extra is 404 — anchors, not prefixes', async () => {
    // Pins that the entries are anchored. If `/v2/run` were ever written as a
    // prefix match, this would forward and the list would have stopped bounding
    // anything below it.
    const r = await invoke(plotHandler as Handler, { path: '/bff/engine/v2/run/extra' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('TRAVERSAL /bff/engine/v1/run/abc%2f..%2fadmin/cancel is 404 with NO bearer sent', async () => {
    // The dynamic segment is deliberately permissive ([^/]+) so real run ids never
    // false-404 — which is exactly why the traversal check is independently
    // load-bearing here rather than redundant with the allowlist.
    const r = await invoke(plotHandler as Handler, {
      path: '/bff/engine/v1/run/abc%2f..%2fadmin/cancel',
    })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('TRAVERSAL /bff/engine/%2e%2e/v1/admin is 404 with NO bearer sent', async () => {
    const r = await invoke(plotHandler as Handler, { path: '/bff/engine/%2e%2e/v1/admin' })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })

  it('the SECOND mount /engine/* is bounded by the same list', async () => {
    // `MOUNTS` serves both prefixes. A guard applied to only one of them would
    // leave the other wide open, and every assertion above would still pass.
    const on = await invoke(plotHandler as Handler, { path: '/engine/v2/run' })
    expect(on.fetchCalled).toBe(true)
    expect(on.calledUrl).toBe('https://plot-lite-service-staging.onrender.com/v2/run')

    const off = await invoke(plotHandler as Handler, { path: '/engine/v1/admin/secrets' })
    expect(off.status).toBe(404)
    expect(off.fetchCalled).toBe(false)
  })
})

describe('double-encoded traversal is harmless BY SHAPE (pinned, not left unobserved)', () => {
  /**
   * `%252e` does NOT match the traversal regex (`%2e` is not a substring of `%252e`).
   * It is rejected by the ALLOWLIST instead: the literal segment cannot match any
   * enumerated route. Pinned so the mechanism is observed rather than assumed — if a
   * future decode step were added, this case would change hands and the test says so.
   */
  it('/bff/cee/%252e%252e/assist/v1/decision-review is 404 with NO key sent', async () => {
    const r = await invoke(ceeHandler as Handler, {
      path: '/bff/cee/%252e%252e/assist/v1/decision-review',
    })
    expect(r.status).toBe(404)
    expect(r.fetchCalled).toBe(false)
  })
})
