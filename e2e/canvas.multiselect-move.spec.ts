import { test, expect } from '@playwright/test'
import { openCanvas, getNode, setupConsoleErrorTracking, expectNoConsoleErrors, pressShortcut, canUndo } from './helpers/canvas'

test.describe('Canvas Multi-Select and Group Move', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('marquee selection works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Drag marquee box
    await page.mouse.move(50, 50)
    await page.mouse.down()
    await page.mouse.move(500, 500, { steps: 10 })
    await page.mouse.up()
    
    // Multiple nodes should be selected
    const selectedNodes = page.locator('[data-testid="rf-node"].selected, [data-testid="rf-node"][class*="border-[#EA7B4B]"]')
    const count = await selectedNodes.count()
    expect(count).toBeGreaterThan(1)
    
    expectNoConsoleErrors(errors)
  })

  test('Shift+click toggles selection', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node1 = getNode(page, 0)
    const node2 = getNode(page, 1)
    
    // Select first
    await node1.click()
    await expect(node1).toHaveClass(/border-\[#EA7B4B\]/)
    
    // Shift+click second
    await page.keyboard.down('Shift')
    await node2.click()
    await page.keyboard.up('Shift')
    
    // Both should be selected
    await expect(node1).toHaveClass(/border-\[#EA7B4B\]/)
    await expect(node2).toHaveClass(/border-\[#EA7B4B\]/)
    
    expectNoConsoleErrors(errors)
  })

  test('Select All keyboard shortcut', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 'a')
    
    // All nodes should be selected
    const allNodes = page.locator('[data-testid="rf-node"]')
    const count = await allNodes.count()
    expect(count).toBeGreaterThan(0)
    
    const firstNode = allNodes.first()
    await expect(firstNode).toHaveClass(/border-\[#EA7B4B\]/)
    
    expectNoConsoleErrors(errors)
  })

  test('group move produces single undo step', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Select multiple nodes
    await pressShortcut(page, 'a')
    await page.waitForTimeout(200)
    
    const node1 = getNode(page, 0)
    const box = await node1.boundingBox()
    
    if (box) {
      // Drag group
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + 150, box.y + 150, { steps: 10 })
      await page.mouse.up()
      
      // Wait for debounce
      await page.waitForTimeout(300)
      
      // Should be able to undo
      expect(await canUndo(page)).toBe(true)
      
      // Single undo should revert entire group move
      await pressShortcut(page, 'z')
      
      // Verify positions reverted (node should be back near original position)
      const newBox = await node1.boundingBox()
      if (newBox) {
        const distance = Math.sqrt(Math.pow(newBox.x - box.x, 2) + Math.pow(newBox.y - box.y, 2))
        expect(distance).toBeLessThan(50) // Close to original
      }
    }
    
    expectNoConsoleErrors(errors)
  })

  test('group move maintains relative offsets', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node1 = getNode(page, 0)
    const node2 = getNode(page, 1)
    
    const box1Before = await node1.boundingBox()
    const box2Before = await node2.boundingBox()
    
    if (box1Before && box2Before) {
      const offsetXBefore = box2Before.x - box1Before.x
      const offsetYBefore = box2Before.y - box1Before.y
      
      // Select both
      await pressShortcut(page, 'a')
      
      // Move group
      await page.mouse.move(box1Before.x + box1Before.width / 2, box1Before.y + box1Before.height / 2)
      await page.mouse.down()
      await page.mouse.move(box1Before.x + 200, box1Before.y + 200, { steps: 5 })
      await page.mouse.up()
      
      await page.waitForTimeout(200)
      
      // Check offsets maintained
      const box1After = await node1.boundingBox()
      const box2After = await node2.boundingBox()
      
      if (box1After && box2After) {
        const offsetXAfter = box2After.x - box1After.x
        const offsetYAfter = box2After.y - box1After.y
        
        expect(Math.abs(offsetXAfter - offsetXBefore)).toBeLessThan(5)
        expect(Math.abs(offsetYAfter - offsetYBefore)).toBeLessThan(5)
      }
    }
    
    expectNoConsoleErrors(errors)
  })
})
