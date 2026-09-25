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
// The label only paints after a run, in a non-standard view, on interaction
// (`edgeLabelVisibility.ts`); the label arm below switches these on.
let mockView: { viewMode: string; resultsStatus: string } = { viewMode: 'standard', resultsStatus: 'idle' }
// What `useReactFlow` reports — empty unless an arm feeds the label-placement
// pass (which reads edges and nodes through the instance, not the store).
let mockRf: { nodes: StoreNode[]; edges: Array<{ id: string; source: string; target: string; data?: unknown }> } = {
  nodes: [],
  edges: [],
}

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50, 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) => mockRf.nodes.find((n) => n.id === id) ?? null,
      getEdges: () => mockRf.edges,
      getNodes: () => mockRf.nodes,
    }),
    useStore: (selector: any) => selector({ nodes: mockStoreNodes, edges: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: mockView.resultsStatus, report: null },
      viewMode: mockView.viewMode,
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

function renderLink(src: StoreNode, tgt: StoreNode, id = 'e-link', selected = false) {
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
        selected,
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
  mockView = { viewMode: 'standard', resultsStatus: 'idle' }
  mockRf = { nodes: [], edges: [] }
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
    // From price's bottom port (200, 441), ONE arc (Paul 25 Sep: no flat run a
    // second span could share) into churn a quarter-width in from its centre on
    // the source side (760 − 62), 4 below its bottom edge. Both control points
    // sit straight below their ends: h = 18 + 0.06 × 498 = 47.88.
    expect(hitPathOf(container).getAttribute('d')).toBe('M200,441 C200,488.88 698,492.88 698,445')
    expect(groupOf(container).getAttribute('data-same-row-route')).toBe('under')
  })

  it('the glyph sits beside the rising lead, on the side away from the run', () => {
    const { container } = renderLink(PRICE, CHURN)
    // x = 698 + 14; y = 445 + 14.
    expect(glyphOf(container)!.style.transform).toMatch(/translate\(712px,\s*459px\)/)
  })
})

/**
 * The rendered position of the causal chip, read from the positioned ancestor
 * of `edge-influence-label` (bound by testid, not by a value predicate).
 */
function labelAnchorOf(c: HTMLElement): { x: number; y: number } {
  const label = c.querySelector('[data-testid="edge-influence-label"]') as HTMLElement | null
  expect(label, 'PRECONDITION: the causal label renders (selected, detailed view, after a run)').not.toBeNull()
  let el: HTMLElement | null = label
  while (el && !/translate\([-\d.]+px,\s*[-\d.]+px\)/.test(el.style.transform)) el = el.parentElement
  expect(el, 'PRECONDITION: the label has a positioned chip').not.toBeNull()
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el!.style.transform)!
  return { x: Number(m[1]), y: Number(m[2]) }
}

describe('the causal label sits ON the drawn path', () => {
  beforeEach(() => {
    mockView = { viewMode: 'detailed', resultsStatus: 'complete' }
  })

  it('under (price → churn): on the gutter run, not at the handle midpoint near the row', () => {
    const { container } = renderLink(PRICE, CHURN, 'e-link', true)
    expect(groupOf(container).getAttribute('data-same-row-route')).toBe('under')
    // Path 'M200,441 C200,488.88 698,492.88 698,445': its t = 0.5 point is
    // ((200 + 698) / 2, (441 + 445) / 2 + 0.75 × 47.88) = (449, 478.91).
    const at = labelAnchorOf(container)
    expect(at.y).toBeCloseTo(478.91, 2)
    expect(at.x).toBeCloseTo(449, 5)
    expect(at.x).toBeGreaterThanOrEqual(200)
    expect(at.x).toBeLessThanOrEqual(698)
    // CONTRAST: the handle midpoint ((200 + 760) / 2, (447 + 318) / 2) =
    // (480, 382.5) is on the row, over the middle card — where it used to sit.
    expect(Math.abs(at.y - 382.5)).toBeGreaterThan(60)
  })

  it('CONTRAST — side (price → resistance): unchanged, the handle midpoint, which is on the connector', () => {
    const { container } = renderLink(PRICE, RESIST, 'e-link', true)
    expect(groupOf(container).getAttribute('data-same-row-route')).toBe('side')
    // Handle midpoint ((200 + 480) / 2, (447 + 318) / 2) = (340, 382.5); the
    // connector runs at y 382.5 from x 324 to 352.
    const at = labelAnchorOf(container)
    expect(at).toEqual({ x: 340, y: 382.5 })
    expect(hitPathOf(container).getAttribute('d')).toBe('M324,382.5 L352,382.5')
  })
})

describe('the placement pass is fed the SAME anchor (a persistent chip)', () => {
  beforeEach(() => {
    mockView = { viewMode: 'detailed', resultsStatus: 'complete' }
  })

  it('under: the chip is placed from the gutter anchor — no dodge, no leader line off the middle card', () => {
    // One causal edge → it is a top-strength (persistent) chip, so the
    // placement pass runs. Its HANDLE midpoint (480, 382.5) lies inside the
    // middle card (resistance, x 356..604, y 324..441): placed from that basis
    // the chip would be dodged and a leader drawn back to the row. Placed from
    // the arc's midpoint anchor (449, 478.91) it is clear of every card.
    mockRf = {
      nodes: [OPTION, CHURN, MRR, RESIST, PRICE],
      edges: [{ id: 'e-link', source: 'price', target: 'churn', data: positive }],
    }
    const { container } = renderLink(PRICE, CHURN)
    expect(groupOf(container).getAttribute('data-same-row-route')).toBe('under')
    expect(labelAnchorOf(container)).toEqual({ x: 449, y: 478.91 })
    expect(container.querySelector('[data-testid="edge-label-leader"]')).toBeNull()
  })

  it("ANOTHER edge's under route: that edge's chip is seen in the GUTTER, not on the row", () => {
    // price → far routes UNDER a narrow card, so its chip paints in the gutter
    // (y 459). Its handle midpoint, (612, 382.5), is open row space — no card
    // there — so a pass fed that basis keeps a phantom chip ON the row.
    // Rendered: above → below, straight down through that same gap; its chip's
    // basis is (612, 400), which overlaps the phantom (±88, ±18) but not the
    // gutter chip. Placed against the chip where it really paints, it stays put.
    const NARROW = { id: 'narrow', position: { x: 356, y: 324 }, measured: { width: 74, height: H } }
    const FAR = card('far', 900, 324)
    const ABOVE = card('above', 488, 158)
    const BELOW = card('below', 488, 525)
    mockStoreNodes = [ABOVE, FAR, BELOW, NARROW, PRICE]
    mockRf = {
      nodes: [ABOVE, FAR, BELOW, NARROW, PRICE],
      edges: [
        { id: 'e-link', source: 'above', target: 'below', data: positive },
        { id: 'e-under', source: 'price', target: 'far', data: positive },
      ],
    }
    // PRECONDITION: the other edge really is an under route.
    const under = renderLink(PRICE, FAR, 'e-under')
    expect(groupOf(under.container).getAttribute('data-same-row-route')).toBe('under')
    under.unmount()

    const { container } = renderLink(ABOVE, BELOW)
    expect(labelAnchorOf(container)).toEqual({ x: 612, y: 400 })
    expect(container.querySelector('[data-testid="edge-label-leader"]')).toBeNull()
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
