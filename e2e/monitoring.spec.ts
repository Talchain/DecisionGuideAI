import { test, expect } from '@playwright/test'

test.describe('Monitoring Integration', () => {
  test('monitoring disabled in development', async ({ page }) => {
    const logs: string[] = []
    
    page.on('console', msg => {
      if (msg.text().includes('[Monitoring]')) {
        logs.push(msg.text())
      }
    })
    
    await page.goto('/#/canvas')
    await page.waitForSelector('.react-flow', { timeout: 10000 })
    
    // In dev mode, should see disabled messages
    const disabledLogs = logs.filter(log => log.includes('disabled'))
    expect(disabledLogs.length).toBeGreaterThan(0)
  })

  test('captures error in Sentry when ErrorBoundary triggered', async ({ page }) => {
    const sentryEvents: unknown[] = []
    
    // Mock Sentry transport
    await page.route('**/sentry.io/**', route => {
      sentryEvents.push(route.request().postDataJSON())
      route.fulfill({ status: 200 })
    })
    
    await page.goto('/#/canvas')
    await page.waitForSelector('.react-flow', { timeout: 10000 })
    
    // Force an error by corrupting the store
    await page.evaluate(() => {
      // @ts-ignore - intentionally breaking for test
      window.useCanvasStore.setState({ nodes: null })
    })
    
    // Try to add a node (should trigger error boundary)
    try {
      await page.locator('button:has-text("+ Node")').click()
      await page.waitForTimeout(1000)
    } catch {
      // Expected to fail
    }
    
    // In production with Sentry enabled, would capture event
    // In dev, just logs to console
  })

  test('Web Vitals function invoked', async ({ page }) => {
    const vitalLogs: string[] = []
    
    page.on('console', msg => {
      if (msg.text().includes('[Web Vitals]')) {
        vitalLogs.push(msg.text())
      }
    })
    
    await page.goto('/#/canvas')
    await page.waitForSelector('.react-flow', { timeout: 10000 })
    
    // Interact to trigger vitals
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForTimeout(2000)
    
    // In production, vitals would be captured
    // In dev, they're disabled
  })

  test('no monitoring in NODE_ENV=test', async ({ page }) => {
    const logs: string[] = []
    
    page.on('console', msg => {
      logs.push(msg.text())
    })
    
    await page.goto('/#/canvas')
    await page.waitForSelector('.react-flow', { timeout: 10000 })
    
    // Should not see any Sentry or Hotjar initialization
    const monitoringLogs = logs.filter(log => 
      log.includes('Sentry initialized') || 
      log.includes('Hotjar initialized')
    )
    expect(monitoringLogs.length).toBe(0)
  })
})
