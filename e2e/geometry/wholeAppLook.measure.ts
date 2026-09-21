/**
 * WHOLE-APP LOOK — the canvas and the dock in one frame, at a real viewport.
 *
 * ⚠ WHY A WHOLE-APP CAPTURE AND NOT MORE COMPONENT ONES. Every recent panel
 * change has been adjudicated on a crop of the thing being changed, which is
 * how a surface can improve component by component while the SCREEN gets
 * busier. This photographs what a person actually sees, so composition —
 * balance, competing borders, how much of the frame the chrome takes — can be
 * judged instead of inferred.
 *
 * ⚠ NOT A PIXEL REFERENCE AND MUST NEVER BE PROMOTED TO ONE. The pinned
 * Playwright build ships no browser in this image, so this launches the
 * installed 1194 chrome by path — a different renderer build.
 *
 * Asserts nothing; it is an instrument. Run deliberately:
 *   pnpm exec playwright test -c playwright.geometry.config.ts \
 *     e2e/geometry/wholeAppLook.measure.ts
 */
import { test, expect, type Page } from '@playwright/test'
import {
  clearNotifications,
  freezeMotion,
  openCanvas,
  preparePage,
  seedStarterDraft,
  waitForVisualQuiescence,
  type StarterId,
} from '../visual/harness'

const VP = { width: 1440, height: 900 }
const OUT = process.env.SHOT_DIR ?? 'test-results/look'

test.use({
  launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
})

async function seeded(page: Page, starter: StarterId) {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, starter)
  await clearNotifications(page)
  await freezeMotion(page)
  await waitForVisualQuiescence(page)
}

async function frontTab(page: Page, tab: string) {
  const loc = page.locator(`[data-testid="outputs-dock-tab-${tab}"]`)
  if ((await loc.count()) === 0) return false
  await loc.first().click()
  await waitForVisualQuiescence(page)
  return true
}

for (const starter of ['build-vs-buy', 'pricing-model'] as const) {
  test(`WHOLE APP — ${starter}, Olumi tab`, async ({ page }) => {
    await seeded(page, starter)
    await frontTab(page, 'olumi')
    await expect(page.locator('[data-testid="outputs-dock"]')).toBeVisible()
    await page.screenshot({ path: `${OUT}/APP-${starter}-olumi.png` })
  })
}

test('WHOLE APP — build-vs-buy, Analysis tab', async ({ page }) => {
  await seeded(page, 'build-vs-buy')
  const fronted = (await frontTab(page, 'results')) || (await frontTab(page, 'analysisNew'))
  // eslint-disable-next-line no-console
  console.log(`[app] analysis tab fronted: ${fronted}`)
  await page.screenshot({ path: `${OUT}/APP-build-vs-buy-analysis.png` })
})
