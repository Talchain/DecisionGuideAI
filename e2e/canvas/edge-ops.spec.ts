import { test, expect } from '@playwright/test'

test.describe('Edge Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await page.waitForSelector('[data-testid="react-flow-graph"]')
  })

  test('Delete key removes edge, not nodes', async ({ page }) => {
    const initial = await page.evaluate(() => ({
      edges: document.querySelectorAll('[data-edgeid]').length,
      nodes: document.querySelectorAll('[data-id]').length
    }))

    await page.locator('[data-edgeid]').first().click()
    await page.keyboard.press('Delete')
    await page.waitForTimeout(100)

    const after = await page.evaluate(() => ({
      edges: document.querySelectorAll('[data-edgeid]').length,
      nodes: document.querySelectorAll('[data-id]').length
    }))

    expect(after.edges).toBe(initial.edges - 1)
    expect(after.nodes).toBe(initial.nodes)
  })

  test('Inspector Change reconnects target', async ({ page }) => {
    await page.locator('[data-edgeid]').first().click()
    await page.waitForSelector('[data-testid="btn-edge-reconnect-target"]')
    await page.getByTestId('btn-edge-reconnect-target').click()
    await expect(page.getByTestId('banner-reconnect-mode')).toBeVisible()
  })

  test('Context menu reconnect + Esc cancels', async ({ page }) => {
    await page.locator('[data-edgeid]').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: /reconnect source/i }).click()
    await expect(page.getByTestId('banner-reconnect-mode')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('banner-reconnect-mode')).not.toBeVisible()
  })
})
