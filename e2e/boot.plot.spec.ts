import { test, expect } from '@playwright/test'

test.describe('Boot smoke: /#/plot', () => {
  test('Plot renders PoC shell', async ({ page }) => {
    await page.goto('/#/plot', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => location.hash === '#/plot')
    
    // Wait for PoC shell to mount
    await page.waitForSelector('text=/Decision Graph|Plot Showcase/i', { timeout: 10000 })

    // Verify rich PoC shell (not minimal PLC UI)
    const heading = page.locator('h1, h2').filter({ hasText: /Plot|Decision/i }).first()
    await expect(heading).toBeVisible()
  })

  test('Plot canvas renders (PLC adapter or legacy)', async ({ page }) => {
    await page.goto('/#/plot', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => location.hash === '#/plot')

    // Wait for canvas container
    await page.waitForSelector('[data-testid="plot-graph-card"], [data-testid="graph-canvas"], [data-testid="plc-canvas-adapter"]', { timeout: 10000 })

    // Verify at least one canvas element is present
    const hasGraphCard = await page.getByTestId('plot-graph-card').count() > 0
    const hasCanvas = await page.getByTestId('graph-canvas').count() > 0
    const hasAdapter = await page.getByTestId('plc-canvas-adapter').count() > 0
    
    expect(hasGraphCard || hasCanvas || hasAdapter).toBeTruthy()
  })
})
