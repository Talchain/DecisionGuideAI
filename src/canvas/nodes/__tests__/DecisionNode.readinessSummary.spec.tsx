/**
 * DecisionNode — THE READINESS SUMMARY ON THE ANCHOR CARD.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT PAUL REPORTED (7 Sep 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 * *"The current question node lacks value. There's not enough information or
 * functionality within it. It also doesn't need to say what you gave me. The
 * user should be able to see that."*
 *
 * Two halves, and this file pins both.
 *
 * 1. THE BRIEF ECHO IS REMOVED. `DecisionNode.anchorBrief.spec.tsx` is deleted
 *    with it — a declared deletion, not an incidental one. The store it read
 *    (`contextIntegrityStore`) keeps a live product consumer in
 *    `WhatIWasGivenSection`, so the draft-turn write is not orphaned and the
 *    user can still see their brief, which is exactly what Paul said.
 *
 * 2. SOMETHING DERIVED TAKES ITS PLACE. `useModelReadiness` runs on every render
 *    of this node and its four counts reached exactly one surface: a popover
 *    gated `!isPostAnalysis && optionCount > 0`. After a run the node HELD the
 *    whole readiness breakdown and showed none of it. Nothing new is computed
 *    here; a fact the component already had is put where a user can read it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ THE TWO CONSTRAINTS THIS FILE EXISTS TO HOLD
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ NO LEADER CLAIM, EVER. The summary's every input is a property of the
 *    GRAPH — how many factors exist, and how each one's value got there. It
 *    reads no `report`, no `headline`, no verdict. §4 below pins that on the
 *    fixture where the producer WITHHELD a leader: the summary renders and the
 *    leader sentence stays absent, in the same render. A structural fact needs
 *    no analysis permission, and this must never become something that does.
 *
 * ⛔ THE HONESTY GUARD IS EXTENDED, NEVER WEAKENED. The line renders INSIDE
 *    `decision-node-resting-state`, which `DecisionNode.restingState.spec.tsx`
 *    covers with a forbidden-word regex. That file now ALSO enumerates
 *    `DECISION_READINESS_COPY` and renders a factor-bearing fixture through its
 *    corpus. The regex is untouched — §5 here re-derives its verdict on the
 *    rendered line as a cross-check, with a positive control proving the
 *    predicate can still fail.
 *
 * CLAUDE.md trap 3: these assert the presence/absence of TEXT. jsdom cannot
 * prove visibility and nothing here claims it does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import {
  DecisionNode,
  DECISION_RESTING_COPY,
  DECISION_READINESS_COPY,
  READINESS_SEPARATOR,
  composeReadinessSummary,
  popoverLabel,
  type ModelReadiness,
} from '../DecisionNode'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { canvasCopyIsHonest } from './__helpers__/canvasCopyHonesty'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

// Transparent popover, same reason as the sibling specs: the real one is behind
// a 300ms hover delay and an anchor measurement, neither of which fire in jsdom.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

const hoisted = vi.hoisted(() => ({ state: null as any }))

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => unknown) => selector(hoisted.state)),
    { getState: () => hoisted.state },
  ),
}))

const DECISION_ID = 'decision-1'
const SUMMARY = 'decision-node-readiness-summary'
const RESTING = 'decision-node-resting-state'

const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision' } }
const optionNodes = [
  { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire three' } },
  { id: 'option-2', type: 'option', data: { type: 'option', label: 'Hire none' } },
]
const optionEdges = [
  { id: 'e1', source: DECISION_ID, target: 'option-1', data: {} },
  { id: 'e2', source: DECISION_ID, target: 'option-2', data: {} },
]

// ── Factor fixtures, one per bucket `useModelReadiness` can put a factor in ──
//
// The bucket rules are the PRODUCER's, read off `useModelReadiness` rather than
// from my own idea of what the words ought to mean (CLAUDE.md trap 13c):
// `category === 'external'` wins outright; then a factor with neither a value
// nor a complete prior range is MISSING; then `extractionType === 'inferred'`
// is ESTIMATED; everything else is EXPLICIT.
const explicitFactor = (id: string) => ({
  id,
  type: 'factor',
  data: { type: 'factor', label: `Explicit ${id}`, category: 'controllable', observedState: { value: 42 } },
})
const inferredFactor = (id: string) => ({
  id,
  type: 'factor',
  data: {
    type: 'factor',
    label: `Inferred ${id}`,
    category: 'controllable',
    observedState: { value: 7, extractionType: 'inferred' },
  },
})
const missingFactor = (id: string) => ({
  id,
  type: 'factor',
  data: { type: 'factor', label: `Missing ${id}`, category: 'controllable' },
})
const externalFactor = (id: string) => ({
  id,
  type: 'factor',
  data: { type: 'factor', label: `External ${id}`, category: 'external' },
})
/**
 * ⭐ THE DISCRIMINATOR FOR "TOTAL IS THE SUM, NOT THE NODE COUNT".
 * `useModelReadiness` does `if (!data) continue`, so a factor node with no data
 * is IN `factorNodes` and in NONE of the four buckets. A total taken from the
 * node list would print one more factor than its own breakdown accounts for.
 */
const dataLessFactor = (id: string) => ({ id, type: 'factor' })

/** Two comparable options and NO producer leader claim — the state Paul saw. */
const WITHHELD_REPORT = {
  option_probabilities: {
    'option-1': { win_probability: 0.55 },
    'option-2': { win_probability: 0.45 },
  },
  robustness: { recommended_option_id: 'option-1', recommendation_stability: 0.62 },
}

/** The same run, plus the producer's own `near_tie` leader claim. */
const PERMITTED_REPORT = {
  option_probabilities: WITHHELD_REPORT.option_probabilities,
  robustness: {
    recommended_option_id: 'option-1',
    near_tie: { is_tie: false, top_option_id: 'option-1' },
  },
}

const setStore = (overrides: Record<string, unknown> = {}) => {
  hoisted.state = {
    edges: [],
    nodes: [decisionNode],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    viewMode: 'standard',
    selectNodeWithoutHistory: vi.fn(),
    ...overrides,
  }
}

const baseProps = {
  id: DECISION_ID,
  type: 'decision',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  data: { label: 'Should we hire?', type: 'decision' },
}

const renderDecision = (overrides: Partial<typeof baseProps> = {}) =>
  render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} {...(overrides as any)} />
    </ReactFlowProvider>,
  )

/**
 * The completed-run card, in Standard view, with the producer withholding a
 * leader — the state Paul reported, and the one these tests mount. `factors` is
 * spread in so each test states the model it is making a claim about.
 *
 * ⚠ IT IS NOT THE ONLY STATE THE SUMMARY IS REACHABLE IN. This docstring said
 * it was, on the same axis the PR body already withdrew (`report` is not
 * required; there is no leader-claim gate on the summary) — the withdrawal
 * swept the sentence and not the surface, which is why round 2 blocked on it.
 * Derived at the bytes rather than restated: `showReadinessSummary` is
 * `Boolean(readinessSummary) && restingLineIsContentFree`, and
 * `restingLineIsContentFree` resolves through `hasPostAnalysisPopover`, which
 * is `isPostAnalysis && !isDetailed` — it reads no `report`, no `headline` and
 * no admission. So a SECOND state reaches the summary: `status: 'complete'`
 * with `report: null` and `optionCount === 0` falls to the third,
 * UNCONDITIONAL `bodyFallback` arm while the line is still `completedRunLine`.
 * The reviewer measured it renders there ("2 factors · 1 missing"), against a
 * positive control in the same run. Nothing in this file mounts that state, and
 * no test here claims to cover it.
 */
const mountCompletedRun = (factors: unknown[], overrides: Record<string, unknown> = {}) => {
  setStore({
    nodes: [decisionNode, ...optionNodes, ...factors],
    edges: optionEdges,
    results: { status: 'complete', report: WITHHELD_REPORT },
    viewMode: 'standard',
    ...overrides,
  })
  return renderDecision()
}

const readiness = (over: Partial<ModelReadiness> = {}): ModelReadiness => ({
  explicitCount: 0,
  inferredCount: 0,
  missingCount: 0,
  externalCount: 0,
  biasTriggers: [],
  ...over,
})

describe('composeReadinessSummary — the string, derived from the one copy record', () => {
  // ── §1 THE COMPOSER ──────────────────────────────────────────────────────
  //
  // Every expectation is BUILT FROM `DECISION_READINESS_COPY`, never re-typed.
  // A test that restates the words would keep passing after a rename while the
  // card and the popover drifted apart — the hand-maintained mirror this record
  // exists to abolish (CLAUDE.md trap 12).

  it('a model with nothing to count returns null — not "0 factors"', () => {
    expect(composeReadinessSummary(readiness())).toBeNull()
  })

  it('the head segment is the TOTAL, and it is singular at one', () => {
    expect(composeReadinessSummary(readiness({ explicitCount: 1 }))).toBe(
      `1 ${DECISION_READINESS_COPY.factorSingular}`,
    )
    expect(composeReadinessSummary(readiness({ explicitCount: 2 }))).toBe(
      `2 ${DECISION_READINESS_COPY.factorPlural}`,
    )
  })

  it('the total is the SUM of all four buckets, external included', () => {
    const summary = composeReadinessSummary(
      readiness({ explicitCount: 1, inferredCount: 2, missingCount: 3, externalCount: 4 }),
    )
    // Bound to the number, not to a substring another segment could satisfy.
    expect(summary?.startsWith(`10 ${DECISION_READINESS_COPY.factorPlural}${READINESS_SEPARATOR}`)).toBe(true)
  })

  it('the three qualifiers are spelled when non-zero, in the popover’s own order', () => {
    expect(
      composeReadinessSummary(readiness({ explicitCount: 1, inferredCount: 2, missingCount: 1, externalCount: 3 })),
    ).toBe(
      [
        `7 ${DECISION_READINESS_COPY.factorPlural}`,
        `2 ${DECISION_READINESS_COPY.inferred}`,
        `1 ${DECISION_READINESS_COPY.missing}`,
        `3 ${DECISION_READINESS_COPY.external}`,
      ].join(READINESS_SEPARATOR),
    )
  })

  it('a zero bucket is omitted rather than printed as zero', () => {
    const summary = composeReadinessSummary(readiness({ explicitCount: 4 })) ?? ''
    expect(summary).toBe(`4 ${DECISION_READINESS_COPY.factorPlural}`)
    for (const word of [DECISION_READINESS_COPY.inferred, DECISION_READINESS_COPY.missing, DECISION_READINESS_COPY.external]) {
      expect(summary).not.toContain(word)
    }
  })

  it('`explicit` is never spelled on the card — it is the remainder, and the popover owns that word', () => {
    // The word must still EXIST in the record (the popover renders it), so this
    // is a claim about the CARD LINE, not about the vocabulary. Both halves are
    // asserted so a rename cannot make this pass vacuously.
    expect(DECISION_READINESS_COPY.explicit.length).toBeGreaterThan(0)
    expect(composeReadinessSummary(readiness({ explicitCount: 3 }))).not.toContain(
      DECISION_READINESS_COPY.explicit,
    )
  })
})

describe('DecisionNode — the readiness summary on the card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setStore()
    useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn() } as any)
  })

  afterEach(() => {
    cleanup()
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as any)
  })

  // ── §2 THE STATE PAUL SAW ────────────────────────────────────────────────

  it('post-analysis Standard with the leader withheld: the card states the readiness breakdown', () => {
    mountCompletedRun([
      explicitFactor('f1'),
      inferredFactor('f2'),
      inferredFactor('f3'),
      missingFactor('f4'),
    ])

    // Positive control first: the node rendered at all (CLAUDE.md trap 13).
    expect(screen.getByText('Should we hire?')).toBeDefined()

    // DERIVED, not restated — the expected string is composed from the same
    // record the component reads, so a rename moves both together.
    const expected = composeReadinessSummary(
      readiness({ explicitCount: 1, inferredCount: 2, missingCount: 1 }),
    )
    expect(expected).toBe(
      `4 ${DECISION_READINESS_COPY.factorPlural}${READINESS_SEPARATOR}` +
        `2 ${DECISION_READINESS_COPY.inferred}${READINESS_SEPARATOR}` +
        `1 ${DECISION_READINESS_COPY.missing}`,
    )
    expect(screen.getByTestId(SUMMARY).textContent).toBe(expected)
  })

  it('the summary sits INSIDE the guarded resting subtree, above the wayfinding line', () => {
    mountCompletedRun([explicitFactor('f1'), missingFactor('f2')])

    const resting = screen.getByTestId(RESTING)
    // Containment is the honesty claim: the guard only covers what is inside.
    expect(within(resting).getByTestId(SUMMARY)).toBeDefined()
    // The wayfinding line is NOT displaced — it points at a popover that really
    // does hold stability detail, which the control below proves.
    expect(within(resting).getByText(DECISION_RESTING_COPY.completedRunLine)).toBeDefined()
    const popover = screen.getByTestId('decision-node-popover')
    expect(within(popover).getByText(/62%/)).toBeDefined()
  })

  it('the total counts factors the breakdown can actually account for, not factor NODES', () => {
    // Three counted factors plus one with no `data` at all, which
    // `useModelReadiness` skips. A total read off the node list would say four.
    mountCompletedRun([
      explicitFactor('f1'),
      inferredFactor('f2'),
      missingFactor('f3'),
      dataLessFactor('f4'),
    ])

    const text = screen.getByTestId(SUMMARY).textContent ?? ''
    expect(text).toBe(
      composeReadinessSummary(readiness({ explicitCount: 1, inferredCount: 1, missingCount: 1 })),
    )
    expect(text.startsWith(`3 ${DECISION_READINESS_COPY.factorPlural}`)).toBe(true)
    // The failure this pins, stated as its own assertion so the reason survives.
    expect(text).not.toContain(`4 ${DECISION_READINESS_COPY.factorPlural}`)
  })

  it('a completed run with no factors keeps its wayfinding line and adds no empty count', () => {
    mountCompletedRun([])
    // Precondition: the fallback really is on screen, so this is a claim about
    // the summary and not about a card that failed to mount (trap 13b).
    expect(screen.getByTestId(RESTING)).toBeDefined()
    expect(screen.getByText(DECISION_RESTING_COPY.completedRunLine)).toBeDefined()
    expect(screen.queryByTestId(SUMMARY)).toBeNull()
  })

  // ── §3 WHERE IT MUST NOT RENDER ──────────────────────────────────────────
  //
  // Each of these asserts its own PRECONDITION, so an absence cannot pass
  // because the fixture stopped reaching the seam (CLAUDE.md trap 13b).

  it('the CTA arm is left alone: no options linked keeps the authoring prompt undiluted', () => {
    setStore({ nodes: [decisionNode, explicitFactor('f1'), missingFactor('f2')], edges: [] })
    renderDecision()
    // Precondition: the factors ARE in the store and the CTA arm IS the one on
    // screen — so the absence below is the rule, not a missing fixture.
    expect(composeReadinessSummary(readiness({ explicitCount: 1, missingCount: 1 }))).not.toBeNull()
    expect(screen.getByText(DECISION_RESTING_COPY.noOptionsLine)).toBeDefined()
    expect(screen.queryByTestId(SUMMARY)).toBeNull()
  })

  it('the CTA arm is left alone: an unnamed node keeps the naming prompt undiluted', () => {
    setStore({ nodes: [decisionNode, explicitFactor('f1'), inferredFactor('f2')], edges: [] })
    renderDecision({ data: { type: 'decision' } as any })
    // Precondition: this model HAS a summary to show, so the absence below is
    // the CTA-arm rule and not an empty graph (CLAUDE.md trap 13b).
    expect(composeReadinessSummary(readiness({ explicitCount: 1, inferredCount: 1 }))).not.toBeNull()
    expect(screen.getByText(DECISION_RESTING_COPY.unnamedLine)).toBeDefined()
    expect(screen.queryByTestId(SUMMARY)).toBeNull()
  })

  it('a card that already has content does not get a summary bolted underneath', () => {
    setStore({
      nodes: [decisionNode, ...optionNodes, explicitFactor('f1'), missingFactor('f2')],
      edges: optionEdges,
      results: { status: 'complete', report: PERMITTED_REPORT },
      viewMode: 'standard',
    })
    renderDecision()
    // Precondition: the producer-owned leader sentence really is on screen.
    expect(screen.getByText(/leads in 55% of scenarios/i)).toBeDefined()
    expect(screen.queryByTestId(RESTING)).toBeNull()
    expect(screen.queryByTestId(SUMMARY)).toBeNull()
  })

  /**
   * ⭐ THE REACHABILITY DERIVATION, ASSERTED RATHER THAN COMMENTED.
   *
   * `restingLineIsContentFree` has ONE arm because `emptyLine` cannot reach the
   * fallback: `showPreAnalysisInvitations` IS `isPreAnalysisBranch`, so
   * `bodyHasContent` is unconditionally true whenever options are linked
   * pre-analysis. These two pin that, so a future change that makes the
   * fallback reachable pre-analysis REDs here instead of silently producing a
   * summary above "Nothing to show on this node".
   */
  it('pre-analysis with options linked never reaches the fallback at all', () => {
    setStore({
      nodes: [decisionNode, ...optionNodes, explicitFactor('f1'), missingFactor('f2')],
      edges: optionEdges,
    })
    renderDecision()
    // Precondition: the pre-analysis branch really did render its own content.
    expect(screen.getByText(/Top gap:/i)).toBeDefined()
    expect(screen.queryByTestId(RESTING)).toBeNull()
    expect(screen.queryByTestId(SUMMARY)).toBeNull()
  })

  it.each([
    ['post-analysis Standard, leader withheld', () => { mountCompletedRun([explicitFactor('f1')]) }],
    ['no options linked', () => { setStore({ nodes: [decisionNode], edges: [] }); renderDecision() }],
    ['unnamed', () => {
      setStore({ nodes: [decisionNode], edges: [] })
      renderDecision({ data: { type: 'decision' } as any })
    }],
  ])('`emptyLine` is never the line the fallback renders — %s', (_name, mount) => {
    ;(mount as () => void)()
    const resting = screen.getByTestId(RESTING)
    expect(resting.textContent?.trim().length).toBeGreaterThan(0)
    expect(resting.textContent).not.toContain(DECISION_RESTING_COPY.emptyLine)
  })

  // ── §4 THE LEADER-CLAIM CONSTRAINT ───────────────────────────────────────

  it('⛔ the summary carries no leader claim: it renders while the verdict is WITHHELD', () => {
    mountCompletedRun([explicitFactor('f1'), inferredFactor('f2')])

    // The summary is on screen…
    expect(screen.getByTestId(SUMMARY).textContent).toBe(
      composeReadinessSummary(readiness({ explicitCount: 1, inferredCount: 1 })),
    )
    // …and the producer's withheld leader stays withheld, in the SAME render.
    expect(screen.queryByText(/leads in \d+% of scenarios/i)).toBeNull()
    expect(screen.queryByTestId('decision-leader-metric-row')).toBeNull()
  })

  it('⛔ the summary names no option and states no probability', () => {
    mountCompletedRun([explicitFactor('f1'), inferredFactor('f2'), missingFactor('f3')])
    const text = screen.getByTestId(SUMMARY).textContent ?? ''
    // The option labels are in the store on this fixture, so their absence here
    // is a property of the line and not of an empty graph.
    for (const option of optionNodes) {
      expect(hoisted.state.nodes).toContain(option)
      expect(text).not.toContain(option.data.label)
    }
    // 55/45 are in `WITHHELD_REPORT`; neither may appear.
    expect(text).not.toMatch(/%/)
    expect(text).not.toContain('55')
    expect(text).not.toContain('45')
  })

  /**
   * ⭐ THIS TEST REPLACES ONE THAT COULD NOT FAIL — review finding B1.
   *
   * It was named *"the summary is identical whether the producer licensed a
   * leader claim or not"* and its second assertion was
   * `composeReadinessSummary(readiness({…})) === composeReadinessSummary(readiness({…}))`
   * — the same pure function on the same literal arguments. `f(x) === f(x)`
   * cannot fail for any deterministic implementation, and the composer takes
   * only a `ModelReadiness`, so it could not read a report even if it wanted
   * to. The report never varied; the claim in the name was never measured.
   *
   * ⚠⚠ AND THE NAMED CLAIM IS NOT BINDABLE ON THE CARD — ON THE REPORT-SIDE
   * GATE, which is the one the original test varied. Measured, not argued: a
   * mutant appending a marker to the summary whenever the licensing field
   * `report.robustness.near_tie` is present left all 58 tests in these two
   * files GREEN. It has to: that field is exactly what makes
   * `verdict.hasLeadingOption` true, so
   * `headline` truthy, `bodyHasContent` truthy, and the whole `bodyFallback` —
   * the summary with it — absent. The licensed arm has NO summary to compare,
   * and no card-level assertion can hold the two side by side. That is why the
   * original fell back to the composer and produced a tautology: it was
   * reaching for a comparison the surface cannot make ON THAT AXIS.
   *
   * ⚠ NAME THE GATE, BECAUSE THERE ARE TWO (CLAUDE.md trap 21). "Licensed a
   * leader claim" covers the report-side gate above AND a second, independent
   * one: `modelLicensesComparativeClaim` — `licensesComparativeLeaderClaim(
   * useAnalysisAdmission())` at `DecisionNode.tsx:393`, which this file does
   * not mock and which defaults true. On THAT axis a comparison IS
   * constructible: with the report holding no leader, `headline` is null
   * whichever way the admission falls, so the summary renders in both arms.
   * The unbindability above is a claim about the report gate ONLY. This file
   * neither varies the admission axis nor claims to.
   *
   * ⛔ THE LICENSED ARM IS NOT LEFT UNMEASURED — it is measured in §3 above
   * (*"a card that already has content does not get a summary bolted
   * underneath"*), which mounts `PERMITTED_REPORT`, pins the precondition that
   * the leader sentence really is on screen, and asserts the summary is null.
   * The question is answered there. It is not retired; it is moved to the
   * section that can actually ask it.
   *
   * What IS true, bindable, and is what §4 exists to hold: the summary's every
   * input is a property of the GRAPH, so it does not read the report. This
   * varies the report materially — different win probabilities, a different
   * recommended option, stability present in one arm and absent in the other —
   * while holding the graph fixed, and asserts the line is byte-identical.
   */
  it('⛔ the summary reads no report: materially different runs, byte-identical line', () => {
    const factors = [explicitFactor('f1'), inferredFactor('f2'), missingFactor('f3')]
    const expected = composeReadinessSummary(
      readiness({ explicitCount: 1, inferredCount: 1, missingCount: 1 }),
    )

    /**
     * The SECOND run. Every analysis-owned field differs from `WITHHELD_REPORT`
     * — and `near_tie` is absent from BOTH, which is what keeps the summary
     * observable in both arms rather than suppressed in one.
     */
    const OTHER_WITHHELD_REPORT = {
      option_probabilities: {
        'option-1': { win_probability: 0.09 },
        'option-2': { win_probability: 0.91 },
      },
      robustness: { recommended_option_id: 'option-2' },
    }

    // ── PRECONDITIONS, PINNED IN-TEST ────────────────────────────────────────
    // A guard whose discrimination depends on a fixture that nothing pins is a
    // guard agreeing with itself: if these two reports silently became equal,
    // or if either grew a leader claim, the comparison below would still pass
    // while measuring nothing. Both hazards are asserted away here.
    expect(OTHER_WITHHELD_REPORT).not.toEqual(WITHHELD_REPORT)
    expect(OTHER_WITHHELD_REPORT.robustness.recommended_option_id).not.toBe(
      WITHHELD_REPORT.robustness.recommended_option_id,
    )
    expect(OTHER_WITHHELD_REPORT.option_probabilities['option-1'].win_probability).not.toBe(
      WITHHELD_REPORT.option_probabilities['option-1'].win_probability,
    )
    // Both arms are in the WITHHELD class, which is what keeps the summary
    // observable in BOTH: a leader claim in either arm would take the fallback
    // away there and the comparison would be one line against nothing.
    // ⚠ IT IS NOT AN EXCLUSIVE CLASS, and this comment used to say it was: the
    // fallback also renders on the unnamed and no-options arms (§3 above mounts
    // both), and the summary is reachable with `report: null` as well — see
    // `mountCompletedRun`, where that second arm is derived.
    expect('near_tie' in WITHHELD_REPORT.robustness).toBe(false)
    expect('near_tie' in OTHER_WITHHELD_REPORT.robustness).toBe(false)
    // And the two arms really do differ on whether stability is reported.
    expect(WITHHELD_REPORT.robustness.recommendation_stability).toBeDefined()
    expect(
      (OTHER_WITHHELD_REPORT.robustness as Record<string, unknown>).recommendation_stability,
    ).toBeUndefined()

    // ── ARM A ────────────────────────────────────────────────────────────────
    mountCompletedRun(factors)
    const armA = screen.getByTestId(SUMMARY).textContent
    expect(armA).toBe(expected)
    cleanup()

    // ── ARM B — same graph, a materially different run ───────────────────────
    setStore({
      nodes: [decisionNode, ...optionNodes, ...factors],
      edges: optionEdges,
      results: { status: 'complete', report: OTHER_WITHHELD_REPORT },
      viewMode: 'standard',
    })
    renderDecision()
    // The summary really did render in this arm too — without this the arms
    // could "agree" by both being absent.
    const armB = screen.getByTestId(SUMMARY).textContent
    expect(armB).toBe(expected)

    // The line is a function of the graph, which did not move.
    expect(armB).toBe(armA)
  })

  // ── §5 THE HONESTY GUARD, CROSS-CHECKED ──────────────────────────────────
  //
  // `DecisionNode.restingState.spec.tsx` owns the guard and now enumerates the
  // readiness record and renders a factor-bearing fixture through its corpus.
  // This re-derives its verdict on the composed line, with a positive control,
  // so a change here that made the line dishonest REDs in two files.

  // ⚠ THE REGEX IS NOT RE-SPELLED HERE, and it used to be. This file shipped a
  // BYTE-IDENTICAL copy of the sibling's `FORBIDDEN` (125 bytes, diffed) while
  // the sibling carried a comment promising there was no second copy — review
  // finding B2. Both now import the ONE definition from
  // `__helpers__/canvasCopyHonesty.ts`, so widening the guard is a single edit
  // and the two files cannot drift apart (CLAUDE.md trap 12).

  it('the honesty predicate can still fail (positive control)', () => {
    expect(canvasCopyIsHonest('2 uncertainties')).toBe(false)
    expect(canvasCopyIsHonest('the leading option')).toBe(false)
    expect(canvasCopyIsHonest(`4 ${DECISION_READINESS_COPY.factorPlural}`)).toBe(true)
  })

  it('every readiness word, and every summary the composer can build, is honest', () => {
    for (const word of Object.values(DECISION_READINESS_COPY)) {
      expect(word.trim().length).toBeGreaterThan(0)
      expect(canvasCopyIsHonest(word)).toBe(true)
    }
    // The composer over every non-empty combination of the four buckets, so a
    // segment that only appears in one arrangement cannot slip past.
    for (let mask = 1; mask < 16; mask++) {
      const summary = composeReadinessSummary(
        readiness({
          explicitCount: mask & 1 ? 1 : 0,
          inferredCount: mask & 2 ? 2 : 0,
          missingCount: mask & 4 ? 3 : 0,
          externalCount: mask & 8 ? 4 : 0,
        }),
      )
      expect(summary).not.toBeNull()
      expect(canvasCopyIsHonest(summary as string)).toBe(true)
    }
  })

  // ── §6 THE BRIEF ECHO IS GONE ────────────────────────────────────────────

  it('the anchor no longer echoes the brief back', () => {
    mountCompletedRun([explicitFactor('f1'), missingFactor('f2')])
    // Positive control: the card mounted and its body has content, so these two
    // absences are about the removal and not about a component that failed.
    expect(screen.getByTestId(SUMMARY)).toBeDefined()
    expect(screen.queryByTestId('decision-node-brief')).toBeNull()
    expect(screen.queryByTestId('decision-node-brief-text')).toBeNull()
    expect(screen.queryByText('What you gave me')).toBeNull()
  })

  // ── §7 THE POPOVER'S RENDERED BYTES ARE UNCHANGED ────────────────────────
  //
  // The popover's labels were inline literals and now derive from the shared
  // record. "Byte-identical" is a claim, so it is measured.

  it('the pre-analysis popover still renders its four labels exactly as before', () => {
    setStore({
      nodes: [
        decisionNode,
        ...optionNodes,
        explicitFactor('f1'),
        inferredFactor('f2'),
        missingFactor('f3'),
        externalFactor('f4'),
      ],
      edges: optionEdges,
    })
    renderDecision()

    const popover = screen.getByTestId('decision-node-popover')
    expect(within(popover).getByText('Model readiness')).toBeDefined()
    expect(within(popover).getByText('Explicit: 1')).toBeDefined()
    expect(within(popover).getByText('Estimated: 1')).toBeDefined()
    expect(within(popover).getByText('Missing: 1')).toBeDefined()
    expect(within(popover).getByText('External: 1')).toBeDefined()
  })

  it('the popover labels are the record’s own words, capitalised — not a second spelling', () => {
    expect(popoverLabel(DECISION_READINESS_COPY.explicit)).toBe('Explicit')
    expect(popoverLabel(DECISION_READINESS_COPY.inferred)).toBe('Estimated')
    expect(popoverLabel(DECISION_READINESS_COPY.missing)).toBe('Missing')
    expect(popoverLabel(DECISION_READINESS_COPY.external)).toBe('External')
  })
})
