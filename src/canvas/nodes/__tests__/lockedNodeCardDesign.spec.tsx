/**
 * ⭐ THE LOCKED NODE-CARD DESIGN — one spec per rule, RED at base `e10c4de3`.
 *
 * Authority, in order: the locked spec
 * (`docs/designs/canvas-final-v2/olumi-canvas-overnight-implementation-spec.md`),
 * the ED rulings on olumi-programme-docs#63 (5794306145 at 11:52Z, which wins
 * where it refines the spec; 5787931376 at 02:31Z), and the manual-test
 * findings MT-15b/18/19/20/21 on served `4c6ec07b`.
 *
 * Harness: the node components render against a selector-mocked canvas store
 * (the pattern `cardCopyCensus.canvas.spec.tsx` uses), with the two currency
 * hooks mocked so each rule can be driven through current / changed /
 * cannot-confirm without re-deriving the freshness machine (which has its own
 * specs). Assertions bind by test id and exact text (identity), and every
 * "absent" assertion sits beside a "present" control in the same render.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import { optionCardRows } from './__helpers__/optionPreview'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ layoutNodeWidth: null, layoutCardWidths: null }),
  ),
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../../store', () => {
  const useCanvasStore = vi.fn() as unknown as { (sel: (s: unknown) => unknown): unknown; getState: () => unknown }
  return { useCanvasStore }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
vi.mock('../../hooks/useAnalysisTrust', () => ({ useAnalysisTrust: vi.fn() }))
vi.mock('../../hooks/useAnalysisResultsAreCurrent', () => ({ useAnalysisResultsAreCurrent: vi.fn() }))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useAnalysisResultsAreCurrent } from '../../hooks/useAnalysisResultsAreCurrent'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'
import { useReadinessStore } from '../../stores/readinessStore'
import { useUIStore } from '../../../stores/uiStore'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { OutcomeNode } from '../OutcomeNode'
import { RiskNode } from '../RiskNode'
import { DecisionNode } from '../DecisionNode'
import { GoalNode } from '../GoalNode'
import { lockedCardCopyViolations } from './__helpers__/canvasCopyHonesty'

// ── fixture ────────────────────────────────────────────────────────────────

const NODES = [
  { id: 'decision-1', type: 'decision', position: { x: 0, y: 0 }, data: { type: 'decision', label: 'How should we price the new plan?' } },
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { type: 'goal', label: 'Grow net revenue', provenance: 'from_brief' } },
  { id: 'outcome-1', type: 'outcome', position: { x: 0, y: 0 }, data: { type: 'outcome', label: 'Revenue' } },
  { id: 'risk-1', type: 'risk', position: { x: 0, y: 0 }, data: { type: 'risk', label: 'Churn spike' } },
  { id: 'fac-price', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Monthly price', category: 'controllable', observedState: { value: 49, unit: '£', extractionType: 'explicit' } } },
  { id: 'fac-conv', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Trial conversion', category: 'controllable', observedState: { value: 0.08, unit: '%', extractionType: 'inferred', source: 'cee_inference' } } },
  { id: 'fac-seats', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Seat count', category: 'controllable', observedState: { value: 10, unit: 'seats', extractionType: 'explicit' } } },
  { id: 'fac-market', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Market growth', category: 'external', observedState: { value: 0.05, unit: '%', extractionType: 'explicit' }, prior: { distribution: 'uniform', range_min: 0.02, range_max: 0.09 } } },
  { id: 'opt-base', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Keep current pricing', is_baseline: true } },
  { id: 'opt-raise', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Raise the plan price', is_baseline: false } },
  { id: 'opt-bundle', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Bundle seats', is_baseline: false } },
  { id: 'opt-empty', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Freemium tier', is_baseline: false } },
]

const EDGES = [
  { id: 'e-price-out', source: 'fac-price', target: 'outcome-1', data: { weight: 0.65, direction: 'positive', weightSource: 'cee' } },
  { id: 'e-price-risk', source: 'fac-price', target: 'risk-1', data: { weight: 0.4, direction: 'positive', weightSource: 'cee' } },
  { id: 'e-out-goal', source: 'outcome-1', target: 'goal-1', data: { weight: 0.82, direction: 'positive', weightSource: 'cee' } },
  { id: 'e-risk-goal', source: 'risk-1', target: 'goal-1', data: { weight: 0.5, direction: 'negative', weightSource: 'user' } },
  { id: 'e-d-base', source: 'decision-1', target: 'opt-base', data: {} },
  { id: 'e-d-raise', source: 'decision-1', target: 'opt-raise', data: {} },
  { id: 'e-d-bundle', source: 'decision-1', target: 'opt-bundle', data: {} },
  { id: 'e-d-empty', source: 'decision-1', target: 'opt-empty', data: {} },
  { id: 'e-raise-price', source: 'opt-raise', target: 'fac-price', data: {} },
  { id: 'e-bundle-price', source: 'opt-bundle', target: 'fac-price', data: {} },
  { id: 'e-empty-seats', source: 'opt-empty', target: 'fac-seats', data: {} },
]

const CEE = {
  goal_node_id: 'goal-1',
  status: 'ready',
  options: [
    { id: 'opt-base', interventions: { 'fac-price': { value: 49, source: 'brief_extraction' }, 'fac-conv': { value: 0.08, source: 'brief_extraction' } } },
    { id: 'opt-raise', interventions: { 'fac-price': { value: 59, source: 'brief_extraction' }, 'fac-conv': { value: 0.07, source: 'cee_hypothesis' }, 'fac-seats': { value: 12, source: 'cee_hypothesis' } } },
    { id: 'opt-bundle', interventions: { 'fac-price': { value: 55, source: 'brief_extraction' }, 'fac-seats': { value: 20, source: 'user_specified' } } },
    { id: 'opt-empty', interventions: {} },
  ],
  blockers: [
    { factor_id: 'fac-seats', factor_label: 'Seat count', option_id: 'opt-empty', reason: 'no value', blocker_type: 'missing_value' },
  ],
  // A GROUNDED pre-run finding: CEE names its target (Brief 5.8A D2).
  bias_findings: [{ id: 'b1', code: 'anchoring', severity: 'medium', target_factor_id: 'fac-conv', explanation: 'Option settings sit close to the first figure.' }],
}

const REPORT = {
  option_probabilities: {
    'opt-base': { win_probability: 0.2 },
    'opt-raise': { win_probability: 0.55 },
    'opt-bundle': { win_probability: 0.25 },
  },
  flip_thresholds: [
    { node_id: 'fac-conv', label: 'Trial conversion', current_value: 8, flip_value: 6.5, unit: '%', flip_reason: 'found', value_scale: 'display' },
    { node_id: 'fac-seats', label: 'Seat count', current_value: 0.6, flip_value: 0.5, flip_reason: 'found', value_scale: 'normalised' },
    // A row the producer did NOT find a flip for — its values must never draw a track.
    { node_id: 'fac-price', label: 'Monthly price', current_value: 49, flip_value: 40, unit: '£', flip_reason: 'no_flip_in_range', value_scale: 'display' },
  ],
}

type Phase = 'pre' | 'post'
let state: Record<string, unknown>
const selectNode = vi.fn()

function setState({ phase = 'pre', viewMode = 'standard', over = {} }: { phase?: Phase; viewMode?: 'standard' | 'expert'; over?: Record<string, unknown> } = {}) {
  state = {
    hoveredOptionId: null,
    setHoveredOption: vi.fn(),
    nodes: NODES,
    edges: EDGES,
    ceeAnalysisReady: CEE,
    results: phase === 'post' ? { status: 'complete', report: REPORT } : { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: 100,
    goalConstraints: [],
    optionNumbering: { 'opt-base': 1, 'opt-raise': 2, 'opt-bundle': 3, 'opt-empty': 4 },
    runMeta: null,
    viewMode,
    lodRung: 'full',
    selectNodeWithoutHistory: selectNode,
    ...over,
  }
  const hook = useCanvasStore as unknown as { mockImplementation: (f: (sel: (s: unknown) => unknown) => unknown) => void; getState: () => unknown }
  vi.mocked(useCanvasStore).mockImplementation(((sel: (s: unknown) => unknown) => sel(state)) as never)
  ;(hook as { getState: () => unknown }).getState = () => state
}

const BASE_META = {
  sensitivityRank: null, influence: null, influenceProvenance: null, influenceImportanceBasis: null,
  influenceSetSize: null, confidence: null, confidenceIsDefaulted: false, confidenceIsProvisional: false,
  inSensitivityAnalysis: false, achievementProbability: null, achievementProbabilityIsModelledBasis: false,
  achievementProbabilityBasis: null, stabilityPercentage: null, winRate: null, winComputationFailed: false,
  predictedOutcome: null, valueOfInformation: null, voiRank: null, isResultsMode: false, goalFitAvailable: false,
}
let meta: Record<string, Record<string, unknown>> = {}
const setMeta = (m: Record<string, Record<string, unknown>>) => {
  meta = m
  vi.mocked(useNodeDisplayMetadata).mockImplementation((id: string) => ({ ...BASE_META, ...(meta[id] ?? {}) }) as never)
}

const setCurrency = (semantic: 'current' | 'changed' | 'cannot_confirm' | 'none') => {
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(semantic === 'current')
}

type CardComponent = React.ComponentType<Record<string, unknown>>

const props = (id: string): Record<string, unknown> => {
  const n = NODES.find(x => x.id === id)!
  return {
    id, type: n.type, data: n.data, selected: false, isConnectable: true, zIndex: 0,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, deletable: false, selectable: true, draggable: true,
  }
}

const GoalCard = GoalNode as unknown as CardComponent
const FactorCard = FactorNode as unknown as CardComponent

const renderCard = (Comp: CardComponent, id: string) =>
  render(<ReactFlowProvider><Comp {...props(id)} /></ReactFlowProvider>)

/**
 * The card's own face: BaseNode's root, which excludes the sibling popover.
 *
 * ⛔ UPDATED 24 Sep 2026 (GAP-36, DESIGN-GAP-AUDIT-20260924.md row 36;
 * contract §01): the accessible name dropped the literal word "node" —
 * "<code id> node: <label>." became "<Kind>: <label>. Open details." The
 * colon before the label is the one thing common to both templates and to
 * every kind, so matching on that (rather than re-adding a specific kind
 * word) keeps this helper correct across all six kinds.
 */
const face = (label: string) => screen.getByRole('group', { name: new RegExp(`: ${label}`) })
/**
 * ⭐ ED #63 5809278282 (bounded anatomy, 24 Sep): the factor's S3 findings —
 * the driver line, a found turning point, the prior-range line — moved off the
 * Standard face into the factor's popover ("can move to the existing
 * hover/focus popover and inspector rather than expanding layout geometry").
 * A finding is therefore bound INSIDE the popover (its own test id — one card
 * per render) and pinned ABSENT from the face. (The face's neutral driver cue
 * rides the value line; these fixtures' bare amounts print no value line, so
 * the cue is pinned in `FactorNode.boundedAnatomy.spec.tsx`, not here.)
 */
/*
 * ⛔ SUPERSEDED for the driver line, the TOP driver's turning point and the
 * range line (prototype, Paul 25 Sep 2026: where ED 5809278282 conflicts with
 * the prototype's card bodies, the prototype wins): those findings are ON the
 * face again, and never repeated in the popover. The helper keeps its name.
 */
const popoverFinding = (label: string, testId: string) => {
  const pop = screen.queryByTestId('node-popover')
  if (pop) expect(within(pop).queryByTestId(testId), `${testId} is repeated in the popover`).toBeNull()
  return within(face(label)).getByTestId(testId)
}
/**
 * A TOP driver's turning point whose number may not print (normalised row, or
 * incompatible units) is NOT on the resting face: the prototype's caption is
 * never shown without its number (verifier FIX_NEEDED 1, 25 Sep). It stays in
 * the popover with its sentence and the reason no number is shown.
 */
const inPopoverNotOnFace = (label: string, testId: string) => {
  expect(within(face(label)).queryByTestId(testId), `${testId} is on the face`).toBeNull()
  return within(screen.getByTestId('node-popover')).getByTestId(testId)
}

beforeEach(() => {
  selectNode.mockReset()
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as never)
  useAskOlumiStore.setState({ isOpen: false, draft: '', label: '', context: '' } as never)
  setMeta({})
  setCurrency('none')
})
afterEach(() => cleanup())

// ═════════════════════════════════════════════════════════════════════════════
// FACTOR
// ═════════════════════════════════════════════════════════════════════════════

// ED #63 5806207128: the printed M is the ANALYSED set (4), never the ranked count (3).
const DRIVER_META = { sensitivityRank: 1, influence: 1, influenceProvenance: 'normalised_elasticity', influenceSetSize: 4, influenceRankedCount: 3, inSensitivityAnalysis: true, isResultsMode: true }

describe('Factor — the driver line replaces "% influence" (spec §3; ED 02:31Z D1a; ED 11:52Z point 3)', () => {
  it('a current, ranked factor reads "Driver 1 of 3 ranked in this run" (ED 5806207128) with a bar — no "%", no "#"; the % lives in its disclosure', () => {
    setState({ phase: 'post' })
    setCurrency('current')
    setMeta({ 'fac-price': DRIVER_META })
    renderCard(FactorNode as never, 'fac-price')
    const card = face('Monthly price')
    const line = popoverFinding('Monthly price', 'factor-driver-line')
    expect(within(line).getByTestId('factor-driver-line-caption').textContent).toBe('Driver 1 of 3 ranked in this run')
    expect(within(line).getByTestId('factor-driver-line-bar')).toBeTruthy()
    expect(line.textContent).not.toContain('%')
    expect(card.textContent).not.toContain('#')
    expect(line.getAttribute('aria-label')).toContain('100% of the strongest factor')
    expect(line.getAttribute('aria-label')).toContain('not an absolute causal percentage')
  })

  // ⛔ SUPERSEDED BY CONTRACT v3.1 pt 5 (was: "carries the quantity’s own
  // noun, never a bare bar"): "A factor the run did not rank shows no rank, and
  // its detail says 'Not ranked in this run'". No line and no bar at all.
  it('an unranked factor shows no rank, no line and no bar; it says "Not ranked in this run" to AT', () => {
    setState({ phase: 'post' })
    setCurrency('current')
    setMeta({ 'fac-price': { ...DRIVER_META, sensitivityRank: null, influence: 0.4 } })
    renderCard(FactorNode as never, 'fac-price')
    const card = face('Monthly price')
    // Document-wide (ED 5809278282): neither the face nor the popover.
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line-bar')).toBeNull()
    expect(screen.queryByTestId('factor-driver-cue-fac-price')).toBeNull()
    expect(within(card).getByTestId('factor-driver-not-ranked').textContent).toBe('Not ranked in this run')
  })

  it('⛔ NO "% influence" ROW OR "Relative influence" ON THE FACE — control: the driver line is present', () => {
    setState({ phase: 'post' })
    setCurrency('current')
    setMeta({ 'fac-price': DRIVER_META })
    renderCard(FactorNode as never, 'fac-price')
    const card = face('Monthly price')
    expect(popoverFinding('Monthly price', 'factor-driver-line')).toBeTruthy()
    expect(within(card).queryByTestId('factor-influence-row')).toBeNull()
    expect(card.textContent).not.toMatch(/influence/i)
  })

  /*
   * ⭐ DESIGN INTEGRATION (23 Sep 2026) — #1891's rule applied to this face.
   * The locked spec §8 hid both cues on ANY non-current run. The later
   * authorities split that: a model KNOWN to have changed keeps its last run's
   * driver rank and turning point LABELLED `Last run · ` (Paul's Ruling 3,
   * ROADMAP 2.651; visual contract v3 "Last run · Driver N of M", "Last run ·
   * turning point"), while never-run and cannot-confirm withhold them (ED
   * 02:31Z Q2: never manufacture a "last run" claim).
   */
  it('CHANGED LABELS the driver line and the turning point "Last run · " — control: current shows both unlabelled', () => {
    setState({ phase: 'post' })
    setMeta({ 'fac-conv': DRIVER_META })
    setCurrency('current')
    renderCard(FactorNode as never, 'fac-conv')
    const freshLine = popoverFinding('Trial conversion', 'factor-driver-line')
    expect(within(freshLine).getByTestId('factor-driver-line-caption').textContent).toBe('Driver 1 of 3 ranked in this run')
    // At rest, contract v3.1 point 3 (DESIGN-GAP-v31 #38): the caption IS the
    // direction sentence (was the prototype's caption + number, 25 Sep).
    const freshTp = popoverFinding('Trial conversion', 'factor-turning-point')
    expect(within(freshTp).getByTestId('factor-turning-point-caption').textContent).toBe('Below 6.5%, the current model comparison changes.')
    expect(within(freshTp).queryByTestId('factor-turning-point-caption-value')).toBeNull()
    cleanup()
    setCurrency('changed')
    renderCard(FactorNode as never, 'fac-conv')
    const line = popoverFinding('Trial conversion', 'factor-driver-line')
    // ED 5806207128 stale form: "Last run · Driver N of M analysed".
    expect(within(line).getByTestId('factor-driver-line-caption').textContent).toBe('Last run · Driver 1 of 3 ranked')
    // Label in Name (WCAG 2.5.3): the visible caption opens the spoken name.
    expect(line.getAttribute('aria-label')!.startsWith('Last run · Driver 1 of 3 ranked')).toBe(true)
    const tp = popoverFinding('Trial conversion', 'factor-turning-point')
    expect(within(tp).getByTestId('factor-turning-point-caption').textContent).toBe('Last run · Below 6.5%, the model comparison changes.')
    expect(tp.getAttribute('aria-label')!.startsWith('Last run · Below 6.5%, the model comparison changes.')).toBe(true)
  })

  it('⛔ CANNOT-CONFIRM and NEVER-RUN HIDE the driver line and the turning point — no past analysis is invented', () => {
    setState({ phase: 'post' })
    setMeta({ 'fac-conv': DRIVER_META })
    for (const semantic of ['cannot_confirm', 'none'] as const) {
      setCurrency(semantic)
      renderCard(FactorNode as never, 'fac-conv')
      // Positive control: the card mounted.
      expect(face('Trial conversion')).toBeTruthy()
      // Document-wide (ED 5809278282): neither the face nor the popover.
      expect(screen.queryByTestId('factor-driver-line')).toBeNull()
      expect(screen.queryByTestId('factor-turning-point')).toBeNull()
      expect(screen.queryByTestId('factor-driver-cue-fac-conv')).toBeNull()
      // Paul 23 Sep point 3(d): the fallback may not invent a past run either.
      expect(screen.queryByTestId('factor-turning-point-none')).toBeNull()
      expect(document.body.textContent).not.toContain('Last run')
      cleanup()
    }
  })

  it('⛔ THE "Key driver" CORNER BADGE IS RETIRED (ED 02:31Z) — one rank, one wording', () => {
    setState({ phase: 'post' })
    setCurrency('current')
    setMeta({ 'fac-price': DRIVER_META })
    renderCard(FactorNode as never, 'fac-price')
    expect(screen.queryByTestId('sensitivity-rank-fac-price')).toBeNull()
    expect(document.body.textContent).not.toContain('Key driver')
    expect(popoverFinding('Monthly price', 'factor-driver-line')).toBeTruthy()
  })
})

describe('Factor — the one mini-visual: turning point, else a genuine range, else nothing (spec §3)', () => {
  it('a found, display-scale flip prints its value; the tooltip keeps the condition', () => {
    setState({ phase: 'post' })
    setCurrency('current')
    setMeta({ 'fac-conv': DRIVER_META })
    renderCard(FactorNode as never, 'fac-conv')
    const tp = popoverFinding('Trial conversion', 'factor-turning-point')
    // At rest the number is in the caption sentence (printed once), not on the
    // track (v3.1 #38).
    expect(within(tp).getByTestId('factor-turning-point-caption').textContent).toBe('Below 6.5%, the current model comparison changes.')
    expect(within(tp).queryByTestId('factor-turning-point-value')).toBeNull()
    expect(tp.getAttribute('aria-label')).toContain('Below 6.5%, the current model comparison changes.')
  })

  it('⛔ a NORMALISED flip prints NO number (ROADMAP 2.1371) and says why', () => {
    setState({ phase: 'post' })
    setCurrency('current')
    setMeta({ 'fac-seats': DRIVER_META })
    renderCard(FactorNode as never, 'fac-seats')
    const tp = inPopoverNotOnFace('Seat count', 'factor-turning-point')
    expect(within(tp).queryByTestId('factor-turning-point-value')).toBeNull()
    expect(tp.getAttribute('aria-label')).not.toContain('0.5')
    expect(tp.getAttribute('aria-label')).toContain('internal scale')
  })

  it('⛔ a row the producer did NOT find a flip for draws no track — control: the found row on another card does', () => {
    setState({ phase: 'post' })
    setCurrency('current')
    setMeta({ 'fac-price': DRIVER_META, 'fac-conv': DRIVER_META })
    renderCard(FactorNode as never, 'fac-price')
    expect(screen.queryByTestId('factor-turning-point')).toBeNull()
    // ⭐ Contract v3.1 point 3 (DESIGN-GAP-v31 #38) RESTORES the resting
    // fallback that ED #63 5806207128 had removed ("no line at rest") — the
    // common brief rules v3.1 wins. No row was produced for this factor, so it
    // is the UNATTESTED form: "No turning point available", never "in this run".
    // Positive control: the ranked card mounted with its driver line.
    expect(popoverFinding('Monthly price', 'factor-driver-line')).toBeTruthy()
    const none = popoverFinding('Monthly price', 'factor-turning-point-none')
    expect(none.textContent).toContain('No turning point available')
    expect(document.body.textContent).not.toContain('No turning point in this run')
    cleanup()
    renderCard(FactorNode as never, 'fac-conv')
    expect(popoverFinding('Trial conversion', 'factor-turning-point')).toBeTruthy()
    expect(screen.queryByTestId('factor-turning-point-none')).toBeNull()
  })

  it('without a turning point, an external factor discloses its genuine range — and never both (ED 5809278282: in the popover)', () => {
    setState({ phase: 'post' })
    setCurrency('current')
    setMeta({ 'fac-market': { ...DRIVER_META, sensitivityRank: 2 } })
    renderCard(FactorNode as never, 'fac-market')
    expect(screen.queryByTestId('factor-turning-point')).toBeNull()
    expect(popoverFinding('Market growth', 'factor-prior-range-fac-market').textContent).toMatch(/^Range: /)
  })
})

describe('Factor — MT-19: no bare-percent edge pills on the face; in Detailed they say what they are', () => {
  it('Normal face carries no edge pill — control: Detailed does', () => {
    setState({ phase: 'pre' })
    renderCard(FactorNode as never, 'fac-price')
    expect(within(face('Monthly price')).queryByTestId('edge-pill-strength-estimate-e-price-out')).toBeNull()
    cleanup()
    setState({ phase: 'pre', viewMode: 'expert' })
    renderCard(FactorNode as never, 'fac-price')
    expect(within(face('Monthly price')).getByTestId('edge-pill-strength-estimate-e-price-out')).toBeTruthy()
  })

  it('an Olumi-estimated link reads "Link strength est." with a visible verb and NO bare percent; the arrow is neutral', () => {
    setState({ phase: 'pre', viewMode: 'expert' })
    renderCard(FactorNode as never, 'fac-price')
    const card = face('Monthly price')
    const est = within(card).getByTestId('edge-pill-strength-estimate-e-price-out')
    // VISIBLE text only — the figure reaches assistive tech through an sr-only
    // copy, which is not on the face.
    const visible = (el: Element) => {
      const c = el.cloneNode(true) as HTMLElement
      c.querySelectorAll('.sr-only').forEach(n => n.remove())
      return c.textContent
    }
    expect(visible(est)).toBe('· Link strength est.')
    expect(visible(est.closest('span[class*="rounded-"]')!)).not.toMatch(/\d+%/)
    expect(est.querySelector('.sr-only')!.textContent).toContain('65%')
    expect(within(card).getByTestId('edge-pill-verb-e-price-risk').textContent).toBe('Raises')
    expect(card.innerHTML).not.toContain('text-success')
  })
})

describe('Factor — coaching is ONE rail icon, not a chip row (spec §2; ED 11:52Z point 3)', () => {
  it('the face has no "What’s the evidence?" chip; the rail icon asks it', () => {
    setState({ phase: 'pre' })
    renderCard(FactorNode as never, 'fac-conv')
    const card = face('Trial conversion')
    expect(within(card).queryByTestId('factor-card-question')).toBeNull()
    const icon = within(card).getByTestId('node-coaching-icon-fac-conv')
    expect(icon).toHaveAccessibleName('What’s the evidence?')
    // No duplicate "Ask Olumi" quick action beside it (ED 02:31Z D4).
    expect(within(card).queryByTestId('node-action-ask-fac-conv')).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// OPTION
// ═════════════════════════════════════════════════════════════════════════════

/*
 * ⭐ RE-POINTED TWICE. The bounded anatomy (ED #63 5809278282, 24 Sep) moved the
 * rows, `+N more` and their marks into the popover and kept a one-line face.
 * Paul (25 Sep) ruled the card must match the PROTOTYPE: the resting FACE is the
 * change rows — up to THREE, in the ONE shared order, then `+N more` from the one
 * total — so "options compare like with like" is asserted on the face itself.
 */
const cardRows = (optionId: string) => within(optionCardRows(optionId))

describe('Option — "what this option changes": ≤3 rows in ONE shared order, +N more from the one total (spec §4; Paul 25 Sep)', () => {
  it('two options that change the same factors show the SAME rows in the SAME order, on the face', () => {
    setState({ phase: 'pre' })
    renderCard(OptionNode as never, 'opt-raise')
    const raiseFace = face('Raise the plan price')
    const raiseRows = within(raiseFace).getByTestId('option-change-rows-opt-raise')
    const raiseOrder = [...raiseRows.querySelectorAll('dd')].map(d => d.getAttribute('data-testid'))
    expect(within(raiseFace).queryByTestId('option-primary-change-opt-raise')).toBeNull()
    cleanup()
    renderCard(OptionNode as never, 'opt-bundle')
    const bundleRows = within(face('Bundle seats')).getByTestId('option-change-rows-opt-bundle')
    const bundleOrder = [...bundleRows.querySelectorAll('dd')].map(d => d.getAttribute('data-testid'))
    // fac-price (set by both) leads, then fac-seats (set by both) — shared across
    // the row; opt-raise's own fac-conv follows.
    expect(raiseOrder).toEqual([
      'option-change-row-opt-raise-fac-price',
      'option-change-row-opt-raise-fac-seats',
      'option-change-row-opt-raise-fac-conv',
    ])
    expect(bundleOrder).toEqual(['option-change-row-opt-bundle-fac-price', 'option-change-row-opt-bundle-fac-seats'])
  })

  it('+N more counts from the ONE total (4 targets − 3 rows = +1), and the from→to uses the baseline option', () => {
    // A fourth target, so one change is behind `+1 more` (three rows at rest).
    const cee = {
      ...CEE,
      options: CEE.options.map(o => (o.id === 'opt-raise'
        ? { ...o, interventions: { ...o.interventions, 'fac-extra': { value: 3, source: 'cee_hypothesis' } } }
        : o)),
    }
    setState({ phase: 'pre', over: { ceeAnalysisReady: cee } })
    renderCard(OptionNode as never, 'opt-raise')
    const more = within(face('Raise the plan price')).getByTestId('option-change-more-opt-raise')
    expect(more.textContent).toBe('+1 more')
    expect(cardRows('opt-raise').getByTestId('option-change-more-opt-raise')).toBe(more)
    expect(cardRows('opt-raise').getByTestId('option-change-row-opt-raise-fac-price').textContent).toContain('£49 → £59')
  })

  it('an Olumi-chosen target stays marked est.; a user-set one is not — each row on the face keeps its own mark', () => {
    setState({ phase: 'pre' })
    renderCard(OptionNode as never, 'opt-raise')
    expect(cardRows('opt-raise').getByTestId('option-change-row-estimate-opt-raise-fac-seats')).toBeTruthy()
    // Truth stays on the card: the price row carries its own `brief` mark.
    expect(cardRows('opt-raise').getByTestId('option-change-row-source-opt-raise-fac-price').getAttribute('data-value-source')).toBe('brief')
    cleanup()
    renderCard(OptionNode as never, 'opt-bundle')
    // Positive control: the user-set row IS on the face, marked as the user's.
    expect(cardRows('opt-bundle').getByTestId('option-change-row-source-opt-bundle-fac-seats').getAttribute('data-value-source')).toBe('you')
    expect(cardRows('opt-bundle').queryByTestId('option-change-row-estimate-opt-bundle-fac-seats')).toBeNull()
  })

  it('⛔ MT-18: no bare numeral at rest — control: Detailed still carries the ordinal', () => {
    setState({ phase: 'pre' })
    renderCard(OptionNode as never, 'opt-raise')
    expect(within(face('Raise the plan price')).queryByTestId('option-stable-number-opt-raise')).toBeNull()
    cleanup()
    setState({ phase: 'pre', viewMode: 'expert' })
    renderCard(OptionNode as never, 'opt-raise')
    expect(within(face('Raise the plan price')).getByTestId('option-stable-number-opt-raise')).toBeTruthy()
  })

  it('the Standard face advertises the edit route in the rail (spec §4)', () => {
    setState({ phase: 'pre' })
    renderCard(OptionNode as never, 'opt-raise')
    expect(within(face('Raise the plan price')).getByTestId('option-edit-targets-opt-raise')).toBeTruthy()
  })
})

describe('Option — the result is model-relative, never "Support" (ED 11:52Z point 4; ED 02:31Z Q2)', () => {
  const post = () => {
    setState({ phase: 'post' })
    setMeta({ 'opt-raise': { winRate: 0.55, isResultsMode: true } })
  }
  it('current → "Current model" · "55% of runs"', () => {
    post()
    setCurrency('current')
    renderCard(OptionNode as never, 'opt-raise')
    const card = face('Raise the plan price')
    expect(within(card).getByTestId('option-win-anchor-opt-raise').textContent).toBe('Current model')
    expect(within(card).getByTestId('option-win-readout-opt-raise').textContent).toBe('55% of runs')
    expect(card.textContent).not.toMatch(/\bSupport\b/)
  })
  it('changed → "Last run"; cannot-confirm → "Model result", never "Last run"', () => {
    post()
    setCurrency('changed')
    renderCard(OptionNode as never, 'opt-raise')
    expect(within(face('Raise the plan price')).getByTestId('option-win-anchor-opt-raise').textContent).toBe('Last run')
    cleanup()
    setCurrency('cannot_confirm')
    renderCard(OptionNode as never, 'opt-raise')
    const anchor = within(face('Raise the plan price')).getByTestId('option-win-anchor-opt-raise')
    expect(anchor.textContent).toBe('Model result')
    expect(face('Raise the plan price').textContent).not.toContain('Last run')
  })
})

describe('Option — the coaching icon keeps a TYPED action typed (ED 02:31Z)', () => {
  it('after a run, the icon dispatches what_would_flip with its chip id — never a generic discuss', () => {
    setState({ phase: 'post' })
    setCurrency('current')
    setMeta({ 'opt-bundle': { winRate: 0.25, isResultsMode: true } })
    renderCard(OptionNode as never, 'opt-bundle')
    const icon = within(face('Bundle seats')).getByTestId('node-coaching-icon-opt-bundle')
    expect(icon.getAttribute('data-coaching-typed')).toBe('true')
    fireEvent.click(icon)
    const dispatch = useGuidanceStore.getState()._dispatchAction as unknown as ReturnType<typeof vi.fn>
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ action_type: 'what_would_flip' }))
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })
})

describe('Option — MT-21: "Not in this analysis" routes to the option\'s own value input (#1911 merged)', () => {
  beforeEach(() => {
    useReadinessStore.setState({
      stale: false,
      readiness: { readiness_issues: [{ option_id: 'opt-empty', waived_by_exclusion: true, message: 'Freemium tier has no values yet.' }] },
    } as never)
  })
  it('the pill is a control; keyed on the missing_value blocker it names the factor and opens the option\'s value input', () => {
    setState({ phase: 'pre' })
    useUIStore.setState({ activeOutputTab: 'results', pendingOptionValueInput: null } as never)
    renderCard(OptionNode as never, 'opt-empty')
    const pill = within(face('Freemium tier')).getByTestId('excluded-from-analysis-pill')
    expect(pill.tagName).toBe('BUTTON')
    expect(pill.getAttribute('aria-label')).toContain('Missing: Seat count.')
    expect(pill.getAttribute('aria-label')).toContain('Set what it changes in the Model tab')
    fireEvent.click(pill)
    // #1911: `openOptionValueInput` — the Model tab, this option, no chat draft.
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
    expect(useUIStore.getState().pendingOptionValueInput).toBe('opt-empty')
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// OUTCOME + RISK
// ═════════════════════════════════════════════════════════════════════════════

describe('Outcome/Risk — coaching behind the one icon; link strength off the card (ED 11:52Z point 5; contract v3.1)', () => {
  it('the outcome face has no "What would falsify this?" chip — the rail icon asks it', () => {
    setState({ phase: 'pre' })
    renderCard(OutcomeNode as never, 'outcome-1')
    const card = face('Revenue')
    expect(within(card).queryByText('What would falsify this?')).toBeNull()
    expect(within(card).getByTestId('node-coaching-icon-outcome-1')).toHaveAccessibleName('What would falsify this?')
  })

  // ⚠ SUPERSEDED BY CONTRACT v3.1 (gap U1): these two cases pinned the card's
  // "Link strength" row (MT-15b wording; ED 11:52Z "if strength is shown
  // on-node, call it link strength"). v3.1: "Outcome/risk records are distinct
  // from the strength of their connections" — strength is not shown on-node.
  it('an unconfirmed Olumi strength is not on the outcome card at all — control: the card’s coaching icon is', () => {
    setState({ phase: 'pre' })
    renderCard(OutcomeNode as never, 'outcome-1')
    const card = face('Revenue')
    expect(within(card).getByTestId('node-coaching-icon-outcome-1')).toBeTruthy()
    expect(within(card).queryByTestId('outcome-strength-row')).toBeNull()
    expect(card.textContent).not.toMatch(/Link strength|Olumi’s estimate|82%/)
  })

  it('a human-settled link keeps its figure on the connection, not the risk card — control: the risk’s own unset line', () => {
    setState({ phase: 'pre' })
    renderCard(RiskNode as never, 'risk-1')
    const card = face('Churn spike')
    // Contract v3.1 (OR-02): the risk state line carries no full stop, and
    // (DESIGN-GAP-v31 #34) shows AND announces the whole sentence.
    const unset = within(card).getByTestId('risk-exposure-unset')
    expect(unset.querySelector('.sr-only')?.textContent).toBe('Likelihood and impact not set yet')
    expect(unset.querySelector('[aria-hidden="true"]')?.textContent).toBe('Likelihood and impact not set yet')
    expect(within(card).queryByTestId('risk-strength-row')).toBeNull()
    expect(card.textContent).not.toMatch(/Link strength|50%/)
  })

  it('the risk face asks "What would we see first?" by icon; "How likely is this?" moves to the popover, not deleted (ED 02:31Z)', () => {
    setState({ phase: 'pre' })
    renderCard(RiskNode as never, 'risk-1')
    const card = face('Churn spike')
    expect(within(card).queryByText('How likely is this?')).toBeNull()
    expect(within(card).getByTestId('node-coaching-icon-risk-1')).toHaveAccessibleName('What would we see first?')
    expect(within(screen.getByTestId('node-popover')).getByText('How likely is this?')).toBeTruthy()
  })

  // ⚠ SUPERSEDED BY CONTRACT v3.1 pt 8 (gap U2): this pinned "2 of 4 options
  // connect to this" (MT-20 verb; Paul 23 Sep point 8's first cut). v3.1 drops
  // the count from every outcome unless it genuinely differentiates.
  it('the outcome carries no option-reach count, though 2 of 4 options reach it — control: the card renders', () => {
    setState({ phase: 'pre' })
    renderCard(OutcomeNode as never, 'outcome-1')
    const card = face('Revenue')
    expect(within(card).getByTestId('node-coaching-icon-outcome-1')).toBeTruthy()
    expect(within(card).queryByTestId('outcome-options-moving')).toBeNull()
    expect(card.textContent).not.toMatch(/options? connects? to this|options? moves? this/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// QUESTION + GOAL
// ═════════════════════════════════════════════════════════════════════════════

describe('Question — wide and shallow: option count + at most one short segment; coaching behind the icon (ED 11:52Z point 1; prototype 25 Sep)', () => {
  it('no coaching chip row on the face; the rail icon asks "Explore more options"', () => {
    setState({ phase: 'pre' })
    renderCard(DecisionNode as never, 'decision-1')
    const card = face('How should we price the new plan\\?')
    expect(within(card).queryByRole('button', { name: 'Explore more options' })?.getAttribute('data-testid')).toBe('node-coaching-icon-decision-1')
    expect(within(card).getByTestId('decision-node-option-count').textContent).toBe('4 alternatives')
  })

  // ⚠ SUPERSEDED BY THE PROTOTYPE (Paul, 25 Sep 2026): this pinned the top gap
  // as ONE clamped line ON the face (polish #4, `line-clamp-1`). Served, the
  // clamp still cut the sentence ("3 options · A success target on your model
  // can't be…"). The prototype row is "N alternatives · Evidence priority: …",
  // so the sentence is OFF the face, WHOLE in the popover, and the full-text
  // recovery for a screen reader is a card-side `.sr-only` copy.
  it('the top gap is off the face, whole in the popover, and a screen reader still reaches it from the card', () => {
    setState({ phase: 'pre', over: { goalThreshold: null } })
    renderCard(DecisionNode as never, 'decision-1')
    const card = face('How should we price the new plan\\?')
    expect(within(card).queryByTestId('decision-node-top-gap')).toBeNull()
    const gap = within(screen.getByTestId('node-popover')).getByTestId('decision-node-top-gap')
    expect(gap.textContent).toMatch(/^Top gap: /)
    expect(gap.textContent).not.toContain('\u2026')
    expect(gap.className.split(/\s+/)).not.toContain('line-clamp-1')
    const sr = within(card).getByTestId('decision-focus-signal-sr')
    expect(sr.className.split(/\s+/)).toContain('sr-only')
    expect(sr.textContent).toBe(gap.textContent)
  })

  it('after a run, the icon keeps "Challenge this result" TYPED (what_would_flip)', () => {
    setState({ phase: 'post' })
    setCurrency('current')
    renderCard(DecisionNode as never, 'decision-1')
    const icon = within(face('How should we price the new plan\\?')).getByTestId('node-coaching-icon-decision-1')
    expect(icon).toHaveAccessibleName('Challenge this result')
    expect(icon.getAttribute('data-coaching-typed')).toBe('true')
  })
})

describe('Goal — wide and shallow: target state + one Chance row; provenance compact; coaching behind the icon (ED 11:52Z point 2)', () => {
  // Contract v3.1 pt 1 ("The separate rail source icons are removed") supersedes
  // the rail provenance icon ED 11:52Z point 2 put here. At rest the goal face
  // carries no brief icon; the label's notice is in the card's details.
  it('"From your brief" is NOT a rail icon at rest (v3.1 pt 1) — the notice sits in the details (Detailed inline)', () => {
    setState({ phase: 'pre' })
    renderCard(GoalNode as never, 'goal-1')
    const card = face('Grow net revenue')
    expect(within(card).queryByTestId('pre-analysis-v3-goal-from-brief')).toBeNull()
    expect(within(card).queryByRole('button', { name: /^From your brief/ })).toBeNull()
    expect(within(card).queryByText('From your brief')).toBeNull()
    cleanup()
    setState({ phase: 'pre', viewMode: 'expert' })
    renderCard(GoalNode as never, 'goal-1')
    const notice = within(face('Grow net revenue')).getByTestId('pre-analysis-v3-goal-from-brief')
    expect(notice.tagName).not.toBe('BUTTON')
    expect(notice.textContent).toMatch(/^Taken from your brief/)
  })

  it('no "Is this the real goal?" chip and no "Run analysis" chip on the face — the rail icon asks the question', () => {
    setState({ phase: 'pre' })
    renderCard(GoalNode as never, 'goal-1')
    const card = face('Grow net revenue')
    expect(within(card).queryByText('Run analysis')).toBeNull()
    expect(within(card).getByTestId('node-coaching-icon-goal-1')).toHaveAccessibleName('Is this the real goal?')
  })

  it('ONE Chance row after a run; "Last run ·" only when the model CHANGED (ED 02:31Z) — cannot-confirm is unprefixed', () => {
    setState({ phase: 'post', over: { nodes: NODES.map(n => n.id === 'goal-1' ? { ...n, data: { ...n.data, goal_threshold_raw: 100 } } : n) } })
    setMeta({ 'goal-1': { achievementProbability: 0.34, isResultsMode: true } })
    setCurrency('changed')
    const goalProps = { ...props('goal-1'), data: { type: 'goal', label: 'Grow net revenue', goal_threshold_raw: 100 } }
    render(<ReactFlowProvider><GoalCard {...goalProps} /></ReactFlowProvider>)
    const row = within(face('Grow net revenue')).getByTestId('goal-achievement-metric-row')
    expect(row.textContent).toContain('Last run · Chance')
    expect(within(face('Grow net revenue')).queryByText(/chance of reaching target/)).toBeNull()
    cleanup()
    setCurrency('cannot_confirm')
    render(<ReactFlowProvider><GoalCard {...goalProps} /></ReactFlowProvider>)
    expect(within(face('Grow net revenue')).getByTestId('goal-achievement-metric-row').textContent).not.toContain('Last run')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// WORTH REVIEWING + PROVENANCE EXCEPTIONS (shared frame)
// ═════════════════════════════════════════════════════════════════════════════

describe('"Worth reviewing" — one selective, grounded, NON-warning cue (spec §2; ED 11:52Z point 7; ED 02:31Z D1b)', () => {
  it('a grounded finding marks its element with an info ring whose accessible name gives the reason; the rail carries the behaviour icon', () => {
    setState({ phase: 'pre' })
    renderCard(FactorNode as never, 'fac-conv')
    const card = face('Trial conversion')
    const marker = screen.getByTestId('attention-marker-fac-conv')
    expect(marker.getAttribute('aria-label')).toMatch(/^Worth reviewing: Worth checking: anchoring\./)
    // It reads as "worth thinking about", never as a warning or error.
    expect(marker.outerHTML).not.toMatch(/warning|danger/)
    // Contract v3.1 (PILL-03 / ICON-05): the ring is now the contract's target
    // GLYPH (an svg), and the Info identity sits on the marker itself — the one
    // Info-at-rest mark on the card. (Was: the CSS donut's `border-info`.)
    expect(within(marker).getByTestId('attention-marker-ring').tagName.toLowerCase()).toBe('svg')
    expect(marker.className.split(/\s+/)).toContain('text-info')
    expect(within(card).getByTestId('node-rail-behaviour-fac-conv')).toBeTruthy()
  })

  it('⛔ an element with no grounded signal carries no marker — the Olumi estimate alone never qualifies', () => {
    setState({ phase: 'pre', over: { ceeAnalysisReady: { ...CEE, bias_findings: [] } } })
    renderCard(FactorNode as never, 'fac-conv')
    // fac-conv IS an unconfirmed Olumi estimate (extractionType inferred) —
    // the control for "AI-generated alone never qualifies".
    expect(screen.queryByTestId('attention-marker-fac-conv')).toBeNull()
    // PRECONDITION PINNED: the fixture really is an unconfirmed Olumi estimate.
    const conv = NODES.find(n => n.id === 'fac-conv')!.data as { observedState: { extractionType: string } }
    expect(conv.observedState.extractionType).toBe('inferred')
  })
})

describe('provenance at rest = exceptions to the board default (spec §6; ED 11:52Z point 8)', () => {
  const board = [
    { id: 'fa', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Alpha', category: 'controllable', observedState: { value: 0.5, source: 'cee_inference', extractionType: 'inferred' } } },
    { id: 'fb', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Beta', category: 'controllable', observedState: { value: 0.4, source: 'cee_inference', extractionType: 'inferred' } } },
    { id: 'fc', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Gamma', category: 'controllable', observedState: { value: 0.3, source: 'user_override' } } },
  ]
  const boardProps = (id: string): Record<string, unknown> => ({ ...props('fac-price'), id, data: board.find(n => n.id === id)!.data })

  /**
   * ⛔⛔ UPDATED 24 Sep 2026 (GAP-16, DESIGN-GAP-AUDIT-20260924.md row 16).
   *
   * This board is all FACTOR cards, so every mark this test could ever see is
   * a `claim: 'value'` mark — and GAP-16 removes those from the header
   * unconditionally (contract §03: "Show useful exceptions, not the same
   * provenance mark everywhere"; the same number already carries its own
   * mark on the value line, `valueSourceMark.tsx`). The board-default
   * "exception" mechanism this test exercised (`hideKind`, spec §6 / ED
   * 11:52Z point 8) is now moot for factors specifically: Gamma's
   * `user_override` value used to be the "shown exception" against Alpha/
   * Beta's quieted "AI estimate" default; both are quiet now, in every view,
   * because there is no header value mark left to show OR quiet. `hideKind`
   * itself is untouched (it still governs STRUCTURAL-claim repetition on
   * option/decision/outcome boards), so this file's other describe blocks
   * are unaffected — only the factor-only board below loses its
   * distinguishing case.
   */
  it('factor cards never carry a header provenance mark any more — the value is stated once, on the value line', () => {
    setState({ phase: 'pre', over: { nodes: board, edges: [] } })
    render(<ReactFlowProvider><FactorCard {...boardProps('fa')} /></ReactFlowProvider>)
    expect(within(face('Alpha')).queryByTestId('node-provenance-mark')).toBeNull()
    cleanup()
    render(<ReactFlowProvider><FactorCard {...boardProps('fc')} /></ReactFlowProvider>)
    // Gamma's human-edited value used to be the shown "exception" against the
    // repeated Olumi default. It is quiet now too — de-duplicated, not lost:
    // its own value-line mark (`data-value-source="you"`/"edited") still
    // renders, proven in `BaseNode.gap16NoDuplicateHeaderProvenance.spec.tsx`.
    expect(within(face('Gamma')).queryByTestId('node-provenance-mark')).toBeNull()
    cleanup()
    setState({ phase: 'pre', viewMode: 'expert', over: { nodes: board, edges: [] } })
    render(<ReactFlowProvider><FactorCard {...boardProps('fa')} /></ReactFlowProvider>)
    // Detailed view used to show every mark, board default included. It still
    // shows every mark `resolveProvenanceMarks` returns — there just aren't
    // any value-claim ones left to show.
    expect(within(face('Alpha')).queryByTestId('node-provenance-mark')).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// THE COPY GUARD — every card, both phases, both views, every currency
// ═════════════════════════════════════════════════════════════════════════════


/** Every piece of copy a reader can meet: each text node, each accessible name, each title. */
function renderedCopy(root: HTMLElement): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent?.trim()
    if (t) out.push(t)
  }
  for (const el of root.querySelectorAll('[aria-label], [title]')) {
    const a = el.getAttribute('aria-label')
    const t = el.getAttribute('title')
    if (a) out.push(a)
    if (t) out.push(t)
  }
  return out
}

describe('copy guard — the locked design’s ban list holds on every rendered surface', () => {
  it('CONTROL — the predicate catches each banned form it names', () => {
    expect(lockedCardCopyViolations('Relative influence 74%')).toHaveLength(1)
    expect(lockedCardCopyViolations('Support 55%')).toHaveLength(1)
    expect(lockedCardCopyViolations('Driver #1 of 4')).toHaveLength(1)
    expect(lockedCardCopyViolations('Key driver 1')).toHaveLength(1)
    expect(lockedCardCopyViolations('A contested link')).toHaveLength(1)
    expect(lockedCardCopyViolations('You are anchored on the first number')).toHaveLength(1)
    expect(lockedCardCopyViolations('You have anchoring bias')).toHaveLength(1)
    // …and passes the locked wording.
    // ED #63 5806207128 wording (current, stale), and the unranked AT line.
    expect(lockedCardCopyViolations('Driver 1 of 6 ranked in this run')).toEqual([])
    expect(lockedCardCopyViolations('Last run · Driver 1 of 6 ranked')).toEqual([])
    expect(lockedCardCopyViolations('Not ranked in this run')).toEqual([])
    expect(lockedCardCopyViolations('Current model · 55% of runs · Goal only')).toEqual([])
    expect(lockedCardCopyViolations('Current model · 55% of runs')).toEqual([])
    expect(lockedCardCopyViolations('Worth checking: anchoring. What would show whether it applies here?')).toEqual([])
    expect(lockedCardCopyViolations('Most supported')).toEqual([])
  })

  const CARDS: Array<[string, CardComponent, string]> = [
    ['factor', FactorNode as never, 'fac-conv'],
    ['factor', FactorNode as never, 'fac-price'],
    ['factor', FactorNode as never, 'fac-market'],
    ['option', OptionNode as never, 'opt-raise'],
    ['option', OptionNode as never, 'opt-base'],
    ['outcome', OutcomeNode as never, 'outcome-1'],
    ['risk', RiskNode as never, 'risk-1'],
    ['decision', DecisionNode as never, 'decision-1'],
    ['goal', GoalNode as never, 'goal-1'],
  ]
  const STATES: Array<[Phase, 'standard' | 'expert', 'current' | 'changed' | 'cannot_confirm' | 'none']> = [
    ['pre', 'standard', 'none'], ['pre', 'expert', 'none'],
    ['post', 'standard', 'current'], ['post', 'expert', 'current'],
    ['post', 'standard', 'changed'], ['post', 'standard', 'cannot_confirm'],
  ]
  it.each(CARDS.flatMap(([kind, Comp, id]) => STATES.map(([phase, view, cur]) => [kind, id, phase, view, cur, Comp] as const)))(
    '%s %s · %s · %s · %s',
    (_kind, id, phase, view, cur, Comp) => {
      setState({ phase, viewMode: view })
      setCurrency(cur)
      setMeta({
        'fac-conv': { ...DRIVER_META, sensitivityRank: 1, confidence: 0.6 },
        'fac-price': { ...DRIVER_META, sensitivityRank: null, influence: 0.4, voiRank: 1, valueOfInformation: 0.3 },
        'opt-raise': { winRate: 0.55, isResultsMode: true },
        'opt-base': { winRate: 0.2, isResultsMode: true },
        'goal-1': { achievementProbability: 0.34, isResultsMode: true },
      })
      const { container } = render(<ReactFlowProvider><Comp {...props(id)} /></ReactFlowProvider>)
      const copy = renderedCopy(container)
      // POSITIVE CONTROL: the probe read the card, not an empty tree.
      expect(copy.length).toBeGreaterThan(2)
      const offences = copy.flatMap(t => lockedCardCopyViolations(t).map(rule => `${rule}: "${t}"`))
      expect(offences).toEqual([])
    },
  )
})
