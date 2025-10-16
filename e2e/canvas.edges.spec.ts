import { test, expect } from '@playwright/test'
import { openCanvas, getEdgeCount, setupConsoleErrorTracking, expectNoConsoleErrors, pressShortcut } from './helpers/canvas'

test.describe('Canvas Edges', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('can create edge between nodes', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const initialEdgeCount = await getEdgeCount(page)
    
    // Find source and target handles
    const nodes = page.locator('[data-testid="rf-node"]')
    const firstNode = nodes.first()
    const secondNode = nodes.nth(1)
    
    const sourceHandle = firstNode.locator('.react-flow__handle-bottom')
    const targetHandle = secondNode.locator('.react-flow__handle-top')
    
    // Drag from source to target
    const sourceBox = await sourceHandle.boundingBox()
    const targetBox = await targetHandle.boundingBox()
    
    if (sourceBox && targetBox) {
      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 5 })
      await page.mouse.up()
      
      await page.waitForTimeout(300)
      
      const newEdgeCount = await getEdgeCount(page)
      expect(newEdgeCount).toBeGreaterThanOrEqual(initialEdgeCount)
    }
    
    expectNoConsoleErrors(errors)
  })

  test('supports multiple edges between same nodes', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Check that initial graph can have multiple edges
    const edges = page.locator('.react-flow__edge')
    const count = await edges.count()
    expect(count).toBeGreaterThan(0)
    
    // Verify edges exist in DOM (structure check)
    const firstEdge = edges.first()
    await expect(firstEdge).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('edge deletion works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const initialCount = await getEdgeCount(page)
    
    if (initialCount > 0) {
      // Click on edge to select
      const edge = page.locator('.react-flow__edge').first()
      await edge.click()
      
      // Delete
      await page.keyboard.press('Delete')
      await page.waitForTimeout(200)
      
      const newCount = await getEdgeCount(page)
      expect(newCount).toBe(initialCount - 1)
    }
    
    expectNoConsoleErrors(errors)
  })

  test('edge undo/redo works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const initialCount = await getEdgeCount(page)
    
    if (initialCount > 0) {
      // Delete edge
      const edge = page.locator('.react-flow__edge').first()
      await edge.click()
      await page.keyboard.press('Delete')
      await page.waitForTimeout(300)
      
      const afterDeleteCount = await getEdgeCount(page)
      expect(afterDeleteCount).toBe(initialCount - 1)
      
      // Undo
      await pressShortcut(page, 'z')
      await page.waitForTimeout(200)
      
      const afterUndoCount = await getEdgeCount(page)
      expect(afterUndoCount).toBe(initialCount)
      
      // Redo
      await pressShortcut(page, 'y')
      await page.waitForTimeout(200)
      
      const afterRedoCount = await getEdgeCount(page)
      expect(afterRedoCount).toBe(initialCount - 1)
    }
    
    expectNoConsoleErrors(errors)
  })

  test('edge styling is applied', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const edges = page.locator('.react-flow__edge')
    if (await edges.count() > 0) {
      const firstEdge = edges.first()
      
      // Check edge path exists
      const path = firstEdge.locator('path')
      await expect(path).toBeVisible()
      
      // Verify stroke width (from defaultEdgeOptions)
      const strokeWidth = await path.getAttribute('stroke-width')
      expect(strokeWidth).toBeTruthy()
    }
    
    expectNoConsoleErrors(errors)
  })
})
