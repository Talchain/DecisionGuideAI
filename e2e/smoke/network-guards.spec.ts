// e2e/smoke/network-guards.spec.ts
// @smoke - Verify monitoring guards in non-prod

import { test, expect } from '@playwright/test'

test('no Sentry requests in dev mode', async ({ page }) => {
  const sentryRequests: string[] = []
  
  page.on('request', req => {
    if (req.url().includes('sentry.io')) {
      sentryRequests.push(req.url())
    }
  })
  
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)
  
  // In dev/test, should have zero Sentry requests
  expect(sentryRequests).toHaveLength(0)
})

test('no Hotjar requests in dev mode', async ({ page }) => {
  const hotjarRequests: string[] = []
  
  page.on('request', req => {
    if (req.url().includes('hotjar')) {
      hotjarRequests.push(req.url())
    }
  })
  
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(2000)
  
  expect(hotjarRequests).toHaveLength(0)
})
