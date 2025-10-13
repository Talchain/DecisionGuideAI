import { test, expect } from '@playwright/test'

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

function plcRects(page: import('@playwright/test').Page) {
  return page.locator('svg g[data-testid="plc-node"] rect')
}

test('PLC Keyboard nudge: Arrow=1px, Shift+Arrow=10px, one frame per nudge via Undo', async ({ page }) => {
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

  // Add one node
  await page.getByTestId('add-node-btn').click()
  await expect(plcRects(page)).toHaveCount(1)
  const r0 = plcRects(page).nth(0)
  // Select the node by clicking it
  const b0 = await r0.boundingBox(); if (!b0) throw new Error('bbox')
  await page.mouse.move(b0.x + 10, b0.y + 10)
  await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up()
  const x0 = Number(await r0.getAttribute('x'))

  // Focus canvas and nudge
  await page.getByTestId('plc-canvas').click()
  await page.keyboard.press('ArrowRight')
  const x1 = Number(await r0.getAttribute('x'))
  expect(x1).toBe(x0 + 1)
  // Live region announces 1px move
  await expect(page.locator('[aria-live="polite"]')).toContainText('Moved 1 node 1px right')

  await page.keyboard.press('Shift+ArrowRight')
  const x2 = Number(await r0.getAttribute('x'))
  expect(x2).toBe(x1 + 10)
  // Live region announces 10px move
  await expect(page.locator('[aria-live="polite"]')).toContainText('Moved 1 node 10px right')

  // Undo once -> back to x1
  await page.getByTestId('plc-undo-btn').click()
  const xu1 = Number(await r0.getAttribute('x'))
  expect(xu1).toBe(x1)
  // Undo again -> back to x0
  await page.getByTestId('plc-undo-btn').click()
  const xu0 = Number(await r0.getAttribute('x'))
  expect(xu0).toBe(x0)
})
