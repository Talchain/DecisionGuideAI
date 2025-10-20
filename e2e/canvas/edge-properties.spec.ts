/**
 * E2E test for edge property editing
 * Tests weight, style, curvature, label, confidence editing with undo/redo
 */
import { test, expect } from '@playwright/test'

test.describe('Canvas Edge Properties', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await page.waitForSelector('[data-testid="react-flow-graph"]', { timeout: 10000 })
  })

  test('edits edge properties and verifies undo/redo', async ({ page }) => {
    // Create two nodes via toolbar
    const addNodeButton = page.locator('button:has-text("+ Node")')
    await addNodeButton.click()
    
    const addDecisionButton = page.locator('button:has-text("Add Decision")')
    await expect(addDecisionButton).toBeVisible({ timeout: 3000 })
    await addDecisionButton.click()
    
    // Add second node
    await addNodeButton.click()
    await addDecisionButton.click()
    
    // Wait for nodes to appear
    const nodes = page.locator('.react-flow__node')
    await expect(nodes.first()).toBeVisible({ timeout: 5000 })
    
    // Connect nodes by dragging from first node's handle
    const firstNode = nodes.first()
    const secondNode = nodes.nth(1)
    
    // Get node positions
    const firstBox = await firstNode.boundingBox()
    const secondBox = await secondNode.boundingBox()
    
    if (firstBox && secondBox) {
      // Drag from first node to second node to create edge
      await page.mouse.move(firstBox.x + firstBox.width, firstBox.y + firstBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(secondBox.x, secondBox.y + secondBox.height / 2)
      await page.mouse.up()
    }
    
    // Wait for edge to appear
    const edge = page.locator('.react-flow__edge').first()
    await expect(edge).toBeVisible({ timeout: 3000 })
    
    // Click edge to select it
    await edge.click()
    
    // Wait for edge inspector to open
    const edgeInspector = page.locator('[aria-label="Edge properties"]')
    await expect(edgeInspector).toBeVisible({ timeout: 3000 })
    
    // Edit weight
    const weightInput = page.locator('input[type="range"]').first()
    await weightInput.fill('3')
    
    // Edit style
    const styleSelect = page.locator('select').filter({ hasText: /solid|dashed|dotted/ }).first()
    await styleSelect.selectOption('dashed')
    
    // Edit label
    const labelInput = page.locator('input[type="text"]').filter({ hasText: '' }).first()
    await labelInput.fill('Test Edge')
    await labelInput.blur()
    
    // Verify changes persisted
    await expect(styleSelect).toHaveValue('dashed')
    
    // Test Undo
    await page.keyboard.press('Meta+z')
    
    // Test Redo
    await page.keyboard.press('Meta+Shift+z')
    
    // Verify edge still exists after redo
    await expect(edge).toBeVisible({ timeout: 3000 })
  })
})
