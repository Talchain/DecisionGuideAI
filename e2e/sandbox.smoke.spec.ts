import { test, expect } from '@playwright/test'

// Basic smoke for Scenario Sandbox POC at /#/test
// Verifies header and mode switch are present and visible

test('Scenario Sandbox header & mode switch visible', async ({ page }) => {
  await page.goto('/?e2e=1#/test', { waitUntil: 'domcontentloaded' })
  try { await page.waitForLoadState('networkidle', { timeout: 5000 }) } catch {}

  const header = page.getByTestId('sandbox-header')
  const switcher = page.getByTestId('mode-switch')
  const drawBtn = page.getByTestId('mode-draw')

  await expect(header).toBeVisible()
  await expect(switcher).toBeVisible()
  await expect(drawBtn).toBeVisible()

  // Emit single GATES line for CI visibility
  console.log('GATES: PASS — e2e sandbox header & nav OK')
})
