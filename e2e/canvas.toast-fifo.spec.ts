import { test, expect } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test('toasts auto-dismiss in FIFO order', async ({ page }) => {
  const errors = setupConsoleErrorTracking(page)
  await openCanvas(page)
  
  // Trigger 3 toasts quickly
  for (let i = 0; i < 3; i++) {
    await page.locator('button:has-text("Snapshots")').click()
    await page.locator('button:has-text("Save Current Canvas")').click()
    await page.waitForTimeout(100)
  }
  
  // Get initial toasts
  const initial = await page.locator('[role="alert"]').count()
  expect(initial).toBeGreaterThanOrEqual(2)
  
  // Wait for first to dismiss (3s)
  await page.waitForTimeout(3200)
  const after1 = await page.locator('[role="alert"]').count()
  expect(after1).toBeLessThan(initial)
  
  // Wait for second to dismiss
  await page.waitForTimeout(3200)
  const after2 = await page.locator('[role="alert"]').count()
  expect(after2).toBeLessThan(after1)
  
  expectNoConsoleErrors(errors)
})
