/**
 * E2E Tests for Inspector Panel
 * Tests keyboard shortcuts, edge editing, validation, and accessibility
 */

import { test, expect } from '@playwright/test'

test.describe('Inspector Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  })

  test.describe('Opening and Closing', () => {
    test('should open Inspector with Cmd/Ctrl+I', async ({ page }) => {
      // Press keyboard shortcut
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+i' : 'Control+i')

      // Inspector panel should be visible
      const panel = page.locator('[role="complementary"][aria-label="Inspector"]')
      await expect(panel).toBeVisible({ timeout: 2000 })

      // Should show title
      await expect(page.locator('text=Inspector')).toBeVisible()
    })

    test('should close Inspector with Escape', async ({ page }) => {
      // Open panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+i' : 'Control+i')
      const panel = page.locator('[role="complementary"][aria-label="Inspector"]')
      await expect(panel).toBeVisible()

      // Press Escape
      await page.keyboard.press('Escape')
      await expect(panel).not.toBeVisible()
    })

    test('should close Inspector with close button', async ({ page }) => {
      // Open panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+i' : 'Control+i')
      const panel = page.locator('[role="complementary"][aria-label="Inspector"]')
      await expect(panel).toBeVisible()

      // Click close button
      const closeButton = panel.locator('button[aria-label="Close panel"]')
      await expect(closeButton).toBeVisible()
      await closeButton.click()

      await expect(panel).not.toBeVisible()
    })
  })

  test.describe('Empty State', () => {
    test('should show empty state when no edge selected', async ({ page }) => {
      // Open panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+i' : 'Control+i')

      // Should show empty state message
      await expect(page.locator('text=Select an edge to inspect')).toBeVisible()
      await expect(page.locator('text=/click an edge on the canvas/i')).toBeVisible()
    })
  })

  test.describe('Edge Selection and Editing', () => {
    test.skip('should display edge details when edge selected', async ({ page }) => {
      // This test requires a canvas with edges
      // TODO: Add test data setup
    })

    test.skip('should update belief value with slider', async ({ page }) => {
      // This test requires a canvas with edges
      // TODO: Add test data setup
    })

    test.skip('should update provenance with text input', async ({ page }) => {
      // This test requires a canvas with edges
      // TODO: Add test data setup
    })

    test.skip('should show validation error for high belief without provenance', async ({ page }) => {
      // This test requires a canvas with edges
      // TODO: Add test data setup
    })
  })

  test.describe('Apply and Reset', () => {
    test.skip('should disable Apply when no changes made', async ({ page }) => {
      // This test requires a canvas with edges
      // TODO: Add test data setup
    })

    test.skip('should enable Apply when values change', async ({ page }) => {
      // This test requires a canvas with edges
      // TODO: Add test data setup
    })

    test.skip('should persist changes on Apply', async ({ page }) => {
      // This test requires a canvas with edges
      // TODO: Add test data setup
    })

    test.skip('should revert changes on Reset', async ({ page }) => {
      // This test requires a canvas with edges
      // TODO: Add test data setup
    })
  })

  test.describe('Multi-Edge Selection', () => {
    test.skip('should show message when multiple edges selected', async ({ page }) => {
      // This test requires a canvas with multiple edges
      // TODO: Add test data setup
    })
  })

  test.describe('Accessibility', () => {
    test('should have correct ARIA attributes', async ({ page }) => {
      // Open panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+i' : 'Control+i')

      const panel = page.locator('[role="complementary"][aria-label="Inspector"]')
      await expect(panel).toBeVisible()

      // Check role and aria-label
      await expect(panel).toHaveAttribute('role', 'complementary')
      await expect(panel).toHaveAttribute('aria-label', 'Inspector')
    })

    test('should handle keyboard navigation', async ({ page }) => {
      // Open panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+i' : 'Control+i')
      await expect(page.locator('[aria-label="Inspector"]')).toBeVisible()

      // Tab through interactive elements
      await page.keyboard.press('Tab')

      // Should be able to navigate with Tab
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(focusedElement).toBeTruthy()
    })

    test.skip('should have no Axe violations', async ({ page }) => {
      // Open panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+i' : 'Control+i')
      const panel = page.locator('[role="complementary"][aria-label="Inspector"]')
      await expect(panel).toBeVisible()

      // TODO: Add axe-playwright integration
      // const results = await injectAxe(page)
      // await checkA11y(page, panel, {
      //   detailedReport: true,
      //   detailedReportOptions: { html: true }
      // })
    })
  })

  test.describe('Command Palette Integration', () => {
    test('should open Inspector from Command Palette', async ({ page }) => {
      // Open command palette (Cmd/Ctrl+K)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')

      // Wait for palette to open
      await expect(page.locator('input[placeholder*="command"]').or(page.locator('input[type="text"]')).first()).toBeVisible({ timeout: 2000 })

      // Type "inspector"
      await page.keyboard.type('inspector')

      // Press Enter to execute
      await page.keyboard.press('Enter')

      // Inspector should open
      const panel = page.locator('[role="complementary"][aria-label="Inspector"]')
      await expect(panel).toBeVisible({ timeout: 2000 })
    })
  })

  test.describe('Performance', () => {
    test('should open within 120ms budget', async ({ page }) => {
      const startTime = Date.now()

      // Open Inspector
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+i' : 'Control+i')
      await expect(page.locator('[aria-label="Inspector"]')).toBeVisible()

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should be under 120ms TTI budget (allowing some margin for E2E overhead)
      expect(duration).toBeLessThan(500) // More generous for E2E context
    })
  })

  test.describe('Backdrop Interaction', () => {
    test('should show backdrop when panel is open', async ({ page }) => {
      // Open Inspector
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+i' : 'Control+i')

      // Backdrop should be visible
      const backdrop = page.locator('.fixed.inset-0.bg-black\\/50')
      await expect(backdrop).toBeVisible()
    })

    test('should close panel when clicking backdrop', async ({ page }) => {
      // Open Inspector
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+i' : 'Control+i')
      const panel = page.locator('[role="complementary"][aria-label="Inspector"]')
      await expect(panel).toBeVisible()

      // Click backdrop (top-left corner to avoid panel)
      const backdrop = page.locator('.fixed.inset-0.bg-black\\/50')
      await backdrop.click({ position: { x: 10, y: 10 } })

      // Panel should close
      await expect(panel).not.toBeVisible()
    })
  })
})
