/**
 * PLoT V1 Compare Debug Slices E2E Tests
 *
 * Tests CompareView debug analysis features:
 * - p10/p50/p90 delta display
 * - Top-3 edge chips with highlighting
 * - Cross-run comparison (A vs B)
 * - Accessibility (ARIA labels, keyboard nav, screen reader announcements)
 *
 * Requires: VITE_FEATURE_COMPARE_DEBUG=1
 */

import { test, expect, Page } from '@playwright/test'
import { installFakeEventSource } from './_helpers'

async function gotoPlot(page: Page) {
  await installFakeEventSource(page)

  // Enable feature flags
  await page.addInitScript(() => {
    try { localStorage.setItem('feature.plotStream', '1') } catch {}
    try { localStorage.setItem('feature.compareDebug', '1') } catch {}
    try { localStorage.setItem('feature.compare', '1') } catch {}
    try { localStorage.setItem('feature.runHistory', '1') } catch {}
    ;(window as any).__E2E = 1
  })

  await page.goto('/?e2e=1#/plot', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
}

async function mockStreamingRunWithDebug(page: Page, runId: string, debugData: any) {
  await page.evaluate(({ runId, debugData }) => {
    const FakeES = (window as any).FakeEventSource
    const orig = FakeES
    ;(window as any).EventSource = class extends orig {
      constructor(url: string) {
        super(url)

        setTimeout(() => {
          this.emit('started', { run_id: runId })
        }, 50)

        setTimeout(() => {
          this.emit('complete', {
            result: {
              schema: 'report.v1',
              results: {
                summary: {
                  conservative: 100,
                  likely: 150,
                  optimistic: 200,
                  units: 'units'
                }
              },
              model_card: {
                response_hash: `hash-${runId}`,
                seed: 42,
                confidence: 0.85,
                template_version: '1.0.0'
              },
              explanation: 'Test explanation',
              debug: debugData
            },
            execution_ms: 100
          })
        }, 100)
      }
    }
  }, { runId, debugData })
}

test.describe('PLoT V1 Compare Debug Slices', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPlot(page)
  })

  test('displays p10/p50/p90 deltas for conservative option', async ({ page }) => {
    // Mock first run with debug data
    await mockStreamingRunWithDebug(page, 'run-a', {
      compare: {
        conservative: {
          p10: 90,
          p50: 100,
          p90: 110,
          top3_edges: []
        },
        likely: { p10: 135, p50: 150, p90: 165, top3_edges: [] },
        optimistic: { p10: 180, p50: 200, p90: 220, top3_edges: [] }
      }
    })

    // Trigger first run
    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    // Mock second run with different debug data
    await mockStreamingRunWithDebug(page, 'run-b', {
      compare: {
        conservative: {
          p10: 95,  // +5 delta
          p50: 105, // +5 delta
          p90: 115, // +5 delta
          top3_edges: []
        },
        likely: { p10: 140, p50: 155, p90: 170, top3_edges: [] },
        optimistic: { p10: 185, p50: 205, p90: 225, top3_edges: [] }
      }
    })

    // Trigger second run
    await runBtn.click()
    await page.waitForTimeout(500)

    // Open compare view
    const compareBtn = page.getByTestId('compare-btn').or(page.getByRole('button', { name: /compare/i }))
    await compareBtn.click()

    // Select runs for comparison (A = older, B = newer)
    const selectA = page.getByTestId('compare-select-a')
    const selectB = page.getByTestId('compare-select-b')
    await selectA.selectOption({ index: 1 })  // First run
    await selectB.selectOption({ index: 0 })  // Second run

    // Verify debug analysis section is visible
    const debugSection = page.locator('[data-testid="compare-debug-analysis"]').or(
      page.locator('h3').filter({ hasText: /debug analysis|statistical/i }).locator('..')
    )
    await expect(debugSection).toBeVisible({ timeout: 5000 })

    // Verify delta values for conservative option
    const conservativeSection = debugSection.locator('[data-option="conservative"]').or(
      debugSection.locator('text=Conservative').locator('..')
    )
    await expect(conservativeSection).toContainText('+5')  // p10 delta
    await expect(conservativeSection).toContainText('+5')  // p50 delta
    await expect(conservativeSection).toContainText('+5')  // p90 delta

    // Verify ARIA labels for screen readers
    const p50Delta = conservativeSection.locator('[aria-label*="p50"]').or(
      conservativeSection.locator('[data-metric="p50"]')
    )
    await expect(p50Delta).toHaveAttribute('aria-label', /median.*\+5/i)
  })

  test('displays top-3 edge chips with click-to-highlight', async ({ page }) => {
    // Mock run with top-3 edges
    await mockStreamingRunWithDebug(page, 'run-with-edges', {
      compare: {
        conservative: {
          p10: 90,
          p50: 100,
          p90: 110,
          top3_edges: [
            { edge_id: 'e1', from: 'n1', to: 'n2', label: 'Risk Factor A', weight: 0.8 },
            { edge_id: 'e2', from: 'n2', to: 'n3', label: 'Risk Factor B', weight: 0.6 },
            { edge_id: 'e3', from: 'n3', to: 'n4', label: 'Risk Factor C', weight: 0.4 }
          ]
        },
        likely: { p10: 135, p50: 150, p90: 165, top3_edges: [] },
        optimistic: { p10: 180, p50: 200, p90: 220, top3_edges: [] }
      }
    })

    // Trigger run
    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    // Open compare view (with single run - should show debug for that run)
    const compareBtn = page.getByTestId('compare-btn').or(page.getByRole('button', { name: /compare/i }))
    await compareBtn.click()

    // Verify edge chips are visible
    const edgeChips = page.locator('[data-testid="edge-chip"]').or(
      page.locator('[role="button"]').filter({ hasText: /Risk Factor/i })
    )
    await expect(edgeChips).toHaveCount(3)

    // Verify first chip has correct label and weight
    const chip1 = edgeChips.first()
    await expect(chip1).toContainText('Risk Factor A')
    await expect(chip1).toContainText('0.8')

    // Click chip to highlight edge
    await chip1.click()

    // Verify edge is highlighted on canvas (check for highlight layer or class)
    const highlightLayer = page.locator('[data-testid="highlight-layer"]').or(
      page.locator('.edge-highlight')
    )
    await expect(highlightLayer).toBeVisible({ timeout: 1000 })

    // Verify highlight clears after 2 seconds
    await expect(highlightLayer).not.toBeVisible({ timeout: 3000 })

    // Verify keyboard navigation works
    await chip1.focus()
    await page.keyboard.press('Enter')
    await expect(highlightLayer).toBeVisible({ timeout: 1000 })
  })

  test('cross-run comparison shows correct deltas (A vs B)', async ({ page }) => {
    // Mock first run
    await mockStreamingRunWithDebug(page, 'run-a', {
      compare: {
        conservative: { p10: 90, p50: 100, p90: 110, top3_edges: [] },
        likely: { p10: 135, p50: 150, p90: 165, top3_edges: [] },
        optimistic: { p10: 180, p50: 200, p90: 220, top3_edges: [] }
      }
    })

    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    // Mock second run with significantly different values
    await mockStreamingRunWithDebug(page, 'run-b', {
      compare: {
        conservative: { p10: 100, p50: 120, p90: 130, top3_edges: [] },  // +10, +20, +20
        likely: { p10: 145, p50: 160, p90: 175, top3_edges: [] },  // +10, +10, +10
        optimistic: { p10: 190, p50: 210, p90: 230, top3_edges: [] }  // +10, +10, +10
      }
    })

    await runBtn.click()
    await page.waitForTimeout(500)

    // Open compare view
    const compareBtn = page.getByTestId('compare-btn').or(page.getByRole('button', { name: /compare/i }))
    await compareBtn.click()

    // Select runs for comparison
    const selectA = page.getByTestId('compare-select-a')
    const selectB = page.getByTestId('compare-select-b')
    await selectA.selectOption({ index: 1 })  // run-a
    await selectB.selectOption({ index: 0 })  // run-b

    // Verify conservative deltas
    const conservativeSection = page.locator('[data-option="conservative"]').or(
      page.locator('text=Conservative').locator('..')
    )
    await expect(conservativeSection).toContainText('+20')  // p50 delta: 120 - 100

    // Verify likely deltas
    const likelySection = page.locator('[data-option="likely"]').or(
      page.locator('text=Likely').locator('..')
    )
    await expect(likelySection).toContainText('+10')  // p50 delta: 160 - 150

    // Verify screen reader announcement for comparison update
    const srAnnouncement = page.locator('[role="status"]').filter({ hasText: /comparison updated/i })
    await expect(srAnnouncement).toBeVisible()
  })

  test('accessibility: ARIA labels and keyboard navigation', async ({ page }) => {
    // Mock run with debug data
    await mockStreamingRunWithDebug(page, 'run-a11y', {
      compare: {
        conservative: {
          p10: 90,
          p50: 100,
          p90: 110,
          top3_edges: [
            { edge_id: 'e1', from: 'n1', to: 'n2', label: 'Edge 1', weight: 0.8 }
          ]
        },
        likely: { p10: 135, p50: 150, p90: 165, top3_edges: [] },
        optimistic: { p10: 180, p50: 200, p90: 220, top3_edges: [] }
      }
    })

    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    // Open compare view
    const compareBtn = page.getByTestId('compare-btn').or(page.getByRole('button', { name: /compare/i }))
    await compareBtn.click()

    // Verify debug section has proper landmark role
    const debugSection = page.locator('[role="region"][aria-labelledby*="debug"]').or(
      page.locator('[data-testid="compare-debug-analysis"]')
    )
    await expect(debugSection).toBeVisible()

    // Verify option sections have ARIA labels
    const conservativeSection = page.locator('[aria-label*="Conservative"]').or(
      page.locator('[data-option="conservative"]')
    )
    await expect(conservativeSection).toHaveAttribute('aria-label', /conservative/i)

    // Verify delta values have accessible labels
    const p50Metric = page.locator('[aria-label*="median"]').or(
      page.locator('[data-metric="p50"]')
    )
    await expect(p50Metric).toHaveAttribute('aria-label')

    // Verify edge chips are keyboard accessible
    const edgeChip = page.locator('[data-testid="edge-chip"]').first()
    await expect(edgeChip).toHaveAttribute('role', 'button')
    await expect(edgeChip).toHaveAttribute('tabindex', '0')

    // Test keyboard navigation (Tab to chip, Enter to activate)
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    expect(focused).toBe('edge-chip')

    await page.keyboard.press('Enter')
    // Verify highlight appears
    const highlightLayer = page.locator('[data-testid="highlight-layer"]').or(
      page.locator('.edge-highlight')
    )
    await expect(highlightLayer).toBeVisible({ timeout: 1000 })
  })

  test('Beta badge and tooltip for debug features', async ({ page }) => {
    // Mock run with debug data
    await mockStreamingRunWithDebug(page, 'run-beta', {
      compare: {
        conservative: { p10: 90, p50: 100, p90: 110, top3_edges: [] },
        likely: { p10: 135, p50: 150, p90: 165, top3_edges: [] },
        optimistic: { p10: 180, p50: 200, p90: 220, top3_edges: [] }
      }
    })

    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    // Open compare view
    const compareBtn = page.getByTestId('compare-btn').or(page.getByRole('button', { name: /compare/i }))
    await compareBtn.click()

    // Verify Beta badge is present
    const betaBadge = page.locator('[data-testid="beta-badge"]').or(
      page.locator('text=Beta').or(page.locator('text=BETA'))
    )
    await expect(betaBadge).toBeVisible()

    // Verify tooltip/info icon is present
    const infoIcon = page.locator('[data-testid="debug-info-icon"]').or(
      page.locator('[aria-label*="information"]')
    )
    await expect(infoIcon).toBeVisible()

    // Hover to show tooltip
    await infoIcon.hover()
    const tooltip = page.locator('[role="tooltip"]').or(
      page.locator('[data-testid="tooltip"]')
    )
    await expect(tooltip).toBeVisible({ timeout: 1000 })
    await expect(tooltip).toContainText(/Monte Carlo/i)
  })

  test('handles missing debug data gracefully', async ({ page }) => {
    // Mock run WITHOUT debug data (feature flag off or backend doesn't support)
    await page.evaluate(() => {
      const FakeES = (window as any).FakeEventSource
      const orig = FakeES
      ;(window as any).EventSource = class extends orig {
        constructor(url: string) {
          super(url)

          setTimeout(() => { this.emit('started', { run_id: 'run-no-debug' }) }, 50)
          setTimeout(() => {
            this.emit('complete', {
              result: {
                schema: 'report.v1',
                results: { summary: { conservative: 100, likely: 150, optimistic: 200, units: 'units' } },
                model_card: { response_hash: 'hash-no-debug', seed: 42, confidence: 0.85, template_version: '1.0.0' },
                explanation: 'Test'
                // NO debug field
              },
              execution_ms: 100
            })
          }, 100)
        }
      }
    })

    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    // Open compare view
    const compareBtn = page.getByTestId('compare-btn').or(page.getByRole('button', { name: /compare/i }))
    await compareBtn.click()

    // Verify debug section is NOT shown (graceful degradation)
    const debugSection = page.locator('[data-testid="compare-debug-analysis"]')
    await expect(debugSection).not.toBeVisible()

    // Verify basic compare still works
    const compareView = page.locator('[data-testid="compare-view"]').or(
      page.locator('[role="region"]').filter({ hasText: /compare/i })
    )
    await expect(compareView).toBeVisible()
  })
})
