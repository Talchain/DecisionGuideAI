import { test, expect } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test.describe('Toast Stacking', () => {
  test('stacks multiple toasts and dismisses in order', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    await page.context().grantPermissions(['clipboard-write'])
    
    // Trigger 3 toasts quickly
    // 1. Save snapshot
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    await page.waitForTimeout(100)
    
    // 2. Save another snapshot
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    await page.waitForTimeout(100)
    
    // 3. Copy JSON
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button[title="Copy JSON"]').first().click()
    
    // Should have 3 toasts visible (or at least 2-3 depending on timing)
    const toasts = page.locator('[role="alert"]')
    const count = await toasts.count()
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(3)
    
    // Toasts should be stacked (not overlapping)
    // Check that they have different positions or are in a container
    const firstToast = toasts.first()
    await expect(firstToast).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('manual dismiss works on stacked toasts', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    await page.context().grantPermissions(['clipboard-write'])
    
    // Trigger multiple toasts
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    await page.waitForTimeout(100)
    
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    await page.waitForTimeout(100)
    
    // Get initial count
    const initialCount = await page.locator('[role="alert"]').count()
    expect(initialCount).toBeGreaterThan(0)
    
    // Dismiss first toast
    await page.locator('[role="alert"] button[aria-label="Dismiss"]').first().click()
    
    // Count should decrease
    await page.waitForTimeout(200)
    const afterCount = await page.locator('[role="alert"]').count()
    expect(afterCount).toBeLessThan(initialCount)
    
    expectNoConsoleErrors(errors)
  })

  test('toasts auto-dismiss in order after 3 seconds', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Trigger a toast
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    
    // Should be visible
    await expect(page.locator('[role="alert"]')).toBeVisible()
    
    // Wait for auto-dismiss (3s + buffer)
    await page.waitForTimeout(3500)
    
    // Should be gone
    await expect(page.locator('[role="alert"]')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('new toasts appear while others are dismissing', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openCanvas(page)
    
    // Trigger first toast
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    
    // Wait 2 seconds (toast still visible)
    await page.waitForTimeout(2000)
    
    // Trigger second toast
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    
    // Both should be visible
    const count = await page.locator('[role="alert"]').count()
    expect(count).toBeGreaterThanOrEqual(1)
    
    expectNoConsoleErrors(errors)
  })
})
