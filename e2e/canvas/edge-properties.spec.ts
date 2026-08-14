/**
 * Canvas Edge Properties — E2E editing & undo/redo tests
 *
 * Verifies the relationship (edge) inspector a user actually loads:
 *  T1  The live edge inspector opens and renders its editing surface
 *  T2  A strength-band edit writes the SELECTED edge, and only that edge
 *  T3  Undo reverts the strength edit; redo reapplies it
 *  T4  The existence readout reflects the edge's own value, not a default
 *
 * ─────────────────────────────────────────────────────────────────────
 * REPAIRED 2026-08-14 — this spec previously drove TWO dead surfaces.
 *
 * 1. THE INSPECTOR. It selected `[aria-label="Edge properties"]`, which
 *    exists ONLY at `src/canvas/ui/EdgeInspector.tsx:562` — the legacy v1
 *    edge inspector. `InspectorModal.tsx:16` hardcodes
 *    `const USE_INSPECTOR_V2 = true` and returns from the v2 branch at line
 *    159, so the v1 markup below it NEVER RENDERS. The only other importer
 *    of the v1 `EdgeInspector` is `PropertiesPanel.tsx`, which has zero
 *    product import sites and is itself dead. Measured in the running UI:
 *    `[aria-label="Edge properties"]` resolves to 0 elements, while the
 *    contrast control `.react-flow__edge-interaction` resolves to 2 — a real
 *    absence, not a blind selector.
 *
 * 2. THE GRAPH SETUP. It built its graph by clicking toolbar buttons
 *    `+ Node` and `Add Decision`. Neither exists as a button: the only
 *    `+ Node` strings in src are DraftChat help copy and a debug-tab label,
 *    and the only "Add Decision" is the CommandPalette entry "Add Decision
 *    Node". The drag-to-connect that followed therefore had nothing to
 *    connect. The fixture below sets store state directly instead, which is
 *    deterministic and keeps the test on its actual subject: edge properties.
 *
 * The properties it then tried to edit (`input[type="range"]` weight, a
 * `solid|dashed|dotted` style `<select>`, a free-text label) are v1 fields
 * with no v2 equivalent. The v2 panel's edit affordances, derived from the
 * running UI, are the four strength bands, a fine-tune slider, and the
 * existence control.
 *
 * Bindings are by IDENTITY — exact aria-label, exact data-testid, exact
 * edge `data-id` — never a value predicate another element could satisfy
 * (an earlier defect class in this suite). Store assertions read the edge
 * BY ID, and every mutation test asserts an untouched CONTROL edge is
 * unchanged, so an edit that lands on the wrong edge fails loudly.
 *
 * Every expectation was DERIVED from the running v2 UI at staging tip
 * 6571387d (evidence: olumi-docs/PHASE0-EVIDENCE-2026-07-28/
 * edge-properties-e2e-repair-2026-08-14/), not from reading the source.
 * ─────────────────────────────────────────────────────────────────────
 */

import { test, expect, type Page, type Locator } from '@playwright/test'

/** The edge inspector dialog, bound by its EXACT aria-label (InspectorModal.tsx:170-172). */
const EDGE_INSPECTOR = 'div[role="dialog"][aria-label="Edge inspector"]'

/** The InspectorShell that renders the panel body inside the dialog (InspectorShell.tsx:60-61). */
const INSPECTOR_SHELL = '[role="region"][aria-label="Inspector panel"]'

/** The dead v1 surface. Must resolve to nothing anywhere in the product. */
const DEAD_V1_EDGE_INSPECTOR = '[aria-label="Edge properties"]'

/** The edge this spec edits, and an untouched control edge, both bound by id. */
const EDGE_UNDER_TEST = 'e-f1-g1'
const CONTROL_EDGE = 'e-f2-g1'

/**
 * Fixture values, stated once so the assertions below cannot drift from them.
 *
 * `beliefExists` is deliberately 0.8 — a NON-DEFAULT value. `EdgePanel`
 * falls back to `EDGE_CONSTRAINTS.beliefExists.default` (0.7) when the field
 * is absent, so a panel that stopped reading the edge would still render a
 * plausible "70%". Pinning 0.8 means T4 REDs on that fallback.
 *
 * Note `beliefExists` is NOT the same field as `belief`: the v2 panel reads
 * only `beliefExists` (EdgePanel.tsx:195). A fixture that sets `belief`
 * alone renders the 0.7 default — measured, and the reason this file states
 * the field explicitly.
 */
const INITIAL_WEIGHT = 0.7          // → "Very strong" band (>= 0.70)
const INITIAL_BELIEF_EXISTS = 0.8   // → "80%" readout
const CONTROL_WEIGHT = 0.5
/** Midpoint the "Moderate" band writes (StrengthBandButtons.tsx:26). */
const MODERATE_MIDPOINT = 0.3

type EdgeState = {
  weight: number | undefined
  weightSource: string | undefined
  canUndo: boolean
  canRedo: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────

async function navigateToCanvas(page: Page) {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30000 })
}

/**
 * Load the edge fixture by setting store state directly. Bypasses
 * importCanvas schema validation, which strips unknown fields.
 */
async function loadEdgeFixture(page: Page) {
  await page.evaluate(
    ({ edgeUnderTest, controlEdge, weight, beliefExists, controlWeight }) => {
      const nodes = [
        {
          id: 'goal-1', type: 'goal',
          position: { x: 400, y: 50 },
          data: { label: 'Increase annual revenue', type: 'goal', kind: 'goal' },
        },
        {
          id: 'factor-1', type: 'factor',
          position: { x: 100, y: 250 },
          data: { label: 'Customer satisfaction', type: 'factor', kind: 'factor', category: 'controllable' },
        },
        {
          id: 'factor-2', type: 'factor',
          position: { x: 400, y: 250 },
          data: { label: 'Market share', type: 'factor', kind: 'factor', category: 'observable' },
        },
      ]

      const edges = [
        {
          id: edgeUnderTest, source: 'factor-1', target: 'goal-1',
          data: { weight, direction: 'positive', beliefExists, style: 'solid', pathType: 'bezier', schemaVersion: 4 },
        },
        {
          id: controlEdge, source: 'factor-2', target: 'goal-1',
          data: { weight: controlWeight, direction: 'positive', style: 'solid', pathType: 'bezier', schemaVersion: 4 },
        },
      ]

      // @ts-ignore — Zustand setState (store.ts:5636 exposes this for E2E)
      window.useCanvasStore.setState({ nodes, edges, showDraftChat: false })
    },
    {
      edgeUnderTest: EDGE_UNDER_TEST,
      controlEdge: CONTROL_EDGE,
      weight: INITIAL_WEIGHT,
      beliefExists: INITIAL_BELIEF_EXISTS,
      controlWeight: CONTROL_WEIGHT,
    },
  )

  await page.waitForTimeout(1000)

  // Assert THIS fixture's own edges are rendered, by id. A bare count would
  // pass on somebody else's graph; identity binding will not.
  for (const id of [EDGE_UNDER_TEST, CONTROL_EDGE]) {
    await expect(
      page.locator(`.react-flow__edge[data-id="${id}"]`),
      `fixture edge ${id} should be rendered`,
    ).toHaveCount(1, { timeout: 10000 })
  }
}

/**
 * Minimise the floating Olumi conversation panel.
 *
 * `FloatingOlumiPanel` mounts only ONCE A GRAPH EXISTS, so this must run
 * AFTER the fixture load. While open it covers the canvas and intercepts
 * pointer events, so every edge click times out.
 */
async function dismissFloatingOlumiPanel(page: Page) {
  const minimise = page.getByTestId('floating-olumi-panel-minimise')
  if (await minimise.count() > 0) {
    await minimise.click()
    await expect(page.getByTestId('floating-olumi-panel')).toBeHidden({ timeout: 5000 })
  }
}

/**
 * Open a specific edge's inspector BY EDGE ID. A single click on the
 * interaction layer opens it; a forced dblclick does not.
 */
async function openEdgeInspector(page: Page, edgeId: string): Promise<Locator> {
  await page
    .locator(`.react-flow__edge[data-id="${edgeId}"] .react-flow__edge-interaction`)
    .click({ timeout: 15000 })

  const dialog = page.locator(EDGE_INSPECTOR)
  await expect(dialog).toBeVisible({ timeout: 5000 })
  // The shell inside the dialog renders the panel body. Asserting it
  // separately means a dialog that mounts EMPTY still fails.
  await expect(dialog.locator(INSPECTOR_SHELL)).toBeVisible({ timeout: 5000 })
  return dialog
}

/** Read one edge's persisted state from the store, BY ID. */
function readEdgeState(page: Page, edgeId: string): Promise<EdgeState> {
  return page.evaluate((id) => {
    // @ts-ignore
    const state = window.useCanvasStore.getState()
    const edge = state.edges.find((e: { id: string }) => e.id === id)
    return {
      weight: edge?.data?.weight,
      weightSource: edge?.data?.weightSource,
      canUndo: state.canUndo(),
      canRedo: state.canRedo(),
    }
  }, edgeId)
}

/** Assert exactly one strength band is active, and that it is `expected`. */
async function expectActiveBand(dialog: Locator, expected: string) {
  for (const band of ['slight', 'moderate', 'strong', 'very-strong']) {
    await expect(
      dialog.getByTestId(`strength-band-${band}`),
      `band ${band} pressed state`,
    ).toHaveAttribute('aria-pressed', String(band === expected))
  }
}

// ── Setup ────────────────────────────────────────────────────────────

test.describe('Canvas Edge Properties', () => {
  test.beforeEach(async ({ page }) => {
    // A cold Vite dev server compiles on demand; 30s is not enough for the
    // first test and produces a RED unrelated to these assertions.
    test.setTimeout(90_000)
    await navigateToCanvas(page)
    await loadEdgeFixture(page)
    await dismissFloatingOlumiPanel(page)
  })

  // ── T1: the live inspector opens with its editing surface ────────

  test('T1 — edge inspector opens and renders the relationship editing surface', async ({ page }) => {
    const dialog = await openEdgeInspector(page, EDGE_UNDER_TEST)

    // The relationship is named by its endpoints — proves the panel is
    // bound to THIS edge, not merely that some inspector opened.
    await expect(dialog.getByText('Relationship')).toBeVisible()
    await expect(dialog.getByText('Customer satisfaction → Increase annual revenue')).toBeVisible()

    // Strength editing: the question and all four bands, by exact test id.
    await expect(dialog.getByText('How strong is this effect?')).toBeVisible()
    for (const band of ['slight', 'moderate', 'strong', 'very-strong']) {
      await expect(dialog.getByTestId(`strength-band-${band}`)).toBeVisible()
    }
    await expect(dialog.getByText('Fine-tune')).toBeVisible()

    // Existence editing: the question, its readout, and the uncertainty band.
    await expect(dialog.getByText('Does this connection exist?')).toBeVisible()
    await expect(dialog.getByTestId('edge-existence-readout')).toBeVisible()
    // Decorative overlay bar (aria-hidden, zero intrinsic width) — it has no
    // bounding box, so attachment is the honest assertion here.
    await expect(dialog.getByTestId('uncertainty-band')).toBeAttached()

    // The dead v1 inspector must not be what we are driving — anywhere.
    await expect(page.locator(DEAD_V1_EDGE_INSPECTOR)).toHaveCount(0)
    // v1 terminology must not return.
    await expect(dialog.getByText('APPEARANCE')).toHaveCount(0)
  })

  // ── T2: a strength edit writes the selected edge, and only it ─────

  test('T2 — strength band edit writes the selected edge and is scoped to it', async ({ page }) => {
    const dialog = await openEdgeInspector(page, EDGE_UNDER_TEST)

    // Weight 0.7 lands in the "Very strong" band (>= 0.70).
    await expectActiveBand(dialog, 'very-strong')

    const before = await readEdgeState(page, EDGE_UNDER_TEST)
    expect(before.weight).toBe(INITIAL_WEIGHT)
    expect(before.weightSource).toBeUndefined()

    await dialog.getByTestId('strength-band-moderate').click()

    // The UI reflects the new band…
    await expectActiveBand(dialog, 'moderate')

    // …and the edit reached the model, on the edge we selected, stamped as
    // user-authored. Bound by edge id, so an edit landing elsewhere fails.
    await expect
      .poll(async () => (await readEdgeState(page, EDGE_UNDER_TEST)).weight)
      .toBe(MODERATE_MIDPOINT)
    const after = await readEdgeState(page, EDGE_UNDER_TEST)
    expect(after.weightSource).toBe('user')

    // The untouched control edge is unchanged — proves scoping rather than
    // "some edge in the graph changed".
    const control = await readEdgeState(page, CONTROL_EDGE)
    expect(control.weight).toBe(CONTROL_WEIGHT)
    expect(control.weightSource).toBeUndefined()
  })

  // ── T3: undo reverts the edit, redo reapplies it ─────────────────

  test('T3 — undo reverts the strength edit and redo reapplies it', async ({ page }) => {
    const dialog = await openEdgeInspector(page, EDGE_UNDER_TEST)
    await dialog.getByTestId('strength-band-moderate').click()

    await expect
      .poll(async () => (await readEdgeState(page, EDGE_UNDER_TEST)).weight)
      .toBe(MODERATE_MIDPOINT)
    expect((await readEdgeState(page, EDGE_UNDER_TEST)).canUndo).toBe(true)

    // Undo. `updateEdge` pushes history (store.ts:1940), and the keyboard
    // handler (useKeyboardShortcuts.ts:40) is mounted by ReactFlowGraph.
    await page.keyboard.press('Meta+z')

    await expect
      .poll(async () => (await readEdgeState(page, EDGE_UNDER_TEST)).weight)
      .toBe(INITIAL_WEIGHT)
    const undone = await readEdgeState(page, EDGE_UNDER_TEST)
    // The user-authored stamp is reverted too, not just the number.
    expect(undone.weightSource).toBeUndefined()
    expect(undone.canRedo).toBe(true)

    // Selection is part of the history snapshot, so undo also closes the
    // inspector. Asserted because it is the behaviour, not an accident.
    await expect(page.locator(EDGE_INSPECTOR)).toHaveCount(0)

    // Redo restores both the value and the selection.
    await page.keyboard.press('Meta+Shift+z')

    await expect
      .poll(async () => (await readEdgeState(page, EDGE_UNDER_TEST)).weight)
      .toBe(MODERATE_MIDPOINT)
    expect((await readEdgeState(page, EDGE_UNDER_TEST)).weightSource).toBe('user')

    const reopened = page.locator(EDGE_INSPECTOR)
    await expect(reopened).toBeVisible({ timeout: 5000 })
    await expectActiveBand(reopened, 'moderate')

    // The control edge survived the whole undo/redo cycle untouched.
    expect((await readEdgeState(page, CONTROL_EDGE)).weight).toBe(CONTROL_WEIGHT)
  })

  // ── T4: the existence readout reflects this edge's own value ─────

  test('T4 — existence readout reflects the edge value, not the default', async ({ page }) => {
    const dialog = await openEdgeInspector(page, EDGE_UNDER_TEST)

    // 80% is the fixture's beliefExists. The panel's fallback is 70%, so a
    // panel that stopped reading this edge would render 70% and fail here.
    await expect(dialog.getByTestId('edge-existence-readout')).toHaveText('80%')

    // The control edge sets no beliefExists, so it shows the 0.7 default —
    // a second, DIFFERENT expected value. An instrument that has stopped
    // discriminating cannot produce two different answers.
    await page.keyboard.press('Escape')
    await expect(page.locator(EDGE_INSPECTOR)).toHaveCount(0, { timeout: 5000 })

    const controlDialog = await openEdgeInspector(page, CONTROL_EDGE)
    await expect(controlDialog.getByText('Market share → Increase annual revenue')).toBeVisible()
    await expect(controlDialog.getByTestId('edge-existence-readout')).toHaveText('70%')
  })
})
