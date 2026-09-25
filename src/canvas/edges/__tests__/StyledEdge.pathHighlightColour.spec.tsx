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
import { render, cleanup, fireEvent } from '@testing-library/react'
import { StyledEdge, EDGE_GLOW } from '../StyledEdge'
import { Position } from '@xyflow/react'

let mockHighlightedEdges = new Set<string>()
let mockDimmedEdgeIds = new Set<string>()

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    // `data-edge-id` lets a two-edge render find each line BY ITS OWN ID.
    BaseEdge: (props: any) => <path data-testid="base-edge" data-edge-id={props.id} style={props.style} />,
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

/**
 * The rest of contract §03's selection rule, on the same rendered edge.
 * `.edge-group.selected .edge-visual{filter:drop-shadow(0 0 2px #277A9D55)}`
 * is the WHOLE of a path edge's emphasis — no stroke-width rule — and
 * `.edge-group.dimmed{opacity:.18}` is the off-path dim. Width is the
 * strength channel ("Width = modelled strength. Same meaning before and after
 * analysis"), so a path highlight that adds +1px makes a slight link on the
 * path read as a moderate one while its node is selected.
 *
 * 0.18 is asserted as the contract's LITERAL, not via the exported constant:
 * comparing the group to the constant it is painted from could never fail.
 */
const CONTRACT_EDGE_DIM_OPACITY = '0.18'

const lineOf = (container: HTMLElement, edgeId: string) =>
  container.querySelector(`[data-testid="base-edge"][data-edge-id="${edgeId}"]`) as unknown as HTMLElement | null
/** The wrapping group of THIS edge's own line — the unit the contract dims. */
const groupOf = (container: HTMLElement, edgeId: string) =>
  lineOf(container, edgeId)!.closest('g') as unknown as SVGGElement & HTMLElement

describe('StyledEdge — contract §03: a path highlight adds emphasis only; off-path connections dim to .18', () => {
  it('a highlighted path edge keeps its RESTING width — the glow is the emphasis, not +1px', () => {
    mockHighlightedEdges = new Set<string>()
    const resting = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    const restingWidth = Number(lineOf(resting.container, 'e1')!.style.strokeWidth)
    // Precondition: a real width was painted, so equality below is not '' === ''.
    expect(restingWidth).toBeGreaterThan(0)
    cleanup()

    mockHighlightedEdges = new Set(['e1'])
    const { container } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    expect(Number(lineOf(container, 'e1')!.style.strokeWidth)).toBe(restingWidth)
    // …and the emphasis is still there, in its own channel.
    expect(String(lineOf(container, 'e1')!.style.filter)).toContain(EDGE_GLOW.selected)
  })

  it('CONTRAST: hovering that highlighted edge still applies the hover +1 (DS v5 §7.3)', () => {
    mockHighlightedEdges = new Set<string>()
    const resting = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    const restingWidth = Number(lineOf(resting.container, 'e1')!.style.strokeWidth)
    expect(restingWidth).toBeGreaterThan(0)
    cleanup()

    mockHighlightedEdges = new Set(['e1'])
    const { container } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    fireEvent.mouseEnter(groupOf(container, 'e1'))
    expect(Number(lineOf(container, 'e1')!.style.strokeWidth)).toBe(restingWidth + 1)
  })

  it('an off-path (selection-dimmed) connection dims to the contract .18 as one unit', () => {
    mockDimmedEdgeIds = new Set(['e1'])
    const { container } = render(<StyledEdge {...(NEGATIVE_EDGE as any)} />)
    const group = groupOf(container, 'e1')
    expect(group.getAttribute('data-selection-dimmed')).toBe('true')
    expect(group.style.opacity).toBe(CONTRACT_EDGE_DIM_OPACITY)
    // The line adds no second factor of its own, and dimming never recolours it.
    expect(lineOf(container, 'e1')!.style.opacity).toBe('')
    expect(lineOf(container, 'e1')!.style.stroke).toBe('var(--edge-negative)')
  })

  it('PATH AND OFF-PATH TOGETHER: the path + edge is undimmed at full direction colour; the off-path − edge keeps rose at .18', () => {
    mockHighlightedEdges = new Set(['e-path'])
    mockDimmedEdgeIds = new Set(['e-off'])
    const { container } = render(
      <>
        <StyledEdge {...({ ...POSITIVE_EDGE, id: 'e-path' } as any)} />
        <StyledEdge {...({ ...NEGATIVE_EDGE, id: 'e-off', source: 'n3', target: 'n4' } as any)} />
      </>,
    )
    expect(lineOf(container, 'e-path')!.style.stroke).toBe('var(--edge-positive)')
    expect(groupOf(container, 'e-path').style.opacity).toBe('')
    expect(String(lineOf(container, 'e-path')!.style.filter)).toContain(EDGE_GLOW.selected)

    expect(lineOf(container, 'e-off')!.style.stroke).toBe('var(--edge-negative)')
    expect(groupOf(container, 'e-off').style.opacity).toBe(CONTRACT_EDGE_DIM_OPACITY)
    expect(String(lineOf(container, 'e-off')!.style.filter)).not.toContain(EDGE_GLOW.selected)
  })
})
