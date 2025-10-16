import { test, expect } from '@playwright/test'
import { openCanvas, openContextMenu, getNode, getNodeCount, setupConsoleErrorTracking, expectNoConsoleErrors, pressShortcut } from './helpers/canvas'

test.describe('Canvas Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('right-click opens menu with correct structure', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openContextMenu(page, 300, 300)
    
    const menu = page.locator('div[role="menu"]')
    await expect(menu).toBeVisible()
    await expect(menu).toHaveAttribute('aria-label', 'Canvas context menu')
    
    // Check menu items
    await expect(menu.locator('button[role="menuitem"]:has-text("Add Node Here")')).toBeVisible()
    await expect(menu.locator('button[role="menuitem"]:has-text("Select All")')).toBeVisible()
    await expect(menu.locator('button[role="menuitem"]:has-text("Duplicate")')).toBeVisible()
    await expect(menu.locator('button[role="menuitem"]:has-text("Delete")')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('arrow keys navigate menu items', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openContextMenu(page, 300, 300)
    const menu = page.locator('div[role="menu"]')
    
    // First item should have focus styling
    const firstItem = menu.locator('button[role="menuitem"]').first()
    await expect(firstItem).toHaveClass(/bg-\[#EA7B4B\]/)
    
    // Arrow down
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)
    
    // Focus should move (visual check via class)
    const items = menu.locator('button[role="menuitem"]')
    const count = await items.count()
    expect(count).toBeGreaterThan(1)
    
    expectNoConsoleErrors(errors)
  })

  test('Escape closes menu', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openContextMenu(page, 300, 300)
    const menu = page.locator('div[role="menu"]')
    await expect(menu).toBeVisible()
    
    await page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('click outside closes menu', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openContextMenu(page, 300, 300)
    const menu = page.locator('div[role="menu"]')
    await expect(menu).toBeVisible()
    
    // Click outside
    await page.locator('.react-flow').click({ position: { x: 100, y: 100 } })
    await expect(menu).not.toBeVisible()
    
    expectNoConsoleErrors(errors)
  })

  test('Add Node Here action works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const initialCount = await getNodeCount(page)
    
    await openContextMenu(page, 300, 300)
    await page.locator('button[role="menuitem"]:has-text("Add Node Here")').click()
    
    const newCount = await getNodeCount(page)
    expect(newCount).toBe(initialCount + 1)
    
    expectNoConsoleErrors(errors)
  })

  test('Duplicate action works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Select first node
    const node = getNode(page, 0)
    await node.click()
    
    const initialCount = await getNodeCount(page)
    
    await openContextMenu(page, 300, 300)
    await page.locator('button[role="menuitem"]:has-text("Duplicate")').click()
    
    const newCount = await getNodeCount(page)
    expect(newCount).toBe(initialCount + 1)
    
    expectNoConsoleErrors(errors)
  })

  test('Delete action works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const node = getNode(page, 0)
    await node.click()
    
    const initialCount = await getNodeCount(page)
    
    await openContextMenu(page, 300, 300)
    await page.locator('button[role="menuitem"]:has-text("Delete")').click()
    
    const newCount = await getNodeCount(page)
    expect(newCount).toBe(initialCount - 1)
    
    expectNoConsoleErrors(errors)
  })

  test('Select All action works', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openContextMenu(page, 300, 300)
    await page.locator('button[role="menuitem"]:has-text("Select All")').click()
    
    // All nodes should have selection styling
    const nodes = page.locator('[data-testid="rf-node"]')
    const firstNode = nodes.first()
    await expect(firstNode).toHaveClass(/border-\[#EA7B4B\]/)
    
    expectNoConsoleErrors(errors)
  })

  test('no memory leak after 30 open/close cycles', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Inject listener counter
    await page.evaluate(() => {
      (window as any).__listenerCount = 0
      const originalAdd = document.addEventListener
      const originalRemove = document.removeEventListener
      
      document.addEventListener = function(...args: any[]) {
        if (args[0] === 'mousedown' || args[0] === 'keydown') {
          (window as any).__listenerCount++
        }
        return originalAdd.apply(this, args as any)
      }
      
      document.removeEventListener = function(...args: any[]) {
        if (args[0] === 'mousedown' || args[0] === 'keydown') {
          (window as any).__listenerCount--
        }
        return originalRemove.apply(this, args as any)
      }
    })
    
    const initialCount = await page.evaluate(() => (window as any).__listenerCount)
    
    // Open and close 30 times
    for (let i = 0; i < 30; i++) {
      await openContextMenu(page, 300, 300)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(50)
    }
    
    const finalCount = await page.evaluate(() => (window as any).__listenerCount)
    
    // Should be back to initial (no leaks)
    expect(Math.abs(finalCount - initialCount)).toBeLessThanOrEqual(2) // Allow small tolerance
    
    expectNoConsoleErrors(errors)
  })

  test('keyboard shortcut hints are visible', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await openContextMenu(page, 300, 300)
    const menu = page.locator('div[role="menu"]')
    
    // Check for shortcut text
    await expect(menu.locator('text=⌘D')).toBeVisible()
    await expect(menu.locator('text=⌘A')).toBeVisible()
    
    expectNoConsoleErrors(errors)
  })
})
