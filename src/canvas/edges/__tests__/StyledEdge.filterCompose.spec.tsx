/**
 * StyledEdge — drop-shadow filter composition.
 *
 * Two independent glow signals can apply to the SAME edge:
 *   - the sensitivity lens glow (info) on a top-quartile edge, and
 *   - the analysis-graph fragile halo (warning) on a viewed flip-risk edge.
 *
 * CSS `filter` accepts a space-separated list, so both drop-shadows must be
 * composed. Before the fix the filter picked the first matching branch and a
 * viewed flip-risk edge that was ALSO a top-sensitivity lens edge silently lost
 * its warning halo. These pins assert: both-active → BOTH shadows present;
 * each-alone → only its own shadow (positive controls, so the both-active
 * assertion is not vacuous).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

const INFO_GLOW = 'drop-shadow(0 0 2px var(--semantic-info, #3b82f6))'
const WARNING_HALO = 'drop-shadow(0 0 4px var(--semantic-warning, #eab308))'

// Mutable, per-test scenario knobs.
let lensActive: 'full' | 'sensitivity' = 'full'
let sensitivityWeights = new Map<string, number>()
let sensitivityQuartiles: { q25: number; q75: number } | null = null
let analysisHighlight: { source: 'flip_risks' | 'drivers' | null; edgeIds: Set<string>; nodeIds: Set<string> } = {
  source: null,
  edgeIds: new Set(),
  nodeIds: new Set(),
}

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ style }: any) => <path data-testid="base-edge" style={style} />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

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
        active: lensActive,
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: sensitivityWeights,
        _sensitivityQuartiles: sensitivityQuartiles,
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
// Lens ENABLED so the sensitivity glow branch can fire (the other StyledEdge
// specs disable it because they exercise non-lens encodings).
// Path is '../../../flags' (src/flags) — the module StyledEdge imports. The
// spec sits one level deeper (edges/__tests__/), so '../../flags' resolved to
// the non-existent src/canvas/flags and the mock silently no-op'd, leaving
// these two tests depending on ambient VITE_FEATURE_GRAPH_LENS (Codex P2-1).
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => true }))
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

const filterOf = (container: HTMLElement) =>
  (container.querySelector('[data-testid="base-edge"]') as unknown as HTMLElement).style.filter

afterEach(() => {
  cleanup()
  lensActive = 'full'
  sensitivityWeights = new Map()
  sensitivityQuartiles = null
  analysisHighlight = { source: null, edgeIds: new Set(), nodeIds: new Set() }
})

describe('StyledEdge — filter composition', () => {
  it('composes BOTH drop-shadows when the edge is a top-sensitivity lens edge AND a viewed flip-risk', () => {
    lensActive = 'sensitivity'
    sensitivityWeights = new Map([['e1', 0.9]])
    sensitivityQuartiles = { q25: 0.2, q75: 0.5 }
    analysisHighlight = { source: 'flip_risks', edgeIds: new Set(['e1']), nodeIds: new Set() }

    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    const filter = filterOf(container)
    // RED before the fix: the first branch (info glow) won and the warning halo
    // was dropped.
    expect(filter).toContain(INFO_GLOW)
    expect(filter).toContain(WARNING_HALO)
  })

  it('positive control: sensitivity glow ONLY when the edge is not a flip-risk', () => {
    lensActive = 'sensitivity'
    sensitivityWeights = new Map([['e1', 0.9]])
    sensitivityQuartiles = { q25: 0.2, q75: 0.5 }
    analysisHighlight = { source: null, edgeIds: new Set(), nodeIds: new Set() }

    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    const filter = filterOf(container)
    expect(filter).toContain(INFO_GLOW)
    expect(filter).not.toContain(WARNING_HALO)
  })

  it('positive control: warning halo ONLY when a viewed flip-risk edge is not top-sensitivity', () => {
    lensActive = 'full'
    analysisHighlight = { source: 'flip_risks', edgeIds: new Set(['e1']), nodeIds: new Set() }

    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    const filter = filterOf(container)
    expect(filter).toContain(WARNING_HALO)
    expect(filter).not.toContain(INFO_GLOW)
  })
})
