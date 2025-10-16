import { test, expect } from '@playwright/test'
import { openCanvas, loadFixture, setupConsoleErrorTracking, expectNoConsoleErrors, clickToolbarButton, pressShortcut } from './helpers/canvas'

test.describe('Canvas Performance', () => {
  test('medium graph (100 nodes) loads and renders smoothly', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    await loadFixture(page, 'medium')
    
    // Verify nodes rendered
    const nodeCount = await page.locator('[data-testid="rf-node"]').count()
    expect(nodeCount).toBe(100)
    
    // All nodes should be in DOM
    const nodes = page.locator('[data-testid="rf-node"]')
    expect(await nodes.count()).toBe(100)
    
    expectNoConsoleErrors(errors)
  })

  test('medium graph pan/zoom is responsive', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    await loadFixture(page, 'medium')
    await page.waitForTimeout(500)
    
    // Measure pan performance
    const startTime = Date.now()
    
    // Pan with mouse drag
    await page.mouse.move(400, 400)
    await page.mouse.down()
    await page.mouse.move(600, 600, { steps: 10 })
    await page.mouse.up()
    
    const panTime = Date.now() - startTime
    
    // Should complete in reasonable time (< 1s for smooth interaction)
    expect(panTime).toBeLessThan(1000)
    
    // Zoom
    const zoomStartTime = Date.now()
    await page.mouse.wheel(0, -500)
    const zoomTime = Date.now() - zoomStartTime
    
    // Zoom should be instant
    expect(zoomTime).toBeLessThan(500)
    
    expectNoConsoleErrors(errors)
  })

  test('medium graph maintains single-frame history for drag', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    await loadFixture(page, 'medium')
    await page.waitForTimeout(500)
    
    // Select a node and drag it
    const node = page.locator('[data-testid="rf-node"]').first()
    await node.click()
    
    const box = await node.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + 200, box.y + 200, { steps: 20 })
      await page.mouse.up()
      
      // Wait for debounce
      await page.waitForTimeout(300)
      
      // Single undo should revert entire drag
      await pressShortcut(page, 'z')
      await page.waitForTimeout(200)
      
      // Verify reverted (approximate position check)
      const newBox = await node.boundingBox()
      if (newBox) {
        const distance = Math.sqrt(Math.pow(newBox.x - box.x, 2) + Math.pow(newBox.y - box.y, 2))
        expect(distance).toBeLessThan(50)
      }
    }
    
    expectNoConsoleErrors(errors)
  })

  test('large graph (250 nodes) loads without crashing', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    await loadFixture(page, 'large')
    await page.waitForTimeout(1000)
    
    // Verify loaded
    const nodeCount = await page.locator('[data-testid="rf-node"]').count()
    expect(nodeCount).toBe(250)
    
    // Should still be interactive
    await clickToolbarButton(page, '+ Node')
    await page.waitForTimeout(200)
    
    const newCount = await page.locator('[data-testid="rf-node"]').count()
    expect(newCount).toBe(251)
    
    expectNoConsoleErrors(errors)
  })

  test('large graph pan remains smooth', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    await loadFixture(page, 'large')
    await page.waitForTimeout(1000)
    
    // Perform pan operation
    await page.mouse.move(400, 400)
    await page.mouse.down()
    
    // Measure frame time during pan
    const frameTimesPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const frameTimes: number[] = []
        let lastTime = performance.now()
        let frameCount = 0
        
        function measureFrame() {
          const now = performance.now()
          const delta = now - lastTime
          frameTimes.push(delta)
          lastTime = now
          frameCount++
          
          if (frameCount < 10) {
            requestAnimationFrame(measureFrame)
          } else {
            resolve(frameTimes)
          }
        }
        
        requestAnimationFrame(measureFrame)
      })
    })
    
    // Move while measuring
    await page.mouse.move(600, 600, { steps: 10 })
    await page.mouse.up()
    
    const frameTimes = await frameTimesPromise as number[]
    
    // Most frames should be under 16.67ms (60fps)
    const slowFrames = frameTimes.filter(t => t > 16.67).length
    const slowFrameRatio = slowFrames / frameTimes.length
    
    // Allow up to 30% slow frames (still feels smooth)
    expect(slowFrameRatio).toBeLessThan(0.3)
    
    expectNoConsoleErrors(errors)
  })

  test('layout on large graph completes in reasonable time', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    await loadFixture(page, 'large')
    await page.waitForTimeout(1000)
    
    const startTime = Date.now()
    
    await clickToolbarButton(page, 'Tidy Layout')
    
    // Wait for layout to complete (watch for button state)
    await page.waitForTimeout(2000)
    
    const layoutTime = Date.now() - startTime
    
    // Should complete in under 3 seconds for 250 nodes
    expect(layoutTime).toBeLessThan(3000)
    
    // Canvas should still be responsive
    await clickToolbarButton(page, '+ Node')
    const nodeCount = await page.locator('[data-testid="rf-node"]').count()
    expect(nodeCount).toBe(251)
    
    expectNoConsoleErrors(errors)
  })

  test('history stack does not grow unbounded with large graph', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    await loadFixture(page, 'medium')
    await page.waitForTimeout(500)
    
    // Perform many operations (more than max history)
    for (let i = 0; i < 60; i++) {
      await clickToolbarButton(page, '+ Node')
      await page.waitForTimeout(50)
    }
    
    // Check history depth is capped
    const historyDepth = await page.evaluate(() => {
      // @ts-ignore
      return window.useCanvasStore.getState().history.past.length
    })
    
    // Should be capped at 50
    expect(historyDepth).toBeLessThanOrEqual(50)
    
    expectNoConsoleErrors(errors)
  })
})
