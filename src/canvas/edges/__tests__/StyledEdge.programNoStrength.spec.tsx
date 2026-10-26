/**
 * ⭐ A PROGRAM LINK WITH NO STRENGTH NEVER DRAWS AS "VERY STRONG" (W3b, the design audit on served board 5651fd74: every
 * link read "Very strong" because CEE sent a bare +1 as the strength of definition and goal links). CEE will send no
 * strength there (its source fix); the canvas must then draw the link with no strength band and no strength word, through
 * the existing no-strength rendering (decision 8 owns how definition links look). No rule here reinterprets ±1.
 *
 * Edge data from the real `mapDraftEdgeToCanvas`. The link is the served goal link `weekly_orders__reach_order_target`
 * (`served-program-orders-full-read-20261026.json`): as served (`strength: {mean: 1}`) and as CEE will send it (no
 * `strength`). Mocks as `StyledEdge.programFigure.spec.tsx`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ id, style }: any) => <path data-testid="base-edge" data-edge-id={id} style={style} />,
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
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      lodRung: 'full',
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
      },
    }),
  ),
}))
vi.mock('../../hooks/useModelChangedSinceRun', () => ({
  useModelChangedSinceRunLight: () => false,
  useModelChangedSinceRun: () => false,
}))
vi.mock('../../store/edgeLabelMode', () => ({ useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })) }))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../domain/identityExactLinks', () => ({ useIdentityExactWords: () => null }))
vi.mock('../../hooks/useFirstTimeHints', () => ({ useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }) }))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
const saved: { graph: unknown } = { graph: null }
vi.mock('../../nodes/shared/savedGraph', () => ({ useSavedGraph: () => saved.graph }))


import { UNSET_EDGE_STROKE_WIDTH } from '../../utils/graphDisplayCalculations'
import { describeEdge } from '../../domain/edgeLabels'
import { resolveEdgeDirectionDisplay, resolveEdgeSignedStrengthDisplay, resolveEdgeValueDisplay } from '../../domain/edgeValueProvenance'
import served from '../../nodes/__tests__/fixtures/served-program-orders-full-read-20261026.json'

type Rec = Record<string, unknown>
type Wire = Rec & { id: string; from: string; to: string }
const GOAL_LINK = (served.graph.edges as Wire[]).find((e) => e.id === 'weekly_orders__reach_order_target')!
const { strength: _served, ...noStrength } = GOAL_LINK
const edgeProps = (wire: Rec) => ({
  id: wire.id as string, source: wire.from as string, target: wire.to as string,
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Bottom, targetPosition: Position.Top, selected: false,
  data: mapDraftEdgeToCanvas({ ...wire } as never, 0).data,
})
/** The canvas line's width, and the link's words as the details panel reads them (`describeEdge`, edgeLabels.ts). */
const draw = (wire: Rec) => {
  const { container } = render(<StyledEdge {...(edgeProps(wire) as any)} />)
  const path = container.querySelector('[data-testid="base-edge"]') as HTMLElement
  const data = edgeProps(wire).data as Rec
  const words = describeEdge(resolveEdgeSignedStrengthDisplay(data), resolveEdgeValueDisplay(data, 'beliefExists'),
    resolveEdgeDirectionDisplay(data)).label
  return { width: Number(path.style.strokeWidth), words }
}

afterEach(() => { saved.graph = null })

describe('a program link with no strength', () => {
  it('as CEE will send the goal link (no `strength`): the not-set width, and its words say the strength is not set', () => {
    saved.graph = served.graph
    const { width, words } = draw(noStrength)
    expect(width).toBe(UNSET_EDGE_STROKE_WIDTH)
    expect(words).toMatch(/^Boost, strength not set/)
    expect(words).not.toMatch(/strong/i)
  })

  it('CONTRAST — as served today (`strength: {mean: 1}`): the Very strong band and words, which CEE\'s fix removes at source', () => {
    saved.graph = served.graph
    const { width, words } = draw(GOAL_LINK)
    expect(width).toBeGreaterThan(UNSET_EDGE_STROKE_WIDTH)
    expect(words).toMatch(/^Very strong boost/)
  })
})
