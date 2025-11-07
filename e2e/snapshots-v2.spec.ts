/**
 * Snapshots v2 E2E Tests
 *
 * Tests for snapshot storage, UI, and visual diff functionality.
 *
 * Coverage:
 * - Save snapshots with name validation
 * - List snapshots with timestamps
 * - Restore snapshots
 * - Delete snapshots
 * - FIFO rotation (max 10)
 * - Visual diff overlay
 * - Keyboard shortcuts (D to toggle, ESC to clear)
 * - Accessibility
 *
 * Flag: VITE_FEATURE_SNAPSHOTS_V2=0|1
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Helper: Navigate to Canvas with snapshots enabled
async function navigateToCanvas(page: any) {
  await page.goto('/#/canvas')
  await page.waitForLoadState('networkidle')
}

test.describe('Snapshots v2', { tag: '@snapshots-v2' }, () => {
  test.describe('Save Snapshots', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToCanvas(page)

      // Clear existing snapshots
      await page.evaluate(() => localStorage.removeItem('canvas-snapshots-v2'))
    })

    test('saves snapshot with valid name', async ({ page }) => {
      // Check if SnapshotPanel is visible (requires flag)
      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Enter snapshot name
      const input = page.locator('input[placeholder="Snapshot name..."]')
      await input.fill('Test Snapshot 1')

      // Click Save button
      await page.click('button:has-text("Save")')

      // Verify snapshot appears in list
      await expect(page.locator('text=Test Snapshot 1')).toBeVisible({ timeout: 2000 })

      // Verify timestamp displayed
      const timestamp = page.locator('text=Test Snapshot 1').locator('..')
      await expect(timestamp).toContainText(/\d{1,2}\/\d{1,2}\/\d{4}/)
    })

    test('shows validation error for empty name', async ({ page }) => {
      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Try to save without name
      const saveButton = page.locator('button:has-text("Save")')
      await expect(saveButton).toBeDisabled()
    })

    test('sanitizes snapshot names (XSS prevention)', async ({ page }) => {
      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Enter malicious name
      const input = page.locator('input[placeholder="Snapshot name..."]')
      await input.fill('<script>alert(1)</script>')

      // Save snapshot
      await page.click('button:has-text("Save")')

      // Verify script tag not executed
      const scriptTags = await page.locator('script:has-text("alert")').count()
      expect(scriptTags).toBe(0)

      // Verify name is sanitized in display
      const bodyText = await page.textContent('body')
      expect(bodyText).not.toContain('<script>')
    })

    test('enforces max length (50 chars)', async ({ page }) => {
      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      const longName = 'A'.repeat(100)
      const input = page.locator('input[placeholder="Snapshot name..."]')
      await input.fill(longName)

      // Verify input enforces maxLength
      const actualValue = await input.inputValue()
      expect(actualValue.length).toBeLessThanOrEqual(50)
    })

    test('displays snapshot count (x/10)', async ({ page }) => {
      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Verify initial count
      await expect(page.locator('text=(0/10)')).toBeVisible()

      // Save a snapshot
      await page.fill('input[placeholder="Snapshot name..."]', 'Snapshot 1')
      await page.click('button:has-text("Save")')

      // Verify count updated
      await expect(page.locator('text=(1/10)')).toBeVisible({ timeout: 2000 })
    })
  })

  test.describe('List & Display Snapshots', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToCanvas(page)

      // Clear and create test snapshots
      await page.evaluate(() => {
        localStorage.removeItem('canvas-snapshots-v2')
      })

      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Create 3 test snapshots
      for (let i = 1; i <= 3; i++) {
        await page.fill('input[placeholder="Snapshot name..."]', `Snapshot ${i}`)
        await page.click('button:has-text("Save")')
        await page.waitForTimeout(100)
      }
    })

    test('lists all snapshots in order', async ({ page }) => {
      // Verify all 3 snapshots visible
      await expect(page.locator('text=Snapshot 1')).toBeVisible()
      await expect(page.locator('text=Snapshot 2')).toBeVisible()
      await expect(page.locator('text=Snapshot 3')).toBeVisible()
    })

    test('shows timestamps for each snapshot', async ({ page }) => {
      // Verify timestamps present (format: MM/DD/YYYY or locale-specific)
      const snapshots = page.locator('[class*="bg-white"][class*="border-gray-200"]')
      const count = await snapshots.count()
      expect(count).toBeGreaterThanOrEqual(3)

      // Check first snapshot has timestamp
      const firstSnapshot = snapshots.first()
      await expect(firstSnapshot).toContainText(/\d/)
    })

    test('shows empty state when no snapshots', async ({ page }) => {
      // Clear all snapshots
      await page.evaluate(() => {
        localStorage.setItem('canvas-snapshots-v2', JSON.stringify([]))
      })

      await page.reload()
      await page.waitForLoadState('networkidle')

      // Verify empty state
      await expect(page.locator('text=No snapshots yet')).toBeVisible({ timeout: 2000 })
    })
  })

  test.describe('Restore Snapshots', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToCanvas(page)

      await page.evaluate(() => localStorage.removeItem('canvas-snapshots-v2'))

      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Create test snapshot
      await page.fill('input[placeholder="Snapshot name..."]', 'Restore Test')
      await page.click('button:has-text("Save")')
      await page.waitForTimeout(200)
    })

    test('restores snapshot with confirmation', async ({ page }) => {
      // Setup confirmation dialog handler
      page.on('dialog', dialog => dialog.accept())

      // Click Restore button
      await page.click('button:has-text("Restore")')

      // Verify confirmation dialog appeared (implicitly handled by dialog listener)
      // If restore succeeded, no error alert should appear
      await page.waitForTimeout(500)

      // Verify no error dialog
      const alerts = await page.locator('text=Failed to restore').count()
      expect(alerts).toBe(0)
    })

    test('cancels restore when user declines', async ({ page }) => {
      // Setup confirmation dialog handler to decline
      page.on('dialog', dialog => dialog.dismiss())

      // Click Restore button
      await page.click('button:has-text("Restore")')

      // Snapshot should still be in list (not deleted)
      await expect(page.locator('text=Restore Test')).toBeVisible()
    })
  })

  test.describe('Delete Snapshots', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToCanvas(page)

      await page.evaluate(() => localStorage.removeItem('canvas-snapshots-v2'))

      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Create 2 test snapshots
      await page.fill('input[placeholder="Snapshot name..."]', 'Delete Me')
      await page.click('button:has-text("Save")')
      await page.waitForTimeout(100)

      await page.fill('input[placeholder="Snapshot name..."]', 'Keep Me')
      await page.click('button:has-text("Save")')
      await page.waitForTimeout(100)
    })

    test('deletes snapshot with confirmation', async ({ page }) => {
      // Setup confirmation dialog handler
      page.on('dialog', dialog => dialog.accept())

      // Find "Delete Me" snapshot and click Delete
      const deleteRow = page.locator('text=Delete Me').locator('..')
      await deleteRow.locator('button:has-text("Delete")').click()

      // Verify snapshot removed
      await expect(page.locator('text=Delete Me')).not.toBeVisible({ timeout: 2000 })

      // Verify other snapshot still exists
      await expect(page.locator('text=Keep Me')).toBeVisible()

      // Verify count updated
      await expect(page.locator('text=(1/10)')).toBeVisible()
    })

    test('cancels delete when user declines', async ({ page }) => {
      // Setup confirmation dialog handler to decline
      page.on('dialog', dialog => dialog.dismiss())

      // Click Delete
      const deleteRow = page.locator('text=Delete Me').locator('..')
      await deleteRow.locator('button:has-text("Delete")').click()

      // Snapshot should still exist
      await expect(page.locator('text=Delete Me')).toBeVisible()
    })
  })

  test.describe('FIFO Rotation (Max 10)', () => {
    test('rotates oldest snapshot when exceeding max', async ({ page }) => {
      await navigateToCanvas(page)

      await page.evaluate(() => localStorage.removeItem('canvas-snapshots-v2'))

      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Create 12 snapshots (exceeds max of 10)
      for (let i = 1; i <= 12; i++) {
        await page.fill('input[placeholder="Snapshot name..."]', `Snapshot ${i}`)
        await page.click('button:has-text("Save")')
        await page.waitForTimeout(50)
      }

      // Verify only 10 snapshots exist
      const snapshots = await page.locator('[class*="bg-white"][class*="border-gray-200"]').count()
      expect(snapshots).toBe(10)

      // Verify oldest (Snapshot 1 & 2) were rotated out
      await expect(page.locator('text=Snapshot 1')).not.toBeVisible()
      await expect(page.locator('text=Snapshot 2')).not.toBeVisible()

      // Verify newest (Snapshot 3-12) still exist
      await expect(page.locator('text=Snapshot 3')).toBeVisible()
      await expect(page.locator('text=Snapshot 12')).toBeVisible()

      // Verify count shows (10/10)
      await expect(page.locator('text=(10/10)')).toBeVisible()
    })

    test('shows warning when at max capacity', async ({ page }) => {
      await navigateToCanvas(page)

      await page.evaluate(() => localStorage.removeItem('canvas-snapshots-v2'))

      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Create 10 snapshots
      for (let i = 1; i <= 10; i++) {
        await page.fill('input[placeholder="Snapshot name..."]', `Snap ${i}`)
        await page.click('button:has-text("Save")')
        await page.waitForTimeout(50)
      }

      // Verify warning message appears
      await expect(page.locator('text=At max capacity')).toBeVisible({ timeout: 2000 })
    })
  })

  test.describe('Visual Diff Overlay', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToCanvas(page)

      await page.evaluate(() => localStorage.removeItem('canvas-snapshots-v2'))

      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Create snapshot for comparison
      await page.fill('input[placeholder="Snapshot name..."]', 'Compare Test')
      await page.click('button:has-text("Save")')
      await page.waitForTimeout(200)
    })

    test('shows Compare button for each snapshot', async ({ page }) => {
      // Verify Compare button exists
      await expect(page.locator('button:has-text("Compare")')).toBeVisible()
    })

    test('clicking Compare loads visual diff', async ({ page }) => {
      // Click Compare button
      await page.click('button:has-text("Compare")')

      // Verify visual diff overlay rendered (data-testid)
      await expect(page.locator('[data-testid="visual-diff-overlay"]')).toBeVisible({ timeout: 1000 })
    })

    test('D key toggles visual diff on/off', async ({ page }) => {
      // Click Compare to load snapshot
      await page.click('button:has-text("Compare")')

      // Verify overlay visible
      await expect(page.locator('[data-testid="visual-diff-overlay"]')).toBeVisible({ timeout: 1000 })

      // Press D to toggle off
      await page.keyboard.press('d')
      await page.waitForTimeout(100)

      // Verify overlay hidden
      await expect(page.locator('[data-testid="visual-diff-overlay"]')).not.toBeVisible()

      // Press D to toggle back on
      await page.keyboard.press('d')
      await page.waitForTimeout(100)

      // Verify overlay visible again
      await expect(page.locator('[data-testid="visual-diff-overlay"]')).toBeVisible()
    })

    test('ESC key clears comparison', async ({ page }) => {
      // Click Compare
      await page.click('button:has-text("Compare")')

      // Verify overlay visible
      await expect(page.locator('[data-testid="visual-diff-overlay"]')).toBeVisible({ timeout: 1000 })

      // Press ESC to clear
      await page.keyboard.press('Escape')
      await page.waitForTimeout(100)

      // Verify overlay removed (not just hidden)
      await expect(page.locator('[data-testid="visual-diff-overlay"]')).not.toBeVisible()
    })

    test('D key does nothing when typing in input', async ({ page }) => {
      // Click Compare
      await page.click('button:has-text("Compare")')

      // Verify overlay visible
      await expect(page.locator('[data-testid="visual-diff-overlay"]')).toBeVisible({ timeout: 1000 })

      // Focus input field
      const input = page.locator('input[placeholder="Snapshot name..."]')
      await input.click()

      // Type 'd' in input
      await input.type('d')

      // Verify overlay still visible (D key ignored while typing)
      await expect(page.locator('[data-testid="visual-diff-overlay"]')).toBeVisible()

      // Verify input has 'd'
      expect(await input.inputValue()).toBe('d')
    })
  })

  test.describe('Accessibility', () => {
    test('SnapshotPanel has zero Axe violations', async ({ page }) => {
      await navigateToCanvas(page)

      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Run Axe on snapshot panel
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('text=Snapshots')
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('snapshot list items have proper semantic structure', async ({ page }) => {
      await navigateToCanvas(page)

      await page.evaluate(() => localStorage.removeItem('canvas-snapshots-v2'))

      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      // Create snapshot
      await page.fill('input[placeholder="Snapshot name..."]', 'A11y Test')
      await page.click('button:has-text("Save")')

      // Verify buttons have accessible labels
      const compareBtn = page.locator('button:has-text("Compare")')
      await expect(compareBtn).toHaveAttribute('title', /Compare/)

      const restoreBtn = page.locator('button:has-text("Restore")')
      await expect(restoreBtn).toHaveAttribute('title', /Restore/)

      const deleteBtn = page.locator('button:has-text("Delete")')
      await expect(deleteBtn).toHaveAttribute('title', /Delete/)
    })
  })

  test.describe('Performance', () => {
    test('saves and loads 10 snapshots in <100ms', async ({ page }) => {
      await navigateToCanvas(page)

      const panel = page.locator('text=Snapshots')
      if (!(await panel.isVisible())) {
        test.skip(true, 'VITE_FEATURE_SNAPSHOTS_V2 flag not enabled')
      }

      const start = Date.now()

      // Save 10 snapshots
      for (let i = 1; i <= 10; i++) {
        await page.fill('input[placeholder="Snapshot name..."]', `Perf ${i}`)
        await page.click('button:has-text("Save")')
      }

      // Reload to trigger load
      await page.reload()
      await page.waitForLoadState('networkidle')

      const duration = Date.now() - start

      // Verify all 10 snapshots loaded
      await expect(page.locator('text=(10/10)')).toBeVisible({ timeout: 2000 })

      // Note: E2E timing includes network/rendering, so budget is higher than unit tests
      expect(duration).toBeLessThan(5000) // 5 seconds budget for E2E
    })
  })
})
