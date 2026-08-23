/**
 * ModelTabBody — retired local adjudication stays retired.
 *
 * The legacy stack offered a connected-looking contested-edge action whose
 * mutation was not backed by a canonical GraphV3 receipt. B3 mounts one v2
 * model route and withholds that local action. These tests keep a positive
 * control on the mounted model while proving neither the local store nor the
 * historical best-effort event seam is touched.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'

import { ModelTabBody } from '../ModelTabBody'
import type { ValidationMetadata } from '../../domain/validation'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))
vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))

// The seam under test: the optional conversation context's sendSystemEvent.
const sendSystemEvent = vi.fn().mockResolvedValue(undefined)
let contextValue: { sendSystemEvent: typeof sendSystemEvent } | null = {
  sendSystemEvent,
}
vi.mock('../../conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => contextValue,
}))

const mockUpdateNode = vi.fn()
const mockUpdateEdge = vi.fn()
const mockGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }

function getMockState() {
  return {
    nodes: mockGraph.nodes,
    edges: mockGraph.edges,
    updateNode: mockUpdateNode,
    updateEdge: mockUpdateEdge,
    ceePipelineTrace: null,
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    currentScenarioId: null,
    currentStage: null,
    graphEditedSinceLastRun: false,
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

function makeNode(id: string, label: string, type = 'factor'): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { label } }
}

function makeValidation(): ValidationMetadata {
  return {
    status: 'contested',
    contested_reasons: ['strength_band_change'],
    pass1: { strength_mean: 0.6, strength_std: 0.08, exists_probability: 0.7 },
    pass2: {
      strength_mean: 0.35,
      strength_std: 0.12,
      exists_probability: 0.7,
      reasoning: 'Typical effects are moderate',
      basis: 'domain_prior',
      needs_user_input: false,
    },
    max_divergence: 0.5,
    distance_to_goal: 1,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: false,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
  } as ValidationMetadata
}

function makeContestedEdge(): Edge {
  return {
    id: 'e-contested',
    source: 'n1',
    target: 'n2',
    data: {
      weight: 0.6,
      direction: 'positive',
      beliefExists: 0.7,
      validation: makeValidation(),
    },
  }
}

const nodes = [makeNode('n1', 'Factor A'), makeNode('n2', 'Factor B')]

function renderBody(edge: Edge) {
  mockGraph.nodes = nodes
  mockGraph.edges = [edge]
  return render(
    <ModelTabBody
      showDebug={false}
      hasDiagnostics={false}
      diagnostics={null}
      hasTrim={false}
      effectiveCorrelationId={null}
      correlationMismatch={false}
      correlationIdHeader={null}
      nodes={nodes}
      edges={[edge]}
      robustness={null}
    />,
  )
}

describe('ModelTabBody — local contested resolution is not mounted', () => {
  beforeEach(() => {
    sendSystemEvent.mockClear()
    mockUpdateEdge.mockClear()
    contextValue = { sendSystemEvent }
  })

  it('keeps the v2 model visible but exposes no legacy adjudication control', () => {
    renderBody(makeContestedEdge())

    expect(screen.getByTestId('model-tab-v2-panel')).toBeInTheDocument()
    expect(screen.getByTestId('model-scientific-transparency')).toBeInTheDocument()
    expect(screen.queryByTestId('contested-accept-pass1-e-contested')).toBeNull()
    expect(mockUpdateEdge).not.toHaveBeenCalled()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('does not resurrect the retired mutation when conversation context is absent', () => {
    contextValue = null
    renderBody(makeContestedEdge())

    expect(screen.getByTestId('model-tab-v2-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('contested-accept-pass1-e-contested')).toBeNull()
    expect(mockUpdateEdge).not.toHaveBeenCalled()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })
})
