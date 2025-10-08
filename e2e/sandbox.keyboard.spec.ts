import { test, expect } from '@playwright/test'

test.setTimeout(10000)

test('Keyboard: Undo/Redo via Cmd/Ctrl+Z', async ({ page }) => {
  const ROUTE = process.env.E2E_ROUTE ?? '/#/test'
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('whiteboard-canvas').waitFor({ state: 'visible' })

  // Add two nodes
  const addBtn = page.getByTestId('add-node-btn')
  await addBtn.click()
  await addBtn.click()
  await expect(page.getByTestId('graph-node')).toHaveCount(2)

  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.press(`${mod}+z`)
  await expect(page.getByTestId('graph-node')).toHaveCount(1)
  await page.keyboard.press(`${mod}+Shift+z`)
  await expect(page.getByTestId('graph-node')).toHaveCount(2)

  console.log('GATES: PASS — keyboard shortcuts e2e')
})
