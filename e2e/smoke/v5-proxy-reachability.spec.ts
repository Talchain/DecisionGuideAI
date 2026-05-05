// e2e/smoke/v5-proxy-reachability.spec.ts
// @smoke — Transport gate for the /proxy/v5/turn deployed path.
//
// IMPORTANT: this is NOT a UI journey test. It uses Playwright's `request`
// fixture to make a direct HTTP call to the deployed CEE proxy. It does
// not open a browser context, does not load the deployed UI, and cannot
// prove that the UI itself uses the proxy path versus the deprecated
// Netlify Edge route. A real-browser journey smoke is tracked as a P1
// follow-up in docs/v5-testing-audit-ui.md.
//
// Why this file lives in the UI repo: it gives operations a quick way to
// verify proxy reachability from the UI repo's tooling without a CEE
// checkout. The canonical proxy reachability test lives in CEE at
// `tests/staging/proxy-v5-hiring-prompt.smoke.test.ts`; this spec is the
// operational counterpart, intentionally a duplicate at the contract
// layer.
//
// MUST NOT be wired in as a UI deploy acceptance gate. Passing this spec
// proves only that the CEE proxy is reachable and well-formed — it does
// NOT prove the deployed UI bundle is configured to use that proxy. A
// UI deploy can be totally broken (wrong VITE_V5_ENDPOINT, missing flag,
// stale chunk) while this spec stays green. Use the existing
// `e2e/smoke/v5-exclusive-routing.spec.ts` (negative gate) plus the
// real-browser journey smoke tracked as P1 in `docs/v5-testing-audit-ui.md`
// for UI deploy acceptance.
//
// Scope (what this can prove):
//   - the deployed CEE proxy is reachable from this network
//   - OPTIONS preflight is handled without crashing (regression for the
//     CEE OPTIONS 500; commit c73d1469)
//   - the response actually came from the CEE Fastify process (asserted
//     via x-olumi-service: cee + x-olumi-service-build headers)
//   - the response carries a non-empty draft_graph and analysis_ready === ready
//   - no service-key or token leakage in the response body
//
// Out of scope:
//   - UI endpoint resolution / browser CORS / canvas render / result
//     consumption / rerun state / debug export — those need a browser
//     journey smoke against the deployed UI URL (P1).
//
// Gating (self-skipping):
//   - RUN_STAGING_E2E=1
//   - STAGING_CEE_PROXY_URL              (host that exposes /proxy/v5/turn,
//                                          e.g. https://cee-staging.onrender.com.
//                                          Named with a CEE_ infix to make
//                                          clear this is the CEE proxy, not
//                                          the deployed UI URL.)
//   - STAGING_CEE_PROXY_ALLOWED_ORIGIN   (an origin allowlisted by
//                                          BROWSER_PROXY_ALLOWED_ORIGINS on
//                                          the target, e.g.
//                                          https://staging--olumi.netlify.app)
//
// Without all three the spec is skipped silently. No request is made.

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const RUN_STAGING_E2E = process.env.RUN_STAGING_E2E === '1'
const STAGING_CEE_PROXY_URL = process.env.STAGING_CEE_PROXY_URL
const STAGING_CEE_PROXY_ALLOWED_ORIGIN = process.env.STAGING_CEE_PROXY_ALLOWED_ORIGIN

const SHOULD_RUN =
  RUN_STAGING_E2E && !!STAGING_CEE_PROXY_URL && !!STAGING_CEE_PROXY_ALLOWED_ORIGIN

const HIRING_BRIEF =
  'Should I hire a tech lead or two developers to increase productivity?'

// Long enough to absorb a real V5 draft graph turn (40–60 s typical) plus
// margin. Below the proxy's BROWSER_PROXY_TIMEOUT_MS (~125 s) so internal
// failures surface as a 5xx rather than this fetch timing out.
const SMOKE_TIMEOUT_MS = 110_000
// Preflight is handled by @fastify/cors and should be fast; an independent
// budget keeps preflight diagnostics readable when the POST is slow.
const PREFLIGHT_TIMEOUT_MS = 15_000

const SECRET_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'olumi assist key header value', re: /X-Olumi-Assist-Key/i },
  { name: 'supabase service_role token', re: /service_role/i },
  { name: 'bearer token', re: /Bearer\s+[A-Za-z0-9._-]{20,}/i },
  { name: 'anthropic api key', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'openai api key', re: /sk-[A-Za-z0-9]{32,}/ },
  {
    name: 'private jwt',
    re: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+/,
  },
]

function proxyUrl(): string {
  return `${STAGING_CEE_PROXY_URL!.replace(/\/$/, '')}/proxy/v5/turn`
}

/** Bounded, non-leaky host token for triage logs (no path, no query, no auth). */
function hostFor(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return '<invalid-url>'
  }
}

test.skip(
  !SHOULD_RUN,
  'staging E2E disabled (set RUN_STAGING_E2E=1 + STAGING_CEE_PROXY_URL + STAGING_CEE_PROXY_ALLOWED_ORIGIN)',
)

/** Case-insensitive contains-all check on a comma-separated header list. */
function headerListContainsAll(
  raw: string | null | undefined,
  required: ReadonlyArray<string>,
): { ok: true } | { ok: false; missing: string[] } {
  if (!raw) return { ok: false, missing: [...required] }
  const present = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
  const missing = required.filter((h) => !present.has(h.toLowerCase()))
  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}

test('OPTIONS /proxy/v5/turn handles empty-body preflight without 500', async ({
  request,
}) => {
  test.setTimeout(PREFLIGHT_TIMEOUT_MS + 5_000)

  const url = proxyUrl()
  const t0 = Date.now()
  const response = await request.fetch(url, {
    method: 'OPTIONS',
    headers: {
      Origin: STAGING_CEE_PROXY_ALLOWED_ORIGIN!,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers':
        'content-type,accept,x-correlation-id,x-request-id',
    },
    timeout: PREFLIGHT_TIMEOUT_MS,
  })
  const elapsed_ms = Date.now() - t0

  const allowOrigin = response.headers()['access-control-allow-origin'] ?? null
  const allowMethods = response.headers()['access-control-allow-methods'] ?? null

  // eslint-disable-next-line no-console
  console.log(
    `[v5-proxy-reachability] OPTIONS host=${hostFor(url)} ` +
      `status=${response.status()} elapsed_ms=${elapsed_ms} ` +
      `allow_origin=${allowOrigin ?? 'none'} ` +
      `allow_methods=${allowMethods ?? 'none'}`,
  )

  // Catches the OPTIONS 500 regression directly (CEE c73d1469).
  expect(
    response.status(),
    `OPTIONS preflight returned ${response.status()}; the 500 regression was c73d1469`,
  ).toBeLessThan(500)
  expect(allowOrigin).not.toBeNull()
  expect(allowOrigin).toBe(STAGING_CEE_PROXY_ALLOWED_ORIGIN!)
  expect((allowMethods ?? '').toUpperCase()).toContain('POST')
  // Real browsers will block the POST if these headers are missing from
  // the preflight response. Asserting them surfaces CORS drift that
  // would otherwise only manifest as a "CORS error" in users' browsers.
  const allowHeadersRaw = response.headers()['access-control-allow-headers'] ?? null
  const allowHeadersCheck = headerListContainsAll(allowHeadersRaw, [
    'content-type',
    'x-request-id',
  ])
  expect(
    allowHeadersCheck.ok,
    `Access-Control-Allow-Headers missing required entries: ${
      allowHeadersCheck.ok ? '' : allowHeadersCheck.missing.join(', ')
    } (got: ${allowHeadersRaw ?? 'none'})`,
  ).toBe(true)
})

test('POST /proxy/v5/turn returns a V5 draft graph + analysis-ready envelope', async ({
  request,
}) => {
  test.setTimeout(SMOKE_TIMEOUT_MS + 10_000)

  const url = proxyUrl()
  const requestId = randomUUID()
  const body = {
    kind: 'message',
    turn_id: randomUUID(),
    scenario_id: randomUUID(),
    message: HIRING_BRIEF,
    stage: 'frame',
    turn_class: 'frame',
    generate_model: true,
  }

  const t0 = Date.now()
  const response = await request.post(url, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: STAGING_CEE_PROXY_ALLOWED_ORIGIN!,
      'X-Request-Id': requestId,
    },
    data: body,
    timeout: SMOKE_TIMEOUT_MS,
  })
  const elapsed_ms = Date.now() - t0

  const headers = response.headers()
  const contentType = headers['content-type'] ?? ''
  const text = await response.text()

  // Bounded, non-leaky log (host only, no path, no query, no auth).
  // eslint-disable-next-line no-console
  console.log(
    `[v5-proxy-reachability] POST host=${hostFor(url)} ` +
      `status=${response.status()} elapsed_ms=${elapsed_ms} bytes=${text.length} ` +
      `content_type=${contentType} ` +
      `service=${headers['x-olumi-service'] ?? 'none'} ` +
      `service_build=${headers['x-olumi-service-build'] ?? 'none'}`,
  )

  expect(response.status(), `non-200 from proxy; bytes=${text.length}`).toBe(200)
  expect(contentType).toMatch(/application\/json/)

  let envelope: Record<string, unknown> | null = null
  try {
    envelope = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`proxy returned non-JSON body (bytes=${text.length})`)
  }
  expect(envelope).not.toBeNull()

  // Proves the response came from the CEE Fastify process — closest
  // available header-level evidence the proxy path was used.
  expect(
    headers['x-olumi-service'],
    'missing x-olumi-service — response did not come from CEE',
  ).toBe('cee')
  expect(headers['x-olumi-service-build'], 'missing x-olumi-service-build').toBeTruthy()
  // Strict equality on x-request-id proves the id we sent survived the
  // proxy path verbatim. A mismatch indicates middleware is rewriting
  // the id, which would defeat correlation in production.
  expect(headers['x-request-id'], 'missing x-request-id echo').toBeTruthy()
  expect(
    headers['x-request-id'],
    `x-request-id was rewritten: sent=${requestId} got=${headers['x-request-id']}`,
  ).toBe(requestId)

  const draftGraph = envelope!.draft_graph as
    | { nodes?: unknown; edges?: unknown }
    | undefined
  expect(draftGraph, 'envelope.draft_graph present').toBeDefined()
  expect(Array.isArray(draftGraph?.nodes)).toBe(true)
  expect(Array.isArray(draftGraph?.edges)).toBe(true)
  // Non-empty: a successful hiring brief should yield at least an
  // option/factor/decision triple. Empty arrays are degenerate success.
  expect(
    (draftGraph!.nodes as unknown[]).length,
    'draft_graph.nodes is empty — degenerate success',
  ).toBeGreaterThan(0)
  expect(
    (draftGraph!.edges as unknown[]).length,
    'draft_graph.edges is empty — degenerate success',
  ).toBeGreaterThan(0)

  const analysisReady = envelope!.analysis_ready as
    | { status?: unknown }
    | undefined
  expect(analysisReady?.status).toBe('ready')

  const serialised = JSON.stringify(envelope)
  for (const { name, re } of SECRET_PATTERNS) {
    expect(re.test(serialised), `response leaked: ${name}`).toBe(false)
  }
})
