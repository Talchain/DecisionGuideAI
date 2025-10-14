import { test, expect } from '@playwright/test'

test.describe('Plot Canvas Gating', () => {
  test('?plc=0 forces legacy', async ({ page }) => {
    await page.goto('/#/plot?plc=0')
    await page.waitForTimeout(1000)
    
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).not.toBeAttached()
    await expect(page.locator('[data-testid="legacy-decision-graph"]')).toBeAttached()
  })

  test('?plc=1 forces PLC', async ({ page }) => {
    await page.goto('/#/plot?plc=1')
    await page.waitForTimeout(1000)
    
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeAttached()
    await expect(page.locator('[data-testid="legacy-decision-graph"]')).not.toBeAttached()
  })

  test('CSS guardrails enforced', async ({ page }) => {
    await page.goto('/#/plot')
    await page.waitForTimeout(1000)
    
    const styles = await page.evaluate(() => ({
      canvasPE: getComputedStyle(document.getElementById('plot-canvas-root')!).pointerEvents,
      railPE: getComputedStyle(document.getElementById('plot-right-rail')!).pointerEvents
    }))
    
    expect(styles.canvasPE).toBe('auto')
    expect(styles.railPE).toBe('none')
  })
})
