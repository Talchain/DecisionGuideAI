/**
 * ⭐⭐ THE ANCHOR CARD STATES HOW MANY ALTERNATIVES ARE IN PLAY — AT READING
 * ZOOM, WHERE THE READER CAN ACTUALLY READ IT.
 *
 * ## The defect
 *
 * `optionCount` was derived correctly and reached exactly one piece of RENDERED
 * text: `lodMetric`, the single reduced line a card shows BELOW the legibility
 * floor. The decision card — the anchor of every model — therefore stated its
 * option count ONLY when zoomed out, and said nothing about it at normal zoom.
 * Its two other uses are a chip `message` (never rendered) and a popover gated
 * `!isPostAnalysis && optionCount > 0`, i.e. behind a hover, pre-analysis only.
 *
 * Knowing how many alternatives are on the board is the precondition for
 * arguing about whether the set is COMPLETE, which is the point of the product.
 *
 * ## ⛔ WHAT THIS SPEC DELIBERATELY DOES NOT ASSERT
 *
 * That the options are COMPARABLE. An option that exists is not an option the
 * run can compare: CEE stamps `waived_by_exclusion` per option and this repo
 * reads it through `selectOptionExclusionMessage`, whose own header rules that
 * *"'Not connected', 'no values set' and 'excluded from this calculation' are
 * THREE different facts"*. `optionCount` cannot see that verdict — it lives in
 * a different store, is per-option, and is withheld while stale. So the copy
 * says "options" and this spec pins that word, because a count upgraded into a
 * comparability claim the data cannot back is the fabrication class this card
 * has already had removed from it twice (CLAUDE.md trap 13c: an oracle written
 * from the author's reading of what a field OUGHT to mean).
 *
 * ## ⚠ WHAT jsdom CAN AND CANNOT SETTLE HERE (CLAUDE.md trap 3)
 *
 * The "renders once, never twice" property is about PAINT, and jsdom cannot
 * prove paint. At the `line` rung BOTH count-bearing elements are in the DOM —
 * `BaseNode` wraps all children in `LOD_BLANKED_BODY_STYLE` (`visibility:
 * hidden`) and paints the reduced line as a descendant that re-declares
 * `visibility: visible`. So this spec asserts the MECHANISM, which is
 * structural and which jsdom can see: the wrapper carries
 * `LOD_BLANKED_BODY_ATTR`, the card-face line sits inside it declaring nothing,
 * and exactly ONE count-bearing element declares itself visible against that
 * hidden ancestor. A browser-level confirmation belongs to
 * `e2e/visual/nodeTextClipping.visual.spec.ts`'s family, not here, and this
 * comment exists so nobody reads a green run as evidence about pixels.
 *
 * ⛔⛔ DECLARED **UNRUN**. Written under a standing no-test-execution cost
 * constraint; not one case in this file has been executed, locally or
 * otherwise. CI is the authority. Every expectation below is derived by reading
 * `DecisionNode.tsx`, `BaseNode.tsx` and `zoomLegibility.ts` at this tip and
 * reasoning line by line — which is exactly the state in which an expectation
 * is most likely to be wrong, so treat a first CI red as a defect in THIS FILE
 * until the component is shown to be at fault.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode, DECISION_RESTING_COPY, composeOptionCountLine } from '../DecisionNode'
import { LOD_BLANKED_BODY_ATTR } from '../../utils/zoomLegibility'
/**
 * ⚠ THE REPORT FIXTURES ARE THE REPO'S OWN, NOT MINE. A self-authored report
 * silently encodes my model of the producer rather than the producer
 * (CLAUDE.md trap 16-inverse), and `DecisionNode`'s post-analysis arm reads it
 * through `selectWithheldLeaderDisclosure` and `useSupportShareRunWideAbsent` —
 * two consumers whose input domain I have no business inventing. These are the
 * same two fixtures `lodMetric.decisionGoal.spec.tsx` uses.
 */
import { PERMITTED_REPORT } from '../../../lib/__fixtures__/ownedLeaderClaim.fixtures'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/**
 * The store double is lifted VERBATIM from `lodMetric.decisionGoal.spec.tsx`,
 * which mounts the real `BaseNode` against the real `DecisionNode` and is green
 * at this tip. Re-deriving a second double for the same component is how the
 * two start to disagree about which state they describe (CLAUDE.md trap 12);
 * inheriting the proven one means a failure here is about the CARD, not about
 * the harness.
 */
const makeStoreState = (o: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  edges: [],
  nodes: [],
  viewMode: 'standard',
  // ⭐ `full` BY DEFAULT, AND THAT IS THE WHOLE POINT OF THIS FILE. The sibling
  // spec defaults to `line` because it is about the reduced line. Every case
  // here that does not say otherwise is asking what a reader sees at ORDINARY
  // reading zoom — the surface the defect was invisible on.
  lodRung: 'full',
  ...o,
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn((s: any) => s(makeStoreState())) }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, influenceProvenance: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    achievementProbabilityIsModelledBasis: null, stabilityPercentage: null,
    winRate: null, isResultsMode: false,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'dec-1', type: 'decision', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
}

const renderDecision = (state: Record<string, unknown> = {}, label = 'Which supplier do we pick?') => {
  vi.mocked(useCanvasStore).mockImplementation((sel: any) => sel(makeStoreState(state) as any))
  return render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} data={{ label, type: 'decision' }} />
    </ReactFlowProvider>,
  )
}

const CARD_FACE = 'decision-node-option-count'
const LOD_LINE = 'node-lod-line'

const cardFace = () => screen.queryByTestId(CARD_FACE)
const cardFaceText = () => cardFace()?.textContent ?? null
const lodLine = () => screen.queryByTestId(LOD_LINE)
const lodLineText = () => lodLine()?.textContent ?? null

const optionNode = (n: number) => ({
  id: `opt-${n}`, type: 'option', data: { type: 'option', label: `Supplier ${n}` },
})
const edgeTo = (n: number, suffix = '') => ({
  id: `e-${n}${suffix}`, source: 'dec-1', target: `opt-${n}`,
})
/** N distinct options, each linked exactly once. */
const linked = (n: number) => ({
  nodes: Array.from({ length: n }, (_, i) => optionNode(i + 1)),
  edges: Array.from({ length: n }, (_, i) => edgeTo(i + 1)),
})

// ─────────────────────────────────────────────────────────────────────────────

describe('composeOptionCountLine — the count, and the rules that make it honest', () => {
  it('states the number and the noun', () => {
    expect(composeOptionCountLine(3)).toBe('3 alternatives')
  })

  /**
   * THE SINGULAR IS NOT A PLURAL WITH AN S BOLTED ON. Pinned on the function
   * rather than only through a render, because this is where the rule lives —
   * a render-only pin would go green against a caller that reimplemented it.
   */
  it('one option is "1 alternative", never "1 alternatives"', () => {
    expect(composeOptionCountLine(1)).toBe('1 alternative')
    expect(composeOptionCountLine(1)).not.toContain('alternatives')
  })

  /**
   * ⛔ ZERO IS NOT A COUNT OF ZERO — trap 21, and #1690 separated these two on
   * purpose. "A decision with no options" is a STRUCTURAL absence with an
   * authoring act behind it; "a factor with no number" is an unset metric.
   * Returning `null` is what lets every caller fall through to the CTA-bearing
   * `noOptionsLine` instead of stating an absence as a finding.
   */
  it('zero returns null, so no caller can render "0 options"', () => {
    expect(composeOptionCountLine(0)).toBeNull()
  })

  /**
   * THE OPPOSITE-DIRECTION TWIN (trap 22b). The zero rule must not be written
   * as `=== 0`: a negative or non-finite count is not a number to state either,
   * and a `=== 0` guard would let one through as "-1 options".
   */
  it('and nothing else degenerate reaches the card either', () => {
    expect(composeOptionCountLine(-1)).toBeNull()
    expect(composeOptionCountLine(Number.NaN)).toBeNull()
  })

  /**
   * ⛔ THE WORD IS A NOUN FOR A COUNT, AND THIS CASE IS A REFUSAL RATHER THAN A
   * STYLE PIN. (The noun is "alternatives" since Paul's 25 Sep 2026 ruling that
   * the canvas matches the prototype — `olumi-canvas-visual-contract.html:192`,
   * "3 alternatives · Evidence priority: conversion". It was "options"; the
   * refusal below is unchanged: still a count, still not "comparable".) Comparability is CEE's verdict (`waived_by_exclusion`), held in a
   * different store and not visible to `optionCount`. If a later change wants
   * "comparable" on this card it must first bring that verdict here, and this
   * case is what makes that a deliberate act instead of a copy tweak.
   */
  it('makes no claim the count cannot support', () => {
    const line = composeOptionCountLine(4)!
    expect(line).toMatch(/^4 alternatives$/)
    expect(line).not.toMatch(/\b(comparable|compared|comparing|viable|valid|complete)\b/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('the card states the alternatives AS CARD-FACE TEXT at reading zoom', () => {
  beforeEach(() => { vi.clearAllMocks() })

  /**
   * ⭐ THE HEADLINE CASE — THE ONE THAT WAS FALSE BEFORE THIS CHANGE. At the
   * `full` rung there is no reduced line in the tree at all, so this element is
   * the ONLY place the count appears. Before the change it did not exist and
   * the count reached no rendered text at this zoom.
   */
  it('pre-analysis: the count is on the card face, not only in the reduced line', () => {
    renderDecision(linked(3))
    expect(cardFaceText()).toBe('3 alternatives')
  })

  /**
   * THE CONTROL FOR THE CASE ABOVE, and it is what makes it a claim about
   * READING ZOOM rather than about the DOM in general: at `full` the reduced
   * line is absent entirely, so the assertion above cannot have been satisfied
   * by `lodMetric` under another name.
   */
  it('CONTRAST CONTROL — at reading zoom there is no reduced line to have supplied it', () => {
    renderDecision(linked(3))
    expect(lodLine()).toBeNull()
  })

  /**
   * THE DISCRIMINATING TWIN (trap 19). A line composed from anything other than
   * THIS decision's own option edges — a constant, the node count, the edge
   * count — would answer identically across models. Changing only the number of
   * linked options must change only the number.
   */
  it('DISCRIMINATION — a different number of options produces a different line', () => {
    renderDecision(linked(2))
    expect(cardFaceText()).toBe('2 alternatives')
  })

  it('and the singular reaches the card face intact', () => {
    renderDecision(linked(1))
    expect(cardFaceText()).toBe('1 alternative')
  })

  /**
   * ⭐ POST-ANALYSIS TOO. The count is a STRUCTURAL fact about the model, not a
   * finding about the run, so a completed analysis does not retire it — and
   * this arm is a second render site, so it needs its own case rather than
   * inheriting the pre-analysis one.
   */
  it('post-analysis: the count survives a completed run', () => {
    renderDecision({
      ...linked(3),
      results: { status: 'complete', report: PERMITTED_REPORT },
    })
    expect(cardFaceText()).toBe('3 alternatives')
  })

  /**
   * ⛔ AND IT DOES NOT SILENCE THE RESTING STATE. `bodyHasContent`'s post arm is
   * `showStabilityLine` — the presence of an actual FINDING — precisely so that
   * non-findings do not displace the resting copy. A count is not a finding.
   * This is the opposite-direction twin of the case above: it is the harm a
   * careless wiring of the count into `bodyHasContent` would cause, and the
   * suite would otherwise be entirely blind to it.
   */
  it('OPPOSITE-DIRECTION TWIN — and it does not displace the resting state it sits above', () => {
    renderDecision({
      ...linked(3),
      results: { status: 'complete', report: PERMITTED_REPORT },
      // Standard, so the stability line is NOT rendered inline — which is
      // exactly the state where `bodyHasContent` is false and the resting
      // block is the thing a careless conjunct would have displaced.
      viewMode: 'standard',
    })
    expect(cardFace()).not.toBeNull()
    expect(screen.getByTestId('decision-node-resting-state')).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('de-duplication: two edges to one option are one option', () => {
  beforeEach(() => { vi.clearAllMocks() })

  /**
   * ⚠ REACHABLE, NOT THEORETICAL. `store.addEdge` refuses duplicates, but the
   * CEE patch path does not go through it (`applyPatch.ts:350` appends supplied
   * edges wholesale) and `_rewireTarget` can point two surviving edges at one
   * option without appending anything. `useModelHealth` already ships a
   * "Duplicate edge" warning for exactly this state.
   *
   * A duplicate edge is a modelling defect the health check reports. It is not
   * a second alternative, and the card must not tell the reader it is.
   */
  it('a duplicated link does not inflate the count', () => {
    renderDecision({
      nodes: [optionNode(1), optionNode(2)],
      edges: [edgeTo(1), edgeTo(1, '-dup'), edgeTo(2)],
    })
    expect(cardFaceText()).toBe('2 alternatives')
  })

  /**
   * THE DISCRIMINATING PAIR for the case above (trap 19). Without this, "2
   * options" is equally consistent with a count that simply ignored the third
   * edge. Pointing the same three edges at three DISTINCT options must read 3 —
   * so the de-duplication is provably keyed on the TARGET and not on a cap, an
   * ordering accident or a dropped element.
   */
  it('DISCRIMINATION — the same three edges at three distinct options read 3', () => {
    renderDecision({
      nodes: [optionNode(1), optionNode(2), optionNode(3)],
      edges: [edgeTo(1), edgeTo(2), edgeTo(3)],
    })
    expect(cardFaceText()).toBe('3 alternatives')
  })

  /**
   * ⛔ ONLY OPTIONS, AND ONLY THIS DECISION'S. An edge to a non-option target,
   * and an edge this decision does not source, must both be invisible to the
   * count. Without this the number would silently become "outgoing edges", which
   * is what it used to be.
   */
  it('counts neither non-option targets nor another node\'s edges', () => {
    renderDecision({
      nodes: [
        optionNode(1),
        { id: 'fac-1', type: 'factor', data: { type: 'factor', label: 'Lead time' } },
        optionNode(2),
      ],
      edges: [
        edgeTo(1),
        { id: 'e-fac', source: 'dec-1', target: 'fac-1' },
        { id: 'e-other', source: 'someone-else', target: 'opt-2' },
      ],
    })
    expect(cardFaceText()).toBe('1 alternative')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('a decision with no options does not read "0 options"', () => {
  beforeEach(() => { vi.clearAllMocks() })

  /**
   * ⭐ THE SEPARATION #1690 DREW, KEPT. The zero case belongs to
   * `noOptionsLine`, which carries a working CTA (`requestAsk`). Rendering a
   * count of zero would state an absence as a metric AND delete an affordance
   * the reader can act on.
   */
  it('renders no count element at all', () => {
    renderDecision({ nodes: [], edges: [] })
    expect(cardFace()).toBeNull()
  })

  it('and the CTA-bearing structural line is what the reader gets instead', () => {
    renderDecision({ nodes: [], edges: [] })
    const resting = screen.getByTestId('decision-node-resting-state')
    expect(within(resting).getByText(DECISION_RESTING_COPY.noOptionsLine)).toBeDefined()
  })

  /**
   * THE REGRESSION PIN, bound to the exact forbidden string. "No count element
   * renders" above would stay green if a count were spelled somewhere else on
   * the card, so the string itself is pinned across the WHOLE card rather than
   * within one testid.
   */
  it('and the string "0 options" appears nowhere on the card', () => {
    const { container } = renderDecision({ nodes: [], edges: [] })
    expect(container.textContent ?? '').not.toContain('0 option')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐⭐ THE PROPERTY THE BRIEF SINGLED OUT: THE NUMBER NEVER APPEARS TWICE ON ONE
 * CARD.
 *
 * The count lives on two surfaces — the card face (new) and `lodMetric` (the
 * reduced line). Both must never PAINT at once. `BaseNode` already owns the
 * mechanism that guarantees it, and these cases pin that the new line is on the
 * correct side of it.
 *
 * ## The rungs, derived from `zoomLegibility.ts` at this tip
 *
 *   · `full`  — `bodyReduced` false → `lodBodyLine` null → NO reduced line in
 *               the tree. The card face is the only instance.
 *   · `quiet` — `bodyReduced` is false unless the active LENS has set this card
 *               aside (`selectLensDetailActive` reads `_dimmedNodeIds.size`, so
 *               with the lens off it is false for the right reason). Undimmed
 *               `quiet` therefore behaves exactly like `full`.
 *   · `line`  — `bodyReduced` true → `BaseNode` wraps the children in
 *               `LOD_BLANKED_BODY_STYLE` and paints the reduced line as a
 *               descendant that re-declares `visibility: visible`.
 *
 * ⚠ SO AT `line` BOTH ARE IN THE DOM AND EXACTLY ONE IS VISIBLE. That is the
 * discrimination these cases make, and it is the strongest one jsdom supports.
 */
describe('the count is painted exactly once at every rung', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('full: one card-face line, and no reduced line to double it', () => {
    renderDecision(linked(3))
    expect(screen.getAllByTestId(CARD_FACE)).toHaveLength(1)
    expect(lodLine()).toBeNull()
  })

  /**
   * ⭐ THE MIDDLE RUNG, WHICH IS WHERE THE PRODUCT'S OWN AUTO-FIT PARKS.
   * `useFitViewOnLayoutVersion` floors the camera at `LABEL_LEGIBLE_ZOOM`, and
   * `quiet` is the band immediately above it — so this is the rung a real
   * reader lands on after a draft, and the one a "it only doubles when zoomed
   * out" assumption would leave untested.
   */
  it('quiet, lens idle: still exactly one, because the lens has set nothing aside', () => {
    renderDecision({ ...linked(3), lodRung: 'quiet' })
    expect(screen.getAllByTestId(CARD_FACE)).toHaveLength(1)
    expect(lodLine()).toBeNull()
  })

  /**
   * ⭐ THE `line` RUNG — AND THE ASSERTION IS THE MECHANISM, NOT THE PIXELS.
   *
   * Both elements are in the DOM. What must be true is that the card-face line
   * is INSIDE the blanked wrapper (so it inherits `visibility: hidden`) while
   * the reduced line re-declares itself visible. Asserting "only one element
   * contains the text" would be FALSE here and asserting "both exist" would be
   * vacuous; this is the property that actually distinguishes a correct render
   * from a doubled one.
   */
  it('line: both are in the tree, and only the reduced one declares itself visible', () => {
    renderDecision({ ...linked(3), lodRung: 'line' })

    const face = cardFace()
    const lod = lodLine()
    expect(face).not.toBeNull()
    expect(lod).not.toBeNull()

    // Same fact, same string — which is why the doubling would be visible.
    expect(cardFaceText()).toBe('3 alternatives')
    expect(lodLineText()).toBe('3 alternatives')

    // The card-face line sits under the wrapper the LOD rung blanks...
    expect(face!.closest(`[${LOD_BLANKED_BODY_ATTR}]`)).not.toBeNull()
    // ...and declares no visibility of its own, so it inherits `hidden`.
    expect(face!.style.visibility).toBe('')
    // The reduced line is the one that overrides the hidden ancestor.
    expect(lod!.style.visibility).toBe('visible')
  })

  /**
   * ⛔ THE CONTROL THAT STOPS THE CASE ABOVE PASSING BY ACCIDENT (trap 13b — a
   * guard whose discrimination depends on a precondition nothing pins). Every
   * assertion in it is conditional on the blanking actually being engaged; if
   * `lodBodyBlanked` ever stopped firing, `closest()` would return null and the
   * case would red — but only because of THIS assertion, which pins the
   * precondition as a fact in its own right rather than as a side effect.
   */
  it('PRECONDITION — the blanking wrapper is engaged at the line rung and absent at full', () => {
    // Scoped by `container`, not by `screen`: both renders live in the same
    // document, so a global query would see the other arm's tree.
    const { container: atLine } = renderDecision({ ...linked(3), lodRung: 'line' })
    expect(atLine.querySelector(`[${LOD_BLANKED_BODY_ATTR}]`)).not.toBeNull()

    const { container: atFull } = renderDecision({ ...linked(3), lodRung: 'full' })
    expect(atFull.querySelector(`[${LOD_BLANKED_BODY_ATTR}]`)).toBeNull()
  })

  /**
   * ⭐ THE TWO SURFACES ARE ONE STRING BY CONSTRUCTION (trap 12). If a later
   * change respells either of them, this reds — which is the only thing that
   * would notice the card face and the reduced line starting to disagree about
   * how to say the same number.
   */
  it('and the two surfaces state the SAME string, from the same composer', () => {
    renderDecision({ ...linked(4), lodRung: 'line' })
    expect(cardFaceText()).toBe(lodLineText())
    expect(cardFaceText()).toBe(composeOptionCountLine(4))
  })

  /**
   * ⛔ THE ONE PLACE THE TWO SURFACES ARE ALLOWED TO DIFFER, pinned so the
   * divergence is deliberate rather than a drift. Below the legibility floor a
   * card gets ONE line, so an unnamed question must spend it on the authoring
   * prompt. At reading zoom nothing is being traded and the count still shows.
   */
  it('CONTRAST — an unnamed question spends its one reduced line on the prompt, and still shows the count at reading zoom', () => {
    renderDecision({ ...linked(3), lodRung: 'line' }, '')
    expect(lodLineText()).toBe(DECISION_RESTING_COPY.unnamedLine)
    expect(cardFaceText()).toBe('3 alternatives')
  })
})
