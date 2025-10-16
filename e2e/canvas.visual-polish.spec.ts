import { test, expect } from '@playwright/test'
import { openCanvas, getNode, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test.describe('Canvas Visual Polish', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('settings panel opens and closes', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Click settings gear button
    await page.locator('button[aria-label="Open settings"]').click()
    
    // Panel should be visible
    await expect(page.locator('text=Settings')).toBeVisible()
    await expect(page.locator('text=Show Grid')).toBeVisible()
    
    // Close settings
    await page.locator('button[aria-label="Close settings"]').click()
    await expect(page.locator('text=Settings')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('grid toggle persists across sessions', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Open settings
    await page.locator('button[aria-label="Open settings"]').click()
    
    // Toggle grid off
    const gridCheckbox = page.locator('input[type="checkbox"]').first()
    await gridCheckbox.uncheck()
    
    // Reload page
    await page.reload()
    await openCanvas(page)
    
    // Open settings again
    await page.locator('button[aria-label="Open settings"]').click()
    
    // Grid should still be off
    await expect(gridCheckbox).not.toBeChecked()
    
    // Toggle back on for cleanup
    await gridCheckbox.check()
    
    expectNoConsoleErrors(errors)
  })

  test('grid density slider changes grid size', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.locator('button[aria-label="Open settings"]').click()
    
    // Ensure grid is on
    const gridCheckbox = page.locator('input[type="checkbox"]').first()
    await gridCheckbox.check()
    
    // Change grid size
    const slider = page.locator('input[type="range"]')
    await slider.fill('24')
    
    // Verify label updates
    await expect(page.locator('text=Grid Size: 24px')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('snap to grid can be toggled', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.locator('button[aria-label="Open settings"]').click()
    
    // Find snap to grid checkbox (second checkbox)
    const snapCheckbox = page.locator('label:has-text("Snap to Grid") input')
    
    // Toggle on
    await snapCheckbox.check()
    await expect(snapCheckbox).toBeChecked()
    
    // Toggle off
    await snapCheckbox.uncheck()
    await expect(snapCheckbox).not.toBeChecked()
    
    expectNoConsoleErrors(errors)
  })

  test('alignment guides can be toggled', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.locator('button[aria-label="Open settings"]').click()
    
    const guidesCheckbox = page.locator('label:has-text("Alignment Guides") input')
    
    // Toggle off
    await guidesCheckbox.uncheck()
    await expect(guidesCheckbox).not.toBeChecked()
    
    // Toggle back on
    await guidesCheckbox.check()
    await expect(guidesCheckbox).toBeChecked()
    
    expectNoConsoleErrors(errors)
  })

  test('high contrast mode can be toggled', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.locator('button[aria-label="Open settings"]').click()
    
    const contrastCheckbox = page.locator('label:has-text("High Contrast Mode") input')
    
    await contrastCheckbox.check()
    await expect(contrastCheckbox).toBeChecked()
    
    await contrastCheckbox.uncheck()
    await expect(contrastCheckbox).not.toBeChecked()
    
    expectNoConsoleErrors(errors)
  })

  test('node hover applies scale animation', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    
    // Get initial transform
    const initialTransform = await node.evaluate(el => window.getComputedStyle(el).transform)
    
    // Hover over node
    await node.hover()
    
    // Wait for animation
    await page.waitForTimeout(200)
    
    // Transform should have changed (scale applied)
    const hoverTransform = await node.evaluate(el => window.getComputedStyle(el).transform)
    expect(hoverTransform).not.toBe(initialTransform)
    
    expectNoConsoleErrors(errors)
  })

  test('selected node has visual feedback', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    
    // Click to select
    await node.click()
    
    // Should have selection border
    await expect(node).toHaveClass(/border-\[#EA7B4B\]/)
    
    expectNoConsoleErrors(errors)
  })

  test('60fps interaction maintained with animations', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Measure frame rate during interaction
    const fps = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let frames = 0
        let lastTime = performance.now()
        
        const measureFrames = () => {
          frames++
          const currentTime = performance.now()
          
          if (currentTime - lastTime >= 1000) {
            resolve(frames)
          } else {
            requestAnimationFrame(measureFrames)
          }
        }
        
        requestAnimationFrame(measureFrames)
      })
    })
    
    // Should be close to 60fps (allow some variance)
    expect(fps).toBeGreaterThan(50)
    
    expectNoConsoleErrors(errors)
  })
})
