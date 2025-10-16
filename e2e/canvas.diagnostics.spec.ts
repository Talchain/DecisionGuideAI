import { test, expect } from '@playwright/test'
import { setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test.describe('Canvas Diagnostics Mode', () => {
  test('diagnostics hidden by default', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.goto('/canvas')
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 10000 })
    
    // Diagnostics should not be visible
    await expect(page.locator('text=Diagnostics')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('diagnostics visible with ?diag=1', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.goto('/canvas?diag=1')
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 10000 })
    
    // Diagnostics should be visible
    await expect(page.locator('text=Diagnostics')).toBeVisible()
    
    // Should show metrics
    await expect(page.locator('text=Timers:')).toBeVisible()
    await expect(page.locator('text=Listeners:')).toBeVisible()
    await expect(page.locator('text=History Size:')).toBeVisible()
    await expect(page.locator('text=Nodes:')).toBeVisible()
    await expect(page.locator('text=Edges:')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('diagnostics can be dismissed', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.goto('/canvas?diag=1')
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 10000 })
    
    // Diagnostics visible
    await expect(page.locator('text=Diagnostics')).toBeVisible()
    
    // Click close button
    await page.locator('button[aria-label="Close diagnostics"]').click()
    
    // Should be hidden
    await expect(page.locator('text=Diagnostics')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('diagnostics updates metrics in real-time', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.goto('/canvas?diag=1')
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 10000 })
    
    // Get initial node count
    const initialText = await page.locator('text=Nodes:').locator('..').textContent()
    const initialCount = parseInt(initialText?.match(/\d+/)?.[0] || '0')
    
    // Add a node
    await page.locator('button:has-text("+ Node")').click()
    
    // Wait for metrics to update
    await page.waitForTimeout(600)
    
    // Node count should increase
    const updatedText = await page.locator('text=Nodes:').locator('..').textContent()
    const updatedCount = parseInt(updatedText?.match(/\d+/)?.[0] || '0')
    
    expect(updatedCount).toBeGreaterThan(initialCount)
    
    expectNoConsoleErrors(errors)
  })
})
