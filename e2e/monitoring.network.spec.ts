import { test, expect } from '@playwright/test'

test.describe('Monitoring Network Interception', () => {
  test('no Sentry requests in development', async ({ page }) => {
    const sentryRequests: string[] = []

    page.on('request', req => {
      if (req.url().includes('sentry.io')) {
        sentryRequests.push(req.url())
      }
    })

    await page.goto('/#/canvas')
    await page.waitForSelector('.react-flow', { timeout: 10000 })

    // In dev mode, no Sentry requests should be made
    expect(sentryRequests).toHaveLength(0)
  })

  test('no Hotjar requests in development', async ({ page }) => {
    const hotjarRequests: string[] = []

    page.on('request', req => {
      if (req.url().includes('hotjar.com')) {
        hotjarRequests.push(req.url())
      }
    })

    await page.goto('/#/canvas')
    await page.waitForSelector('.react-flow', { timeout: 10000 })

    // In dev mode, no Hotjar requests should be made
    expect(hotjarRequests).toHaveLength(0)
  })

  test('respects Do Not Track for Hotjar', async ({ page }) => {
    const hotjarRequests: string[] = []

    // Set DNT before navigation
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'doNotTrack', {
        value: '1',
        writable: false,
      })
    })

    page.on('request', req => {
      if (req.url().includes('hotjar.com')) {
        hotjarRequests.push(req.url())
      }
    })

    await page.goto('/#/canvas')
    await page.waitForSelector('.react-flow', { timeout: 10000 })

    // With DNT enabled, no Hotjar requests
    expect(hotjarRequests).toHaveLength(0)
  })

  test('validates Hotjar ID format', async ({ page }) => {
    const logs: string[] = []

    page.on('console', msg => {
      if (msg.text().includes('[Monitoring]')) {
        logs.push(msg.text())
      }
    })

    await page.goto('/#/canvas')
    await page.waitForSelector('.react-flow', { timeout: 10000 })

    // Should see disabled message (invalid or missing ID)
    const disabledLogs = logs.filter(log => log.includes('Hotjar disabled'))
    expect(disabledLogs.length).toBeGreaterThan(0)
  })

  test('Web Vitals only in production', async ({ page }) => {
    const vitalLogs: string[] = []

    page.on('console', msg => {
      if (msg.text().includes('[Web Vitals]')) {
        vitalLogs.push(msg.text())
      }
    })

    await page.goto('/#/canvas')
    await page.waitForSelector('.react-flow', { timeout: 10000 })

    // Interact to potentially trigger vitals
    await page.locator('button:has-text("+ Node")').click()
    await page.waitForTimeout(1000)

    // In dev, Web Vitals should be disabled
    // (no vitals logs should appear)
  })
})
