/**
 * DecisionNode render tests
 * T11: Option count line
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  edges: [],
  nodes: [],
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
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
  })),
}))

vi.mock('../../../hooks/useCEEInsights', () => ({
  useCEEInsights: vi.fn(() => ({ data: null })),
}))

vi.mock('../../../hooks/useISLValidation', () => ({
  useISLValidation: vi.fn(() => ({ data: null })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'decision-1',
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
      <DecisionNode {...baseProps} {...overrides} />
    </ReactFlowProvider>
  )

describe('DecisionNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
  })

  it('renders label', () => {
    renderDecision()
    expect(screen.getByText('Should we hire?')).toBeDefined()
  })

  it('shows type label as "Decision" (sentence-case)', () => {
    renderDecision()
    expect(screen.getByText('Decision')).toBeDefined()
  })

  // T11: Option count — no options connected
  it('does not show option count when no option nodes connected', () => {
    renderDecision()
    expect(screen.queryByText(/options? compared/)).toBeNull()
  })

  // T11: Single option
  it('shows "1 option compared" for one connected option', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        edges: [{ id: 'e1', source: 'decision-1', target: 'option-1' }],
        nodes: [{ id: 'option-1', type: 'option', data: { type: 'option' } }],
      }) as any)
    )
    renderDecision()
    expect(screen.getByText('1 option compared')).toBeDefined()
  })

  // T11: Multiple options
  it('shows "3 options compared" for three connected options', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        edges: [
          { id: 'e1', source: 'decision-1', target: 'option-1' },
          { id: 'e2', source: 'decision-1', target: 'option-2' },
          { id: 'e3', source: 'decision-1', target: 'option-3' },
        ],
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
          { id: 'option-3', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderDecision()
    expect(screen.getByText('3 options compared')).toBeDefined()
  })

  // T11: Non-option edges are not counted
  it('does not count non-option targets', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        edges: [
          { id: 'e1', source: 'decision-1', target: 'factor-1' },
          { id: 'e2', source: 'decision-1', target: 'option-1' },
        ],
        nodes: [
          { id: 'factor-1', type: 'factor', data: { type: 'factor' } },
          { id: 'option-1', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderDecision()
    expect(screen.getByText('1 option compared')).toBeDefined()
  })

  it('has displayName set', () => {
    expect(DecisionNode.displayName).toBe('DecisionNode')
  })

  // Null-safe paths — most likely regression sources in production
  it('renders "Untitled" when data.label is absent', () => {
    render(
      <ReactFlowProvider>
        <DecisionNode {...baseProps} data={{ type: 'decision' } as any} />
      </ReactFlowProvider>
    )
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('renders "Untitled" when data.label is empty string', () => {
    renderDecision({ data: { label: '', type: 'decision' } as any })
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('does not count edges where this node is the target (not source)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        edges: [{ id: 'e1', source: 'other-node', target: 'decision-1' }],
        nodes: [
          { id: 'other-node', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderDecision()
    expect(screen.queryByText(/options? compared/)).toBeNull()
  })

  it('does not crash when edges array is empty', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ edges: [], nodes: [] }) as any)
    )
    expect(() => renderDecision()).not.toThrow()
  })

  it('does not show option count when no nodes array is empty but edges exist', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        edges: [{ id: 'e1', source: 'decision-1', target: 'option-1' }],
        nodes: [],
      }) as any)
    )
    renderDecision()
    // targetNode is undefined → filter returns false → optionCount = 0
    expect(screen.queryByText(/options? compared/)).toBeNull()
  })

  // D1: Decision node must show its own label, not the recommended option label from results
  it('renders data.label regardless of results (D1 regression guard)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { win_probability: 0.8 },
            },
            robustness: { recommended_option_id: 'option-1', recommendation_stability: 0.9 },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Acquire Smaller Competitor', type: 'option' } },
        ],
      }) as any)
    )
    renderDecision({ data: { label: 'Mid-Market Expansion Strategy', type: 'decision' } as any })
    expect(screen.getByText('Mid-Market Expansion Strategy')).toBeDefined()
    // Option label must NOT bleed into the decision node
    expect(screen.queryByText('Acquire Smaller Competitor')).toBeNull()
  })
})
