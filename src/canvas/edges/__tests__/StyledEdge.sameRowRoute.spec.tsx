/**
 * A SAME-ROW LINK IS ROUTED BETWEEN THE CARDS, NEVER LOOPED ROUND THEM
 * (canvas polish #1, 24 Sep 2026).
 *
 * Paul's staging screenshots: a factor → factor link between two cards in the
 * SAME row left the source's BOTTOM port and entered the target's TOP handle.
 * The target's top is ABOVE the source's bottom, so xyflow's bezier swung a
 * tall loop below the source and back over the target — crossing the target's
 * "Needs input" tab, with its +/− glyph floating on the card's top edge. The
 * single ugliest thing on the board.
 *
 * The visual contract (v3.1 `renderEdges`) only ever draws bottom → top and its
 * fixture has no same-row link, so it is silent here. The least-intrusive route
 * that never crosses another card's text:
 *
 *   side   ADJACENT cards: a short straight connector between their FACING
 *          sides, at the middle of the band the two cards share; the glyph sits
 *          in the gutter above the arrowhead.
 *   under  a card stands BETWEEN them: a shallow run in the gutter UNDER the
 *          row, rising into the target's bottom. A straight side connector
 *          would pass behind the middle card and read as two links through it.
 *
 * ⛔ BINDING (trap 19). The route is resolved from the store BY the edge's
 * `source` / `target` ids — the fixture store is shuffled and carries a decoy
 * card, so an implementation reading the wrong node draws a different path.
 * Paths are compared as exact `d` strings; the side is read from the group's
 * `data-same-row-route`. CONTRAST: a cross-row pair keeps the E9 curve byte for
 * byte, an upward cross-row pair and an unmeasured pair keep xyflow's bezier.
 *
 * Harness shape copied from `StyledEdge.contractV31Edges.spec.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'

type StoreNode = {
  id: string
  position: { x: number; y: number }
  measured?: { width: number; height: number }
}
let mockStoreNodes: StoreNode[] = []

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50, 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: mockStoreNodes, edges: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'idle', report: null },
      viewMode: 'standard',
      lodRung: 'full',
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      analysisHighlight: null,
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
vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

// ── Fixture: the contract's factor row geometry (248-wide cards, 32 gutter) ──
//
// Row A (factors) at y = 324, heights 117. Row B (outcomes) at y = 525.
// Handles, as xyflow reports them for a 12px handle centred on the border:
// bottom port = (centreX, bottom + 6), top handle = (centreX, top − 6).
const W = 248
const H = 117
const card = (id: string, x: number, y: number, h = H): StoreNode => ({
  id,
  position: { x, y },
  measured: { width: W, height: h },
})
const PRICE = card('price', 76, 324)        // x 76..324
const RESIST = card('resistance', 356, 324) // x 356..604
const CHURN = card('churn', 636, 324)       // x 636..884
const MRR = card('mrr', 356, 525)           // row below
const OPTION = card('option', 356, 158)     // row above
const bottomPort = (n: StoreNode) => ({
  x: n.position.x + W / 2,
  y: n.position.y + (n.measured?.height ?? H) + 6,
})
const topHandle = (n: StoreNode) => ({ x: n.position.x + W / 2, y: n.position.y - 6 })

const positive = {
  strength_mean: 0.5,
  effect_direction: 'positive' as const,
  beliefExists: 0.8,
  beliefExistsSource: 'cee' as const,
}

function renderLink(src: StoreNode, tgt: StoreNode, id = 'e-link') {
  const s = bottomPort(src)
  const t = topHandle(tgt)
  return render(
    <StyledEdge
      {...({
        id,
        source: src.id,
        target: tgt.id,
        sourceX: s.x,
        sourceY: s.y,
        targetX: t.x,
        targetY: t.y,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        selected: false,
      } as any)}
      data={positive as any}
    />,
  )
}
const hitPathOf = (c: HTMLElement) => c.querySelector('path[stroke="transparent"]') as SVGPathElement
const groupOf = (c: HTMLElement) => c.querySelector('g') as unknown as HTMLElement
const glyphOf = (c: HTMLElement, id = 'e-link') =>
  c.querySelector(`[data-edge-id="${id}"]`) as HTMLElement | null

beforeEach(() => {
  // Shuffled, with a decoy (CHURN) in the same row and cards in the rows above
  // and below — an implementation that does not look nodes up BY ID draws a
  // different path.
  mockStoreNodes = [OPTION, CHURN, MRR, RESIST, PRICE]
})

describe('same-row link, ADJACENT cards — straight between the facing sides', () => {
  it('price → resistance (target to the RIGHT): leaves the right side, enters the left side', () => {
    const { container } = renderLink(PRICE, RESIST)
    // Shared band 324..441 → y 382.5. From price's right face (324) to 4 short
    // of resistance's left face (356 − 4).
    expect(hitPathOf(container).getAttribute('d')).toBe('M324,382.5 L352,382.5')
    expect(groupOf(container).getAttribute('data-same-row-route')).toBe('side')
  })

  it('resistance → price (target to the LEFT): the mirror', () => {
    const { container } = renderLink(RESIST, PRICE)
    expect(hitPathOf(container).getAttribute('d')).toBe('M356,382.5 L328,382.5')
    expect(groupOf(container).getAttribute('data-same-row-route')).toBe('side')
  })

  it('the +/− glyph sits in the gutter above the arrowhead, not on the target card', () => {
    const { container } = renderLink(PRICE, RESIST)
    const glyph = glyphOf(container)
    expect(glyph, 'no polarity glyph rendered').not.toBeNull()
    // x = 356 − (4 + 12) = 340 (the gutter's middle); y = 382.5 − (10 + 4).
    expect(glyph!.style.transform).toMatch(/translate\(340px,\s*368\.5px\)/)
  })
})

describe('same-row link with a card BETWEEN — a shallow run under the row', () => {
  it('price → churn passes UNDER resistance and rises into churn from below', () => {
    const { container } = renderLink(PRICE, CHURN)
    // From price's bottom port (200, 441); run at 441 + 18; one card between,
    // so churn is entered a quarter-width in from its centre on the source side
    // (760 − 62), 4 below its bottom edge.
    expect(hitPathOf(container).getAttribute('d')).toBe(
      'M200,441 Q200,459 216,459 L682,459 Q698,459 698,445',
    )
    expect(groupOf(container).getAttribute('data-same-row-route')).toBe('under')
  })

  it('the glyph sits beside the rising lead, on the side away from the run', () => {
    const { container } = renderLink(PRICE, CHURN)
    // x = 698 + 14; y = 445 + 14.
    expect(glyphOf(container)!.style.transform).toMatch(/translate\(712px,\s*459px\)/)
  })
})

describe('CONTRAST — every other pair is untouched', () => {
  it('a cross-row DOWNWARD pair keeps the E9 near-straight curve, byte for byte', () => {
    const { container } = renderLink(PRICE, MRR)
    // (200, 447) → (480, 519): bend = max(6, min(30, 36)) = 30.
    expect(hitPathOf(container).getAttribute('d')).toBe('M200,447 C200,477 480,489 480,519')
    expect(groupOf(container).getAttribute('data-same-row-route')).toBeNull()
  })

  it('a cross-row UPWARD pair (no shared band) keeps xyflow\'s own bezier', () => {
    const { container } = renderLink(MRR, OPTION)
    expect(hitPathOf(container).getAttribute('d')).toBe('M0 0 L100 100')
    expect(groupOf(container).getAttribute('data-same-row-route')).toBeNull()
  })

  it('an UNMEASURED same-row pair is not guessed at — xyflow\'s bezier', () => {
    mockStoreNodes = [
      { id: 'price', position: PRICE.position },
      { id: 'resistance', position: RESIST.position },
    ]
    const { container } = renderLink(PRICE, RESIST)
    expect(hitPathOf(container).getAttribute('d')).toBe('M0 0 L100 100')
  })
})
