/**
 * PLoT V1 EdgeInspector Debug Facts E2E Tests
 *
 * Tests EdgeInspector debug facts table features:
 * - Weight, belief, provenance display
 * - Default values (belief=1.0, provenance=template)
 * - Beta badge and tooltips
 * - "Edit probabilities" CTA functionality
 * - Accessibility (ARIA labels, keyboard nav, screen reader support)
 *
 * Requires: VITE_FEATURE_INSPECTOR_DEBUG=1
 */

import { test, expect, Page } from '@playwright/test'
import { installFakeEventSource } from './_helpers'

async function gotoPlot(page: Page) {
  await installFakeEventSource(page)

  // Enable feature flags
  await page.addInitScript(() => {
    try { localStorage.setItem('feature.plotStream', '1') } catch {}
    try { localStorage.setItem('feature.inspectorDebug', '1') } catch {}
    ;(window as any).__E2E = 1
  })

  await page.goto('/?e2e=1#/plot', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
}

async function mockStreamingRunWithInspector(page: Page, inspectorData: any) {
  await page.evaluate(({ inspectorData }) => {
    const FakeES = (window as any).FakeEventSource
    const orig = FakeES
    ;(window as any).EventSource = class extends orig {
      constructor(url: string) {
        super(url)

        setTimeout(() => {
          this.emit('started', { run_id: 'test-inspector' })
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
                response_hash: 'hash-inspector',
                seed: 42,
                confidence: 0.85,
                template_version: '1.0.0'
              },
              explanation: 'Test explanation',
              debug: {
                inspector: inspectorData
              }
            },
            execution_ms: 100
          })
        }, 100)
      }
    }
  }, { inspectorData })
}

async function openEdgeInspector(page: Page, edgeId: string = 'e1') {
  // Click on an edge to open inspector
  // Note: Adjust selector based on actual canvas implementation
  const edge = page.locator(`[data-edge-id="${edgeId}"]`).or(
    page.locator('[data-testid="canvas-edge"]').first()
  )
  await edge.click()

  // Wait for inspector panel to open
  const inspector = page.locator('[data-testid="edge-inspector"]').or(
    page.locator('[role="dialog"]').filter({ hasText: /edge|properties/i })
  )
  await expect(inspector).toBeVisible({ timeout: 5000 })
}

test.describe('PLoT V1 EdgeInspector Debug Facts', { tag: '@debug-inspector' }, () => {
  test.beforeEach(async ({ page }) => {
    await gotoPlot(page)
  })

  test('displays edge facts table with weight, belief, provenance', async ({ page }) => {
    // Mock run with inspector debug data
    await mockStreamingRunWithInspector(page, {
      edges: [
        {
          edge_id: 'e1',
          from: 'n1',
          to: 'n2',
          label: 'Risk Factor A',
          weight: 0.85,
          belief: 0.95,
          provenance: 'calibrated'
        }
      ]
    })

    // Trigger run
    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    // Open edge inspector
    await openEdgeInspector(page, 'e1')

    // Verify debug facts table is visible
    const factsTable = page.locator('[data-testid="edge-facts-table"]').or(
      page.locator('table').filter({ has: page.locator('text=/weight|belief|provenance/i') })
    )
    await expect(factsTable).toBeVisible()

    // Verify weight value
    const weightCell = factsTable.locator('td').filter({ hasText: '0.85' })
    await expect(weightCell).toBeVisible()

    // Verify belief value
    const beliefCell = factsTable.locator('td').filter({ hasText: '0.95' })
    await expect(beliefCell).toBeVisible()

    // Verify provenance value
    const provenanceCell = factsTable.locator('td').filter({ hasText: 'calibrated' })
    await expect(provenanceCell).toBeVisible()
  })

  test('displays default values for missing fields', async ({ page }) => {
    // Mock run with minimal inspector data (no belief or provenance)
    await mockStreamingRunWithInspector(page, {
      edges: [
        {
          edge_id: 'e1',
          from: 'n1',
          to: 'n2',
          label: 'Edge 1',
          weight: 0.75
          // belief and provenance omitted
        }
      ]
    })

    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    await openEdgeInspector(page, 'e1')

    // Verify default belief (1.0)
    const beliefCell = page.locator('td').filter({ hasText: '1.00' })
    await expect(beliefCell).toBeVisible()

    // Verify default provenance (template)
    const provenanceCell = page.locator('td').filter({ hasText: 'template' })
    await expect(provenanceCell).toBeVisible()
  })

  test('Beta badge and tooltips for debug facts', async ({ page }) => {
    // Mock run with inspector data
    await mockStreamingRunWithInspector(page, {
      edges: [
        {
          edge_id: 'e1',
          from: 'n1',
          to: 'n2',
          label: 'Edge 1',
          weight: 0.75,
          belief: 0.9,
          provenance: 'template'
        }
      ]
    })

    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    await openEdgeInspector(page, 'e1')

    // Verify Beta badge is present
    const betaBadge = page.locator('[data-testid="beta-badge"]').or(
      page.locator('text=Beta').or(page.locator('text=BETA'))
    )
    await expect(betaBadge).toBeVisible()

    // Verify info icons with tooltips
    const weightInfo = page.locator('[aria-label*="weight"]').filter({ has: page.locator('[data-testid="info-icon"]') })
    await weightInfo.hover()

    const tooltip = page.locator('[role="tooltip"]').or(page.locator('[data-testid="tooltip"]'))
    await expect(tooltip).toBeVisible({ timeout: 1000 })
    await expect(tooltip).toContainText(/edge strength/i)

    // Test belief tooltip
    const beliefInfo = page.locator('[aria-label*="belief"]').filter({ has: page.locator('[data-testid="info-icon"]') })
    await beliefInfo.hover()
    await expect(tooltip).toContainText(/confidence/i)

    // Test provenance tooltip
    const provenanceInfo = page.locator('[aria-label*="provenance"]').filter({ has: page.locator('[data-testid="info-icon"]') })
    await provenanceInfo.hover()
    await expect(tooltip).toContainText(/source/i)
  })

  test('"Edit probabilities" CTA selects source node', async ({ page }) => {
    // Mock run with inspector data
    await mockStreamingRunWithInspector(page, {
      edges: [
        {
          edge_id: 'e1',
          from: 'n1',
          to: 'n2',
          label: 'Edge 1',
          weight: 0.75,
          belief: 0.9,
          provenance: 'template'
        }
      ]
    })

    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    await openEdgeInspector(page, 'e1')

    // Find "Edit probabilities" button
    const editBtn = page.getByRole('button', { name: /edit probabilit/i })
    await expect(editBtn).toBeVisible()

    // Click the button
    await editBtn.click()

    // Verify inspector closes
    const inspector = page.locator('[data-testid="edge-inspector"]')
    await expect(inspector).not.toBeVisible({ timeout: 2000 })

    // Verify source node (n1) is selected
    const selectedNode = page.locator('[data-node-id="n1"][data-selected="true"]').or(
      page.locator('[data-node-id="n1"].selected')
    )
    await expect(selectedNode).toBeVisible({ timeout: 1000 })

    // Verify screen reader announcement
    const srAnnouncement = page.locator('[role="status"]').filter({ hasText: /selected/i })
    await expect(srAnnouncement).toBeVisible()
  })

  test('accessibility: ARIA labels and table structure', async ({ page }) => {
    // Mock run with inspector data
    await mockStreamingRunWithInspector(page, {
      edges: [
        {
          edge_id: 'e1',
          from: 'n1',
          to: 'n2',
          label: 'Edge 1',
          weight: 0.75,
          belief: 0.9,
          provenance: 'calibrated'
        }
      ]
    })

    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    await openEdgeInspector(page, 'e1')

    // Verify table has proper structure
    const factsTable = page.locator('[data-testid="edge-facts-table"]').or(
      page.locator('table').filter({ has: page.locator('text=/weight|belief/i') })
    )

    // Verify table has caption or aria-label
    const tableCaption = factsTable.locator('caption').or(
      page.locator('[aria-labelledby*="edge-facts"]')
    )
    await expect(tableCaption).toBeVisible()

    // Verify table rows have proper th elements
    const weightHeader = factsTable.locator('th').filter({ hasText: /weight/i })
    await expect(weightHeader).toBeVisible()

    const beliefHeader = factsTable.locator('th').filter({ hasText: /belief/i })
    await expect(beliefHeader).toBeVisible()

    const provenanceHeader = factsTable.locator('th').filter({ hasText: /provenance/i })
    await expect(provenanceHeader).toBeVisible()

    // Verify values are announced by screen readers
    const weightCell = factsTable.locator('td').filter({ hasText: '0.75' })
    const weightAria = await weightCell.getAttribute('aria-label')
    expect(weightAria).toBeTruthy()  // Should have descriptive ARIA label

    // Verify "Edit probabilities" button is keyboard accessible
    const editBtn = page.getByRole('button', { name: /edit probabilit/i })
    await expect(editBtn).toHaveAttribute('tabindex', '0')

    // Test keyboard navigation
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.textContent)
    expect(focused).toContain('Edit')

    // Press Enter to activate
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-testid="edge-inspector"]')).not.toBeVisible({ timeout: 2000 })
  })

  test('handles missing debug data gracefully', async ({ page }) => {
    // Mock run WITHOUT inspector debug data
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

    await openEdgeInspector(page, 'e1')

    // Verify debug facts table is NOT shown (graceful degradation)
    const factsTable = page.locator('[data-testid="edge-facts-table"]')
    await expect(factsTable).not.toBeVisible()

    // Verify basic inspector still works
    const inspector = page.locator('[data-testid="edge-inspector"]')
    await expect(inspector).toBeVisible()

    // Verify standard edge properties are shown
    const weightSlider = page.locator('[data-testid="weight-slider"]').or(
      page.locator('input[type="range"]')
    )
    await expect(weightSlider).toBeVisible()
  })

  test('multiple edges show correct facts for each edge', async ({ page }) => {
    // Mock run with multiple edges
    await mockStreamingRunWithInspector(page, {
      edges: [
        {
          edge_id: 'e1',
          from: 'n1',
          to: 'n2',
          label: 'Edge 1',
          weight: 0.75,
          belief: 0.9,
          provenance: 'template'
        },
        {
          edge_id: 'e2',
          from: 'n2',
          to: 'n3',
          label: 'Edge 2',
          weight: 0.60,
          belief: 0.85,
          provenance: 'calibrated'
        }
      ]
    })

    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    // Open inspector for first edge
    await openEdgeInspector(page, 'e1')
    const factsTable = page.locator('[data-testid="edge-facts-table"]')
    await expect(factsTable).toContainText('0.75')  // weight for e1
    await expect(factsTable).toContainText('template')  // provenance for e1

    // Close inspector
    const closeBtn = page.getByRole('button', { name: /close/i }).or(
      page.locator('[data-testid="close-inspector"]')
    )
    await closeBtn.click()

    // Open inspector for second edge
    await openEdgeInspector(page, 'e2')
    await expect(factsTable).toContainText('0.60')  // weight for e2
    await expect(factsTable).toContainText('calibrated')  // provenance for e2
    await expect(factsTable).not.toContainText('template')  // should not show e1 data
  })

  test('keyboard shortcut "P" after selection opens probabilities panel', async ({ page }) => {
    // Mock run with inspector data
    await mockStreamingRunWithInspector(page, {
      edges: [
        {
          edge_id: 'e1',
          from: 'n1',
          to: 'n2',
          label: 'Edge 1',
          weight: 0.75,
          belief: 0.9,
          provenance: 'template'
        }
      ]
    })

    const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
    await runBtn.click()
    await page.waitForTimeout(500)

    await openEdgeInspector(page, 'e1')

    // Verify hint text mentions "P" keyboard shortcut
    const hintText = page.locator('text=/press.*P.*after selecting/i')
    await expect(hintText).toBeVisible()

    // Click "Edit probabilities" to select node
    const editBtn = page.getByRole('button', { name: /edit probabilit/i })
    await editBtn.click()

    // Verify node is selected
    await page.waitForTimeout(500)

    // Press "P" key
    await page.keyboard.press('p')

    // Verify probabilities panel opens
    const probPanel = page.locator('[data-testid="probabilities-panel"]').or(
      page.locator('[role="dialog"]').filter({ hasText: /probabilit/i })
    )
    await expect(probPanel).toBeVisible({ timeout: 2000 })
  })
})
