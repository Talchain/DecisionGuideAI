import { test, expect } from '@playwright/test'
import { installFakeEventSource, gotoSandbox, waitForPanel } from './_helpers'

// Scenarios save/load E2E (Chromium)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('feature.scenarios')
      localStorage.removeItem('feature.params')
      localStorage.removeItem('sandbox.seed')
      localStorage.removeItem('sandbox.budget')
      localStorage.removeItem('sandbox.model')
      ;(window as any).__E2E = '1'
    } catch {}
  })
  await installFakeEventSource(page)
})

test('Save template and load; chip + inputs reflect loaded values; Esc focus restore', async ({ page }) => {
  // Ensure flags are set before first navigation so UI renders
  await page.addInitScript(() => { try { localStorage.setItem('feature.scenarios', '1'); localStorage.setItem('feature.params', '1') } catch {} })
  await gotoSandbox(page)
  await waitForPanel(page)

  // Enable feature
  await page.addInitScript(() => { try { localStorage.setItem('feature.scenarios', '1'); localStorage.setItem('feature.params', '1') } catch {} })

  // Set params
  await page.getByTestId('param-seed').fill('1234')
  await page.getByTestId('param-budget').fill('1.0')
  await page.getByTestId('param-model').selectOption('gpt-4o-mini')

  // Open drawer
  const btn = page.getByTestId('scenarios-btn')
  await expect(btn).toBeVisible()
  await btn.focus()
  await btn.click()
  await expect(page.getByTestId('scenarios-drawer')).toBeVisible()

  // Save "Demo"
  await page.getByTestId('scenario-name').fill('Demo')
  await page.getByTestId('scenario-save-btn').click()
  await expect(page.getByTestId('scenarios-toast')).toBeVisible()

  // Reload page, open drawer, load
  await page.reload()
  await page.addInitScript(() => { try { localStorage.setItem('feature.scenarios', '1'); localStorage.setItem('feature.params', '1') } catch {} })
  await gotoSandbox(page)
  await page.getByTestId('scenarios-btn').click()
  await expect(page.getByTestId('scenarios-drawer')).toBeVisible()
  const loadBtn = page.getByTestId('scenario-load-btn').first()
  await loadBtn.click()

  // Chip visible and inputs reflect values
  await expect(page.getByTestId('scenario-chip')).toBeVisible()
  await expect(page.getByTestId('param-seed')).toHaveValue('1234')
  await expect(page.getByTestId('param-budget')).toHaveValue('1.0')
  await expect(page.getByTestId('param-model')).toHaveValue('gpt-4o-mini')

  // Close via Esc and ensure focus returns to the scenarios button
  await page.keyboard.press('Escape')
  await page.waitForTimeout(20)
  await expect(btn).toBeFocused()
})
