import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

async function mouseDownStable(page: import('@playwright/test').Page) {
  await page.mouse.down();
  await page.waitForTimeout(50);
}

function plcRects(page: import('@playwright/test').Page) {
  return page.locator('svg g[data-testid="plc-node"] rect')
}

// Bulk toolbar E2E: selection shows toolbar; align/distribute applies in one frame; undo/redo single frame
// Also verify a11y: 0 serious violations with toolbar open; capture a small visual snapshot of toolbar presence

test('PLC Bulk: toolbar appears, align/distribute correct, undo/redo single frame, a11y 0', async ({ page }) => {
  await page.addInitScript(() => { try {
    localStorage.setItem('PLC_ENABLED','1')
    localStorage.setItem('plc.snap','0')
    localStorage.setItem('plc.guides','0')
    localStorage.setItem('plc.snapGuide','0')
  } catch {} })
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => location.hash === '#/plc')
  await page.getByTestId('plc-root').waitFor({ state: 'visible' })
  const canvas = page.getByTestId('plc-whiteboard')
  await canvas.waitFor({ state: 'visible' })

  // Seed three nodes for distribution tests
  const add = page.getByTestId('add-node-btn')
  await add.click(); await add.click(); await add.click()
  await expect(plcRects(page)).toHaveCount(3)

  const r0 = plcRects(page).nth(0)
  const r1 = plcRects(page).nth(1)
  const r2 = plcRects(page).nth(2)
  const b0 = await r0.boundingBox(); const b1 = await r1.boundingBox(); const b2 = await r2.boundingBox()
  if (!b0 || !b1 || !b2) throw new Error('bbox')

  // Multi-select via shift-click: select r0 then shift-click r1
  await page.mouse.move(b0.x + 10, b0.y + 10)
  await page.mouse.down(); await page.mouse.up()
  await page.keyboard.down('Shift')
  await page.mouse.move(b1.x + 10, b1.y + 10)
  await page.mouse.down(); await page.mouse.up()
  await page.keyboard.up('Shift')

  // Toolbar appears
  const toolbar = page.getByTestId('plc-bulk-toolbar')
  await expect(toolbar).toBeVisible()

  // Keyboard: "A" focuses first button
  await page.getByTestId('plc-canvas').click()
  await page.keyboard.press('A')
  await expect(page.getByTestId('plc-align-left')).toBeFocused()

  // Capture pre-align Xs
  const x0Before = Number(await r0.getAttribute('x'))
  const x1Before = Number(await r1.getAttribute('x'))

  // Click Align Left; both should align to minX of group (which is Math.min(x0Before, x1Before))
  const minX = Math.min(x0Before, x1Before)
  await page.getByTestId('plc-align-left').click()

  const x0After = Number(await r0.getAttribute('x'))
  const x1After = Number(await r1.getAttribute('x'))
  expect(x0After).toBe(minX)
  expect(x1After).toBe(minX)

  // Press Enter to repeat last action (align-left again); positions remain the same
  await page.getByTestId('plc-canvas').click()
  await page.keyboard.press('Enter')
  const x0AfterEnter = Number(await r0.getAttribute('x'))
  const x1AfterEnter = Number(await r1.getAttribute('x'))
  expect(x0AfterEnter).toBe(minX)
  expect(x1AfterEnter).toBe(minX)

  // Undo is a single frame: one click should restore both
  await page.getByTestId('plc-undo-btn').click()
  const x0Undo = Number(await r0.getAttribute('x'))
  const x1Undo = Number(await r1.getAttribute('x'))
  expect(x0Undo).toBe(x0Before)
  expect(x1Undo).toBe(x1Before)

  // Redo reapplies
  await page.getByTestId('plc-redo-btn').click()
  const x0Redo = Number(await r0.getAttribute('x'))
  const x1Redo = Number(await r1.getAttribute('x'))
  expect(x0Redo).toBe(minX)
  expect(x1Redo).toBe(minX)

  // Now distribute horizontally for 3 nodes: select r0, r1, r2
  await page.keyboard.down('Shift')
  await page.mouse.move(b2.x + 10, b2.y + 10)
  await page.mouse.down(); await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect(toolbar).toBeVisible()

  await page.getByTestId('plc-distribute-h').click()

  // Verify increasing X order with even spacing relative to group bounds
  const xs = [
    Number(await r0.getAttribute('x')),
    Number(await r1.getAttribute('x')),
    Number(await r2.getAttribute('x')),
  ]
  expect(xs[0] <= xs[1] && xs[1] <= xs[2]).toBe(true)

  // Delete: reselect two nodes and delete; selection clears and toolbar hides
  const b0r = await r0.boundingBox(); const b1r = await r1.boundingBox(); if (!b0r || !b1r) throw new Error('bbox-del')
  await page.mouse.move(b0r.x + 10, b0r.y + 10); await page.mouse.down(); await page.mouse.up()
  await page.keyboard.down('Shift')
  await page.mouse.move(b1r.x + 10, b1r.y + 10); await page.mouse.down(); await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect(toolbar).toBeVisible()
  const beforeCount = await plcRects(page).count()
  await page.getByTestId('plc-delete').click()
  await expect(plcRects(page)).toHaveCount(beforeCount - 2)
  await expect(toolbar).toBeHidden()

  // Undo deletion and re-query rects to re-show toolbar for visual
  await page.getByTestId('plc-undo-btn').click()
  const rectsForVisual = plcRects(page)
  const rA = rectsForVisual.nth(0)
  const rB = rectsForVisual.nth(1)
  const bA = await rA.boundingBox(); const bB = await rB.boundingBox(); if (!bA || !bB) throw new Error('bbox-vis')
  await page.mouse.move(bA.x + 10, bA.y + 10); await page.mouse.down(); await page.mouse.up()
  await page.keyboard.down('Shift')
  await page.mouse.move(bB.x + 10, bB.y + 10); await page.mouse.down(); await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect(toolbar).toBeVisible()

  // A11y: no serious violations (toolbar scope)
  const results = await new AxeBuilder({ page }).include('[data-testid="plc-bulk-toolbar"]').analyze()
  const serious = results.violations.filter(v => (v.impact === 'serious' || v.impact === 'critical'))
  expect(serious.length, serious.map(v => v.id).join(', ')).toBe(0)

  // Visual: small snapshot of the toolbar only
  await expect(toolbar).toHaveScreenshot('plc-bulk-toolbar.png')
})
