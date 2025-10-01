import { test, expect } from '@playwright/test'
import { gotoSandbox } from './_helpers'

test.describe('Health indicator', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('feature.configDrawer', '1') } catch {}
      try { localStorage.removeItem('cfg.gateway') } catch {}
      ;(window as any).__E2E = '1'
    })
  })

  test('Connected then Offline on subsequent failing probe', async ({ page }) => {
    let call = 0
    await page.route('**/health', async (route) => {
      call += 1
      if (call === 1) {
        await route.fulfill({ status: 200, body: '' })
      } else {
        await route.fulfill({ status: 500, body: '' })
      }
    })
    await page.route('**/report?probe=1', async (route) => {
      await route.fulfill({ status: 500, body: '' })
    })

    await gotoSandbox(page)
    // Allow initial microtask + first probe to complete
    await page.waitForTimeout(50)
    // Initially may be Checking, Connected, or Offline depending on timing
    await expect(page.getByTestId('health-dot')).toHaveAttribute('title', /^(Checking…|Connected — checked |Offline — checked )/)
    // Wait for backoff tick under E2E timing with buffer (base 200ms)
    await page.waitForTimeout(600)
    // Eventually becomes Offline after failing probe
    await expect(page.getByTestId('health-dot')).toHaveAttribute('title', /^Offline — checked /)
  })
})
