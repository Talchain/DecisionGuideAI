// e2e/smoke/v5-hiring-prompt.spec.ts
// @smoke — Deployed-path proxy reachability smoke for V5.
//
// Why this exists: the existing v5-exclusive-routing smoke proves the UI
// does not hit the V1 orchestrator during canvas bootstrap. Nothing in the
// suite proves the DEPLOYED V5 transport path actually returns a usable
// envelope — the path that production uses to bypass the Netlify Edge
// timeout: browser → /proxy/v5/turn (CEE-hosted) → app.inject() →
// /orchestrate/v2/turn.
//
// This smoke makes a direct HTTP request from Playwright's `request`
// fixture to the deployed proxy, with the canonical hiring brief, and
// asserts: 200 + JSON envelope + draft_graph + analysis_ready === ready
// + no service-key or token leakage.
//
// It does NOT drive the DraftChat composer — a journey-driven E2E is
// tracked as P1 in Docs/v5-testing-audit-ui.md. Composer selectors and
// live staging coordination are not safe to author without verification.
//
// Gating (self-skipping):
//   - RUN_STAGING_E2E=1
//   - STAGING_PROXY_URL              (e.g. https://cee-staging.onrender.com)
//   - STAGING_PROXY_ALLOWED_ORIGIN   (an origin allowlisted by
//                                    BROWSER_PROXY_ALLOWED_ORIGINS on the
//                                    target, e.g. https://staging--olumi.netlify.app)
//
// Without all three, the test is skipped silently. No request is made.

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const RUN_STAGING_E2E = process.env.RUN_STAGING_E2E === '1'
const STAGING_PROXY_URL = process.env.STAGING_PROXY_URL
const STAGING_PROXY_ALLOWED_ORIGIN = process.env.STAGING_PROXY_ALLOWED_ORIGIN

const SHOULD_RUN =
  RUN_STAGING_E2E && !!STAGING_PROXY_URL && !!STAGING_PROXY_ALLOWED_ORIGIN

const HIRING_BRIEF =
  'Should I hire a tech lead or two developers to increase productivity?'

// Below the proxy's BROWSER_PROXY_TIMEOUT_MS (~125 s); long enough for a
// real V5 draft graph turn (40–60 s typical) plus margin.
const SMOKE_TIMEOUT_MS = 110_000

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

test.skip(!SHOULD_RUN, 'staging E2E disabled (set RUN_STAGING_E2E=1 + STAGING_PROXY_URL + STAGING_PROXY_ALLOWED_ORIGIN)')

test('POST /proxy/v5/turn returns a V5 draft graph + analysis-ready envelope', async ({
  request,
}) => {
  test.setTimeout(SMOKE_TIMEOUT_MS + 10_000)

  const url = `${STAGING_PROXY_URL!.replace(/\/$/, '')}/proxy/v5/turn`
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
      Origin: STAGING_PROXY_ALLOWED_ORIGIN!,
      'X-Request-Id': randomUUID(),
    },
    data: body,
    timeout: SMOKE_TIMEOUT_MS,
  })
  const elapsed_ms = Date.now() - t0

  const contentType = response.headers()['content-type'] ?? ''
  const text = await response.text()

  // Bounded, non-leaky log.
  // eslint-disable-next-line no-console
  console.log(
    `[v5-hiring-prompt] status=${response.status()} elapsed_ms=${elapsed_ms} ` +
      `bytes=${text.length} content_type=${contentType}`,
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
  const draftGraph = envelope!.draft_graph as
    | { nodes?: unknown; edges?: unknown }
    | undefined
  expect(draftGraph, 'envelope.draft_graph present').toBeDefined()
  expect(Array.isArray(draftGraph?.nodes)).toBe(true)
  expect(Array.isArray(draftGraph?.edges)).toBe(true)

  const analysisReady = envelope!.analysis_ready as
    | { status?: unknown }
    | undefined
  expect(analysisReady?.status).toBe('ready')

  const serialised = JSON.stringify(envelope)
  for (const { name, re } of SECRET_PATTERNS) {
    expect(re.test(serialised), `response leaked: ${name}`).toBe(false)
  }
})
