import { test, expect } from '@playwright/test'

test.describe('Canvas MVP', () => {
  test('loads and displays badge', async ({ page }) => {
    await page.goto('/#/canvas')
    
    // Check build badge
    const badge = page.locator('[data-testid="build-badge"]')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('ROUTE=/canvas')
    await expect(badge).toContainText('MODE=RF')
  })

  test('renders React Flow graph', async ({ page }) => {
    await page.goto('/#/canvas')
    
    // Check root container
    await expect(page.locator('[data-testid="rf-root"]')).toBeVisible()
    
    // Check for React Flow UI elements
    await expect(page.locator('.react-flow')).toBeVisible()
    await expect(page.locator('.react-flow__controls')).toBeVisible()
    await expect(page.locator('.react-flow__minimap')).toBeVisible()
  })

  test('renders demo nodes', async ({ page }) => {
    await page.goto('/#/canvas')
    
    // Wait for graph to render
    await page.waitForTimeout(500)
    
    // Check for nodes (should have 4 demo nodes)
    const nodes = page.locator('[data-testid="rf-node"]')
    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThanOrEqual(4)
  })

  test('toolbar works', async ({ page }) => {
    await page.goto('/#/canvas')
    
    // Count initial nodes
    await page.waitForTimeout(500)
    const initialCount = await page.locator('[data-testid="rf-node"]').count()
    
    // Click "+ Node" button
    await page.click('button:has-text("+ Node")')
    await page.waitForTimeout(300)
    
    // Should have one more node
    const newCount = await page.locator('[data-testid="rf-node"]').count()
    expect(newCount).toBe(initialCount + 1)
  })

  test('reset button works', async ({ page }) => {
    await page.goto('/#/canvas')
    
    // Add a node
    await page.click('button:has-text("+ Node")')
    await page.waitForTimeout(300)
    
    // Click reset
    await page.click('button:has-text("Reset")')
    await page.waitForTimeout(300)
    
    // Should be back to 4 demo nodes
    const nodeCount = await page.locator('[data-testid="rf-node"]').count()
    expect(nodeCount).toBe(4)
  })

  test('drag node changes position', async ({ page }) => {
    await page.goto('/#/canvas')
    await page.waitForTimeout(500)
    
    // Get first node
    const firstNode = page.locator('[data-testid="rf-node"]').first()
    await expect(firstNode).toBeVisible()
    
    // Get initial position
    const initialBox = await firstNode.boundingBox()
    expect(initialBox).not.toBeNull()
    
    // Drag the node
    await firstNode.hover()
    await page.mouse.down()
    await page.mouse.move(initialBox!.x + 100, initialBox!.y + 100)
    await page.mouse.up()
    await page.waitForTimeout(300)
    
    // Position should have changed
    const newBox = await firstNode.boundingBox()
    expect(newBox).not.toBeNull()
    expect(newBox!.x).not.toBe(initialBox!.x)
  })
})
