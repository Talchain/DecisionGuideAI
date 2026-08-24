/** ModelTabBody — the sole connected Model route. */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { ModelTabBody } from '../ModelTabBody'

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))
vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))

const mockGraph: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] }
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
    goalThreshold: null,
    goalThresholdRepresentation: null,
  }
}
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (state: unknown) => unknown) => selector(getMockState())),
    { getState: getMockState },
  ),
}))
vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const nodes: Node[] = [
  {
    id: 'goal-1',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Protect gross margin' },
  },
  {
    id: 'factor-budget',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Migration budget',
      category: 'observable',
      observedState: { value: 0.5, raw_value: 20000, source: 'brief_extraction' },
    },
  },
  {
    id: 'factor-adoption',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Team adoption',
      category: 'observable',
      observedState: { value: 0.4, source: 'cee_inference' },
    },
  },
]

const props = {
  showDebug: false,
  hasDiagnostics: false,
  diagnostics: null,
  hasTrim: false,
  effectiveCorrelationId: null,
  correlationMismatch: false,
  correlationIdHeader: null,
  robustness: null,
}

function renderTab(edges: Edge[] = []) {
  mockGraph.nodes = nodes
  mockGraph.edges = edges
  return render(<ModelTabBody {...props} nodes={nodes} edges={edges} />)
}

function copyJsonAndParse(edges: Edge[]) {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  renderTab(edges)
  fireEvent.click(screen.getByTestId('model-copy-json'))
  expect(writeText).toHaveBeenCalledTimes(1)
  return JSON.parse(writeText.mock.calls[0][0] as string)
}

beforeEach(() => { vi.clearAllMocks() })

describe('connected Model surface', () => {
  it('shows each entity exactly once on the v2 outline', () => {
    renderTab()
    expect(screen.getAllByText('Protect gross margin')).toHaveLength(1)
    expect(screen.getAllByText('Migration budget')).toHaveLength(1)
    expect(screen.getAllByText('Team adoption')).toHaveLength(1)
    expect(screen.queryByTestId('model-tab-v1-stack')).not.toBeInTheDocument()
  })

  it('the one search surface actually filters the outline', () => {
    renderTab()
    const search = screen.getByTestId('model-tab-v2-filter')
    expect(search).toBeEnabled()
    fireEvent.change(search, { target: { value: 'adoption' } })
    expect(screen.getByTestId('model-row-v2-factor-adoption')).toBeInTheDocument()
    expect(screen.queryByTestId('model-row-v2-factor-budget')).not.toBeInTheDocument()
  })

  it('keeps copy actions, without restoring the inert duplicate search', () => {
    renderTab()
    expect(screen.getByTestId('model-copy')).toBeEnabled()
    expect(screen.getByTestId('model-copy-json')).toBeEnabled()
    expect(screen.getAllByRole('searchbox')).toHaveLength(1)
  })

  it('keeps explicit edge provenance attached to the F7 JSON clipboard payload', () => {
    const stamped: Edge = {
      id: 'edge-stamped',
      source: 'factor-budget',
      target: 'factor-adoption',
      data: {
        weight: 0.42,
        weightSource: 'user',
        beliefExists: 0.73,
        beliefExistsSource: 'cee',
        direction: 'positive',
        provenance: 'user_study',
      },
    }

    const payload = copyJsonAndParse([stamped])
    expect(payload.edges).toHaveLength(1)
    expect(payload.edges[0]).toEqual(expect.objectContaining({
      weight: 0.42,
      weightSource: 'user',
      beliefExists: 0.73,
      beliefExistsSource: 'cee',
      provenance: 'user_study',
    }))
  })

  it('exports unstamped default numbers as unsourced in the F7 JSON clipboard payload', () => {
    const unstamped: Edge = {
      id: 'edge-unstamped',
      source: 'factor-budget',
      target: 'factor-adoption',
      data: { weight: 0.3, beliefExists: 0.8, direction: 'positive' },
    }

    const payload = copyJsonAndParse([unstamped])
    expect(payload.edges).toHaveLength(1)
    expect(payload.edges[0]).toEqual(expect.objectContaining({
      weight: 0.3,
      weightSource: null,
      beliefExists: 0.8,
      beliefExistsSource: null,
    }))
  })
})
