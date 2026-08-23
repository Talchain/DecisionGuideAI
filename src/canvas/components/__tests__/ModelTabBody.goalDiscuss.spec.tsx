/**
 * Model-tab goal coaching ownership.
 *
 * The retired v1 Goal card must not return merely because a caller supplies a
 * chat callback. The connected v2 outline keeps the goal readable; contextual
 * coaching is owned by the live Olumi surfaces, not a duplicate local card.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ModelTabBody } from '../ModelTabBody'
import type { Node } from '@xyflow/react'

// ── Mocks (same shape as ModelTabBody.spec.tsx) ───────────────────────────────

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))

const mockGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }

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

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeGoalNode(id = 'goal-1', label = 'Maximise Revenue'): Node {
  return { id, type: 'goal', position: { x: 0, y: 0 }, data: { label } }
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

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Model goal coaching stays on the connected route', () => {
  it('keeps the goal readable in v2 without mounting the retired goal card', () => {
    const onSendMessage = vi.fn()
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={[makeGoalNode()]}
        edges={[]}
        onSendMessage={onSendMessage}
      />,
    )
    const panel = screen.getByTestId('model-tab-v2-panel')
    const row = screen.getByTestId('model-row-v2-goal-1')
    expect(panel).toContainElement(row)
    expect(within(row).getByText('Maximise Revenue')).toBeInTheDocument()
    expect(screen.queryByTestId('model-goal-section')).toBeNull()
    expect(screen.queryByTestId('goal-discuss')).toBeNull()
    expect(onSendMessage).not.toHaveBeenCalled()
  })

  it('supplying a chat callback cannot revive a second model or local action', () => {
    const onSendMessage = vi.fn()
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={[makeGoalNode('g1', 'Maximise Revenue')]}
        edges={[]}
        onSendMessage={onSendMessage}
      />,
    )
    expect(screen.getByTestId('model-tab-v2-panel')).toBeInTheDocument()
    expect(screen.getAllByTestId('model-outline-v2')).toHaveLength(1)
    expect(screen.queryByTestId('model-tab-v1-stack')).toBeNull()
    expect(screen.queryByTestId('goal-discuss')).toBeNull()
    expect(onSendMessage).not.toHaveBeenCalled()
  })
})
