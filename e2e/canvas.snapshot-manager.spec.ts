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

  test('Rename commits on Enter, cancels on Esc', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await clickToolbarButton(page, 'Snapshots')
    
    // Save a snapshot first
    await page.locator('button:has-text("💾 Save Current Canvas")').click()
    await page.waitForTimeout(500)
    
    // Click rename
    await page.locator('button:has-text("Rename")').first().click()
    
    // Input should be visible
    const input = page.locator('input[type="text"]').first()
    await expect(input).toBeVisible()
    
    // Type new name
    await input.fill('Test Snapshot Name')
    
    // Press Enter to commit
    await input.press('Enter')
    
    // Should show new name
    await expect(page.locator('text=Test Snapshot Name')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('Rename cancels on Escape', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await clickToolbarButton(page, 'Snapshots')
    
    // Save a snapshot
    await page.locator('button:has-text("💾 Save Current Canvas")').click()
    await page.waitForTimeout(500)
    
    // Get original name
    const originalName = await page.locator('h3.font-medium').first().textContent()
    
    // Click rename
    await page.locator('button:has-text("Rename")').first().click()
    
    const input = page.locator('input[type="text"]').first()
    await input.fill('Should Not Save')
    
    // Press Escape to cancel
    await input.press('Escape')
    
    // Should still show original name
    await expect(page.locator(`text=${originalName}`)).toBeVisible()
    await expect(page.locator('text=Should Not Save')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('Rename survives background autosave', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await clickToolbarButton(page, 'Snapshots')
    
    // Save a snapshot
    await page.locator('button:has-text("💾 Save Current Canvas")').click()
    await page.waitForTimeout(500)
    
    // Start rename
    await page.locator('button:has-text("Rename")').first().click()
    const input = page.locator('input[type="text"]').first()
    
    // Type slowly to simulate user thinking
    await input.fill('New')
    await page.waitForTimeout(100)
    await input.fill('New Name')
    
    // Commit
    await input.press('Enter')
    
    // Should show new name
    await expect(page.locator('text=New Name')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })
})
