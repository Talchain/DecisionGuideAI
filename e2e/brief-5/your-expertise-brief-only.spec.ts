/**
 * Brief 5 follow-up IMP-3: Playwright smoke for the brief-only YourExpertise
 * branch (P1-2 regression fix).
 *
 * Brief 5.1 follow-up P1 #2: tightened the deep-link assertion so the
 * test actually confirms the Model-tab switch landed instead of waiting
 * 100ms and hoping. The skip-heavy sandbox-seeding path remains; it
 * reflects a real gap — the sandbox's e2e entry points don't expose a
 * "seed a brief-only YourExpertise" handle, so we skip rather than
 * assert against a state that didn't occur. The skip is loud (explicit
 * message naming the missing seed) so anyone reading CI output knows
 * this is coverage debt, not a passing test.
 *
 * In the seeded state the row must:
 *   - be rendered as a <button> (not a static div)
 *   - carry no chevron (no expansion affordance)
 *   - expose an "Audit in Model tab →" link
 *   - deep-link to the Model tab when clicked — asserted by waiting
 *     for the Model-tab body (data-testid="model-tab") to become
 *     visible after the click, rather than a sleep-and-hope timeout.
 *
 * Gated on BRIEF5_FULLPAGE=1 (same env gate as the full-page baseline) so
 * the default CI run doesn't pay the cost. Local use:
 *
 *   BRIEF5_FULLPAGE=1 npx playwright test e2e/brief-5/your-expertise-brief-only.spec.ts
 */

import { test, expect } from '@playwright/test'
import { gotoSandbox } from '../_helpers'

test.describe('Brief 5 brief-only YourExpertise smoke', () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.BRIEF5_FULLPAGE,
      'Set BRIEF5_FULLPAGE=1 to run Brief 5 Playwright smokes.',
    )
  })

  test('brief-only row is a button with no chevron and deep-links to Model tab @brief-5', async ({ page }) => {
    await gotoSandbox(page)

    const section = page.getByTestId('your-expertise-section')
    // If the sandbox's seeded scenario doesn't land on the brief-only branch,
    // skip with a seed-specific message — this is a sandbox-seed gap, not a
    // product regression. Adding a dedicated seed (e.g. ?seed=brief-only)
    // is the durable fix; tracked in the Brief 5.1 final-review doc.
    if (!(await section.isVisible().catch(() => false))) {
      test.skip(true, 'COVERAGE-DEBT: YourExpertise not rendered in default sandbox state. Add a brief-only seed entry point to the sandbox to close this.')
      return
    }

    const modelLink = section.getByTestId('your-expertise-model-link')
    const header = section.getByTestId('your-expertise-header')

    const hasModelLink = await modelLink.isVisible().catch(() => false)
    const hasExpansionHeader = await header.isVisible().catch(() => false)
    if (!hasModelLink || hasExpansionHeader) {
      test.skip(true, 'COVERAGE-DEBT: Sandbox state is not the brief-only branch. Seed a brief-only scenario to exercise this path.')
      return
    }

    // Brief-only branch confirmed — static surface assertions:
    const tagName = await section.evaluate(el => el.tagName.toLowerCase())
    expect(tagName).toBe('button')
    await expect(section).toHaveAttribute('aria-label', /Model tab/)
    await expect(modelLink).toBeVisible()
    await expect(modelLink).toHaveText(/Audit in Model tab/)

    // Deep-link: clicking the row must land on the Model tab. Assert the
    // model-tab body is visible after the click — deterministic, replaces
    // the earlier sleep-and-hope waitForTimeout(100). If the click fails
    // to switch tabs, this fails with a clear timeout rather than passing
    // silently.
    await section.click()
    await expect(page.getByTestId('model-tab')).toBeVisible({ timeout: 2000 })
  })
})
