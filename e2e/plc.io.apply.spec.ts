import { test, expect, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

async function mountPlc(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('PLC_ENABLED','1') } catch {} })
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => location.hash === '#/plc')
  await page.getByTestId('plc-root').waitFor()
  await page.getByTestId('plc-whiteboard').waitFor()
}

function json(s: string) { return s.replace(/\s+/g, ' ') }

async function openPanel(page: Page) {
  const toggle = page.getByTestId('plc-io-toggle-btn')
  await expect(toggle).toHaveAttribute('aria-controls', 'plc-io-panel')
  await toggle.click()
  const panel = page.getByTestId('plc-io-panel')
  await panel.waitFor()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('plc-io-textarea')).toBeFocused()
}

async function setTextarea(page: Page, value: string) {
  await page.getByTestId('plc-io-textarea').fill(value)
}

async function validate(page: Page) {
  await page.getByTestId('plc-io-validate').click()
}

test('PLC IO Apply: diff summary, apply, undo/redo, a11y, visual, no-op', async ({ page }) => {
  await mountPlc(page)

  // Open panel
  await openPanel(page)
  const panel = page.getByTestId('plc-io-panel')

  // Baseline apply: add a,b and edge a->b
  await setTextarea(page, json('{"nodes":[{"id":"a","x":0,"y":0},{"id":"b","x":100,"y":0}],"edges":[{"from":"a","to":"b"}]}'))
  await validate(page)
  await expect(page.getByTestId('plc-io-diff')).toContainText('+3 / −0 / Δ0')
  await page.getByTestId('plc-io-apply').click()
  await expect(page.getByTestId('plc-io-status')).toHaveText(/Applied/)
  // Assert canvas reflects state
  await expect(page.locator('[data-testid="plc-node"][data-node-id="a"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="plc-node"][data-node-id="b"]')).toHaveCount(1)
  await expect(page.getByTestId('plc-edge')).toHaveCount(1)

  // Second apply: +c, -b, move a, edge a->c (add) and remove a->b
  await setTextarea(page, json('{"nodes":[{"id":"a","x":10,"y":5},{"id":"c","x":200,"y":100}],"edges":[{"from":"a","to":"c"}]}'))
  await validate(page)
  const diffBox = page.getByTestId('plc-io-diff')
  await expect(diffBox).toContainText('+2 / −2 / Δ1')

  // a11y axe scoped to panel
  const results = await new AxeBuilder({ page }).include('[data-testid="plc-io-panel"]').analyze()
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.length, serious.map(v => v.id).join(', ')).toBe(0)
  // Visual snapshot of diff summary
  await expect(diffBox).toHaveScreenshot('plc-io-diff.png')

  // Apply and verify
  await page.getByTestId('plc-io-apply').click()
  await expect(page.getByTestId('plc-io-status')).toHaveText(/Applied/)
  await expect(page.locator('[data-testid="plc-node"][data-node-id="a"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="plc-node"][data-node-id="c"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="plc-node"][data-node-id="b"]')).toHaveCount(0)
  await expect(page.getByTestId('plc-edge')).toHaveCount(1)
  // Positions via rect x/y attributes
  const rectA = page.locator('[data-testid="plc-node"][data-node-id="a"] rect')
  await expect(rectA).toHaveAttribute('x', /10(\.0+)?/)
  await expect(rectA).toHaveAttribute('y', /5(\.0+)?/)

  // Undo once -> back to a,b and edge a->b
  await page.getByTestId('plc-undo-btn').click()
  await expect(page.locator('[data-testid="plc-node"][data-node-id="a"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="plc-node"][data-node-id="b"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="plc-node"][data-node-id="c"]')).toHaveCount(0)
  // a position back to 0,0
  const rectAUndo = page.locator('[data-testid="plc-node"][data-node-id="a"] rect')
  await expect(rectAUndo).toHaveAttribute('x', /^(0|0\.0+)$/)
  await expect(rectAUndo).toHaveAttribute('y', /^(0|0\.0+)$/)

  // Redo once -> back to applied state
  await page.getByTestId('plc-redo-btn').click()
  await expect(page.locator('[data-testid="plc-node"][data-node-id="c"]')).toHaveCount(1)
  const rectARedo = page.locator('[data-testid="plc-node"][data-node-id="a"] rect')
  await expect(rectARedo).toHaveAttribute('x', /10(\.0+)?/)
  await expect(rectARedo).toHaveAttribute('y', /5(\.0+)?/)

  // No-op: paste current state → Validate → No changes and Apply disabled
  await setTextarea(page, json('{"nodes":[{"id":"a","x":10,"y":5},{"id":"c","x":200,"y":100}],"edges":[{"from":"a","to":"c"}]}'))
  await validate(page)
  await expect(page.getByTestId('plc-io-status')).toHaveText(/No changes/)
  await expect(page.getByTestId('plc-io-apply')).toBeDisabled()

  // Close via Esc restores toggle focus
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('plc-io-panel')).toHaveCount(0)
  await expect(page.getByTestId('plc-io-toggle-btn')).toBeFocused()
})
