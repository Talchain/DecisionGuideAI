import { test, expect } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test.describe('Canvas Toasts', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('shows success toast on import', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Create a valid JSON file
    const validJSON = JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      nodes: [{ id: '1', type: 'decision', position: { x: 100, y: 100 }, data: { label: 'Test' } }],
      edges: []
    })
    
    // Open import dialog
    await page.locator('button:has-text("Import")').click()
    
    // Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(validJSON)
    })
    
    // Click import
    await page.locator('button:has-text("Import Canvas")').click()
    
    // Should show success toast
    await expect(page.locator('text=Canvas imported successfully!')).toBeVisible()
    await expect(page.locator('[role="alert"]')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('shows error toast on invalid import', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Open import dialog
    await page.locator('button:has-text("Import")').click()
    
    // Upload invalid JSON
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('not valid json')
    })
    
    // Click import
    await page.locator('button:has-text("Import Canvas")').click()
    
    // Should show error toast
    await expect(page.locator('text=Import failed')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('shows success toast on snapshot save', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Open snapshots
    await page.locator('button:has-text("Snapshots")').click()
    
    // Save snapshot
    await page.locator('button:has-text("Save Current Canvas")').click()
    
    // Dialog should close (success)
    await expect(page.locator('text=Snapshot Manager')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('shows success toast on copy JSON', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-write', 'clipboard-read'])
    
    // Open snapshots
    await page.locator('button:has-text("Snapshots")').click()
    
    // Save a snapshot first
    await page.locator('button:has-text("Save Current Canvas")').click()
    await page.waitForTimeout(500)
    
    // Reopen
    await page.locator('button:has-text("Snapshots")').click()
    
    // Copy JSON
    await page.locator('button[title="Copy JSON"]').first().click()
    
    // Should show success toast
    await expect(page.locator('text=JSON copied to clipboard')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('toast auto-dismisses after 3 seconds', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Trigger a toast (use snapshot save)
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    
    // Wait for auto-dismiss
    await page.waitForTimeout(3500)
    
    // Toast should be gone
    await expect(page.locator('[role="alert"]')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('toast can be manually dismissed', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-write'])
    
    // Trigger a toast
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button[title="Copy JSON"]').first().click()
    
    // Toast should be visible
    await expect(page.locator('[role="alert"]')).toBeVisible()
    
    // Click dismiss button
    await page.locator('[role="alert"] button[aria-label="Dismiss"]').click()
    
    // Toast should disappear immediately
    await expect(page.locator('[role="alert"]')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })
})
