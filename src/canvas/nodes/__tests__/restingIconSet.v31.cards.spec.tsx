/**
 * ONE RESTING ICON SET, on the six real cards — contract v3.1 pts 1, 6 and 7;
 * gaps U6, U7 and U8 (24 Sep, Paul's two served screenshots).
 *
 *   U6 (pt 6) — at the quiet/line rungs a card carries NO coaching glyph: not
 *      the rail icon, not the corner coaching/structural marker, and not the
 *      factor's evidence-gap "?". At `full` the same fixture shows them (the
 *      contrast control). ⭐ RED-before at 24e06704: the marker and the "?"
 *      rendered at `quiet` and `line`.
 *   U8 (pts 1/7) — the option card no longer carries the card-level
 *      "From your brief" `BriefIcon`; its change rows keep their own source
 *      marks. ⭐ RED-before at 24e06704: `brief-icon` rendered on a run option.
 *   U7 — a CHARACTERISATION GUARD, green at base by design: the local-rule
 *      science icons (`useScienceIcons`) already render in Detailed only, so the
 *      resting "sparkle" is not one of them. It is the node-authorship mark
 *      (`node-provenance-mark`, Sparkles = "Olumi suggested this"), which is
 *      left as it is and reported: its at-rest behaviour is an ED 11:52Z pt 8
 *      ruling (model default + local exceptions) that v3.1 does not name.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
// ⭐ The evidence-gap badge is ON, as it is for a deployed user
// (FactorNode.constraintBadgeBinding.spec records the served bundle's value).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => true),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))
vi.mock('../../store', () => {
  const useCanvasStore = vi.fn() as unknown as { (sel: (s: unknown) => unknown): unknown; getState: () => unknown }
  return { useCanvasStore }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
vi.mock('../../hooks/useAnalysisTrust', () => ({ useAnalysisTrust: vi.fn() }))
vi.mock('../../hooks/useAnalysisResultsAreCurrent', () => ({ useAnalysisResultsAreCurrent: vi.fn() }))
// The popover is always open here, so Layer 2 (where `BriefIcon` lived) is observable.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))
vi.mock('../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useAnalysisResultsAreCurrent } from '../../hooks/useAnalysisResultsAreCurrent'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { optionCardRows } from './__helpers__/optionPreview'
import { OutcomeNode } from '../OutcomeNode'
import { RiskNode } from '../RiskNode'
import { DecisionNode } from '../DecisionNode'
import { GoalNode } from '../GoalNode'

const NODES = [
  { id: 'decision-1', type: 'decision', position: { x: 0, y: 0 }, data: { type: 'decision', label: 'How should we price the new plan?', provenance: 'ai_inferred' } },
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { type: 'goal', label: 'Grow net revenue', provenance: 'ai_inferred' } },
  { id: 'outcome-1', type: 'outcome', position: { x: 0, y: 0 }, data: { type: 'outcome', label: 'Revenue', provenance: 'ai_inferred' } },
  { id: 'risk-1', type: 'risk', position: { x: 0, y: 0 }, data: { type: 'risk', label: 'Churn spike', provenance: 'from_brief' } },
  // Observed: a brief-stamped value. No "?" at any rung (a same-run negative control).
  { id: 'fac-price', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Monthly price', category: 'controllable', observedState: { value: 49, unit: '£', extractionType: 'explicit', source: 'brief_extraction' } } },
  // Unobserved: an Olumi-inferred value. The "?" renders at `full` (the positive control).
  { id: 'fac-conv', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Trial conversion', category: 'controllable', observedState: { value: 0.08, unit: '%', extractionType: 'inferred', source: 'cee_inference' } } },
  { id: 'opt-base', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Keep current pricing', is_baseline: true, provenance: 'from_brief' } },
  { id: 'opt-raise', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Raise the plan price', is_baseline: false, provenance: 'from_brief' } },
]

const EDGES = [
  { id: 'e-price-out', source: 'fac-price', target: 'outcome-1', data: { weight: 0.65, direction: 'positive', weightSource: 'cee' } },
  { id: 'e-conv-out', source: 'fac-conv', target: 'outcome-1', data: { weight: 0.5, direction: 'positive', weightSource: 'cee' } },
  { id: 'e-price-risk', source: 'fac-price', target: 'risk-1', data: { weight: 0.4, direction: 'positive', weightSource: 'cee' } },
  { id: 'e-out-goal', source: 'outcome-1', target: 'goal-1', data: { weight: 0.82, direction: 'positive', weightSource: 'cee' } },
  { id: 'e-risk-goal', source: 'risk-1', target: 'goal-1', data: { weight: 0.5, direction: 'negative', weightSource: 'user' } },
  { id: 'e-d-base', source: 'decision-1', target: 'opt-base', data: {} },
  { id: 'e-d-raise', source: 'decision-1', target: 'opt-raise', data: {} },
  { id: 'e-raise-price', source: 'opt-raise', target: 'fac-price', data: {} },
]

// `opt-raise` IS listed in `analysis_ready.options` — the only condition the
// removed `BriefIcon` checked.
const CEE = {
  goal_node_id: 'goal-1',
  status: 'ready',
  options: [
    { id: 'opt-base', interventions: { 'fac-price': { value: 49, source: 'brief_extraction' } } },
    { id: 'opt-raise', interventions: { 'fac-price': { value: 59, source: 'brief_extraction' } } },
  ],
  blockers: [],
}

const REPORT = {
  option_probabilities: { 'opt-base': { win_probability: 0.4 }, 'opt-raise': { win_probability: 0.6 } },
  flip_thresholds: [],
}

type Rung = 'full' | 'quiet' | 'line'
let state: Record<string, unknown>

function setState({ phase = 'pre', lodRung = 'full', viewMode = 'standard' }: { phase?: 'pre' | 'post'; lodRung?: Rung; viewMode?: 'standard' | 'expert' } = {}) {
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
    optionNumbering: { 'opt-base': 1, 'opt-raise': 2 },
    runMeta: null,
    viewMode,
    lodRung,
    selectNodeWithoutHistory: vi.fn(),
    setShowDraftChat: vi.fn(),
  }
  const hook = useCanvasStore as unknown as { getState: () => unknown }
  vi.mocked(useCanvasStore).mockImplementation(((sel: (s: unknown) => unknown) => sel(state)) as never)
  hook.getState = () => state
}

const BASE_META = {
  sensitivityRank: null, influence: null, influenceProvenance: null, influenceImportanceBasis: null,
  influenceSetSize: null, confidence: null, confidenceIsDefaulted: false, confidenceIsProvisional: false,
  inSensitivityAnalysis: false, achievementProbability: null, achievementProbabilityIsModelledBasis: false,
  achievementProbabilityBasis: null, stabilityPercentage: null, winRate: null, winComputationFailed: false,
  predictedOutcome: null, valueOfInformation: null, voiRank: null, isResultsMode: false, goalFitAvailable: false,
}

type CardComponent = React.ComponentType<Record<string, unknown>>
const CARD: Record<string, CardComponent> = {
  decision: DecisionNode as unknown as CardComponent,
  goal: GoalNode as unknown as CardComponent,
  outcome: OutcomeNode as unknown as CardComponent,
  risk: RiskNode as unknown as CardComponent,
  factor: FactorNode as unknown as CardComponent,
  option: OptionNode as unknown as CardComponent,
}

const renderCard = (id: string) => {
  const n = NODES.find(x => x.id === id)!
  const Comp = CARD[n.type]!
  return render(
    <ReactFlowProvider>
      <Comp
        id={id} type={n.type} data={n.data} selected={false} isConnectable zIndex={0}
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} deletable={false} selectable draggable
      />
    </ReactFlowProvider>,
  )
}

/** Every coaching glyph family a card can carry at rest, bound by testid prefix. */
const COACHING_GLYPH_SELECTOR = [
  '[data-testid^="node-coaching-icon-"]',
  '[data-testid^="node-coaching-marker-"]',
  '[data-testid^="node-structural-marker-"]',
  '[data-testid="evidence-gap-badge"]',
  '[data-testid="evidence-gap-badge-hover"]',
].join(', ')

/** The producer names `fac-price`, so its corner marker is in play on that card. */
const PRODUCER_ITEM = {
  item_id: 'g1', category: 'should_fix', source: 'structural', title: 'Check the price', priority: 50,
  primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
  target_object: { id: 'fac-price', type: 'node' },
}

beforeEach(() => {
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [PRODUCER_ITEM] } as never)
  vi.mocked(useNodeDisplayMetadata).mockImplementation(() => BASE_META as never)
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'none' } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(false)
})
afterEach(() => cleanup())

describe('U6 · v3.1 pt 6 — one resting icon set: no coaching glyph at quiet/far zoom', () => {
  it('CONTRAST (full): the producer marker, the rail icon and the "?" all render where they apply', () => {
    setState({ lodRung: 'full' })
    renderCard('fac-price')
    expect(screen.getByTestId('node-coaching-marker-fac-price')).toBeTruthy()
    expect(screen.getByTestId('node-coaching-icon-fac-price')).toBeTruthy()
    cleanup()
    // NODE-ANATOMY v3.2 (24 Sep): the "?" hangs off the card's corner, so it is
    // off the STANDARD face ("no pills on the border"; audit F8/FRAME-13) and
    // stays in Detailed. The rung gate this file pins is the badge's own
    // (`EvidenceGapBadge` + `selectRestingGlyphsShown`); Detailed is where the
    // badge still mounts, so that is where its positive control lives.
    setState({ lodRung: 'full', viewMode: 'expert' })
    renderCard('fac-conv')
    expect(screen.getByTestId('evidence-gap-badge')).toHaveTextContent('?')
    cleanup()
    // Same-run negative control: an observed (brief-stamped) value earns no "?".
    renderCard('fac-price')
    expect(screen.queryByTestId('evidence-gap-badge')).toBeNull()
    cleanup()
    // v3.2: and the Standard face carries no "?" at the full rung either.
    setState({ lodRung: 'full', viewMode: 'standard' })
    renderCard('fac-conv')
    expect(screen.getByTestId('node-title')).toBeTruthy()
    expect(screen.queryByTestId('evidence-gap-badge')).toBeNull()
  })

  it.each(['quiet', 'line'] as const)('⭐ RED-before: at %s NO card carries any coaching glyph', (rung) => {
    // Collected across ALL six cards before asserting, so a failure names every
    // glyph still on the board (at 24e06704: fac-price's marker AND fac-conv's "?").
    const onBoard: Record<string, (string | null)[]> = {}
    for (const n of NODES) {
      setState({ lodRung: rung })
      const { container } = renderCard(n.id)
      const glyphs = [...container.querySelectorAll(COACHING_GLYPH_SELECTOR)].map(el => el.getAttribute('data-testid'))
      if (glyphs.length > 0) onBoard[n.id] = glyphs
      cleanup()
    }
    expect(onBoard).toEqual({})
  })

  it('the rail icon and the corner marker agree on the gate at every rung (one predicate, two readers)', () => {
    for (const rung of ['full', 'quiet', 'line'] as const) {
      setState({ lodRung: rung })
      renderCard('fac-price')
      const icon = screen.queryByTestId('node-coaching-icon-fac-price') !== null
      const marker = screen.queryByTestId('node-coaching-marker-fac-price') !== null
      expect({ rung, icon, marker }).toEqual({ rung, icon: rung === 'full', marker: rung === 'full' })
      cleanup()
    }
  })
})

describe('U8 · v3.1 pts 1/7 — no card-level "From your brief" icon on an option', () => {
  it.each(['standard', 'expert'] as const)('⭐ RED-before: after a run (%s view) the option carries no brief-icon', (viewMode) => {
    setState({ phase: 'post', lodRung: 'full', viewMode })
    const { container } = renderCard('opt-raise')
    // Precondition: Layer 2 (the popover in standard, inline in Detailed) is mounted,
    // so the absence below is measured where the icon used to render.
    if (viewMode === 'standard') expect(screen.getByTestId('node-popover')).toBeTruthy()
    expect(container.querySelector('[data-testid="brief-icon"]')).toBeNull()
  })

  it('CONTRAST: the change row keeps its own source mark ("brief")', () => {
    setState({ phase: 'post', lodRung: 'full' })
    renderCard('opt-raise')
    // The change rows are ON THE CARD at rest (Paul 25 Sep, the prototype) — the
    // row's own mark is read THERE.
    expect(optionCardRows('opt-raise').querySelector('[data-testid="option-change-row-source-opt-raise-fac-price"]')).toHaveTextContent('brief')
  })

  it('REPORTED, NOT CHANGED: any document glyph left on the option at rest is the node-authorship mark', () => {
    setState({ phase: 'post', lodRung: 'full' })
    const { container } = renderCard('opt-raise')
    const docGlyphs = [...container.querySelectorAll('svg.lucide-file-text')]
    // Positive control: on this mixed board the header mark IS a document glyph,
    // so the loop below is not vacuous.
    expect(docGlyphs.length).toBeGreaterThan(0)
    for (const g of docGlyphs) {
      const mark = g.closest('[data-testid="node-provenance-mark"]')
      expect(mark).not.toBeNull()
      expect(mark!.getAttribute('data-provenance-kind')).toBe('brief')
    }
  })
})

describe('U7 · characterisation guard (green at base) — local-rule science icons are Detailed-only', () => {
  it.each(['pre', 'post'] as const)('at rest (%s), no card renders a ScienceIcon trigger', (phase) => {
    for (const n of NODES) {
      setState({ phase, lodRung: 'full' })
      const { container } = renderCard(n.id)
      expect(container.querySelector('[data-testid="science-icon-trigger"]'), n.id).toBeNull()
      cleanup()
    }
  })

  it('CONTRAST: in Detailed the baseline option shows its status-quo ScienceIcon (the probe can see one)', () => {
    setState({ lodRung: 'full', viewMode: 'expert' })
    const { container } = renderCard('opt-base')
    expect(container.querySelector('[data-testid="science-icon-trigger"]')).not.toBeNull()
  })

  it('the resting sparkle on Decision/Outcome/Goal is the node-authorship mark, never a science icon', () => {
    let sparkles = 0
    for (const id of ['decision-1', 'outcome-1', 'goal-1']) {
      setState({ lodRung: 'full' })
      const { container } = renderCard(id)
      for (const g of container.querySelectorAll('svg.lucide-sparkles')) {
        sparkles++
        const mark = g.closest('[data-testid="node-provenance-mark"]')
        expect(mark, id).not.toBeNull()
        expect(mark!.getAttribute('data-provenance-kind')).toBe('ai')
      }
      cleanup()
    }
    // Positive control: on this mixed board the probe does see the sparkles.
    expect(sparkles).toBeGreaterThan(0)
  })
})
