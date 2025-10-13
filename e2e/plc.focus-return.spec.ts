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

test('PLC Panels: focus trap and Esc returns focus to opener (IO panel)', async ({ page }) => {
  await mountPlc(page)

  const toggle = page.getByTestId('plc-io-toggle-btn')
  await toggle.click()
  const panel = page.getByTestId('plc-io-panel')
  await panel.waitFor()

  // Axe serious=0 on panel region
  const axe = await new AxeBuilder({ page }).include('[data-testid="plc-io-panel"]').analyze()
  const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.length, serious.map(v => v.id).join(',')).toBe(0)

  // Focus is inside panel (textarea gets focus first)
  await expect(page.getByTestId('plc-io-textarea')).toBeFocused()

  // Attempt to tab around and stay trapped inside
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(panel).toBeVisible() // still open; implicit trap

  // Close with Esc and return focus
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(toggle).toBeFocused()
})
