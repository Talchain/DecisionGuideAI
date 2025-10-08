import { test, expect } from '@playwright/test'

test.setTimeout(10000)

test('Export PNG creates a named file >2KB', async ({ page }) => {
  await page.goto(process.env.E2E_ROUTE ?? '/#/test', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('whiteboard-canvas').waitFor({ state: 'visible' })

  // Add one node to ensure content exists
  const addBtn = page.getByTestId('add-node-btn')
  await expect(addBtn).toBeVisible()
  await addBtn.click()

  // Trigger export
  const exportBtn = page.getByTestId('export-png-btn')
  await expect(exportBtn).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportBtn.click(),
  ])

  const name = download.suggestedFilename()
  expect(name).toMatch(/^sandbox_export_\d{8}_\d{6}\.png$/)

  const stream = await download.createReadStream()
  let total = 0
  for await (const chunk of stream as any) {
    total += chunk.length || 0
  }
  expect(total).toBeGreaterThan(2000)

  console.log('GATES: PASS — export png e2e')
})
