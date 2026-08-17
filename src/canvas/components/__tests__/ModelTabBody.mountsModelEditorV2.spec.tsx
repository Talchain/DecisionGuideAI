/**
 * The Model Editor v2 is MOUNTED (16 Aug 2026 mount train).
 *
 * The PX-D finding this closes: `src/canvas/model-tab-v2/` was a complete,
 * guarded, render-only editor surface with NO route, NO tab registration and
 * NO importer — BUILT-UNMOUNTED. This spec pins the mount at the surface a
 * user actually loads: `ModelTabBody` (the Model tab's container, rendered by
 * `OutputsDock`) must render the v2 panel, with rows bound to the ids of the
 * model's own elements.
 *
 * ⚠ BOUND TO THE MOUNT PATH, BY IDENTITY (trap 3b). The assertion renders
 * ModelTabBody itself — not the panel in isolation — so a regression that
 * unmounts the panel (deleting the import, gating it behind a flag that is
 * off, or moving it behind a dead branch) goes RED here even while every
 * panel-level spec stays green. A green panel spec is not evidence about a
 * component the tab does not render.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

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
    vi.fn((selector: (s: unknown) => unknown) => selector(getMockState())),
    { getState: getMockState },
  ),
}))

vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { ModelTabBody } from '../ModelTabBody'

const FACTOR_ID = 'fac_budget'

function factorNode(): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Budget',
      category: 'observable',
      observedState: { value: 0.5, source: 'cee_inference' },
    },
  } as unknown as Node
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
  mockGraph.nodes = [factorNode()]
  mockGraph.edges = []
})

describe('ModelTabBody mounts the Model Editor v2', () => {
  it('renders the v2 panel inside the Model tab', () => {
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[factorNode()]} edges={[]} />)
    const tab = screen.getByTestId('model-tab')
    const panel = screen.getByTestId('model-tab-v2-panel')
    expect(tab.contains(panel)).toBe(true)
  })

  it('the mounted panel carries the model, bound by element id', () => {
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[factorNode()]} edges={[]} />)
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toBeInTheDocument()
  })
})
