import { test, expect } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'
import { primeUiState, dismissAllOverlays } from './helpers/overlays'

// S8-HELP-LEGEND: Canvas keyboard legend & help

test.describe('S8-HELP-LEGEND: Keyboard legend and help', () => {
  test.beforeEach(async ({ page }) => {
    await primeUiState(page)
    await openCanvas(page)
    await dismissAllOverlays(page)
  })

  test('Shift+/ opens Keyboard legend and Escape closes it without console errors', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)

    // Focus the document to ensure key events are captured
    await page.locator('body').click({ position: { x: 2, y: 2 } })

    // Press ? (Shift+Slash) to open whichever keyboard help surface is wired
    await page.keyboard.press('Shift+Slash')

    const legend = page.getByRole('dialog', { name: /Keyboard (legend|shortcuts)/i })
    const label = page.getByText(/Keyboard (legend|shortcuts)/i)

    let sawDialog = await legend.first().isVisible({ timeout: 5000 }).catch(() => false)
    let sawLabel = sawDialog ? false : await label.first().isVisible({ timeout: 5000 }).catch(() => false)

    // Fallback: occasionally the first keypress can be eaten; try once more
    if (!(sawDialog || sawLabel)) {
      await page.keyboard.press('Shift+Slash')
      sawDialog = await legend.first().isVisible({ timeout: 5000 }).catch(() => false)
      sawLabel = sawDialog ? false : await label.first().isVisible({ timeout: 5000 }).catch(() => false)
    }

    expect(sawDialog || sawLabel).toBe(true)

    // Esc closes the surface again
    await page.keyboard.press('Escape')

    if (sawDialog) {
      await expect(legend).not.toBeVisible()
    } else if (sawLabel) {
      await expect(label).not.toBeVisible()
    }

    expectNoConsoleErrors(errors)
  })
})
