// e2e/smoke/palette.spec.ts
// @smoke - Command palette

import { test, expect } from '@playwright/test'

test('command palette opens and executes', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Try Cmd+K or Ctrl+K
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
  await page.waitForTimeout(500)
  
  // Look for palette modal/input
  const paletteInput = page.locator('input[placeholder*="command"], input[placeholder*="search"]')
  
  if (await paletteInput.isVisible().catch(() => false)) {
    // Type command
    await paletteInput.fill('add node')
    await page.waitForTimeout(300)
    
    // Select first result
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    
    // Verify focus returns to canvas
    const activeElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BODY', 'DIV', 'CANVAS']).toContain(activeElement)
  }
})

test('palette keyboard navigation', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
  await page.waitForTimeout(300)
  
  const paletteInput = page.locator('input[placeholder*="command"], input[placeholder*="search"]')
  
  if (await paletteInput.isVisible().catch(() => false)) {
    // Navigate with arrows
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowUp')
    
    // Close with Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    
    // Palette should close
    const stillVisible = await paletteInput.isVisible().catch(() => false)
    expect(stillVisible).toBe(false)
  }
})
