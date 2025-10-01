import { test, expect } from '@playwright/test'
import { installFakeEventSource, gotoSandbox, waitForPanel } from './_helpers'

// TLdraw adapter path: skip-aware when @tldraw/tldraw is not installed

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('cfg.gateway')
      localStorage.removeItem('feature.tldraw')
      localStorage.removeItem('feature.canvas')
      localStorage.removeItem('canvas.snapshot')
      localStorage.removeItem('canvas.autosave')
      ;(window as any).__E2E = '1'
    } catch {}
  })
})

test('TLdraw adapter attaches and receives notes when present; otherwise skips', async ({ page }) => {
  await installFakeEventSource(page)

  // Enable canvas + TLdraw flags
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.canvas', '1')
      localStorage.setItem('feature.tldraw', '1')
    } catch {}
  })

  await gotoSandbox(page)
  await waitForPanel(page)

  // Open the canvas drawer via the main canvas button to establish focus-return target
  const canvasBtn = page.getByTestId('canvas-btn')
  await expect(canvasBtn).toBeVisible()
  await canvasBtn.focus()
  await canvasBtn.click()
  await expect(page.getByTestId('canvas-drawer')).toBeVisible()

  // Check if adapter attached; if not, skip this spec
  const hasAdapter = await page.evaluate(() => !!document.querySelector('[data-testid="tldraw-surface"]'))
  test.skip(!hasAdapter, 'TLdraw not installed; skipping adapter assertions')

  // Start a run and finish to reveal the Send to Canvas action
  await page.getByTestId('start-btn').click()
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances?.[0]
    es?.emit('open')
    es?.emit('done')
  })

  // Click Send to Canvas which should add a note through the adapter
  const sendBtn = page.getByTestId('canvas-send-btn')
  await expect(sendBtn).toBeVisible()
  await sendBtn.click()

  // Surface visible and at least one adapter note present
  await expect(page.getByTestId('tldraw-surface')).toBeVisible()
  const noteCount = await page.locator('[data-testid=tldraw-note]').count()
  expect(noteCount).toBeGreaterThan(0)

  // Close with Esc and ensure focus returns to the canvas button
  await page.keyboard.press('Escape')
  await page.waitForTimeout(20)
  await expect(canvasBtn).toBeFocused()
})
