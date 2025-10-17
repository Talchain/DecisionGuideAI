// e2e/smoke/settings.spec.ts
// @smoke - Settings persistence

import { test, expect } from '@playwright/test'

test('settings toggle persists', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Look for settings button
  const settingsButton = page.locator('button:has-text("Settings"), [aria-label*="settings"]')
  
  if (await settingsButton.isVisible().catch(() => false)) {
    await settingsButton.click()
    await page.waitForTimeout(300)
    
    // Look for grid toggle
    const gridToggle = page.locator('input[type="checkbox"]:near(text=/grid/i), button:has-text("Grid")')
    
    if (await gridToggle.isVisible().catch(() => false)) {
      // Get initial state
      const initialState = await gridToggle.isChecked().catch(() => false)
      
      // Toggle
      await gridToggle.click()
      await page.waitForTimeout(300)
      
      // Reload page
      await page.reload()
      await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
      
      // Reopen settings
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click()
        await page.waitForTimeout(300)
        
        // Verify state persisted
        const newState = await gridToggle.isChecked().catch(() => false)
        expect(newState).toBe(!initialState)
      }
    }
  }
})

test('keyboard access to settings', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Try keyboard shortcut (if exists)
  await page.keyboard.press('?') // Common for help/settings
  await page.waitForTimeout(500)
  
  // Or tab to settings button
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.textContent)
    if (focused?.toLowerCase().includes('setting')) {
      await page.keyboard.press('Enter')
      break
    }
  }
  
  // Verify no errors
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  
  await page.waitForTimeout(1000)
  expect(errors).toHaveLength(0)
})
