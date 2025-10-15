import { test, expect } from '@playwright/test'

test.describe('Canvas Hardened', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('[data-testid="build-badge"]')).toBeVisible()
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('renders with badge and graph', async ({ page }) => {
    const badge = page.locator('[data-testid="build-badge"]')
    await expect(badge).toContainText('ROUTE=/canvas')
    const nodes = page.locator('[data-id]').filter({ has: page.locator('.react-flow__node') })
    await expect(nodes.first()).toBeVisible()
  })

  test('add node creates new node', async ({ page }) => {
    const addBtn = page.locator('button:has-text("+ Node")')
    await addBtn.click()
    // Wait for node to appear in the flow
    await page.waitForFunction(() => {
      const rfInstance = (window as any).__RF__;
      return rfInstance?.getNodes?.()?.length >= 5;
    })
  })

  test('delete selected node works', async ({ page }) => {
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()
    await page.keyboard.press('Delete')
    await page.waitForFunction(() => {
      const rfInstance = (window as any).__RF__;
      return rfInstance?.getNodes?.()?.length === 3;
    })
  })

  test('undo/redo works', async ({ page }) => {
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForFunction(() => (window as any).__RF__?.getNodes?.()?.length >= 5)
    
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
    await page.waitForFunction(() => (window as any).__RF__?.getNodes?.()?.length === 4)
    
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z')
    await page.waitForFunction(() => (window as any).__RF__?.getNodes?.()?.length >= 5)
  })

  test('redo with Ctrl+Y works', async ({ page }) => {
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForFunction(() => (window as any).__RF__?.getNodes?.()?.length >= 5)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+y' : 'Control+y')
    await page.waitForFunction(() => (window as any).__RF__?.getNodes?.()?.length >= 5)
  })

  test('reset restores demo graph', async ({ page }) => {
    await page.locator('button:has-text("+ Node")').click()
    await page.locator('button:has-text("Reset")').click()
    await page.waitForFunction(() => (window as any).__RF__?.getNodes?.()?.length === 4)
  })

  test('multiple edges between same nodes', async ({ page }) => {
    // Connect two nodes multiple times
    const node1 = page.locator('.react-flow__node').first()
    const node2 = page.locator('.react-flow__node').nth(1)
    
    const box1 = await node1.boundingBox()
    const box2 = await node2.boundingBox()
    
    if (box1 && box2) {
      // First edge
      await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height)
      await page.mouse.down()
      await page.mouse.move(box2.x + box2.width / 2, box2.y)
      await page.mouse.up()
      
      // Second edge (same nodes)
      await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height)
      await page.mouse.down()
      await page.mouse.move(box2.x + box2.width / 2, box2.y)
      await page.mouse.up()
    }
    
    // Both edges should exist with unique IDs
    await page.waitForFunction(() => {
      const rfInstance = (window as any).__RF__;
      return rfInstance?.getEdges?.()?.length >= 5;
    })
  })

  test('persistence with ID reseeding', async ({ page, context }) => {
    // Add 3 nodes
    await page.locator('button:has-text("+ Node")').click()
    await page.locator('button:has-text("+ Node")').click()
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForFunction(() => (window as any).__RF__?.getNodes?.()?.length === 7)
    
    // Wait for autosave (2s debounce)
    await page.waitForTimeout(2500)
    
    // Reload
    const newPage = await context.newPage()
    await newPage.goto('/#/canvas')
    await expect(newPage.locator('.react-flow')).toBeVisible()
    await newPage.waitForFunction(() => (window as any).__RF__?.getNodes?.()?.length === 7)
    
    // Add another node - should not collide
    await newPage.locator('button:has-text("+ Node")').click()
    await newPage.waitForFunction(() => (window as any).__RF__?.getNodes?.()?.length === 8)
    
    // Check for console errors
    const errors: string[] = []
    newPage.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    
    await newPage.waitForTimeout(500)
    expect(errors).toHaveLength(0)
    
    await newPage.close()
  })

  test('drag node with no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    
    const node = page.locator('.react-flow__node').first()
    const box = await node.boundingBox()
    
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + 100, box.y + 100)
      await page.mouse.up()
    }
    
    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
  })
})
