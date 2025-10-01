import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'

// Canvas-first shell E2E (flag-gated)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('feature.canvasDefault')
      ;(window as any).__E2E = '1'
    } catch {}
  })
  await installFakeEventSource(page)
})

// Split layout renders and starter picker works then persists

test('Canvas-first split shell renders picker and remembers last choice', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('feature.canvasDefault', '1') } catch {} })
  await gotoSandbox(page)
  // In canvas-first shell we still mark panel-root for tests on the right pane
  await waitForPanel(page)

  // Picker visible initially
  const picker = page.getByTestId('template-picker')
  await expect(picker).toBeVisible()

  // Choose "Start from scratch"
  await page.getByTestId('template-card-scratch').click()
  await expect(picker).toHaveCount(0)
  await expect(page.getByTestId('starter-chip')).toHaveText(/Starter: scratch/i)

  // Reload and verify picker does not reappear; chip persists
  await page.reload()
  await page.addInitScript(() => { try { localStorage.setItem('feature.canvasDefault', '1') } catch {} })
  await gotoSandbox(page)
  await expect(page.getByTestId('template-picker')).toHaveCount(0)
  await expect(page.getByTestId('starter-chip')).toHaveText(/Starter: scratch/i)
})
