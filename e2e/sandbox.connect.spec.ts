import { test, expect } from '@playwright/test'

test.setTimeout(10000)

test('Rubber-band connect: ghost appears, commit edge, Esc cancels', async ({ page }) => {
  const ROUTE = process.env.E2E_ROUTE ?? '/#/test'
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('whiteboard-canvas').waitFor({ state: 'visible' })

  // Ensure at least two nodes exist
  const addBtn = page.getByTestId('add-node-btn')
  await addBtn.click()
  await addBtn.click()

  const nodes = page.getByTestId('graph-node')
  await expect(nodes).toHaveCount(2)

  // Enter connect mode and click first node rect directly
  await page.getByTestId('connect-toggle-btn').click()
  const aHit = nodes.nth(0).locator('text')
  const bHit = nodes.nth(1).locator('text')

  await aHit.click()
  // Move mouse within the SVG to update ghost position
  const svg = page.getByTestId('whiteboard-canvas')
  const bb = await svg.boundingBox()
  if (!bb) throw new Error('Missing svg bounds')
  await page.mouse.move(bb.x + bb.width / 2 + 10, bb.y + bb.height / 2 + 10)
  await expect(page.getByTestId('ghost-edge')).toBeVisible()

  await bHit.click()
  await expect(page.getByTestId('ghost-edge')).toHaveCount(0)
  await expect(page.getByTestId('graph-edge')).toHaveCount(1)

  // Start a fresh connect and cancel with Esc
  await page.getByTestId('connect-toggle-btn').click()
  await aHit.click()
  // Move mouse again to update ghost for the second session
  {
    const svg2 = page.getByTestId('whiteboard-canvas')
    const bb2 = await svg2.boundingBox()
    if (!bb2) throw new Error('Missing svg bounds (second)')
    await page.mouse.move(bb2.x + bb2.width / 2 + 5, bb2.y + bb2.height / 2 + 5)
  }
  await expect(page.getByTestId('ghost-edge')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('ghost-edge')).toHaveCount(0)

  console.log('GATES: PASS — connect ghost e2e')
})
