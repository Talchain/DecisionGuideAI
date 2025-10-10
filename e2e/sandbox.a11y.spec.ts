import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const ROUTE = process.env.E2E_ROUTE ?? '/#/test'

async function dismissOverlay(page) {
  const overlay = page.getByTestId('onboarding-overlay')
  if (await overlay.count()) {
    const dismiss = page.getByTestId('onboarding-dismiss')
    if (await dismiss.count()) await dismiss.click()
    await expect(overlay).toHaveCount(0)
  }
}

test('A11y: axe serious violations = 0', async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('whiteboard-canvas').waitFor({ state: 'visible' })
  await dismissOverlay(page)

  // Exercise help popover and toolbar buttons minimally
  await page.getByTestId('sandbox-help').click()
  await expect(page.getByTestId('help-popover')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('help-popover')).toHaveCount(0)

  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(v => (v.impact === 'serious' || v.impact === 'critical'))
  if (serious.length === 0) {
    console.log('GATES: PASS — a11y (0 serious)')
  }
  expect(serious.length, serious.map(v => v.id).join(', ')).toBe(0)
})
