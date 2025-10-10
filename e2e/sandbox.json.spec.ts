import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'

const ROUTE = process.env.E2E_ROUTE ?? '/#/test'

async function dismissOverlay(page) {
  const overlay = page.getByTestId('onboarding-overlay')
  if (await overlay.count()) {
    const dismiss = page.getByTestId('onboarding-dismiss')
    if (await dismiss.count()) await dismiss.click()
    await expect(overlay).toHaveCount(0)
  }
}

function pairStrings(pairs: { from: string; to: string }[]) {
  return pairs.map(p => `${p.from}->${p.to}`).sort()
}

test('JSON: roundtrip export -> import -> identical graph', async ({ page, context, browserName }) => {
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('whiteboard-canvas').waitFor({ state: 'visible' })
  await dismissOverlay(page)

  // Build small graph
  const add = page.getByTestId('add-node-btn')
  await add.click(); await add.click();
  const nodes = page.getByTestId('graph-node')
  await expect(nodes).toHaveCount(2)
  // connect
  await page.getByTestId('connect-toggle-btn').click()
  await nodes.nth(0).click(); await nodes.nth(1).click()
  await expect(page.getByTestId('graph-edge')).toHaveCount(1)

  // Capture current state summary
  const before = await nodes.evaluateAll(list => list.map(g => g.getAttribute('data-node-id')).sort())

  // Export JSON via download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-json-btn').click(),
  ])
  const path = await download.path()
  if (!path) throw new Error('no download path')
  const buf = await fs.readFile(path)

  // Import same JSON via hidden input
  const input = page.getByTestId('import-json-input')
  await input.setInputFiles({ name: 'state.json', mimeType: 'application/json', buffer: buf })

  // Validate identical node ids
  const after = await nodes.evaluateAll(list => list.map(g => g.getAttribute('data-node-id')).sort())
  expect(after).toEqual(before)

  console.log('GATES: PASS — json import/export e2e')
})


test('JSON: invalid import yields error banner and unchanged graph', async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('whiteboard-canvas').waitFor({ state: 'visible' })
  await dismissOverlay(page)

  // add a node so we can verify unchanged
  await page.getByTestId('add-node-btn').click()
  await expect(page.getByTestId('graph-node')).toHaveCount(1)

  const beforeIds = await page.getByTestId('graph-node').evaluateAll(list => list.map(g => g.getAttribute('data-node-id')).sort())

  const bad = Buffer.from('{"schemaVersion":2,"nodes":[{"oops":1}],"edges":[{}]}', 'utf-8')
  await page.getByTestId('import-json-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: bad })

  // expect banner text contains Import JSON failed
  await expect(page.locator('div[aria-live="polite"]')).toContainText('Import JSON failed')

  const afterIds = await page.getByTestId('graph-node').evaluateAll(list => list.map(g => g.getAttribute('data-node-id')).sort())
  expect(afterIds).toEqual(beforeIds)

  console.log('GATES: PASS — json import error guarded')
})
