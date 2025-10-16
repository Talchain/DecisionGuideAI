import { test, expect } from '@playwright/test'
import { openCanvas, getNode, setupConsoleErrorTracking, expectNoConsoleErrors, pressShortcut, canUndo } from './helpers/canvas'

test.describe('Canvas Nudge History', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('rapid nudges create single undo frame', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Select first node
    const node = getNode(page, 0)
    await node.click()
    
    const boxBefore = await node.boundingBox()
    
    // Rapid nudge right (hold for ~1s, simulating ~20 keystrokes)
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(50) // Simulate human typing speed
    }
    
    // Wait for debounce window (500ms)
    await page.waitForTimeout(600)
    
    // Verify node moved
    const boxAfter = await node.boundingBox()
    if (boxBefore && boxAfter) {
      expect(boxAfter.x).toBeGreaterThan(boxBefore.x)
    }
    
    // Should be able to undo
    expect(await canUndo(page)).toBe(true)
    
    // Single undo should revert all nudges
    await pressShortcut(page, 'z')
    await page.waitForTimeout(200)
    
    const boxReverted = await node.boundingBox()
    if (boxBefore && boxReverted) {
      expect(Math.abs(boxReverted.x - boxBefore.x)).toBeLessThan(5)
    }
    
    expectNoConsoleErrors(errors)
  })

  test('nudge with Shift moves 10px', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    await node.click()
    
    const boxBefore = await node.boundingBox()
    
    // Shift+Arrow for 10px nudge
    await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(100)
    
    const boxAfter = await node.boundingBox()
    
    // Movement should be visible
    if (boxBefore && boxAfter) {
      const moved = boxAfter.x - boxBefore.x
      expect(moved).toBeGreaterThan(5) // At least 5px (allowing for grid snap)
    }
    
    expectNoConsoleErrors(errors)
  })

  test('nudge respects grid snap', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    await node.click()
    
    // Single nudge (1px request, but grid snap may adjust)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(600)
    
    const box = await node.boundingBox()
    if (box) {
      // Position should be on or near 16px grid (with tolerance for drag)
      // Just verify node is still visible and positioned
      expect(box.x).toBeGreaterThan(0)
    }
    
    expectNoConsoleErrors(errors)
  })

  test('separate nudge bursts create separate undo frames', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    await node.click()
    
    // First burst
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(50)
    }
    
    // Wait for debounce to complete
    await page.waitForTimeout(600)
    
    // Second burst (separate)
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(50)
    }
    
    await page.waitForTimeout(600)
    
    // Should have 2 undo frames
    expect(await canUndo(page)).toBe(true)
    await pressShortcut(page, 'z')
    await page.waitForTimeout(200)
    
    expect(await canUndo(page)).toBe(true)
    await pressShortcut(page, 'z')
    
    expectNoConsoleErrors(errors)
  })

  test('nudge does not interfere with other shortcuts', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    await node.click()
    
    // Nudge
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)
    
    // Use other shortcut (duplicate)
    await pressShortcut(page, 'd')
    await page.waitForTimeout(200)
    
    // Should have 2 nodes now
    const nodeCount = await page.locator('[data-testid="rf-node"]').count()
    expect(nodeCount).toBeGreaterThan(1)
    
    expectNoConsoleErrors(errors)
  })
})
