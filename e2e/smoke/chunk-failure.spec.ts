// e2e/smoke/chunk-failure.spec.ts
// @smoke - a failed chunk shows the stale-build recovery surface, not a blank page
//
// ⚠ THIS SPEC'S EXPECTATION WAS DELIBERATELY CHANGED, AND HERE IS WHY.
// It used to assert `text=/error|something went wrong|failed to load/i`. That
// matched because a failed chunk produced "Render Error ❌" / "Something went
// wrong" — copy that is FALSE for this situation: nothing failed to render and
// no error occurred that the user caused or can act on. The build moved.
//
// The regex was widened by nobody; it is REPLACED with an assertion about the
// behaviour we actually want, bound BY IDENTITY to the single copy constant in
// src/lib/staleBuildRecovery.ts rather than to a literal copied into this file.
// A copied sentence is a hand-maintained mirror: it would keep passing after
// the product's wording changed underneath it.
//
// Two arms, because the surface must be right AND reachable:
//   · the truthful notice is visible (not a blank page, not a crash panel);
//   · a reload affordance is offered — a diagnosis with no way forward was the
//     original defect.
import { test, expect } from '@playwright/test'
import { STALE_BUILD_NOTICE_COPY } from '../../src/lib/staleBuildRecovery'

test('chunk failure shows the truthful stale-build notice with a way forward', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  // Intercept and fail one chunk request — the deploy race, simulated.
  await page.route('**/assets/canvas-*.js', (route) => route.abort('failed'))

  await page.goto('/#/canvas')

  // The recovery surface, by its own words. Either boundary may catch this
  // (boot or canvas) — both now render the same sentence from the same module,
  // which is the point of the convergence.
  await expect(page.getByText(STALE_BUILD_NOTICE_COPY)).toBeVisible({ timeout: 10_000 })

  // A way forward, not just a diagnosis.
  await expect(page.getByRole('button', { name: /reload/i }).first()).toBeVisible()

  // The failure must still be reported, not swallowed.
  expect(consoleErrors.length).toBeGreaterThan(0)
})

test('a TRANSIENT chunk failure self-recovers without bothering the user', async ({ page }) => {
  // ⚠ NOTE THE CONTRAST WITH THE TEST ABOVE, AND WHY IT IS NOT THE SAME TEST.
  // There the chunk fails EVERY time, so the one automatic reload is spent and
  // the user is shown the notice. Here it fails ONCE: the automatic reload
  // succeeds, and the correct outcome is that the user sees a working canvas
  // and NO notice at all. Asserting the notice here would be asserting that
  // recovery failed.
  let failCount = 0

  await page.route('**/assets/canvas-*.js', (route) => {
    if (failCount === 0) {
      failCount++
      route.abort('failed')
    } else {
      route.continue()
    }
  })

  await page.goto('/#/canvas')

  // The app reloads itself once and comes up working.
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 20_000 })
  // The chunk really did fail once — otherwise this test proves nothing.
  expect(failCount).toBe(1)
  await expect(page.getByText(STALE_BUILD_NOTICE_COPY)).toHaveCount(0)
})
