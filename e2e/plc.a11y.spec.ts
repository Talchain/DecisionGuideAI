import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

test('PLC A11y: axe serious violations = 0', async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('plc-whiteboard').waitFor({ state: 'visible' })

  // Minimal interaction: add a node so focusable controls exist
  const add = page.getByTestId('add-node-btn')
  await add.click()

  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(v => (v.impact === 'serious' || v.impact === 'critical'))
  if (serious.length === 0) console.log('GATES: PASS — plc a11y (0 serious)')
  expect(serious.length, serious.map(v => v.id).join(', ')).toBe(0)
})
