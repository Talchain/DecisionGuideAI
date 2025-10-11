import { test, expect } from '@playwright/test'

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

async function mouseDownStable(page: import('@playwright/test').Page) {
  await page.mouse.down();
  await page.waitForTimeout(50);
}

function plcRects(page: import('@playwright/test').Page) {
  return page.locator('svg g[data-testid="plc-node"] rect')
}

// Guides: when enabled, show v/h lines on near-alignment and optionally snap within tol
// Acceptance: guide lines render; node snaps to guide; undo/redo is one frame

test('PLC Guides: render lines and snap within tolerance; undo/redo single frame', async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  const canvas = page.getByTestId('plc-whiteboard')
  await canvas.waitFor({ state: 'visible' })

  // Ensure guides ON and snap-to-guide ON
  const tGuides = page.getByTestId('plc-guides-toggle')
  const tSnapGuide = page.getByTestId('plc-guides-snap-toggle')
  if ((await tGuides.getAttribute('aria-pressed')) !== 'true') await tGuides.click()
  if ((await tSnapGuide.getAttribute('aria-pressed')) !== 'true') await tSnapGuide.click()

  // Add two nodes
  const add = page.getByTestId('add-node-btn')
  await add.click(); await add.click()
  const r0 = plcRects(page).first()
  const r1 = plcRects(page).nth(1)

  // Move r1 near vertical center alignment of r0
  const b0 = await r0.boundingBox(); const b1 = await r1.boundingBox()
  if (!b0 || !b1) throw new Error('bbox')
  const targetCx = b0.x + b0.width / 2
  const startX = b1.x + 10, startY = b1.y + 10
  await page.mouse.move(startX, startY)
  await mouseDownStable(page)
  // Drag such that r1 center-x is within ~5px of r0 center-x
  const dx = targetCx - (b1.x + b1.width / 2) + 5
  await page.mouse.move(startX + dx, startY)

  // While dragging, guide should appear
  await expect(page.getByTestId('plc-guide-v')).toBeVisible()

  await page.mouse.up()

  // After drop, rect X should be snapped so that its center aligns (modulo integer rounding)
  const r1x = Number(await r1.getAttribute('x'))
  const r1w = Number(await r1.getAttribute('width')) || 120
  expect(Math.round(r1x + r1w / 2)).toBe(Math.round(targetCx))

  // Undo then Redo remains a single move frame
  await page.getByTestId('plc-undo-btn').click()
  const r1xUndo = Number(await r1.getAttribute('x'))
  expect(Math.round(r1xUndo + r1w / 2)).not.toBe(Math.round(targetCx))

  await page.getByTestId('plc-redo-btn').click()
  const r1xRedo = Number(await r1.getAttribute('x'))
  expect(Math.round(r1xRedo + r1w / 2)).toBe(Math.round(targetCx))
})
