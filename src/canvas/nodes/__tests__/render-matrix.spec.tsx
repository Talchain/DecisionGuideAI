/**
 * Render matrix — FactorNode + OptionNode × Standard / Detailed × pre / post analysis.
 *
 * Polish 4 follow-up Item A. The audit table in the polish-4 brief defines
 * the canonical chip / coaching / value-display state per node per phase per
 * view. Without a matrix test, those rules drift one node-edit at a time —
 * a chip migrates between body and popover, a coaching line gets dropped from
 * a gate, the differentiator fires in the wrong view. This file pins the
 * audit table by sweeping all 8 combinations and asserting the visible state.
 *
 * Each case asserts (where applicable):
 *   - chips present / absent per the audit table
 *   - coaching line gated to top-3 (high-priority) factors
 *   - value suppression for scale-no-raw factors
 *   - differentiator line only renders in Standard pre-analysis on options
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../../hooks/useCEEInsights', () => ({
  useCEEInsights: vi.fn(() => ({ data: null })),
}))
vi.mock('../../../hooks/useISLValidation', () => ({
  useISLValidation: vi.fn(() => ({ data: null })),
}))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })
  ),
}))
vi.mock('../../../flags', () => ({
  isGraphBadgesEnabled: vi.fn(() => false),
  isNodeIntelligenceEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isContextMenuEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))
vi.mock('../../hooks/useScienceIcons', () => ({
  useScienceIcons: vi.fn(() => []),
}))

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

// Make NodePopover transparent so we can read its rendered content directly
// (otherwise the popover is hidden behind a 300ms hover delay).
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="node-popover">{children}</div>
  ),
}))

type ViewMode = 'standard' | 'expert'
type Phase = 'pre' | 'post'

interface MatrixState {
  viewMode: ViewMode
  phase: Phase
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
  ceeAnalysisReady?: { options?: Array<{ id: string; interventions: Record<string, unknown> }> } | null
}

function buildStoreState(state: MatrixState) {
  return {
    hoveredOptionId: null,
    nodes: state.nodes,
    edges: state.edges,
    ceeAnalysisReady: state.ceeAnalysisReady ?? null,
    results: { status: state.phase === 'post' ? 'complete' : 'idle', report: state.phase === 'post' ? {} : null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set() },
    goalThreshold: null,
    goalConstraints: [],
    setHoveredOption: vi.fn(),
    runMeta: { ceeReview: null },
    viewMode: state.viewMode,
  }
}

function applyStore(state: MatrixState) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector(buildStoreState(state)),
  )
}

const baseFactorProps = {
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

const baseOptionProps = { ...baseFactorProps, id: 'option-1', type: 'option' }

function renderFactor(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <FactorNode {...baseFactorProps} data={data} />
    </ReactFlowProvider>
  )
}

function renderOption(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseOptionProps} data={{ label: 'Aggressive plan', type: 'option', ...data }} />
    </ReactFlowProvider>
  )
}

describe('Render matrix — FactorNode × view × phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    } as any)
  })

  // Topology: factor-1 is the rendered top-3 inferred factor on Outcome path.
  // Three other factors exist so the rank computation has something to sort.
  const topInferredTopology = (viewMode: ViewMode, phase: Phase): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Marketing Expertise Available' } },
      { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'F2' } },
      { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'F3' } },
      { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'F4' } },
      { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
    ],
    edges: [
      { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
      { id: 'e2', source: 'factor-2', target: 'outcome-1', data: { weight: 0.1, direction: 'positive' } },
      { id: 'e3', source: 'factor-3', target: 'outcome-1', data: { weight: 0.1, direction: 'positive' } },
      { id: 'e4', source: 'factor-4', target: 'outcome-1', data: { weight: 0.1, direction: 'positive' } },
    ],
  })

  it('Standard pre: top inferred factor shows "What evidence supports this?" body chip and no popover-only duplicate', () => {
    applyStore(topInferredTopology('standard', 'pre'))
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
    })
    // Body chip canonical, popover doesn't duplicate it.
    const chips = screen.getAllByText('What evidence supports this?')
    expect(chips).toHaveLength(1)
    // Value suppression: scale-no-raw fractional value is hidden.
    expect(screen.queryByText(/0\.5/)).toBeNull()
    expect(screen.queryByText(/scale/i)).toBeNull()
  })

  it('Standard post: top inferred factor coaching line is gated by isHighPriority and shows', () => {
    applyStore(topInferredTopology('standard', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: 0.8,
      confidence: 0.3,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    } as any)
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
    })
    // Synthesised coaching line ("High influence, low confidence.") fires.
    expect(screen.getByText(/High influence, low confidence/i)).toBeDefined()
  })

  it('Detailed pre: top inferred factor shows pre-analysis layer 2 coaching ONLY when high-priority', () => {
    applyStore(topInferredTopology('expert', 'pre'))
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
    })
    // Item 3: coaching line gated to top-3. factor-1 has the strongest edge,
    // so it ranks #1 → high priority → coaching line renders inline.
    expect(screen.getByText(/Olumi estimated this from your brief/i)).toBeDefined()
  })

  it('Detailed pre: low-priority inferred factor does NOT show the coaching line', () => {
    // Render factor-4 instead — bottom of the 4-factor ranking with weak edges.
    applyStore({
      ...topInferredTopology('expert', 'pre'),
      // Make factor-2 .. factor-4 the rendered node so it ranks low.
    })
    render(
      <ReactFlowProvider>
        <FactorNode
          {...baseFactorProps}
          id="factor-4"
          data={{
            type: 'factor',
            label: 'Low priority factor',
            category: 'controllable',
            observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
          }}
        />
      </ReactFlowProvider>
    )
    // Low-priority → coaching line suppressed in Detailed view too.
    expect(screen.queryByText(/Olumi estimated this from your brief/i)).toBeNull()
  })

  it('Detailed post: factor body shows full layer 2 (no synthesised coaching line — Detailed-specific)', () => {
    applyStore(topInferredTopology('expert', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: 0.8,
      confidence: 0.3,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    } as any)
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
    })
    // Synthesised coaching line is Standard-only (gate at !isDetailed).
    expect(screen.queryByText(/High influence, low confidence/i)).toBeNull()
  })
})

describe('Render matrix — OptionNode × view × phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    } as any)
  })

  // Two non-baseline options with different intervention magnitudes so the
  // differentiator can fire in pre-analysis Standard.
  const twoOptionTopology = (viewMode: ViewMode, phase: Phase): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'option-1', type: 'option', data: { label: 'Aggressive plan', type: 'option' } },
      { id: 'option-2', type: 'option', data: { label: 'Conservative plan', type: 'option' } },
      {
        id: 'factor-1',
        type: 'factor',
        data: {
          label: 'Hiring rate',
          observedState: { unit: 'engineers', value: 0.3, raw_value: 3, cap: 10 },
        },
      },
    ],
    edges: [],
    ceeAnalysisReady: {
      options: [
        { id: 'option-1', interventions: { 'factor-1': 0.9 } },
        { id: 'option-2', interventions: { 'factor-1': 0.3 } },
      ],
    },
  })

  it('Standard pre non-baseline: shows "What could go wrong?" chip + differentiator line', () => {
    applyStore(twoOptionTopology('standard', 'pre'))
    renderOption({})
    expect(screen.getByText('What could go wrong?')).toBeDefined()
    expect(screen.getByText(/key difference/i)).toBeDefined()
  })

  it('Standard post non-leading: shows "What would make this lead?" chip and NO differentiator', () => {
    applyStore(twoOptionTopology('standard', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.4, // not the winner
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.getByText('What would make this lead?')).toBeDefined()
    // Differentiator is pre-analysis only.
    expect(screen.queryByText(/key difference/i)).toBeNull()
  })

  it('Detailed pre non-baseline: differentiator line is hidden (Standard-only)', () => {
    applyStore(twoOptionTopology('expert', 'pre'))
    renderOption({})
    expect(screen.queryByText(/key difference/i)).toBeNull()
    // Pre-analysis chip still present.
    expect(screen.getByText('What could go wrong?')).toBeDefined()
  })

  it('Detailed post: chips render but differentiator never appears', () => {
    applyStore(twoOptionTopology('expert', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.4,
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.queryByText(/key difference/i)).toBeNull()
    expect(screen.getByText('What would make this lead?')).toBeDefined()
  })
})
