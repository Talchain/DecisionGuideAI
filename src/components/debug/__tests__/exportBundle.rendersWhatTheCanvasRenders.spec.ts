/**
 * ⭐ THE DEBUG BUNDLE MUST RESOLVE A FACTOR THE SAME WAY THE CANVAS DOES.
 *
 * ## The defect, measured on Paul's manual test of 20 Sep 2026 (bundle 478129ba)
 *
 * All four factors came back `influence_displayed: null,
 * influence_source: "unmatched"` while the canvas plainly drew
 * `Relative influence … 22% / 33% / 60% / 100%` on the same four cards. Asked
 * where a number on screen came from, the bundle answered "nothing was
 * displayed".
 *
 * ## Why
 *
 * `FactorNode` reads `useNodeDisplayMetadata`, which keys rows through the
 * SHARED driver policy feed. That feed's key is `getFactorKey` →
 * `normaliseFactorFields`, whose documented priority is
 *
 *     node_id > factor_id > id > normalised(label)
 *
 * `captureDisplayState`'s private `matchFactor` checked only `factor_id` and
 * the normalised label. A row carrying `node_id` (or `id`) and no `factor_id`
 * therefore MATCHES on the canvas and MISSES in the export.
 *
 * This is the exact private-feed defect `useNodeDisplayMetadata` was already
 * repaired for — its own comment records it: *"read THE shared row feed … a
 * PRIVATE factor_sensitivity-only feed … flipped coverage to complete for the
 * canvas and left it incomplete for the panel."* The export kept the private
 * feed. CLAUDE.md trap 12: derive from the one resolver, never restate it.
 *
 * ## Why it matters more than a debug field usually would
 *
 * This bundle is the instrument Paul tests with. A silent `unmatched` does not
 * read as "the export cannot see it" — it reads as "the product displayed
 * nothing", which is a different and false claim about the product. It sent
 * this session to four wrong conclusions in one sitting.
 *
 * ## ⚠ WHAT THIS DOES **NOT** FIX, STATED SO NOBODY INHERITS A FALSE ALL-CLEAR
 *
 * The key RULE is repaired here. The FEED is not. `captureDisplayState` sources
 * `factor_sensitivity` from `state.rawV2Response` (falling back to the
 * CEE-embedded enrichment), while `FactorNode` reads
 * `selectDriverPolicyFeed(report)` — a different collection over more sources.
 * So a board whose metrics reach the card through a source neither of this
 * function's two feeds carries will still export `unmatched` with the key rule
 * corrected.
 *
 * That divergence is the deeper root cause and it is deliberately NOT changed
 * here: this function's tri-state provenance contract
 * (`rawV2Response` / `cee_embedded` / `unmatched`) is reasoned at length at its
 * read site and pinned by `exportBundle.factorScienceJoin.spec.ts`, and
 * swapping its source rewrites that contract for every existing consumer. It
 * needs its own change with its own review, not a rider on this one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface MockCanvasState {
  nodes: Array<{ id: string; type?: string; data: Record<string, unknown> }>
  edges: Array<{ id: string }>
  rawV2Response?: Record<string, unknown> | null
  results: { status: string; report?: unknown } | null
  ceeAnalysisReady: { status?: string } | null
  graphEditedSinceLastRun: boolean
  showResultsPanel?: boolean
  showInspectorPanel?: boolean
  showDraftChat?: boolean
}

let mockState: MockCanvasState
let mockUi: { activeOutputTab: string; pendingModelTabSection: string | null }

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: { getState: () => mockState },
}))
vi.mock('@/stores/uiStore', () => ({
  useUIStore: { getState: () => mockUi },
}))

async function importCapture() {
  const mod = await import('../utils/exportBundle')
  return mod.captureDisplayState
}

/** The node the canvas draws, and the one every assertion below binds to BY ID. */
const NODE_ID = '965fa729'
const NODE_LABEL = 'Team Delivery Velocity'
/** A second factor, present so a pass cannot come from "the only row wins". */
const OTHER_ID = '94190ed9'
const OTHER_LABEL = 'Onboarding Time'

/**
 * ⭐⭐ THE WIRE LABEL IS NOT THE CANVAS LABEL, AND WITHOUT THAT THIS SUITE
 * PROVES NOTHING — caught by a mutant, not by reading it.
 *
 * The first cut gave the wire rows the SAME `factor_label` as the node's
 * `data.label`, so the OLD matcher still matched them by label and restoring
 * the shipped defect left all eight tests GREEN. A corpus that shares the
 * code's blind spot cannot see the code's defect (CLAUDE.md trap 22b).
 *
 * The divergence is the product's own: the canvas label is a DISPLAY
 * truncation with the `(0-1, …)` encoding notation stripped
 * (`InspectorRouter` records this about `rawLabel`), while the wire carries it.
 * So the label arm legitimately misses and `node_id` is the only thing that can
 * resolve the row — which is exactly the case the old matcher could not see.
 */
const WIRE_LABEL = 'Team Delivery Velocity (0-1, higher is faster)'
const OTHER_WIRE_LABEL = 'Onboarding Time (months, lower is better)'

function factorNode(id: string, label: string) {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label, kind: 'factor' } }
}

/**
 * The RAW V2 wire response — `state.rawV2Response`, which is where this
 * function sources `factor_sensitivity` from (see the comment at its read
 * site: the V5 mapper narrows `report.factor_sensitivity` and drops
 * `influence_score`, so a report-only read would miss the metric).
 *
 * Its rows key on `node_id` and carry NO `factor_id` — the shape the canonical
 * resolver ranks FIRST and the shape the export's private matcher never looked
 * at.
 */
function rawV2KeyedOnNodeId() {
  return {
    factor_sensitivity: [
      { node_id: NODE_ID, factor_label: WIRE_LABEL, influence_score: 1.0, sensitivity_score: 0.5 },
      { node_id: OTHER_ID, factor_label: OTHER_WIRE_LABEL, influence_score: 0.6, sensitivity_score: 0.3 },
    ],
  }
}

function makeState(overrides: Partial<MockCanvasState> = {}): MockCanvasState {
  return {
    nodes: [factorNode(NODE_ID, NODE_LABEL), factorNode(OTHER_ID, OTHER_LABEL)],
    edges: [],
    rawV2Response: rawV2KeyedOnNodeId(),
    results: { status: 'complete', report: { option_probabilities: {} } },
    ceeAnalysisReady: { status: 'ready' },
    graphEditedSinceLastRun: false,
    ...overrides,
  }
}

const findFactor = (r: Awaited<ReturnType<Awaited<ReturnType<typeof importCapture>>>>, id: string) =>
  (r.rendered_factors ?? []).find(f => f.id === id)

describe('the export resolves a factor the way the canvas does', () => {
  beforeEach(() => {
    vi.resetModules()
    mockState = makeState()
    mockUi = { activeOutputTab: 'diagnostics', pendingModelTabSection: 'factors' }
  })

  it('POSITIVE CONTROL — both factor nodes reach the render record at all', async () => {
    const capture = await importCapture()
    const r = await capture()
    expect(r.rendered_factors).toHaveLength(2)
    expect(findFactor(r, NODE_ID)?.label_displayed).toBe(NODE_LABEL)
    expect(findFactor(r, OTHER_ID)?.label_displayed).toBe(OTHER_LABEL)
  })

  it('reports the influence the canvas draws, for a row keyed on node_id', async () => {
    const capture = await importCapture()
    const r = await capture()
    const subject = findFactor(r, NODE_ID)
    expect(subject?.influence_displayed).toBe(1.0)
    expect(subject?.influence_source).not.toBe('unmatched')
    // IDENTITY, not "some factor had a number" (trap 19).
    expect(findFactor(r, OTHER_ID)?.influence_displayed).toBe(0.6)
  })

  it('carries sensitivity through the same resolution', async () => {
    const capture = await importCapture()
    const r = await capture()
    expect(findFactor(r, NODE_ID)?.sensitivity_displayed).toBe(0.5)
    expect(findFactor(r, NODE_ID)?.sensitivity_source).not.toBe('unmatched')
  })

  /**
   * ⛔ THE CONTRAST ARM. Widening the match must not make everything match.
   * A row naming a factor that is not on the canvas stays unmatched, and the
   * on-canvas node it does not name keeps its own honest null.
   */
  it('a row that names no on-canvas factor still reads unmatched', async () => {
    mockState = makeState({
      rawV2Response: {
        factor_sensitivity: [
          { node_id: 'fac_not_on_this_canvas', factor_label: 'Somewhere else', influence_score: 0.9 },
        ],
      },
    })
    const capture = await importCapture()
    const r = await capture()
    expect(findFactor(r, NODE_ID)?.influence_displayed).toBeNull()
    expect(findFactor(r, NODE_ID)?.influence_source).toBe('unmatched')
  })

  /**
   * ⭐ THE SURFACE BINDING. `active_tab` and `active_section` were hardcoded
   * `null` under the comment "Tab state is local to components, not in store".
   * That comment is false: `uiStore` holds `activeOutputTab` and
   * `pendingModelTabSection`. With both null, nothing in a bundle says WHICH
   * SURFACE a screenshot shows — which is how this session read a chat panel's
   * rows against a pre-analysis panel's predicates.
   */
  it('records which surface the reader was on', async () => {
    const capture = await importCapture()
    const r = await capture()
    expect(r.active_tab).toBe('diagnostics')
    expect(r.active_section).toBe('factors')
  })

  it('records a DIFFERENT surface when the reader is on one — the binding is real', async () => {
    mockUi = { activeOutputTab: 'olumi', pendingModelTabSection: null }
    const capture = await importCapture()
    const r = await capture()
    expect(r.active_tab).toBe('olumi')
    expect(r.active_section).toBeNull()
  })

  /**
   * ⭐ THE GATE THAT DECIDES WHAT A CANVAS NODE SAYS. `DecisionNode` renders
   * its post-run body on `results.status === 'complete'` AND a report; the
   * panels additionally require `hasRenderableResult`. A bundle that records
   * only `results.status` cannot tell a reader which of those a screenshot was
   * taken under.
   */
  it('records the predicates a canvas node renders its run copy from', async () => {
    const capture = await importCapture()
    const r = await capture()
    expect(r.analysis_gate).toEqual({
      results_status: 'complete',
      has_report: true,
      has_renderable_result: false,
    })
  })

  it('the gate moves with the state — it is derived, not stamped', async () => {
    mockState = makeState({ results: { status: 'idle', report: null }, rawV2Response: null })
    const capture = await importCapture()
    const r = await capture()
    expect(r.analysis_gate).toEqual({
      results_status: 'idle',
      has_report: false,
      has_renderable_result: false,
    })
  })
})
