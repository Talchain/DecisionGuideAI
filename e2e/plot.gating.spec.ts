import { test, expect } from '@playwright/test'

test.describe('Canvas gating', () => {
  test('?plc=1 forces PLC canvas', async ({ page }) => {
    await page.goto('/#/plot?plc=1')
    
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible()
    await expect(page.locator('text=CANVAS=PLC')).toBeVisible()
    await expect(page.locator('text=SRC=url')).toBeVisible()
  })

  test('?plc=0 forces Legacy canvas', async ({ page }) => {
    await page.goto('/#/plot?plc=0')
    
    await expect(page.locator('[data-testid="legacy-canvas"]')).toBeVisible()
    await expect(page.locator('text=CANVAS=Legacy')).toBeVisible()
    await expect(page.locator('text=SRC=url')).toBeVisible()
  })

  test('localStorage precedence over env', async ({ page }) => {
    await page.goto('/#/plot')
    await page.evaluate(() => localStorage.setItem('PLOT_USE_PLC', '1'))
    await page.reload()
    
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible()
    await expect(page.locator('text=SRC=localStorage')).toBeVisible()
  })

  test('hash toggle updates view without reload', async ({ page }) => {
    await page.goto('/#/plot?plc=0')
    await expect(page.locator('[data-testid="legacy-canvas"]')).toBeVisible()
    
    await page.goto('/#/plot?plc=1')
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible()
  })

  test('diag mode removes rail', async ({ page }) => {
    await page.goto('/#/plot?diag=1')
    
    const hasRail = await page.evaluate(() => !!document.getElementById('plot-right-rail'))
    expect(hasRail).toBeFalsy()
  })
})
