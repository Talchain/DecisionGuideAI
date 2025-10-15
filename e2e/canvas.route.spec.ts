import { test, expect } from '@playwright/test'

test.describe('Canvas Route', () => {
  test('canvas route renders React Flow and badge', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(String(e)))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

    await page.goto('/#/canvas')
    
    // Badge should be visible with correct text
    const badge = page.locator('[data-testid="build-badge"]')
    await expect(badge).toBeVisible({ timeout: 10000 })
    await expect(badge).toContainText('ROUTE=/canvas')
    await expect(badge).toContainText('MODE=RF')
    
    // React Flow root should exist
    const rfRoot = page.locator('[data-testid="rf-root"]')
    await expect(rfRoot).toBeVisible()
    
    // React Flow graph should render
    await expect(page.locator('.react-flow')).toBeVisible()
    
    // Wait for any late errors
    await page.waitForTimeout(500)
    
    // Should have no console errors
    expect(errors).toEqual([])
  })

  test('home page has link to canvas', async ({ page }) => {
    await page.goto('/')
    
    // Find canvas link (allow both formats)
    const link = page.locator('a[href="#/canvas"], a[href="/#/canvas"]')
    await expect(link.first()).toBeVisible()
  })
})
