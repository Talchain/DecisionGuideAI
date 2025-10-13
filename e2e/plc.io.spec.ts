import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

async function mountPlc(page: import('@playwright/test').Page) {
  await page.addInitScript(() => { try {
    localStorage.setItem('PLC_ENABLED','1')
    localStorage.setItem('plc.snap','0')
    localStorage.setItem('plc.guides','0')
    localStorage.setItem('plc.snapGuide','0')
  } catch {} })
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => location.hash === '#/plc')
  await page.getByTestId('plc-root').waitFor()
  await page.getByTestId('plc-whiteboard').waitFor()
}

test('PLC IO: invalid JSON shows banner (a11y+visual) and valid hides it', async ({ page }) => {
  await mountPlc(page)

  // Toggle ↔ panel wiring
  const toggle = page.getByTestId('plc-io-toggle-btn')
  await expect(toggle).toHaveAttribute('aria-controls', 'plc-io-panel')
  await toggle.click()

  const panel = page.getByTestId('plc-io-panel')
  await panel.waitFor()
  await expect(page.getByRole('region', { name: 'Import/Export' })).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')

  // Focus lands on textarea
  const area = page.getByTestId('plc-io-textarea')
  await expect(area).toBeFocused()

  // Paste invalid JSON and validate
  await area.fill('{')
  await page.getByTestId('plc-io-validate').click()
  const banner = page.getByTestId('plc-io-error')
  await expect(banner).toBeVisible()

  // a11y: panel scope has 0 serious/critical
  const results = await new AxeBuilder({ page }).include('[data-testid="plc-io-panel"]').analyze()
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.length, serious.map(v => v.id).join(', ')).toBe(0)

  // Visual snapshot: error state
  await expect(panel).toHaveScreenshot('plc-io-error.png')

  // Now valid minimal JSON hides banner and shows status Valid
  await area.fill('{"nodes":[{"id":"a","x":0,"y":0}],"edges":[{"from":"a","to":"a"}]}')
  await page.getByTestId('plc-io-validate').click()
  await expect(page.getByTestId('plc-io-error')).toHaveCount(0)
  await expect(page.getByTestId('plc-io-status')).toHaveText(/Valid/i)

  // Close via Esc and restore focus to toggle
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('plc-io-panel')).toHaveCount(0)
  await expect(toggle).toBeFocused()
})
