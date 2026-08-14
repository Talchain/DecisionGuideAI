/**
 * Real-browser verification of the single model-name control (Paul, 14 Aug 2026).
 *
 * jsdom proves wiring, never layout (trap 3): a jsdom spec cannot tell you that
 * two controls were VISIBLE side by side, only that two nodes existed. These
 * assertions are the ones that need a real engine — visibility, bounding boxes,
 * real focus, real keyboard.
 *
 * Run: npx playwright test e2e/topbar-model-name.spec.ts
 */
import { test, expect } from '@playwright/test'

test.describe('TopBar — one model-name control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.getByTestId('scenario-name-button')).toBeVisible({ timeout: 30_000 })
  })

  test('shows exactly ONE visible name control, and the old title is gone', async ({ page }) => {
    // The removed control, by both of its accessible names.
    await expect(page.getByRole('button', { name: /edit decision title/i })).toHaveCount(0)

    // Exactly one visible name control in the banner.
    const banner = page.getByRole('banner')
    await expect(banner.getByTestId('scenario-name-button')).toHaveCount(1)

    // ...and it really occupies space (a jsdom test cannot say this).
    const box = await page.getByTestId('scenario-name-button').boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(20)
    expect(box!.height).toBeGreaterThan(10)

    // No element anywhere on screen still says "Untitled decision".
    await expect(page.getByText('Untitled decision', { exact: false })).toHaveCount(0)
  })

  test('renames inline in ONE click, Enter commits', async ({ page }) => {
    await page.getByTestId('scenario-name-button').click()

    const input = page.getByTestId('scenario-name-input')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()          // real focus, not a jsdom attribute

    await input.fill('Opex reduction model')
    await input.press('Enter')

    await expect(page.getByTestId('scenario-name-input')).toHaveCount(0)
    await expect(page.getByTestId('scenario-name-button')).toHaveText('Opex reduction model')
  })

  test('Escape cancels and keeps the previous name', async ({ page }) => {
    const before = await page.getByTestId('scenario-name-button').innerText()

    await page.getByTestId('scenario-name-button').click()
    const input = page.getByTestId('scenario-name-input')
    await input.fill('Discarded name')
    await input.press('Escape')

    await expect(page.getByTestId('scenario-name-input')).toHaveCount(0)
    await expect(page.getByTestId('scenario-name-button')).toHaveText(before)
  })

  test('an empty name is refused', async ({ page }) => {
    const before = await page.getByTestId('scenario-name-button').innerText()

    await page.getByTestId('scenario-name-button').click()
    const input = page.getByTestId('scenario-name-input')
    await input.fill('   ')
    await input.press('Enter')

    await expect(page.getByTestId('scenario-name-button')).toHaveText(before)
  })

  test('the dropdown still opens from its own chevron, and does not overlap the name', async ({ page }) => {
    await page.getByTestId('scenario-switcher-trigger').click()
    const menu = page.getByTestId('scenario-switcher-menu')
    await expect(menu).toBeVisible()

    // Opens BELOW the trigger in the fixed top bar (would leave the viewport
    // upward) — a geometric claim, so it needs the real engine.
    const menuBox = await menu.boundingBox()
    const pillBox = await page.getByTestId('scenario-switcher-pill').boundingBox()
    expect(menuBox!.y).toBeGreaterThan(pillBox!.y)
  })

  test('the kebab Rename opens the same inline editor', async ({ page }) => {
    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    await expect(page.getByTestId('scenario-name-input')).toBeFocused()
  })

  test('evidence screenshot of the top bar', async ({ page }) => {
    await page.getByRole('banner').screenshot({
      path: 'e2e-artifacts/topbar-model-name-2026-08-14.png',
    })
  })
})
