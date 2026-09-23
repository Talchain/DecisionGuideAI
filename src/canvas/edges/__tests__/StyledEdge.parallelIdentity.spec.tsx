/**
 * ⭐ THE MOUNTED EDGE NEVER PAINTS ANOTHER RELATIONSHIP'S FINDING
 * (Codex #1919 CHANGES_REQUIRED 5802926467).
 *
 * The helper test (`fragileEdgeMatch.identity.spec`) passed the parallel-edge
 * context by hand; the MOUNTED reader never supplied it, so two parallel A→B
 * edges both inherited one measured risk. `StyledEdge` now resolves the entry
 * against the live graph once and hands that context to every reader (cue,
 * probability, top-edge, placement, lens label). Harness copied from
 * `StyledEdge.fragilePresence.spec.tsx`, with `getEdges` made live.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

// Mutable per-test report — the store mock factory reads it at selector time.
let mockReport: Record<string, unknown> | null = null
// The LIVE graph the mounted reader resolves identity against (Codex #1919 5802926467).
let mockEdges: Array<{ id: string; source: string; target: string }> = []

// ── ReactFlow mocks (as in StyledEdge.hover.spec.tsx) ────────────────────────
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: () => null,
      getEdges: () => mockEdges,
      getNodes: () => [],
    }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'complete', report: mockReport },
      viewMode: 'detailed',
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
      },
    })
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))

vi.mock('../../hooks/useTheme', () => ({
  useIsDark: () => false,
}))

vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))

vi.mock('../../../flags', () => ({
  isGraphLensEnabled: () => false,
}))

vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))

vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: (_: any, props: any) => props,
}))

vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

const defaultEdgeProps = {
  id: 'e1',
  source: 'n1',
  target: 'n2',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
  data: {
    weight: 0.6,
    direction: 'positive' as const,
    beliefExists: 0.8,
  },
}

function setFragileEdges(fragileEdges: Array<Record<string, unknown>>): void {
  mockReport = { robustness: { fragile_edges: fragileEdges } }
}


const PARALLEL = [
  { id: 'e1', source: 'n1', target: 'n2' },
  { id: 'e2', source: 'n1', target: 'n2' },
]
const renderEdge = (id: string) =>
  render(<StyledEdge {...(defaultEdgeProps as any)} id={id} source="n1" target="n2" />)

describe('StyledEdge — one resolved fragility identity per relationship (Codex 5802926467)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockReport = null
    mockEdges = []
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('CONTROL — a unique id-less A→B finding shows on its one edge', () => {
    mockEdges = [{ id: 'e1', source: 'n1', target: 'n2' }]
    setFragileEdges([{ from_id: 'n1', to_id: 'n2', switch_probability: 0.62 }])
    renderEdge('e1')
    expect(screen.getByTestId('edge-fragile-tag')).toBeInTheDocument()
  })

  it('parallel e1/e2 with the finding naming e1: e1 shows it, e2 does NOT borrow it', () => {
    mockEdges = PARALLEL
    setFragileEdges([{ edge_id: 'e1', from_id: 'n1', to_id: 'n2', switch_probability: 0.62 }])
    renderEdge('e1')
    expect(screen.getByTestId('edge-fragile-tag')).toBeInTheDocument()
    cleanup()
    renderEdge('e2')
    expect(screen.queryByTestId('edge-fragile-tag')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('base-edge').length).toBeGreaterThan(0) // the edge itself rendered
  })

  it('an id-less finding that matches PARALLEL edges is withheld on both', () => {
    mockEdges = PARALLEL
    setFragileEdges([{ from_id: 'n1', to_id: 'n2', switch_probability: 0.62 }])
    for (const id of ['e1', 'e2']) {
      renderEdge(id)
      expect(screen.queryByTestId('edge-fragile-tag')).not.toBeInTheDocument()
      expect(screen.getAllByTestId('base-edge').length).toBeGreaterThan(0)
      cleanup()
    }
  })

  it('a supplied id that names NO edge here never falls back to endpoints', () => {
    mockEdges = [{ id: 'e1', source: 'n1', target: 'n2' }]
    setFragileEdges([{ edge_id: 'e9', from_id: 'n1', to_id: 'n2', switch_probability: 0.62 }])
    renderEdge('e1')
    expect(screen.queryByTestId('edge-fragile-tag')).not.toBeInTheDocument()
  })
})
