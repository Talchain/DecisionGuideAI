import { test, expect } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors, clickToolbarButton } from './helpers/canvas'

test.describe('Canvas Snapshot Manager', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('Snapshots button opens manager', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await clickToolbarButton(page, 'Snapshots')
    
    await expect(page.locator('text=Snapshot Manager')).toBeVisible()
    await expect(page.locator('text=💾 Save Current Canvas')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('Shows empty state initially', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Clear localStorage
    await page.evaluate(() => {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith('canvas-snapshot-')) {
          localStorage.removeItem(key)
        }
      }
    })
    
    await clickToolbarButton(page, 'Snapshots')
    
    await expect(page.locator('text=No snapshots yet')).toBeVisible()
    await expect(page.locator('text=/0\\/10 snapshots/')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('Can save a snapshot', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await clickToolbarButton(page, 'Snapshots')
    
    const saveButton = page.locator('button:has-text("💾 Save Current Canvas")')
    await saveButton.click()
    
    // Wait for snapshot to be saved and list to refresh
    await page.waitForTimeout(500)
    
    // Should show at least one snapshot
    await expect(page.locator('text=/1\\/10 snapshots/')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('Snapshot shows metadata', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await clickToolbarButton(page, 'Snapshots')
    
    // Save a snapshot
    await page.locator('button:has-text("💾 Save Current Canvas")').click()
    await page.waitForTimeout(500)
    
    // Should show metadata
    await expect(page.locator('text=/\\d+ nodes, \\d+ edges/')).toBeVisible()
    await expect(page.locator('button:has-text("Restore")')).toBeVisible()
    await expect(page.locator('button:has-text("Rename")')).toBeVisible()
    await expect(page.locator('button:has-text("Delete")')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('Close button works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await clickToolbarButton(page, 'Snapshots')
    
    const closeButton = page.locator('[aria-label="Close snapshot manager"]')
    await closeButton.click()
    
    await expect(page.locator('text=Snapshot Manager')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })
})
