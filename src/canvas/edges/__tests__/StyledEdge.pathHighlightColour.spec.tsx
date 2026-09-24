/**
 * GAP 1 (design-gap audit row 13, contract §03 "Colour and sign = direction").
 *
 * `edgePresentation.spec.ts` pins the RULE-level fix (`resolveEdgeStroke`
 * keeps the polarity value for a highlighted path). This file is the other
 * half: the rendered DOM. It proves two things together, since either one
 * alone is not the contract:
 *   1. a highlighted path edge's stroke is its OWN direction colour, not Info;
 *   2. it still gains the soft Info glow the contract asks for, as a SEPARATE
 *      CSS channel (`filter: drop-shadow`) — so the emphasis is not silently
 *      dropped along with the recolour.
 *
 * Harness copied from `StyledEdge.filterCompose.spec.tsx` (the store mock
 * shape, the `EDGE_GLOW` import, the `'../../../flags'` path — one level
 * deeper than it looks, a prior defect record warns not to get this wrong).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StyledEdge, EDGE_GLOW } from '../StyledEdge'
import { Position } from '@xyflow/react'

let mockHighlightedEdges = new Set<string>()
let mockDimmedEdgeIds = new Set<string>()

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: (props: any) => <path data-testid="base-edge" style={props.style} />,
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
      results: { status: 'idle', report: null },
      viewMode: 'standard',
      hoveredOptionId: null,
      highlightedEdges: mockHighlightedEdges,
      dimmedEdgeIds: mockDimmedEdgeIds,
      analysisHighlight: { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() },
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
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({ getStrengthDescription: () => 'moderate', getProvenanceLabel: () => '' }))

const POSITIVE_EDGE = {
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
  data: { strength_mean: 0.6, effect_direction: 'positive' as const, exists_probability: 0.8 },
}

const NEGATIVE_EDGE = {
  ...POSITIVE_EDGE,
  data: { strength_mean: 0.6, effect_direction: 'negative' as const, exists_probability: 0.8 },
}

const styleOf = (container: HTMLElement) =>
  (container.querySelector('[data-testid="base-edge"]') as unknown as HTMLElement).style

afterEach(() => {
  cleanup()
  mockHighlightedEdges = new Set<string>()
  mockDimmedEdgeIds = new Set<string>()
})

describe('StyledEdge — GAP 1: a highlighted path keeps its direction colour and gains a soft glow', () => {
  it('a highlighted positive edge paints its OWN positive stroke, not Info blue', () => {
    mockHighlightedEdges = new Set(['e1'])
    const { container } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    expect(styleOf(container).stroke).toBe('var(--edge-positive)')
  })

  it('the same highlighted edge also gains the soft Info glow, as a separate channel', () => {
    mockHighlightedEdges = new Set(['e1'])
    const { container } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    expect(String(styleOf(container).filter)).toContain(EDGE_GLOW.selected)
  })

  it('OPPOSITE-DIRECTION TWIN: a highlighted negative edge keeps rose, not Info', () => {
    mockHighlightedEdges = new Set(['e1'])
    const { container } = render(<StyledEdge {...(NEGATIVE_EDGE as any)} />)
    expect(styleOf(container).stroke).toBe('var(--edge-negative)')
  })

  it('CONTRAST: the same edge unhighlighted keeps its stroke and gets no glow', () => {
    mockHighlightedEdges = new Set<string>()
    const { container } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    expect(styleOf(container).stroke).toBe('var(--edge-positive)')
    // jsdom's CSSStyleDeclaration reads an unset property as '', not
    // undefined — a `filter: undefined` style value never becomes an
    // inline style at all.
    expect(styleOf(container).filter).toBe('')
  })

  it('CONTRAST: a selection-dimmed edge gets no glow even while highlighted', () => {
    // 6B's existing rule for `selected`/`isHovered` glows also withholds them
    // from a selection-dimmed edge (see the `!isSelectionDimmed` guard in
    // StyledEdge). The highlighted-path glow must not bypass that guard.
    mockHighlightedEdges = new Set(['e1'])
    mockDimmedEdgeIds = new Set(['e1'])
    const { container } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    expect(String(styleOf(container).filter)).not.toContain(EDGE_GLOW.selected)
  })
})
