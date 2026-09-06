/**
 * OptionNode render tests
 * T7: Win probability bar + Leading option badge
 * T8: Intervention chips with cleaned labels and formatted values
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
// The tie fixtures are pinned against the SHARED policy the component uses, so
// the precondition cannot silently stop reproducing the condition under test.
import {
  INFLUENCE_TIE_EPSILON,
  extractPolicyRow,
  selectDriverDisplayModel,
} from '../../../components/results/driverDisplayModel'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

// ROADMAP 1.223 — RENDER the producer's leader claim, never DERIVE one.
// `deriveDecisionVerdict` no longer bands raw win probabilities into a leader
// verdict, so a fixture carrying only `option_probabilities` licenses NO leader
// surface at all. Every fixture below that expects the "Leading option" badge
// (or any other leader-gated copy) therefore carries an explicit producer
// signal, and every fixture that expects the badge to be ABSENT carries one too
// — otherwise the absence assertion passes by testing nothing (trap 13).
//
// `near_tie` is PLoT's own answer to "is there a clear leader?"
// (`computeNearTie`, threshold 0.10). Its `top_option_id` names the
// WIN-PROBABILITY RANK-1 option, and that is what the verdict's identity gate
// checks it against — NOT `recommended_option_id`. A producer claim about
// option X is never re-pointed at option Y.
const producerLeaderClaim = (winArgmaxOptionId: string) => ({
  near_tie: { is_tie: false, top_option_id: winArgmaxOptionId },
})

// UI-SEM-088 gate: OptionNode's "chance of target" badge routes through
// selectGoalProbability, which reads this constant. Mutable getter so the
// suite can pin both the gate-ON suppression and the gate-OFF positive control.
// UI-SEM-088 seam 1: OptionNode's badge flows through selectGoalProbability,
// which reads PLOT_JOINT_HEADLINE_SUSPECT. `suspect` drives that flag; the mock
// also exports the seam-2 constant (whole-module replacement) fixed to its
// current default.
const mockTrust = vi.hoisted(() => ({ suspect: true }))
vi.mock('../../../adapters/plot/constraintTrust', () => ({
  get PLOT_JOINT_HEADLINE_SUSPECT() {
    return mockTrust.suspect
  },
  PLOT_PER_OPTION_CONSTRAINTS_SUSPECT: true,
}))

vi.mock('../../layoutStore', () => ({
  // Partial store state: only layoutNodeWidth is read by OptionNode. The
  // double-cast confines the mock to that shape without exporting the
  // store's internal LayoutOptions type.
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
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
import { useLayoutStore } from '../../layoutStore'
// ROADMAP 2.282 — the REAL chooser and the REAL copy register, so the
// possessive-gate tests below pin the shipped predicate and the shipped
// wording rather than a restatement of either.
import { selectGoalProbability } from '../../../components/results/utils/selectGoalProbability'
// COMPARATIVE_COPY is the ratified win-probability wording and its one owner.
// The density tests below assert against it rather than re-typing the sentence,
// so a change to the register moves the test with the product.
import { GOAL_ANCHOR_COPY, COMPARATIVE_COPY } from '../../../components/results/utils/goalAnchorCopy'
import { typography } from '../../../styles/typography'

const baseProps = {
  id: 'option-1',
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderOption = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Hire 3 engineers', type: 'option', ...data }} />
    </ReactFlowProvider>
  )

describe('OptionNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTrust.suspect = true // UI-SEM-088 gate ON by default; positive-control tests opt out locally
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
    vi.mocked(useLayoutStore).mockImplementation(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: null })) as never)
  })

  it('renders label', () => {
    renderOption()
    expect(screen.getByText('Hire 3 engineers')).toBeDefined()
  })

  it('renders shape indicator (type line removed in v1.1)', () => {
    renderOption()
    // Type text label removed in v1.1 — shape icon with tooltip replaces it
    expect(screen.getByLabelText(/option node/i)).toBeDefined()
  })

  // T7: Win probability
  it('does not show win probability outside results mode', () => {
    renderOption()
    expect(screen.queryByText(/win probability/)).toBeNull()
  })

  it('shows the comparative readout in results mode (re-anchored: was "{N}% win probability")', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderOption()
    expect(screen.getByText('Came out ahead in 72% of simulated scenarios')).toBeDefined()
  })

  // T7: Leading option badge. Post-1.223 this is the POSITIVE CONTROL against
  // over-suppression: with the producer's own leader claim on the report, the
  // badge must still render on the option that claim names.
  it('shows Leading option badge for highest winRate option', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    // Set up store with report using option_probabilities (the field responseMapper populates)
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.72 },
              'option-2': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.28 },
            },
            // Producer claim: option-1 (the win argmax) leads.
            robustness: producerLeaderClaim('option-1'),
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('Leading option')).toBeDefined()
  })

  // Discrimination pin: the producer claim names option-2, and the rendered
  // node is option-1. The badge must follow the claim's identity, not merely
  // the presence of a claim — so this stays RED if the badge ever fires on
  // "some leader exists" without checking WHICH option.
  it('does not show Leading option badge for non-highest option', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.28,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.28 },
              'option-2': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.72 },
            },
            // A leading option DOES exist on this run — it just isn't this node.
            robustness: producerLeaderClaim('option-2'),
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    expect(screen.queryByText('Leading option')).toBeNull()
  })

  // Cross-surface parity: the badge follows the backend recommendation
  // (recommended_option_id) so it agrees with the Results Panel, which honours
  // it first. Win-max is only the fallback when no recommendation is sent.
  //
  // Post-1.223 these two tests separate the two questions the verdict keeps
  // apart. ENTITLEMENT ("is there a leader at all?") comes from the producer
  // signal, whose `top_option_id` describes the WIN-PROBABILITY RANK-1 option.
  // IDENTITY ("who is it?") is then redirected by `recommended_option_id`.
  // So both fixtures name the win argmax in `near_tie` and the recommendation
  // in `recommended_option_id`, and they deliberately disagree.
  it('does not badge the win-max option when the backend recommends another (recommended_option_id wins)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
      achievementProbability: null, stabilityPercentage: null, winRate: 0.72, isResultsMode: true,
      predictedOutcome: null, valueOfInformation: null, voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { win_probability: 0.72 },
              'option-2': { win_probability: 0.28 },
            },
            // Entitlement: the producer says the win argmax (option-1) leads.
            // Identity: the producer recommends option-2 instead.
            robustness: { recommended_option_id: 'option-2', ...producerLeaderClaim('option-1') },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    // Rendered node is option-1 (the win-max leader) but the backend recommends option-2.
    renderOption()
    expect(screen.queryByText('Leading option')).toBeNull()
  })

  it('badges the recommended option even when it is not the win-max leader (recommended_option_id wins)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
      achievementProbability: null, stabilityPercentage: null, winRate: 0.28, isResultsMode: true,
      predictedOutcome: null, valueOfInformation: null, voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { win_probability: 0.28 },
              'option-2': { win_probability: 0.72 },
            },
            // Entitlement: the producer's claim describes the win argmax, which
            // is option-2 here — naming option-1 would NOT apply (identity gate)
            // and the badge would vanish from both nodes. Identity: the producer
            // recommends option-1, so the badge lands on the rendered node.
            robustness: { recommended_option_id: 'option-1', ...producerLeaderClaim('option-2') },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    // Rendered node is option-1, recommended by the backend despite a lower win.
    renderOption()
    expect(screen.getByText('Leading option')).toBeDefined()
  })

  // T8: Intervention chips
  it('shows intervention chips from ceeAnalysisReady', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.6 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          // observedState.value provides the baseline so the from→to chip renders
          // (brief scope 7: a chip needs both a baseline and an intervention value).
          data: { label: 'Hiring rate (0–1 scale)', observedState: { unit: 'fraction', value: 0.2 } },
        }],
      }) as any)
    )
    renderOption()
    // cleanFactorLabel strips "(0–1 scale)", stripFactorSuffixes strips "rate"
    // from → to format: label and value live in separate spans.
    expect(screen.getAllByText('Hiring').length).toBeGreaterThan(0)
    // from → to chip: baseline 0.2 → intervention 0.6, both formatted as '%'.
    expect(screen.getByText((t: string) => t.includes('60%') && t.includes('→'))).toBeDefined()
  })

  // Float-cleanup: count-unit chip values denormalise to floats (0.804 × 20 =
  // 16.080000000000002). They must render as whole numbers with no artefact.
  it('renders count-unit chip values as whole numbers (no float artefact)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-1': 0.804 } }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Developer Headcount', observedState: { unit: 'developers', value: 0.3, cap: 20 } },
        }],
      }) as any)
    )
    renderOption()
    // 0.3 × 20 = 6 baseline, 0.804 × 20 = 16.08… → rounded whole counts.
    expect(screen.getByText('6 developers → 16 developers')).toBeDefined()
    // No float-precision artefact leaks anywhere.
    expect(screen.queryByText((t: string) => t.includes('16.080'))).toBeNull()
  })

  // FTE is fractional by design — the count-rounding must NOT apply, so a
  // half-FTE intervention keeps its decimal (1.5 FTE, never "2 FTE").
  it('preserves fractional non-count units like FTE (no whole-number rounding)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-1': 0.15 } }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Engineering Capacity', observedState: { unit: 'FTE', value: 0.1, cap: 10 } },
        }],
      }) as any)
    )
    renderOption()
    // 0.1 × 10 = 1 baseline, 0.15 × 10 = 1.5 → FTE keeps the fraction.
    expect(screen.getByText((t: string) => t.includes('1 FTE') && t.includes('1.5 FTE'))).toBeDefined()
    // It must NOT be rounded to a whole number.
    expect(screen.queryByText((t: string) => /\b2 FTE\b/.test(t))).toBeNull()
  })

  // Scope A: a binary factor (0→1) with CEE display labels on BOTH sides —
  // intervention display_value (target) AND the factor's own display_value
  // (baseline state) — renders the payload labels verbatim. Never the
  // "0% → 100%" numeric fallback, never an invented "No X" heuristic.
  it('renders payload display labels on both sides for a binary chip when present', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-tl': { value: 1, display_value: 'Tech lead in place' } } }],
        },
        nodes: [{
          id: 'factor-tl',
          data: {
            label: 'Tech lead in place',
            display_value: 'No tech lead in place',
            observedState: { value: 0 },
          },
        }],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('No tech lead in place → Tech lead in place')).toBeDefined()
    // Neither the numeric fallback nor an invented "… active" heuristic appears.
    expect(screen.queryByText((t: string) => t.includes('0%') && t.includes('100%'))).toBeNull()
  })

  // Scope A guard: a binary chip WITHOUT payload labels keeps its existing
  // numeric "0% → 100%" rendering — Scope A's label path must NOT fabricate a
  // target label. (This mirrors the reported Hiring case: factor_type is set,
  // so the legacy value-only heuristic is suppressed and both sides are %.)
  it('keeps numeric 0% → 100% for a binary chip when payload labels are absent (never invents a target label)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-tl': 1 } }],
        },
        nodes: [{
          id: 'factor-tl',
          data: { label: 'Tech lead in place', observedState: { value: 0, factor_type: 'quality' } },
        }],
      }) as any)
    )
    renderOption()
    // ⚠ RE-PINNED 14 Aug — AND THIS ONE IS A KNOWN COST, NOT A CLEAN WIN.
    // 'Tech lead in place' is a PRESENCE factor mis-typed as 'quality' with no
    // unit, cap, raw anchor or encoding_map, so it degrades to tier words like
    // any other unframed qualitative factor: 0 → 'Very low', 1 → 'Very high'.
    // For a 0↔1 presence traversal "0% → 100%" was arguably the better read.
    // It is not reinstated here because the formatter sees ONE value at a time
    // and cannot know the other endpoint, so it cannot decide "full traversal"
    // coherently — a per-value rule that emitted '0%' for the baseline and
    // 'Low' for a 0.4 target would render "0% → Low", mixing two frames in one
    // chip. The real fix for this factor is an encoding_map or a binary
    // factor_type, not a reinstated percentage. Flagged for review.
    expect(screen.getByText((t: string) => t.includes('Very low') && t.includes('Very high') && t.includes('→'))).toBeDefined()
    // Scope A's both-labels branch did NOT fire: no fabricated target label.
    expect(screen.queryByText((t: string) => t.includes('→ Tech lead in place'))).toBeNull()
  })

  // Scope A edge case (Codex review): a 1 → 0 binary REVERSAL (removing the
  // factor) renders the baseline (value=1) label → target (value=0) label, in
  // that order, from the payload.
  it('renders both payload labels in order for a 1 → 0 binary reversal', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-tl': { value: 0, display_value: 'No tech lead in place' } } }],
        },
        nodes: [{
          id: 'factor-tl',
          data: {
            label: 'Tech lead in place',
            display_value: 'Tech lead in place', // factor observed at value=1 (baseline)
            observedState: { value: 1 },
          },
        }],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('Tech lead in place → No tech lead in place')).toBeDefined()
  })

  // Scope A edge case (Codex review): the baseline label may live under
  // observedState.display_value (legacy/in-flight shape) rather than top-level.
  // readFactorDisplayValue honours both, so the chip still renders labels.
  it('reads the baseline label from observedState.display_value when top-level is absent', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-tl': { value: 1, display_value: 'Tech lead in place' } } }],
        },
        nodes: [{
          id: 'factor-tl',
          data: {
            label: 'Tech lead in place',
            // No top-level display_value — only nested in observedState.
            observedState: { value: 0, display_value: 'No tech lead in place' },
          },
        }],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('No tech lead in place → Tech lead in place')).toBeDefined()
  })

  it('has displayName set', () => {
    expect(OptionNode.displayName).toBe('OptionNode')
  })

  // P1-4: layoutNodeWidth propagation — OptionNode must not override layoutNodeWidth
  // with a hardcoded maxWidth prop, so the store-driven width governs BaseNode sizing.
  it('P1-4: OptionNode respects layoutNodeWidth from store (no hardcoded 238px override)', () => {
    vi.mocked(useLayoutStore).mockImplementation(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: 180 })) as never)
    const { container } = renderOption()
    // BaseNode's root div carries an inline maxWidth style. In this test no
    // intervention chips are rendered (ceeAnalysisReady is null), so the only
    // element with an inline max-width is BaseNode's root div.
    // Use querySelectorAll('[style*="max-width"]') to find it precisely without
    // fragile DOM-walking that could match chip child elements.
    const maxWidthEls = container.querySelectorAll<HTMLElement>('[style*="max-width"]')
    expect(maxWidthEls.length).toBeGreaterThan(0)
    // The BaseNode root is the element with the layout-governed maxWidth.
    // Collect all found values and verify none is the old hardcoded 238px.
    const widths = Array.from(maxWidthEls).map(el => el.style.maxWidth)
    expect(widths).toContain('180px')
    expect(widths).not.toContain('238px')
  })

  // V2: Win probability number uses text-text-body (neutral, no coloured text in node body)
  it('comparative readout uses text-text-body class (not text-success or text-option)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.72 },
              'option-2': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.28 },
            },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    // CONVERTED, not deleted (31 Aug 2026 density change). The property this
    // test pins — no coloured text in the node body — is real and unchanged.
    // What changed is WHICH element carries the readout: the block is now a
    // bar and a bare percentage on one line, with the ratified sentence out of
    // flow for assistive technology. Reading the className off the SENTENCE
    // now reads the out-of-flow span, so the neutral-colour claim is asserted
    // against the element a sighted user actually sees.
    //
    // Bound by test id, not by text (trap 19): "72%" is a value another
    // element on a results card could carry.
    const percentEl = screen.getByTestId('option-win-readout-option-1')
    expect(percentEl.textContent).toBe('72%')
    expect(percentEl.className).toContain('text-text-body')
    expect(percentEl.className).not.toContain('text-success')
    expect(percentEl.className).not.toContain('text-option')
  })

  // ── Density: bar + percentage on one line, sentence on hover ─────────────
  //
  // Paul, 31 Aug 2026: "Saying the same copy on every node is a waste of
  // space… It should show the bar with the percentage next to it to save
  // space." The risk the change carries is that the sentence — the only thing
  // that says what the number MEANS — becomes unreachable for anyone who
  // cannot hover. These pin BOTH halves: the visible line is short, and the
  // sentence still exists.
  // COMPLETE against `NodeDisplayMetadata`, deliberately. The partial literals
  // used elsewhere in this file are the 27 pre-existing TS2345s the typecheck
  // ratchet holds a baseline for; a 28th would have failed the gate, and
  // silencing it with a cast would have added a new untyped mock instead.
  const mockWinRate72 = () =>
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
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
      winRate: 0.72,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })

  it('the anchor word is VISIBLE, not only in the hover text or the sr-only span', () => {
    // ⭐ THE REGRESSION THIS EXISTS TO PREVENT (31 Aug 2026). The first density
    // pass shipped the percentage BARE, with the ratified sentence reachable
    // only through `title` and an `sr-only` span. Screen-reader users were
    // fine; KEYBOARD-only users were not (this row is not focusable, so a
    // `title` cannot be reached) and neither were TOUCH users
    // (`(hover: hover)` is false). Two input classes got a number with no
    // statement of what it measures.
    //
    // So the assertion is deliberately about the VISIBLE tree, and it must
    // fail if the anchor is ever demoted back into `title`/`sr-only` — which
    // is exactly what a future density pass would do.
    mockWinRate72()
    renderOption()

    const anchorEl = screen.getByTestId('option-win-anchor-option-1')
    expect(anchorEl.textContent).toBe(COMPARATIVE_COPY.anchor)

    // NOT screen-reader-only: an `sr-only` anchor would satisfy a naive
    // "the word is present" check while remaining invisible to the two input
    // classes that lost it.
    expect(anchorEl.className).not.toContain('sr-only')
    expect(anchorEl.className).not.toContain(typography.screenReaderOnly)

    // The word must not be re-typed at the call site — it is the register's.
    expect(COMPARATIVE_COPY.phrase('72%')).toContain(COMPARATIVE_COPY.anchor.toLowerCase())
  })

  it('density: the VISIBLE readout is the bare percentage, and it is hidden from assistive tech', () => {
    mockWinRate72()
    renderOption()
    const percentEl = screen.getByTestId('option-win-readout-option-1')
    // The sentence must NOT be repeated in the visible line — that repetition
    // across five option cards is the whole defect being fixed.
    expect(percentEl.textContent).toBe('72%')
    // Hidden from assistive tech so the statistic is announced once, in full,
    // by the sentence below rather than as a number with no referent.
    expect(percentEl.getAttribute('aria-hidden')).toBe('true')
  })

  it('density: the ratified sentence survives as the hover title AND as text for assistive tech', () => {
    mockWinRate72()
    renderOption()
    const expected = COMPARATIVE_COPY.phrase('72%')

    // (a) hover: the row carrying the readout is the element with the title.
    // Reached FROM the readout rather than by a bare `[title]` sweep, so it
    // cannot pass on some other titled element elsewhere in the node.
    const row = screen.getByTestId('option-win-readout-option-1').closest('[title]')
    expect(row).not.toBeNull()
    expect(row?.getAttribute('title')).toBe(expected)

    // (b) not-hover: the same sentence is present as text, out of flow, so a
    // screen-reader user is not left with a bare number. Bound to the element
    // by its class as well as its text, so moving the sentence back into the
    // visible line would RED this.
    const srEl = screen.getByText(expected)
    expect(srEl.className).toContain('sr-only')

    // Positive control (trap 13): the copy comes from the ratified register,
    // and this test would be vacuous if that register were empty.
    expect(expected).toBe('Came out ahead in 72% of simulated scenarios')
  })

  it('density: the visible number and the sentence report the SAME statistic', () => {
    // One derivation, two renderings — pinned so a later edit to one call site
    // cannot leave a card whose bar, number and sentence disagree.
    mockWinRate72()
    renderOption()
    const percent = screen.getByTestId('option-win-readout-option-1').textContent
    // Not `!== ''`: an empty or null readout would make the assertion below
    // pass on a sentence the user never sees a number for.
    expect(percent).toMatch(/^[<>]?\s*[\d.]+%$/)
    expect(screen.getByText(COMPARATIVE_COPY.phrase(percent as string))).toBeDefined()
  })

  // V3: Leading option badge uses text-text-body (WCAG AA contrast on bg-success-light)
  //
  // Producer signal here is `decision_brief.headline_banded` rather than
  // `near_tie`, so the canvas badge is pinned against BOTH producer authorities
  // somewhere in this suite, not just the first one.
  it('Leading option badge uses text-text-body (not text-success)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.72 },
              'option-2': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.28 },
            },
            decision_brief: {
              headline_banded: {
                band: 'clearly_ahead',
                leader_option_id: 'option-1',
                robustness_gated: false,
              },
            },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    const badge = screen.getByText('Leading option')
    expect(badge.className).toContain('text-text-body')
    expect(badge.className).not.toContain('text-success')
  })

  // Null-safe paths — most likely regression sources in production
  it('renders "Untitled" when data.label is absent', () => {
    render(
      <ReactFlowProvider>
        <OptionNode {...baseProps} data={{ type: 'option' }} />
      </ReactFlowProvider>
    )
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('does not show intervention chips when ceeAnalysisReady is null', () => {
    renderOption()
    expect(screen.queryByText(/:/)).toBeNull()
  })

  it('does not show intervention chips when options array is empty', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ ceeAnalysisReady: { options: [] } }) as any)
    )
    renderOption()
    expect(screen.queryByText(/:/)).toBeNull()
  })

  it('does not show intervention chips when matching option has no interventions', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: { options: [{ id: 'option-1' }] },
      }) as any)
    )
    renderOption()
    expect(screen.queryByText(/:/)).toBeNull()
  })

  // G2: Qualitative factors show percentage instead of tier labels (v1.1 polish)
  // Rendered via the post-analysis Detailed "What this option changes:" list —
  // the pre-analysis Detailed "Interventions:" list was removed as a duplicate
  // of the delta pills (audit §8 P1).
  it('shows percentage for qualitative factor (no unit, factor_type "quality")', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.7 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: {
            label: 'Product-market fit',
            observedState: { factor_type: 'quality' },
          },
        }],
      }) as any)
    )
    renderOption()
    // arrow format: label and value are separate spans (no colon)
    expect(screen.getAllByText('Product-market fit').length).toBeGreaterThan(0)
    // ⚠ RE-PINNED 14 Aug. Previously '70%', commented "tier labels banned in
    // v1.1". That ban is what produced "Development headcount 0% → 40%" on the
    // live hiring graph: a 'quality' factor with no unit/cap/raw has no scale,
    // so the percentage was invented. 0.7 → 'High' per qualitativeTierLabel.
    expect(screen.getByText('High')).toBeDefined()
    expect(screen.queryByText('70%')).toBeNull()
  })

  it('shows numeric value for factor with unit even if factor_type is qualitative', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.6 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: {
            label: 'Revenue share',
            observedState: { unit: 'fraction', factor_type: 'quality' },
          },
        }],
      }) as any)
    )
    renderOption()
    // unit=fraction takes priority → '60%'
    expect(screen.getByText('60%')).toBeDefined()
  })

  it('formats intervention value correctly when value is nested object {value: N}', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': { value: 0.5 } },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Budget', observedState: { unit: 'fraction' } },
        }],
      }) as any)
    )
    renderOption()
    // formatInterventionValue(0.5, 'fraction') → '50%'
    expect(screen.getByText('50%')).toBeDefined()
  })

  it('renders CEE display_value verbatim on intervention chip, overriding numeric formatting', () => {
    // A value of 0.5 with unit="fraction" would normally render "50%". The
    // CEE-provided display_value must win over the numeric formatter.
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': { value: 0.5, display_value: 'Doubled capacity' } },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Capacity', observedState: { unit: 'fraction' } },
        }],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('Doubled capacity')).toBeDefined()
    // The numeric fallback must NOT also render.
    expect(screen.queryByText('50%')).toBeNull()
  })

  it('falls back to numeric formatting when display_value is absent (precedence gate)', () => {
    // Same shape as the verbatim test but without display_value — proves the
    // new gate does not break the legacy formatter path.
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': { value: 0.5 } },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Capacity', observedState: { unit: 'fraction' } },
        }],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('50%')).toBeDefined()
  })

  it('suppresses (+X%) delta when target chip has CEE display_value (scale-mismatch guard)', () => {
    // Post-analysis: non-baseline option with displayValue. Previously the
    // delta block would render "50% → Doubled capacity (+70.0%)" — a numeric
    // delta paired with a qualitative string. The delta must be suppressed.
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.7,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: { option_probabilities: { 'option-1': { win_probability: 0.7 } } },
        },
        ceeAnalysisReady: {
          options: [
            { id: 'option-1', interventions: { 'factor-1': { value: 0.85, display_value: 'Doubled capacity' } } },
            // Baseline option so baselineOptionInterventions resolves to 0.5
            { id: 'option-baseline', interventions: { 'factor-1': 0.5 } },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-baseline', type: 'option', data: { type: 'option', is_baseline: true, label: 'Baseline' } },
          { id: 'factor-1', data: { label: 'Capacity', observedState: { unit: 'fraction', value: 0.5 } } },
        ],
      }) as any)
    )
    renderOption()
    // Verbatim displayValue renders...
    expect(screen.getByText('Doubled capacity')).toBeDefined()
    // ...and the delta arrow with percentage does NOT.
    expect(screen.queryByText(/\(\+/)).toBeNull()
    expect(screen.queryByText(/→.*\(\+\d/)).toBeNull()
  })

  it('passthrough: displayValue is NOT mutated by stripEcho when it starts with the factor label (post-analysis intervention list)', () => {
    // stripEcho rewrites "Engineers added 5" → "added 5" when the factor
    // label is "Engineers". This is a UI heuristic — it must be bypassed
    // for CEE-authored display_value per F.6 passthrough.
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.7,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: { option_probabilities: { 'option-1': { win_probability: 0.7 } } },
        },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': { value: 0.8, display_value: 'Engineers added 5' } },
          }],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'factor-1', data: { label: 'Engineers', observedState: { unit: 'fraction', value: 0.2 } } },
        ],
      }) as any)
    )
    renderOption()
    // Verbatim CEE string must appear intact — including the leading word
    // that matches the factor label.
    expect(screen.getByText('Engineers added 5')).toBeDefined()
    // Must NOT be rewritten to the stripped form.
    expect(screen.queryByText('added 5')).toBeNull()
  })

  it('passthrough: displayValue is NOT mutated by stripEcho in Detailed inline list', () => {
    // Detailed view (viewMode='expert', post-analysis, !isBaseline) routes
    // through the Layer 2 inline "What this option changes:" list (the
    // pre-analysis "Interventions:" duplicate was removed — audit §8 P1).
    // Must bypass stripEcho for the CEE string.
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        viewMode: 'expert',
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': { value: 0.8, display_value: 'Headcount raised to 12' } },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Headcount', observedState: { unit: 'fraction', value: 0.2 } },
        }],
      }) as any)
    )
    renderOption()
    // The Detailed inline list renders "Interventions:" header + each chip.
    // At least one rendering of the verbatim string must appear.
    const matches = screen.getAllByText('Headcount raised to 12')
    expect(matches.length).toBeGreaterThan(0)
    // Stripped form must NOT appear.
    expect(screen.queryByText(/^raised to 12$/)).toBeNull()
  })

  it('differentiator sentence renders CEE display_value verbatim for shared-factor options', () => {
    // Two non-baseline options both intervening on the same factor with
    // distinct display_values. Phase 3 de-disambiguation should use the
    // verbatim CEE string rather than fabricating a tier label from the
    // scale-unit factor (which would produce "Very high" / "Very low").
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        viewMode: 'standard', // differentiator line shows in Standard pre-analysis
        ceeAnalysisReady: {
          options: [
            { id: 'option-1', interventions: { 'factor-1': { value: 0.9, display_value: 'Best in class' } } },
            { id: 'option-2', interventions: { 'factor-1': { value: 0.1, display_value: 'Barely adequate' } } },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option', label: 'Premium' } },
          { id: 'option-2', type: 'option', data: { type: 'option', label: 'Budget' } },
          { id: 'factor-1', type: 'factor', data: { label: 'Quality', observedState: { unit: 'scale', value: 0.5 } } },
        ],
      }) as any)
    )
    renderOption()
    // Differentiator sentence uses compactFactorLabel → "→ Best in class"
    expect(screen.getByText(/Best in class/)).toBeDefined()
    // Must NOT fabricate a tier label.
    expect(screen.queryByText(/Very high/)).toBeNull()
    expect(screen.queryByText(/^High$/)).toBeNull()
  })

  it('does not show win probability when winRate is null in results mode', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderOption()
    expect(screen.queryByText(/win probability/)).toBeNull()
  })

  it('does not show Leading option badge when resultsReport has no option_probabilities key', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.8,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    expect(screen.queryByText('Leading option')).toBeNull()
  })

  it('shows Leading option badge when a non-canvas option has higher rate in report', () => {
    // P0-2: only visible canvas option IDs count when computing max.
    //
    // Post-1.223 the fixture also pins WHICH argmax the producer's identity gate
    // is checked against. `near_tie.top_option_id` names option-1, the argmax
    // among VISIBLE options — the visible filter runs before the argmax is
    // taken. Drop that filter and rank 1 becomes option-hidden (0.95), the
    // producer claim no longer applies, the verdict falls to `unknown`, and the
    // badge disappears — so this stays a real pin on the filter, not just on
    // the badge.
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              // option-hidden is NOT on canvas — should be excluded from max
              'option-hidden': { goal_probability: 0.9, confidence: 0.5, win_probability: 0.95 },
              'option-1': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.72 },
              'option-2': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.28 },
            },
            // Names the argmax AMONG VISIBLE OPTIONS, not option-hidden.
            robustness: producerLeaderClaim('option-1'),
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
          // option-hidden is absent from canvas nodes
        ],
      }) as any)
    )
    renderOption()
    // option-1 has highest win rate among visible options → Leading option
    expect(screen.getByText('Leading option')).toBeDefined()
  })

  it('does not show Leading option badge when only one option node exists', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 1.0,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { goal_probability: 0.9, confidence: 0.5, win_probability: 1.0 },
            },
          },
        },
        nodes: [{ id: 'option-1', type: 'option', data: { type: 'option' } }],
      }) as any)
    )
    renderOption()
    // isRecommended requires length >= 2
    expect(screen.queryByText('Leading option')).toBeNull()
  })

  // V3: Intervention details render in expert overlay without chip styling.
  // Post-analysis Detailed list ("What this option changes:") — the
  // pre-analysis "Interventions:" duplicate was removed (audit §8 P1).
  it('intervention details in expert overlay have no chip styling (P1)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.6,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.6 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Hiring rate', observedState: { unit: 'fraction' } },
        }],
      }) as any)
    )
    const { container } = renderOption()
    // Expert overlay renders intervention details as plain text rows
    const expertDetail = container.querySelector('[class*="bg-info"]')
    expect(expertDetail).not.toBeNull()
    // Value span must be font-semibold in expert overlay (arrow format)
    const valueSpan = container.querySelector('span.font-semibold')
    expect(valueSpan).not.toBeNull()
  })

  // P0.2: Delta uses baseline option's intervention value when available
  it('uses baseline option intervention value as "from" side in delta display', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [
            {
              id: 'option-1', // non-baseline
              interventions: { 'factor-1': 0.59 },
            },
            {
              id: 'option-baseline', // baseline — intervention sets factor to 0.49
              interventions: { 'factor-1': 0.49 },
            },
          ],
        },
        nodes: [
          {
            id: 'option-1',
            type: 'option',
            data: { label: 'Raise price', type: 'option' },
          },
          {
            id: 'option-baseline',
            type: 'option',
            data: { label: 'Keep current pricing', type: 'option' },
          },
          {
            id: 'factor-1',
            data: {
              label: 'Price',
              observedState: { unit: '£', cap: 100, value: 0.49, raw_value: 49 },
            },
          },
        ],
      }) as any)
    )
    // option-1 is a non-baseline option (baseProps.id = 'option-1');
    // baseline option sets factor to 0.49 → £49; target option sets to 0.59 → £59
    // delta = (59-49)/49 ≈ +20.4%
    renderOption({ label: 'Raise price' })
    // The chip should show "£49 → £59 (+20.4%)"
    expect(screen.getByText(/£49/)).toBeDefined()
    expect(screen.getByText(/£59/)).toBeDefined()
    expect(screen.getByText(/\+20\.4%/)).toBeDefined()
  })

  // P7: Win bar uses max(8px, X%) for very low win probabilities
  it('uses minimum 8px win bar for very low win probability (P7)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.02,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    const { container } = renderOption()
    const bar = container.querySelector('.bg-option.rounded-full') as HTMLElement | null
    expect(bar).not.toBeNull()
    expect(bar?.style.width).toBe('max(4px, 2%)')
  })

  // ROADMAP 1.49 — the "chance of target" badge must use the SAME
  // goal_probability / probability_of_joint_goal fallback as
  // useResultsSectionData (consumed by OptionCards/hero/GoalNode), not a
  // narrower goal_probability-only read. On a constrained-goal run where
  // ISL/PLoT populate probability_of_joint_goal but NOT goal_probability
  // (constraint_analysis present with constraints — the joint figure IS the
  // number every other surface shows), the badge must still render using
  // that joint value rather than silently disappearing.
  // UI-SEM-088 gate ON: on a constrained-goal run where only the (suspect)
  // joint figure is present, selectGoalProbability suppresses it, so the badge
  // shows no number rather than a possibly-inverted one.
  const makeConstrainedJointOnlyStore = () =>
    makeStoreState({
      goalThreshold: 0.6, // UI-SEM-082: a user target is set so the badge would render
      results: {
        status: 'complete',
        report: {
          option_probabilities: {
            'option-1': {
              confidence: 0.5,
              win_probability: 0.5,
              probability_of_joint_goal: 0.05,
              constraint_analysis: { constraints: [{ id: 'c1' }], joint_probability: 0.05 },
            },
          },
        },
      },
      nodes: [
        { id: 'option-1', type: 'option', data: { type: 'option' } },
      ],
    })

  const mockResultsModeMetadata = () =>
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.5,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })

  it('gate ON: suppresses the "chance of target" badge when only the suspect joint figure is present', () => {
    mockTrust.suspect = true
    mockResultsModeMetadata()
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeConstrainedJointOnlyStore() as any)
    )
    renderOption()
    expect(screen.queryByText(/chance of target\./)).toBeNull()
  })

  it('POSITIVE CONTROL (gate OFF): shows "chance of target" badge from probability_of_joint_goal when goal_probability is absent', () => {
    mockTrust.suspect = false
    mockResultsModeMetadata()
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeConstrainedJointOnlyStore() as any)
    )
    renderOption()
    // 5% < 10% threshold → the warning line renders with the joint value,
    // matching what OptionCards/hero derive via useResultsSectionData.
    expect(screen.getByText(/5% chance of target\./)).toBeDefined()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // THE POSSESSIVE GATE (ROADMAP 2.282)
  //
  // The two tests above are the CONSTRAINED case (`constraint_analysis`
  // present ⇒ basis `joint_goal_constrained`), where the joint figure covers
  // the user's own goal AND their own limits and the possessive "chance of
  // target" is EARNED. The tests below are the SUBSTITUTED case — the same
  // joint number with no constraint analysis, standing in for a
  // `probability_of_goal` ISL refused to compute (witnessed live on staging
  // 2026-08-01: unstamped `goal_threshold_frame`). There the possessive names
  // a question the number does not answer, and the selector says so with
  // `mayUsePossessiveGoalFraming: false`.
  //
  // The pair is the point: the SAME 0.05-ish joint value must keep the
  // possessive in one fixture and lose it in the other, so a fix that simply
  // deleted the possessive copy fails the constrained test above.
  //
  // RED-first: both fail at `fef179ce`.
  const makeSubstitutedJointStore = () =>
    makeStoreState({
      goalThreshold: 0.8, // UI-SEM-082: a user target is set
      results: {
        status: 'complete',
        report: {
          option_probabilities: {
            'option-1': {
              confidence: 0.5,
              win_probability: 0.5,
              // The witnessed shape: the joint figure arrives, the goal
              // figure does not, and there is NO constraint_analysis — so the
              // selector's third branch fires and substitutes.
              probability_of_joint_goal: 0.0054,
              goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
            },
          },
        },
      },
      nodes: [{ id: 'option-1', type: 'option', data: { type: 'option' } }],
    })

  it('control: the substituted fixture really does drive the selector to `joint_goal_substituted` (not `joint_goal_constrained`)', () => {
    // Anti-vacuity (trap 13). If this fixture ever stopped being the
    // substituted case, the two copy tests below would pass by testing
    // nothing — and they would be indistinguishable from a real fix.
    mockTrust.suspect = false
    const substituted = selectGoalProbability({
      probability_of_joint_goal: 0.0054,
      goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
    })
    expect(substituted.basis).toBe('joint_goal_withheld')
    expect(substituted.mayUsePossessiveGoalFraming).toBe(false)
    // ⭐ L62: and the number is withheld, not merely re-voiced — which is what
    // makes the render assertion below an ABSENCE rather than a rewording.
    expect(substituted.goalProbability).toBeNull()

    // …and the neighbouring fixture is genuinely the OTHER basis.
    const constrained = selectGoalProbability({
      probability_of_joint_goal: 0.05,
      constraint_analysis: { constraints: [{ id: 'c1' }] },
    })
    expect(constrained.basis).toBe('joint_goal_constrained')
    expect(constrained.mayUsePossessiveGoalFraming).toBe(true)
  })

  /**
   * ⭐ AMENDED BY L62. ROADMAP 2.282 renamed the badge; L60 showed the VALUE
   * was the untruth, so the badge is now absent entirely on this basis.
   * The possessive assertion is kept verbatim — it must still not appear — and
   * the "renamed, same value" half is replaced by its opposite.
   */
  it('L62: renders NO goal badge at all when the only figure is a joint one standing in for an absent goal probability', () => {
    mockTrust.suspect = false
    mockResultsModeMetadata()
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeSubstitutedJointStore() as any)
    )
    const { container } = renderOption()
    expect(screen.queryByText(/chance of target\./)).toBeNull()
    // Neither voice, and no number — the withheld wording is gone too, because
    // there is nothing left for it to caption.
    expect(container.textContent ?? '').not.toContain(GOAL_ANCHOR_COPY.label(true))
    expect(container.textContent ?? '').not.toContain('< 1%')
  })

  it('positive control: the CONSTRAINED joint figure KEEPS the possessive wording (the gate is basis-scoped, not joint-scoped)', () => {
    mockTrust.suspect = false
    mockResultsModeMetadata()
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeConstrainedJointOnlyStore() as any)
    )
    renderOption()
    expect(screen.getByText(/5% chance of target\./)).toBeDefined()
    expect(screen.queryByText(new RegExp(GOAL_ANCHOR_COPY.label(true).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))))
      .toBeNull()
  })

  // Lane 4 fold (UI-SEM-082, extends UI-SEM-071): the "chance of target" badge
  // is a goal-fit claim — it must gate on the USER target. Without a target the
  // producer still returns a joint/goal probability (auto_goal_threshold), and
  // the panel twin OptionCards already suppresses this (hasGoalThreshold). The
  // canvas node must match, or it contradicts the GoalNode beside it (which
  // suppresses its own "chance of reaching target" when no target is set).
  it('SUPPRESSES the "chance of target" badge when the user set no target (auto-threshold)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: 0.5,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        goalThreshold: null, // the user set no target
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': {
                confidence: 0.5,
                win_probability: 0.5,
                probability_of_joint_goal: 0.05,
                constraint_analysis: { constraints: [{ id: 'c1' }], joint_probability: 0.05 },
              },
            },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    // No target → the goal-fit badge must not render (matches GoalNode + OptionCards).
    expect(screen.queryByText(/chance of target\./)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// QA Brief C-series — option node display scenarios
// ---------------------------------------------------------------------------
describe('OptionNode — QA Brief C-series', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTrust.suspect = true // UI-SEM-088 gate ON by default; positive-control tests opt out locally
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
      achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    })
    vi.mocked(useLayoutStore).mockImplementation(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: null })) as never)
  })

  // C2: Baseline option shows "No changes from current state" (all interventions match baseline)
  it('C2: baseline option (is_baseline=true) shows no-changes message', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.49 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Price', observedState: { unit: '£', cap: 100, value: 0.49, raw_value: 49 } },
        }],
      }) as any)
    )
    renderOption({ label: 'Keep current price', is_baseline: true })
    // Baseline option shows "No changes to factors" in body (pre-analysis)
    expect(screen.getByText('No changes to factors')).toBeDefined()
    // No delta arrow
    expect(screen.queryByText(/→/)).toBeNull()
  })

  // C3: Baseline detection by keyword — "Status Quo" treated as baseline
  it('C3: option labelled "Status Quo" is detected as baseline (no delta shown)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.49 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Price', observedState: { unit: '£', cap: 100, value: 0.49, raw_value: 49 } },
        }],
      }) as any)
    )
    renderOption({ label: 'Status Quo' })
    // "Status Quo" contains baseline keyword → shows baseline fallback (no intervention chips)
    expect(screen.queryByText('49')).toBeNull()
  })

  // C4: Qualitative intervention — no delta shown
  it('C4: qualitative factor intervention shows no delta arrow', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.7 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Team morale', observedState: { factor_type: 'quality' } },
        }],
      }) as any)
    )
    renderOption({ label: 'Hire lead' })
    // ⚠ RE-PINNED 14 Aug — same reversal as the 'quality' test above. "No unit,
    // no scale" is precisely the condition under which a percentage cannot be
    // honest; the tier word is what the factor actually supports.
    // Arrow separator is present between label and value (not a delta indicator)
    expect(screen.getByText('High')).toBeDefined()
  })

  // C5: Near-zero baseline — no spurious percentage (guard: abs(denormedBaseline) <= 0.01)
  // When the baseline option doesn't intervene on the factor, fallback is observedState.value.
  // If observedValue is extremely small (e.g. 0.005) with no cap, denormed = 0.005 <= 0.01 → no delta.
  it('C5: near-zero observed baseline value produces no delta (guard: abs <= 0.01)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [
            {
              id: 'option-1', // non-baseline
              interventions: { 'factor-1': 0.8 },
            },
            {
              id: 'option-baseline',
              // baseline does NOT intervene on factor-1, so fallback is observedState.value
              interventions: {},
            },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Big investment', type: 'option' } },
          { id: 'option-baseline', type: 'option', data: { label: 'Do nothing', type: 'option' } },
          {
            id: 'factor-1',
            data: {
              label: 'Revenue',
              // No cap, no raw_value, observedValue=0.005 → denormed baseline = 0.005 ≤ 0.01 → no delta
              observedState: { unit: 'k', value: 0.005 },
            },
          },
        ],
      }) as any)
    )
    renderOption({ label: 'Big investment' })
    // Near-zero guard: no spurious delta percentage shown (chip renders label → value without numeric delta)
    // The chip still shows the value, just no from→to delta calculation
    expect(screen.queryByText(/\+\d+%/)).toBeNull()
    expect(screen.queryByText(/-\d+%/)).toBeNull()
  })

  // C6: Multiple interventions per option — all chips render
  it('C6: multiple interventions render multiple chips (up to top 3)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: {
              'factor-1': 0.8,
              'factor-2': 0.6,
              'factor-3': 0.4,
            },
          }],
        },
        nodes: [
          { id: 'factor-1', data: { label: 'Marketing budget', observedState: {} } },
          { id: 'factor-2', data: { label: 'Team size', observedState: {} } },
          { id: 'factor-3', data: { label: 'Product quality', observedState: {} } },
        ],
      }) as any)
    )
    renderOption()
    // All three factor labels should appear as chips (arrow format: no colon)
    expect(screen.getAllByText('Marketing budget').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Team size').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Product quality').length).toBeGreaterThan(0)
  })

  // C7: 3+ options — only the baseline is detected as such; others show delta
  it('C7: with 3 options only "Do nothing" baseline is suppressed; non-baseline shows delta', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [
            { id: 'option-1', interventions: { 'factor-1': 0.7 } },       // non-baseline
            { id: 'option-2', interventions: { 'factor-1': 0.5 } },       // non-baseline
            { id: 'option-baseline', interventions: { 'factor-1': 0.5 } }, // baseline
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Scale up', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Moderate growth', type: 'option' } },
          { id: 'option-baseline', type: 'option', data: { label: 'Do nothing', type: 'option' } },
          {
            id: 'factor-1',
            data: { label: 'Revenue', observedState: { unit: 'fraction' } },
          },
        ],
      }) as any)
    )
    // Render the baseline option — no delta should appear
    renderOption({ label: 'Do nothing' })
    expect(screen.queryByText(/→/)).toBeNull()
  })

  // C9: Pre-analysis — no win probability, no Leading option badge
  it('C9: pre-analysis shows no win probability and no Leading option badge', () => {
    renderOption()
    expect(screen.queryByText(/win probability/)).toBeNull()
    expect(screen.queryByText('Leading option')).toBeNull()
  })

  // Polish 4 review: scale-unit interventions with no raw_value should
  // render as arrow + label only on pre-analysis pills, with no numeric
  // text or "scale" suffix bleeding through.
  describe('Polish 4 review: scale-unit interventions render arrow + label only', () => {
    const buildState = (overrides: Record<string, unknown> = {}) => makeStoreState({
      ceeAnalysisReady: {
        options: [
          { id: 'option-1', interventions: { 'factor-1': 0.7 } },
          { id: 'option-2', interventions: { 'factor-1': 0.2 } },
        ],
      },
      nodes: [
        { id: 'option-1', type: 'option', data: { label: 'Aggressive plan', type: 'option' } },
        { id: 'option-2', type: 'option', data: { label: 'Conservative plan', type: 'option' } },
        {
          id: 'factor-1',
          type: 'factor',
          data: {
            label: 'Marketing Expertise Available',
            observedState: { unit: 'scale', value: 0.5 },
          },
        },
      ],
      ...overrides,
    })

    it('option pre-analysis pill omits the scale value and the "scale" suffix', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) => selector(buildState() as any))
      renderOption({ label: 'Aggressive plan' })
      // No "0.7", no "scale", no "70%" should appear in the pill area.
      expect(screen.queryByText(/scale/i)).toBeNull()
      expect(screen.queryByText(/0\.7/)).toBeNull()
      // The factor's compact label is still rendered (one or more occurrences
      // depending on whether the popover/Detailed list also instantiates).
      expect(screen.getAllByText(/marketing expertise/i).length).toBeGreaterThan(0)
    })

    it('option Detailed list shows label only with no "→" arrow when value is empty', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({ ...buildState(), viewMode: 'expert' } as any),
      )
      renderOption({ label: 'Aggressive plan' })
      // The intervention list row exists for the factor but has no arrow,
      // because formatChipValue returned empty string for scale-no-raw.
      expect(screen.getAllByText(/marketing expertise/i).length).toBeGreaterThan(0)
      expect(screen.queryByText(/scale/i)).toBeNull()
    })

    // Self-assessment fix #4: scale-unit factor with cap (so the deltaDisplay
    // path is reached) used to render " → ()" because both formatChipValue
    // calls returned empty strings. The deltaDisplay must only build when
    // both sides produced meaningful output.
    it('does not render a broken " → ()" delta when both formatChipValue calls are empty', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              { id: 'option-1', interventions: { 'factor-1': 0.7 } },
              { id: 'option-2', interventions: { 'factor-1': 0.3 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Aggressive', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Conservative', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Marketing Expertise',
                // cap=10 means inferInterventionScaleBase returns 10, the
                // deltaDisplay code path activates, but both chip values
                // collapse to '' because of the meaningless-unit suppression.
                observedState: { unit: 'scale', value: 0.5, cap: 10 },
              },
            },
          ],
          viewMode: 'expert',
        }) as any),
      )
      renderOption({ label: 'Aggressive' })
      // No empty parentheses, no orphan arrow.
      expect(screen.queryByText(/→ \(/)).toBeNull()
      expect(screen.queryByText(/\(\)/)).toBeNull()
      expect(screen.queryByText(/→ \s*$/)).toBeNull()
    })
  })

  // Self-assessment fix #5: differentiator must NOT fire when other options
  // simply omit a factor that this option holds at the observed baseline.
  describe('Polish 4 review: differentiator uses observed baseline as fallback', () => {
    it('does not flag a factor when this option intervenes at the observed baseline and others omit it', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Option A intervenes on factor-1 at 0.7 (matches observed value).
              // Option B and C omit factor-1 entirely.
              { id: 'option-1', interventions: { 'factor-1': 0.7 } },
              { id: 'option-2', interventions: {} },
              { id: 'option-3', interventions: {} },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Hold', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Other A', type: 'option' } },
            { id: 'option-3', type: 'option', data: { label: 'Other B', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Headcount',
                // Observed baseline = 0.7 — same as Option A's intervention.
                // The pre-fix code would compute avgOthers=0 and falsely
                // flag a 0.7 differentiator. Post-fix uses 0.7 baseline so
                // diff = 0 → no differentiator.
                observedState: { unit: 'engineers', value: 0.7, raw_value: 7, cap: 10 },
              },
            },
          ],
          // Differentiator only renders in Standard view.
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Hold' })
      expect(screen.queryByText(/key difference/i)).toBeNull()
    })

    it('still flags a factor when this option diverges from the observed baseline', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Option A pushes factor-1 to 0.9 — far above the observed
              // baseline of 0.3, while Option B leaves it at 0.3.
              { id: 'option-1', interventions: { 'factor-1': 0.9 } },
              { id: 'option-2', interventions: {} },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Aggressive', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Hold', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Headcount',
                observedState: { unit: 'engineers', value: 0.3, raw_value: 3, cap: 10 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Aggressive' })
      // diff = |0.9 - 0.3| = 0.6 > 0.1 threshold → differentiator fires.
      expect(screen.getByText(/key difference/i)).toBeDefined()
    })
  })

  // Graph v2: differentiator deduplication — when 2+ options share the same
  // top factor, the label includes the formatted value to disambiguate.
  describe('Graph v2: differentiator deduplication', () => {
    it('shows different differentiator text when two options share the same factor at different values', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Both options intervene on factor-1 but at different values.
              { id: 'option-1', interventions: { 'factor-1': 0.9 } },
              { id: 'option-2', interventions: { 'factor-1': 0.1 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Hire Tech Lead', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Hire Developers', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Tech Lead Hired',
                observedState: { unit: '%', value: 0.5, raw_value: 50, cap: 100 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Hire Tech Lead' })
      // Shared factor → option-1 at 0.9 on a % factor → "90%". Brief scope 7:
      // the from→to chip already shows that value (e.g. "50% → 90%"), so the
      // duplicate differentiator footer is dropped — the disambiguating value
      // lives in the chip, not a repeated <p>.
      const valueChip = screen.getByText((t: string) => t.includes('90%') && t.includes('→'))
      expect(valueChip).toBeDefined()
      // No separate differentiator <p> repeating the same value.
      const matches = screen.getAllByText(/tech lead hired/i)
      expect(matches.find(el => el.tagName === 'P')).toBeUndefined()
    })

    it('suppresses differentiator when two options share same factor with identical values', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Both options intervene on factor-1 at the same value
              { id: 'option-1', interventions: { 'factor-1': 0.9 } },
              { id: 'option-2', interventions: { 'factor-1': 0.9 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Option B', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Tech Lead Hired',
                observedState: { unit: '%', value: 0.5, raw_value: 50, cap: 100 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Option A' })
      // Both options produce identical differentiator text → suppressed.
      // The chip may still show the factor name, but no differentiator <p> should exist.
      expect(screen.queryByText(/key difference/i)).toBeNull()
      const matches = screen.queryAllByText(/tech lead hired/i)
      const differentiatorP = matches.find(el => el.tagName === 'P')
      expect(differentiatorP).toBeUndefined()
    })

    it('uses directional language (not tier labels) when shared factor is a scale unit', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Both options intervene on a scale factor (no raw_value) at different values
              { id: 'option-1', interventions: { 'factor-1': 0.9 } },
              { id: 'option-2', interventions: { 'factor-1': 0.1 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Aggressive', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Conservative', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Marketing Expertise',
                // scale unit, no raw_value → meaningless without anchor;
                // differentiator should use directional language against baseline.
                observedState: { unit: 'scale', value: 0.5 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Aggressive' })
      // option-1 has value 0.9, baseline 0.5 → "Increases Marketing expertise"
      const matches = screen.queryAllByText(/marketing expertise/i)
      const differentiatorP = matches.find(el => el.tagName === 'P')
      expect(differentiatorP).toBeDefined()
      expect(differentiatorP!.textContent).toMatch(/^Increases /)
      // Negative assertions: no tier labels, no "scale" unit leaking through.
      expect(differentiatorP!.textContent).not.toMatch(/\b(Very high|Very low|Moderate)\b/)
      expect(differentiatorP!.textContent).not.toContain('→')
      expect(differentiatorP!.textContent!.toLowerCase()).not.toContain('scale')
    })

    it('says "Increases" for a small real shift (0.05) — "Does not change" needs exact equality', () => {
      // Audit §8 P0-4: the old ±0.1 display epsilon rendered "Does not
      // change" for genuinely different values (0.5→0.55, and the live
      // 0.5→0.6 boundary case). The single formatter reserves "Does not
      // change" for exact equality only.
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Option A sits 0.05 above baseline — a real change;
              // Option B is far below. Shared factor → differentiator fires
              // for A via the neutral branch.
              { id: 'option-1', interventions: { 'factor-1': 0.55 } },
              { id: 'option-2', interventions: { 'factor-1': 0.1 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Hold Steady', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Cut Back', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Marketing Expertise',
                observedState: { unit: 'scale', value: 0.5 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Hold Steady' })
      const matches = screen.queryAllByText(/marketing expertise/i)
      const differentiatorP = matches.find(el => el.tagName === 'P')
      expect(differentiatorP).toBeDefined()
      expect(differentiatorP!.textContent).toMatch(/^Increases /)
    })

    it('uses "Does not change" ONLY when the intervention exactly equals the baseline', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Option A matches the baseline exactly; Option B is far below.
              { id: 'option-1', interventions: { 'factor-1': 0.5 } },
              { id: 'option-2', interventions: { 'factor-1': 0.1 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Hold Steady', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Cut Back', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Marketing Expertise',
                observedState: { unit: 'scale', value: 0.5 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Hold Steady' })
      const matches = screen.queryAllByText(/marketing expertise/i)
      const differentiatorP = matches.find(el => el.tagName === 'P')
      expect(differentiatorP).toBeDefined()
      expect(differentiatorP!.textContent).toMatch(/^Does not change /)
    })

    it('uses "Decreases" when scale-unit intervention is below baseline', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              { id: 'option-1', interventions: { 'factor-1': 0.1 } },
              { id: 'option-2', interventions: { 'factor-1': 0.9 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Cut Back', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Invest', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Marketing Expertise',
                observedState: { unit: 'scale', value: 0.5 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Cut Back' })
      // option-1 has value 0.1, baseline 0.5 → "Decreases Marketing expertise"
      const matches = screen.queryAllByText(/marketing expertise/i)
      const differentiatorP = matches.find(el => el.tagName === 'P')
      expect(differentiatorP).toBeDefined()
      expect(differentiatorP!.textContent).toMatch(/^Decreases /)
      // Negative assertions: no tier labels, no "scale" unit leaking through.
      expect(differentiatorP!.textContent).not.toMatch(/\b(Very high|Very low|High|Low|Moderate)\b/)
      expect(differentiatorP!.textContent!.toLowerCase()).not.toContain('scale')
    })

    it('shows unique differentiator without value when factor is not shared', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Each option intervenes on a different factor
              { id: 'option-1', interventions: { 'factor-1': 0.9 } },
              { id: 'option-2', interventions: { 'factor-2': 0.9 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Option B', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Headcount',
                observedState: { unit: 'engineers', value: 0.3, raw_value: 3, cap: 10 },
              },
            },
            {
              id: 'factor-2',
              type: 'factor',
              data: {
                label: 'Budget',
                observedState: { unit: '£', value: 0.5, raw_value: 50000, cap: 100000 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Option A' })
      // Unique factor → "Headcount is the key difference" (simple sentence)
      expect(screen.getByText(/headcount is the key difference/i)).toBeDefined()
    })
  })
})

// ─── Graph coaching audit §8 (P0-4/P0-5/P1) — display coherence ─────────────
describe('OptionNode — display coherence (audit §8)', () => {
  const resultsMetadata = (winRate: number | null) => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    achievementProbabilityIsModelledBasis: false,
    stabilityPercentage: null,
    winRate,
    isResultsMode: true,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockTrust.suspect = true // UI-SEM-088 gate ON by default; positive-control tests opt out locally
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(null))
    vi.mocked(useLayoutStore).mockImplementation(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: null })) as never)
  })

  // Item 3a: duplicate win-rate phrasing removed from the status-quo card
  it('status-quo card renders the comparative readout once and never "win rate across simulations"', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.28))
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
      }) as any)
    )
    renderOption({ label: 'Status Quo', is_baseline: true })
    expect(screen.getByText('Came out ahead in 28% of simulated scenarios')).toBeDefined()
    expect(screen.queryByText(/win rate across simulations/i)).toBeNull()
    expect(screen.getByText('Current baseline. No changes to factors.')).toBeDefined()
  })

  // Item 3c: identical "Behind:" reasons on multiple non-leading options are
  // suppressed on all of them (non-differentiating copy)
  it('suppresses "Behind:" when another non-leading option shares the identical reason', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.2))
    const report = {
      // ROADMAP 1.239: the producer signal is REQUIRED here, not decorative.
      // "Behind:" now needs an entitled leader, so without it this test would
      // go on passing while proving nothing about the identical-reason rule it
      // exists to pin — the absence would be caused by the withheld gate
      // instead. Trap 13, arriving via a change in a different file.
      robustness: { recommended_option_id: 'option-3', ...producerLeaderClaim('option-3') },
      option_probabilities: {
        'option-1': { win_probability: 0.2 },
        'option-2': { win_probability: 0.2 },
        'option-3': { win_probability: 0.6 },
      },
      // No factor_sensitivity → both losers would read "fewer key changes"
    }
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Option B', type: 'option' } },
          { id: 'option-3', type: 'option', data: { label: 'Option C', type: 'option' } },
        ],
      }) as any)
    )
    renderOption({ label: 'Option A' })
    expect(screen.queryByText(/Behind:/)).toBeNull()
  })

  it('keeps "Behind:" when the reason differs from the other non-leading option', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.2))
    const report = {
      // ROADMAP 1.239: producer signal — this fixture means "there is a leader".
      robustness: { recommended_option_id: 'option-3', ...producerLeaderClaim('option-3') },
      option_probabilities: {
        'option-1': { win_probability: 0.2 },
        'option-2': { win_probability: 0.2 },
        'option-3': { win_probability: 0.6 },
      },
    }
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
          // Sibling loser is the baseline → its reason is "no changes from
          // current state", which differs from option-1's "fewer key changes".
          { id: 'option-2', type: 'option', data: { label: 'Status Quo', type: 'option', is_baseline: true } },
          { id: 'option-3', type: 'option', data: { label: 'Option C', type: 'option' } },
        ],
      }) as any)
    )
    renderOption({ label: 'Option A' })
    expect(screen.getByText(/Behind: fewer key changes/)).toBeDefined()
  })

  // P0-2 (external review 2026-07-14): the loser's "Behind:" top factor must be
  // ranked via the SHARED policy off CERTIFIED factor_sensitivity — not off the
  // untyped enrichment passthrough, and not by a chain that omits `sensitivity`.
  it('ranks the "Behind:" factor off certified factor_sensitivity via the shared policy, not enrichment', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.2))
    const report = {
      // ROADMAP 1.239: producer signal — this fixture means "there is a leader".
      robustness: { recommended_option_id: 'option-3', ...producerLeaderClaim('option-3') },
      option_probabilities: {
        'option-1': { win_probability: 0.2 },
        'option-3': { win_probability: 0.6 },
      },
      // Certified magnitude lives ONLY under `sensitivity` (the V5 shape); the
      // winner intervenes on certA. The untyped enrichment names a DIFFERENT
      // factor (enrX) with a larger importance_score — it must NOT win.
      factor_sensitivity: [
        { factor_id: 'certA', sensitivity: 0.8 },
        { factor_id: 'certB', sensitivity: 0.2 },
      ],
      enrichment: { sensitivity_analysis: { factors: [{ factor_id: 'enrX', importance_score: 0.9 }] } },
    }
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report },
        ceeAnalysisReady: {
          options: [
            { id: 'option-3', interventions: { certA: 0.5 } },
            { id: 'option-1', interventions: {} },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
          // Baseline sibling → its reason differs, so option-1's reason is not suppressed.
          { id: 'option-2', type: 'option', data: { label: 'Status Quo', type: 'option', is_baseline: true } },
          { id: 'option-3', type: 'option', data: { label: 'Option C', type: 'option' } },
          { id: 'certA', type: 'factor', data: { label: 'Budget' } },
          { id: 'enrX', type: 'factor', data: { label: 'Marketing' } },
        ],
      }) as any)
    )
    renderOption({ label: 'Option A' })
    // Names certA (certified, sensitivity-ranked #1). RED before the fix:
    // enrichment ranked first → enrX, which the winner doesn't intervene on →
    // "Behind: fewer key changes".
    expect(screen.getByText(/Behind: no budget added/i)).toBeDefined()
    expect(screen.queryByText(/marketing/i)).toBeNull()
  })

  // Item 6: stale treatment on result decorations

  // Item 7: per-option intervention list containment
  it('caps the "What this option changes:" list at 3 rows with "+N more in inspector"', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.5))
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: {
              'factor-1': 0.9,
              'factor-2': 0.8,
              'factor-3': 0.7,
              'factor-4': 0.6,
              'factor-5': 0.55,
            },
          }],
        },
        nodes: [
          { id: 'factor-1', data: { label: 'Alpha', observedState: { unit: 'fraction' } } },
          { id: 'factor-2', data: { label: 'Bravo', observedState: { unit: 'fraction' } } },
          { id: 'factor-3', data: { label: 'Charlie', observedState: { unit: 'fraction' } } },
          { id: 'factor-4', data: { label: 'Delta', observedState: { unit: 'fraction' } } },
          { id: 'factor-5', data: { label: 'Echo', observedState: { unit: 'fraction' } } },
        ],
      }) as any)
    )
    renderOption()
    // Exactly the top-3 rows render, whole (labels visible)…
    expect(screen.getByText('Alpha')).toBeDefined()
    expect(screen.getByText('Bravo')).toBeDefined()
    expect(screen.getByText('Charlie')).toBeDefined()
    // …the 4th and 5th do not…
    expect(screen.queryByText('Delta')).toBeNull()
    expect(screen.queryByText('Echo')).toBeNull()
    // …and the overflow line reports the correct remainder.
    expect(screen.getByText('+2 more in inspector')).toBeDefined()
  })

  it('shows no overflow line when 3 or fewer interventions exist', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.5))
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.9, 'factor-2': 0.8 },
          }],
        },
        nodes: [
          { id: 'factor-1', data: { label: 'Alpha', observedState: { unit: 'fraction' } } },
          { id: 'factor-2', data: { label: 'Bravo', observedState: { unit: 'fraction' } } },
        ],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('Alpha')).toBeDefined()
    expect(screen.getByText('Bravo')).toBeDefined()
    expect(screen.queryByText(/more in inspector/)).toBeNull()
  })

  // Item 3b: Detailed pre-analysis no longer duplicates pills with an
  // "Interventions:" list
  it('Detailed pre-analysis card renders delta pills without a duplicate "Interventions:" list', () => {
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
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        viewMode: 'expert',
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-1': 0.8 } }],
        },
        nodes: [
          { id: 'factor-1', data: { label: 'Budget', observedState: { unit: 'fraction', value: 0.4 } } },
        ],
      }) as any)
    )
    renderOption()
    // Pills render the from→to data…
    expect(screen.getByText('40% → 80%')).toBeDefined()
    // …and the duplicated inline list is gone.
    expect(screen.queryByText('Interventions:')).toBeNull()
  })

  it('Wave 4 / §6.4: renders the identity-anchored stable option number badge when registered', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ optionNumbering: { 'option-1': 2 } }) as any),
    )
    renderOption()
    const badge = screen.getByTestId('option-stable-number-option-1')
    expect(badge).toHaveTextContent('2')
    expect(badge).toHaveAttribute('aria-label', 'Option 2')
  })

  it('renders no stable-number badge before the option is registered', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ optionNumbering: {} }) as any),
    )
    renderOption()
    expect(screen.queryByTestId('option-stable-number-option-1')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Lane 2 — winsVia honesty (live 2026-07-13 contradiction): the leader node
// claimed "Leads via Design Change Scope, the #1 driver" while the SAME
// screen's drivers panel ranked that factor 4th at 17% (real #1: Pricing
// Page Clarity, 100%). winsVia ranked by raw elasticity, option-scoped —
// then asserted a GLOBAL rank. It must rank via the shared display policy
// and only claim "#1 driver" when the chosen factor IS the policy's #1.
// ---------------------------------------------------------------------------

describe('OptionNode — winsVia ranks via the display policy and never overclaims (Lane 2)', () => {
  const FACTOR_NODES = [
    { id: 'fac_clarity', type: 'factor', data: { label: 'Pricing Page Clarity', type: 'factor' } },
    { id: 'fac_scope', type: 'factor', data: { label: 'Design Change Scope', type: 'factor' } },
    { id: 'option-1', type: 'option', data: { label: 'Keep Current Page', type: 'option' } },
    { id: 'option-2', type: 'option', data: { label: 'Full Redesign', type: 'option' } },
  ]

  const winsViaState = (opts: {
    factors: unknown[]
    interventions: Record<string, number>
    /** Optional canvas override — the degenerate-tie block below needs its own factors. */
    nodes?: unknown[]
  }) =>
    makeStoreState({
      nodes: opts.nodes ?? FACTOR_NODES,
      results: {
        status: 'complete',
        report: {
          // ROADMAP 1.223: `winsVia` is leader copy, so it only renders when the
          // PRODUCER has claimed a leader — the UI may no longer band the win
          // probabilities into one itself. The claim names option-1, which is
          // both the win argmax (identity gate) and the recommendation. The
          // win split is incidental to what this block asserts (which FACTOR
          // winsVia names, and whether it may claim "#1 driver"); it stays at
          // 0.70/0.29 — widened from 0.54/0.45 in the 2026-07-25 SINGLE VERDICT
          // change, because that 9pp gap sat inside PLoT's own near-tie
          // threshold (0.10).
          robustness: { recommended_option_id: 'option-1', ...producerLeaderClaim('option-1') },
          option_probabilities: {
            'option-1': { win_probability: 0.70 },
            'option-2': { win_probability: 0.29 },
          },
          factor_sensitivity: opts.factors,
        },
      },
      ceeAnalysisReady: {
        goal_node_id: 'goal_1',
        options: [
          { id: 'option-1', label: 'Keep Current Page', interventions: opts.interventions },
          { id: 'option-2', label: 'Full Redesign', interventions: {} },
        ],
      },
    })

  const mountLeader = (state: ReturnType<typeof makeStoreState>) => {
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(state as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.54,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    } as never)
    renderOption()
  }

  it('does NOT claim "#1 driver" when the leader\'s lever is not the policy #1 (live repro)', () => {
    mountLeader(
      winsViaState({
        factors: [
          // Complete producer coverage: policy adopts influence_score.
          // Global #1 = fac_clarity (1.0); the leader only intervenes on
          // fac_scope (0.17, rank 4-ish).
          { factor_id: 'fac_clarity', influence_score: 1.0, elasticity: 0.9 },
          { factor_id: 'fac_scope', influence_score: 0.17, elasticity: 0.93 },
        ],
        interventions: { fac_scope: 0 },
      }),
    )
    expect(screen.getByText(/Leads via/)).toBeInTheDocument()
    expect(screen.getByText('Design Change Scope')).toBeInTheDocument()
    expect(screen.queryByText(/the #1 driver/)).toBeNull()
    expect(screen.getByText(/its biggest lever/)).toBeInTheDocument()
  })

  it('claims "#1 driver" only when the lever IS the policy #1', () => {
    mountLeader(
      winsViaState({
        factors: [
          { factor_id: 'fac_clarity', influence_score: 1.0, elasticity: 0.9 },
          { factor_id: 'fac_scope', influence_score: 0.17, elasticity: 0.93 },
        ],
        interventions: { fac_clarity: 1 },
      }),
    )
    expect(screen.getByText('Pricing Page Clarity')).toBeInTheDocument()
    expect(screen.getByText(/the #1 driver/)).toBeInTheDocument()
  })

  it('ranks candidate levers by the POLICY value, not raw elasticity', () => {
    mountLeader(
      winsViaState({
        factors: [
          // Complete coverage: policy = influence_score. Raw elasticity
          // order is scope > clarity (0.93 > 0.9) — the OLD code picked by
          // that and would choose fac_scope; the policy picks fac_clarity.
          { factor_id: 'fac_clarity', influence_score: 1.0, elasticity: 0.9 },
          { factor_id: 'fac_scope', influence_score: 0.17, elasticity: 0.93 },
        ],
        interventions: { fac_clarity: 1, fac_scope: 0 },
      }),
    )
    expect(screen.getByText('Pricing Page Clarity')).toBeInTheDocument()
    expect(screen.queryByText('Design Change Scope')).toBeNull()
  })

  // -------------------------------------------------------------------------
  // A CROWN IS A COMPARATIVE CLAIM AND A TIE CANNOT SUPPORT ONE (2026-08-29).
  //
  // Measured by executing ISL in-process at staging `28fe0c95`: 5 of 18 fresh
  // drafts come back FULLY DEGENERATE — every AI causal edge at |mean| 0.5,
  // std 0.12, p 0.8. On such a draft five factors returned an IDENTICAL
  // `influence_score` (0.8333…) and an IDENTICAL |elasticity| (5.460487156…),
  // so `compareByDisplayModel` fell through value AND elasticity to
  // `key.localeCompare` and the leader node crowned whichever factor sorted
  // first ALPHABETICALLY — with `is_robust=True` and no warnings. Across 20
  // varied-magnitude reconstructions of each degenerate draft the "biggest
  // lever" was undetermined in 5 of 5.
  //
  // The Drivers panel already withheld its crown on exactly this condition via
  // `INFLUENCE_TIE_EPSILON`, so one screen printed "These factors have similar
  // influence on the outcome" beside a node calling one of them "the #1
  // driver". Two surfaces, one question, two answers.
  //
  // ⚠ EVERY ASSERTION HERE BINDS BY LABEL IDENTITY, NEVER BY A VALUE. Equal
  // influence across factors is literally the case under test, so a value
  // predicate is GUARANTEED to be satisfiable by the wrong object (trap 19).
  // -------------------------------------------------------------------------
  describe('winsVia withholds BOTH superlatives on a degenerate (tied) draft', () => {
    // The live degenerate values, carried verbatim rather than rounded.
    const TIED_INFLUENCE = 0.8333333333333334
    const TIED_ELASTICITY = 5.460487156

    // Ids chosen so `fac_a_migration` wins `key.localeCompare` — it is the
    // factor the pre-fix comparator crowned, and the one the founder saw named.
    const TIED_FACTOR_NODES = [
      { id: 'fac_a_migration', type: 'factor', data: { label: 'Migration investment', type: 'factor' } },
      { id: 'fac_b_headcount', type: 'factor', data: { label: 'Headcount ramp', type: 'factor' } },
      { id: 'fac_c_pricing', type: 'factor', data: { label: 'Pricing page clarity', type: 'factor' } },
      { id: 'fac_d_churn', type: 'factor', data: { label: 'Churn recovery', type: 'factor' } },
      { id: 'fac_e_regulatory', type: 'factor', data: { label: 'Regulatory timing', type: 'factor' } },
      { id: 'option-1', type: 'option', data: { label: 'Keep Current Page', type: 'option' } },
      { id: 'option-2', type: 'option', data: { label: 'Full Redesign', type: 'option' } },
    ]

    const TIED_FACTORS = TIED_FACTOR_NODES
      .filter(n => n.type === 'factor')
      .map(n => ({ factor_id: n.id, influence_score: TIED_INFLUENCE, elasticity: TIED_ELASTICITY }))

    const mountTied = (interventions: Record<string, number>) =>
      mountLeader(
        winsViaState({ factors: TIED_FACTORS, interventions, nodes: TIED_FACTOR_NODES }),
      )

    /**
     * The WHOLE rendered sentence, whitespace-normalised.
     *
     * ⚠ WHY THE WHOLE SENTENCE AND NOT A SUBSTRING. The three claims share
     * words ("its", "lever"), and until 2026-08-30 the tie branch read "tied
     * for its biggest lever" — of which the option-scoped claim "its biggest
     * lever" is a literal SUBSTRING, making a `queryByText(/its biggest
     * lever/)` absence assertion unsatisfiable and its presence twin
     * ambiguous. Shortening the tie copy removed that particular overlap but
     * not the hazard, so the assertions stay on the WHOLE sentence.
     * Exact equality also pins the FACTOR LABEL in the same breath, which is
     * the identity binding this block needs: the fixture's five factors carry
     * byte-identical influence values, so any value-based or partial match is
     * guaranteed to be satisfiable by the wrong factor (trap 19).
     *
     * `getByText(/Leads via/)` resolves to the claim's own <p> and nothing else
     * — testing-library matches on DIRECT text-node children, so the enclosing
     * divs do not also match. The factor label lives in a nested <button> and
     * so is absent from the matcher's input but present in `textContent`.
     */
    const winsViaSentence = () =>
      screen.getByText(/Leads via/).textContent?.replace(/\s+/g, ' ').trim()

    // ⚠ PIN THE PRECONDITION IN-TEST. Without this, every absence assertion
    // below could be passing because the fixture failed to produce a crownable
    // state at all (a zero value, a dropped row) rather than because the tie
    // rule fired. This asserts the fixture clears the `value > 0` crown gate
    // AND genuinely ties — so the suppression that follows is the CODE's doing.
    it('PRECONDITION: the fixture is crownable-but-tied under the shared policy', () => {
      const rows = TIED_FACTORS
        .map(f => extractPolicyRow(f))
        .filter((r): r is NonNullable<ReturnType<typeof extractPolicyRow>> => r != null)
      expect(rows).toHaveLength(5)

      const model = selectDriverDisplayModel(rows)
      const values = rows.map(r => model.get(r.key)!.value)

      // Crownable: the pre-fix gate was `ranked[0].value > 0`, and it passes.
      expect(values.every(v => v > 0)).toBe(true)
      // Tied: every one of the five sits inside the shared epsilon of the max.
      const max = Math.max(...values)
      expect(values.filter(v => max - v <= INFLUENCE_TIE_EPSILON)).toHaveLength(5)
      // And the comparator has nothing left but the alphabetical fallback.
      expect(new Set(values).size).toBe(1)
    })

    // The live repro. Pre-fix this rendered "…, the #1 driver" — the crown
    // going to `fac_a_migration` purely because it wins `key.localeCompare`.
    it('states the tie instead of crowning one of five identical factors (live degenerate repro)', () => {
      mountTied({ fac_a_migration: 1, fac_c_pricing: 1 })

      // Paul's standing ruling: NO HIDING, CAVEAT INSTEAD. The factor is still
      // named — the reader loses a false claim and gains a true one.
      expect(winsViaSentence()).toBe(
        'Leads via Migration investment, tied for its top lever',
      )
    })

    // ⚠ THE TWO CLAIMS RANGE OVER DIFFERENT SETS, so they are pinned apart.
    // With ONE lever there is no runner-up WITHIN the option, so "its biggest
    // lever" is TRUE and must survive — while the GLOBAL crown must still go,
    // because globally the factor is one of five identical rows. A guard that
    // collapsed both claims into the caveat would pass the test above and fail
    // this one.
    it('drops only the GLOBAL crown when the option pulls a single lever', () => {
      mountTied({ fac_a_migration: 1 })

      expect(winsViaSentence()).toBe(
        'Leads via Migration investment, its biggest lever',
      )
    })

    // ⚠ THE MIRROR DEFECT IS WORSE THAN THE BUG. A rule that suppressed every
    // crown would satisfy both tests above. These two pin the boundary from
    // BOTH sides at the shared epsilon, so the rule cannot be widened into
    // silence or narrowed back into the lie without a red.
    it('BOUNDARY: a gap INSIDE the epsilon is a tie — no crown', () => {
      mountLeader(
        winsViaState({
          nodes: TIED_FACTOR_NODES,
          factors: [
            { factor_id: 'fac_a_migration', influence_score: 1.0, elasticity: 0.9 },
            { factor_id: 'fac_c_pricing', influence_score: 1.0 - INFLUENCE_TIE_EPSILON / 2, elasticity: 0.9 },
          ],
          interventions: { fac_a_migration: 1 },
        }),
      )
      // Only one lever, so the option-scoped claim stands; the global one cannot.
      expect(winsViaSentence()).toBe(
        'Leads via Migration investment, its biggest lever',
      )
    })

    it('BOUNDARY: a gap OUTSIDE the epsilon is a real lead — the crown is still awarded', () => {
      mountLeader(
        winsViaState({
          nodes: TIED_FACTOR_NODES,
          factors: [
            { factor_id: 'fac_a_migration', influence_score: 1.0, elasticity: 0.9 },
            { factor_id: 'fac_c_pricing', influence_score: 1.0 - INFLUENCE_TIE_EPSILON * 2, elasticity: 0.9 },
          ],
          interventions: { fac_a_migration: 1 },
        }),
      )
      expect(winsViaSentence()).toBe(
        'Leads via Migration investment, the #1 driver',
      )
    })
  })

  // -------------------------------------------------------------------------
  // A FACTOR IS NOT TIED WITH ITSELF (2026-08-30, adversarial review of #964).
  //
  // The tie rule above was first shipped as a VALUE-COUNT over a bare
  // `ReadonlyArray<number>` — a bag of numbers with no identity — replacing an
  // identity test (`f.id === globalTopId`). Measured by the reviewer at head
  // `d5d11c1b`: `factor_sensitivity = [a@1.0, a@1.0, c@0.4]` (ONE factor listed
  // twice) on an option pulling ONE lever rendered — quoted verbatim, because
  // it is a RECORD OF WHAT THE PRODUCT EMITTED at that commit and not a
  // fixture to keep current (the tie copy was shortened to "tied for its top
  // lever" on 2026-08-30):
  //   "Leads via Migration investment, tied for its biggest lever"
  // where the pre-#964 code correctly rendered ", the #1 driver". A single
  // duplicated row therefore committed BOTH harms at once: it suppressed a
  // genuine 2.5x leader AND asserted a tie the data does not contain — the
  // factor "tied" with itself, on an option that pulls nothing else.
  //
  // ⚠ REACHABILITY IS UNESTABLISHED AND THAT IS NOT THE POINT. The in-UI route
  // is closed (`normaliseGraphIds`, src/utils/nodeIdNormalisation.ts:85-105,
  // resolves collisions against `usedIds`, so the id map is injective). The
  // trigger needs the PRODUCER (CEE/PLoT/ISL) to emit two `factor_sensitivity`
  // rows on one `factor_id`, which is a location neither the reviewer nor this
  // lane could reach. The binding is correct either way, and this is the
  // standing rule the fix itself was applying elsewhere: an assertion — and a
  // predicate — binds by IDENTITY, never by a value another object could
  // satisfy (trap 19).
  // -------------------------------------------------------------------------
  describe('winsVia: a duplicated producer row is not a tie with itself', () => {
    const DUP_FACTOR_NODES = [
      { id: 'fac_a_migration', type: 'factor', data: { label: 'Migration investment', type: 'factor' } },
      { id: 'fac_b_headcount', type: 'factor', data: { label: 'Headcount ramp', type: 'factor' } },
      { id: 'fac_c_pricing', type: 'factor', data: { label: 'Pricing page clarity', type: 'factor' } },
      { id: 'option-1', type: 'option', data: { label: 'Keep Current Page', type: 'option' } },
      { id: 'option-2', type: 'option', data: { label: 'Full Redesign', type: 'option' } },
    ]

    const winsViaSentence = () =>
      screen.getByText(/Leads via/).textContent?.replace(/\s+/g, ' ').trim()

    // ⚠ PIN THE PRECONDITION IN-TEST. Every assertion below is worthless if the
    // duplicate silently collapses upstream — the fixture would then be an
    // ordinary two-factor set and the tests would pass while proving nothing
    // about duplicates. This asserts the duplicate SURVIVES `extractPolicyRow`
    // into the ranked array the component builds, so what follows is the
    // predicate's doing.
    it('PRECONDITION: the duplicated row survives extraction as TWO rows on ONE key', () => {
      const rows = [
        { factor_id: 'fac_a_migration', influence_score: 1.0, elasticity: 0.9 },
        { factor_id: 'fac_a_migration', influence_score: 1.0, elasticity: 0.9 },
        { factor_id: 'fac_c_pricing', influence_score: 0.4, elasticity: 0.4 },
      ]
        .map(f => extractPolicyRow(f))
        .filter((r): r is NonNullable<ReturnType<typeof extractPolicyRow>> => r != null)

      expect(rows).toHaveLength(3)
      expect(rows.filter(r => r.key === 'fac_a_migration')).toHaveLength(2)
      // …and both duplicate rows resolve to the SAME display value, which is
      // exactly what a value-count cannot tell apart from two real factors.
      const model = selectDriverDisplayModel(rows)
      expect(new Set(rows.map(r => model.get(r.key)!.value)).size).toBe(2)
    })

    // THE REVIEWER'S REPRODUCTION, VERBATIM. `a` leads `c` by 2.5x; the crown
    // is earned and must be awarded.
    it('awards the GLOBAL crown to a genuine leader listed twice (review repro)', () => {
      mountLeader(
        winsViaState({
          nodes: DUP_FACTOR_NODES,
          factors: [
            { factor_id: 'fac_a_migration', influence_score: 1.0, elasticity: 0.9 },
            { factor_id: 'fac_a_migration', influence_score: 1.0, elasticity: 0.9 },
            { factor_id: 'fac_c_pricing', influence_score: 0.4, elasticity: 0.4 },
          ],
          interventions: { fac_a_migration: 1 },
        }),
      )
      expect(winsViaSentence()).toBe(
        'Leads via Migration investment, the #1 driver',
      )
    })

    // ⚠ THE SAME DEFECT ON THE OTHER CALL SITE. The option-scoped claim runs
    // the predicate over `optionLevers`, a DIFFERENT set, and a duplicate in
    // THAT set suppressed the option-scoped claim independently. Here the
    // GLOBAL crown is correctly withheld (a and b genuinely tie), so the
    // sentence must fall to the option-scoped claim and not past it to "tied".
    it('awards the OPTION-scoped claim when only the option-lever set is duplicated', () => {
      mountLeader(
        winsViaState({
          nodes: DUP_FACTOR_NODES,
          factors: [
            { factor_id: 'fac_a_migration', influence_score: 1.0, elasticity: 0.9 },
            { factor_id: 'fac_a_migration', influence_score: 1.0, elasticity: 0.9 },
            { factor_id: 'fac_b_headcount', influence_score: 1.0, elasticity: 0.9 },
            { factor_id: 'fac_c_pricing', influence_score: 0.4, elasticity: 0.4 },
          ],
          interventions: { fac_a_migration: 1, fac_c_pricing: 1 },
        }),
      )
      expect(winsViaSentence()).toBe(
        'Leads via Migration investment, its biggest lever',
      )
    })

    // ⚠ THE OPPOSITE-DIRECTION TWIN, AND IT IS THE ONE THAT MATTERS. This
    // predicate guards TWO opposite harms — crowning a false leader, and
    // suppressing a genuine one — and they cannot share one window. A
    // "deduplicate then compare" rule that ALSO collapsed two DIFFERENT
    // factors would pass every case above and re-open the original lie. Here
    // `a` and `b` are distinct ids at identical values, with `a` duplicated on
    // top: the tie is real and the crown must still be withheld.
    it('MIRROR: a duplicate does not manufacture a crown over a genuinely tied rival', () => {
      mountLeader(
        winsViaState({
          nodes: DUP_FACTOR_NODES,
          factors: [
            { factor_id: 'fac_a_migration', influence_score: 1.0, elasticity: 0.9 },
            { factor_id: 'fac_a_migration', influence_score: 1.0, elasticity: 0.9 },
            { factor_id: 'fac_b_headcount', influence_score: 1.0, elasticity: 0.9 },
          ],
          interventions: { fac_a_migration: 1, fac_b_headcount: 1 },
        }),
      )
      // Both levers are pulled and both are genuinely at the top, so the
      // option-scoped claim is a tie too — and the copy says so.
      expect(winsViaSentence()).toBe(
        'Leads via Migration investment, tied for its top lever',
      )
    })
  })
})

// ---------------------------------------------------------------------------
// PRE-ANALYSIS DELTA ROWS — the card shortens the LABEL and never the VALUE,
// and the shortened label is recoverable.
//
// WHY THESE EXIST. Measured in Chromium at 1280x800 on the five shipped
// starters (30 Aug 2026): every starter's auto-fit clamps at the 0.50
// legibility floor, so `--canvas-label-scale` is 2 and an 11px label renders
// at 22px inside a 244px card — about 19 characters a line. The old markup put
// each delta in an `inline-flex` pill sized to the card's content box with
// `gap-0.5` (2px) between the label and its value, which produced two defects:
// pills wrapping to as many as SIX lines inside a rounded border, and
// "Germany market entry" running into "Low (0) → Very high (1)" so it read as
// "market entryLow (0)".
//
// The whole suite passed 76/76 both before and after that markup was replaced,
// which is the point: nothing bound to it. These do.
// ---------------------------------------------------------------------------
describe('OptionNode — pre-analysis delta rows', () => {
  /** Two factors, so a mutant can be aimed at ONE of them (trap 19). */
  const twoFactorStore = () =>
    makeStoreState({
      ceeAnalysisReady: {
        options: [{ id: 'option-1', interventions: { 'factor-long': 0.8, 'factor-short': 0.9 } }],
      },
      nodes: [
        { id: 'factor-long', data: { label: 'Enterprise Revenue Cannibalization Risk', observedState: { unit: 'fraction', value: 0.4 } } },
        { id: 'factor-short', data: { label: 'Budget', observedState: { unit: 'fraction', value: 0.5 } } },
      ],
    }) as any

  beforeEach(() => {
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(twoFactorStore()))
  })

  it('shortens a long factor label on the card', () => {
    renderOption()
    // compactFactorLabel(…, 22) truncates at a word boundary and ellipsises.
    expect(screen.getByText('Enterprise revenue…')).toBeInTheDocument()
    // ⚠ Note the casing: the fixture supplies "Enterprise Revenue
    // Cannibalization Risk" and the card paints "Enterprise revenue…".
    // Sentence-casing happens UPSTREAM of this component, so a test written
    // against the fixture's own string silently misses (it did, first run).
    // The uncompacted string is NOT what the card paints.
    expect(screen.queryByText('Enterprise revenue cannibalization risk')).toBeNull()
  })

  it('leaves a short factor label alone — the shortening is not indiscriminate', () => {
    renderOption()
    expect(screen.getByText('Budget')).toBeInTheDocument()
  })

  it('⭐ makes the shortened label recoverable on the row itself', () => {
    // Paul, 29 Aug: ellipsis WITH recovery is a caveat; ellipsis with nowhere
    // to go is hiding. This is the binding constraint on the whole change.
    renderOption()
    const shortened = screen.getByText('Enterprise revenue…')
    const row = shortened.closest('li')
    expect(row).not.toBeNull()
    expect(row!.getAttribute('title')).toContain('Enterprise revenue cannibalization risk')
  })

  it('⭐ never shortens the VALUE, however long it is', () => {
    renderOption()
    // 40% → 80% for the long factor; the value renders complete and verbatim.
    expect(screen.getByText('40% → 80%')).toBeInTheDocument()
    expect(screen.getByText('50% → 90%')).toBeInTheDocument()
  })

  it('⭐ renders the label and its value as SEPARATE elements, so they cannot run together', () => {
    // The defect this pins: at 2px of separation, "Germany market entry" and
    // "Low (0) → Very high (1)" read as one string, "market entryLow (0)".
    renderOption()
    const label = screen.getByText('Enterprise revenue…')
    const value = screen.getByText('40% → 80%')
    expect(label).not.toBe(value)
    expect(label.contains(value)).toBe(false)
    expect(value.contains(label)).toBe(false)
    // Both are block-level, so they occupy their own lines rather than flowing.
    expect(label.className).toContain('block')
    expect(value.className).toContain('block')
  })

  it('binds each row to its own factor — two changes produce two rows', () => {
    renderOption()
    const rows = document.querySelectorAll('li[title]')
    expect(rows.length).toBe(2)
    const titles = [...rows].map(r => r.getAttribute('title') ?? '')
    expect(titles.some(t => t.startsWith('Enterprise revenue cannibalization risk'))).toBe(true)
    expect(titles.some(t => t.startsWith('Budget'))).toBe(true)
  })
})
