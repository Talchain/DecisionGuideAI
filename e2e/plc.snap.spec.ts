import { test, expect } from '@playwright/test'

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

async function mouseDownStable(page: import('@playwright/test').Page) {
  await page.mouse.down();
  await page.waitForTimeout(50);
}

function plcRects(page: import('@playwright/test').Page) {
  return page.locator('svg g[data-testid="plc-node"] rect')
}

test('PLC Snap-to-Grid: off vs on changes coordinates; undo/redo restores', async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  const canvas = page.getByTestId('plc-whiteboard')
  await canvas.waitFor({ state: 'visible' })

  const add = page.getByTestId('add-node-btn')
  await add.click(); await add.click()
  await expect(plcRects(page)).toHaveCount(2)

  const r0 = plcRects(page).first()
  const b0 = await r0.boundingBox(); if (!b0) throw new Error('bbox')

  // Ensure snap is OFF
  const toggle = page.getByTestId('plc-snap-toggle')
  const label = await toggle.textContent()
  if ((label || '').includes('On')) await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  // Drag by an offset not aligned to grid (e.g., +37,+23)
  await page.mouse.move(b0.x + 10, b0.y + 10)
  await mouseDownStable(page)
  await page.mouse.move(b0.x + 10 + 37, b0.y + 10 + 23)
  await page.mouse.up()

  const xOff = Number(await r0.getAttribute('x'))
  const yOff = Number(await r0.getAttribute('y'))

  // Turn snap ON
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  // Drag again with a small offset that should snap to nearest 10px with tol=6
  const b1 = await r0.boundingBox(); if (!b1) throw new Error('bbox2')
  await page.mouse.move(b1.x + 10, b1.y + 10)
  await mouseDownStable(page)
  await page.mouse.move(b1.x + 10 + 5, b1.y + 10 + 5) // within tol -> should snap
  await page.mouse.up()

  const xOn = Number(await r0.getAttribute('x'))
  const yOn = Number(await r0.getAttribute('y'))

  // Expect snapped coords to be multiples of 10
  expect(xOn % 10).toBe(0)
  expect(yOn % 10).toBe(0)

  // Undo then Redo
  await page.getByTestId('plc-undo-btn').click()
  const xUndo = Number(await r0.getAttribute('x'))
  const yUndo = Number(await r0.getAttribute('y'))
  expect(xUndo).toBe(xOff)
  expect(yUndo).toBe(yOff)

  await page.getByTestId('plc-redo-btn').click()
  const xRedo = Number(await r0.getAttribute('x'))
  const yRedo = Number(await r0.getAttribute('y'))
  expect(xRedo).toBe(xOn)
  expect(yRedo).toBe(yOn)
})
