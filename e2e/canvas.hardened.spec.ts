import { test, expect } from '@playwright/test'

test.describe('Canvas Hardened', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('[data-testid="build-badge"]')).toBeVisible()
  })

  test('renders with badge and graph', async ({ page }) => {
    const badge = page.locator('[data-testid="build-badge"]')
    await expect(badge).toContainText('ROUTE=/canvas')
    await expect(page.locator('.react-flow')).toBeVisible()
    const nodes = page.locator('[data-testid="rf-node"]')
    await expect(nodes).toHaveCount(4)
  })

  test('add node creates new node', async ({ page }) => {
    const addBtn = page.locator('button:has-text("+ Node")')
    await addBtn.click()
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(5)
  })

  test('delete selected node works', async ({ page }) => {
    const firstNode = page.locator('[data-testid="rf-node"]').first()
    await firstNode.click()
    await page.keyboard.press('Delete')
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(3)
  })

  test('undo/redo works', async ({ page }) => {
    await page.locator('button:has-text("+ Node")').click()
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(5)
    
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(4)
    
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z')
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(5)
  })

  test('redo with Ctrl+Y works', async ({ page }) => {
    await page.locator('button:has-text("+ Node")').click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+y' : 'Control+y')
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(5)
  })

  test('reset restores demo graph', async ({ page }) => {
    await page.locator('button:has-text("+ Node")').click()
    await page.locator('button:has-text("Reset")').click()
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(4)
  })

  test('drag node changes position', async ({ page }) => {
    const node = page.locator('[data-testid="rf-node"]').first()
    const box1 = await node.boundingBox()
    expect(box1).not.toBeNull()
    
    await node.hover()
    await page.mouse.down()
    await page.mouse.move(box1!.x + 100, box1!.y + 100)
    await page.mouse.up()
    
    const box2 = await node.boundingBox()
    expect(box2!.x).toBeGreaterThan(box1!.x + 50)
  })

  test('persistence round-trip', async ({ page, context }) => {
    await page.locator('button:has-text("+ Node")').click()
    await expect(page.locator('[data-testid="rf-node"]')).toHaveCount(5)
    
    const newPage = await context.newPage()
    await newPage.goto('/#/canvas')
    await expect(newPage.locator('[data-testid="rf-node"]')).toHaveCount(5)
    await newPage.close()
  })
})
