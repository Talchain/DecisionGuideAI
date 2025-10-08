import { test, expect } from '@playwright/test'

const route = process.env.E2E_ROUTE || '/?e2e=1#/test'

const gotoTest = async (page: any) => {
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  try { await page.waitForLoadState('networkidle', { timeout: 5000 }) } catch {}
  await page.getByTestId('graph-canvas').waitFor({ state: 'visible' })
}

const countNodes = async (page: any) => {
  return await page.locator('[data-testid="graph-node"]').count()
}

const getFirstRect = (page: any) => page.locator('svg g[data-testid="graph-node"] rect').first()

const getRectXY = async (rect: any) => {
  const x = await rect.getAttribute('x')
  const y = await rect.getAttribute('y')
  return { x: Number(x), y: Number(y) }
}

test.setTimeout(10000)

test('add → undo → redo restores node presence; header disabled states are correct', async ({ page }) => {
  await gotoTest(page)

  const undoBtn = page.getByTestId('undo-btn')
  const redoBtn = page.getByTestId('redo-btn')

  await expect(undoBtn).toBeDisabled()
  await expect(redoBtn).toBeDisabled()

  // Add a node
  const before = await countNodes(page)
  await page.getByTestId('add-node-btn').click()
  await expect.poll(() => countNodes(page)).toBe(before + 1)

  // Undo removes it
  await expect(undoBtn).toBeEnabled()
  await undoBtn.click()
  await expect.poll(() => countNodes(page)).toBe(before)
  await expect(redoBtn).toBeEnabled()

  // Redo restores it
  await redoBtn.click()
  await expect.poll(() => countNodes(page)).toBe(before + 1)

  console.log('GATES: PASS — undo/redo e2e')
})


test('drag → undo/redo returns to precise coords; typing guard prevents undo while editing', async ({ page }) => {
  await gotoTest(page)

  // Ensure at least one node exists
  const n0 = await countNodes(page)
  if (n0 === 0) {
    await page.getByTestId('add-node-btn').click()
    await expect.poll(() => countNodes(page)).toBe(1)
  }

  const rect = getFirstRect(page)
  const svg = page.locator('svg').first()

  const before = await getRectXY(rect)

  // Drag by (+30, +20)
  const rbox = await rect.boundingBox()
  const sbox = await svg.boundingBox()
  if (!rbox || !sbox) throw new Error('missing boxes')

  await page.mouse.move(rbox.x + rbox.width / 2, rbox.y + rbox.height / 2)
  await page.mouse.down()
  await page.mouse.move(rbox.x + rbox.width / 2 + 30, rbox.y + rbox.height / 2 + 20)
  await page.mouse.up()

  const after = await getRectXY(rect)
  expect(after.x).not.toBe(before.x)
  expect(after.y).not.toBe(before.y)

  // Undo returns to exact coords
  await page.getByTestId('undo-btn').click()
  const undoXY = await getRectXY(rect)
  expect(undoXY.x).toBe(before.x)
  expect(undoXY.y).toBe(before.y)

  // Redo returns to dragged coords
  await page.getByTestId('redo-btn').click()
  const redoXY = await getRectXY(rect)
  expect(redoXY.x).toBe(after.x)
  expect(redoXY.y).toBe(after.y)

  // Typing guard — start editing, then Cmd/Ctrl+Z should not undo
  // Double-click label to edit
  const label = page.locator('svg g[data-testid="graph-node"] text').first()
  await label.dblclick()
  const input = page.locator('svg foreignObject input').first()
  await expect(input).toBeFocused()

  // Record current node count and coords
  const countBefore = await countNodes(page)

  // Press Meta+Z (Cmd on mac, Ctrl on windows also handled by Playwright via modifiers)
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z')

  // Expect no change
  await expect.poll(() => countNodes(page)).toBe(countBefore)
  const finalXY = await getRectXY(rect)
  expect(finalXY.x).toBe(redoXY.x)
  expect(finalXY.y).toBe(redoXY.y)
})
