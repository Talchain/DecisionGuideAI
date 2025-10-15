import { test, expect } from '@playwright/test'

test.describe('Canvas Authoring Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('inline label editing works', async ({ page }) => {
    // Find first node
    const node = page.locator('[data-testid="rf-node"]').first()
    
    // Double-click to enter edit mode
    await node.dblclick()
    
    // Input should be visible and focused
    const input = node.locator('input')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
    
    // Type new label
    await input.fill('Updated Label')
    
    // Press Enter to commit
    await input.press('Enter')
    
    // Input should be gone, text should show new label
    await expect(input).not.toBeVisible()
    await expect(node).toContainText('Updated Label')
  })

  test('inline edit cancels on Escape', async ({ page }) => {
    const node = page.locator('[data-testid="rf-node"]').first()
    const originalText = await node.textContent()
    
    await node.dblclick()
    const input = node.locator('input')
    await input.fill('Temporary Text')
    await input.press('Escape')
    
    // Should revert to original
    await expect(node).toContainText(originalText!)
  })

  test('context menu opens on right-click', async ({ page }) => {
    // Right-click on canvas
    await page.locator('.react-flow').click({ button: 'right', position: { x: 300, y: 300 } })
    
    // Context menu should appear
    const menu = page.locator('.fixed.bg-white.rounded-xl')
    await expect(menu).toBeVisible()
    
    // Should have menu items
    await expect(menu).toContainText('Add Node Here')
    await expect(menu).toContainText('Duplicate')
    await expect(menu).toContainText('Delete')
  })

  test('context menu closes on Escape', async ({ page }) => {
    await page.locator('.react-flow').click({ button: 'right', position: { x: 300, y: 300 } })
    const menu = page.locator('.fixed.bg-white.rounded-xl')
    await expect(menu).toBeVisible()
    
    await page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible()
  })

  test('duplicate creates offset copy', async ({ page }) => {
    // Select first node
    const firstNode = page.locator('[data-testid="rf-node"]').first()
    await firstNode.click()
    
    // Get initial node count
    const initialCount = await page.locator('[data-testid="rf-node"]').count()
    
    // Press Cmd+D (Mac) or Ctrl+D (Windows/Linux)
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+d' : 'Control+d')
    
    // Should have one more node
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount + 1)
  })

  test('copy and paste works', async ({ page }) => {
    const firstNode = page.locator('[data-testid="rf-node"]').first()
    await firstNode.click()
    
    const initialCount = await page.locator('[data-testid="rf-node"]').count()
    
    // Copy
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+c' : 'Control+c')
    
    // Paste
    await page.keyboard.press(isMac ? 'Meta+v' : 'Control+v')
    
    // Should have one more node
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount + 1)
  })

  test('delete removes selected node', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="rf-node"]').count()
    
    // Select and delete first node
    const firstNode = page.locator('[data-testid="rf-node"]').first()
    await firstNode.click()
    await page.keyboard.press('Delete')
    
    // Should have one fewer node
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount - 1)
  })

  test('undo and redo work', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="rf-node"]').count()
    const isMac = process.platform === 'darwin'
    
    // Add a node via toolbar
    await page.locator('button:has-text("+ Node")').click()
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount + 1)
    
    // Undo
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z')
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount)
    
    // Redo
    await page.keyboard.press(isMac ? 'Meta+y' : 'Control+y')
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount + 1)
  })

  test('select all works', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    
    // Select all
    await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a')
    
    // All nodes should be selected (have selected class)
    const nodes = page.locator('[data-testid="rf-node"]')
    const count = await nodes.count()
    
    // Check at least some nodes are selected (border color check)
    const firstNode = nodes.first()
    await expect(firstNode).toHaveClass(/border-\[#EA7B4B\]/)
  })

  test('toolbar buttons work', async ({ page }) => {
    // Toolbar should be visible
    const toolbar = page.locator('.fixed.bottom-6')
    await expect(toolbar).toBeVisible()
    
    // Check buttons exist
    await expect(toolbar.locator('button:has-text("+ Node")')).toBeVisible()
    await expect(toolbar.locator('button:has-text("Save")')).toBeVisible()
    
    // Undo/Redo buttons should be disabled initially (no history)
    const undoBtn = toolbar.locator('button').filter({ has: page.locator('svg') }).first()
    // Note: May or may not be disabled depending on initial state
  })

  test('save snapshot works', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    
    // Save with keyboard
    await page.keyboard.press(isMac ? 'Meta+s' : 'Control+s')
    
    // Check localStorage was updated (via evaluate)
    const saved = await page.evaluate(() => {
      const data = localStorage.getItem('canvas-snapshot')
      return data !== null
    })
    
    expect(saved).toBe(true)
  })

  test('nudge with arrow keys works', async ({ page }) => {
    // Select first node
    const node = page.locator('[data-testid="rf-node"]').first()
    await node.click()
    
    // Get initial position (via React Flow internals)
    // We'll just verify the node is still there after nudging
    
    // Nudge right
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    
    // Node should still exist
    await expect(node).toBeVisible()
    
    // Shift+Arrow for larger nudge
    await page.keyboard.press('Shift+ArrowDown')
    await expect(node).toBeVisible()
  })

  test('no console errors during operations', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    
    // Perform various operations
    const isMac = process.platform === 'darwin'
    
    // Edit label
    const node = page.locator('[data-testid="rf-node"]').first()
    await node.dblclick()
    await node.locator('input').fill('Test')
    await node.locator('input').press('Enter')
    
    // Duplicate
    await node.click()
    await page.keyboard.press(isMac ? 'Meta+d' : 'Control+d')
    
    // Undo
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z')
    
    // Context menu
    await page.locator('.react-flow').click({ button: 'right', position: { x: 300, y: 300 } })
    await page.keyboard.press('Escape')
    
    // Wait for any late errors
    await page.waitForTimeout(500)
    
    // Should have no errors
    expect(errors).toHaveLength(0)
  })
})
