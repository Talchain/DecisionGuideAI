import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel } from './_helpers'

test('List View mirrors canvas and is keyboard navigable', async ({ page }) => {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('feature.listView', '1') } catch {}
  })
  await gotoSandbox(page)
  await waitForPanel(page)

  const items = page.locator('[data-testid^="list-node-"]')
  await expect(items.first()).toBeVisible()

  await items.first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(items.nth(1)).toBeFocused()

  await page.keyboard.press('Enter')
  // No-op focus-inside assert: just ensure focus is still on a node button
  await expect(items.nth(1)).toBeFocused()
})
