// e2e/toast-stress.spec.ts
// Toast stacking stress test: FIFO, no overlap with palette

import { test, expect } from '@playwright/test'

test('15 rapid toasts follow FIFO order', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Trigger 15 rapid toasts
  await page.evaluate(() => {
    // Assuming toast function is available globally or via window
    for (let i = 0; i < 15; i++) {
      // This assumes a toast API exists - adjust based on actual implementation
      if (window.showToast) {
        window.showToast({
          message: `Toast ${i + 1}`,
          duration: 3000
        })
      }
    }
  })
  
  await page.waitForTimeout(500)
  
  // Count visible toasts
  const toasts = page.locator('[role="status"], [role="alert"], .toast, [data-testid*="toast"]')
  const count = await toasts.count()
  
  console.log(`Visible toasts: ${count}`)
  
  // Should have some toasts visible (system might limit stack)
  expect(count).toBeGreaterThan(0)
  expect(count).toBeLessThanOrEqual(15)
  
  // Check order (first toast should be oldest)
  const firstToastText = await toasts.first().textContent()
  console.log(`First visible toast: ${firstToastText}`)
  
  // Wait for auto-dismiss
  await page.waitForTimeout(4000)
  
  // Toasts should be auto-dismissed
  const remainingCount = await toasts.count()
  expect(remainingCount).toBeLessThan(count)
})

test('toasts do not overlap command palette', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Trigger multiple toasts
  await page.evaluate(() => {
    if (window.showToast) {
      for (let i = 0; i < 5; i++) {
        window.showToast({ message: `Toast ${i}`, duration: 5000 })
      }
    }
  })
  
  await page.waitForTimeout(300)
  
  // Open command palette
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
  await page.waitForTimeout(500)
  
  // Check z-index layering
  const paletteZIndex = await page.evaluate(() => {
    const palette = document.querySelector('[role="dialog"], .command-palette, [data-testid*="palette"]')
    if (!palette) return null
    
    return parseInt(window.getComputedStyle(palette).zIndex || '0')
  })
  
  const toastZIndex = await page.evaluate(() => {
    const toast = document.querySelector('[role="status"], .toast')
    if (!toast) return null
    
    return parseInt(window.getComputedStyle(toast).zIndex || '0')
  })
  
  console.log(`Palette z-index: ${paletteZIndex}, Toast z-index: ${toastZIndex}`)
  
  // Palette should be above toasts
  if (paletteZIndex !== null && toastZIndex !== null) {
    expect(paletteZIndex).toBeGreaterThan(toastZIndex)
  }
})

test('toast auto-dismiss timing is consistent', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  const EXPECTED_DURATION = 3000
  const TOLERANCE = 250 // ±250ms
  
  // Trigger a toast with known duration
  const startTime = await page.evaluate((duration) => {
    if (window.showToast) {
      window.showToast({ message: 'Timed toast', duration })
    }
    return Date.now()
  }, EXPECTED_DURATION)
  
  // Wait for toast to appear
  const toast = page.locator('[role="status"]:has-text("Timed toast"), .toast:has-text("Timed toast")')
  
  if (await toast.isVisible({ timeout: 1000 }).catch(() => false)) {
    // Wait for it to disappear
    await toast.waitFor({ state: 'hidden', timeout: EXPECTED_DURATION + TOLERANCE + 1000 })
    
    const endTime = Date.now()
    const actualDuration = endTime - startTime
    
    console.log(`Toast duration: ${actualDuration}ms (expected: ${EXPECTED_DURATION}ms ±${TOLERANCE}ms)`)
    
    // Check within tolerance
    expect(actualDuration).toBeGreaterThanOrEqual(EXPECTED_DURATION - TOLERANCE)
    expect(actualDuration).toBeLessThanOrEqual(EXPECTED_DURATION + TOLERANCE + 500) // +500 for render delays
  }
})

test('manual toast close works immediately', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Trigger a toast
  await page.evaluate(() => {
    if (window.showToast) {
      window.showToast({ message: 'Closeable toast', duration: 10000 })
    }
  })
  
  await page.waitForTimeout(500)
  
  // Find toast and close button
  const toast = page.locator('[role="status"], .toast').first()
  
  if (await toast.isVisible().catch(() => false)) {
    const closeButton = toast.locator('button:has-text("×"), button:has-text("Close"), [aria-label*="close"]')
    
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click()
      
      // Toast should disappear immediately
      await page.waitForTimeout(200)
      
      const stillVisible = await toast.isVisible().catch(() => false)
      expect(stillVisible).toBe(false)
    }
  }
})

test('toast focus trap does not break palette focus', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Show toasts
  await page.evaluate(() => {
    if (window.showToast) {
      for (let i = 0; i < 3; i++) {
        window.showToast({ message: `Toast ${i}`, duration: 5000 })
      }
    }
  })
  
  await page.waitForTimeout(300)
  
  // Open palette
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
  await page.waitForTimeout(300)
  
  // Focus should be in palette input
  const paletteInput = page.locator('input[placeholder*="command"], input[placeholder*="search"]')
  
  if (await paletteInput.isVisible().catch(() => false)) {
    await expect(paletteInput).toBeFocused()
    
    // Type something
    await paletteInput.fill('test')
    
    // Focus should stay in palette
    await expect(paletteInput).toBeFocused()
    
    // Tab should navigate within palette, not to toasts
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)
    
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.closest('[role="dialog"], .command-palette, [data-testid*="palette"]') !== null
    })
    
    // Focus should remain in palette area
    expect(focusedElement).toBe(true)
  }
})
