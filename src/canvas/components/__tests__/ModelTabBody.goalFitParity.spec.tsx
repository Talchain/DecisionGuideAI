/**
 * Model-tab goal-fit ownership.
 *
 * Analysis owns goal-fit results. The Model tab owns the living model outline
 * and scientific provenance; it must not mount the retired v1 goal card as a
 * second, potentially divergent results surface.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { ModelTabBody } from '../ModelTabBody'

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))

const mockGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }
let mockResults: unknown = null

function getMockState() {
  return {
    nodes: mockGraph.nodes,
    edges: mockGraph.edges,
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    ceePipelineTrace: null,
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    currentScenarioId: null,
    currentStage: null,
    graphEditedSinceLastRun: false,
    results: mockResults,
  }
}

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(getMockState())),
    { getState: getMockState },
  ),
}))

vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function makeNodes(): Node[] {
  const mk = (id: string, type: string, label: string, data: Record<string, unknown> = {}): Node =>
    ({ id, type, position: { x: 0, y: 0 }, data: { label, ...data } }) as Node
  return [
    mk('goal_arr', 'goal', 'Reach £1,000,000 ARR', {
      goal_threshold_raw: 1_000_000,
      goal_threshold_unit: '£',
      goal_threshold: 0.8,
    }),
    mk('opt_content', 'option', 'Invest in Content Marketing'),
    mk('opt_sales', 'option', 'Hire Two Sales Reps'),
  ]
}

const DEFAULT_PROPS = {
  showDebug: false,
  hasDiagnostics: false,
  diagnostics: null,
  hasTrim: false,
  effectiveCorrelationId: null,
  correlationMismatch: false,
  correlationIdHeader: null,
  robustness: null,
}

function renderModel(): void {
  const nodes = makeNodes()
  mockGraph.nodes = nodes
  mockGraph.edges = []
  render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockResults = null
})

describe('Model-tab goal-fit ownership', () => {
  it('keeps model and scientific-transparency surfaces visible without the legacy goal duplicate', () => {
    mockResults = {
      status: 'complete',
      report: {
        option_probabilities: {
          opt_content: { goal_probability: 0.0987 },
          opt_sales: { goal_probability: 0.12 },
        },
      },
    }

    renderModel()

    expect(screen.getByTestId('model-tab-v2-panel')).toBeInTheDocument()
    expect(screen.getByTestId('model-scientific-transparency')).toBeInTheDocument()
    expect(screen.queryByTestId('model-goal-section')).toBeNull()
    expect(screen.queryByTestId('goal-fit-parity')).toBeNull()
    expect(screen.queryByText(/chance of hitting your goal/i)).toBeNull()
  })

  it('preserves the same single-route ownership before analysis', () => {
    renderModel()

    expect(screen.getByTestId('model-tab-v2-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('model-tab-v1-stack')).toBeNull()
    expect(screen.queryByTestId('goal-fit-parity')).toBeNull()
  })
})
