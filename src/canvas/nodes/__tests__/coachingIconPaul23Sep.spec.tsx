/**
 * Paul 23 Sep contract feedback — points 6, 9 and 12 on the card rail.
 *
 *   6. "Keep coaching accessible on every card, but quieter. … Keep one very
 *      discreet, consistent coaching icon at Normal zoom. Hide it at quiet/far
 *      zoom." The contract adds: "Coaching opens the existing AI surface with
 *      element context and a pre-filled question; it does not send or mutate
 *      silently."
 *   9. "attention = Info blue" — no warning colour, and the budget a named constant.
 *  12. "Icons need hover/focus labels" — an accessible name on every rail icon.
 *
 * ⭐ THE DISCRIMINATING CASES (each was RED on the design-integration head
 * c85b58eb, before the change):
 *   · a card the PRODUCER names (a live guidance item targets it) carried NO
 *     resting coaching icon — the icon yielded, so "every card" was false;
 *   · at the `quiet` rung the icon still rendered — Paul: hide it there.
 * The contrast controls are the same cards at the `full` rung.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NODE_RAIL_REST_TONE_CLASS } from '../shared/nodeCardRailStyles'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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
vi.mock('../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useAnalysisResultsAreCurrent } from '../../hooks/useAnalysisResultsAreCurrent'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'
import { revealOlumiSurface } from '../../conversation/revealOlumi'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { OutcomeNode } from '../OutcomeNode'
import { RiskNode } from '../RiskNode'
import { DecisionNode } from '../DecisionNode'
import { GoalNode } from '../GoalNode'
import { ATTENTION_BUDGET } from '../shared/nodeAttention'

const NODES = [
  { id: 'decision-1', type: 'decision', position: { x: 0, y: 0 }, data: { type: 'decision', label: 'How should we price the new plan?' } },
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { type: 'goal', label: 'Grow net revenue', provenance: 'from_brief' } },
  { id: 'outcome-1', type: 'outcome', position: { x: 0, y: 0 }, data: { type: 'outcome', label: 'Revenue' } },
  { id: 'risk-1', type: 'risk', position: { x: 0, y: 0 }, data: { type: 'risk', label: 'Churn spike' } },
  { id: 'fac-price', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Monthly price', category: 'controllable', observedState: { value: 49, unit: '£', extractionType: 'explicit' } } },
  { id: 'fac-conv', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Trial conversion', category: 'controllable', observedState: { value: 0.08, unit: '%', extractionType: 'inferred', source: 'cee_inference' } } },
  { id: 'opt-base', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Keep current pricing', is_baseline: true } },
  { id: 'opt-raise', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Raise the plan price', is_baseline: false } },
]

const EDGES = [
  { id: 'e-price-out', source: 'fac-price', target: 'outcome-1', data: { weight: 0.65, direction: 'positive', weightSource: 'cee' } },
  { id: 'e-price-risk', source: 'fac-price', target: 'risk-1', data: { weight: 0.4, direction: 'positive', weightSource: 'cee' } },
  { id: 'e-out-goal', source: 'outcome-1', target: 'goal-1', data: { weight: 0.82, direction: 'positive', weightSource: 'cee' } },
  { id: 'e-risk-goal', source: 'risk-1', target: 'goal-1', data: { weight: 0.5, direction: 'negative', weightSource: 'user' } },
  { id: 'e-d-base', source: 'decision-1', target: 'opt-base', data: {} },
  { id: 'e-d-raise', source: 'decision-1', target: 'opt-raise', data: {} },
  { id: 'e-raise-price', source: 'opt-raise', target: 'fac-price', data: {} },
]

const CEE = {
  goal_node_id: 'goal-1',
  status: 'ready',
  options: [
    { id: 'opt-base', interventions: { 'fac-price': { value: 49, source: 'brief_extraction' } } },
    { id: 'opt-raise', interventions: { 'fac-price': { value: 59, source: 'brief_extraction' } } },
  ],
  blockers: [],
  bias_findings: [{ id: 'b1', code: 'anchoring', severity: 'medium', target_factor_id: 'fac-conv', explanation: 'Option settings sit close to the first figure.' }],
}

const REPORT = {
  option_probabilities: { 'opt-base': { win_probability: 0.4 }, 'opt-raise': { win_probability: 0.6 } },
  flip_thresholds: [],
}

let state: Record<string, unknown>
const selectNode = vi.fn()

function setState({ phase = 'pre', lodRung = 'full' as 'full' | 'quiet' | 'line' } = {}) {
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
    viewMode: 'standard',
    lodRung,
    selectNodeWithoutHistory: selectNode,
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

const icon = (id: string) => screen.queryByTestId(`node-coaching-icon-${id}`)

const prefill = vi.fn()
const send = vi.fn()
const dispatch = vi.fn()

beforeEach(() => {
  selectNode.mockReset()
  prefill.mockReset()
  send.mockReset()
  dispatch.mockReset()
  vi.mocked(revealOlumiSurface).mockClear()
  useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send, _dispatchAction: dispatch, guidanceItems: [] } as never)
  useAskOlumiStore.setState({ isOpen: false, draft: '', label: '', context: '' } as never)
  vi.mocked(useNodeDisplayMetadata).mockImplementation(() => BASE_META as never)
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'none' } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(false)
})
afterEach(() => cleanup())

describe('Paul 23 Sep point 6 — ONE discreet coaching icon on EVERY card at Normal zoom', () => {
  it.each(NODES.map(n => [n.type, n.id]))('%s card (%s) carries exactly one resting coaching icon, the one glyph', (_type, id) => {
    setState({ lodRung: 'full' })
    renderCard(id)
    const all = screen.queryAllByTestId(/^node-coaching-icon-/)
    expect(all).toHaveLength(1)
    const el = icon(id)!
    expect(el).toBeTruthy()
    // At REST: it lives in the resting group, not the hover-only quick actions.
    expect(el.closest(`[data-testid="node-card-rail-resting-${id}"]`)).toBeTruthy()
    expect(el.closest(`[data-testid="node-quick-actions-${id}"]`)).toBeNull()
    // ONE glyph — MessageCircle (Panel R3), never a second glyph for the same act.
    expect(el.querySelector('svg.lucide-message-circle')).toBeTruthy()
    // Point 12 — an accessible name, never an unnamed icon.
    expect((el.getAttribute('aria-label') ?? '').trim().length).toBeGreaterThan(0)
  })

  it('⭐ RED-before: a card the PRODUCER names still carries the icon — the same glyph, asking Olumi about THIS element', () => {
    useGuidanceStore.setState({
      guidanceItems: [{ item_id: 'g1', title: 'Check the price', category: 'structural', target_object: { id: 'fac-price', type: 'node' } }],
    } as never)
    setState({ lodRung: 'full' })
    renderCard('fac-price')
    const el = icon('fac-price')
    expect(el).toBeTruthy()
    expect(el!.getAttribute('aria-label')).toBe('Ask Olumi about Monthly price')
    // …and the hover-only "Ask Olumi" is not a duplicate of it.
    expect(screen.queryByTestId('node-action-ask-fac-price')).toBeNull()
  })

  it.each(['quiet', 'line'] as const)('⭐ RED-before: at the %s rung the coaching icon is hidden on every card', (rung) => {
    for (const n of NODES) {
      setState({ lodRung: rung })
      renderCard(n.id)
      expect(icon(n.id)).toBeNull()
      cleanup()
    }
  })

  it('CONTRAST: the same cards at the full rung all show it (the quiet zero is not a blind probe)', () => {
    for (const n of NODES) {
      setState({ lodRung: 'full' })
      renderCard(n.id)
      expect(icon(n.id)).toBeTruthy()
      cleanup()
    }
  })

  it('no conversation surface → no icon (never a dead control)', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
    setState({ lodRung: 'full' })
    renderCard('fac-price')
    expect(icon('fac-price')).toBeNull()
  })
})

describe('Paul 23 Sep point 6 — a click PRE-FILLS a question with the element in context; it never sends silently', () => {
  it('the generic ask pre-fills the element question and selects the element — nothing is sent', () => {
    useGuidanceStore.setState({
      guidanceItems: [{ item_id: 'g1', title: 'Check the price', category: 'structural', target_object: { id: 'fac-price', type: 'node' } }],
    } as never)
    setState({ lodRung: 'full' })
    renderCard('fac-price')
    fireEvent.click(icon('fac-price')!)
    expect(selectNode).toHaveBeenCalledWith('fac-price')
    expect(prefill).toHaveBeenCalledWith('Explain the role of "Monthly price" in this decision model.')
    expect(send).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('a resolver question pre-fills too (the outcome asks "What would falsify this?") — nothing is sent', () => {
    setState({ lodRung: 'full' })
    renderCard('outcome-1')
    const el = icon('outcome-1')!
    expect(el.getAttribute('aria-label')).toBe('What would falsify this?')
    fireEvent.click(el)
    expect(send).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
    const landedInComposer = prefill.mock.calls.length > 0
    const landedInDrawer = useAskOlumiStore.getState().isOpen
    expect(landedInComposer || landedInDrawer).toBe(true)
  })

  it('a TYPED question keeps its typed route (ED 02:31Z) but is never SILENT — the Olumi surface is revealed first', () => {
    setState({ phase: 'post', lodRung: 'full' })
    vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'current' } as never)
    vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(true)
    renderCard('decision-1')
    const el = icon('decision-1')!
    expect(el.getAttribute('aria-label')).toBe('Challenge this result')
    expect(el.getAttribute('data-coaching-typed')).toBe('true')
    fireEvent.click(el)
    expect(revealOlumiSurface).toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ action_type: 'what_would_flip' }))
  })
})

describe('Paul 23 Sep point 12 — the icon is discreet at rest and visibly labelled on focus', () => {
  // ⛔ UPDATED 25 Sep 2026 (gap 34, Visual Contract §02 `.icon-btn{color:#777B77}`):
  // the resting grey is now the rail's contract grey, not `text-text-light`. The
  // point-6 claim — grey at rest, never Info at rest — is unchanged.
  it('muted at rest (the rail grey, #777B77), info on hover AND keyboard focus, with a visible focus ring', () => {
    setState({ lodRung: 'full' })
    renderCard('fac-price')
    const cls = icon('fac-price')!.className
    expect(cls.split(/\s+/)).toContain(NODE_RAIL_REST_TONE_CLASS)
    expect(cls.split(/\s+/)).not.toContain('text-info')
    expect(cls).toContain('hover:text-info')
    expect(cls).toContain('focus-visible:text-info')
    expect(cls).toContain('focus-visible:ring-2')
    expect(cls).not.toMatch(/warning|danger/)
  })
})

describe('Paul 23 Sep point 9 — attention is Info blue, never warning; the budget is a named constant', () => {
  it('the budget is the named constant, 3', () => {
    expect(ATTENTION_BUDGET).toBe(3)
  })

  it('the "Worth reviewing" marker is info-toned with no warning or danger class anywhere in it', () => {
    setState({ lodRung: 'full' })
    renderCard('fac-conv')
    const marker = screen.getByTestId('attention-marker-fac-conv')
    const classes = [marker, ...Array.from(marker.querySelectorAll('*'))].map(e => e.getAttribute('class') ?? '').join(' ')
    // Contract v3.1 (PILL-03 / ICON-05): the marker is the contract's
    // BORDERLESS Info glyph (`.node .attention{border:0;color:var(--info)}`),
    // so Info is carried by the glyph colour, not a border (was: `border-info`).
    expect(marker.getAttribute('class')!.split(/\s+/)).toContain('text-info')
    expect(classes).not.toMatch(/(^|\s)border(-|\s|$)/)
    expect(classes).not.toMatch(/warning|danger|amber|red-/)
    // Point 12 — the reason is its accessible name, not colour alone.
    expect(marker.getAttribute('aria-label')).toMatch(/^Worth reviewing:/)
  })
})

describe('Paul 23 Sep point 12 — BaseNode icons carry a readable name, not a title alone', () => {
  it('the "Flagged as assumption" badge is an image with an accessible name', () => {
    setState({ lodRung: 'full' })
    const data = { ...NODES.find(n => n.id === 'fac-price')!.data, flagged_as_assumption: true }
    render(
      <ReactFlowProvider>
        <FactorNode
          {...({ id: 'fac-price', type: 'factor', data, selected: false, isConnectable: true, zIndex: 0,
            positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, deletable: false, selectable: true, draggable: true } as unknown as React.ComponentProps<typeof FactorNode>)}
        />
      </ReactFlowProvider>,
    )
    const badge = screen.getByTestId('assumption-badge')
    expect(badge.getAttribute('role')).toBe('img')
    expect(badge.getAttribute('aria-label')).toBe('Flagged as assumption')
  })
})
