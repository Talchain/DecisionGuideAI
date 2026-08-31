/**
 * EDGE THICKNESS MUST SURVIVE THE ZOOM THE CANVAS ACTUALLY USES.
 *
 * ── WHAT WAS MEASURED, ON THE DEPLOYED BUILD ──────────────────────────────
 * Stroke width is chosen in FLOW space and multiplied by the viewport scale
 * before it reaches a pixel. A guest's saved model auto-fits to
 * `scale(0.322946)`, and at that scale:
 *
 *     declared 1px  ->  rendered 0.32px
 *     declared 2px  ->  rendered 0.65px
 *
 * Every connection was a sub-pixel hairline, and the gap between "weak" and
 * "strong" was a third of a pixel. The thickness encoding — the one channel
 * saying which relationships carry the result — never reached the screen. It
 * was not badly chosen; it was never visible.
 *
 * `non-scaling-stroke` makes the declared width a SCREEN width at any zoom, so
 * 1.5 / 2 / 3 stay 1.5 / 2 / 3 and stay distinguishable. The dash channel beside
 * it was already reasoned about this way ("stays legible at every zoom level");
 * width simply never got the same treatment.
 *
 * ⚠ HONEST LIMIT. jsdom has no layout and no viewport transform, so a test here
 * CANNOT observe a rendered pixel width — asserting one would measure the test
 * environment. What is checkable is that the edge declares the property that
 * makes its width zoom-independent, which is exactly what was missing. The
 * pixel half was established by driving the deployed build.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

// ── Node kind registry — switched per-test ───────────────────────────────────
const nodeKinds: Record<string, string> = {}

// ── Mutable store state — overridden per-test ────────────────────────────────
interface StoreState {
  viewMode: 'standard' | 'expert'
  resultsStatus: 'idle' | 'complete'
  report: unknown
}
const storeState: StoreState = { viewMode: 'standard', resultsStatus: 'idle', report: null }
const setStore = (over: Partial<StoreState>) => Object.assign(storeState, over)

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ style }: any) => <path data-testid="base-edge" style={style} />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) =>
        nodeKinds[id]
          ? { id, type: nodeKinds[id], data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } }
          : null,
      getEdges: () => [],
      getNodes: () =>
        Object.entries(nodeKinds).map(([id, kind]) => ({
          id, type: kind, data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 },
        })),
    }),
    useStore: (selector: any) =>
      selector({
        nodes: Object.entries(nodeKinds).map(([id, kind]) => ({
          id, type: kind, data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 },
        })),
      }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: storeState.resultsStatus, report: storeState.report },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      viewMode: storeState.viewMode,
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

vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
  isTopFragileEdge: () => false,
}))
// Distinct width outputs so an assertion can tell the two formulas apart;
// dash reflects the real <0.7 rule so the belief-dash pin is meaningful.
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  // ⛔ importOriginal-SPREAD, not a hand-listed replacement. A `vi.mock`
  // factory REPLACES the module, so every export added after this mock was
  // written silently vanished — adding `UNSET_EDGE_STROKE_WIDTH` took 49 tests
  // down across seven files at once. The spread makes the mock derive from the
  // real module and override only what it means to stub.
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  existenceCertaintyToLineStyle: (p: number | undefined) => (p !== undefined && p < 0.7 ? '6,4' : undefined),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 7,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

const baseProps = {
  id: 'e1', source: 'src', target: 'tgt',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: false,
}

const styleOf = (container: HTMLElement) =>
  ((container.querySelector('[data-testid="base-edge"]') as unknown as HTMLElement).style)


describe('StyledEdge — thickness is a screen width, not a flow-space width', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    setStore({ viewMode: 'standard', resultsStatus: 'idle', report: null })
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
  })

  it('declares non-scaling-stroke, so the width means the same at every zoom', () => {
    const { container } = render(
      <StyledEdge {...(baseProps as any)} data={{ direction: 'positive', direction_source: 'user' }} />,
    )
    expect(styleOf(container).vectorEffect).toBe('non-scaling-stroke')
  })

  // The property must not be bought by flattening the encoding it protects: a
  // width still has to be chosen, or every edge would be uniformly legible and
  // equally meaningless.
  it('still carries a chosen stroke width alongside it', () => {
    const { container } = render(
      <StyledEdge {...(baseProps as any)} data={{ direction: 'positive', direction_source: 'user' }} />,
    )
    const style = styleOf(container)
    expect(style.vectorEffect).toBe('non-scaling-stroke')
    expect(style.strokeWidth).not.toBe('')
    expect(Number.parseFloat(style.strokeWidth)).toBeGreaterThan(0)
  })

  // A structural edge is the thinnest thing on the canvas (1px) and therefore
  // the first to vanish at fit-zoom, so it gets its own case rather than being
  // assumed to inherit.
  it('applies to structural edges too, which are the thinnest and vanish first', () => {
    nodeKinds.src = 'decision'
    nodeKinds.tgt = 'option'
    const { container } = render(<StyledEdge {...(baseProps as any)} data={{}} />)
    expect(styleOf(container).vectorEffect).toBe('non-scaling-stroke')
  })
})
