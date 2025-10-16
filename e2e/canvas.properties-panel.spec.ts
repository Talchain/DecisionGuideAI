import { test, expect } from '@playwright/test'
import { openCanvas, getNode, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test.describe('Canvas Properties Panel', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('panel appears when one node selected', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Initially no panel
    await expect(page.locator('text=Properties')).not.toBeVisible()
    
    // Select a node
    const node = getNode(page, 0)
    await node.click()
    
    // Panel should appear
    await expect(page.locator('text=Properties')).toBeVisible()
    await expect(page.locator('label:has-text("Label")')).toBeVisible()
    await expect(page.locator('label:has-text("Locked")')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('panel disappears when no nodes selected', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Select node
    const node = getNode(page, 0)
    await node.click()
    await expect(page.locator('text=Properties')).toBeVisible()
    
    // Click background to deselect
    await page.locator('.react-flow').click({ position: { x: 500, y: 500 } })
    
    // Panel should disappear
    await expect(page.locator('text=Properties')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('label edit updates node after debounce', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    await node.click()
    
    // Get label input
    const labelInput = page.locator('input[type="text"]').first()
    await labelInput.fill('Updated Label')
    
    // Wait for debounce (200ms)
    await page.waitForTimeout(300)
    
    // Node should show updated label
    await expect(node.locator('text=Updated Label')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('locked checkbox prevents dragging', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    await node.click()
    
    // Get initial position
    const initialBox = await node.boundingBox()
    if (!initialBox) throw new Error('Could not get node box')
    
    // Lock the node
    const lockedCheckbox = page.locator('input[type="checkbox"]')
    await lockedCheckbox.check()
    
    // Try to drag
    await node.hover()
    await page.mouse.down()
    await page.mouse.move(initialBox.x + 100, initialBox.y + 100, { steps: 5 })
    await page.mouse.up()
    
    // Position should not change (or change very little)
    const finalBox = await node.boundingBox()
    if (!finalBox) throw new Error('Could not get final box')
    
    expect(Math.abs(finalBox.x - initialBox.x)).toBeLessThan(10)
    expect(Math.abs(finalBox.y - initialBox.y)).toBeLessThan(10)
    
    expectNoConsoleErrors(errors)
  })

  test('rapid node switching does not cause stale updates', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node1 = getNode(page, 0)
    const node2 = getNode(page, 1)
    
    // Select node 1
    await node1.click()
    const input = page.locator('input[type="text"]').first()
    await input.fill('Node 1 Edit')
    
    // Immediately switch to node 2 (before debounce)
    await page.waitForTimeout(50)
    await node2.click()
    
    // Edit node 2
    await input.fill('Node 2 Edit')
    
    // Wait for debounce
    await page.waitForTimeout(300)
    
    // Node 2 should have the edit, node 1 should NOT
    await expect(node2.locator('text=Node 2 Edit')).toBeVisible()
    await expect(node1.locator('text=Node 1 Edit')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('unlocking node restores drag ability', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    await node.click()
    
    // Lock
    const checkbox = page.locator('input[type="checkbox"]')
    await checkbox.check()
    
    // Unlock
    await checkbox.uncheck()
    
    // Get position
    const initialBox = await node.boundingBox()
    if (!initialBox) throw new Error('Could not get box')
    
    // Should be able to drag now
    await node.hover()
    await page.mouse.down()
    await page.mouse.move(initialBox.x + 50, initialBox.y + 50, { steps: 5 })
    await page.mouse.up()
    
    const finalBox = await node.boundingBox()
    if (!finalBox) throw new Error('Could not get final box')
    
    // Should have moved
    expect(Math.abs(finalBox.x - initialBox.x)).toBeGreaterThan(30)
    
    expectNoConsoleErrors(errors)
  })

  test('panel updates when switching between nodes', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node1 = getNode(page, 0)
    const node2 = getNode(page, 1)
    
    // Select node 1
    await node1.click()
    const input = page.locator('input[type="text"]').first()
    const node1Label = await input.inputValue()
    
    // Select node 2
    await node2.click()
    const node2Label = await input.inputValue()
    
    // Labels should be different
    expect(node1Label).not.toBe(node2Label)
    
    expectNoConsoleErrors(errors)
  })
})
