import { test, expect } from '@playwright/test'

test.describe('Plot Canvas Interactions', () => {
  test('right side is interactive and canvas is accessible', async ({ page }) => {
    await page.goto('/#/plot')
    
    // Wait for PLC canvas to mount
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
    
    // Verify diagnostics in console
    const logs: string[] = []
    page.on('console', msg => {
      if (msg.text().includes('[PLOT]') || msg.text().includes('[PLOT:DIAG]')) {
        logs.push(msg.text())
      }
    })
    
    // Wait a bit for diagnostics to run
    await page.waitForTimeout(500)
    
    // Check that mount log appeared
    const mountLog = logs.find(l => l.includes('[PLOT] route=/plot component=PlotWorkspace'))
    expect(mountLog).toBeTruthy()
  })

  test('rail container is transparent to pointer events', async ({ page }) => {
    await page.goto('/#/plot')
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
    
    // Probe right-middle of viewport
    const result = await page.evaluate(() => {
      const p = (x: number, y: number) => document.elementsFromPoint(x, y)
        .map(e => ({ id: e.id, pe: getComputedStyle(e).pointerEvents }))
      return p(innerWidth * 0.75, innerHeight * 0.5)
    }) as Array<{ id: string; pe: string }>
    
    // Find rail and canvas in hit test
    const rail = result.find(r => r.id === 'plot-right-rail')
    const canvas = result.find(r => r.id === 'plot-canvas-root')
    
    // Rail container must be transparent
    expect(rail?.pe).toBe('none')
    
    // Canvas must be present and interactive
    expect(canvas).toBeTruthy()
    expect(canvas?.pe).not.toBe('none')
  })

  test('whiteboard layer is visual-only (pointer-events none)', async ({ page }) => {
    await page.goto('/#/plot')
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
    
    const whiteboardPE = await page.evaluate(() => {
      const wb = document.getElementById('whiteboard-layer')
      return wb ? getComputedStyle(wb).pointerEvents : null
    })
    
    expect(whiteboardPE).toBe('none')
  })

  test('canvas root has correct pointer events and z-index', async ({ page }) => {
    await page.goto('/#/plot')
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
    
    const canvasStyles = await page.evaluate(() => {
      const canvas = document.getElementById('plot-canvas-root')
      if (!canvas) return null
      const styles = getComputedStyle(canvas)
      return {
        pointerEvents: styles.pointerEvents,
        zIndex: styles.zIndex,
        position: styles.position
      }
    }) as { pointerEvents: string; zIndex: string; position: string } | null
    
    expect(canvasStyles).toBeTruthy()
    expect(canvasStyles?.pointerEvents).not.toBe('none')
    expect(canvasStyles?.zIndex).toBe('10')
    expect(canvasStyles?.position).toBe('absolute')
  })

  test('no console errors about rail capturing events', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('[PLOT:ASSERT]')) {
        errors.push(msg.text())
      }
    })
    
    await page.goto('/#/plot')
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
    
    // Wait for diagnostics
    await page.waitForTimeout(1000)
    
    // Should have no assertion errors
    expect(errors).toHaveLength(0)
  })

  test('diagnostic output contains expected fields', async ({ page }) => {
    let diagOutput: any = null
    
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('[PLOT:DIAG]')) {
        // Extract JSON from log
        try {
          const jsonStart = text.indexOf('{')
          if (jsonStart > -1) {
            diagOutput = JSON.parse(text.substring(jsonStart))
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    })
    
    await page.goto('/#/plot')
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
    
    // Wait for diagnostics
    await page.waitForTimeout(1000)
    
    expect(diagOutput).toBeTruthy()
    expect(diagOutput.flags).toBeTruthy()
    expect(diagOutput.dom).toBeTruthy()
    expect(diagOutput.dom.hasPlc).toBe(true)
    expect(diagOutput.dom.whiteboardPE).toBe('none')
    expect(diagOutput.dom.railPE).toBe('none')
    expect(diagOutput.hitRightMid).toBeTruthy()
    expect(Array.isArray(diagOutput.hitRightMid)).toBe(true)
  })
})
