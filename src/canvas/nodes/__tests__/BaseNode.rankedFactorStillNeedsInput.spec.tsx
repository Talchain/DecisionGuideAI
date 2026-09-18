/**
 * ⛔⛔ THE PAIR THE CORNER STACK'S CONTRACT CALLED IMPOSSIBLE: a factor the run
 * RANKED and the user never VALUED carries "Needs input" AND "Key driver N" on
 * one row.
 *
 * ⚠⚠ UNRUN. Nothing in this file has been executed — no vitest, no typecheck,
 * no browser. It was written by reading the source at
 * `canvas/rank-badge-carries-a-word`. CI is the authority on whether it passes;
 * if it REDs, read the assertion, not this header.
 *
 * ── WHY IT EXISTS ─────────────────────────────────────────────────────────
 * `BaseNode.tsx`'s five-member corner-stack contract said `StatusPill` and the
 * rank badge were "exact complements" on `results.status`, and #1688's width
 * derivation for the new `Key driver N` badge rested on that sentence: *"the
 * widest thing this row ever holds is this badge"*. The sentence was stale.
 *
 *   · `isIncomplete`'s FACTOR arm returns `isFactorNeedsInput(data)` with NO
 *     phase check — deliberately, so the gap outlives the run
 *     (`BaseNode.needsInputSurvivesTheRun.spec.tsx`, whose ⛔ SCOPE note says
 *     it pins `factor` only; `goal` and `option` KEEP the phase gate).
 *   · `sensitivityRank` is assigned in `useNodeDisplayMetadata.ts`'s
 *     `if (nodeType === 'factor')` branch from the driver feed's ranking, gated
 *     only on rank DETERMINACY — never on whether the factor carries a value.
 *
 * The two predicates read DISJOINT INPUTS — node data vs the results report —
 * so neither can exclude the other, and the co-occurrence is not an edge case:
 * an unestimated factor carries the widest uncertainty, so it is among the
 * likeliest factors for the result to swing on and therefore to be badged.
 *
 * ── WHY FOUR CASES ────────────────────────────────────────────────────────
 * Case 1 alone would pass against an implementation that rendered both markers
 * unconditionally, which is a louder lie than the one being pinned. The set is
 * chosen so each plausible wrong implementation fails at least one case, and
 * the twins live in this file so a change that flattened either channel cannot
 * pass by deleting its opposite:
 *
 *   · re-gate the factor arm on `isPreRunMode`   → cases 1 and 2 RED
 *   · exclude unvalued factors from the ranking  → cases 1 and 2 RED
 *   · render the pill unconditionally            → case 3 REDs
 *   · render the badge unconditionally           → case 4 REDs
 *   · reorder the stack narrowest-first          → case 2 REDs
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY — `needs-input-pill`,
 * `sensitivity-rank-{id}`, `edited-since-run-{id}`, `node-coaching-marker-{id}`
 * are exact test ids, and the ordering assertions compare element REFERENCES,
 * never positions alone (CLAUDE.md trap 19).
 *
 * ⛔ WHAT THIS DOES NOT ESTABLISH, stated because the finding that produced this
 * file is a WIDTH finding and jsdom cannot measure pixels (trap 3): it pins that
 * the four-member row is REACHABLE and correctly ordered. It says nothing about
 * whether that row FITS — both wide members counter-scale to 2× at the settle
 * zoom against a card that does not. That measurement is in a browser.
 *
 * ⚠ THE HOOK IS MOCKED HERE, so this fixture cannot by itself prove the product
 * reaches this state (trap 16-inverse — a fixture you wrote yourself is not
 * evidence about the wire). The REACHABILITY is derived at the source above and
 * pinned at the source by the ARM PIN in
 * `BaseNode.statusPillCornerStack.spec.tsx`; what this file adds is that WHEN
 * the pair arrives, the row renders both and orders them widest-first.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const FACTOR_ID = 'fac_hiring'

// Hoisted so the (also hoisted) vi.mock factory can close over them.
const { editedNodeIds, selectNodeWithoutHistory } = vi.hoisted(() => ({
  editedNodeIds: new Set<string>(),
  selectNodeWithoutHistory: vi.fn(),
}))

// `results.status: 'complete'` throughout — the POST-RUN state, which is the
// only state the rank badge can exist in, and the state the withdrawn "exact
// complements" sentence claimed the pill could not survive.
vi.mock('../../store', () => {
  const state = {
    hoveredOptionId: null,
    // `openNodeInspector` fail-closes on a node that is not on the graph, so
    // the double must actually contain the node under test. The pill's own
    // input is the `data` PROP, which each test supplies.
    nodes: [{ id: FACTOR_ID, type: 'factor', data: { label: 'Hiring rate', type: 'factor' } }],
    edges: [],
    ceeAnalysisReady: null,
    results: { status: 'complete', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    editedSinceRunNodeIds: editedNodeIds,
    analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    lodRung: 'full',
    viewMode: 'expert',
    setHoveredOption: vi.fn(),
    selectNodeWithoutHistory,
  }
  const useCanvasStore = vi.fn((selector: (s: unknown) => unknown) => selector(state))
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})

// The rank the driver feed would supply for this factor; toggled per test.
// Read inside the returned closure, so it is evaluated at render time.
let sensitivityRank: number | null = null
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank,
    influence: null,
    influenceProvenance: null,
    influenceImportanceBasis: null,
    confidence: null,
    confidenceIsDefaulted: false,
    confidenceIsProvisional: false,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    achievementProbabilityIsModelledBasis: false,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: true,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

const baseProps = {
  id: FACTOR_ID,
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

/** A controllable factor carrying NO value in any of the three carriers. */
const UNVALUED_FACTOR = {
  label: 'Hiring rate',
  type: 'factor',
  category: 'controllable',
}

const renderFactor = (data: Record<string, unknown>) => {
  const props = { ...baseProps, data } as unknown as Parameters<typeof FactorNode>[0]
  return render(
    <ReactFlowProvider>
      <FactorNode {...props} />
    </ReactFlowProvider>,
  )
}

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'item-1',
    category: 'should_fix',
    source: 'structural',
    title: 'Review this node',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
    target_object: { type: 'node', id: FACTOR_ID },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
  sensitivityRank = null
  editedNodeIds.clear()
  useGuidanceStore.getState().clearGuidanceItems()
})

describe('a ranked factor can still need input — the pair the contract called impossible', () => {
  it('CASE 1 — "Needs input" and the rank badge render TOGETHER, in ONE stack, pill first', () => {
    sensitivityRank = 1
    renderFactor(UNVALUED_FACTOR)

    const stack = screen.getByTestId(`node-corner-stack-${FACTOR_ID}`)
    const pill = screen.getByTestId('needs-input-pill')
    const badge = screen.getByTestId(`sensitivity-rank-${FACTOR_ID}`)

    expect(stack).toContainElement(pill)
    expect(stack).toContainElement(badge)

    // WIDEST-FIRST, bound by identity: the row is right-anchored and grows
    // leftward, so the two wide members lead and the small badges keep the
    // distance from the corner they hold on every other card.
    const kids = Array.from(stack.children)
    expect(kids).toHaveLength(2)
    expect(kids[0]).toBe(pill)
    expect(kids[1]).toBe(badge)
  })

  it('CASE 2 — the FOUR-member row: pill · rank · edited dot · coaching, in that order', () => {
    sensitivityRank = 2
    editedNodeIds.add(FACTOR_ID)
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    renderFactor(UNVALUED_FACTOR)

    const stack = screen.getByTestId(`node-corner-stack-${FACTOR_ID}`)
    const pill = screen.getByTestId('needs-input-pill')
    const badge = screen.getByTestId(`sensitivity-rank-${FACTOR_ID}`)
    const edited = screen.getByTestId(`edited-since-run-${FACTOR_ID}`)
    const coaching = screen.getByTestId(`node-coaching-marker-${FACTOR_ID}`)

    const kids = Array.from(stack.children)
    // ⛔ FOUR. `BaseNode.cornerStack.spec.tsx` pins THREE — on a DECISION
    // fixture, whose arm is still phase-gated. That is correct for that node
    // type and is not evidence about a factor.
    expect(kids).toHaveLength(4)
    expect(kids[0]).toBe(pill)
    expect(kids[1]).toBe(badge)
    expect(kids[2]).toBe(edited)
    expect(kids[3]).toBe(coaching)
  })

  it('CASE 3 — THE TWIN: a factor that HAS a value, ranked, shows the badge and NO pill', () => {
    sensitivityRank = 1
    renderFactor({ ...UNVALUED_FACTOR, observedState: { value: 0.7, source: 'user_override' } })

    const stack = screen.getByTestId(`node-corner-stack-${FACTOR_ID}`)
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
    const badge = screen.getByTestId(`sensitivity-rank-${FACTOR_ID}`)
    const kids = Array.from(stack.children)
    expect(kids).toHaveLength(1)
    expect(kids[0]).toBe(badge)
  })

  it('CASE 4 — THE OTHER TWIN: an unvalued factor the ranking did not determine shows the pill and NO badge', () => {
    sensitivityRank = null
    renderFactor(UNVALUED_FACTOR)

    const stack = screen.getByTestId(`node-corner-stack-${FACTOR_ID}`)
    expect(screen.queryByTestId(`sensitivity-rank-${FACTOR_ID}`)).toBeNull()
    const pill = screen.getByTestId('needs-input-pill')
    const kids = Array.from(stack.children)
    expect(kids).toHaveLength(1)
    expect(kids[0]).toBe(pill)
  })
})
