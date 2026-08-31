/**
 * Inspector Phase 1 (Track B) — E2E visual & functional tests
 *
 * Verifies the inspector panels a user actually loads:
 *  T1  Factor inspector structure
 *  T2  Goal inspector + progress checklist + threshold prompt
 *  T3  Edge (relationship) inspector + strength bands
 *  T4  Option inspector + baseline detection
 *  T5  Pre-run canvas overlay (dashed borders, badges)
 *  T6  Single-click opens full inspector (S.1)
 *  T7  Terminology pass verification
 *  T8  Inspector content is scoped to the selected element
 *
 * ─────────────────────────────────────────────────────────────────────
 * REPAIRED 2026-08-14 — this spec previously selected the DEAD v1 inspector.
 *
 * `InspectorModal.tsx` hardcodes `const USE_INSPECTOR_V2 = true` (line 16) and
 * returns from the v2 branch at line 159, so the legacy v1 markup below it —
 * including `aria-labelledby="inspector-panel-title"` (line 197) — NEVER
 * RENDERS. The only other importer of the v1 `NodeInspector`/`EdgeInspector`
 * is `PropertiesPanel.tsx`, which has zero import sites and is itself dead.
 *
 * Every selector here therefore binds to what the v2 path actually renders:
 *   · outer dialog  role="dialog" aria-label="Node inspector" | "Edge inspector"
 *                   (InspectorModal.tsx:170-172)
 *   · inner shell   role="region" aria-label="Inspector panel"
 *                   (InspectorShell.tsx:60-61)
 *
 * Bindings are by IDENTITY (exact aria-label, exact data-id, exact
 * data-testid) — never a value predicate another element could satisfy — and
 * every test asserts on RENDERED CONTENT, so an inspector that mounts but
 * renders nothing fails just as loudly as one that never mounts.
 *
 * All expectations below were DERIVED from the running v2 UI at staging tip
 * 9c75be0b (evidence: olumi-docs/PHASE0-EVIDENCE-2026-07-28/
 * inspector-e2e-repair-2026-08-14/04-v2-content-derivation.txt), not from
 * reading the source.
 * ─────────────────────────────────────────────────────────────────────
 */

import { test, expect, type Page, type Locator } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs/promises'
import { DECISION_NODE_LABEL } from '../src/canvas/domain/vocabulary'

const SCREENSHOT_DIR = path.join('e2e', 'screenshots')

/**
 * The two inspector dialogs, bound by their EXACT aria-label.
 *
 * These are the identity anchors for the whole spec. If `InspectorModal`'s
 * `aria-label` is removed or renamed, every test here fails — which is the
 * point: the previous selector matched nothing and the suite could not tell.
 */
const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const EDGE_INSPECTOR = 'div[role="dialog"][aria-label="Edge inspector"]'
const ANY_INSPECTOR = `${NODE_INSPECTOR}, ${EDGE_INSPECTOR}`

/** The InspectorShell that renders the panel body inside the dialog. */
const INSPECTOR_SHELL = '[role="region"][aria-label="Inspector panel"]'

/** The eight nodes the fixture loads, by id — asserted individually (identity). */
const FIXTURE_NODE_IDS = [
  'goal-1', 'factor-1', 'factor-2', 'factor-3',
  'option-baseline', 'option-active', 'option-empty', 'decision-1',
] as const

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Navigate to canvas and wait for React Flow to mount.
 */
async function navigateToCanvas(page: Page) {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30000 })
}

/**
 * Load inspector fixture by setting store state directly.
 * Bypasses importCanvas schema validation which strips unknown fields
 * like observedState, interventions, and category.
 */
async function loadInspectorFixture(page: Page) {
  await page.evaluate(() => {
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
      {
        id: 'e-no-confidence', source: 'option-active', target: 'factor-2',
        data: { weight: 0.4, direction: 'positive', style: 'solid', pathType: 'bezier', schemaVersion: 4 },
      },
    ]

    // @ts-ignore — Zustand setState: set nodes/edges and dismiss the DraftChat overlay
    window.useCanvasStore.setState({ nodes, edges, showDraftChat: false })
  })

  // Allow React Flow to render
  await page.waitForTimeout(1000)

  // Assert THIS fixture's own nodes are present, by id. A bare count would
  // pass on somebody else's graph; identity binding will not (trap 19).
  for (const id of FIXTURE_NODE_IDS) {
    await expect(
      page.locator(`.react-flow__node[data-id="${id}"]`),
      `fixture node ${id} should be rendered`,
    ).toHaveCount(1, { timeout: 10000 })
  }
}

/**
 * Minimise the floating Olumi conversation panel.
 *
 * `FloatingOlumiPanel` mounts only ONCE A GRAPH EXISTS, so this must run
 * AFTER the fixture load. While open it covers the canvas centre and
 * intercepts pointer events, so every node click times out.
 */
async function dismissFloatingOlumiPanel(page: Page) {
  const minimise = page.getByTestId('floating-olumi-panel-minimise')
  if (await minimise.count() > 0) {
    await minimise.click()
    await expect(page.getByTestId('floating-olumi-panel')).toBeHidden({ timeout: 5000 })
  }
}

/**
 * Open a node's inspector by node id and return the dialog locator.
 * Single click opens the full inspector (S.1).
 */
async function openNodeInspector(page: Page, nodeId: string): Promise<Locator> {
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click({ timeout: 15000 })
  const dialog = page.locator(NODE_INSPECTOR)
  await expect(dialog).toBeVisible({ timeout: 5000 })
  // The shell inside the dialog is what renders the panel body. Asserting it
  // separately means a dialog that mounts EMPTY still fails.
  await expect(dialog.locator(INSPECTOR_SHELL)).toBeVisible({ timeout: 5000 })
  return dialog
}

/**
 * Open the relationship (edge) inspector and return the dialog locator.
 * The interaction layer is the clickable surface for an edge.
 */
async function openEdgeInspector(page: Page): Promise<Locator> {
  await page.locator('.react-flow__edge-interaction').first().click({ timeout: 15000 })
  const dialog = page.locator(EDGE_INSPECTOR)
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await expect(dialog.locator(INSPECTOR_SHELL)).toBeVisible({ timeout: 5000 })
  return dialog
}

/**
 * Close whichever inspector is open and prove it went away.
 */
async function closeInspector(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.locator(ANY_INSPECTOR)).toHaveCount(0, { timeout: 5000 })
}

// ── Setup ────────────────────────────────────────────────────────────

test.describe('Inspector Phase 1 (Track B)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCanvas(page)
    await loadInspectorFixture(page)
    await dismissFloatingOlumiPanel(page)
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true })
  })

  // ── T1: Factor inspector structure ───────────────────────────────

  test('T1 — Factor inspector shows correct structure', async ({ page }) => {
    const dialog = await openNodeInspector(page, 'factor-1')

    // Header identifies THIS factor (identity, not "some node is open")
    await expect(dialog.getByRole('button', { name: 'Customer satisfaction' })).toBeVisible()

    // Controllable factors are introduced as user-editable
    await expect(dialog.getByText('You can change this')).toBeVisible()

    // Core sections of the v2 factor panel
    await expect(dialog.getByText('Context')).toBeVisible()
    await expect(dialog.getByText('Your input')).toBeVisible()
    await expect(dialog.getByText('Connections')).toBeVisible()

    // The connection to the goal is named, with its strength state
    await expect(dialog.getByText('Increase annual revenue')).toBeVisible()
    await expect(dialog.getByTestId('connection-row-strength-not-set').first()).toBeVisible()

    // The v1 accordion is gone — these must NOT reappear under the v2 panel
    await expect(dialog.getByText('ASSUMPTIONS')).toHaveCount(0)
    await expect(dialog.locator('select[data-testid="select-node-type"]')).toHaveCount(0)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'factor-inspector-full.png') })
  })

  // ── T2: Goal inspector + progress checklist + threshold prompt ───

  test('T2 — Goal inspector shows progress checklist and threshold prompt', async ({ page }) => {
    const dialog = await openNodeInspector(page, 'goal-1')

    await expect(dialog.getByRole('button', { name: 'Increase annual revenue' })).toBeVisible()
    await expect(dialog.getByText('Goal', { exact: true })).toBeVisible()

    // Readiness checklist, and the unset-threshold state it reports
    await expect(dialog.getByTestId('goal-progress-checklist')).toBeVisible()
    await expect(dialog.getByText('Threshold not set yet')).toBeVisible()

    // The threshold editor and its explanatory copy
    await expect(dialog.getByText('Success means reaching')).toBeVisible()
    await expect(dialog.getByText(/reaching or exceeding this target/i)).toBeVisible()
    await expect(dialog.getByText(/unlocks probability calculations/i)).toBeVisible()

    // Constraints affordance
    await expect(dialog.getByTestId('add-constraint-button')).toBeVisible()

    // Inbound drivers are listed
    await expect(dialog.getByText('What drives this')).toBeVisible()
    await expect(dialog.getByText('Customer satisfaction')).toBeVisible()
    await expect(dialog.getByText('Market share')).toBeVisible()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'goal-inspector-with-threshold.png') })
  })

  // ── T3: Edge (relationship) inspector + strength bands ───────────

  test('T3 — Edge inspector shows correct structure', async ({ page }) => {
    const dialog = await openEdgeInspector(page)

    // The relationship is named by its endpoints
    await expect(dialog.getByText('Relationship')).toBeVisible()
    await expect(dialog.getByText('Customer satisfaction → Increase annual revenue')).toBeVisible()

    // Strength question + all four bands, bound by their exact test ids
    await expect(dialog.getByText('How strong is this effect?')).toBeVisible()
    for (const band of ['slight', 'moderate', 'strong', 'very-strong']) {
      await expect(dialog.getByTestId(`strength-band-${band}`)).toBeVisible()
    }

    // Existence question + its readout and uncertainty band
    await expect(dialog.getByText('Does this connection exist?')).toBeVisible()
    await expect(dialog.getByTestId('edge-existence-readout')).toBeVisible()
    // Decorative overlay bar (aria-hidden, zero intrinsic width) — it has no
    // bounding box, so attachment is the honest assertion here, not visibility.
    await expect(dialog.getByTestId('uncertainty-band')).toBeAttached()

    // E.1/E.2: APPEARANCE section and StrengthBar stay removed
    await expect(dialog.getByText('APPEARANCE')).toHaveCount(0)
    await expect(dialog.getByTestId('strength-bar')).toHaveCount(0)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'edge-inspector-full.png') })
  })

  // ── T4: Option inspector + baseline detection ────────────────────

  test('T4 — Option inspector detects baseline correctly', async ({ page }) => {
    // Baseline option (no interventions)
    const baseline = await openNodeInspector(page, 'option-baseline')
    await expect(baseline.getByRole('button', { name: 'Status Quo' })).toBeVisible()
    await expect(baseline.getByTestId('option-baseline-badge')).toBeVisible()
    await expect(baseline.getByText('Baseline option')).toBeVisible()
    await expect(baseline.getByText("This option doesn't change any factors yet")).toBeVisible()
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'option-baseline-inspector.png') })

    // Non-baseline option WITH interventions: each change is named and quantified
    await closeInspector(page)
    const active = await openNodeInspector(page, 'option-active')
    await expect(active.getByRole('button', { name: 'Hire 3 engineers' })).toBeVisible()
    // Not a baseline — the badge must be absent here
    await expect(active.getByTestId('option-baseline-badge')).toHaveCount(0)
    await expect(active.getByText('What this option changes')).toBeVisible()
    await expect(active.getByRole('button', { name: 'Customer satisfaction' })).toBeVisible()
    await expect(active.getByRole('button', { name: 'Market share' })).toBeVisible()
    await expect(active.getByText('Currently: 72 %')).toBeVisible()
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'option-regular-inspector.png') })

    // Non-baseline option with NO interventions
    await closeInspector(page)
    const empty = await openNodeInspector(page, 'option-empty')
    await expect(empty.getByRole('button', { name: 'Expand marketing' })).toBeVisible()
    await expect(empty.getByTestId('option-baseline-badge')).toHaveCount(0)
    await expect(empty.getByText("This option doesn't change any factors yet")).toBeVisible()
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'option-empty-inspector.png') })
  })

  // ── T5: Pre-run canvas overlay ───────────────────────────────────

  test('T5 — Pre-run canvas shows overlay cues', async ({ page }) => {
    // Goal node has no threshold → incomplete wrapper on the goal
    // (BaseNode.tsx:240 emits `overlay-missing-threshold-node` for goals).
    // NOTE: the separate "?" badge `overlay-missing-threshold` this spec used
    // to assert no longer exists anywhere in src — it was removed from the
    // product, so asserting it would be asserting a deleted feature.
    await expect(page.locator('[data-testid="overlay-missing-threshold-node"]').first()).toBeVisible()

    // Decision node has no outgoing edges → incomplete wrapper
    await expect(page.locator('[data-testid="overlay-missing-value"]').first()).toBeVisible()

    // Edge e-no-confidence has no belief/beliefExists → hitbox marker
    await expect(page.locator('[data-testid="overlay-missing-confidence"]').first()).toBeAttached()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'canvas-pre-run-overlay.png') })
  })

  // ── T6: Single-click opens full inspector (S.1) ────────────────

  test('T6 — Single-click opens full inspector', async ({ page }) => {
    // S.1: a SINGLE click opens the full inspector, not a compact popover
    await page.locator('.react-flow__node[data-id="factor-1"]').click({ timeout: 15000 })

    const dialog = page.locator(NODE_INSPECTOR)
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.locator(INSPECTOR_SHELL)).toBeVisible()

    // It is the FULL panel: header, body sections and connections all present
    await expect(dialog.getByRole('button', { name: 'Customer satisfaction' })).toBeVisible()
    await expect(dialog.getByText('Context')).toBeVisible()
    await expect(dialog.getByText('Connections')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close inspector' })).toBeVisible()

    // No compact popover rendered. The InspectorPopover / NodeInspectorCompact /
    // EdgeInspectorCompact files were deleted entirely in the Polish 4 follow-up
    // (Phase 2 / S.1 removed the routing; the orphaned chain lingered until
    // the post-polish cleanup). This assertion stays as a regression guard —
    // if anyone reintroduces a compact popover under this test id, it fails.
    await expect(page.locator('[data-testid="inspector-popover"]')).toHaveCount(0)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'single-click-full-inspector.png') })
  })

  // ── T7: Terminology pass verification ────────────────────────────

  test('T7 — Inspector uses correct terminology', async ({ page }) => {
    // Factor: plain-language framing, no v1 jargon
    const factor = await openNodeInspector(page, 'factor-1')
    await expect(factor.getByText('You can change this')).toBeVisible()
    await expect(factor.getByText('Your input')).toBeVisible()
    await expect(factor.getByText('Probabilities')).toHaveCount(0)
    await expect(factor.getByText('Use as Outcome Node')).toHaveCount(0)
    await expect(factor.getByText('Observed Value')).toHaveCount(0)

    await closeInspector(page)

    // Edge: "Relationship", and questions rather than field names
    const edge = await openEdgeInspector(page)
    await expect(edge.getByText('Relationship')).toBeVisible()
    await expect(edge.getByText('How strong is this effect?')).toBeVisible()
    await expect(edge.getByText('Does this connection exist?')).toBeVisible()
    // v1 terminology must not return
    await expect(edge.getByText('Edge Properties')).toHaveCount(0)
    await expect(edge.getByText('APPEARANCE')).toHaveCount(0)
    await expect(edge.getByText('Belief', { exact: true })).toHaveCount(0)
  })

  // ── T8: Inspector content is scoped to the selected element ──────

  test('T8 — Inspector content follows the selected element', async ({ page }) => {
    // Open the decision node: its own affordance is present…
    const decision = await openNodeInspector(page, 'decision-1')
    await expect(decision.getByRole('button', { name: 'Growth strategy choice' })).toBeVisible()
    // The TYPE pill, read from the vocabulary constant. `exact: true` means a
    // literal here breaks the moment the word changes — and it would break as a
    // TIMEOUT deep in a journey spec, which is the most expensive way to learn
    // about a rename.
    await expect(decision.getByText(DECISION_NODE_LABEL, { exact: true })).toBeVisible()
    await expect(decision.getByTestId('decision-add-option')).toBeVisible()

    // …and switching to a factor REPLACES the content rather than adding to it.
    await closeInspector(page)
    const factor = await openNodeInspector(page, 'factor-3')
    await expect(factor.getByRole('button', { name: 'Competitor pricing' })).toBeVisible()
    // The decision's affordance must be gone — proves the panel re-rendered
    // for the new selection instead of leaving stale content on screen.
    await expect(factor.getByTestId('decision-add-option')).toHaveCount(0)
    await expect(factor.getByRole('button', { name: 'Growth strategy choice' })).toHaveCount(0)

    // Switching from a node to an EDGE swaps the dialog identity entirely.
    await closeInspector(page)
    const edge = await openEdgeInspector(page)
    await expect(edge.getByText('Relationship')).toBeVisible()
    await expect(page.locator(NODE_INSPECTOR)).toHaveCount(0)
  })
})
