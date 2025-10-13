import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test.describe('Plot with PLC Canvas (flagged)', () => {
  test.skip(({ browserName }) => {
    // Only run if FEATURE_PLOT_USES_PLC_CANVAS is set
    return !process.env.FEATURE_PLOT_USES_PLC_CANVAS
  }, 'FEATURE_PLOT_USES_PLC_CANVAS not enabled')

  test('mounts PLC canvas in rich PoC shell', async ({ page }) => {
    await page.goto('/#/plot', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => location.hash === '#/plot')

    // Should see PLC canvas adapter
    await expect(page.getByTestId('plc-canvas-adapter')).toBeVisible({ timeout: 10000 })

    // Should still have rich PoC chrome (not minimal B/W lab UI)
    const bgColor = await page.locator('body').evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )
    // PoC has gradient background, not plain white
    expect(bgColor).not.toBe('rgb(255, 255, 255)')
  })

  test('Axe serious=0 on plot canvas', async ({ page }) => {
    await page.goto('/#/plot', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => location.hash === '#/plot')
    await page.waitForSelector('[data-testid="plc-canvas-adapter"]', { timeout: 10000 })

    const results = await new AxeBuilder({ page })
      .include('[data-testid="plc-canvas-adapter"]')
      .analyze()

    const serious = results.violations.filter(
      v => v.impact === 'serious' || v.impact === 'critical'
    )
    expect(serious.length, serious.map(v => v.id).join(', ')).toBe(0)
  })
})
