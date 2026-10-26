/**
 * ⭐ A LINK THAT HOLDS BY DEFINITION READS "BY DEFINITION" AND IS DRAWN PLAIN (W3b UI reader 3; Paul's decision 8). CEE
 * #3799 sends a program's definition links (a goal's measure, the parts of a sum or a product) with NO strength and
 * `provenance.definitional: true`. `strengthDefinitionalPatch` dropped the label when no strength came with it, so the
 * link read "Boost, strength not set", dotted. Now it reads "By definition" (`BY_DEFINITION`), thin and solid. A causal
 * link with no strength is not a definition and keeps its not-set words and dots.
 *
 * Real path: the served program read's links (`served-program-orders-full-read-20261026.json`) through the real
 * `mapDraftEdgeToCanvas` and the real `StyledEdge`, with the strength removed as CEE #3799 sends it (SYNTHETIC, labelled).
 * Mocks as `StyledEdge.programNoStrength.spec.tsx`.
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
      results: { status: 'complete', report: null },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      lodRung: 'full',
      // A Run's view, detailed, where a selected link's label shows (`shouldShowEdgeLabel`), as StyledEdge.edgeLabelStrengthWords.2950.
      viewMode: 'detailed',
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
import served from '../../nodes/__tests__/fixtures/served-program-orders-full-read-20261026.json'

type Rec = Record<string, unknown>
type Wire = Rec & { id: string; from: string; to: string; provenance?: Rec }
const edge = (id: string) => (served.graph.edges as Wire[]).find((e) => e.id === id)!
/**
 * SYNTHETIC, labelled: the served links as CEE #3799 now sends them (`project.ts` `link()` at 3ea44fea): no `strength`, and
 * no `effect_direction` on a goal's measure. A part of a sum keeps its sign and says how it combines (`reasoning: 'added'`).
 */
const asCee3799 = (w: Wire, extra: Rec = {}): Wire => {
  const { strength: _s, ...rest } = w
  return { ...rest, ...extra }
}
const { effect_direction: _d, ...goalLinkNoSign } = asCee3799(edge('weekly_orders__reach_order_target'))
const PART_OF_SUM = asCee3799(edge('baseline_orders__weekly_orders'), { provenance: { ...edge('baseline_orders__weekly_orders').provenance, reasoning: 'added' } })
const CAUSAL = asCee3799(edge('price_cut__weekly_orders'))

const props = (wire: Rec, selected: boolean) => ({
  id: wire.id as string, source: wire.from as string, target: wire.to as string,
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Bottom, targetPosition: Position.Top, selected,
  data: mapDraftEdgeToCanvas({ ...wire } as never, 0).data,
})
/** The link's words (its label's accessible name, shown once selected) and its line at rest (width, dash). */
const draw = (wire: Rec) => {
  const selected = render(<StyledEdge {...(props(wire, true) as any)} />)
  const text = selected.container.querySelector('[data-testid="edge-influence-label"]')?.getAttribute('aria-label') ?? ''
  selected.unmount()
  const rest = render(<StyledEdge {...(props(wire, false) as any)} />)
  const path = rest.container.querySelector('[data-testid="base-edge"]') as HTMLElement
  const out = { text, width: Number(path.style.strokeWidth), dash: path.style.strokeDasharray }
  rest.unmount()
  return out
}

afterEach(() => { saved.graph = null })

describe('a program link that holds by definition (decision 8)', () => {
  it('a goal\'s measure, with no strength and no sign: reads "By definition", thin and solid', () => {
    saved.graph = served.graph
    const d = draw(goalLinkNoSign)
    expect(d.text).toContain('By definition')
    expect(d.text).not.toMatch(/strength not set|strong/i)
    expect(d.width).toBe(UNSET_EDGE_STROKE_WIDTH)
    expect(d.dash === '' || d.dash === 'none').toBe(true)
  })

  it('a part of a sum, signed, with no strength: reads "By definition", not "Boost, strength not set", and is not dotted', () => {
    saved.graph = served.graph
    const d = draw(PART_OF_SUM)
    expect(d.text).toContain('By definition')
    expect(d.text).not.toMatch(/Boost, strength not set/)
    expect(d.dash === '' || d.dash === 'none').toBe(true)
  })

  it('CONTRAST: a causal link with no strength is not a definition: its own figure (`programFigure`), dotted, as today', () => {
    saved.graph = served.graph
    const d = draw(CAUSAL)
    expect(d.text).not.toContain('By definition')
    expect(d.text).toContain('about +1.25 (0–3) order/week/%')
    expect(d.dash).not.toBe('')
  })

  it('CONTRAST (as served before #3799, a strength supplied): a definitional link keeps its strength words, as today', () => {
    saved.graph = served.graph
    const d = draw(edge('baseline_orders__weekly_orders'))
    expect(d.text).not.toContain('By definition')
    expect(d.text).toMatch(/Very strong boost/)
  })
})
