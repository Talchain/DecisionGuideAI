import { test, expect } from '@playwright/test'

// Round 3 A1/A2: Header mode toggles and persistence at /#/test

const gotoTest = async (page: any) => {
  await page.goto('/?e2e=1#/test', { waitUntil: 'domcontentloaded' })
  try { await page.waitForLoadState('networkidle', { timeout: 5000 }) } catch {}
}

const getModeContainer = (page: any) => page.locator('[data-mode]')

test('header mode toggles reflect in DOM', async ({ page }) => {
  await gotoTest(page)

  const container = getModeContainer(page)
  await expect(container).toHaveAttribute('data-mode', /draw|connect|inspect/)

  // Click Connect
  await page.getByTestId('mode-connect').click()
  await expect(container).toHaveAttribute('data-mode', 'connect')

  // Click Inspect
  await page.getByTestId('mode-inspect').click()
  await expect(container).toHaveAttribute('data-mode', 'inspect')

  // Emit one GATES line
  console.log('GATES: PASS — header mode toggles & reflects in DOM')
})

test('mode persists across reload', async ({ page }) => {
  await gotoTest(page)

  // Set to Connect and reload
  await page.getByTestId('mode-connect').click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  try { await page.waitForLoadState('networkidle', { timeout: 3000 }) } catch {}
  await expect(getModeContainer(page)).toHaveAttribute('data-mode', 'connect')

  // Change to Draw and reload
  await page.getByTestId('mode-draw').click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  try { await page.waitForLoadState('networkidle', { timeout: 3000 }) } catch {}
  await expect(getModeContainer(page)).toHaveAttribute('data-mode', 'draw')

  // Emit one GATES line
  console.log('GATES: PASS — mode persisted')
})
