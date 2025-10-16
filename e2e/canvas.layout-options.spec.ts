import { test, expect } from '@playwright/test'
import { openCanvas, getNode, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

test.describe('Canvas Layout Options', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('layout options panel opens and closes', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Click layout button
    await page.locator('button:has-text("🔧 Layout")').click()
    
    // Panel should be visible
    await expect(page.locator('text=Layout Options')).toBeVisible()
    await expect(page.locator('text=Direction')).toBeVisible()
    
    // Close panel
    await page.locator('button[aria-label="Close layout options"]').click()
    await expect(page.locator('text=Layout Options')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('direction can be changed', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.locator('button:has-text("🔧 Layout")').click()
    
    // Click Left-Right direction
    await page.locator('button:has-text("➡️ Left-Right")').click()
    
    // Button should be highlighted
    await expect(page.locator('button:has-text("➡️ Left-Right")')).toHaveClass(/bg-\[#EA7B4B\]/)
    
    expectNoConsoleErrors(errors)
  })

  test('node spacing slider works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.locator('button:has-text("🔧 Layout")').click()
    
    // Change node spacing
    const slider = page.locator('input[type="range"]').first()
    await slider.fill('80')
    
    // Label should update
    await expect(page.locator('text=Node Spacing: 80px')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('layer spacing slider works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.locator('button:has-text("🔧 Layout")').click()
    
    // Change layer spacing
    const slider = page.locator('input[type="range"]').nth(1)
    await slider.fill('100')
    
    // Label should update
    await expect(page.locator('text=Layer Spacing: 100px')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('respect locked nodes can be toggled', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.locator('button:has-text("🔧 Layout")').click()
    
    const checkbox = page.locator('label:has-text("Respect Locked Nodes") input')
    
    // Toggle off
    await checkbox.uncheck()
    await expect(checkbox).not.toBeChecked()
    
    // Toggle back on
    await checkbox.check()
    await expect(checkbox).toBeChecked()
    
    expectNoConsoleErrors(errors)
  })

  test('apply layout shows loading state', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await page.locator('button:has-text("🔧 Layout")').click()
    
    // Click apply
    await page.locator('button:has-text("Apply Layout")').click()
    
    // Should show loading state briefly
    await expect(page.locator('text=Applying...')).toBeVisible()
    
    // Wait for completion
    await page.waitForTimeout(1000)
    
    // Panel should close
    await expect(page.locator('text=Layout Options')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('layout respects locked nodes', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Select first node and lock it
    const node = getNode(page, 0)
    await node.click()
    
    // Open properties panel and lock
    const lockedCheckbox = page.locator('label:has-text("Locked") input')
    await lockedCheckbox.check()
    
    // Get initial position
    const initialBox = await node.boundingBox()
    if (!initialBox) throw new Error('Could not get node box')
    
    // Apply layout
    await page.locator('button:has-text("🔧 Layout")').click()
    await page.locator('button:has-text("Apply Layout")').click()
    await page.waitForTimeout(1500)
    
    // Locked node position should not change significantly
    const finalBox = await node.boundingBox()
    if (!finalBox) throw new Error('Could not get final box')
    
    expect(Math.abs(finalBox.x - initialBox.x)).toBeLessThan(5)
    expect(Math.abs(finalBox.y - initialBox.y)).toBeLessThan(5)
    
    expectNoConsoleErrors(errors)
  })

  test('layout can be undone', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Get initial positions
    const node = getNode(page, 0)
    const initialBox = await node.boundingBox()
    if (!initialBox) throw new Error('Could not get node box')
    
    // Apply layout
    await page.locator('button:has-text("🔧 Layout")').click()
    await page.locator('button:has-text("Apply Layout")').click()
    await page.waitForTimeout(1500)
    
    // Position should change
    const layoutBox = await node.boundingBox()
    if (!layoutBox) throw new Error('Could not get layout box')
    
    // Undo
    await page.locator('button[aria-label="Undo last action"]').click()
    await page.waitForTimeout(200)
    
    // Position should be restored
    const undoBox = await node.boundingBox()
    if (!undoBox) throw new Error('Could not get undo box')
    
    expect(Math.abs(undoBox.x - initialBox.x)).toBeLessThan(5)
    expect(Math.abs(undoBox.y - initialBox.y)).toBeLessThan(5)
    
    expectNoConsoleErrors(errors)
  })

  test('layout options persist across sessions', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Set custom options
    await page.locator('button:has-text("🔧 Layout")').click()
    await page.locator('button:has-text("➡️ Left-Right")').click()
    await page.locator('input[type="range"]').first().fill('70')
    await page.locator('button[aria-label="Close layout options"]').click()
    
    // Reload page
    await page.reload()
    await openCanvas(page)
    
    // Open layout options again
    await page.locator('button:has-text("🔧 Layout")').click()
    
    // Options should be preserved
    await expect(page.locator('button:has-text("➡️ Left-Right")')).toHaveClass(/bg-\[#EA7B4B\]/)
    await expect(page.locator('text=Node Spacing: 70px')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })
})
