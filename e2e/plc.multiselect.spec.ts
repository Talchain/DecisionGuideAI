import { test, expect } from '@playwright/test'

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

function plcRects(page: import('@playwright/test').Page) {
  return page.locator('svg g[data-testid="plc-node"] rect')
}

test('PLC Multi-drag: drag one of selected moves all by same delta; Undo/Redo single frame', async ({ page }) => {
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

  // Seed nodes
  const add = page.getByTestId('add-node-btn')
  await add.click(); await add.click()
  await expect(plcRects(page)).toHaveCount(2)

  const r0 = plcRects(page).nth(0)
  const r1 = plcRects(page).nth(1)
  const b0 = await r0.boundingBox(); const b1 = await r1.boundingBox()
  if (!b0 || !b1) throw new Error('bbox')
  const bb0Before = b0
  const bb1Before = b1

  // Select r0 then add r1 to selection with Shift
  await page.mouse.move(b0.x + 10, b0.y + 10)
  await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up()
  await page.keyboard.down('Shift')
  await page.mouse.move(b1.x + 10, b1.y + 10)
  await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up()
  await page.keyboard.up('Shift')
  // Ensure both are selected
  await expect(page.locator('svg g[data-testid="plc-node"][aria-selected="true"]')).toHaveCount(2)

  // Drag r0 by +(30, 20)
  await page.mouse.move(b0.x + 10, b0.y + 10)
  await page.mouse.down(); await page.waitForTimeout(50)
  await page.mouse.move(b0.x + 40, b0.y + 30)
  await page.mouse.up()

  const bb0After = await r0.boundingBox()
  const bb1After = await r1.boundingBox()
  if (!bb0After || !bb1After) throw new Error('bbox-after')
  // Deltas should match across selected nodes within tolerance
  const dx0 = bb0After.x - bb0Before.x
  const dy0 = bb0After.y - bb0Before.y
  const dx1 = bb1After.x - bb1Before.x
  const dy1 = bb1After.y - bb1Before.y
  expect(Math.abs(dx0 - dx1) <= 3).toBe(true)
  expect(Math.abs(dy0 - dy1) <= 3).toBe(true)

  // Undo once
  await page.getByTestId('plc-undo-btn').click()
  const bb0Undo = await r0.boundingBox(); const bb1Undo = await r1.boundingBox()
  if (!bb0Undo || !bb1Undo) throw new Error('bbox-undo')
  const tol = 2
  expect(Math.abs(bb0Undo.x - bb0Before.x) <= tol).toBe(true)
  expect(Math.abs(bb0Undo.y - bb0Before.y) <= tol).toBe(true)
  expect(Math.abs(bb1Undo.x - bb1Before.x) <= tol).toBe(true)
  expect(Math.abs(bb1Undo.y - bb1Before.y) <= tol).toBe(true)

  // Redo once
  await page.getByTestId('plc-redo-btn').click()
  const bb0Redo = await r0.boundingBox(); const bb1Redo = await r1.boundingBox()
  if (!bb0Redo || !bb1Redo) throw new Error('bbox-redo')
  expect(Math.abs(bb0Redo.x - bb0After.x) <= tol).toBe(true)
  expect(Math.abs(bb0Redo.y - bb0After.y) <= tol).toBe(true)
  expect(Math.abs(bb1Redo.x - bb1After.x) <= tol).toBe(true)
  expect(Math.abs(bb1Redo.y - bb1After.y) <= tol).toBe(true)
})
