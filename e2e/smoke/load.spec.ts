// e2e/smoke/load.spec.ts
// @smoke - App loads with zero console errors

import { test, expect } from '@playwright/test'

test('canvas loads without errors', async ({ page }) => {
  const errors: string[] = []
  
  // Track console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  
  // Navigate to canvas
  await page.goto('/#/canvas')
  
  // Wait for ReactFlow root to appear
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Verify no console errors
  expect(errors).toHaveLength(0)
  
  // Verify basic UI elements
  await expect(page.locator('button:has-text("+ Node")')).toBeVisible()
})
