import { test, expect } from '@playwright/test'

// Production smoke test - runs against live deployment
test.describe('Plot Production Smoke Tests', () => {
  const PROD_URL = 'https://olumi.netlify.app'

  test('component badge exists and shows correct info', async ({ page }) => {
    await page.goto(`${PROD_URL}/#/plot`)
    
    // Wait for component to mount
    await page.waitForTimeout(2000)
    
    // Check badge exists
    const badge = page.locator('#__plot_component_name__')
    await expect(badge).toBeVisible()
    
    // Verify badge content
    const text = await badge.textContent()
    expect(text).toContain('ROUTE=/plot')
    expect(text).toContain('COMPONENT=PlotWorkspace')
    expect(text).toContain('COMMIT=')
  })

  test('diag mode: canvas is top element at right-middle', async ({ page }) => {
    await page.goto(`${PROD_URL}/#/plot?diag=1`)
    
    // Wait for PLC canvas
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
    
    // Hit test at right-middle
    const topElement = await page.evaluate(() => {
      const elements = document.elementsFromPoint(innerWidth * 0.75, innerHeight * 0.5)
      return elements[0] ? { id: elements[0].id, tag: elements[0].tagName } : null
    })
    
    // Canvas must be on top
    expect(topElement?.id).toBe('plot-canvas-root')
  })

  test('diag mode: right rail is not rendered', async ({ page }) => {
    await page.goto(`${PROD_URL}/#/plot?diag=1`)
    
    // Wait for canvas
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
    
    // Rail should not exist in diag mode
    const rail = page.locator('#plot-right-rail')
    await expect(rail).not.toBeVisible()
  })

  test('normal mode: console shows correct diagnostics', async ({ page }) => {
    let diagLog: string | null = null
    let mountLog: string | null = null
    
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('[PLOT:DIAG]')) {
        diagLog = text
      }
      if (text.includes('[PLOT] route=/plot component=PlotWorkspace')) {
        mountLog = text
      }
    })
    
    await page.goto(`${PROD_URL}/#/plot`)
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
    
    // Wait for logs
    await page.waitForTimeout(1000)
    
    // Mount log should appear
    expect(mountLog).toBeTruthy()
    expect(mountLog).toContain('component=PlotWorkspace')
    
    // Diag log should appear
    expect(diagLog).toBeTruthy()
    expect(diagLog).toContain('hitRightMid')
  })

  test('normal mode: no assertion errors in console', async ({ page }) => {
    const errors: string[] = []
    
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('[PLOT:ASSERT]')) {
        errors.push(msg.text())
      }
    })
    
    await page.goto(`${PROD_URL}/#/plot`)
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
    
    // Wait for diagnostics
    await page.waitForTimeout(1500)
    
    // Should have no assertion errors
    expect(errors).toHaveLength(0)
  })

  test('normal mode: canvas is accessible at right-middle', async ({ page }) => {
    await page.goto(`${PROD_URL}/#/plot`)
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
    
    // Hit test at right-middle
    const result = await page.evaluate(() => {
      const elements = document.elementsFromPoint(innerWidth * 0.75, innerHeight * 0.5)
      return elements.slice(0, 5).map(e => ({
        id: e.id,
        pe: getComputedStyle(e).pointerEvents
      }))
    }) as Array<{ id: string; pe: string }>
    
    // Find canvas and rail
    const canvas = result.find(r => r.id === 'plot-canvas-root')
    const rail = result.find(r => r.id === 'plot-right-rail')
    
    // Canvas must be present
    expect(canvas).toBeTruthy()
    
    // Rail must be transparent if present
    if (rail) {
      expect(rail.pe).toBe('none')
    }
  })
})
