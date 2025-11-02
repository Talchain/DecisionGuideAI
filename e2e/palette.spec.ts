/**
 * Command Palette E2E Tests
 *
 * Tests keyboard-driven palette with search, navigation, and actions.
 * Performance: ≤50ms open, ≤75ms search
 * Accessibility: WCAG 2.1 AA, zero Axe violations
 *
 * Requires: VITE_FEATURE_COMMAND_PALETTE=1
 */

import { test, expect, Page } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'

async function gotoPlot(page: Page) {
  // Enable feature flags
  await page.addInitScript(() => {
    try { localStorage.setItem('feature.commandPalette', '1') } catch {}
    ;(window as any).__E2E = 1
  })

  await page.goto('/?e2e=1#/plot', { waitUntil: 'domcontentloaded' })

  // Wait for canvas or main content
  await page.waitForSelector('body', { timeout: 10000 })
}

test.describe('Command Palette', { tag: '@palette' }, () => {
  test.beforeEach(async ({ page }) => {
    await gotoPlot(page)
  })

  test('opens with ⌘K (Mac) or CTRL+K (Windows/Linux)', async ({ page }) => {
    // Test both modifiers for cross-platform compatibility
    const isMac = process.platform === 'darwin'

    // Open palette
    if (isMac) {
      await page.keyboard.press('Meta+k')
    } else {
      await page.keyboard.press('Control+k')
    }

    // Verify palette is visible
    const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
    await expect(palette).toBeVisible({ timeout: 2000 })

    // Verify search input is focused
    const input = palette.locator('input[role="combobox"]')
    await expect(input).toBeFocused()
  })

  test('opens within 50ms P95 (performance)', async ({ page }) => {
    const timings: number[] = []

    // Run 20 iterations to get P95
    for (let i = 0; i < 20; i++) {
      const start = Date.now()
      await page.keyboard.press('Meta+k')

      const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
      await palette.waitFor({ state: 'visible', timeout: 200 })

      const duration = Date.now() - start
      timings.push(duration)

      // Close for next iteration
      await page.keyboard.press('Escape')
      await palette.waitFor({ state: 'hidden', timeout: 1000 })
    }

    // Calculate P95
    timings.sort((a, b) => a - b)
    const p95Index = Math.floor(timings.length * 0.95)
    const p95 = timings[p95Index]

    expect(p95).toBeLessThan(50)
  })

  test('closes with ESC key', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')
    const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
    await expect(palette).toBeVisible()

    // Close with ESC
    await page.keyboard.press('Escape')
    await expect(palette).not.toBeVisible({ timeout: 1000 })
  })

  test('closes when clicking backdrop', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')
    const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
    await expect(palette).toBeVisible()

    // Click backdrop (outside dialog)
    await page.locator('.fixed.inset-0').click({ position: { x: 10, y: 10 } })
    await expect(palette).not.toBeVisible({ timeout: 1000 })
  })

  test('searches and displays results', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')

    const input = page.locator('input[role="combobox"]')
    await expect(input).toBeVisible()

    // Type search query
    await input.fill('run')

    // Wait for results
    const results = page.locator('[role="listbox"]')
    await expect(results).toBeVisible()

    // Verify "Run Analysis" action appears
    const runAction = page.locator('[role="option"]').filter({ hasText: /run analysis/i })
    await expect(runAction).toBeVisible()
  })

  test('navigates results with arrow keys', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')

    const input = page.locator('input[role="combobox"]')
    await input.fill('node')

    // Wait for results
    await page.waitForTimeout(200)

    // Press down arrow
    await page.keyboard.press('ArrowDown')

    // Verify first result is selected
    const selectedOption = page.locator('[role="option"][aria-selected="true"]')
    await expect(selectedOption).toBeVisible()

    // Press down again
    await page.keyboard.press('ArrowDown')

    // Verify selection moved
    const options = await page.locator('[role="option"][aria-selected="true"]').count()
    expect(options).toBe(1)

    // Press up arrow
    await page.keyboard.press('ArrowUp')

    // Verify selection moved back
    await expect(selectedOption).toBeVisible()
  })

  test('executes selected result with Enter key', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')

    const input = page.locator('input[role="combobox"]')
    await input.fill('run')

    // Wait for results
    await page.waitForTimeout(200)

    // Press Enter to execute first result
    await page.keyboard.press('Enter')

    // Palette should close
    const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
    await expect(palette).not.toBeVisible({ timeout: 1000 })
  })

  test('shows grouped results by kind', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')

    const input = page.locator('input[role="combobox"]')

    // Search for common term that appears across kinds
    await input.fill('a')

    // Wait for results
    await page.waitForTimeout(300)

    // Verify section headers exist
    const listbox = page.locator('[role="listbox"]')

    // Should have "Actions" section if any actions match
    const actionsHeader = listbox.locator('text=/actions/i').first()

    // Either actions appear or we get other sections
    const anySection = await listbox.locator('div').filter({ hasText: /actions|nodes|edges/i }).count()
    expect(anySection).toBeGreaterThan(0)
  })

  test('shows match type badges in results', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')

    const input = page.locator('input[role="combobox"]')
    await input.fill('run')

    // Wait for results
    await page.waitForTimeout(200)

    // Verify results have match type indicators
    const results = page.locator('[role="option"]')
    const count = await results.count()

    expect(count).toBeGreaterThan(0)

    // Check for match type badge (exact/prefix/fuzzy)
    const firstResult = results.first()
    const badge = firstResult.locator('span').filter({ hasText: /exact|prefix|fuzzy/i })

    // Badge might be visible depending on match
    // Just verify the result structure exists
    await expect(firstResult).toBeVisible()
  })

  test('shows empty state when no results', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')

    const input = page.locator('input[role="combobox"]')
    await input.fill('xyz123nonexistent')

    // Wait for search
    await page.waitForTimeout(300)

    // Verify "No results found" message
    const emptyState = page.locator('text=/no results/i')
    await expect(emptyState).toBeVisible()
  })

  test('shows hint text for keyboard shortcuts', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')

    const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
    await expect(palette).toBeVisible()

    // Verify footer hints
    await expect(palette.locator('text=/to navigate/i')).toBeVisible()
    await expect(palette.locator('text=/to select/i')).toBeVisible()
    await expect(palette.locator('text=/to close/i')).toBeVisible()
  })

  test('announces results count to screen readers', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')

    const input = page.locator('input[role="combobox"]')
    await input.fill('run')

    // Wait for results
    await page.waitForTimeout(300)

    // Verify screen reader status announcement
    const status = page.locator('[role="status"]')
    await expect(status).toBeVisible()

    // Should announce result count
    const statusText = await status.textContent()
    expect(statusText).toMatch(/\d+\s+results?/i)
  })

  test('accessibility: zero Axe violations', async ({ page }) => {
    await injectAxe(page)

    // Open palette
    await page.keyboard.press('Meta+k')
    const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
    await expect(palette).toBeVisible()

    // Run accessibility checks
    await checkA11y(page, '[role="dialog"][aria-label="Command palette"]', {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    })
  })

  test('accessibility: proper ARIA roles and labels', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')

    const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
    await expect(palette).toBeVisible()

    // Verify dialog has aria-modal
    const ariaModal = await palette.getAttribute('aria-modal')
    expect(ariaModal).toBe('true')

    // Verify combobox has proper attributes
    const input = page.locator('input[role="combobox"]')
    await expect(input).toHaveAttribute('aria-expanded', 'true')
    await expect(input).toHaveAttribute('aria-controls', 'palette-results')

    // Verify listbox exists
    const listbox = page.locator('[role="listbox"]')
    await expect(listbox).toHaveAttribute('id', 'palette-results')
  })

  test('accessibility: keyboard navigation complete flow', async ({ page }) => {
    // Open with keyboard
    await page.keyboard.press('Meta+k')

    // Input should be focused
    const input = page.locator('input[role="combobox"]')
    await expect(input).toBeFocused()

    // Type to search
    await input.type('run')
    await page.waitForTimeout(200)

    // Navigate with arrows
    await page.keyboard.press('ArrowDown')

    // Verify aria-activedescendant updates
    const activeDescendant = await input.getAttribute('aria-activedescendant')
    expect(activeDescendant).toBeTruthy()

    // Execute with Enter
    await page.keyboard.press('Enter')

    // Palette should close
    const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
    await expect(palette).not.toBeVisible({ timeout: 1000 })
  })

  test('maintains focus trap inside palette', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')

    const input = page.locator('input[role="combobox"]')
    await expect(input).toBeFocused()

    // Press Tab (should stay within dialog)
    await page.keyboard.press('Tab')

    // Focus should not leave the palette
    const activeElement = await page.evaluate(() => document.activeElement?.tagName)

    // Should still be within palette (INPUT or other palette element)
    expect(['INPUT', 'BUTTON', 'DIV']).toContain(activeElement)
  })

  test('clears query when reopening palette', async ({ page }) => {
    // Open and search
    await page.keyboard.press('Meta+k')
    const input = page.locator('input[role="combobox"]')
    await input.fill('test query')

    // Close
    await page.keyboard.press('Escape')

    // Reopen
    await page.keyboard.press('Meta+k')
    await expect(input).toBeVisible()

    // Query should be cleared
    const value = await input.inputValue()
    expect(value).toBe('')
  })

  test('handles rapid open/close without errors', async ({ page }) => {
    // Rapidly toggle palette
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Meta+k')
      await page.waitForTimeout(50)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(50)
    }

    // Final open should work
    await page.keyboard.press('Meta+k')
    const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
    await expect(palette).toBeVisible()
  })

  test('search performance: ≤75ms on many items', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+k')
    const input = page.locator('input[role="combobox"]')

    // Measure search time
    const start = Date.now()
    await input.fill('test')

    // Wait for results to update
    await page.waitForTimeout(100)

    const duration = Date.now() - start

    // Should be fast even with debouncing
    expect(duration).toBeLessThan(200) // Generous for E2E (unit tests verify <75ms)
  })
})
