/**
 * ⭐⭐ THE QUESTION CARD'S META ROW IS ONE LINE, AND " · " BINDS TO ITS CLAUSE.
 *
 * SERVED DEFECT (design audit 26 Sep 2026 #11, UI 853feeb7): in 5/5 starters
 * line 1 of the Question card ended "4 alternatives ·" with the "·" dangling
 * and the clause wrapped under it ("Assumptions open for / review"). After the
 * Run on the pricing starter the row became
 *   "4 alternatives | · | Evidence priority: Top Account Revenue Concentration"
 * over four lines and the card grew 94.4 → 109.5px on screen (ED 5810951997:
 * no card grows). The row was a free-wrapping flex run with the separator as
 * its own flex item (`READINESS_SEPARATOR`, DecisionNode.tsx:269).
 *
 * TARGET (prototype `.row-meta`): "3 alternatives · Evidence priority:
 * conversion" on ONE 11px line; the separator binds to the clause it
 * introduces (one non-breaking unit); the clause ends in an ellipsis when it
 * does not fit, whole in the tooltip.
 *
 * FIXTURE: the served pricing starter's decision, option and factor ids and
 * labels; factors carry Olumi-estimated values (`extractionType: 'inferred'`,
 * the served `est.` marks) so the pre-run clause is "Assumptions open for
 * review"; the run ranks `fac_top_account_concentration` first, as served.
 *
 * CLAIM SCOPE: jsdom proves class tokens, element identity and text — never
 * layout. On-screen heights are measured in real Chromium (PR body).
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
import { DecisionNode } from '../DecisionNode'

// Served pricing starter (design audit capture `run-1280x800-pricing-model.json`).
const DECISION_ID = 'dec_pricing'
const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision' } }
const optionNodes = [
  ['opt_full_switch', 'Full Switch to Usage-Based at Renewal'],
  ['opt_hybrid', 'Hybrid Platform Fee Plus Usage'],
  ['opt_new_logos', 'Usage-Based for New Logos Only'],
  ['opt_status_quo', 'Keep Per-Seat Pricing (Status Quo)'],
].map(([id, label]) => ({ id, type: 'option', data: { type: 'option', label } }))
const optionEdges = optionNodes.map(o => ({ id: `e-${o.id}`, source: DECISION_ID, target: o.id, data: {} }))
const FACTORS = [
  ['fac_adoption_friction', 'Bottom-Up Adoption Friction'],
  ['fac_enterprise_revenue_risk', 'Enterprise Revenue Cannibalization Risk'],
  ['fac_market_competition', 'Competitive Pressure for Usage Pricing'],
  ['fac_top_account_concentration', 'Top Account Revenue Concentration'],
  ['fac_usage_exposure', 'Usage-Based Pricing Exposure'],
].map(([id, label]) => ({ id, type: 'factor', data: { type: 'factor', label, observedState: { value: 0.5, extractionType: 'inferred' } } }))

// The run ranks the served "Evidence priority" factor first.
const servedRankedReport = {
  factor_sensitivity: [
    { factor_id: 'fac_top_account_concentration', label: 'Top Account Revenue Concentration', influence_score: 1.0, elasticity: 3.6 },
    { factor_id: 'fac_enterprise_revenue_risk', label: 'Enterprise Revenue Cannibalization Risk', influence_score: 0.7, elasticity: 2.4 },
    { factor_id: 'fac_usage_exposure', label: 'Usage-Based Pricing Exposure', influence_score: 0.5, elasticity: 1.6 },
    { factor_id: 'fac_adoption_friction', label: 'Bottom-Up Adoption Friction', influence_score: 0.3, elasticity: 0.9 },
    { factor_id: 'fac_market_competition', label: 'Competitive Pressure for Usage Pricing', influence_score: 0.1, elasticity: 0.3 },
  ],
}

const setStore = (overrides: Record<string, unknown> = {}) => {
  hoisted.state = {
    edges: optionEdges,
    nodes: [decisionNode, ...optionNodes, ...FACTORS],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: 0.5,
    goalConstraints: [],
    viewMode: 'standard',
    lodRung: 'full',
    selectNodeWithoutHistory: vi.fn(),
    ...overrides,
  }
}
const setCurrency = (semantic: 'current' | 'none') => {
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(semantic === 'current')
}
const renderDecision = () =>
  render(
    <ReactFlowProvider>
      <DecisionNode
        {...({
          id: DECISION_ID, type: 'decision', position: { x: 0, y: 0 },
          selected: false, isConnectable: true,
          positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
          data: { label: 'Pricing Model Transition Strategy', type: 'decision' },
        } as any)}
      />
    </ReactFlowProvider>,
  )

const tokens = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
const row = () => screen.getByTestId('decision-node-resting-state')
const childIds = (el: Element) => Array.from(el.children).map(c => c.getAttribute('data-testid'))

beforeEach(() => {
  setStore()
  setCurrency('none')
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as any)
})
afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as any)
})

describe('served pricing Question card — one meta line; the separator binds to its clause', () => {
  it('pre-run: "4 alternatives · Assumptions open for review" — the "·" is inside ONE non-breaking unit with the clause', () => {
    renderDecision()
    expect(row().textContent).toBe('4 alternatives·Assumptions open for review')
    expect(childIds(row())).toEqual(['decision-node-option-count', 'decision-row-meta-clause'])
    const unit = screen.getByTestId('decision-row-meta-clause')
    expect(childIds(unit)).toEqual(['decision-row-meta-separator', 'decision-assumptions-open'])
    expect(tokens(unit)).toContain('truncate')
    expect(tokens(unit)).toContain('min-w-0')
    expect(tokens(row())).toContain('flex-nowrap')
    expect(tokens(row())).not.toContain('flex-wrap')
    expect(tokens(screen.getByTestId('decision-node-option-count'))).toContain('shrink-0')
  })

  it('post-run: "4 alternatives · Evidence priority: Top Account Revenue Concentration" — same row structure as pre-run, clause whole in the DOM', () => {
    setStore({ results: { status: 'complete', report: servedRankedReport } })
    setCurrency('current')
    renderDecision()
    expect(childIds(row())).toEqual(['decision-node-option-count', 'decision-row-meta-clause'])
    const unit = screen.getByTestId('decision-row-meta-clause')
    expect(childIds(unit)).toEqual(['decision-row-meta-separator', 'decision-evidence-priority'])
    const ep = screen.getByTestId('decision-evidence-priority')
    expect(ep.getAttribute('data-factor-id')).toBe('fac_top_account_concentration')
    expect(ep.textContent).toBe('Evidence priority: Top Account Revenue Concentration')
    expect(tokens(unit)).toContain('truncate')
    expect(tokens(row())).not.toContain('flex-wrap')
  })

  it('the row and the clause unit carry the SAME classes pre-run and post-run (no height change from the Run)', () => {
    renderDecision()
    const preRow = row().getAttribute('class')
    const preUnit = screen.getByTestId('decision-row-meta-clause').getAttribute('class')
    cleanup()
    setStore({ results: { status: 'complete', report: servedRankedReport } })
    setCurrency('current')
    renderDecision()
    expect(row().getAttribute('class')).toBe(preRow)
    expect(screen.getByTestId('decision-row-meta-clause').getAttribute('class')).toBe(preUnit)
  })
})
