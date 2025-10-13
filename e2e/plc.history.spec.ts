import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

function plcRects(page: import('@playwright/test').Page) {
  return page.locator('svg g[data-testid="plc-node"] rect')
}

test('PLC History panel: jump & a11y', async ({ page }) => {
  await page.addInitScript(() => { try {
    localStorage.setItem('PLC_ENABLED','1')
    localStorage.setItem('plc.snap','0')
    localStorage.setItem('plc.guides','0')
    localStorage.setItem('plc.snapGuide','0')
  } catch {} })
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => location.hash === '#/plc')
  await page.getByTestId('plc-root').waitFor()
  await page.getByTestId('plc-whiteboard').waitFor()

  // Seed 3 nodes via button
  const addBtn = page.getByTestId('add-node-btn')
  await addBtn.click(); await addBtn.click(); await addBtn.click()
  await expect(plcRects(page)).toHaveCount(3)

  const r0 = plcRects(page).nth(0)
  const r1 = plcRects(page).nth(1)
  const r2 = plcRects(page).nth(2)

  // Select 2 nodes and align-left via bulk toolbar
  const b0 = await r0.boundingBox(); const b1 = await r1.boundingBox(); if (!b0 || !b1) throw new Error('bbox')
  await page.mouse.move(b0.x + 10, b0.y + 10); await page.mouse.down(); await page.mouse.up()
  await page.keyboard.down('Shift')
  await page.mouse.move(b1.x + 10, b1.y + 10); await page.mouse.down(); await page.mouse.up()
  await page.keyboard.up('Shift')
  await page.getByTestId('plc-align-left').click()

  // Select 3 nodes and distribute-h
  const b2 = await r2.boundingBox(); if (!b2) throw new Error('bbox2')
  await page.keyboard.down('Shift')
  await page.mouse.move(b2.x + 10, b2.y + 10); await page.mouse.down(); await page.mouse.up()
  await page.keyboard.up('Shift')
  await page.getByTestId('plc-distribute-h').click()

  // Small move of first node
  const b0p = await r0.boundingBox(); if (!b0p) throw new Error('bbox3')
  await page.mouse.move(b0p.x + b0p.width/2, b0p.y + b0p.height/2)
  await page.mouse.down(); await page.waitForTimeout(50)
  await page.mouse.move(b0p.x + b0p.width/2 + 12, b0p.y + b0p.height/2 + 6)
  await page.mouse.up()

  // Panel is discoverable by accessible name and toggle ↔ panel wiring
  const toggle = page.getByTestId('plc-history-toggle-btn')
  await expect(toggle).toHaveAttribute('aria-controls', 'plc-history-panel')
  await toggle.click()
  const panel = page.getByTestId('plc-history-panel')
  await panel.waitFor()
  const panelRegion = page.getByRole('region', { name: 'History' })
  await expect(panelRegion).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')

  // Focus lands on the first entry, ArrowDown moves to second
  await expect(page.getByTestId('plc-history-entry-0')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('plc-history-entry-1')).toBeFocused()

  // Latest is active; exactly one active item
  const firstEntry = page.getByTestId('plc-history-entry-0')
  await expect(firstEntry).toHaveAttribute('aria-current', 'true')
  await expect(panelRegion.locator('button[aria-current="true"]')).toHaveCount(1)

  // Entries are capped at 20
  const entryCount = await panelRegion.locator('[data-testid^="plc-history-entry-"]').count()
  expect(entryCount).toBeLessThanOrEqual(20)

  // Remember x of node 0, click older entry (index 1), expect position changed
  const xNow = Number(await r0.getAttribute('x'))
  await page.getByTestId('plc-history-entry-1').click()
  const xAfter = Number(await r0.getAttribute('x'))
  expect(xAfter).not.toBe(xNow)

  // a11y: panel has no serious issues
  const results = await new AxeBuilder({ page }).include('[data-testid="plc-history-panel"]').analyze()
  const serious = results.violations.filter(v => (v.impact === 'serious' || v.impact === 'critical'))
  expect(serious.length, serious.map(v => v.id).join(', ')).toBe(0)

  // Visual: panel open
  await expect(panel).toHaveScreenshot('plc-history-open.png')

  // Esc closes and returns focus to toggle
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('plc-history-panel')).toHaveCount(0)
  await expect(toggle).toBeFocused()
})
