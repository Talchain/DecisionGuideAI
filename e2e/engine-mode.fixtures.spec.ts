import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel } from './_helpers'

// Engine Mode chip appears when flag enabled. Tooltip shows fixtures or health status.

test('Fixtures mode runs offline and shows health tooltip', async ({ page }) => {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('feature.engineMode', '1') } catch {}
  })
  await gotoSandbox(page)
  await waitForPanel(page)

  const chip = page.getByTestId('engine-mode-chip')
  await expect(chip).toBeVisible()

  // Hover to trigger onMouseEnter tooltip fetch/assignment
  await chip.hover()

  const tip = page.getByTestId('engine-health-tooltip')
  await expect(tip).toBeVisible()
  await expect(tip).toContainText(/fixtures|status|p95/i)
})
