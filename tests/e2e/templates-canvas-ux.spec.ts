import { test, expect } from '@playwright/test'

test.describe('Templates on Canvas UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await page.waitForLoadState('networkidle')
  })

  test('shows welcome overlay on empty canvas', async ({ page }) => {
    // Check for welcome overlay
    const welcomeTitle = page.getByText('Welcome to Canvas')
    await expect(welcomeTitle).toBeVisible()
    
    // Check for close button
    const closeButton = page.getByRole('button', { name: /close welcome overlay/i })
    await expect(closeButton).toBeVisible()
  })

  test('can dismiss welcome overlay with X button', async ({ page }) => {
    const closeButton = page.getByRole('button', { name: /close welcome overlay/i })
    await closeButton.click()
    
    // Welcome overlay should be gone
    await expect(page.getByText('Welcome to Canvas')).not.toBeVisible()
  })

  test('can dismiss welcome overlay with Escape key', async ({ page }) => {
    await page.keyboard.press('Escape')
    
    // Welcome overlay should be gone
    await expect(page.getByText('Welcome to Canvas')).not.toBeVisible()
  })

  test('has exactly one bottom navigation', async ({ page }) => {
    const navElements = page.locator('nav[role="navigation"]')
    await expect(navElements).toHaveCount(1)
  })

  test('keyboard navigation works', async ({ page }) => {
    // Test Tab navigation
    await page.keyboard.press('Tab')
    
    // Should focus on first interactive element
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'INPUT', 'A']).toContain(focused)
  })

  test('has proper ARIA labels', async ({ page }) => {
    // Check for accessible navigation
    const nav = page.locator('nav[role="navigation"]')
    await expect(nav).toBeVisible()
  })
})
