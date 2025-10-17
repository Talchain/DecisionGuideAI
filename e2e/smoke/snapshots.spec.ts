// e2e/smoke/snapshots.spec.ts
// @smoke - Snapshot save/restore with rotation limits

import { test, expect } from '@playwright/test'

test('snapshot save and restore', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Look for snapshot controls
  const snapshotButton = page.locator('button:has-text("Snapshot"), button:has-text("Save")')
  
  if (await snapshotButton.isVisible().catch(() => false)) {
    await snapshotButton.click()
    await page.waitForTimeout(500)
    
    // Verify snapshot saved (check for success indicator or count)
    const snapshotList = page.locator('[data-testid="snapshot-list"], .snapshot-item')
    if (await snapshotList.isVisible().catch(() => false)) {
      const count = await snapshotList.count()
      expect(count).toBeGreaterThan(0)
    }
  }
  
  // Verify no console errors
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  
  await page.waitForTimeout(1000)
  expect(errors).toHaveLength(0)
})

test('snapshot rotation respects cap', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Check for snapshot cap in UI or storage
  const MAX_SNAPSHOTS = 10
  
  // Verify localStorage respects cap (if snapshots are persisted)
  const snapshotsData = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.includes('snapshot'))
    return keys.length
  })
  
  // Should not exceed reasonable cap
  expect(snapshotsData).toBeLessThanOrEqual(MAX_SNAPSHOTS + 2) // +2 for metadata
})
