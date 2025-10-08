import { test, expect } from '@playwright/test'

test.setTimeout(10000)

function center(bb: { x: number; y: number; width: number; height: number }) {
  return { cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2 }
}

test('Persistence: add/drag survives reload; Clear empties', async ({ page }) => {
  const ROUTE = process.env.E2E_ROUTE ?? '/#/test'

  // Fresh start
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('whiteboard-canvas').waitFor({ state: 'visible' })
  await page.evaluate(() => localStorage.clear())

  // Add a node and drag it
  await page.getByTestId('add-node-btn').click()
  const node = page.getByTestId('graph-node').first()
  await expect(node).toBeVisible()
  const rect = node.locator('rect')
  const svg = page.getByTestId('whiteboard-canvas')
  const bb0 = await rect.boundingBox()
  if (!bb0) throw new Error('Missing rect bbox')
  const { cx, cy } = center(bb0)
  const posBefore = await rect.evaluate((el) => ({
    x: parseFloat(el.getAttribute('x') || '0'),
    y: parseFloat(el.getAttribute('y') || '0'),
  }))

  // Start drag by dispatching mousedown on the rect to hit React handler
  await rect.dispatchEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, buttons: 1 })
  const svgbb = await svg.boundingBox()
  if (!svgbb) throw new Error('Missing svg bbox')
  // Move within the SVG to a new location
  await page.mouse.move(cx + 120, cy + 80)
  // Release mouse to trigger onSvgMouseUp
  await page.mouse.up()

  const posMoved = await rect.evaluate((el) => ({
    x: parseFloat(el.getAttribute('x') || '0'),
    y: parseFloat(el.getAttribute('y') || '0'),
  }))
  expect(posMoved.x).toBeGreaterThan(posBefore.x + 10)
  expect(posMoved.y).toBeGreaterThan(posBefore.y + 8)

  // Reload and ensure position persisted (loose tolerance)
  await page.reload({ waitUntil: 'domcontentloaded' })
  const node2 = page.getByTestId('graph-node').first()
  await expect(node2).toBeVisible()
  const rect2 = node2.locator('rect')
  const posAfter = await rect2.evaluate((el) => ({
    x: parseFloat(el.getAttribute('x') || '0'),
    y: parseFloat(el.getAttribute('y') || '0'),
  }))
  expect(Math.abs(posAfter.x - posMoved.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(posAfter.y - posMoved.y)).toBeLessThanOrEqual(2)

  // Clear state and verify gone after reload
  page.once('dialog', d => d.accept())
  await page.getByTestId('clear-btn').click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('graph-node')).toHaveCount(0)

  console.log('GATES: PASS — persist e2e')
})
