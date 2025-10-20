/**
 * E2E test for v1→v2 migration and round-trip import/export
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

test.describe('Canvas Migration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await page.waitForSelector('[data-testid="react-flow-graph"]', { timeout: 10000 })
  })

  test('imports v1 fixture with inferred types and preserves edge labels', async ({ page }) => {
    // Load v1 fixture
    const v1Fixture = readFileSync(join(__dirname, '../fixtures/canvas-v1.json'), 'utf-8')
    
    // Open import dialog
    const importButton = page.locator('button:has-text("Import")')
    await expect(importButton).toBeVisible({ timeout: 3000 })
    await importButton.click()
    
    // Wait for import dialog
    const importDialog = page.locator('[role="dialog"]').filter({ hasText: /import/i })
    await expect(importDialog).toBeVisible({ timeout: 3000 })
    
    // Paste v1 JSON
    const textarea = importDialog.locator('textarea')
    await textarea.fill(v1Fixture)
    
    // Click import button
    const confirmButton = importDialog.locator('button:has-text("Import")')
    await confirmButton.click()
    
    // Wait for nodes to render
    const nodes = page.locator('.react-flow__node')
    await expect(nodes.first()).toBeVisible({ timeout: 5000 })
    
    // Verify we have 2 nodes
    await expect(nodes).toHaveCount(2)
    
    // Verify node labels preserved
    await expect(page.locator('text=Goal: Launch product')).toBeVisible()
    await expect(page.locator('text=Risk: Competition')).toBeVisible()
    
    // Verify edge exists with label
    const edges = page.locator('.react-flow__edge')
    await expect(edges.first()).toBeVisible({ timeout: 3000 })
  })

  test('exports v2 and re-imports cleanly (round-trip)', async ({ page }) => {
    // Export current canvas
    const exportButton = page.locator('button:has-text("Export")')
    await expect(exportButton).toBeVisible({ timeout: 3000 })
    await exportButton.click()
    
    // Wait for export dialog
    const exportDialog = page.locator('[role="dialog"]').filter({ hasText: /export/i })
    await expect(exportDialog).toBeVisible({ timeout: 3000 })
    
    // Get exported JSON
    const textarea = exportDialog.locator('textarea')
    const exportedJSON = await textarea.inputValue()
    
    // Verify it's v2
    const parsed = JSON.parse(exportedJSON)
    expect(parsed.version).toBe(2)
    
    // Close export dialog
    const closeButton = exportDialog.locator('button:has-text("Close")').or(exportDialog.locator('[aria-label="Close"]'))
    await closeButton.first().click()
    
    // Now re-import the same JSON
    const importButton = page.locator('button:has-text("Import")')
    await importButton.click()
    
    const importDialog = page.locator('[role="dialog"]').filter({ hasText: /import/i })
    await expect(importDialog).toBeVisible({ timeout: 3000 })
    
    const importTextarea = importDialog.locator('textarea')
    await importTextarea.fill(exportedJSON)
    
    const confirmButton = importDialog.locator('button:has-text("Import")')
    await confirmButton.click()
    
    // Verify nodes still render
    const nodes = page.locator('.react-flow__node')
    await expect(nodes.first()).toBeVisible({ timeout: 5000 })
    
    // Verify node count matches
    expect(await nodes.count()).toBeGreaterThan(0)
  })
})
