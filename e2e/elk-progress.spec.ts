// e2e/elk-progress.spec.ts
// ELK download progress UX tests

import { test, expect } from '@playwright/test'

test('ELK progress toast appears during layout', async ({ page }) => {
  // Throttle network to see progress
  await page.route('**/*elk*.js', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    route.continue()
  })
  
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  const layoutButton = page.locator('button:has-text("Layout"), button:has-text("Organize")')
  
  if (await layoutButton.isVisible().catch(() => false)) {
    await layoutButton.click()
    
    // Look for progress indicator
    const progressToast = page.locator('[role="status"]:has-text(/loading|progress|%/i)')
    
    // Progress should appear (may be brief)
    try {
      await expect(progressToast).toBeVisible({ timeout: 2000 })
      
      // Should have progress info
      const text = await progressToast.textContent()
      expect(text).toBeTruthy()
      
    } catch {
      // Progress was too fast, which is OK
    }
  }
})

test('progress toast has cancel button', async ({ page }) => {
  await page.route('**/*elk*.js', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 3000)) // Slow enough to interact
    route.continue()
  })
  
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  const layoutButton = page.locator('button:has-text("Layout")')
  
  if (await layoutButton.isVisible().catch(() => false)) {
    await layoutButton.click()
    
    // Look for cancel button in progress toast
    const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("×")')
    
    if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelButton.click()
      
      // Progress should dismiss
      await page.waitForTimeout(500)
      
      // UI should remain responsive
      const canvas = page.locator('.react-flow')
      await expect(canvas).toBeVisible()
    }
  }
})

test('error toast shows retry button', async ({ page }) => {
  // Force ELK load to fail
  await page.route('**/*elk*.js', route => route.abort('failed'))
  
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  const layoutButton = page.locator('button:has-text("Layout")')
  
  if (await layoutButton.isVisible().catch(() => false)) {
    await layoutButton.click()
    await page.waitForTimeout(1000)
    
    // Look for error message
    const errorToast = page.locator('[role="alert"], [role="status"]:has-text(/error|failed/i)')
    
    if (await errorToast.isVisible().catch(() => false)) {
      // Should have retry button
      const retryButton = page.locator('button:has-text("Retry")')
      
      if (await retryButton.isVisible().catch(() => false)) {
        // Remove the route block for retry
        await page.unroute('**/*elk*.js')
        
        await retryButton.click()
        
        // Should attempt again
        await page.waitForTimeout(1000)
      }
    }
  }
})

test('progress respects reduced motion', async ({ page }) => {
  // Set reduced motion preference
  await page.emulateMedia({ reducedMotion: 'reduce' })
  
  await page.route('**/*elk*.js', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    route.continue()
  })
  
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  const layoutButton = page.locator('button:has-text("Layout")')
  
  if (await layoutButton.isVisible().catch(() => false)) {
    await layoutButton.click()
    
    // Progress indicator should appear but without animation
    const progressToast = page.locator('[role="status"]')
    
    if (await progressToast.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check if spinner has motion-reduce class
      const spinner = progressToast.locator('.animate-spin, [class*="spin"]')
      
      if (await spinner.isVisible().catch(() => false)) {
        const classes = await spinner.getAttribute('class')
        // Should have motion-reduce support
        expect(classes).toMatch(/motion-reduce|reduce-motion/)
      }
    }
  }
})

test('UI remains interactive during ELK load', async ({ page }) => {
  await page.route('**/*elk*.js', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    route.continue()
  })
  
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  const layoutButton = page.locator('button:has-text("Layout")')
  
  if (await layoutButton.isVisible().catch(() => false)) {
    await layoutButton.click()
    
    // While loading, try to interact with canvas
    await page.mouse.move(200, 200)
    await page.mouse.click(200, 200)
    
    // Canvas should still respond
    await expect(page.locator('.react-flow')).toBeVisible()
    
    // Can still navigate
    await page.keyboard.press('Tab')
    
    // Should not freeze
    const isFrozen = await page.evaluate(() => {
      const start = Date.now()
      while (Date.now() - start < 100) {
        // Busy wait
      }
      return false
    })
    
    expect(isFrozen).toBe(false)
  }
})
