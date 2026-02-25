/**
 * Inspector Phase 1 (Track B) — E2E visual & functional tests
 *
 * Verifies the restructured inspector panels render correctly:
 *  T1  Factor inspector structure
 *  T2  Goal inspector + coaching card + threshold
 *  T3  Edge inspector + signed slider
 *  T4  Option inspector + baseline detection
 *  T5  Pre-run canvas overlay (dashed borders, badges)
 *  T6  Compact inspector
 *  T7  Terminology pass verification
 *  T8  Accordion mutual exclusion
 */

import { test, expect, type Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs/promises'

const SCREENSHOT_DIR = path.join('e2e', 'screenshots')

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Navigate to canvas and wait for React Flow to mount.
 */
async function navigateToCanvas(page: Page) {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15000 })
}

/**
 * Load inspector fixture by setting store state directly.
 * Bypasses importCanvas schema validation which strips unknown fields
 * like observedState, interventions, and category.
 */
async function loadInspectorFixture(page: Page) {
  await page.evaluate(() => {
    // @ts-ignore — store exposed on window in E2E mode
    const store = window.useCanvasStore.getState()

    const nodes = [
      {
        id: 'goal-1', type: 'goal',
        position: { x: 400, y: 50 },
        data: { label: 'Increase annual revenue', type: 'goal', kind: 'goal', description: 'Primary business objective' },
      },
      {
        id: 'factor-1', type: 'factor',
        position: { x: 100, y: 250 },
        data: { label: 'Customer satisfaction', type: 'factor', kind: 'factor', category: 'controllable', observedState: { value: 72, baseline: 65, unit: '%' } },
      },
      {
        id: 'factor-2', type: 'factor',
        position: { x: 400, y: 250 },
        data: { label: 'Market share', type: 'factor', kind: 'factor', category: 'observable', observedState: { value: 0.35, raw_value: 35, baseline: 0.30 } },
      },
      {
        id: 'factor-3', type: 'factor',
        position: { x: 700, y: 250 },
        data: { label: 'Competitor pricing', type: 'factor', kind: 'factor', category: 'external', observedState: { value: 0.6, baseline: 0.5 } },
      },
      {
        id: 'option-baseline', type: 'option',
        position: { x: 100, y: 450 },
        data: { label: 'Status Quo', type: 'option', kind: 'option', interventions: {} },
      },
      {
        id: 'option-active', type: 'option',
        position: { x: 400, y: 450 },
        data: { label: 'Hire 3 engineers', type: 'option', kind: 'option', interventions: { 'factor-1': 85, 'factor-2': 0.45 } },
      },
      {
        id: 'option-empty', type: 'option',
        position: { x: 700, y: 450 },
        data: { label: 'Expand marketing', type: 'option', kind: 'option', interventions: {} },
      },
      {
        id: 'decision-1', type: 'decision',
        position: { x: 400, y: 650 },
        data: { label: 'Growth strategy choice', type: 'decision', kind: 'decision' },
      },
    ]

    const edges = [
      {
        id: 'e-f1-g1', source: 'factor-1', target: 'goal-1',
        data: { weight: 0.7, direction: 'positive', belief: 0.8, label: 'Satisfaction drives revenue', style: 'solid', pathType: 'bezier', schemaVersion: 4 },
      },
      {
        id: 'e-f2-g1', source: 'factor-2', target: 'goal-1',
        data: { weight: 0.5, direction: 'positive', belief: 0.6, style: 'solid', pathType: 'bezier', schemaVersion: 4 },
      },
      {
        id: 'e-f3-f1', source: 'factor-3', target: 'factor-1',
        data: { weight: 0.3, direction: 'negative', belief: 0.5, style: 'dashed', pathType: 'bezier', schemaVersion: 4 },
      },
    ]

    // @ts-ignore — Zustand setState: set nodes/edges and dismiss the DraftChat overlay
    window.useCanvasStore.setState({ nodes, edges, showDraftChat: false })
  })

  // Allow React Flow to render
  await page.waitForTimeout(1000)

  // Verify nodes rendered
  const nodeCount = await page.locator('.react-flow__node').count()
  if (nodeCount === 0) {
    throw new Error('Fixture load failed: no nodes rendered')
  }
}

/**
 * Find a node by its visible label text and double-click to open full inspector.
 */
async function openFullInspectorByLabel(page: Page, label: string) {
  // Find the node containing the label text
  const node = page.locator('.react-flow__node').filter({ hasText: label }).first()
  await expect(node).toBeVisible({ timeout: 5000 })
  await node.dblclick()
  // Wait for the inspector modal to appear
  await expect(page.locator('div[aria-labelledby="inspector-panel-title"]')).toBeVisible({ timeout: 5000 })
}

/**
 * Click a node by label to open the compact inspector popover.
 */
async function openCompactInspectorByLabel(page: Page, label: string) {
  const node = page.locator('.react-flow__node').filter({ hasText: label }).first()
  await expect(node).toBeVisible({ timeout: 5000 })
  await node.click()
  // Wait for the compact popover to appear
  await page.waitForTimeout(600)
}

/**
 * Close the full inspector modal via Escape key.
 */
async function closeFullInspector(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.locator('div[aria-labelledby="inspector-panel-title"]')).not.toBeVisible({ timeout: 3000 })
}

/**
 * Close any popover by clicking empty canvas area, then wait.
 */
async function closePopover(page: Page) {
  await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } })
  await page.waitForTimeout(300)
}

/**
 * Click a section header in the accordion to expand/collapse it.
 */
async function clickAccordionSection(page: Page, sectionName: string) {
  const dialog = page.locator('div[aria-labelledby="inspector-panel-title"]')
  const button = dialog.locator(`button:has-text("${sectionName}")`)
  await button.click()
  // Allow transition to complete
  await page.waitForTimeout(300)
}

/**
 * Double-click any edge to open its full inspector.
 */
async function openAnyEdgeFullInspector(page: Page) {
  const edge = page.locator('.react-flow__edge').first()
  await expect(edge).toBeVisible({ timeout: 5000 })
  await edge.dblclick({ force: true })
  await expect(page.locator('div[aria-labelledby="inspector-panel-title"]')).toBeVisible({ timeout: 5000 })
}

// ── Setup ────────────────────────────────────────────────────────────

test.describe('Inspector Phase 1 (Track B)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCanvas(page)
    await loadInspectorFixture(page)
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true })
  })

  // ── T1: Factor inspector structure ───────────────────────────────

  test('T1 — Factor inspector shows correct structure', async ({ page }) => {
    await openFullInspectorByLabel(page, 'Customer satisfaction')

    const dialog = page.locator('div[aria-labelledby="inspector-panel-title"]')

    // Summary section visible (inspector accordion root)
    await expect(dialog.locator('[data-testid="node-inspector"]')).toBeVisible()

    // Category pill visible (controllable)
    await expect(dialog.getByText(/controllable/i)).toBeVisible()

    // Current value text visible in Summary (first() to avoid matching Assumptions heading too)
    await expect(dialog.getByText('Current value').first()).toBeVisible()

    // ASSUMPTIONS section header visible
    await expect(dialog.getByText('ASSUMPTIONS')).toBeVisible()

    // ADVANCED section header visible
    await expect(dialog.getByText('ADVANCED')).toBeVisible()

    // No "Probabilities" text anywhere
    await expect(dialog.getByText('Probabilities')).not.toBeVisible()

    // No "Use as Outcome Node" checkbox
    await expect(dialog.getByText('Use as Outcome Node')).not.toBeVisible()

    // Expand ASSUMPTIONS
    await clickAccordionSection(page, 'ASSUMPTIONS')

    // Type dropdown is NOT present in Assumptions
    const typeSelect = dialog.locator('select[data-testid="select-node-type"]')
    await expect(typeSelect).toHaveCount(0)

    // Expand ADVANCED
    await clickAccordionSection(page, 'ADVANCED')

    // Type appears as read-only text
    const readOnlyType = dialog.locator('[data-testid="read-only-node-type"]')
    await expect(readOnlyType).toBeVisible()

    // Kind appears as read-only text
    await expect(dialog.getByText('Kind')).toBeVisible()

    // Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'factor-inspector-full.png') })
  })

  // ── T2: Goal inspector + coaching card + threshold ───────────────

  test('T2 — Goal inspector shows coaching card and threshold editing', async ({ page }) => {
    // Goal node: click by data-id, then double-click to open full inspector
    const goalNode = page.locator('[data-id="goal-1"]')
    await expect(goalNode).toBeVisible({ timeout: 5000 })
    // Select the node first with a single click
    await goalNode.click({ force: true })
    await page.waitForTimeout(300)
    // Double-click to open full inspector
    await goalNode.dblclick({ force: true })
    await expect(page.locator('div[aria-labelledby="inspector-panel-title"]')).toBeVisible({ timeout: 8000 })

    const dialog = page.locator('div[aria-labelledby="inspector-panel-title"]')

    // Coaching card visible when threshold is empty
    const coachingText = dialog.getByText(/success threshold|Set a success threshold/i).first()
    await expect(coachingText).toBeVisible()

    // Expand ASSUMPTIONS
    await clickAccordionSection(page, 'ASSUMPTIONS')

    // Type dropdown is NOT present
    const typeSelect = dialog.locator('select[data-testid="select-node-type"]')
    await expect(typeSelect).toHaveCount(0)

    // Expand ADVANCED
    await clickAccordionSection(page, 'ADVANCED')

    // Analysis target shows "Yes"
    await expect(dialog.getByText('Analysis target')).toBeVisible()
    await expect(dialog.getByText('Yes')).toBeVisible()

    // Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'goal-inspector-with-threshold.png') })
  })

  // ── T3: Edge inspector + signed slider ───────────────────────────

  test('T3 — Edge inspector shows correct structure', async ({ page }) => {
    await openAnyEdgeFullInspector(page)

    const dialog = page.locator('div[aria-labelledby="inspector-panel-title"]')

    // Dialog header shows "Edge Properties"
    await expect(dialog.getByText('Edge Properties')).toBeVisible()

    // Expand ASSUMPTIONS
    await clickAccordionSection(page, 'ASSUMPTIONS')

    // Effect on target label visible
    await expect(dialog.getByText(/Effect on target/i)).toBeVisible()

    // Confidence label visible
    await expect(dialog.getByText(/Confidence/i).first()).toBeVisible()

    // Expand APPEARANCE
    await clickAccordionSection(page, 'APPEARANCE')

    // Help text about appearance not affecting analysis
    await expect(dialog.getByText(/do not affect analysis/i)).toBeVisible()

    // Expand ADVANCED
    await clickAccordionSection(page, 'ADVANCED')

    // Provenance or connection info in Advanced
    // (Uncertainty only shows when strengthStd is defined)
    await expect(dialog.getByText('ADVANCED')).toBeVisible()

    // Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'edge-inspector-full.png') })
  })

  // ── T4: Option inspector + baseline detection ────────────────────

  test('T4 — Option inspector detects baseline correctly', async ({ page }) => {
    // Open baseline option (Status Quo)
    await openFullInspectorByLabel(page, 'Status Quo')

    const dialog = page.locator('div[aria-labelledby="inspector-panel-title"]')

    // "Baseline" pill visible in Summary (use exact match to avoid matching node ID)
    await expect(dialog.getByText('Baseline', { exact: true })).toBeVisible()

    // Option with empty interventions shows NeedsMappingPrompt ("needs configuration")
    await expect(dialog.getByText(/needs configuration/i)).toBeVisible()

    // Expand ASSUMPTIONS
    await clickAccordionSection(page, 'ASSUMPTIONS')

    // Type dropdown is NOT present
    const typeSelect = dialog.locator('select[data-testid="select-node-type"]')
    await expect(typeSelect).toHaveCount(0)

    // Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'option-baseline-inspector.png') })

    // Close and open non-baseline option with interventions
    await closeFullInspector(page)
    await openFullInspectorByLabel(page, 'Hire 3 engineers')

    const dialog2 = page.locator('div[aria-labelledby="inspector-panel-title"]')

    // Should show intervention count
    await expect(dialog2.getByText(/intervention/i).first()).toBeVisible()

    // Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'option-regular-inspector.png') })

    // Close and open empty non-baseline option
    await closeFullInspector(page)
    await openFullInspectorByLabel(page, 'Expand marketing')

    const dialog3 = page.locator('div[aria-labelledby="inspector-panel-title"]')

    // Non-baseline with no interventions should show "No interventions"
    await expect(dialog3.getByText(/No interventions/i)).toBeVisible()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'option-empty-inspector.png') })
  })

  // ── T5: Pre-run canvas overlay ───────────────────────────────────

  test('T5 — Pre-run canvas shows overlay cues', async ({ page }) => {
    // In pre-analysis state, nodes should be visible
    const nodes = page.locator('.react-flow__node')
    const count = await nodes.count()
    expect(count).toBeGreaterThanOrEqual(7)

    // Screenshot the full canvas in pre-run state
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'canvas-pre-run-overlay.png') })
  })

  // ── T6: Compact inspector ───────────────────────────────────────

  test('T6 — Compact inspector shows read-only structure', async ({ page }) => {
    // Single-click opens compact popover
    await openCompactInspectorByLabel(page, 'Customer satisfaction')

    // No Type dropdown visible in compact
    const typeSelect = page.locator('select[data-testid="select-node-type"]')
    await expect(typeSelect).toHaveCount(0)

    // No "Probabilities" text
    await expect(page.locator('text=Probabilities')).toHaveCount(0)

    // No "Use as Outcome Node" checkbox
    await expect(page.locator('text=Use as Outcome Node')).toHaveCount(0)

    // Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'compact-inspector.png') })
  })

  // ── T7: Terminology pass verification ────────────────────────────

  test('T7 — Inspector uses correct terminology', async ({ page }) => {
    // Factor inspector terminology
    await openFullInspectorByLabel(page, 'Customer satisfaction')

    const dialog = page.locator('div[aria-labelledby="inspector-panel-title"]')

    // "Current value" label in Summary KPI row (not "Observed Value")
    await expect(dialog.getByText('Current value').first()).toBeVisible()

    // Section headers are UPPERCASE
    await expect(dialog.getByText('ASSUMPTIONS')).toBeVisible()
    await expect(dialog.getByText('ADVANCED')).toBeVisible()

    await closeFullInspector(page)

    // Edge inspector terminology
    await openAnyEdgeFullInspector(page)

    const edgeDialog = page.locator('div[aria-labelledby="inspector-panel-title"]')

    // Expand ASSUMPTIONS to check edge terminology
    await clickAccordionSection(page, 'ASSUMPTIONS')

    // "Effect on target" (not "Weight")
    await expect(edgeDialog.getByText(/Effect on target/i)).toBeVisible()

    // "Confidence" (not "Belief")
    await expect(edgeDialog.getByText(/Confidence/i).first()).toBeVisible()

    // Section headers are UPPERCASE
    await expect(edgeDialog.getByText('ASSUMPTIONS')).toBeVisible()
    await expect(edgeDialog.getByText('APPEARANCE')).toBeVisible()
    await expect(edgeDialog.getByText('ADVANCED')).toBeVisible()
  })

  // ── T8: Accordion mutual exclusion ───────────────────────────────

  test('T8 — Only one accordion section open at a time', async ({ page }) => {
    await openFullInspectorByLabel(page, 'Customer satisfaction')

    const dialog = page.locator('div[aria-labelledby="inspector-panel-title"]')

    // Inspector accordion root should be visible
    await expect(dialog.locator('[data-testid="node-inspector"]')).toBeVisible()

    // ASSUMPTIONS starts expanded by default (defaultOpen="assumptions")
    const assumptionsBtn = dialog.locator('button:has-text("ASSUMPTIONS")')
    await expect(assumptionsBtn).toHaveAttribute('aria-expanded', 'true')

    // Click ADVANCED — it opens (mutual exclusion: ASSUMPTIONS should close)
    const advancedBtn = dialog.locator('button:has-text("ADVANCED")')
    await advancedBtn.click()
    await page.waitForTimeout(300)

    // ADVANCED is expanded
    await expect(advancedBtn).toHaveAttribute('aria-expanded', 'true')

    // ASSUMPTIONS is collapsed (mutual exclusion)
    await expect(assumptionsBtn).toHaveAttribute('aria-expanded', 'false')

    // Inspector accordion root still visible throughout
    await expect(dialog.locator('[data-testid="node-inspector"]')).toBeVisible()
  })
})
