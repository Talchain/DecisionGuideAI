import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })

const ROUTE = process.env.E2E_ROUTE ?? '/#/test'
const BUDGET_MS = process.env.CI ? 2200 : 2000

test('Perf: add 30 nodes, connect ~30 edges, drag loop, export < 2000ms; 0 console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  const t0 = Date.now()

  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('whiteboard-canvas').waitFor({ state: 'visible' })

  // dismiss overlay if present
  const overlay = page.getByTestId('onboarding-overlay')
  if (await overlay.count()) {
    const dismiss = page.getByTestId('onboarding-dismiss')
    if (await dismiss.count()) await dismiss.click()
    await expect(overlay).toHaveCount(0)
  }

  // add 30 nodes
  const add = page.getByTestId('add-node-btn')
  for (let i = 0; i < 30; i++) await add.click()
  await expect(page.getByTestId('graph-node')).toHaveCount(30)

  // connect edges (pairwise)
  const toggle = page.getByTestId('connect-toggle-btn')
  const nodes = page.getByTestId('graph-node')
  for (let i = 0; i < 30; i += 2) {
    await toggle.click()
    await nodes.nth(i).click()
    await nodes.nth((i + 1) % 30).click()
  }

  // small drag loop on first 5 nodes
  const canvas = page.getByTestId('whiteboard-canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas bbox')
  for (let i = 0; i < 5; i++) {
    await page.mouse.move(box.x + 50, box.y + 50)
    await page.mouse.down()
    await page.mouse.move(box.x + 80, box.y + 80)
    await page.mouse.up()
  }

  // export PNG
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-png-btn').click(),
  ])
  await download.path()

  const ms = Date.now() - t0
  const hasErrors = errors.length
  if (ms < BUDGET_MS && hasErrors === 0) {
    console.log(`GATES: PASS — perf smoke (${ms} ms, 0 errors)`) 
  } else {
    console.log(`GATES: FAIL — perf smoke (${ms} ms, ${hasErrors} errors)`) 
  }
  expect(ms).toBeLessThan(BUDGET_MS)
  expect(hasErrors).toBe(0)
})
