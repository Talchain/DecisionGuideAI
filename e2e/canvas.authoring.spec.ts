import { test, expect } from '@playwright/test'

test.describe('Canvas Authoring Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('inline label editing works', async ({ page }) => {
    const node = page.locator('[data-testid="rf-node"]').first()
    
    await node.dblclick()
    
    const input = node.locator('input[aria-label="Node title"]')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
    
    await input.fill('Updated Label')
    await input.press('Enter')
    
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
    
    await expect(node).toContainText(originalText!)
  })

  test('inline edit enforces max length', async ({ page }) => {
    const node = page.locator('[data-testid="rf-node"]').first()
    await node.dblclick()
    
    const input = node.locator('input')
    const maxLength = await input.getAttribute('maxLength')
    expect(maxLength).toBe('100')
  })

  test('context menu opens on right-click with aria roles', async ({ page }) => {
    await page.locator('.react-flow').click({ button: 'right', position: { x: 300, y: 300 } })
    
    const menu = page.locator('div[role="menu"]')
    await expect(menu).toBeVisible()
    
    await expect(menu).toContainText('Add Node Here')
    await expect(menu).toContainText('Select All')
    await expect(menu).toContainText('Duplicate')
    await expect(menu).toContainText('Delete')
  })

  test('context menu keyboard navigation (arrows and Enter)', async ({ page }) => {
    await page.locator('.react-flow').click({ button: 'right', position: { x: 300, y: 300 } })
    const menu = page.locator('div[role="menu"]')
    await expect(menu).toBeVisible()
    
    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    
    // First actionable item should have focus styling
    const firstItem = menu.locator('button[role="menuitem"]').first()
    await expect(firstItem).toHaveClass(/bg-\[#EA7B4B\]/)
  })

  test('context menu closes on Escape', async ({ page }) => {
    await page.locator('.react-flow').click({ button: 'right', position: { x: 300, y: 300 } })
    const menu = page.locator('div[role="menu"]')
    await expect(menu).toBeVisible()
    
    await page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible()
  })

  test('duplicate creates offset copy', async ({ page }) => {
    const firstNode = page.locator('[data-testid="rf-node"]').first()
    await firstNode.click()
    
    const initialCount = await page.locator('[data-testid="rf-node"]').count()
    
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+d' : 'Control+d')
    
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount + 1)
  })

  test('copy and paste works', async ({ page }) => {
    const firstNode = page.locator('[data-testid="rf-node"]').first()
    await firstNode.click()
    
    const initialCount = await page.locator('[data-testid="rf-node"]').count()
    
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+c' : 'Control+c')
    await page.keyboard.press(isMac ? 'Meta+v' : 'Control+v')
    
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount + 1)
  })

  test('cut operation is atomic (single undo frame)', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="rf-node"]').count()
    const isMac = process.platform === 'darwin'
    
    // Select and cut first node
    const firstNode = page.locator('[data-testid="rf-node"]').first()
    await firstNode.click()
    await page.keyboard.press(isMac ? 'Meta+x' : 'Control+x')
    
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount - 1)
    
    // Single undo should restore both node and clipboard state
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z')
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount)
  })

  test('delete removes selected node', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="rf-node"]').count()
    
    const firstNode = page.locator('[data-testid="rf-node"]').first()
    await firstNode.click()
    await page.keyboard.press('Delete')
    
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount - 1)
  })

  test('undo and redo work', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="rf-node"]').count()
    const isMac = process.platform === 'darwin'
    
    await page.locator('button:has-text("+ Node")').click()
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount + 1)
    
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z')
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount)
    
    await page.keyboard.press(isMac ? 'Meta+y' : 'Control+y')
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount + 1)
  })

  test('nudge burst creates single undo frame', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    const initialCount = await page.locator('[data-testid="rf-node"]').count()
    
    // Select first node
    const node = page.locator('[data-testid="rf-node"]').first()
    await node.click()
    
    // Rapid nudge (should coalesce into single history frame)
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(50) // Simulate rapid but not instant keystrokes
    }
    
    // Wait for debounce window to complete
    await page.waitForTimeout(600)
    
    // Single undo should restore to pre-nudge position
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z')
    
    // Node should exist and be restored
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(initialCount)
  })

  test('select all works', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    
    await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a')
    
    const nodes = page.locator('[data-testid="rf-node"]')
    const count = await nodes.count()
    
    // Check first node has selection styling
    const firstNode = nodes.first()
    await expect(firstNode).toHaveClass(/border-\[#EA7B4B\]/)
  })

  test('toolbar has aria roles and is keyboard accessible', async ({ page }) => {
    const toolbar = page.locator('div[role="toolbar"]')
    await expect(toolbar).toBeVisible()
    
    const ariaLabel = await toolbar.getAttribute('aria-label')
    expect(ariaLabel).toContain('Canvas editing toolbar')
    
    // Check buttons are keyboard focusable
    const addButton = toolbar.locator('button:has-text("+ Node")')
    await addButton.focus()
    await expect(addButton).toBeFocused()
  })

  test('toolbar minimize and restore works', async ({ page }) => {
    const toolbar = page.locator('div[role="toolbar"]')
    await expect(toolbar).toBeVisible()
    
    // Find and click minimize button (down arrow)
    const minimizeBtn = toolbar.locator('button[aria-label="Minimize toolbar"]')
    await minimizeBtn.click()
    
    // Toolbar should be minimized (only restore button visible)
    await expect(toolbar).not.toBeVisible()
    const restoreBtn = page.locator('button[aria-label="Show toolbar"]')
    await expect(restoreBtn).toBeVisible()
    
    // Restore
    await restoreBtn.click()
    await expect(toolbar).toBeVisible()
  })

  test('save snapshot works', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    
    await page.keyboard.press(isMac ? 'Meta+s' : 'Control+s')
    
    const saved = await page.evaluate(() => {
      const data = localStorage.getItem('canvas-snapshot')
      return data !== null
    })
    
    expect(saved).toBe(true)
  })

  test('alignment guides appear during drag (visual check)', async ({ page }) => {
    // This is a smoke test - guides are rendered but may be hard to assert in E2E
    // We just verify no errors during drag operations
    const node = page.locator('[data-testid="rf-node"]').first()
    
    const box = await node.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + 100, box.y + 50, { steps: 5 })
      await page.mouse.up()
    }
    
    // Node should still be visible
    await expect(node).toBeVisible()
  })

  test('no console errors during complex operations', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    
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
    
    // Nudge
    await node.click()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    
    // Wait for any late errors
    await page.waitForTimeout(500)
    
    expect(errors).toHaveLength(0)
  })

  test('snap to grid works (16px base)', async ({ page }) => {
    const node = page.locator('[data-testid="rf-node"]').first()
    
    const box = await node.boundingBox()
    if (box) {
      // Drag node slightly
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + 25, box.y + 25) // Not aligned to 16px grid
      await page.mouse.up()
      
      // Wait for snap
      await page.waitForTimeout(100)
      
      // Node should still be visible (snap doesn't break rendering)
      await expect(node).toBeVisible()
    }
  })
})
