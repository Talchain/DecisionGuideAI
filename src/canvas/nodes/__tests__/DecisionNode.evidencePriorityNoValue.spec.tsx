/**
 * ⭐ PJ-B3 — THE GRAPH NEVER CROWNS AN UNVALUED DRIVER WITHOUT "no value yet"
 * (Canvas owner, 28 Sep 2026, decision 5; R&C #72 5866297058: "the same path
 * would crown an unvalued #1").
 *
 * The decision card's "Evidence priority: <factor>" names the factor the run
 * ranks FIRST — the same rank the factor card states as "Driver 1 of M"
 * (`selectEvidencePriorityFactorId` → `rankFactor`). On served journey C that
 * factor, "Pro paying subscribers", has no `value_source` while the option
 * levers carry one, and no value on the graph: the run's #1 is a factor the
 * model holds no value for. The row now says so, in the card's own words.
 *
 * The report is the product's `mapV5AnalysisToReport` over the served
 * `analysis_result` (CEE #2154's fixture, verbatim); `useNodeDisplayMetadata` is
 * real. Bound by the decision card's test id and the ranked factor's NODE ID.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

vi.mock('../../hooks/useAnalysisTrust', () => ({ useAnalysisTrust: vi.fn() }))
vi.mock('../../hooks/useAnalysisResultsAreCurrent', () => ({ useAnalysisResultsAreCurrent: vi.fn() }))

const hoisted = vi.hoisted(() => ({ state: null as any }))
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => unknown) => selector(hoisted.state)),
    { getState: () => hoisted.state },
  ),
}))

import { useGuidanceStore } from '../../stores/guidanceStore'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useAnalysisResultsAreCurrent } from '../../hooks/useAnalysisResultsAreCurrent'
import { DecisionNode, evidencePriorityClause } from '../DecisionNode'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import servedC from './fixtures/served-pj-c-213830Z.unvalued-drivers.json'

type Row = { factor_id: string; value_source?: string }
type Block = { enrichment: { factor_sensitivity: Row[] } }
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const served = (): Block => clone(servedC.analysis_block) as unknown as Block
/** C01's one change: #1 valued. */
function c01Shaped(): Block {
  const block = served()
  block.enrichment.factor_sensitivity.find((r) => r.factor_id === 'pro_paying_subscribers')!.value_source = 'brief_extraction'
  return block
}
function noneCarry(): Block {
  const block = served()
  for (const r of block.enrichment.factor_sensitivity) delete r.value_source
  return block
}

const DECISION_ID = 'decision-1'
const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision' } }
const optionNodes = [
  { id: 'opt-a', type: 'option', data: { type: 'option', label: 'Feature-led price rise' } },
  { id: 'opt-b', type: 'option', data: { type: 'option', label: 'Carry on as now' } },
]
const optionEdges = optionNodes.map(o => ({ id: `e-${o.id}`, source: DECISION_ID, target: o.id, data: {} }))
const FACTORS = (servedC.draft.nodes as ReadonlyArray<{ id: string; label: string }>).map((n) => ({
  id: n.id, type: 'factor', data: { type: 'factor', label: n.label },
}))

const completedRun = (block: Block) => {
  hoisted.state = {
    edges: optionEdges,
    nodes: [decisionNode, ...optionNodes, ...FACTORS],
    results: { status: 'complete', report: mapV5AnalysisToReport(block as never) },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: 0.5,
    goalConstraints: [],
    viewMode: 'standard',
    lodRung: 'full',
    selectNodeWithoutHistory: vi.fn(),
  }
}

const renderDecision = () =>
  render(
    <ReactFlowProvider>
      <DecisionNode
        {...({
          id: DECISION_ID, type: 'decision', position: { x: 0, y: 0 },
          selected: false, isConnectable: true,
          positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
          data: { label: 'How should we grow MRR?', type: 'decision' },
        } as any)}
      />
    </ReactFlowProvider>,
  )

const EVIDENCE = 'decision-evidence-priority'

beforeEach(() => {
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'current' } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(true)
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as any)
})

afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as any)
})

describe('decision 5 — the #1 treatment on the graph carries "no value yet" for an unvalued leader', () => {
  it('served journey C: the run’s #1 has no value → "Evidence priority: Pro paying subscribers · no value yet"', () => {
    completedRun(served())
    renderDecision()
    const ep = screen.getByTestId(EVIDENCE)
    expect(ep.getAttribute('data-factor-id')).toBe('pro_paying_subscribers')
    expect(ep.getAttribute('aria-label')).toBe('Evidence priority: Pro paying subscribers · no value yet')
    // The mark's exact words remain accessible, with no native tooltip.
    expect(ep.getAttribute('title') ?? '').toBe('')
  })

  it('CONTROL — C01 (#1 valued): the same factor is named, with no qualifier', () => {
    completedRun(c01Shaped())
    renderDecision()
    const ep = screen.getByTestId(EVIDENCE)
    expect(ep.getAttribute('data-factor-id')).toBe('pro_paying_subscribers')
    expect(ep.getAttribute('aria-label')).toBe('Evidence priority: Pro paying subscribers')
  })

  it('CONTROL — no row carries value_source (older payloads): no qualifier, the rule needs a contrast', () => {
    completedRun(noneCarry())
    renderDecision()
    expect(screen.getByTestId(EVIDENCE).getAttribute('aria-label')).toBe('Evidence priority: Pro paying subscribers')
  })

  it('the clause composer: the qualifier exactly when the fact holds', () => {
    expect(evidencePriorityClause({ label: 'Monthly churn', noValueYet: true })).toBe('Evidence priority: Monthly churn · no value yet')
    expect(evidencePriorityClause({ label: 'Monthly churn', noValueYet: false })).toBe('Evidence priority: Monthly churn')
  })
})
