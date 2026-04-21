// e2e/smoke/v5-exclusive-routing.spec.ts
// @smoke — Network contract gate for v5-ui-exclusive-path brief.
//
// Scope: asserts the PRIMARY contract guarantee — when
// VITE_ENABLE_V5_ORCHESTRATOR === 'true' the UI makes **zero hits to the
// V1 orchestrator endpoints**. Any V1 leakage fails the smoke.
//
// What this smoke does NOT do:
//   - Drive a scripted user journey (send, chip click, retry, patch accept).
//     A journey smoke would be the ideal "positive" gate but requires a
//     live staging CEE + chat-composer selectors that are out of scope
//     for a bootstrap-only smoke.
//   - Validate V2 request body shapes. Counting V2 POST bodies during
//     bootstrap is non-deterministic — a session with no auto-turn fires
//     zero posts and the assertion becomes vacuous. A journey-driven
//     follow-up test should own that coverage; tracked as
//     "reviewer improvement #1" in docs/brief-v5-exclusive-ui-walkthrough.md.
//
// The ABSENCE assertion below is deterministic regardless of bootstrap
// traffic: zero V1 hits is the invariant we care about.
import { test, expect } from '@playwright/test'

test('V5-on: zero V1 orchestrator hits during canvas bootstrap', async ({ page }) => {
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

  // VITE_ENABLE_V5_ORCHESTRATOR must be 'true' in the dev/build env the
  // Playwright webServer launches with. That's configured at the CI/config
  // level (playwright.config.ts's webServer.env or the runner's inherited
  // env), not in the test itself.
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 })

  // Settle any deferred bootstrap fetches (session hydration, guidance
  // prefetch, etc.) before asserting.
  await page.waitForTimeout(2_000)

  // Primary contract: V1 endpoint MUST NOT be hit. A failing assertion
  // here means a V5-enabled code path has leaked a V1 request — the
  // exact regression this brief exists to prevent.
  expect(v1Hits, `V5-on but V1 hits detected: ${v1Hits.join(', ')}`).toHaveLength(0)

  // Informational signal only — not an assertion. A zero-V2 bootstrap is
  // legitimate (no auto-turn fired). Emit the count so test logs record
  // what traffic the smoke observed.
  console.log(
    `[v5-exclusive-routing] bootstrap captured ${v2Hits.length} V2 hit(s), ${v1Hits.length} V1 hit(s)`,
  )
})
