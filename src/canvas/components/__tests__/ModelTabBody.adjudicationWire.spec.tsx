/**
 * ModelTabBody — the contested-edge verdict REACHES THE WIRE (P4 transport).
 *
 * Verified defect at staging dae8908f: `handleResolveContested` was a pure
 * local `updateEdge`; the human's settled disagreement — the highest-signal
 * judgement in the product — never left the browser. This spec pins the new
 * wiring: resolving a contested edge STILL applies locally exactly as before,
 * AND emits the `edge_adjudication` system event (best-effort, after the
 * local apply, via the optional conversation context — absent context must
 * not break resolution).
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

describe('ModelTabBody — contested resolution reaches the wire', () => {
  beforeEach(() => {
    sendSystemEvent.mockClear()
    mockUpdateEdge.mockClear()
    contextValue = { sendSystemEvent }
  })

  it('⭐ accepting pass 1 applies locally AND emits edge_adjudication, identity-bound', () => {
    renderBody(makeContestedEdge())
    fireEvent.click(screen.getByTestId('contested-accept-pass1-e-contested'))

    // The existing local apply is untouched.
    expect(mockUpdateEdge).toHaveBeenCalledTimes(1)

    // …and the verdict now leaves the browser.
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const [event] = sendSystemEvent.mock.calls[0]!
    expect(event).toEqual({
      type: 'edge_adjudication',
      payload: {
        from: 'n1',
        to: 'n2',
        edge_id: 'e-contested',
        verdict: 'accepted_pass1',
        // accepted_pass1 keeps the CURRENT (pass1) value — carried
        // informatively so the fact is self-contained.
        resolved_strength_mean: 0.6,
      },
    })
  })

  it('a missing conversation context must not break local resolution (best-effort wire)', () => {
    contextValue = null
    renderBody(makeContestedEdge())
    fireEvent.click(screen.getByTestId('contested-accept-pass1-e-contested'))
    expect(mockUpdateEdge).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })
})
