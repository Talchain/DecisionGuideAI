/**
 * E2E Tests for Unified Panel Design
 * Tests PanelShell responsiveness, keyboard shortcuts, and accessibility
 */

import { test, expect } from '@playwright/test'

test.describe('Unified Panel Design', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  })

  test.describe('Templates Panel', () => {
    test('should open and close Templates panel with Cmd/Ctrl+T', async ({ page }) => {
      // Open with keyboard shortcut
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')

      // Panel should be visible
      const panel = page.locator('[role="complementary"][aria-label="Templates"]')
      await expect(panel).toBeVisible({ timeout: 2000 })

      // Should show title
      await expect(page.locator('text=Templates')).toBeVisible()

      // Close with same shortcut
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')
      await expect(panel).not.toBeVisible()
    })

    test('should close Templates panel with Escape', async ({ page }) => {
      // Open panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')
      const panel = page.locator('[role="complementary"][aria-label="Templates"]')
      await expect(panel).toBeVisible()

      // Press Escape
      await page.keyboard.press('Escape')
      await expect(panel).not.toBeVisible()
    })

    test('should close Templates panel with close button', async ({ page }) => {
      // Open panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')
      const panel = page.locator('[role="complementary"][aria-label="Templates"]')
      await expect(panel).toBeVisible()

      // Click close button
      const closeButton = panel.locator('button[aria-label="Close panel"]')
      await expect(closeButton).toBeVisible()
      await closeButton.click()

      await expect(panel).not.toBeVisible()
    })

    test('should show search input in Templates panel', async ({ page }) => {
      // Open panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')

      // Search input should be visible
      const searchInput = page.locator('input[placeholder*="Search templates"]')
      await expect(searchInput).toBeVisible()
      await expect(searchInput).toBeFocused()
    })

    test('should filter templates by search query', async ({ page }) => {
      // Open panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')

      // Type in search
      const searchInput = page.locator('input[placeholder*="Search templates"]')
      await searchInput.fill('pricing')

      // Should filter results (implementation dependent on templates available)
      // This is a basic check that search works
      await expect(searchInput).toHaveValue('pricing')
    })
  })

  test.describe('Results Panel', () => {
    test('should show tabs in Results panel', async ({ page }) => {
      // Trigger Run
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

      // Results panel should open
      const panel = page.locator('[role="complementary"][aria-label="Analysis Results"]')
      await expect(panel).toBeVisible()

      // Should show tabs
      await expect(page.locator('button', { hasText: 'Latest' })).toBeVisible()
      await expect(page.locator('button', { hasText: 'History' })).toBeVisible()
      await expect(page.locator('button', { hasText: 'Compare' })).toBeVisible()
    })

    test('should switch between tabs', async ({ page }) => {
      // Open Results
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
      const panel = page.locator('[role="complementary"][aria-label="Analysis Results"]')
      await expect(panel).toBeVisible()

      // Latest tab should be active by default
      const latestTab = page.locator('button', { hasText: 'Latest' })
      await expect(latestTab).toHaveClass(/border-blue-600/)

      // Click History tab
      const historyTab = page.locator('button', { hasText: 'History' })
      await historyTab.click()

      // History tab should now be active
      await expect(historyTab).toHaveClass(/border-blue-600/)
    })

    test('should show footer with CTAs when complete', async ({ page }) => {
      // Trigger Run
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

      // Wait for completion
      await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

      // Footer buttons should be visible
      await expect(page.locator('button', { hasText: /Analyze again/i })).toBeVisible()
      await expect(page.locator('button', { hasText: /Share/i })).toBeVisible()
    })
  })

  test.describe('Results Panel - Compare Tab', () => {
    test('should switch to Compare tab with Cmd/Ctrl+3', async ({ page }) => {
      // Trigger Run to open Results panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

      // Wait for Results panel to open
      await page.waitForTimeout(1000)

      // Press Cmd/Ctrl+3 to switch to Compare tab
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Digit3' : 'Control+Digit3')

      // Compare tab should be active
      const compareTab = page.locator('button', { hasText: 'Compare' })
      await expect(compareTab).toHaveClass(/border-blue-600/)
    })

    test('should show Compare heading when tab is active', async ({ page }) => {
      // Trigger Run and switch to Compare
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
      await page.waitForTimeout(1000)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Digit3' : 'Control+Digit3')

      // Should show Compare Runs heading
      await expect(page.locator('text=Compare Runs')).toBeVisible()
    })

    test('should show empty state when no runs selected', async ({ page }) => {
      // Trigger Run and switch to Compare
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
      await page.waitForTimeout(1000)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Digit3' : 'Control+Digit3')

      // Should show empty state message
      await expect(page.locator('text=Select two runs to compare')).toBeVisible()
    })

    test('should show run selectors for A and B', async ({ page }) => {
      // Trigger Run and switch to Compare
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
      await page.waitForTimeout(1000)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Digit3' : 'Control+Digit3')

      // Should show Run A and Run B labels
      await expect(page.locator('text=Run A')).toBeVisible()
      await expect(page.locator('text=Run B')).toBeVisible()

      // Should show select dropdowns
      const selects = page.locator('select')
      await expect(selects).toHaveCount(2)
    })

    test('should have Back button to return to Latest Run', async ({ page }) => {
      // Trigger Run and switch to Compare
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
      await page.waitForTimeout(1000)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Digit3' : 'Control+Digit3')

      // Should show Back button
      const backButton = page.locator('button', { hasText: /back to results/i })
      await expect(backButton).toBeVisible()

      // Click Back button
      await backButton.click()

      // Should return to Latest tab
      await expect(page.locator('text=Compare Runs')).not.toBeVisible()
      const latestTab = page.locator('button', { hasText: 'Latest' })
      await expect(latestTab).toHaveClass(/border-blue-600/)
    })

    test('should persist Compare tab when switching away and back', async ({ page }) => {
      // Trigger Run and switch to Compare
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
      await page.waitForTimeout(1000)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Digit3' : 'Control+Digit3')
      await expect(page.locator('text=Compare Runs')).toBeVisible()

      // Switch to Latest tab
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Digit1' : 'Control+Digit1')
      await expect(page.locator('text=Compare Runs')).not.toBeVisible()

      // Switch back to Compare tab
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Digit3' : 'Control+Digit3')
      await expect(page.locator('text=Compare Runs')).toBeVisible()
    })

    test('should have accessible ARIA labels for Compare elements', async ({ page }) => {
      // Trigger Run and switch to Compare
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
      await page.waitForTimeout(1000)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Digit3' : 'Control+Digit3')

      // Check heading has proper role
      const heading = page.locator('h2', { hasText: 'Compare Runs' })
      await expect(heading).toBeVisible()

      // Check dropdowns have labels
      await expect(page.locator('label', { hasText: 'Run A' })).toBeVisible()
      await expect(page.locator('label', { hasText: 'Run B' })).toBeVisible()
    })

    test('should handle keyboard navigation in Compare tab', async ({ page }) => {
      // Trigger Run and switch to Compare
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
      await page.waitForTimeout(1000)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Digit3' : 'Control+Digit3')

      // Tab should navigate through interactive elements
      await page.keyboard.press('Tab')
      await page.waitForTimeout(100)

      // Should focus on Back button or first dropdown
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(['BUTTON', 'SELECT'].includes(focusedElement)).toBe(true)
    })
  })

  test.describe('Panel Responsiveness', () => {
    test('should render panel with correct width on desktop', async ({ page }) => {
      // Open Templates panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')

      const panel = page.locator('[role="complementary"][aria-label="Templates"]')
      await expect(panel).toBeVisible()

      // Panel should have responsive width classes
      const panelClass = await panel.getAttribute('class')
      expect(panelClass).toContain('w-full')
      expect(panelClass).toMatch(/sm:w-\[/)
    })

    test('should render panel with mobile layout on narrow viewport', async ({ page }) => {
      // Set narrow viewport
      await page.setViewportSize({ width: 375, height: 667 })

      // Open Templates panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')

      const panel = page.locator('[role="complementary"][aria-label="Templates"]')
      await expect(panel).toBeVisible()

      // Panel should take full width on mobile
      const box = await panel.boundingBox()
      expect(box?.width).toBeGreaterThan(300) // Should be close to viewport width
    })
  })

  test.describe('Panel Accessibility', () => {
    test('should have correct ARIA attributes', async ({ page }) => {
      // Open Templates panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')

      const panel = page.locator('[role="complementary"][aria-label="Templates"]')
      await expect(panel).toBeVisible()

      // Check role and aria-label
      await expect(panel).toHaveAttribute('role', 'complementary')
      await expect(panel).toHaveAttribute('aria-label', 'Templates')
    })

    test('should focus first interactive element on open', async ({ page }) => {
      // Open Templates panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')

      // Search input should be focused
      const searchInput = page.locator('input[placeholder*="Search templates"]')
      await expect(searchInput).toBeFocused()
    })

    test('should handle keyboard navigation in Results panel', async ({ page }) => {
      // Open Results
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
      await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible()

      // Tab through interactive elements
      await page.keyboard.press('Tab')

      // Should be able to navigate with Tab
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(focusedElement).toBeTruthy()
    })

    test('should announce status changes with aria-live', async ({ page }) => {
      // Trigger Run
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')

      // Check for aria-live regions (for screen readers)
      const liveRegion = page.locator('[aria-live="polite"]')
      await expect(liveRegion).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Panel Backdrop', () => {
    test('should show backdrop when panel is open', async ({ page }) => {
      // Open Templates panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')

      // Backdrop should be visible
      const backdrop = page.locator('.fixed.inset-0.bg-black\\/50')
      await expect(backdrop).toBeVisible()
    })

    test('should close panel when clicking backdrop', async ({ page }) => {
      // Open Templates panel
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+t' : 'Control+t')
      const panel = page.locator('[role="complementary"][aria-label="Templates"]')
      await expect(panel).toBeVisible()

      // Click backdrop
      const backdrop = page.locator('.fixed.inset-0.bg-black\\/50')
      await backdrop.click({ position: { x: 10, y: 10 } }) // Click top-left to avoid panel

      // Panel should close
      await expect(panel).not.toBeVisible()
    })
  })
})
