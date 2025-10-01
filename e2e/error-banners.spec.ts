import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'

// E2E: Error banners show mapped copy when flag ON and status=error

test('Error banner shows mapped copy and badge when error occurs', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.errorBanners', '1')
      ;(window as any).__E2E = '1'
      // Pre-set an error type the UI reads from localStorage when error state is reached
      localStorage.setItem('sandbox.errorType', 'RATE_LIMIT')
    } catch {}
  })
  await installFakeEventSource(page)
  await gotoSandbox(page)
  await waitForPanel(page)

  // Start, cause a retry, then a terminal error
  await page.getByTestId('start-btn').click()
  await page.evaluate(() => {
    const es1 = (window as any).FakeEventSource.instances[0]
    es1.emit('error')
  })
  // wait until a second EventSource is created by the client reconnect
  await page.waitForFunction(() => (window as any).FakeEventSource.instances.length === 2)
  await page.evaluate(() => {
    const es2 = (window as any).FakeEventSource.instances[1]
    es2.emit('error')
  })

  // Banner appears with badge and mapped copy after terminal error
  await expect(page.getByTestId('error-banner')).toBeVisible()
  await expect(page.getByTestId('error-type-badge')).toContainText('RATE_LIMIT')
  await expect(page.getByTestId('error-banner')).toContainText('Please wait and retry')
})
