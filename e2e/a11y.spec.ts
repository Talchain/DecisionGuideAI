/**
 * E2E Accessibility Tests with Axe
 *
 * Target: 0 violations
 * Scans: ResultsPanel, NodeInspector, EdgeInspector, Preview mode
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility - Axe Core', () => {
  test('canvas page should have no accessibility violations', async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })

    // Run Axe scan on full page
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('ResultsPanel should have no accessibility violations', async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })

    // Run analysis to open Results panel
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    // Wait for full render
    await page.waitForTimeout(500)

    // Scan Results panel specifically
    const resultsPanel = page.locator('[aria-label="Analysis Results"]')
      .or(page.locator('[data-testid="results-panel"]'))

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[aria-label="Analysis Results"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    // Target: 0 violations
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('NodeInspector should have no accessibility violations', async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })

    // Click node to open inspector
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()

    // Wait for inspector to open
    await expect(page.locator('[aria-label="Node Inspector"]')
      .or(page.locator('[aria-label="Inspector"]'))).toBeVisible({ timeout: 5000 })

    // Wait for full render
    await page.waitForTimeout(500)

    // Scan inspector
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[aria-label="Node Inspector"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('EdgeInspector should have no accessibility violations', async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })

    // Click edge to open inspector (if edge exists)
    const firstEdge = page.locator('.react-flow__edge').first()
    if (await firstEdge.isVisible({ timeout: 5000 })) {
      await firstEdge.click()

      // Wait for inspector to open
      const inspector = page.locator('[aria-label="Edge Inspector"]')
        .or(page.locator('[aria-label="Inspector"]'))

      if (await inspector.isVisible({ timeout: 5000 })) {
        await page.waitForTimeout(500)

        // Scan inspector
        const accessibilityScanResults = await new AxeBuilder({ page })
          .include('[aria-label="Edge Inspector"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()

        expect(accessibilityScanResults.violations).toEqual([])
      }
    }
  })

  test('Preview mode should have no accessibility violations', async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })

    // Run analysis first
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    // Enter Preview mode
    const previewButton = page.locator('button', { hasText: /Preview Changes/i })
    if (await previewButton.isVisible({ timeout: 5000 })) {
      await previewButton.click()
      await expect(page.locator('text=/Preview Mode/i')).toBeVisible({ timeout: 5000 })

      // Wait for preview UI to render
      await page.waitForTimeout(500)

      // Scan full page in preview mode
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    }
  })

  test('Driver list should have no accessibility violations', async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })

    // Run analysis to get drivers
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    // Wait for drivers to render
    await page.waitForTimeout(500)

    // Find driver list section
    const driversSection = page.locator('text=/Drivers|Key Factors|Top Drivers/i').locator('..')

    if (await driversSection.isVisible({ timeout: 5000 })) {
      // Scan driver list
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      // Check for list-specific violations
      const listViolations = accessibilityScanResults.violations.filter(v =>
        v.nodes.some(node =>
          node.html.includes('driver') || node.html.includes('list')
        )
      )

      expect(listViolations).toEqual([])
    }
  })

  test('keyboard navigation should work without violations', async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })

    // Tab through interactive elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(100)

      // Check focus is visible
      const activeElement = await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return null

        const styles = window.getComputedStyle(el)
        return {
          tagName: el.tagName,
          hasOutline: styles.outline !== 'none' &&
                      styles.outlineWidth !== '0px',
          hasBoxShadow: styles.boxShadow !== 'none',
          hasBorder: styles.border?.includes('px')
        }
      })

      // Focused element should have visible focus indicator
      if (activeElement) {
        const hasFocusIndicator =
          activeElement.hasOutline ||
          activeElement.hasBoxShadow ||
          activeElement.hasBorder

        expect(hasFocusIndicator).toBe(true)
      }
    }

    // Run Axe scan after keyboard navigation
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('color contrast should meet WCAG AA standards', async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })

    // Run analysis to populate UI with content
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    // Scan specifically for color contrast issues
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .options({ rules: { 'color-contrast': { enabled: true } } })
      .analyze()

    const contrastViolations = accessibilityScanResults.violations.filter(v =>
      v.id === 'color-contrast'
    )

    expect(contrastViolations).toEqual([])
  })

  test('form controls should have accessible labels', async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })

    // Open node inspector
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.click()
    await expect(page.locator('[aria-label="Node Inspector"]')
      .or(page.locator('[aria-label="Inspector"]'))).toBeVisible({ timeout: 5000 })

    // Scan for label violations
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .options({
        rules: {
          'label': { enabled: true },
          'label-title-only': { enabled: true },
          'form-field-multiple-labels': { enabled: true }
        }
      })
      .analyze()

    const labelViolations = accessibilityScanResults.violations.filter(v =>
      v.id.includes('label')
    )

    expect(labelViolations).toEqual([])
  })

  test('interactive elements should have accessible names', async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })

    // Run analysis
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    // Scan for button/link name violations
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .options({
        rules: {
          'button-name': { enabled: true },
          'link-name': { enabled: true },
          'aria-command-name': { enabled: true }
        }
      })
      .analyze()

    const nameViolations = accessibilityScanResults.violations.filter(v =>
      v.id.includes('name') || v.id.includes('button') || v.id.includes('link')
    )

    expect(nameViolations).toEqual([])
  })

  test('ARIA attributes should be valid and used correctly', async ({ page }) => {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })

    // Run analysis to populate ARIA-rich UI
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
    await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })

    // Scan for ARIA violations
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .options({
        rules: {
          'aria-valid-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
          'aria-allowed-attr': { enabled: true },
          'aria-required-attr': { enabled: true },
          'aria-roles': { enabled: true }
        }
      })
      .analyze()

    const ariaViolations = accessibilityScanResults.violations.filter(v =>
      v.id.startsWith('aria-')
    )

    expect(ariaViolations).toEqual([])
  })
})
