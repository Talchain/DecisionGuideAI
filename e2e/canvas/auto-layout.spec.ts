/**
 * Auto-layout E2E tests
 * Tests grid, hierarchy, and flow presets
 */

import { test, expect } from '@playwright/test'

test.describe('Auto-Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5176/#/canvas')
    await expect(page.locator('[data-testid="react-flow-graph"]')).toBeVisible({ timeout: 10000 })
  })

  test('shows layout popover with 3 presets', async ({ page }) => {
    // Click layout button
    await page.locator('[data-testid="btn-layout"]').click()
    
    // Popover should appear
    await expect(page.locator('[data-testid="layout-popover"]')).toBeVisible()
    
    // All 3 presets should be visible
    await expect(page.locator('[data-testid="layout-preset-grid"]')).toBeVisible()
    await expect(page.locator('[data-testid="layout-preset-hierarchy"]')).toBeVisible()
    await expect(page.locator('[data-testid="layout-preset-flow"]')).toBeVisible()
  })

  test('applies grid layout and changes node positions', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    // Get initial position of first node
    const node = page.locator('.react-flow__node').first()
    const initialBox = await node.boundingBox()
    
    // Open layout popover
    await page.locator('[data-testid="btn-layout"]').click()
    await expect(page.locator('[data-testid="layout-popover"]')).toBeVisible()
    
    // Apply grid layout
    await page.locator('[data-testid="layout-preset-grid"]').click()
    
    // Wait for success toast (deterministic)
    await expect(page.locator('text=Grid layout applied')).toBeVisible({ timeout: 3000 })
    
    // Position should have changed
    const newBox = await node.boundingBox()
    expect(newBox).not.toEqual(initialBox)
    
    // Should not have "require is not defined" error
    const hasRequireError = consoleErrors.some(err => err.includes('require is not defined'))
    expect(hasRequireError).toBe(false)
  })

  test('applies hierarchy layout', async ({ page }) => {
    await page.locator('[data-testid="btn-layout"]').click()
    await page.locator('[data-testid="layout-preset-hierarchy"]').click()
    
    await expect(page.locator('text=Hierarchy layout applied')).toBeVisible({ timeout: 3000 })
  })

  test('applies flow layout', async ({ page }) => {
    await page.locator('[data-testid="btn-layout"]').click()
    await page.locator('[data-testid="layout-preset-flow"]').click()
    
    await expect(page.locator('text=Flow layout applied')).toBeVisible({ timeout: 3000 })
  })

  test('shows toast when graph has < 2 nodes', async ({ page }) => {
    // Delete all nodes except one
    await page.keyboard.press('Meta+a') // Select all
    await page.keyboard.press('Delete')
    
    // Try to apply layout
    await page.locator('[data-testid="btn-layout"]').click()
    await page.locator('[data-testid="layout-preset-grid"]').click()
    
    // Should show "nothing to arrange" message
    await expect(page.locator('text=Nothing to arrange yet')).toBeVisible({ timeout: 3000 })
  })

  test('layout is undoable', async ({ page }) => {
    // Get initial positions
    const nodes = page.locator('.react-flow__node')
    const initialCount = await nodes.count()
    
    // Apply layout
    await page.locator('[data-testid="btn-layout"]').click()
    await page.locator('[data-testid="layout-preset-grid"]').click()
    await expect(page.locator('text=Grid layout applied')).toBeVisible({ timeout: 3000 })
    
    // Undo
    await page.keyboard.press('Meta+z')
    
    // Nodes should still exist
    await expect(nodes).toHaveCount(initialCount)
  })

  test('spacing options change layout spread', async ({ page }) => {
    // Open popover
    await page.locator('[data-testid="btn-layout"]').click()
    
    // Select small spacing
    await page.locator('button:has-text("Small")').click()
    await page.locator('[data-testid="layout-preset-grid"]').click()
    await expect(page.locator('text=Grid layout applied')).toBeVisible({ timeout: 3000 })
    
    const smallBox = await page.locator('.react-flow__node').last().boundingBox()
    
    // Undo
    await page.keyboard.press('Meta+z')
    
    // Apply with large spacing
    await page.locator('[data-testid="btn-layout"]').click()
    await page.locator('button:has-text("Large")').click()
    await page.locator('[data-testid="layout-preset-grid"]').click()
    await expect(page.locator('text=Grid layout applied')).toBeVisible({ timeout: 3000 })
    
    const largeBox = await page.locator('.react-flow__node').last().boundingBox()
    
    // Large spacing should create more spread
    expect(largeBox!.x).toBeGreaterThan(smallBox!.x)
  })
})
