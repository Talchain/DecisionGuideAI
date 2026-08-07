/**
 * ROADMAP 2.296 C1 — the Model tab Goal card's "Discuss with AI" action.
 *
 * THE DEFECT (#553): `GoalSection`'s outer wrapper was rewritten to accept and
 * forward ONLY `goalNode` — `export function GoalSection({ goalNode }:
 * GoalSectionProps)` — while `ModelTabBody` still supplies `onSendMessage`
 * (ModelTabBody.tsx `<GoalSection goalNode={...} onSendMessage={onSendMessage} />`).
 * `GoalSectionInner` renders the Discuss button only under `{onSendMessage &&
 * ...}`, so the action silently vanished from the goal card while every
 * sibling section (Options, Factors, Relationships, Risks) kept its own.
 *
 * RED-first: these tests render the REAL ModelTabBody→GoalSection path — not
 * GoalSectionInner directly — because the defect lives in the wrapper hop. At
 * the pristine tip the `goal-discuss` testid is absent from the document.
 *
 * CLAIM TYPE: jsdom presence/click-wiring only — never layout or visibility
 * (trap 3).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

describe('Goal section Discuss with AI — real ModelTabBody→GoalSection path (2.296 C1)', () => {
  it('RED-first: the goal card renders the Discuss action when ModelTabBody supplies onSendMessage', () => {
    const onSendMessage = vi.fn()
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={[makeGoalNode()]}
        edges={[]}
        onSendMessage={onSendMessage}
      />,
    )
    // Anti-vacuity (trap 13): the goal section itself is on screen, so the
    // absence of the button below cannot mean "the card never rendered".
    expect(screen.getByTestId('model-goal-section')).toBeInTheDocument()
    // The defect: #553's wrapper dropped the callback, so this was absent.
    expect(screen.getByTestId('goal-discuss')).toBeInTheDocument()
  })

  it('clicking the Discuss action sends a message naming the goal', () => {
    const onSendMessage = vi.fn()
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={[makeGoalNode('g1', 'Maximise Revenue')]}
        edges={[]}
        onSendMessage={onSendMessage}
      />,
    )
    fireEvent.click(screen.getByTestId('goal-discuss'))
    expect(onSendMessage).toHaveBeenCalledTimes(1)
    expect(String(onSendMessage.mock.calls[0][0])).toContain('Maximise Revenue')
  })

  it('control: with no onSendMessage supplied, no Discuss action renders', () => {
    // Guards the fix's shape: forwarding must remain conditional pass-through,
    // never a fabricated default handler.
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[makeGoalNode()]} edges={[]} />)
    expect(screen.getByTestId('model-goal-section')).toBeInTheDocument()
    expect(screen.queryByTestId('goal-discuss')).toBeNull()
  })
})
