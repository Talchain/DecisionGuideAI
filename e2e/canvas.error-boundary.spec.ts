import { test, expect } from '@playwright/test'

test.describe('Canvas Error Boundary', () => {
  test('shows error boundary on crash', async ({ page }) => {
    await page.goto('/canvas')
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 10000 })
    
    // Force an error by corrupting localStorage
    await page.evaluate(() => {
      localStorage.setItem('canvas-state-v1', 'invalid json that will crash')
    })
    
    // Reload to trigger error
    await page.reload()
    
    // Error boundary should be visible
    await expect(page.locator('text=Something went wrong')).toBeVisible()
    await expect(page.locator('text=The canvas encountered an unexpected error')).toBeVisible()
    
    // Should show recovery options
    await expect(page.locator('button:has-text("Reload Editor")')).toBeVisible()
    await expect(page.locator('button:has-text("Copy Current State JSON")')).toBeVisible()
    await expect(page.locator('button:has-text("Report Issue")')).toBeVisible()
  })

  test('reload button works', async ({ page }) => {
    await page.goto('/canvas')
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 10000 })
    
    // Corrupt state
    await page.evaluate(() => {
      localStorage.setItem('canvas-state-v1', 'invalid')
    })
    
    await page.reload()
    
    // Wait for error boundary
    await expect(page.locator('text=Something went wrong')).toBeVisible()
    
    // Fix the state before reloading
    await page.evaluate(() => {
      localStorage.removeItem('canvas-state-v1')
    })
    
    // Click reload
    await page.locator('button:has-text("Reload Editor")').click()
    
    // Should reload and show canvas
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 10000 })
    await expect(page.locator('text=Something went wrong')).not.toBeVisible()
  })

  test('copy state button works', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-write', 'clipboard-read'])
    
    await page.goto('/canvas')
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 10000 })
    
    // Set valid state
    await page.evaluate(() => {
      localStorage.setItem('canvas-state-v1', JSON.stringify({ test: 'data' }))
    })
    
    // Corrupt to trigger error
    await page.evaluate(() => {
      localStorage.setItem('canvas-state-v1', 'invalid')
    })
    
    await page.reload()
    await expect(page.locator('text=Something went wrong')).toBeVisible()
    
    // Restore valid state for copy
    await page.evaluate(() => {
      localStorage.setItem('canvas-state-v1', JSON.stringify({ test: 'data' }))
    })
    
    // Click copy
    await page.locator('button:has-text("Copy Current State JSON")').click()
    
    // Should show success message
    await expect(page.locator('text=Canvas state copied to clipboard!')).toBeVisible()
    
    // Verify clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain('test')
  })

  test('report issue opens mailto link', async ({ page }) => {
    await page.goto('/canvas')
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 10000 })
    
    // Corrupt state
    await page.evaluate(() => {
      localStorage.setItem('canvas-state-v1', 'invalid')
    })
    
    await page.reload()
    await expect(page.locator('text=Something went wrong')).toBeVisible()
    
    // Listen for popup
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.locator('button:has-text("Report Issue")').click()
    ])
    
    // Should open mailto link
    expect(popup.url()).toContain('mailto:')
    expect(popup.url()).toContain('Canvas%20Error%20Report')
  })

  test('error boundary shows error message', async ({ page }) => {
    await page.goto('/canvas')
    await page.waitForSelector('[data-testid="rf-root"]', { timeout: 10000 })
    
    // Corrupt state
    await page.evaluate(() => {
      localStorage.setItem('canvas-state-v1', 'invalid json')
    })
    
    await page.reload()
    
    // Should show error details
    await expect(page.locator('text=Something went wrong')).toBeVisible()
    
    // Error message should be visible (may vary by browser)
    const errorBox = page.locator('.bg-gray-50.rounded-lg')
    await expect(errorBox).toBeVisible()
  })
})
