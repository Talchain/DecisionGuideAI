import { test, expect } from '@playwright/test'

// PLC visual baseline
test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

async function injectVisregCSS(page) {
  await page.addStyleTag({ path: 'src/plc/styles/plc.visreg.css' })
}

function plcRects(page: import('@playwright/test').Page) {
  return page.locator('svg g[data-testid="plc-node"] rect')
}

test('PLC VisReg: empty, two nodes, selection', async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await injectVisregCSS(page)

  const canvas = page.getByTestId('plc-whiteboard')
  await canvas.waitFor({ state: 'visible' })

  // A: empty
  await expect(page).toHaveScreenshot('plc-empty.png', { fullPage: false })

  // Add two nodes
  const add = page.getByTestId('add-node-btn')
  await add.click(); await add.click()
  await expect(plcRects(page)).toHaveCount(2)

  // B: two nodes
  await expect(page).toHaveScreenshot('plc-two-nodes.png', { fullPage: false })

  // Select first node (mousedown sets selection)
  const r0 = plcRects(page).first()
  const b0 = await r0.boundingBox(); if (!b0) throw new Error('bbox')
  await page.mouse.move(b0.x + 10, b0.y + 10)
  await page.mouse.down(); await page.mouse.up()

  // Verify aria-selected on group
  await expect(page.getByTestId('plc-node').first()).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveScreenshot('plc-selected.png', { fullPage: false })
})
