import { test, expect } from '@playwright/test'

const ROUTE = process.env.E2E_ROUTE ?? '/#/test'

async function dismissOverlay(page) {
  const overlay = page.getByTestId('onboarding-overlay')
  if (await overlay.count()) {
    const dismiss = page.getByTestId('onboarding-dismiss')
    if (await dismiss.count()) await dismiss.click()
    await expect(overlay).toHaveCount(0)
  }
}

test('UX: selection cue without size change; toolbar titles/aria present', async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('whiteboard-canvas').waitFor({ state: 'visible' })
  await dismissOverlay(page)

  // Add a node and capture its rect bbox
  await page.getByTestId('add-node-btn').click()
  const node = page.getByTestId('graph-node').first()
  const rect = node.locator('rect')
  const before = await rect.boundingBox()

  // Click to select and verify attribute + no size change
  await node.click()
  await expect(node).toHaveAttribute('data-selected', '1')
  const after = await rect.boundingBox()
  if (!before || !after) throw new Error('missing bbox')
  expect(after.width).toBeCloseTo(before.width!, 1)
  expect(after.height).toBeCloseTo(before.height!, 1)

  // Toolbar button titles/aria
  await expect(page.getByTestId('undo-btn')).toHaveAttribute('title', /Undo/)
  await expect(page.getByTestId('redo-btn')).toHaveAttribute('title', /Redo/)
  await expect(page.getByTestId('export-png-btn')).toHaveAttribute('title', /Export PNG/)
  await expect(page.getByTestId('export-json-btn')).toHaveAttribute('title', /Export JSON/)
  await expect(page.getByTestId('import-json-btn')).toHaveAttribute('title', /Import JSON/)
  await expect(page.getByTestId('clear-btn')).toHaveAttribute('title', /Clear/)
  await expect(page.getByTestId('sandbox-help')).toHaveAttribute('title', /Help/)

  console.log('GATES: PASS — tiny ux e2e')
})
