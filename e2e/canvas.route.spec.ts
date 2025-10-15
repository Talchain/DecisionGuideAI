import { test, expect } from '@playwright/test'

test.describe('Canvas Route', () => {
  test('canvas route loads with badge and graph', async ({ page }) => {
    // Track console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    // Navigate to canvas
    await page.goto('/#/canvas')
    
    // Expect badge with correct text
    const badge = page.locator('[data-testid="build-badge"]')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('ROUTE=/canvas')
    
    // Expect React Flow root to be visible
    const rfRoot = page.locator('[data-testid="rf-root"]')
    await expect(rfRoot).toBeVisible()
    
    // Expect React Flow graph to render
    await expect(page.locator('.react-flow')).toBeVisible()
    
    // Wait a moment for any late errors
    await page.waitForTimeout(500)
    
    // Assert no console errors
    expect(errors).toHaveLength(0)
  })

  test('home screen has canvas link', async ({ page }) => {
    await page.goto('/')
    
    // Find the canvas link
    const canvasLink = page.locator('a:has-text("Open Canvas")')
    await expect(canvasLink).toBeVisible()
    await expect(canvasLink).toHaveAttribute('href', '/#/canvas')
  })
})
