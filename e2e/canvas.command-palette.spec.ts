import { test, expect } from '@playwright/test'
import { openCanvas, getNode, getNodeCount, setupConsoleErrorTracking, expectNoConsoleErrors, pressShortcut } from './helpers/canvas'

test.describe('Canvas Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('opens on Cmd/Ctrl+K', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 'k')
    
    await expect(page.locator('text=Search actions...')).toBeVisible()
    await expect(page.locator('text=Add Node Here')).toBeVisible()
    await expect(page.locator('text=Tidy Layout')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('closes on Escape', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 'k')
    await expect(page.locator('text=Search actions...')).toBeVisible()
    
    await page.keyboard.press('Escape')
    await expect(page.locator('text=Search actions...')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('search filters actions', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 'k')
    
    const searchInput = page.locator('input[placeholder="Search actions..."]')
    await searchInput.fill('node')
    
    // Should show "Add Node Here"
    await expect(page.locator('text=Add Node Here')).toBeVisible()
    
    // Should not show unrelated actions
    await expect(page.locator('text=Zoom to Fit')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('arrow keys navigate actions', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 'k')
    
    // First action should be highlighted
    const firstAction = page.locator('button:has-text("Add Node Here")')
    await expect(firstAction).toHaveClass(/bg-\[#EA7B4B\]/)
    
    // Arrow down
    await page.keyboard.press('ArrowDown')
    
    // Second action should be highlighted
    const secondAction = page.locator('button:has-text("Tidy Layout")')
    await expect(secondAction).toHaveClass(/bg-\[#EA7B4B\]/)
    
    expectNoConsoleErrors(errors)
  })

  test('Enter executes selected action', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const initialCount = await getNodeCount(page)
    
    await pressShortcut(page, 'k')
    
    // "Add Node Here" should be selected by default
    await page.keyboard.press('Enter')
    
    // Palette should close
    await expect(page.locator('text=Search actions...')).not.toBeVisible()
    
    // Node should be added
    const newCount = await getNodeCount(page)
    expect(newCount).toBe(initialCount + 1)
    
    expectNoConsoleErrors(errors)
  })

  test('Tidy Layout shows loading state', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 'k')
    
    // Navigate to Tidy Layout
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    
    // Should show loading spinner
    await expect(page.locator('text=Executing...')).toBeVisible()
    
    // Wait for completion
    await page.waitForTimeout(1000)
    
    // Palette should close after execution
    await expect(page.locator('text=Search actions...')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('Select All action works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 'k')
    
    // Search for "select all"
    const searchInput = page.locator('input[placeholder="Search actions..."]')
    await searchInput.fill('select')
    
    await page.keyboard.press('Enter')
    
    // All nodes should be selected
    const nodes = page.locator('[data-testid="rf-node"]')
    const firstNode = nodes.first()
    await expect(firstNode).toHaveClass(/border-\[#EA7B4B\]/)
    
    expectNoConsoleErrors(errors)
  })

  test('Zoom to Fit action works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 'k')
    
    // Search for zoom
    const searchInput = page.locator('input[placeholder="Search actions..."]')
    await searchInput.fill('zoom')
    
    await page.keyboard.press('Enter')
    
    // Palette should close
    await expect(page.locator('text=Search actions...')).not.toBeVisible()
    
    // Viewport should adjust (hard to test precisely, but no errors)
    expectNoConsoleErrors(errors)
  })

  test('Save Snapshot action works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 'k')
    
    // Search for save
    const searchInput = page.locator('input[placeholder="Search actions..."]')
    await searchInput.fill('save')
    
    await page.keyboard.press('Enter')
    
    // Palette should close
    await expect(page.locator('text=Search actions...')).not.toBeVisible()
    
    // Snapshot should be saved (verify via opening snapshot manager)
    await page.locator('button:has-text("Snapshots")').click()
    await expect(page.locator('text=/1\\/10 snapshots/')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('shows keyboard shortcut hints', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 'k')
    
    // Should show shortcuts for actions that have them
    await expect(page.locator('text=⌘A')).toBeVisible() // Select All
    await expect(page.locator('text=⌘S')).toBeVisible() // Save Snapshot
    
    expectNoConsoleErrors(errors)
  })

  test('click outside closes palette', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 'k')
    await expect(page.locator('text=Search actions...')).toBeVisible()
    
    // Click outside (on the backdrop)
    await page.locator('.fixed.inset-0').click({ position: { x: 10, y: 10 } })
    
    await expect(page.locator('text=Search actions...')).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })
})
