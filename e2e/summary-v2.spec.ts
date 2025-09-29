import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'

// E2E: Summary v2 cards + chips + totals

test('Summary v2 cards render with chips and totals when flag ON', async ({ page }) => {
  // Capture page console logs for debugging and artefacts
  page.on('console', (msg) => {
    console.log(`[page:${msg.type()}]`, msg.text())
  })
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.summaryV2', '1')
      localStorage.setItem('feature.params', '1')
      localStorage.setItem('feature.streamBuffer', '0')
      ;(window as any).__E2E = '1'
      // Default params for chips
      localStorage.setItem('sandbox.seed', '99')
      localStorage.setItem('sandbox.model', 'local-sim')
    } catch {}
  })
  await installFakeEventSource(page)
  await gotoSandbox(page)
  await waitForPanel(page)
  // Ensure the panel-root is visible (precondition)
  await page.getByTestId('panel-root').waitFor({ state: 'visible' })
  // Dump diagnostics BEFORE first selector wait
  await page.evaluate(() => {
    const ls = {
      summaryV2: localStorage.getItem('feature.summaryV2'),
      canvasDefault: localStorage.getItem('feature.canvasDefault'),
    } as const
    const cardCount = document.querySelectorAll('[data-testid^="summary-card-"]').length
    console.log('LS_DUMP', JSON.stringify(ls))
    console.log('CARD_COUNT', cardCount)
  })
  // Prove the flag is ON (set via addInitScript)
  await expect
    .poll(async () => await page.evaluate(() => localStorage.getItem('feature.summaryV2')))
    .toBe('1')
  // Expanded existence guard: ensure at least one summary card exists
  await expect
    .poll(async () => await page.evaluate(() => document.querySelectorAll('[data-testid^="summary-card-"]').length), { timeout: 3000 })
    .toBeGreaterThan(0)
  // Guard: wait for any Summary v2 card to exist (tight timeout)
  await page.waitForFunction(
    () => !!document.querySelector('[data-testid="summary-card-likely"]'),
    { timeout: 2000 }
  )

  // Expect cards present
  await expect(page.getByTestId('summary-card-likely')).toBeVisible()
  await expect(page.getByTestId('summary-card-conservative')).toBeVisible()
  await expect(page.getByTestId('summary-card-optimistic')).toBeVisible()

  // Chips + totals
  await expect(page.getByTestId('summary-chip-seed')).toBeVisible()
  await expect(page.getByTestId('summary-chip-model')).toBeVisible()
  await expect(page.getByTestId('summary-total-cost')).toContainText('Total: $')
})
