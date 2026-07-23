/**
 * DecisionNode render tests
 * T11: Option count line
 * Health pills, science icons, popover, chips
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
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

// Make NodePopover transparent in tests so we can directly assert what its
// content would render. The real popover is hidden by a 300ms hover delay
// and a position-tracking guard, neither of which fire in jsdom without a
// real anchor measurement.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
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

  it('has accessible name containing "decision"', () => {
    renderDecision()
    expect(screen.getByRole('group', { name: /decision/i })).toBeDefined()
  })

  // T11: "options compared" text removed in v1.1 — health pills replace it
  it('does not show "options compared" text (removed in v1.1)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        edges: [{ id: 'e1', source: 'decision-1', target: 'option-1' }],
        nodes: [{ id: 'option-1', type: 'option', data: { type: 'option' } }],
      }) as any)
    )
    renderDecision()
    expect(screen.queryByText(/options? compared/)).toBeNull()
    // Pre-analysis section renders coaching chips instead
    expect(screen.getByText('Explore more options')).toBeDefined()
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
    // targetNode is undefined -> filter returns false -> optionCount = 0
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

  // Graph v2 simplification: health pills removed from the body. The gap /
  // estimate / bias counts still feed the pre-analysis popover (model
  // readiness breakdown), but the body never renders the "1 gap" / "2
  // estimates" pills any more.
  it('does NOT render gap pill in the body when factors have missing values', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        edges: [{ id: 'e1', source: 'decision-1', target: 'option-1' }],
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'factor-1', type: 'factor', data: { type: 'factor', observedState: { value: null } } },
          { id: 'factor-2', type: 'factor', data: { type: 'factor', observedState: { value: 42 } } },
        ],
      }) as any)
    )
    renderDecision()
    expect(screen.queryByText(/\d+ gap/i)).toBeNull()
  })

  it('does NOT render estimate pill in the body when factors are inferred', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        edges: [{ id: 'e1', source: 'decision-1', target: 'option-1' }],
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'factor-1', type: 'factor', data: { type: 'factor', observedState: { value: 10, extractionType: 'inferred' } } },
          { id: 'factor-2', type: 'factor', data: { type: 'factor', observedState: { value: 20, extractionType: 'inferred' } } },
        ],
      }) as any)
    )
    renderDecision()
    expect(screen.queryByText(/\d+ estimate/i)).toBeNull()
  })

  // Chips: pre-analysis shows "Explore more options" and "What could go wrong?"
  it('shows coaching chips in pre-analysis', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        edges: [{ id: 'e1', source: 'decision-1', target: 'option-1' }],
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderDecision()
    expect(screen.getByText('Explore more options')).toBeDefined()
    expect(screen.getByText('What could go wrong?')).toBeDefined()
  })

  // Post-analysis chips: "Challenge this result" and "Compare options"
  it('shows post-analysis chips', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { win_probability: 0.65 },
            },
            robustness: { recommended_option_id: 'option-1', recommendation_stability: 0.8 },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
        ],
      }) as any)
    )
    renderDecision()
    expect(screen.getByText('Challenge this result')).toBeDefined()
    expect(screen.getByText('Compare options')).toBeDefined()
  })
})

// The 'stale result decorations (audit §8 P1)' describe that lived here was
// retired with the graph-hash stale guard (deleted 2026-07-16): its remaining
// negative test asserted the absence of `data-stale` — an attribute NO code
// path can produce any more — while seeding `_internal.graphHash`, a key
// production never writes. An absence pin without a possible positive is
// permanently green and pins nothing (trap 13). Freshness decoration now
// belongs to the panel surfaces via the composed trust semantic
// (useAnalysisTrust); if node-level decoration returns, pin it against that
// source with a positive control.
