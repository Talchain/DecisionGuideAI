/**
 * BaseNode — the "Needs input" StatusPill joins the corner stack that OWNS the
 * top-right corner.
 *
 * StatusPill hand-wrote `absolute -top-2 -right-1 z-10` — one pixel from, and at
 * the SAME z as, `node-corner-stack-{id}` (`absolute -top-2 -right-2 z-10`), the
 * container built specifically to abolish same-corner overlap. That is the
 * fourth occupant of this corner to arrive with its own positioning authority,
 * after rank vs coaching (Codex P1-5) and the edited-since-run dot (Codex P2).
 *
 * ⭐ MEASURED, NOT ARGUED (real Chromium, `e2e/geometry/statusPillCorner.measure.ts`,
 * 1440x900, committed starters `vendor-selection` and `build-vs-buy`):
 * with a prior run in history — the state left by an import/reset, which sets
 * `results.status` to 'idle' while run history persists in localStorage — the
 * goal node rendered BOTH the pill and the edited-since-run dot, and the pill
 * covered 15px² of the dot's 25px² (60%). The no-run-history arm of the same run
 * measured zero co-occurrence, so the probe discriminates.
 *
 * ⛔⛔ THE PAIR THIS FILE CALLED IMPOSSIBLE IS REACHABLE, AND HAS BEEN SINCE THE
 * "NEEDS INPUT" MARKER STOPPED BEING PHASE-GATED ON FACTORS (corrected
 * 2026-09-18). This header read: *"the sensitivity-rank badge requires
 * `results.status === 'complete'` … and the pill requires `results.status !==
 * 'complete'` … exact complements on ONE store field, so rank and pill are
 * structurally unable to co-occur."*
 *
 * `isIncomplete`'s FACTOR arm returns `isFactorNeedsInput(data)` with no phase
 * check (`BaseNode.tsx`; `BaseNode.needsInputSurvivesTheRun.spec.tsx` pins it,
 * and its CASE 1 renders the pill at `results.status: 'complete'`). The rank is
 * assigned on factors from the results report with no exclusion for unvalued
 * ones. So on a FACTOR the two render together — see
 * `BaseNode.rankedFactorStillNeedsInput.spec.tsx`, which is where that pair is
 * now pinned at the render.
 *
 * ⭐ WHAT THIS FILE STILL PINS, AND IT IS A REAL CLAIM: this fixture is a GOAL,
 * and `goal` KEEPS the phase gate. The pill and the rank badge genuinely cannot
 * co-occur here — not because the gates are complements in general, but because
 * this node type's arm is still phase-gated and the rank badge is factor-only.
 *
 * ⚠ WHY THE OLD PIN STAYED GREEN ON A FALSE CLAIM — the reusable half. It
 * asserted that two DECLARATIONS exist (`const isPreRunMode = …` in
 * `BaseNode.tsx`, `const isResultsMode = …` in the hook). Both still do. It
 * never asserted that the pill's factor arm CONSUMES `isPreRunMode`, and that
 * is the line that went. A guard pinned to a declaration rather than to its
 * consumption cannot see a consumer leave (CLAUDE.md trap 13b). Re-pointed at
 * the arm in the last test.
 *
 * ⚠ AN EARLIER ROUND HAD ALREADY FOUND HALF OF THIS AND FIXED THE WRONG HALF. It
 * began as a RENDER assertion — mount the pill, assert no rank badge — and a
 * mutant forcing `isResultsMode = true` SURVIVED it, because this mock's
 * `report` is null and the node is a goal, either of which suppresses the badge
 * whatever the status gate says. The conclusion drawn was that the render was
 * over-determined and the claim belonged at the source. The render WAS
 * over-determined; the claim was also FALSE, and moving a false claim to a
 * stronger-looking instrument made it harder to see, not easier.
 *
 * ORDER: pill · rank · edited-dot · coaching, widest-first. The stack is
 * right-anchored and grows leftward, so widest-first keeps the small badges
 * clear of the corner and leaves the interactive coaching marker as the
 * rightmost, easiest click target. The pill is by far the widest child
 * (measured 67.9px against the dot's 5px at the same zoom).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode } from '../GoalNode'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const { selectNodeWithoutHistory, editedNodeIds } = vi.hoisted(() => ({
  selectNodeWithoutHistory: vi.fn(),
  editedNodeIds: new Set<string>(),
}))

// `results.status: 'idle'` is the state an import/reset leaves (store.ts:3903,
// store.ts:4358) — pre-run mode, which is what mounts the pill. Run history is a
// SEPARATE localStorage authority that survives both, which is why the edited
// dot can be present at the same time.
vi.mock('../../store', () => {
  const state = {
    edges: [],
    nodes: [{ id: 'node-a' }],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    editedSinceRunNodeIds: editedNodeIds,
    analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    ceeAnalysisReady: null,
    lodRung: 'full',
    viewMode: 'expert',
    selectNodeWithoutHistory,
  }
  const useCanvasStore = vi.fn((selector: (s: unknown) => unknown) => selector(state))
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})

const baseProps = {
  id: 'node-a',
  type: 'goal',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  // ⚠ CONTRACT v3.1 (gap U4, 24 Sep 2026): a goal with NO target now states the
  // gap once, in its own "Target not captured" chip, and BaseNode withholds the
  // pill. The pill still reaches a goal whose NODE carries a target while the
  // STORE scalar (`goalThreshold: null` below) has none — so the fixture carries
  // a node-level target to keep this file's corner-stack claims about the pill.
  data: { label: 'Reach profitability', type: 'goal', goal_threshold_raw: 12, goal_threshold_unit: '%' },
}

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'item-1',
    category: 'should_fix',
    source: 'structural',
    title: 'Review this node',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
    target_object: { type: 'node', id: 'node-a' },
    ...overrides,
  }
}

const renderNode = () =>
  render(
    <ReactFlowProvider>
      <GoalNode {...(baseProps as unknown as Parameters<typeof GoalNode>[0])} />
    </ReactFlowProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  editedNodeIds.clear()
  useGuidanceStore.getState().clearGuidanceItems()
})

/**
 * ⛔ UPDATED 25 Sep 2026 (GAP 11, DESIGN-GAP-AUDIT-20260924.md row 11; Visual
 * Contract §02 `.node .attention{right:7px;top:5px}` inside the card, and
 * `.state-word` in the card body): the corner stack moved INSIDE the card and
 * holds only the fixed-size marks, so the worded pill LEFT it for the card's
 * in-flow state row (`node-state-row-{id}`). What this file pinned — ONE owner
 * for the corner, and a pill with no positioning authority of its own — still
 * holds; the pill's owner is now the state row. The single source of that
 * layout is pinned in `BaseNode.marksInsideCardRail.spec.tsx`.
 */
describe('BaseNode — "Needs input" pill: one owner, no positioning of its own', () => {
  it('the pill renders in the card\'s state row — NOT in the corner stack, and not as its own positioned element', () => {
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    const row = screen.getByTestId('node-state-row-node-a')
    const pill = screen.getByTestId('needs-input-pill')
    expect(row).toContainElement(pill)
    expect(stack).not.toContainElement(pill)
  })

  it('the pill carries NO positioning authority of its own', () => {
    renderNode()
    const pill = screen.getByTestId('needs-input-pill')
    // The precise classes that made it a rival authority in this corner.
    expect(pill.className).not.toContain('absolute')
    expect(pill.className).not.toContain('-top-2')
    expect(pill.className).not.toContain('-right-1')
    expect(pill.className).not.toContain('z-10')
  })

  /**
   * ⛔ UPDATED 24 Sep 2026 (GAP-11, DESIGN-GAP-AUDIT-20260924.md row 11; Paul
   * v3.1 pt14): the edited-since-run dot is removed from the corner — a
   * per-card duplicate of the single graph-level stale cue. `editedNodeIds`
   * is kept opted-in below to prove the pill alone now owns the stack even
   * when the store says the node was edited.
   */
  it('the pill alone owns the state row — and the (now-removed) edited-since-run dot joins neither row nor stack', () => {
    editedNodeIds.add('node-a')
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    const row = screen.getByTestId('node-state-row-node-a')
    const pill = screen.getByTestId('needs-input-pill')
    expect(screen.queryByTestId('edited-since-run-node-a')).toBeNull()
    expect(Array.from(row.children)).toEqual([pill])
    // CONTRAST — with no mark the corner stack is empty: the pill did not stay behind.
    expect(stack.children).toHaveLength(0)
  })

  it('pill and coaching are split by kind: the pill in the state row, the coaching MARK alone in the corner', () => {
    editedNodeIds.add('node-a')
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    const row = screen.getByTestId('node-state-row-node-a')
    const pill = screen.getByTestId('needs-input-pill')
    const coaching = screen.getByTestId('node-coaching-marker-node-a')
    expect(screen.queryByTestId('edited-since-run-node-a')).toBeNull()
    expect(Array.from(stack.children)).toEqual([coaching])
    expect(Array.from(row.children)).toEqual([pill])
    expect(coaching.className).not.toContain('absolute')
  })

  /**
   * ⛔⛔ THIS TEST USED TO PIN AN IMPOSSIBILITY THAT IS NOT ONE. Its assertions
   * are kept, its CLAIM is replaced, and the difference between those two
   * things is the whole finding.
   *
   * It asserted that `const isPreRunMode = …` exists in `BaseNode.tsx` and
   * `const isResultsMode = …` exists in the hook, and concluded from that pair
   * of DECLARATIONS that the pill and the rank badge can never co-occur. Both
   * declarations still exist. The conclusion is false, and was false before
   * this test was last touched: `isIncomplete`'s FACTOR arm no longer consumes
   * `isPreRunMode` at all, so on a factor the pill outlives the run and can sit
   * beside the rank badge (`BaseNode.rankedFactorStillNeedsInput.spec.tsx`).
   *
   * A guard pinned to a declaration cannot see a CONSUMER leave. So this now
   * reads the two ARMS of `isIncomplete` and pins the asymmetry that is
   * actually there — with the goal arm as the contrast control, so a reader
   * that could not see either arm's text cannot pass by finding nothing.
   *
   * If the factor arm gains a phase gate, or the goal arm loses one, this REDs
   * and the next session must re-derive the corner stack's reachable maximum
   * (four members on a factor, three elsewhere) and re-measure that row rather
   * than inheriting this file's verdict.
   */
  it('ARM PIN: the goal arm is phase-gated and the factor arm is NOT — so the complement is not total', () => {
    const baseNode = readFileSync(
      resolve(__dirname, '../BaseNode.tsx'), 'utf8')
    const metadataHook = readFileSync(
      resolve(__dirname, '../../hooks/useNodeDisplayMetadata.ts'), 'utf8')

    // Positive control: prove the reader can SEE this file's content at all,
    // so a false zero cannot pass as a satisfied assertion.
    expect(baseNode).toContain('node-corner-stack-')
    expect(metadataHook).toContain('useNodeDisplayMetadata')

    // Both declarations are still here. They are NOT the claim.
    expect(baseNode).toContain("const isPreRunMode = resultsStatus !== 'complete'")
    expect(metadataHook).toContain("const isResultsMode = resultsStatus === 'complete'")

    // Read the arms out of `isIncomplete` itself, bounded by the next
    // declaration after it, so a phase gate elsewhere in the file cannot be
    // mistaken for one inside an arm.
    //
    // ⛔ UPDATED 24 Sep 2026 (GAP-17, DESIGN-GAP-AUDIT-20260924.md row 17):
    // the boundary used to be `const controllability =`, which GAP-17 deleted
    // — the dashed-frame logic it fed was removed (card frames are always
    // solid now; contract §02/§03). `const borderStyle = ''` is the next
    // declaration in file order and is just as good a bound: this test only
    // needs SOME marker after `isIncomplete`'s close, not that specific one.
    const open = baseNode.indexOf('const isIncomplete = (() => {')
    expect(open).toBeGreaterThan(-1)
    const close = baseNode.indexOf("const borderStyle = ''", open)
    expect(close).toBeGreaterThan(open)
    const isIncompleteSrc = baseNode.slice(open, close)

    const armAfter = (type: string): string => {
      const start = isIncompleteSrc.indexOf(`if (nodeType === '${type}') {`)
      expect(start).toBeGreaterThan(-1)
      const rest = isIncompleteSrc.slice(start + 1)
      const next = rest.indexOf("if (nodeType === '")
      return next === -1 ? rest : rest.slice(0, next)
    }

    const factorArm = armAfter('factor')
    const goalArm = armAfter('goal')

    // CONTRAST CONTROL — the goal arm DOES carry the phase gate. Without this
    // the negative assertion below would also pass on a reader that sliced
    // nothing useful out of the file.
    expect(goalArm).toContain('if (!isPreRunMode) return false')

    // THE CLAIM: the factor arm asks about the GAP and nothing else.
    expect(factorArm).toContain('isFactorNeedsInput(data)')
    expect(factorArm).not.toContain('isPreRunMode')
  })
})
