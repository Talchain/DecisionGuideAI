/**
 * StyledEdge — analysis-graph projection marker.
 *
 * A flip-risk edge in the analysisHighlight slice carries a warning halo +
 * thicker stroke while viewed. This pins that the edge group exposes the
 * data-analysis-fragile marker when (and only when) the slice names it — the
 * consumer read is wired. The stroke COLOUR is asserted unchanged elsewhere
 * (directionColour.spec); the marker composes via a separate CSS channel.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

let analysisHighlight: { source: 'flip_risks' | 'drivers' | null; edgeIds: Set<string>; nodeIds: Set<string> } = {
  source: null,
  edgeIds: new Set(),
  nodeIds: new Set(),
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'complete', report: { robustness: { fragile_edges: [] } } },
      highlightedEdges: new Set<string>(),
      analysisHighlight,
      viewMode: 'standard',
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _hiddenNodeIds: new Set<string>(),
        _hiddenEdgeIds: new Set<string>(),
        _causalEdgeParams: new Map(),
        _evidenceEdgeClass: new Map(),
      },
    }),
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({ useEdgeLabelMode: (s: any) => s({ mode: 'human' }) }))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({ useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }) }))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
  isTopFragileEdge: () => false,
}))
vi.mock('../../utils/graphDisplayCalculations', () => ({
  existenceCertaintyToLineStyle: () => 'solid',
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({ getStrengthDescription: () => 'moderate', getProvenanceLabel: () => '' }))

const edgeProps = {
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
  data: { weight: 0.6, direction: 'positive' as const, beliefExists: 0.8, edge_type: 'causal' },
}

afterEach(() => {
  cleanup()
  analysisHighlight = { source: null, edgeIds: new Set(), nodeIds: new Set() }
})

describe('StyledEdge — analysis-graph projection marker', () => {
  it('marks the edge group when the flip_risks slice names this edge', () => {
    analysisHighlight = { source: 'flip_risks', edgeIds: new Set(['e1']), nodeIds: new Set() }
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    expect(container.querySelector('g[data-analysis-fragile="true"]')).not.toBeNull()
  })

  it('does NOT mark the edge when the slice is empty', () => {
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    expect(container.querySelector('g[data-analysis-fragile="true"]')).toBeNull()
  })

  it('does NOT mark the edge when a DIFFERENT edge is named', () => {
    analysisHighlight = { source: 'flip_risks', edgeIds: new Set(['e9']), nodeIds: new Set() }
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    expect(container.querySelector('g[data-analysis-fragile="true"]')).toBeNull()
  })

  it('does NOT mark when the source is drivers (edge ids belong only to flip_risks)', () => {
    analysisHighlight = { source: 'drivers', edgeIds: new Set(['e1']), nodeIds: new Set() }
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    expect(container.querySelector('g[data-analysis-fragile="true"]')).toBeNull()
  })
})
