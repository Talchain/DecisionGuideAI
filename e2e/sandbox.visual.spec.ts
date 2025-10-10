import { test, expect } from '@playwright/test'

// Global visual settings
test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })

const ROUTE = process.env.E2E_ROUTE ?? '/#/test'

async function injectVisregCSS(page) {
  await page.addStyleTag({ path: 'src/poc/styles/visreg.css' })
}

test('VisReg: empty canvas, two nodes+edge, selection', async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await injectVisregCSS(page)

  // Ensure canvas visible
  const canvas = page.getByTestId('whiteboard-canvas')
  await canvas.waitFor({ state: 'visible' })

  // Dismiss onboarding overlay if present
  const overlay = page.getByTestId('onboarding-overlay')
  if (await overlay.count()) {
    const dismiss = page.getByTestId('onboarding-dismiss')
    if (await dismiss.count()) await dismiss.click()
    await expect(overlay).toHaveCount(0)
  }

  // State A: empty
  await expect(page).toHaveScreenshot('visreg-empty.png', { fullPage: false })

  // Add two nodes
  const add = page.getByTestId('add-node-btn')
  await add.click()
  await add.click()
  await expect(page.getByTestId('graph-node')).toHaveCount(2)

  // Connect them (no ghost)
  const toggle = page.getByTestId('connect-toggle-btn')
  await toggle.click()
  const nodes = page.getByTestId('graph-node')
  await nodes.nth(0).click()
  await nodes.nth(1).click()
  await expect(page.getByTestId('graph-edge')).toHaveCount(1)

  // State B: two nodes + 1 edge
  await expect(page).toHaveScreenshot('visreg-two-nodes-edge.png', { fullPage: false })

  // State C: selection visual
  await nodes.nth(0).click()
  // verify selection attr exists
  await expect(nodes.nth(0)).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveScreenshot('visreg-selected.png', { fullPage: false })

  console.log('GATES: PASS — visreg (3 states)')
})
