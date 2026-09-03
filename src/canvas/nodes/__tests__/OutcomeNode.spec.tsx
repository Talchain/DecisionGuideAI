/**
 * OutcomeNode render tests
 * T9: Bridge edge data — contribution % + qualitative direction
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { METRIC_NOUN, METRIC_UNSET } from '../shared/metricVocabulary'

/**
 * ⭐ THE SEEN HALF OF THE ROW, AND THE DISTINCTION IS LOAD-BEARING (3 Sep 2026).
 *
 * Where nobody set the bridge strength, the producer's assumed figure is
 * DEMOTED to the row's screen-reader phrase rather than deleted — so
 * `container.textContent` still contains "85%" while nothing on screen does.
 * A guard that read the whole subtree would refuse the demotion this change is
 * built on. `NodeMetricRow` marks every seen element `aria-hidden`, so the two
 * audiences are already separated at the DOM; this reads the seen one.
 */
const seenText = (root: HTMLElement): string =>
  Array.from(root.querySelectorAll('[aria-hidden="true"]'))
    .map((el) => el.textContent ?? '')
    .join(' ')

import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OutcomeNode } from '../OutcomeNode'
import { USER_EDGE_DEFAULTS, DEFAULT_EDGE_DATA } from '../../domain/edges'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  edges: [],
  nodes: [],
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

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

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const baseProps = {
  id: 'outcome-1',
  type: 'outcome',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderOutcome = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <OutcomeNode {...(baseProps as any)} data={{ label: 'Revenue growth', type: 'outcome', ...data }} />
    </ReactFlowProvider>
  )


// R6 (Paul, 16 Aug 2026) — and the correction a review forced on it.
//
// The word "assumed" is gone: it printed beside EVERY bridge strength, including
// ones the user had stated, so it was false about half the values it labelled.
// What is NOT gone is the NOUN. The first attempt dropped it and left a bare
// "85%", which re-opens the very defect UI-SEM-089 exists to close — and the
// review measured that: the relabel-to-"% contribution" mutant REDs at base and
// SURVIVED at that head, because the guard had been flipped from a PRESENCE
// assertion to an ABSENCE one and could no longer see the masquerade.
//
// So the two claims are asserted SEPARATELY below, because they are separate:
//   • the honesty claim — a noun is present, on BOTH branches (PRESENCE)
//   • the placeholder claim — `est.` appears only when nobody stated the value
// Never collapse the first into the second again: an absence assertion cannot
// observe a relabel.
describe('OutcomeNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
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
    })
  })

  it('renders label', () => {
    renderOutcome()
    expect(screen.getByText('Revenue growth')).toBeDefined()
  })

  it('renders shape indicator (type line removed in v1.1)', () => {
    renderOutcome()
    expect(screen.getByLabelText(/outcome node/i)).toBeDefined()
  })

  it('has displayName set', () => {
    expect(OutcomeNode.displayName).toBe('OutcomeNode')
  })

  // T9: Bridge edge data
  it('does not show bridge edge data when results status is not complete', () => {
    renderOutcome()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('shows bridge edge impact on goal in results mode', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'outcome-1',
            target: 'goal-1',
            // Fixture stamped `weightSource: 'user'` (F4 follow-up) — see the
            // matching note in RiskNode.spec.tsx. An unstamped 0.75 is
            // indistinguishable from a UI default and no longer renders.
            data: { weight: 0.75, direction: 'positive', beliefExists: null, weightSource: 'user' },
          },
        ],
      }) as any)
    )
    renderOutcome()
    // UI-SEM-089 (F3, display honesty): the Layer-1 percentage is the static
    // assumed edge strength, NOT a computed goal contribution. Post-analysis it
    // must keep the honest "assumed strength" wording and must NEVER relabel to
    // "of your goal" just because results.status flipped to 'complete'.
    expect(screen.getByText(METRIC_NOUN.strength)).toBeInTheDocument() // UI-SEM-089: the noun, always
    expect(screen.queryByTestId('estimate-marker')).toBeNull() // user-stated: no `est.`
    expect(screen.queryByText(/of your goal/)).toBeNull()
    expect(screen.getByText(/75%/)).toBeDefined()
  })

  it('does not show certainty even when beliefExists is present', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'outcome-1',
            target: 'goal-1',
            data: { weight: 0.5, direction: 'positive', beliefExists: 0.8 },
          },
        ],
      }) as any)
    )
    renderOutcome()
    expect(screen.queryByText(/certain/)).toBeNull()
  })

  it('does not show bridge edge when no matching edge found', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          // edge goes the wrong way
          { id: 'e1', source: 'goal-1', target: 'outcome-1', data: {} },
        ],
      }) as any)
    )
    renderOutcome()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('does not show bridge edge when no goal node exists', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [{ id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } }],
        edges: [],
      }) as any)
    )
    renderOutcome()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('shows achievement probability when available', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.68,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderOutcome()
    expect(screen.getByText(`${METRIC_NOUN.chance}: 68%`)).toBeDefined()
  })

  // Display-honesty (ROADMAP 1.6b tail — goal-fit caveat residuals): same
  // modelled-basis caveat as GoalNode/OptionCards, gated on the
  // already-computed achievementProbabilityIsModelledBasis flag, rendered
  // adjacent to the achievement diagnostic line it qualifies.
  it('renders the modelled-basis caveat adjacent to the achievement number when flagged', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.68,
      achievementProbabilityIsModelledBasis: true,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderOutcome()
    expect(screen.getByTestId('goal-fit-basis-caveat-outcome-node')).toHaveTextContent(
      "Modelled from the target's projected outcome distribution, not a directly-set starting value.",
    )
  })

  it('renders no caveat on the achievement line when the flag is absent (honest default)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.68,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderOutcome()
    expect(screen.getByText(`${METRIC_NOUN.chance}: 68%`)).toBeDefined()
    expect(screen.queryByTestId('goal-fit-basis-caveat-outcome-node')).toBeNull()
  })

  // Wireframe v4 OutcomePostDet: Detailed view caps "Depends on:" ConnRows at 3
  // even when more inbound factors exist.
  it('caps Depends on ConnRows at 3 in Detailed post-analysis view', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
          { id: 'goal-1', data: { type: 'goal' } },
          { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Factor One' } },
          { id: 'f2', type: 'factor', data: { type: 'factor', label: 'Factor Two' } },
          { id: 'f3', type: 'factor', data: { type: 'factor', label: 'Factor Three' } },
          { id: 'f4', type: 'factor', data: { type: 'factor', label: 'Factor Four' } },
          { id: 'f5', type: 'factor', data: { type: 'factor', label: 'Factor Five' } },
        ],
        edges: [
          { id: 'b1', source: 'outcome-1', target: 'goal-1', data: { weight: 0.5, direction: 'positive' } },
          { id: 'e1', source: 'f1', target: 'outcome-1', data: { exists_probability: 0.9 } },
          { id: 'e2', source: 'f2', target: 'outcome-1', data: { exists_probability: 0.85 } },
          { id: 'e3', source: 'f3', target: 'outcome-1', data: { exists_probability: 0.8 } },
          { id: 'e4', source: 'f4', target: 'outcome-1', data: { exists_probability: 0.75 } },
          { id: 'e5', source: 'f5', target: 'outcome-1', data: { exists_probability: 0.7 } },
        ],
        viewMode: 'expert',
      }) as any)
    )
    renderOutcome()
    // First three sorted-by-confidence factors render; the 4th and 5th do not.
    expect(screen.getByText('Factor One')).toBeDefined()
    expect(screen.getByText('Factor Two')).toBeDefined()
    expect(screen.getByText('Factor Three')).toBeDefined()
    expect(screen.queryByText('Factor Four')).toBeNull()
    expect(screen.queryByText('Factor Five')).toBeNull()
  })
})

// Audit §8 P0-5: the capped "Depends on:" list discloses the remainder with
// a plain "+N more in inspector" line (whole rows only, no clipping).
describe('OutcomeNode — Depends on overflow disclosure (audit §8 P0-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
  })

  it('renders "+2 more in inspector" when 5 inbound factors exist', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
          { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Factor One' } },
          { id: 'f2', type: 'factor', data: { type: 'factor', label: 'Factor Two' } },
          { id: 'f3', type: 'factor', data: { type: 'factor', label: 'Factor Three' } },
          { id: 'f4', type: 'factor', data: { type: 'factor', label: 'Factor Four' } },
          { id: 'f5', type: 'factor', data: { type: 'factor', label: 'Factor Five' } },
        ],
        edges: [
          { id: 'e1', source: 'f1', target: 'outcome-1', data: { exists_probability: 0.9 } },
          { id: 'e2', source: 'f2', target: 'outcome-1', data: { exists_probability: 0.85 } },
          { id: 'e3', source: 'f3', target: 'outcome-1', data: { exists_probability: 0.8 } },
          { id: 'e4', source: 'f4', target: 'outcome-1', data: { exists_probability: 0.75 } },
          { id: 'e5', source: 'f5', target: 'outcome-1', data: { exists_probability: 0.7 } },
        ],
        viewMode: 'expert',
      }) as any)
    )
    renderOutcome()
    expect(screen.getAllByText('+2 more in inspector').length).toBeGreaterThan(0)
  })

  it('renders no overflow line with 3 or fewer inbound factors', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
          { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Factor One' } },
        ],
        edges: [
          { id: 'e1', source: 'f1', target: 'outcome-1', data: { exists_probability: 0.9 } },
        ],
        viewMode: 'expert',
      }) as any)
    )
    renderOutcome()
    expect(screen.queryByText(/more in inspector/)).toBeNull()
  })

  // ── F4: pre-analysis "Strongest: X at N%." was a UI default spoken as prose ──
  //
  // POSITIVE CONTROL FIRST. Without a demonstrated PRESENCE the absence cases
  // below prove nothing (trap 13): they would also pass if the popover simply
  // never rendered.
  describe('pre-analysis inbound strengths (F4)', () => {
    const preAnalysisStore = (edgeData: Record<string, unknown>) =>
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          results: { status: 'idle', report: null },
          nodes: [
            { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue growth' } },
            { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Unit price' } },
          ],
          edges: [{ id: 'e1', source: 'f1', target: 'outcome-1', data: edgeData }],
          viewMode: 'expert',
        }) as any)
      )

    it('POSITIVE CONTROL: DOES render the figure for a strength somebody set', () => {
      preAnalysisStore({ weight: 0.42, direction: 'positive', weightSource: 'cee' })
      renderOutcome()
      expect(screen.getByText(/Driven by:/)).toBeDefined()
      expect(screen.getByText('42%')).toBeDefined()
      expect(screen.queryByText(/Not set/)).toBeNull()
    })

    it('renders "Not set", never the USER_EDGE_DEFAULTS weight, for an edge merely drawn', () => {
      preAnalysisStore({ ...USER_EDGE_DEFAULTS })
      renderOutcome()
      // The row IS rendered — the relationship is real, only the number is not.
      expect(screen.getByText(/Driven by:/)).toBeDefined()
      expect(screen.getByText('Unit price')).toBeDefined()
      expect(screen.getByTestId('pre-analysis-strength-unset-e1')).toBeDefined()
      // 0.3 → "30%" must not appear anywhere in the card.
      expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
      expect(screen.queryByText('30%')).toBeNull()
    })

  })

  // ── NEW-1: the bridge-to-goal % had a gate that could not fire ───────────
  // `hasStrength = strength_mean present || weight != null` is a TAUTOLOGY —
  // DEFAULT_EDGE_DATA / USER_EDGE_DEFAULTS always define `weight` — so every
  // edge rendered the default as a bold coloured contribution figure. Same
  // shape as F1's dead read gate, in a different file.
  describe('bridge-to-goal contribution % (NEW-1)', () => {
    const bridgeStore = (edgeData: Record<string, unknown>) =>
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          results: { status: 'complete', report: null },
          nodes: [
            { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
            { id: 'goal-1', data: { type: 'goal' } },
          ],
          edges: [{ id: 'b1', source: 'outcome-1', target: 'goal-1', data: edgeData }],
        }) as any)
      )

    it('POSITIVE CONTROL: renders the figure for a strength somebody set', () => {
      bridgeStore({ weight: 0.6, direction: 'positive', weightSource: 'user' })
      renderOutcome()
      expect(screen.getByText(METRIC_NOUN.strength)).toBeInTheDocument() // UI-SEM-089: the noun, always
    expect(screen.queryByTestId('estimate-marker')).toBeNull() // user-stated: no `est.`
      expect(screen.getByText(/60%/)).toBeDefined()
    })


    it('⛔ a strength nobody stated states the UNKNOWN — no figure, no bar, no `est.`', () => {
      /*
       * ⚠⚠ THIS TEST USED TO ASSERT THE OPPOSITE, AND THE OPPOSITE WAS THE
       * DEFECT. It read: *"R6 POSITIVE CONTROL: a strength nobody stated
       * carries the est. marker"* — i.e. it certified that a producer's guess
       * printed as `60%` beside a proportional bar, qualified only by `est.` at
       * 7px. Measured on a real canvas 3 Sep 2026: five cards reading
       * `Strength 50% est.` at once, each bar exactly half full, for
       * `DEFAULT_EDGE_DATA.weight`. The disclaimer was never the fix; the
       * figure was the claim.
       */
      bridgeStore({ weight: 0.6, direction: 'positive', weightSource: 'cee' })
      const { container } = renderOutcome()
      expect(seenText(container)).not.toMatch(/60%/)
      expect(screen.getByText(METRIC_UNSET.standalone)).toBeInTheDocument()
      expect(screen.queryByTestId('estimate-marker')).toBeNull()
    })
    it('renders NO FIGURE for an edge nobody characterised (USER_EDGE_DEFAULTS) — it states the unknown', () => {
      // ⚠ RENAMED 3 Sep 2026. It said "renders NOTHING", and nothing is what it
      // used to do — which reads as "no connection here". The row now stays and
      // names the open question. The figure assertion is unchanged and is still
      // the load-bearing half: a UI fallback may never be printed.
      bridgeStore({ ...USER_EDGE_DEFAULTS })
      const { container } = renderOutcome()
      expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
      expect(seenText(container)).not.toMatch(/30%/)
      expect(screen.queryByTestId('estimate-marker')).toBeNull()
      expect(screen.getByText(METRIC_UNSET.standalone)).toBeInTheDocument()
    })

    it('renders NO FIGURE for a bare DEFAULT_EDGE_DATA weight of 0.5 — the exact witnessed default', () => {
      bridgeStore({ ...DEFAULT_EDGE_DATA })
      renderOutcome()
      expect(DEFAULT_EDGE_DATA.weight).toBe(0.5)
      expect(screen.queryByText(/50%/)).toBeNull()
      expect(screen.queryByTestId('estimate-marker')).toBeNull()
      // ⭐ 0.5 IS THE WITNESSED VALUE. Five cards printed it as `Strength 50%`
      // beside a half-full bar. The row stays; the figure does not.
      expect(screen.getByText(METRIC_UNSET.standalone)).toBeInTheDocument()
    })

    it('POSITIVE CONTROL: accepts CEE back-compat evidence (strength_mean)', () => {
      bridgeStore({ strength_mean: 0.45, weight: 0.3 })
      renderOutcome()
      expect(screen.getByText(/45%/)).toBeDefined()
    })
  })
})

/**
 * UI-SEM-089 anti-relabel guard, restored as a PRESENCE assertion.
 *
 * This is the assertion the review found missing. It is written against the
 * SPEC — "the number always carries a noun that names it as an input, and never
 * one that names it as a computed output" — not against the single relabel that
 * happened to be tried. So it bites on any member of the forbidden family, in
 * both phases, on both provenance branches.
 */
describe('OutcomeNode — UI-SEM-089: the bridge strength always carries an honest noun', () => {
  const FORBIDDEN = [/contribution/i, /of your goal/i, /goal drag/i, /impact on/i]

  const seedBridge = (weightSource: string) =>
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [{ id: 'b1', source: 'outcome-1', target: 'goal-1', data: { weight: 0.85, direction: 'positive', weightSource } }],
      }) as any)
    )

  /**
   * ⭐ THE DISCRIMINATING PAIR, RE-POINTED (3 Sep 2026). Both branches used to
   * assert the SAME thing — figure + noun — which made this table blind to the
   * one difference that matters. It now asserts what each branch is ENTITLED to
   * say. UI-SEM-089's actual requirement (the noun is never dropped, so an
   * unlabelled percentage cannot read as a computed contribution) holds on both.
   */
  it('renders the figure AND its noun on the user-stated branch', () => {
    seedBridge('user')
    renderOutcome()
    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText(METRIC_NOUN.strength)).toBeInTheDocument()
  })

  it('renders the NOUN and the unknown, and no figure, on the estimated branch', () => {
    seedBridge('cee')
    const { container } = renderOutcome()
    expect(seenText(container)).not.toMatch(/85%/)
    expect(screen.getByText(METRIC_UNSET.standalone)).toBeInTheDocument()
    expect(screen.getByText(METRIC_NOUN.strength)).toBeInTheDocument()
  })

  it.each([['user-stated', 'user'], ['estimated', 'cee']])(
    'never names it as a computed output on the %s branch',
    (_label, source) => {
      seedBridge(source)
      const { container } = renderOutcome()
      const text = container.textContent ?? ''
      for (const banned of FORBIDDEN) {
        expect(text).not.toMatch(banned)
      }
      // …and the permitted noun IS there, so this cannot pass by rendering
      // nothing at all — the failure mode an absence-only guard has.
      expect(text).toMatch(new RegExp(METRIC_NOUN.strength))
    },
  )

  it('⭐ the two claims stay separable — a figure on one branch, the unknown on the other', () => {
    /*
     * THE PAIR. If the row ignored provenance both branches would look alike;
     * if the fix had over-fired, the user-stated figure would have gone too —
     * the opposite-direction twin (CLAUDE.md trap 22b), and the reason this
     * asserts BOTH directions rather than only the one that was wrong.
     */
    seedBridge('user')
    const stated = renderOutcome()
    expect(seenText(stated.container)).toMatch(new RegExp(METRIC_NOUN.strength))
    expect(seenText(stated.container)).toMatch(/85%/)
    expect(stated.queryByText(METRIC_UNSET.standalone)).toBeNull()
    stated.unmount()

    seedBridge('cee')
    const estimated = renderOutcome()
    expect(seenText(estimated.container)).toMatch(new RegExp(METRIC_NOUN.strength))
    expect(seenText(estimated.container)).not.toMatch(/85%/)
    expect(estimated.getByText(METRIC_UNSET.standalone)).toBeInTheDocument()
    expect(estimated.queryByTestId('estimate-marker')).toBeNull()
  })
})
