import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'

test.describe('Canvas focus behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('feature.canvas', '1') } catch {}
      ;(window as any).__E2E = '1'
    })
    await installFakeEventSource(page)
  })

  test('Esc closes drawer and returns focus to canvas-btn', async ({ page }) => {
    await gotoSandbox(page)
    await waitForPanel(page)

    const btn = page.getByTestId('canvas-btn')
    await btn.focus()
    await btn.click()
    await expect(page.getByTestId('canvas-drawer')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('canvas-drawer')).not.toBeVisible()
    // Allow focus restoration
    await page.waitForTimeout(20)
    await expect(btn).toBeFocused()
  })
})
