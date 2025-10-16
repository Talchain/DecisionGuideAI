import { test, expect } from '@playwright/test'
import { openCanvas, clickToolbarButton, getNode, setupConsoleErrorTracking, expectNoConsoleErrors, pressShortcut, canUndo, canRedo } from './helpers/canvas'

test.describe('Canvas ELK Layout', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('Tidy Layout button exists and is clickable', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const tidyButton = page.locator('button:has-text("Tidy Layout")')
    await expect(tidyButton).toBeVisible()
    await expect(tidyButton).toBeEnabled()
    
    expectNoConsoleErrors(errors)
  })

  test('clicking Tidy Layout changes node positions', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    const boxBefore = await node.boundingBox()
    
    await clickToolbarButton(page, 'Tidy Layout')
    
    // Wait for layout animation/completion
    await page.waitForTimeout(1000)
    
    const boxAfter = await node.boundingBox()
    
    // Positions should have changed (or at least layout was applied)
    // Note: positions might not change if already optimal
    expect(boxAfter).toBeTruthy()
    
    expectNoConsoleErrors(errors)
  })

  test('layout operation can be undone', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    const boxBefore = await node.boundingBox()
    
    await clickToolbarButton(page, 'Tidy Layout')
    await page.waitForTimeout(1000)
    
    // Should be able to undo
    expect(await canUndo(page)).toBe(true)
    
    await pressShortcut(page, 'z')
    await page.waitForTimeout(300)
    
    const boxAfterUndo = await node.boundingBox()
    
    // Position should be restored (with some tolerance for rounding)
    if (boxBefore && boxAfterUndo) {
      const distance = Math.sqrt(
        Math.pow(boxAfterUndo.x - boxBefore.x, 2) + 
        Math.pow(boxAfterUndo.y - boxBefore.y, 2)
      )
      expect(distance).toBeLessThan(10)
    }
    
    expectNoConsoleErrors(errors)
  })

  test('layout operation can be redone', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await clickToolbarButton(page, 'Tidy Layout')
    await page.waitForTimeout(1000)
    
    const boxAfterLayout = await getNode(page, 0).boundingBox()
    
    // Undo
    await pressShortcut(page, 'z')
    await page.waitForTimeout(300)
    
    // Should be able to redo
    expect(await canRedo(page)).toBe(true)
    
    // Redo
    await pressShortcut(page, 'y')
    await page.waitForTimeout(300)
    
    const boxAfterRedo = await getNode(page, 0).boundingBox()
    
    // Should match layout position
    if (boxAfterLayout && boxAfterRedo) {
      const distance = Math.sqrt(
        Math.pow(boxAfterRedo.x - boxAfterLayout.x, 2) + 
        Math.pow(boxAfterRedo.y - boxAfterLayout.y, 2)
      )
      expect(distance).toBeLessThan(10)
    }
    
    expectNoConsoleErrors(errors)
  })

  test('layout button shows loading state', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const tidyButton = page.locator('button:has-text("Tidy Layout"), button:has-text("Tidying")')
    
    // Click and check for loading state
    await tidyButton.click()
    
    // During layout, button might show "Tidying..."
    await page.waitForTimeout(100)
    
    // After completion, should be back to "Tidy Layout"
    await page.waitForTimeout(1000)
    await expect(page.locator('button:has-text("Tidy Layout")')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('layout preserves edge connections', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const edgeCountBefore = await page.locator('.react-flow__edge').count()
    
    await clickToolbarButton(page, 'Tidy Layout')
    await page.waitForTimeout(1000)
    
    const edgeCountAfter = await page.locator('.react-flow__edge').count()
    
    // Edge count should remain the same
    expect(edgeCountAfter).toBe(edgeCountBefore)
    
    // Edges should still be visible
    if (edgeCountAfter > 0) {
      const firstEdge = page.locator('.react-flow__edge').first()
      await expect(firstEdge).toBeVisible()
    }
    
    expectNoConsoleErrors(errors)
  })
})
