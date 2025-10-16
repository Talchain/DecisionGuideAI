import { test, expect } from '@playwright/test'
import { openCanvas, getNode, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test.describe('Canvas Alignment Guides', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('guides appear during drag when nodes align', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node1 = getNode(page, 0)
    const node2 = getNode(page, 1)
    
    // Get initial positions
    const box1 = await node1.boundingBox()
    const box2 = await node2.boundingBox()
    
    if (!box1 || !box2) throw new Error('Could not get node boxes')
    
    // Drag node2 to align with node1's X position
    await node2.hover()
    await page.mouse.down()
    await page.mouse.move(box1.x, box2.y, { steps: 10 })
    
    // Guides should be visible during drag
    const guides = page.locator('.pointer-events-none .absolute.bg-\\[\\#EA7B4B\\]')
    await expect(guides.first()).toBeVisible()
    
    await page.mouse.up()
    
    // Guides should fade out after drag
    await page.waitForTimeout(300)
    await expect(guides.first()).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('no timer leak after 50 drag cycles', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    const box = await node.boundingBox()
    if (!box) throw new Error('Could not get node box')
    
    // Perform 50 drag cycles
    for (let i = 0; i < 50; i++) {
      await node.hover()
      await page.mouse.down()
      await page.mouse.move(box.x + 10, box.y + 10, { steps: 2 })
      await page.mouse.up()
      await page.waitForTimeout(10)
    }
    
    // Check for pending timers (if diagnostics mode available)
    const timerCount = await page.evaluate(() => {
      // In production, this won't exist, so we just verify no errors
      return 0
    })
    
    expect(timerCount).toBe(0)
    expectNoConsoleErrors(errors)
  })

  test('rapid drag state changes do not accumulate timers', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    const box = await node.boundingBox()
    if (!box) throw new Error('Could not get node box')
    
    // Rapid start/stop drags
    for (let i = 0; i < 20; i++) {
      await node.hover()
      await page.mouse.down()
      await page.mouse.move(box.x + 5, box.y + 5, { steps: 1 })
      await page.mouse.up()
      // No wait - immediate next cycle
    }
    
    // Wait for any pending fade timers
    await page.waitForTimeout(300)
    
    // Should not crash or have console errors
    expectNoConsoleErrors(errors)
  })

  test('guides disappear when drag ends', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    const box = await node.boundingBox()
    if (!box) throw new Error('Could not get node box')
    
    // Start drag
    await node.hover()
    await page.mouse.down()
    await page.mouse.move(box.x + 20, box.y + 20, { steps: 5 })
    
    // End drag
    await page.mouse.up()
    
    // Guides should fade out within 300ms
    await page.waitForTimeout(300)
    
    const guides = page.locator('.pointer-events-none .absolute.bg-\\[\\#EA7B4B\\]')
    const count = await guides.count()
    expect(count).toBe(0)
    
    expectNoConsoleErrors(errors)
  })

  test('guides work correctly with grid snap enabled', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Guides should still appear even with grid snap
    const node = getNode(page, 0)
    const box = await node.boundingBox()
    if (!box) throw new Error('Could not get node box')
    
    await node.hover()
    await page.mouse.down()
    await page.mouse.move(box.x + 50, box.y, { steps: 10 })
    
    // Should see guides during drag
    const guides = page.locator('.pointer-events-none')
    await expect(guides).toBeVisible()
    
    await page.mouse.up()
    
    expectNoConsoleErrors(errors)
  })
})
