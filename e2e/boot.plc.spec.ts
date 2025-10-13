import { test, expect } from '@playwright/test'

test.describe('Boot smoke: /#/plc', () => {
  test('PLC Lab renders whiteboard', async ({ page }) => {
    await page.goto('/#/plc', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => location.hash === '#/plc')

    // Wait for PLC Lab to mount
    await page.waitForSelector('[data-testid="plc-whiteboard"]', { timeout: 10000 })

    // Verify PLC Lab whiteboard is visible
    const whiteboard = page.getByTestId('plc-whiteboard')
    await expect(whiteboard).toBeVisible()

    // Verify no "disabled" message
    const disabledMsg = page.getByText(/PLC.*disabled/i)
    await expect(disabledMsg).not.toBeVisible()
  })
})
