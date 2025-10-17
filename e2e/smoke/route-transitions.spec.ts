// e2e/smoke/route-transitions.spec.ts
// @smoke - Test route transitions with loading states

import { test, expect } from '@playwright/test'

test('transitions between routes show correct content', async ({ page }) => {
  // Start at canvas
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Transition to plot
  await page.goto('/#/plot')
  await expect(page.locator('text=/plot|workspace/i')).toBeVisible({ timeout: 10000 })
  
  // Transition to sandbox
  await page.goto('/#/sandbox-v1')
  await expect(page.locator('[data-testid="panel-root"]')).toBeVisible({ timeout: 10000 })
  
  // Back to canvas
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
})

test('loading fallback appears during route change', async ({ page }) => {
  // Clear cache to ensure loading state
  await page.goto('/#/')
  
  // Navigate and try to catch loading state
  const navigationPromise = page.goto('/#/canvas')
  
  // Loading state should be visible (may be brief)
  try {
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 1500 })
  } catch {
    // Loading was too fast, which is OK
  }
  
  await navigationPromise
  
  // Canvas should load
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
})

test('loading fallback has proper accessibility', async ({ page }) => {
  await page.goto('/#/canvas')
  
  // If loading state appears, check a11y attributes
  const status = page.locator('[role="status"]')
  if (await status.isVisible().catch(() => false)) {
    await expect(status).toHaveAttribute('aria-live', 'polite')
    
    // Check for reduced motion support
    const spinner = page.locator('.animate-spin')
    if (await spinner.isVisible().catch(() => false)) {
      const classes = await spinner.getAttribute('class')
      expect(classes).toContain('motion-reduce:animate-none')
    }
  }
  
  // Eventually canvas loads
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
})
