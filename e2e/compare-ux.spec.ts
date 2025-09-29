import { test, expect } from '@playwright/test'
import { gotoSandbox, installFakeEventSource } from './_helpers'
import { mkdir } from 'fs/promises'

// Compare Drawer UX guardrails: headline deltas visible and canvas remains interactive

test.describe('Compare Drawer UX guardrails', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeEventSource(page)
    await page.addInitScript(() => {
      try {
        localStorage.setItem('feature.sseStreaming', '1')
        localStorage.setItem('feature.snapshots', '1')
        localStorage.setItem('feature.compare', '1')
        localStorage.setItem('feature.canvas', '1')
        localStorage.setItem('feature.canvasSimplify', '1')
        ;(window as any).__E2E = 1
      } catch {}
    })
    await gotoSandbox(page)
  })

  test('headline deltas show; canvas remains interactive', async ({ page }) => {
    // Snapshot A (simplify OFF by default)
    await page.getByTestId('snapshot-btn').click()

    // Toggle simplify to change edges and snapshot B
    await page.getByTestId('simplify-toggle').check()
    await page.getByTestId('snapshot-btn').click()

    // Select A and B
    const selA = page.getByTestId('compare-select-a')
    const selB = page.getByTestId('compare-select-b')
    await expect(selA.locator('option')).toHaveCount(3)
    const valB = await selA.locator('option').nth(1).getAttribute('value')
    const valA = await selA.locator('option').nth(2).getAttribute('value')
    await selA.selectOption(valA!)
    await selB.selectOption(valB!)

    // Headline deltas: reuse existing diff list and ensure entries present
    const diff = page.getByTestId('compare-diff-list')
    await expect(diff).toBeVisible()
    await expect(diff).toContainText('↓ e2')
    await expect(diff).toContainText('↓ e4')

    // Canvas remains interactive (non-blocking)
    const canvasBtn = page.getByTestId('canvas-btn')
    await expect(canvasBtn).toBeVisible()
    await canvasBtn.click()
    await expect(page.getByTestId('canvas-drawer')).toBeVisible()
    // Close with Escape and ensure it responds
    await page.keyboard.press('Escape')
    // Drawer should hide
    await expect(page.getByTestId('canvas-drawer')).toHaveCount(0)

    // Enable error banner path and assert catalogue mapping appears while compare context is on screen
    await page.addInitScript(() => {
      try {
        localStorage.setItem('feature.errorBanners', '1')
        localStorage.setItem('sandbox.errorType', 'RATE_LIMIT')
      } catch {}
    })
    // Trigger an error via FakeEventSource
    await page.getByTestId('start-btn').click()
    await page.evaluate(() => { (window as any).FakeEventSource?.instances?.[0]?.emit('error') })
    // Ensure banner visible and British English phrase is present
    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-banner')).toContainText('Please wait and retry')

    // Evidence screenshot (headline deltas + an interactive affordance visible)
    await mkdir('docs/evidence/compare', { recursive: true })
    await page.screenshot({ path: 'docs/evidence/compare/compare_headline_deltas.png', fullPage: false })
  })
})
