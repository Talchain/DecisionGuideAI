import { test, expect } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test('canvas loads without useToast runtime errors', async ({ page }) => {
  const errors = setupConsoleErrorTracking(page)
  
  // Navigate to canvas
  await openCanvas(page)
  
  // Verify no errors occurred
  expectNoConsoleErrors(errors)
  
  // Verify canvas root appears
  const canvasRoot = page.locator('.react-flow')
  await expect(canvasRoot).toBeVisible()
  
  // Verify toolbar is present (canvas fully loaded)
  const toolbar = page.locator('button:has-text("+ Node")')
  await expect(toolbar).toBeVisible()
})

test('import/export dialog shows toasts correctly', async ({ page }) => {
  const errors = setupConsoleErrorTracking(page)
  
  await openCanvas(page)
  
  // Open import dialog
  await page.locator('button:has-text("Import")').click()
  
  // Dialog should be visible
  await expect(page.locator('text=Import Canvas')).toBeVisible()
  
  // Should not have any errors
  expectNoConsoleErrors(errors)
})
