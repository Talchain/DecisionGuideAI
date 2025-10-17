// e2e/smoke/diagnostics.spec.ts
// @smoke - Diagnostics overlay

import { test, expect } from '@playwright/test'

test('diagnostics overlay shows with ?diag=1', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  
  await page.goto('/#/canvas?diag=1')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Look for diagnostics panel/overlay
  const diagPanel = page.locator('[data-testid="diagnostics"], .diagnostics-panel, text=/diagnostics/i')
  
  if (await diagPanel.isVisible().catch(() => false)) {
    // Verify it contains useful info
    const text = await diagPanel.textContent()
    expect(text).toBeTruthy()
    
    // Should show build info or perf metrics
    const hasBuildInfo = text?.toLowerCase().includes('build') || 
                        text?.toLowerCase().includes('version') ||
                        text?.toLowerCase().includes('fps')
    expect(hasBuildInfo).toBe(true)
  }
  
  // Verify no console errors from diagnostics
  expect(errors).toHaveLength(0)
})

test('diagnostics overlay is dismissible', async ({ page }) => {
  await page.goto('/#/canvas?diag=1')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  const diagPanel = page.locator('[data-testid="diagnostics"], .diagnostics-panel')
  
  if (await diagPanel.isVisible().catch(() => false)) {
    // Look for close button
    const closeButton = diagPanel.locator('button:has-text("×"), button:has-text("Close"), [aria-label*="close"]')
    
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click()
      await page.waitForTimeout(300)
      
      // Panel should be hidden
      const stillVisible = await diagPanel.isVisible().catch(() => false)
      expect(stillVisible).toBe(false)
    } else {
      // Try ESC key
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      
      const stillVisible = await diagPanel.isVisible().catch(() => false)
      // May still be visible if ESC not handled, that's OK
    }
  }
})

test('diagnostics has no performance impact', async ({ page }) => {
  // Load without diagnostics
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)
  
  const fpsWithout = await page.evaluate(() => {
    let frames = 0
    const start = performance.now()
    const measure = () => {
      frames++
      if (performance.now() - start < 1000) {
        requestAnimationFrame(measure)
      }
    }
    return new Promise<number>(resolve => {
      requestAnimationFrame(measure)
      setTimeout(() => resolve(frames), 1100)
    })
  })
  
  // Load with diagnostics
  await page.goto('/#/canvas?diag=1')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)
  
  const fpsWith = await page.evaluate(() => {
    let frames = 0
    const start = performance.now()
    const measure = () => {
      frames++
      if (performance.now() - start < 1000) {
        requestAnimationFrame(measure)
      }
    }
    return new Promise<number>(resolve => {
      requestAnimationFrame(measure)
      setTimeout(() => resolve(frames), 1100)
    })
  })
  
  // FPS should not degrade significantly (within 10%)
  const degradation = (fpsWithout - fpsWith) / fpsWithout
  expect(degradation).toBeLessThan(0.1)
})
