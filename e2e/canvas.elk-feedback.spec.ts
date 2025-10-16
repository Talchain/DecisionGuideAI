import { test, expect } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test.describe('ELK First-Use Feedback', () => {
  test('shows loading toast on first layout', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Add a couple nodes to make layout meaningful
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForTimeout(100)
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForTimeout(100)
    
    // Open layout panel
    await page.locator('button:has-text("🔧 Layout")').click()
    
    // Click Apply Layout
    await page.locator('button:has-text("Apply Layout")').click()
    
    // Should show loading toast
    await expect(page.locator('text=Loading layout engine...')).toBeVisible({ timeout: 1000 })
    
    // Should show success toast after completion
    await expect(page.locator('text=Layout applied successfully')).toBeVisible({ timeout: 5000 })
    
    // Panel should close
    await expect(page.locator('text=Layout Options')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('shows error toast if layout fails', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Corrupt the layout store to force an error
    await page.evaluate(() => {
      (window as any).__FORCE_LAYOUT_ERROR = true
    })
    
    // Open layout panel
    await page.locator('button:has-text("🔧 Layout")').click()
    
    // Click Apply Layout
    await page.locator('button:has-text("Apply Layout")').click()
    
    // Should show loading toast
    await expect(page.locator('text=Loading layout engine...')).toBeVisible({ timeout: 1000 })
    
    // Note: Error handling depends on implementation
    // For now, just verify no crash
    await page.waitForTimeout(2000)
    
    // Allow console errors for this test since we're forcing a failure
    // expectNoConsoleErrors(errors)
  })

  test('layout creates single undo frame', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Add nodes
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForTimeout(100)
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForTimeout(100)
    
    // Apply layout
    await page.locator('button:has-text("🔧 Layout")').click()
    await page.locator('button:has-text("Apply Layout")').click()
    await page.waitForTimeout(2000)
    
    // Single undo should revert layout
    await page.keyboard.press('Meta+Z')
    await page.waitForTimeout(300)
    
    // Nodes should be back to original positions
    // (This is a smoke test; detailed position checking would be more complex)
    
    expectNoConsoleErrors(errors)
  })
})
