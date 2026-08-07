/**
 * DecisionNode "Top gap:" triage — the product must not RECOMMEND on a default.
 *
 * WHY THIS IS THE HIGHEST-CONSEQUENCE CASE IN THE UNSET-VALUE FAMILY
 * -----------------------------------------------------------------
 * Rule 2 of the triage ladder ranks factors by a sum of their outbound edge
 * weights, takes the top two, and if one of them is an inferred factor prints
 * "Top gap: validate <that factor>". That sentence is the product telling the
 * user which piece of their model to go and fix.
 *
 * Every contribution to the sum was `w ?? 0.5`, and `USER_EDGE_DEFAULTS` /
 * `DEFAULT_EDGE_DATA` always define `weight`. So on a graph where nobody had
 * set a single strength, every factor scored `0.5 × out-degree`, ties broke on
 * array order, and the winner was named as the highest-leverage gap. The
 * recommendation was real; the leverage behind it was not.
 *
 * CLAIM TYPE: rendered TEXT presence/absence. Not visibility, not layout
 * (platform trap 3).
 *
 * DISCRIMINATION: the two tests are the same graph twice. The only difference
 * is `weightSource: 'cee'` on the edges. If the gate over-fired (never
 * recommending) the second test would fail; if it under-fired (the old
 * behaviour) the first would.
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

/**
 * A graph that clears triage rule 1 (every factor has an observed value) and
 * reaches rule 2 with an INFERRED factor that has the largest out-degree. The
 * only variable is whether the edge strengths carry a source stamp.
 */
function graph(stamped: boolean) {
  const strength = stamped ? { weightSource: 'cee' as const } : {}
  return makeStoreState({
    nodes: [
      {
        id: 'fac-inferred',
        type: 'factor',
        data: {
          type: 'factor',
          label: 'Brand perception',
          observedState: { value: 5, extractionType: 'inferred' },
        },
      },
      {
        id: 'fac-known',
        type: 'factor',
        data: {
          type: 'factor',
          label: 'Headcount',
          observedState: { value: 12, extractionType: 'stated' },
        },
      },
      { id: 'out-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
      { id: 'out-2', type: 'outcome', data: { type: 'outcome', label: 'Margin' } },
      { id: 'opt-1', type: 'option', data: { type: 'option' } },
      { id: 'opt-2', type: 'option', data: { type: 'option' } },
      { id: 'opt-3', type: 'option', data: { type: 'option' } },
    ],
    edges: [
      // The inferred factor has the higher out-degree, so under the OLD
      // `w ?? 0.5` sum it always won the leverage ranking.
      { id: 'e1', source: 'fac-inferred', target: 'out-1', data: { weight: 0.3, direction: 'positive', ...strength } },
      { id: 'e2', source: 'fac-inferred', target: 'out-2', data: { weight: 0.3, direction: 'positive', ...strength } },
      { id: 'e3', source: 'fac-known', target: 'out-1', data: { weight: 0.3, direction: 'positive', ...strength } },
      { id: 'e4', source: 'decision-1', target: 'opt-1' },
      { id: 'e5', source: 'decision-1', target: 'opt-2' },
      { id: 'e6', source: 'decision-1', target: 'opt-3' },
    ],
    goalThreshold: { value: 100, direction: 'above' },
  })
}

const renderDecision = () =>
  render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as unknown as React.ComponentProps<typeof DecisionNode>)} />
    </ReactFlowProvider>,
  )

describe('DecisionNode triage — leverage ranking is provenance-gated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT recommend validating a factor whose leverage nobody set', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(graph(false) as never),
    )
    renderDecision()
    expect(screen.queryByText(/Top gap: validate/)).toBeNull()
    expect(screen.queryByText(/Brand perception/)).toBeNull()
  })

  it('DOES recommend it once the strengths are sourced', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(graph(true) as never),
    )
    renderDecision()
    expect(screen.getByText(/Top gap: validate Brand perception/)).toBeTruthy()
  })
})
