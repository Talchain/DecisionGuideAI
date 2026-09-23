/**
 * ⛔ THE MODEL CARD'S "N FACTORS NEED YOUR INPUT" IS THE SAME COUNT AS THE TAB
 * BADGE, AND IT HAD THE SAME DEFECT.
 *
 * `ModelTabBody` computed it with `countFactorsToVerify` — `factorIsConfirmable`
 * alone — while the act that count stands for, confirming an estimate, is not
 * mounted on the Model tab (`CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation`
 * is `'disabled'`). It now reads `modelTabFactorsToVerify`, the confirm path's
 * own two readers composed. Twin of the badge cases in `OutputsDock.dom.spec.tsx`
 * — a fix on one surface must not leave its sibling carrying the bug.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import '@testing-library/jest-dom/vitest'

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

// `null` = the REAL table. Same getter pattern as `undoGestureAnswered.spec.ts`.
const factorConfirmationAuthority = vi.hoisted(() => ({ current: null as string | null }))
vi.mock('../../mutations/mutationAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mutations/mutationAuthority')>()
  return {
    ...actual,
    get CANONICAL_EDIT_AUTHORITY() {
      return factorConfirmationAuthority.current === null
        ? actual.CANONICAL_EDIT_AUTHORITY
        : { ...actual.CANONICAL_EDIT_AUTHORITY, modelFactorConfirmation: factorConfirmationAuthority.current }
    },
  }
})

import { ModelTabBody } from '../ModelTabBody'

const NODES: Node[] = [
  { id: 'goal_margin', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Protect gross margin' } },
  {
    id: 'fac_budget',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: 'Budget', category: 'observable', observedState: { value: 0.5, source: 'cee_inference' } },
  },
] as Node[]
const EDGES: Edge[] = []

function renderTab() {
  return render(
    <ModelTabBody
      showDebug={false}
      hasDiagnostics={false}
      diagnostics={null}
      hasTrim={false}
      effectiveCorrelationId={null}
      correlationMismatch={false}
      correlationIdHeader={null}
      robustness={null}
      nodes={NODES}
      edges={EDGES}
    />,
  )
}

beforeEach(() => {
  mockGraph.nodes = NODES
  mockGraph.edges = EDGES
  factorConfirmationAuthority.current = null
})
afterEach(() => {
  factorConfirmationAuthority.current = null
})

describe('Model card "needs your input" counts only what the Model tab can confirm', () => {
  it('⛔ under the DEPLOYED table: the card renders, the count line does not', () => {
    renderTab()
    const card = screen.getByTestId('model-card-pre-analysis')
    // Positive control: the card's own factor sentence IS rendered, so the
    // absence below is the count line's, not the card's.
    expect(card).toHaveTextContent('Based on 1 factor')
    expect(card).not.toHaveTextContent(/needs? your input/)
  })

  it('contrast: with confirmation CONNECTED the same estimate IS counted', () => {
    factorConfirmationAuthority.current = 'server_graph'
    renderTab()
    expect(screen.getByTestId('model-card-pre-analysis')).toHaveTextContent('1 factor needs your input')
  })
})
