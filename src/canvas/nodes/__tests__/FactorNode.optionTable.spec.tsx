/**
 * Graph v2 Task 3 — Per-option comparison popover on controllable factors.
 *
 * Verifies that the popover (Standard view, high-priority controllable
 * factors, both phases) renders an "Option values:" table with one row per
 * option, ordered correctly, value-formatted with the fallback chain, capped
 * at 4 rows, and suppressed for external factors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

vi.mock('../../../hooks/useCEEInsights', () => ({
  useCEEInsights: vi.fn(() => ({ data: null })),
}))

vi.mock('../../../hooks/useISLValidation', () => ({
  useISLValidation: vi.fn(() => ({ data: null })),
}))

vi.mock('../../hooks/useScienceIcons', () => ({
  useScienceIcons: vi.fn(() => []),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

vi.mock('../../../flags', () => ({
  isGraphBadgesEnabled: vi.fn(() => false),
  isNodeIntelligenceEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isContextMenuEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

interface StoreState {
  viewMode: 'standard' | 'expert'
  phase: 'pre' | 'post'
  nodes: Array<Record<string, unknown>>
  edges?: Array<Record<string, unknown>>
  report?: Record<string, unknown> | null
}

function buildStoreState(s: StoreState) {
  return {
    hoveredOptionId: null,
    nodes: s.nodes,
    edges: s.edges ?? [],
    ceeAnalysisReady: null,
    results: {
      status: s.phase === 'post' ? 'complete' : 'idle',
      report: s.phase === 'post' ? (s.report ?? {}) : null,
    },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    goalThreshold: null,
    goalConstraints: [],
    viewMode: s.viewMode,
  }
}

function applyStore(s: StoreState) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector(buildStoreState(s)),
  )
}

const baseProps = {
  id: 'factor-1',
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

function renderFactor(data: Record<string, unknown>, id = 'factor-1') {
  return render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} id={id} data={data} />
    </ReactFlowProvider>
  )
}

const baseFactorData = {
  type: 'factor',
  label: 'Cost',
  category: 'controllable',
  observedState: { value: 50000, unit: '£', factor_type: 'currency' },
}

describe('FactorNode — option comparison popover (Graph v2 Task 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // High priority by default (rank 1) so the popover renders
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: 0.5,
      confidence: 0.5,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    } as any)
  })

  it('Post Standard: renders "Option values:" header with rows ordered leader-first → win prob desc → status quo last', () => {
    applyStore({
      viewMode: 'standard',
      phase: 'post',
      nodes: [
        { id: 'factor-1', type: 'factor', data: baseFactorData },
        { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire 3', interventions: { 'factor-1': 60000 } } },
        { id: 'option-2', type: 'option', data: { type: 'option', label: 'Hire 1', interventions: { 'factor-1': 40000 } } },
        { id: 'option-3', type: 'option', data: { type: 'option', label: 'No hire', is_baseline: true, interventions: { 'factor-1': 50000 } } },
      ],
      report: {
        robustness: { recommended_option_id: 'option-2' },
        option_probabilities: {
          'option-1': { win_probability: 0.30 },
          'option-2': { win_probability: 0.65 },
          'option-3': { win_probability: 0.05 },
        },
      },
    })
    renderFactor(baseFactorData)
    const popover = screen.getByTestId('factor-node-popover')
    expect(within(popover).getByText('Option values:')).toBeDefined()
    const rowLabels = within(popover).getAllByText(/Hire 3|Hire 1|No hire/)
    expect(rowLabels[0].textContent).toBe('Hire 1')   // leader
    expect(rowLabels[1].textContent).toBe('Hire 3')   // next best
    expect(rowLabels[2].textContent).toBe('No hire')  // status quo last
  })

  it('Post Standard: external factor does NOT render the option values table', () => {
    applyStore({
      viewMode: 'standard',
      phase: 'post',
      nodes: [
        { id: 'factor-1', type: 'factor', data: { ...baseFactorData, category: 'external' } },
        { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire 3', interventions: { 'factor-1': 60000 } } },
      ],
      report: {
        robustness: { recommended_option_id: 'option-1' },
        option_probabilities: { 'option-1': { win_probability: 0.7 } },
      },
    })
    renderFactor({ ...baseFactorData, category: 'external' })
    expect(screen.queryByText('Option values:')).toBeNull()
  })

  it('Post Standard, > 4 options: shows 4 rows + "N more in inspector" link', () => {
    applyStore({
      viewMode: 'standard',
      phase: 'post',
      nodes: [
        { id: 'factor-1', type: 'factor', data: baseFactorData },
        { id: 'option-1', type: 'option', data: { type: 'option', label: 'Opt A', interventions: { 'factor-1': 60000 } } },
        { id: 'option-2', type: 'option', data: { type: 'option', label: 'Opt B', interventions: { 'factor-1': 70000 } } },
        { id: 'option-3', type: 'option', data: { type: 'option', label: 'Opt C', interventions: { 'factor-1': 80000 } } },
        { id: 'option-4', type: 'option', data: { type: 'option', label: 'Opt D', interventions: { 'factor-1': 90000 } } },
        { id: 'option-5', type: 'option', data: { type: 'option', label: 'Opt E', interventions: { 'factor-1': 55000 } } },
        { id: 'option-sq', type: 'option', data: { type: 'option', label: 'Opt SQ', is_baseline: true, interventions: { 'factor-1': 50000 } } },
      ],
      report: {
        robustness: { recommended_option_id: 'option-1' },
        option_probabilities: {
          'option-1': { win_probability: 0.40 },
          'option-2': { win_probability: 0.25 },
          'option-3': { win_probability: 0.20 },
          'option-4': { win_probability: 0.10 },
          'option-5': { win_probability: 0.04 },
          'option-sq': { win_probability: 0.01 },
        },
      },
    })
    renderFactor(baseFactorData)
    const popover = screen.getByTestId('factor-node-popover')
    // 4 rows: top 3 non-status-quo + status quo
    expect(within(popover).getByText('Opt A')).toBeDefined()
    expect(within(popover).getByText('Opt B')).toBeDefined()
    expect(within(popover).getByText('Opt C')).toBeDefined()
    expect(within(popover).getByText('Opt SQ')).toBeDefined()
    // Opt D and Opt E are overflow (2 more)
    expect(within(popover).queryByText('Opt D')).toBeNull()
    expect(within(popover).queryByText('Opt E')).toBeNull()
    // Overflow link
    expect(within(popover).getByText('2 more in inspector')).toBeDefined()
  })

  it('Post Standard: option that does not intervene on this factor shows "no change"', () => {
    applyStore({
      viewMode: 'standard',
      phase: 'post',
      nodes: [
        { id: 'factor-1', type: 'factor', data: baseFactorData },
        { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire', interventions: { 'factor-1': 60000 } } },
        { id: 'option-2', type: 'option', data: { type: 'option', label: 'Wait', interventions: { 'other-factor': 999 } } },
      ],
      report: {
        robustness: { recommended_option_id: 'option-1' },
        option_probabilities: {
          'option-1': { win_probability: 0.7 },
          'option-2': { win_probability: 0.3 },
        },
      },
    })
    renderFactor(baseFactorData)
    const popover = screen.getByTestId('factor-node-popover')
    expect(within(popover).getByText('Wait')).toBeDefined()
    expect(within(popover).getByText('no change')).toBeDefined()
  })

  it('Post Standard: scale-no-raw factor falls back to qualitative tier label via preserveTierLabel', () => {
    const tieredFactor = {
      type: 'factor',
      label: 'Quality',
      category: 'controllable',
      observedState: { value: 0.5, unit: 'scale' }, // scale unit, no raw_value
    }
    applyStore({
      viewMode: 'standard',
      phase: 'post',
      nodes: [
        { id: 'factor-1', type: 'factor', data: tieredFactor },
        { id: 'option-1', type: 'option', data: { type: 'option', label: 'Premium', interventions: { 'factor-1': 0.85 } } },
      ],
      report: {
        robustness: { recommended_option_id: 'option-1' },
        option_probabilities: { 'option-1': { win_probability: 0.9 } },
      },
    })
    renderFactor(tieredFactor)
    const popover = screen.getByTestId('factor-node-popover')
    // The exact label depends on qualitativeTierLabel — assert that *some*
    // tier label renders (capitalised string), not the empty fallback "set".
    const premiumRow = within(popover).getByText('Premium').parentElement
    expect(premiumRow).not.toBeNull()
    // It must not be "set" — preserveTierLabel returned a real tier
    const valueSpan = premiumRow!.lastElementChild
    expect(valueSpan?.textContent).not.toBe('set')
    expect(valueSpan?.textContent).toMatch(/^[A-Z]/) // Capitalised tier label
  })

  it('Post Detailed: popover NOT rendered (existing high-priority gate is Standard-only)', () => {
    applyStore({
      viewMode: 'expert',
      phase: 'post',
      nodes: [
        { id: 'factor-1', type: 'factor', data: baseFactorData },
        { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire', interventions: { 'factor-1': 60000 } } },
      ],
      report: {
        robustness: { recommended_option_id: 'option-1' },
        option_probabilities: { 'option-1': { win_probability: 0.7 } },
      },
    })
    renderFactor(baseFactorData)
    // Detailed view inlines layer2 in the body, not in the popover. The
    // popover wrapper is gated `!isDetailed && isHighPriority` so it does
    // not render at all in Detailed view.
    expect(screen.queryByTestId('factor-node-popover')).toBeNull()
  })

  it('Pre Standard, controllable factor with interventions: option values table renders in canvas order', () => {
    applyStore({
      viewMode: 'standard',
      phase: 'pre',
      nodes: [
        { id: 'factor-1', type: 'factor', data: baseFactorData },
        { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire 3', interventions: { 'factor-1': 60000 } } },
        { id: 'option-2', type: 'option', data: { type: 'option', label: 'Hire 1', interventions: { 'factor-1': 40000 } } },
        { id: 'option-3', type: 'option', data: { type: 'option', label: 'No hire', is_baseline: true, interventions: { 'factor-1': 50000 } } },
      ],
    })
    renderFactor(baseFactorData)
    const popover = screen.getByTestId('factor-node-popover')
    expect(within(popover).getByText('Option values:')).toBeDefined()
    const rowLabels = within(popover).getAllByText(/Hire 3|Hire 1|No hire/)
    // Pre-analysis: canvas order, status quo last
    expect(rowLabels[0].textContent).toBe('Hire 3')
    expect(rowLabels[1].textContent).toBe('Hire 1')
    expect(rowLabels[2].textContent).toBe('No hire')
  })
})
