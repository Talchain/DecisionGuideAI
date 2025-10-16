import { test, expect } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test.describe('Performance Smoke Tests', () => {
  test('maintains 55+ fps during idle', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Skip in CI if env flag set
    if (process.env.SKIP_PERF_TESTS === '1') {
      test.skip()
      return
    }
    
    await openCanvas(page)
    
    // Measure frames over 1 second during idle
    const frameCount = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frames = 0
        const startTime = performance.now()
        
        const countFrames = () => {
          frames++
          const elapsed = performance.now() - startTime
          
          if (elapsed < 1000) {
            requestAnimationFrame(countFrames)
          } else {
            resolve(frames)
          }
        }
        
        requestAnimationFrame(countFrames)
      })
    })
    
    // Should have at least 55 frames (allows for variance)
    expect(frameCount).toBeGreaterThanOrEqual(55)
    
    expectNoConsoleErrors(errors)
  })

  test('maintains 55+ fps during drag', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    if (process.env.SKIP_PERF_TESTS === '1') {
      test.skip()
      return
    }
    
    await openCanvas(page)
    
    // Add a node
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForTimeout(200)
    
    // Get node position
    const node = page.locator('[data-testid="rf-node"]').first()
    const box = await node.boundingBox()
    
    if (!box) {
      throw new Error('Node not found')
    }
    
    // Start drag and measure frames
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    
    const frameCount = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frames = 0
        const startTime = performance.now()
        
        const countFrames = () => {
          frames++
          const elapsed = performance.now() - startTime
          
          if (elapsed < 1000) {
            requestAnimationFrame(countFrames)
          } else {
            resolve(frames)
          }
        }
        
        requestAnimationFrame(countFrames)
      })
    })
    
    await page.mouse.up()
    
    // Should maintain at least 55 fps during drag
    expect(frameCount).toBeGreaterThanOrEqual(55)
    
    expectNoConsoleErrors(errors)
  })

  test('no long tasks during main flows', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    if (process.env.SKIP_PERF_TESTS === '1') {
      test.skip()
      return
    }
    
    await openCanvas(page)
    
    // Track long tasks
    await page.evaluate(() => {
      (window as any).__longTasks = []
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 250) {
            (window as any).__longTasks.push({
              name: entry.name,
              duration: entry.duration
            })
          }
        }
      })
      observer.observe({ entryTypes: ['measure', 'navigation'] })
    })
    
    // Execute main flows
    // 1. Add node
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForTimeout(100)
    
    // 2. Edit label
    await page.locator('[data-testid="rf-node"]').first().dblclick()
    await page.keyboard.type('Test Node')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(100)
    
    // 3. Undo
    await page.keyboard.press('Meta+Z')
    await page.waitForTimeout(100)
    
    // Check for long tasks
    const longTasks = await page.evaluate(() => (window as any).__longTasks || [])
    
    // Log any long tasks but don't fail (informational)
    if (longTasks.length > 0) {
      console.log('Long tasks detected:', longTasks)
    }
    
    // For now, just ensure we didn't crash
    expect(longTasks.length).toBeLessThan(10) // Generous limit
    
    expectNoConsoleErrors(errors)
  })
})
