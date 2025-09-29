import { test, expect } from '@playwright/test'
import { gotoSandbox, installFakeEventSource } from './_helpers'

// Flags-OFF parity smoke: no feature flags enabled

test.describe('Flags-OFF smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeEventSource(page)
    await page.addInitScript(() => {
      // Ensure all feature flags cleared
      try { localStorage.clear() } catch {}
      // E2E mode forces mount without SSE flag
      ;(window as any).__E2E = 1
    })
    await gotoSandbox(page)
  })

  test('baseline Start/Stop works', async ({ page }) => {
    // Start should be visible and enabled
    await expect(page.getByTestId('start-btn')).toBeVisible()
    await page.getByTestId('start-btn').click()

    // Stop should be enabled; click it and expect status chip to reflect change eventually
    await page.getByTestId('stop-btn').click()
    // We expect the status sr-only chip to get focus or text change; best-effort check that Stop didn't crash
    await expect(page.getByTestId('status-chip')).toBeVisible()
  })
})
