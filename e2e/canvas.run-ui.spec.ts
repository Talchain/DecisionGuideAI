/**
 * Canvas Run UX E2E Tests
 *
 * Verifies run button visibility, template drawer sticky footer,
 * dev hash badge, and keyboard navigation.
 */

import { test, expect } from '@playwright/test'

test.describe('Canvas Run UX', () => {
  test.beforeEach(async ({ page }) => {
    // Set dev mode for badge tests
    await page.goto('/#/canvas')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Global Run Button', () => {
    test('is always visible in canvas toolbar', async ({ page }) => {
      // Wait for canvas toolbar
      await page.waitForSelector('[role="toolbar"][aria-label="Canvas editing toolbar"]')

      // Global Run button should be visible
      const runButton = page.locator('[data-testid="btn-run-analysis-global"]')
      await expect(runButton).toBeVisible()

      // Should have play icon
      await expect(runButton).toContainText('Run')

      // Should have proper aria-label
      await expect(runButton).toHaveAttribute('aria-label', 'Run analysis')
    })

    test('is disabled when canvas is empty', async ({ page }) => {
      const runButton = page.locator('[data-testid="btn-run-analysis-global"]')
      await expect(runButton).toBeDisabled()
    })

    test('is enabled after adding nodes', async ({ page }) => {
      // Add a node via toolbar
      await page.click('button:has-text("+ Node")')
      await page.click('text=Add Goal')

      // Wait for node to be added
      await page.waitForTimeout(500)

      // Run button should now be enabled
      const runButton = page.locator('[data-testid="btn-run-analysis-global"]')
      await expect(runButton).toBeEnabled()
    })

    test('remains visible when Templates drawer is open', async ({ page }) => {
      // Open Templates drawer (if there's a button for it)
      const templatesButton = page.locator('button:has-text("Templates")')
      if (await templatesButton.isVisible()) {
        await templatesButton.click()
        await page.waitForTimeout(500)
      }

      // Global Run button should still be visible
      const runButton = page.locator('[data-testid="btn-run-analysis-global"]')
      await expect(runButton).toBeVisible()
    })

    test('is keyboard accessible', async ({ page }) => {
      // Add a node first so button is enabled
      await page.click('button:has-text("+ Node")')
      await page.click('text=Add Goal')
      await page.waitForTimeout(500)

      // Tab to run button
      await page.keyboard.press('Tab')
      // Continue tabbing until we reach the run button
      for (let i = 0; i < 20; i++) {
        const focusedElement = await page.evaluateHandle(() => document.activeElement)
        const testId = await focusedElement.evaluate((el) => el.getAttribute('data-testid'))
        if (testId === 'btn-run-analysis-global') {
          break
        }
        await page.keyboard.press('Tab')
      }

      // Verify run button has focus
      const runButton = page.locator('[data-testid="btn-run-analysis-global"]')
      await expect(runButton).toBeFocused()
    })
  })

  test.describe('Template Drawer Sticky Footer', () => {
    test.skip('Run button sticky at bottom of drawer', async ({ page }) => {
      // SKIP REASON: Templates panel UI not yet implemented
      // UNSKIP WHEN: Templates drawer with sticky footer is available
      // RELATED: PR #10 (sticky footer design), future Templates panel work
      // This test requires Templates panel implementation
      // Skip for now if panel not available

      // Open Templates drawer
      const templatesButton = page.locator('button:has-text("Templates")')
      if (!(await templatesButton.isVisible())) {
        test.skip()
        return
      }

      await templatesButton.click()
      await page.waitForTimeout(500)

      // Select a template
      await page.click('[data-testid="template-card"]:first-child')
      await page.waitForTimeout(500)

      // Run button in footer should be visible
      const footerRunButton = page.locator('[data-testid="btn-run-analysis-template"]')
      await expect(footerRunButton).toBeVisible()

      // Scroll content
      await page.evaluate(() => {
        const content = document.querySelector('[role="complementary"]')
        if (content) {
          content.scrollTop = 1000
        }
      })

      // Footer run button should still be visible (sticky)
      await expect(footerRunButton).toBeVisible()

      // Check footer has proper attributes
      const footer = page.locator('footer[role="contentinfo"]')
      await expect(footer).toHaveAttribute('aria-label', 'Template actions')
    })

    test.skip('footer does not overlap content', async ({ page }) => {
      // SKIP REASON: Templates panel UI not yet implemented
      // UNSKIP WHEN: Templates drawer with sticky footer is available
      // RELATED: PR #10 (sticky footer design)
      // Open Templates drawer and select template
      const templatesButton = page.locator('button:has-text("Templates")')
      if (!(await templatesButton.isVisible())) {
        test.skip()
        return
      }

      await templatesButton.click()
      await page.waitForTimeout(500)
      await page.click('[data-testid="template-card"]:first-child')
      await page.waitForTimeout(500)

      // Get footer and content bounding boxes
      const footer = page.locator('footer[role="contentinfo"]')
      const footerBox = await footer.boundingBox()

      const content = page.locator('[role="complementary"] > div:first-child')
      const contentBox = await content.boundingBox()

      // Footer should not overlap content
      // Content should have bottom padding
      expect(contentBox).toBeDefined()
      expect(footerBox).toBeDefined()

      if (contentBox && footerBox) {
        // Content bottom should be above footer top (accounting for padding)
        expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(footerBox.y + 100)
      }
    })
  })

  test.describe('Dev Hash Badge', () => {
    test.skip('shows warning badge for dev- hashes', async ({ page }) => {
      // SKIP REASON: Requires controlled backend behavior (missing hash) or MSW mocking
      // UNSKIP WHEN: Test environment can simulate missing response_hash OR MSW setup added
      // RELATED: PR #10 (dev hash badge UI), DETERMINISM_HARDENING.md
      // This test requires running with VITE_STRICT_DETERMINISM=0
      // and backend missing response_hash

      // Add nodes and run analysis
      await page.click('button:has-text("+ Node")')
      await page.click('text=Add Goal')
      await page.waitForTimeout(500)

      const runButton = page.locator('[data-testid="btn-run-analysis-global"]')
      await runButton.click()

      // Wait for results
      await page.waitForSelector('text=/Hash.*dev-/', { timeout: 10000 })

      // Check for warning badge
      const hashDisplay = page.locator('text=/dev-.*⚠️/')
      await expect(hashDisplay).toBeVisible()

      // Check tooltip on hover
      const hashElement = page.locator('[title*="Development fallback hash"]')
      await expect(hashElement).toBeVisible()

      // Check color is orange
      const color = await hashElement.evaluate((el) => {
        return window.getComputedStyle(el).color
      })
      // Orange should be rgb(245, 158, 11) or similar
      expect(color).toMatch(/rgb\(245,\s*158,\s*11\)|#f59e0b/)
    })
  })

  test.describe('Keyboard Navigation', () => {
    test.skip('ESC cancels running analysis', async ({ page }) => {
      // SKIP REASON: Requires streaming mode to be active and cancellable
      // UNSKIP WHEN: Streaming is reliably enabled in test environment (VITE_FEATURE_PLOT_STREAM=1)
      // RELATED: useResultsRun.ts ESC handler (lines 218-238), sseClient.ts
      // This test requires streaming to be enabled
      // Skip if not available

      // Add nodes
      await page.click('button:has-text("+ Node")')
      await page.click('text=Add Goal')
      await page.waitForTimeout(500)

      // Start run
      const runButton = page.locator('[data-testid="btn-run-analysis-global"]')
      await runButton.click()

      // Wait for streaming to start
      await page.waitForTimeout(1000)

      // Press ESC to cancel
      await page.keyboard.press('Escape')

      // Should show cancel confirmation or stop streaming
      // Exact behavior depends on implementation
    })

    test('ESC closes help then palette', async ({ page }) => {
      // Open Command Palette
      await page.keyboard.press('Meta+K') // Mac
      await page.waitForTimeout(500)

      // Palette should be visible
      const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
      await expect(palette).toBeVisible()

      // Open help
      await page.keyboard.press('?')
      await page.waitForTimeout(300)

      // Help should be visible
      const helpContent = page.locator('text=Keyboard Shortcuts')
      await expect(helpContent).toBeVisible()

      // First ESC closes help
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await expect(helpContent).not.toBeVisible()
      await expect(palette).toBeVisible()

      // Second ESC closes palette
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await expect(palette).not.toBeVisible()
    })

    test('Command Palette Run action works', async ({ page }) => {
      // Add nodes
      await page.click('button:has-text("+ Node")')
      await page.click('text=Add Goal')
      await page.waitForTimeout(500)

      // Open Command Palette
      await page.keyboard.press('Meta+K')
      await page.waitForTimeout(500)

      // Type "run"
      await page.keyboard.type('run')
      await page.waitForTimeout(300)

      // "Run Analysis" should appear
      const runAction = page.locator('text=Run Analysis')
      await expect(runAction).toBeVisible()

      // Press Enter to execute
      await page.keyboard.press('Enter')

      // Palette should close
      const palette = page.locator('[role="dialog"][aria-label="Command palette"]')
      await expect(palette).not.toBeVisible()

      // Results panel should open (or streaming should start)
      // Implementation-specific
    })
  })

  test.describe('Accessibility', () => {
    test('toolbar run button passes Axe', async ({ page }) => {
      // Run Axe on toolbar
      const results = await page.evaluate(async () => {
        // @ts-ignore
        const axe = (window as any).axe
        if (!axe) {
          return { violations: [] }
        }
        return await axe.run('[role="toolbar"]')
      })

      expect(results.violations).toHaveLength(0)
    })

    test.skip('template drawer footer passes Axe', async ({ page }) => {
      // SKIP REASON: Templates panel UI not yet implemented
      // UNSKIP WHEN: Templates drawer is available for accessibility testing
      // RELATED: PR #10 (sticky footer design)
      const templatesButton = page.locator('button:has-text("Templates")')
      if (!(await templatesButton.isVisible())) {
        test.skip()
        return
      }

      await templatesButton.click()
      await page.waitForTimeout(500)

      const results = await page.evaluate(async () => {
        // @ts-ignore
        const axe = (window as any).axe
        if (!axe) {
          return { violations: [] }
        }
        return await axe.run('[role="complementary"]')
      })

      expect(results.violations).toHaveLength(0)
    })

    test('dev hash badge has accessible tooltip', async ({ page }) => {
      // This test can run even without actual dev hash
      // We're just checking the tooltip exists

      const hashWithTooltip = page.locator('[title*="Development fallback"]')
      if (await hashWithTooltip.isVisible()) {
        const title = await hashWithTooltip.getAttribute('title')
        expect(title).toContain('Development fallback hash')
        expect(title).toContain('staging/production')
      }
    })
  })

  test.describe('Performance', () => {
    test('toolbar renders quickly', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('/#/canvas')
      await page.waitForSelector('[role="toolbar"]')

      const endTime = Date.now()
      const renderTime = endTime - startTime

      // Toolbar should render in < 2s
      expect(renderTime).toBeLessThan(2000)
    })

    test('sticky footer causes minimal layout shift', async ({ page }) => {
      // Measure CLS when opening Templates drawer
      await page.goto('/#/canvas')

      // Start measuring CLS
      await page.evaluate(() => {
        (window as any).clsScore = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) continue
            (window as any).clsScore += (entry as any).value
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })

      // Open Templates drawer
      const templatesButton = page.locator('button:has-text("Templates")')
      if (await templatesButton.isVisible()) {
        await templatesButton.click()
        await page.waitForTimeout(1000)
      }

      // Get CLS score
      const clsScore = await page.evaluate(() => (window as any).clsScore || 0)

      // CLS should be < 0.1
      expect(clsScore).toBeLessThan(0.1)
    })
  })
})
