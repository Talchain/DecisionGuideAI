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
 * ⚠ HISTORY, so the next reader does not re-derive it: at `69ec8cf5` this file
 * failed CI, and NOT on an assertion — `FACTOR_ID` was a plain top-level
 * `const` read inside the hoisted `../../store` factory's immediate body, so
 * the file died AT COLLECT (`ReferenceError: Cannot access 'FACTOR_ID' before
 * initialization`) and all four cases ran zero times. Repaired by moving it
 * into the `vi.hoisted()` block. The repair is itself UNRUN — see the note
 * there. NONE of the four cases below has ever been observed passing or
 * failing; the only thing CI has established about them is that they did not
 * execute.
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
 * ⭐ NODE-ANATOMY v3.2 (24 Sep): the factor states "Needs input · Value not set
 * yet" in its BODY (line 2, `factor-needs-input-row-{id}`), never as a pill on
 * the border — so the pill left the corner stack and the stack is the
 * attention marker · edited dot · coaching. The PAIR this file exists for
 * (needs input AND ranked, on one card) is unchanged; only where the first half
 * is said moved. The same `needs-input-pill` id is bound, now inside the row.
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
 *
 * ── ⭐ LOCKED CANVAS DESIGN (23 Sep 2026) — THE PAIR SURVIVES, IN TWO PLACES ──
 * ED 02:31Z D1a: "RETIRE the Key-driver badge once the body driver line is
 * present." The rank no longer lives in the corner: it is stated on the card
 * face by the driver line (`factor-driver-line`, "Driver N of M in this
 * model"), and only while the run is current. So the claim this file exists for
 * — a ranked factor can STILL need input, and the card must say BOTH — is
 * re-pointed, not dropped:
 *   · "Needs input" stays in the corner stack (unchanged);
 *   · the rank is asserted on the driver line of the SAME card;
 *   · the retired badge is asserted ABSENT in every case that has a rank.
 * The badge's corner SLOT is now the "Worth reviewing" marker
 * (`attention-marker-{id}`, spec §2), so the widest reachable row is
 * pill · marker · edited dot · coaching — CASE 2 pins that order. The attention
 * plan is pure and pinned in `shared/__tests__/nodeAttention.spec.ts`; it is
 * stubbed here (marked / unmarked), like the display-metadata hook.
 *
 * The mutation table above, at the new identities:
 *   · re-gate the factor arm on `isPreRunMode`   → cases 1 and 2 RED (pill)
 *   · exclude unvalued factors from the ranking  → cases 1 and 2 RED (driver line)
 *   · render the pill unconditionally            → case 3 REDs
 *   · state a rank unconditionally               → case 4 REDs (caption)
 *   · reorder the stack narrowest-first          → case 2 REDs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'
import { DRIVER_LINE_COPY } from '../shared/metricVocabulary'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// Hoisted so the (also hoisted) vi.mock factory can close over them.
//
// ⚠ `FACTOR_ID` MUST be hoisted with them, not declared as a plain top-level
// `const`. The `../../store` factory below reads it in its IMMEDIATE body
// (`const state = { nodes: [{ id: FACTOR_ID … }] }`), and that body runs during
// the import of `FactorNode` — before any top-level `const` in this file has
// initialised. As a plain `const` it threw
// `ReferenceError: Cannot access 'FACTOR_ID' before initialization`, which
// fails the WHOLE FILE AT COLLECT: all four cases contribute zero tests.
//
// Contrast `sensitivityRank` below, which stays a top-level `let` on purpose —
// it is read inside the returned closure, evaluated at render time, and each
// test reassigns it.
const { FACTOR_ID, editedNodeIds, selectNodeWithoutHistory } = vi.hoisted(() => ({
  FACTOR_ID: 'fac_hiring',
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
    // Locked Canvas design (23 Sep 2026): the rank is now stated by the driver
    // line, which renders ONLY while the run is current
    // (`useAnalysisResultsAreCurrent`, read for real through these fields).
    analysisFreshness: { freshness: 'fresh' },
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
  }
  const useCanvasStore = vi.fn((selector: (s: unknown) => unknown) => selector(state))
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})

// The rank the driver feed would supply for this factor; toggled per test.
// Read inside the returned closure, so it is evaluated at render time.
let sensitivityRank: number | null = null
// The analysed set's size (`influenceSetSize`) — the PRINTED `M` of "Driver N
// of M analysed" (ED #63 5806207128: "Denominator = eligible analysed
// factors"). Read at render time.
const SET_SIZE = 4
// The ranked count — the publication guard only, deliberately different from
// SET_SIZE so a caption that printed it would go red.
const RANKED_COUNT = 3
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank,
    // Locked Canvas design (23 Sep 2026): the driver line needs a measured
    // quantity and its basis — the same fields the ranking comes with on the
    // wire. Present on EVERY case, so the rank alone is what varies.
    influence: 0.9,
    influenceProvenance: 'normalised_elasticity',
    influenceImportanceBasis: null,
    influenceSetSize: SET_SIZE,
    influenceRankedCount: RANKED_COUNT,
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

// The badge's corner slot is now the "Worth reviewing" marker; stubbed per test.
let attentionMarked = false
vi.mock('../shared/useNodeAttention', () => ({
  useNodeAttention: vi.fn(() =>
    attentionMarked
      ? {
          reasons: [{ kind: 'top_driver', order: 3, label: 'Driver 2 of 4 analysed: the comparison responds strongly to it. How sure are you of its value?' }],
          marked: true,
          markedCount: 1,
          candidateCount: 1,
        }
      : { reasons: [], marked: false, markedCount: 0, candidateCount: 0 },
  ),
}))

/** The rank as the card now states it — on the face, by identity. */
// This file renders the DETAILED view (`viewMode: 'expert'`), where the card
// states the rank ONCE, in its Layer 2 block (`factor-driver-line-detail`) —
// the resting-face line is Standard-only so the rank is never said twice.
const driverCaption = () => within(screen.getByTestId('factor-driver-line-detail')).getByTestId('factor-driver-line-detail-caption')

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
  attentionMarked = false
  editedNodeIds.clear()
  useGuidanceStore.getState().clearGuidanceItems()
})

describe('a ranked factor can still need input — the pair the contract called impossible', () => {
  it('CASE 1 — "Needs input" and the rank render TOGETHER on one card: pill in the body row, rank on the driver line', () => {
    sensitivityRank = 1
    renderFactor(UNVALUED_FACTOR)

    const stack = screen.getByTestId(`node-corner-stack-${FACTOR_ID}`)
    const row = screen.getByTestId(`factor-needs-input-row-${FACTOR_ID}`)
    const pill = screen.getByTestId('needs-input-pill')

    // Locked Canvas design (23 Sep 2026), ED 02:31Z D1a: the Key-driver badge is
    // retired; NODE-ANATOMY v3.2: the pill is in the body, so the corner is empty…
    expect(screen.queryByTestId(`sensitivity-rank-${FACTOR_ID}`)).toBeNull()
    expect(row).toContainElement(pill)
    expect(stack).not.toContainElement(pill)
    expect(stack.children).toHaveLength(0)

    // …and the rank is stated by the driver line on the SAME card, so the pair
    // the contract called impossible is still on screen, together.
    expect(driverCaption().textContent).toBe(DRIVER_LINE_COPY.rank(1, SET_SIZE))
  })

  /**
   * ⛔ UPDATED 24 Sep 2026 (GAP-11, DESIGN-GAP-AUDIT-20260924.md row 11; Paul
   * v3.1 pt14): the edited-since-run dot no longer occupies a corner slot —
   * removed entirely as a per-card duplicate of the single graph-level stale
   * cue. `editedNodeIds.add` below is kept to prove the removal holds even
   * where the OLD three-member case used to reach it.
   */
  it('CASE 2 — remaining members together: the pill in the body; attention marker · coaching in the corner, in that order (the edited dot is gone)', () => {
    sensitivityRank = 2
    attentionMarked = true
    editedNodeIds.add(FACTOR_ID)
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    renderFactor(UNVALUED_FACTOR)

    const stack = screen.getByTestId(`node-corner-stack-${FACTOR_ID}`)
    const pill = screen.getByTestId('needs-input-pill')
    // Locked Canvas design (23 Sep 2026): the "Worth reviewing" marker holds the
    // retired rank badge's slot (spec §2; ED 02:31Z D1a/D1b).
    const marker = screen.getByTestId(`attention-marker-${FACTOR_ID}`)
    const coaching = screen.getByTestId(`node-coaching-marker-${FACTOR_ID}`)
    expect(screen.queryByTestId(`sensitivity-rank-${FACTOR_ID}`)).toBeNull()
    expect(screen.queryByTestId(`edited-since-run-${FACTOR_ID}`)).toBeNull()

    const kids = Array.from(stack.children)
    // NODE-ANATOMY v3.2: the pill is line 2 of the card, not a corner member
    // (it was FOUR here while it sat on the border).
    expect(screen.getByTestId(`factor-needs-input-row-${FACTOR_ID}`)).toContainElement(pill)
    expect(kids).toHaveLength(2)
    expect(kids[0]).toBe(marker)
    expect(kids[1]).toBe(coaching)

    // The rank itself is on the driver line, rank 2 by identity.
    expect(driverCaption().textContent).toBe(DRIVER_LINE_COPY.rank(2, SET_SIZE))
  })

  it('CASE 3 — THE TWIN: a factor that HAS a value, ranked, states the rank and shows NO pill', () => {
    sensitivityRank = 1
    renderFactor({ ...UNVALUED_FACTOR, observedState: { value: 0.7, source: 'user_override' } })

    const stack = screen.getByTestId(`node-corner-stack-${FACTOR_ID}`)
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
    // Locked Canvas design (23 Sep 2026): no badge in the corner — the stack is
    // empty — and the rank is on the driver line.
    expect(screen.queryByTestId(`sensitivity-rank-${FACTOR_ID}`)).toBeNull()
    expect(stack.children).toHaveLength(0)
    expect(driverCaption().textContent).toBe(DRIVER_LINE_COPY.rank(1, SET_SIZE))
  })

  it('CASE 4 — THE OTHER TWIN: an unvalued factor the ranking did not determine shows the pill and states NO rank', () => {
    sensitivityRank = null
    renderFactor(UNVALUED_FACTOR)

    const stack = screen.getByTestId(`node-corner-stack-${FACTOR_ID}`)
    expect(screen.queryByTestId(`sensitivity-rank-${FACTOR_ID}`)).toBeNull()
    const pill = screen.getByTestId('needs-input-pill')
    // NODE-ANATOMY v3.2: stated in the body row, and nothing on the border.
    expect(screen.getByTestId(`factor-needs-input-row-${FACTOR_ID}`)).toContainElement(pill)
    expect(stack.children).toHaveLength(0)
    // ⛔ Contract v3.1 pt 5 (supersedes the locked design's noun fallback): the
    // same measured quantity renders NO driver line — "A factor the run did not
    // rank shows no rank" — and says "Not ranked in this run" to AT. This is
    // what makes CASES 1-3 discriminating: the line follows the rank, not the
    // fixture.
    expect(screen.queryByTestId('factor-driver-line-detail')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.getByTestId('factor-driver-not-ranked').textContent).toBe('Not ranked in this run')
  })
})
