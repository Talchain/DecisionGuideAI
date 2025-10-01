import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'

test.describe('Canvas drawer and autosave', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('feature.canvas', '1') } catch {}
      ;(window as any).__E2E = '1'
    })
    await installFakeEventSource(page)
  })

  test('open drawer, send a note after Done, persists across reload', async ({ page }) => {
    await gotoSandbox(page)
    await waitForPanel(page)

    // Open drawer
    await page.getByTestId('canvas-btn').click()
    await expect(page.getByTestId('canvas-drawer')).toBeVisible()
    await expect(page.getByTestId('canvas-surface')).toBeVisible()
    // Export text button should be hidden by default (flag OFF)
    await expect(page.getByTestId('canvas-export-text-btn')).toHaveCount(0)

    // Close via overlay click
    await page.getByTestId('canvas-drawer').click({ position: { x: 5, y: 5 } })
    await expect(page.getByTestId('canvas-drawer')).not.toBeVisible()

    // Start a run and mark as done
    await expect(page.getByTestId('start-btn')).toBeEnabled()
    await page.getByTestId('start-btn').click()
    await page.evaluate(() => {
      const insts: any[] = (window as any).FakeEventSource?.instances || []
      const es = insts[insts.length - 1]
      es?.emit('done', { reason: 'done' })
    })

    // Send to canvas
    await page.getByTestId('canvas-send-btn').click()
    await expect(page.getByTestId('canvas-drawer')).toBeVisible()
    // Allow microtask
    await page.waitForTimeout(50)
    // Note should be present
    const notes = await page.locator('[data-testid="canvas-note"]').all()
    expect(notes.length).toBeGreaterThanOrEqual(1)

    // Reload and verify persistence
    await page.reload()
    await gotoSandbox(page)
    await page.getByTestId('canvas-btn').click()
    await page.getByTestId('canvas-drawer')
    await expect(page.locator('[data-testid="canvas-note"]')).toHaveCount(1)
  })
})
