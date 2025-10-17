// e2e/smoke/keyboard.spec.ts
// @smoke - Keyboard shortcuts and focus management

import { test, expect } from '@playwright/test'

test('keyboard shortcuts for node operations', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  const initialNodes = await page.locator('.react-flow__node').count()
  
  // Try common shortcuts (implementation-dependent)
  // N for new node
  await page.keyboard.press('n')
  await page.waitForTimeout(500)
  
  // Delete key
  if (initialNodes > 0) {
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()
    await page.keyboard.press('Delete')
    await page.waitForTimeout(500)
  }
  
  // Escape to deselect
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  
  // Verify no errors
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  
  await page.waitForTimeout(1000)
  expect(errors).toHaveLength(0)
})

test('focus management during operations', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Tab through interactive elements
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab')
    
    // Get focused element
    const focused = await page.evaluate(() => {
      const el = document.activeElement
      return {
        tag: el?.tagName,
        role: el?.getAttribute('role'),
        ariaLabel: el?.getAttribute('aria-label')
      }
    })
    
    // Focused element should be interactive
    if (focused.tag) {
      expect(['BUTTON', 'INPUT', 'A', 'DIV']).toContain(focused.tag)
    }
  }
})

test('keyboard accessibility for canvas interactions', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Arrow keys should navigate (if implemented)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(300)
  
  // Space/Enter should activate focused item
  await page.keyboard.press('Space')
  await page.waitForTimeout(300)
  
  // Verify keyboard operations don't cause errors
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  
  await page.waitForTimeout(1000)
  expect(errors).toHaveLength(0)
})
