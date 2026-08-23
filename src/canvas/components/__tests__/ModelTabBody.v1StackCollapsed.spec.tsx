/**
 * B3/B5 Model convergence.
 *
 * The legacy stack used to duplicate every entity and expose local-only edits.
 * The connected v2 outline is now the sole mounted route. Cross-panel section
 * requests front that route instead of reviving a hidden second editor.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

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

import { ModelTabBody } from '../ModelTabBody'
import { useUIStore } from '../../../stores/uiStore'

const NODES: Node[] = [
  {
    id: 'goal_margin',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Protect gross margin' },
  },
  {
    id: 'fac_budget',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Budget',
      category: 'observable',
      observedState: { value: 0.5, source: 'cee_inference' },
    },
  },
] as Node[]
const EDGES: Edge[] = []
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

const scrollContexts: Element[] = []
let originalScrollIntoView: unknown

function renderTab() {
  return render(<ModelTabBody {...DEFAULT_PROPS} nodes={NODES} edges={EDGES} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGraph.nodes = NODES
  mockGraph.edges = EDGES
  scrollContexts.length = 0
  originalScrollIntoView = (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
  ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView =
    function (this: Element) { scrollContexts.push(this) }
  useUIStore.setState({ pendingModelTabSection: null })
})

afterEach(() => {
  if (originalScrollIntoView === undefined) {
    delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
  } else {
    ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView = originalScrollIntoView
  }
  useUIStore.setState({ pendingModelTabSection: null })
})

describe('the Model tab mounts one connected editor', () => {
  it('contains the v2 outline and no legacy stack or legacy sections', () => {
    renderTab()
    const tab = screen.getByTestId('model-tab')
    expect(tab.contains(screen.getByTestId('model-tab-v2-panel'))).toBe(true)
    expect(screen.queryByTestId('model-tab-v1-stack')).not.toBeInTheDocument()
    expect(screen.queryByTestId('model-goal-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('model-factors-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('model-relationships-section')).not.toBeInTheDocument()
  })

  it('keeps the connected Model filter as the sole search surface', () => {
    renderTab()
    expect(screen.getAllByRole('searchbox')).toHaveLength(1)
    expect(screen.getByRole('searchbox')).toHaveAttribute('data-testid', 'model-tab-v2-filter')
  })
})

describe('cross-panel section requests front the connected route', () => {
  it('scrolls to the v2 panel and consumes the request', async () => {
    renderTab()
    act(() => { useUIStore.getState().requestModelTabSection('relationships') })
    const target = screen.getByTestId('model-group-v2-relationships')
    await waitFor(() => expect(scrollContexts).toContain(target))
    expect(useUIStore.getState().pendingModelTabSection).toBeNull()
  })

  it('does not scroll when no section is requested', async () => {
    renderTab()
    await Promise.resolve()
    expect(scrollContexts).toHaveLength(0)
  })
})
