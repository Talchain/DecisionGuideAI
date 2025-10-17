// e2e/smoke/chunk-failure.spec.ts
// @smoke - Test ErrorBoundary catches chunk load failures

import { test, expect } from '@playwright/test'

test('chunk failure shows error boundary with recovery', async ({ page }) => {
  // Intercept and fail one chunk request to simulate CDN failure
  await page.route('**/assets/canvas-*.js', route => {
    route.abort('failed')
  })
  
  // Navigate to canvas
  await page.goto('/#/canvas')
  
  // Should show error boundary UI (not a blank page)
  await expect(page.locator('text=/error|something went wrong|failed to load/i')).toBeVisible({ timeout: 5000 })
  
  // Verify Sentry was called (check for console log from captureError)
  const logs: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      logs.push(msg.text())
    }
  })
  
  // Error should be captured
  await page.waitForTimeout(1000)
  expect(logs.length).toBeGreaterThan(0)
})

test('retry after chunk failure recovers', async ({ page, context }) => {
  let failCount = 0
  
  // Fail first attempt, succeed on retry
  await page.route('**/assets/canvas-*.js', (route) => {
    if (failCount === 0) {
      failCount++
      route.abort('failed')
    } else {
      route.continue()
    }
  })
  
  await page.goto('/#/canvas')
  
  // Error boundary appears
  await expect(page.locator('text=/error|failed/i')).toBeVisible({ timeout: 5000 })
  
  // Reload to retry (simulates retry button behavior)
  await page.reload()
  
  // Should succeed on second attempt
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
})
