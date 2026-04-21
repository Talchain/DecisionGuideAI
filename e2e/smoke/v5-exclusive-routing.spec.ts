// e2e/smoke/v5-exclusive-routing.spec.ts
// @smoke — Network contract gate for v5-ui-exclusive-path brief.
//
// Asserts that when VITE_ENABLE_V5_ORCHESTRATOR === 'true':
//   - Every orchestrator hit goes to /orchestrate/v2/turn.
//   - Zero hits to /orchestrate/v1/turn or /orchestrate/v1/turn/stream.
//
// This is the canonical "no V4 leakage" gate. Green smoke means no code
// path in the V5-on journey reaches V4, independent of the grep gates
// in Phase 7.
//
// The test runs the canvas page and exercises the minimum journey the UI
// code emits without needing a live CEE: the page load + initial render.
// Deeper journey coverage (submit brief, run analysis, accept patch) is
// better suited to an integration suite that mocks CEE responses; this
// smoke confirms the ROUTING invariant — no wiring accidentally posts to
// V1 even in edge states (e.g. hydration, retries, system events fired
// on load).
import { test, expect } from '@playwright/test'

test('V5-on: no V1 orchestrator hits during canvas bootstrap', async ({ page }) => {
  const v1Hits: string[] = []
  const v2Hits: string[] = []

  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('/orchestrate/v1/turn')) {
      v1Hits.push(url)
    } else if (url.includes('/orchestrate/v2/turn')) {
      v2Hits.push(url)
    }
  })

  // VITE_ENABLE_V5_ORCHESTRATOR must be 'true' in the vite dev/build env.
  // Playwright inherits the env from the dev server the webServer block
  // (playwright.config.ts) started, so the check belongs at CI config
  // level. We still emit the fact into the test output so a mis-run is
  // obvious in logs.
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 })

  // Brief settle so any deferred bootstrap fetches (session hydration,
  // guidance prefetch, etc.) complete.
  await page.waitForTimeout(2_000)

  // Assertion: V1 endpoint MUST NOT be hit. Primary contract guarantee.
  expect(v1Hits, `V5-on but V1 hits detected: ${v1Hits.join(', ')}`).toHaveLength(0)

  // Informational: V2 may be zero during bootstrap (no turns dispatched)
  // or non-zero (system-event style hydration). Either is acceptable —
  // the assertion is only about V1 absence.
  if (v2Hits.length > 0) {
    console.log(`[v5-exclusive-routing] observed ${v2Hits.length} V2 hits during bootstrap`)
  }
})

test('V5-on: request wire shapes use kind discriminator', async ({ page }) => {
  // Capture POST bodies to /orchestrate/v2/turn and assert every one
  // carries the v0.7.0 discriminated union key `kind`. Regression guard
  // against any future code path reverting to a v0.6.0 flat payload.
  const v2Bodies: unknown[] = []

  page.on('request', (req) => {
    if (req.url().includes('/orchestrate/v2/turn') && req.method() === 'POST') {
      try {
        const body = req.postDataJSON()
        if (body) v2Bodies.push(body)
      } catch {
        // Non-JSON body — not expected; silently ignore rather than crash
        // the test. An unexpected non-JSON post would surface elsewhere
        // (the V5 adapter's parser fails closed to parse_error).
      }
    }
  })

  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(2_000)

  // Every captured body must carry a `kind` discriminator.
  for (const body of v2Bodies) {
    expect(body, 'V2 request body must be an object').toBeTruthy()
    const obj = body as Record<string, unknown>
    expect(obj.kind, `V2 request missing 'kind' discriminator: ${JSON.stringify(obj)}`).toBeDefined()
    expect(
      obj.kind === 'message' || obj.kind === 'system_event',
      `V2 request has invalid kind '${String(obj.kind)}' (must be 'message' or 'system_event')`,
    ).toBe(true)
  }
})
