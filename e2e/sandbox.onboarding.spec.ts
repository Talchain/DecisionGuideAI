import { test, expect } from '@playwright/test'

test.setTimeout(15000)

const ROUTE = process.env.E2E_ROUTE ?? '/#/test'

test('Onboarding: overlay + help popover', async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  const svg = page.getByTestId('whiteboard-canvas')
  await svg.waitFor({ state: 'visible' })

  // Overlay visible for empty graph
  const overlay = page.getByTestId('onboarding-overlay')
  await expect(overlay).toBeVisible()

  // Add a node -> overlay should disappear and persist
  await page.getByTestId('add-node-btn').click()
  await expect(page.getByTestId('graph-node')).toHaveCount(1)
  await expect(overlay).toHaveCount(0)

  // Toggle help with header ? button
  await page.getByTestId('sandbox-help').click()
  await expect(page.getByTestId('help-popover')).toBeVisible()

  // Close via Esc
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('help-popover')).toHaveCount(0)

  console.log('GATES: PASS — onboarding e2e')
})
