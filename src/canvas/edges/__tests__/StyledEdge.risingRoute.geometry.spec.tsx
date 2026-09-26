/**
 * ⭐⭐ AN UPWARD LINK IS NEVER A LOOP AND NEVER RUNS UNDER A CARD — THE WHOLE
 * PATH, EVERY OBSTACLE (canvas edge-drawing lane, 26 Sep 2026).
 *
 * Served `853feeb7`, the MRR draft (a real CEE draft graph): the risk → factor
 * link "AI feature value shortfall → Price sensitivity index" left the risk's
 * BOTTOM port and entered the factor's TOP handle. The target sits wholly
 * above the source, so xyflow's bezier drew an S-loop — 21.5px above the
 * target, 12.8px below the source, and under "Monthly Pro new subscribers".
 * The same shape bites every factor → factor link from a wrapped family's
 * second course into its first ("factor links in the same row are drawn as
 * loops", Paul 24 Sep).
 *
 * ⛔ THE WHOLE OBSTACLE (trap: a t = 0.5 probe on equal cards once passed a
 * route that pierced a taller middle card by 38.5px). The fixture is the
 * layout's brick courses with MIXED card heights; EVERY upward pair is drawn —
 * both directions, the full x-range, one row and two rows up — and the
 * RENDERED `d` (xyflow's real bezier, NOT mocked) is sampled along its whole
 * length against EVERY card's full box.
 *
 * Invariants, from the spec (bottom port / top shape grammar, "a short, direct,
 * readable connector, never a loop"), not from the fix:
 *   1 the path stays in the band BETWEEN the two cards — never above the
 *     target's bottom, never below the source's top (no loop, no arc over);
 *   2 it passes under NO card that is not its endpoint;
 *   3 it ends just below the target's bottom edge, inside its span.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'

type StoreNode = {
  id: string
  type?: string
  position: { x: number; y: number }
  measured?: { width: number; height: number }
}
let mockStoreNodes: StoreNode[] = []
const mockView: { viewMode: string; resultsStatus: string } = { viewMode: 'standard', resultsStatus: 'idle' }

// xyflow's path functions are NOT mocked: on a build without the route the
// real S-loop is what gets sampled.
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    useReactFlow: () => ({
      getNode: (id: string) => mockStoreNodes.find((n) => n.id === id) ?? null,
      getEdges: () => [],
      getNodes: () => [],
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

// ── Fixture: brick courses, mixed heights (248-wide cards, 32 gutter) ──────
const W = 248
const card = (id: string, x: number, y: number, h: number): StoreNode => ({
  id,
  position: { x, y },
  measured: { width: W, height: h },
})
// Row 1 (e.g. the family's first course): tops aligned at 300, heights vary.
const ROW1 = [card('a', 0, 300, 117), card('b', 280, 300, 160), card('c', 560, 300, 90), card('d', 840, 300, 140)]
// Row 2 (the second course, offset half a stride — a brick course).
const ROW2 = [card('e', 140, 489, 130), card('f', 420, 489, 100), card('g', 700, 489, 150)]
// Row 3 (e.g. risks) under both.
const ROW3 = [card('r1', 0, 687, 110), card('r2', 280, 687, 95), card('r3', 560, 687, 120), card('r4', 840, 687, 100)]
const ALL = [...ROW1, ...ROW2, ...ROW3]
const box = (n: StoreNode) => ({ x: n.position.x, y: n.position.y, w: W, h: n.measured!.height })

/** Every point of an absolute `M`/`L`/`C` path, sampled densely. */
function samplePath(d: string, perSegment = 400): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = []
  let cx = 0
  let cy = 0
  for (const m of d.matchAll(/([MLC])([^MLC]*)/g)) {
    const n = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number)
    if (m[1] === 'M') {
      cx = n[0]
      cy = n[1]
      pts.push({ x: cx, y: cy })
    } else if (m[1] === 'L') {
      for (let i = 1; i <= perSegment; i++) {
        const t = i / perSegment
        pts.push({ x: cx + (n[0] - cx) * t, y: cy + (n[1] - cy) * t })
      }
      cx = n[0]
      cy = n[1]
    } else {
      const [x1, y1, x2, y2, x, y] = n
      for (let i = 1; i <= perSegment; i++) {
        const t = i / perSegment
        const u = 1 - t
        pts.push({
          x: u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          y: u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        })
      }
      cx = x
      cy = y
    }
  }
  return pts
}

function renderUpward(src: StoreNode, tgt: StoreNode) {
  const s = box(src)
  const t = box(tgt)
  // xyflow's handles for a 12px handle centred on the border.
  return render(
    <StyledEdge
      {...({
        id: `e-${src.id}-${tgt.id}`,
        source: src.id,
        target: tgt.id,
        sourceX: s.x + W / 2,
        sourceY: s.y + s.h + 6,
        targetX: t.x + W / 2,
        targetY: t.y - 6,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        selected: false,
      } as any)}
      data={{ strength_mean: 0.5, effect_direction: 'positive', beliefExists: 0.8, beliefExistsSource: 'cee' } as any}
    />,
  )
}
const drawnPath = (c: HTMLElement) => (c.querySelector('path[stroke="transparent"]') as SVGPathElement).getAttribute('d') ?? ''

const upwardPairs: Array<[StoreNode, StoreNode]> = [
  ...ROW2.flatMap((s) => ROW1.map((t) => [s, t] as [StoreNode, StoreNode])),
  ...ROW3.flatMap((s) => ROW1.map((t) => [s, t] as [StoreNode, StoreNode])),
  ...ROW3.flatMap((s) => ROW2.map((t) => [s, t] as [StoreNode, StoreNode])),
]

beforeEach(() => {
  // Shuffled: a route that reads the wrong node draws a different path.
  mockStoreNodes = [...ALL].reverse()
})

describe('every UPWARD link — the whole rendered path against every card', () => {
  it('PRECONDITION: the fixture holds both directions, the full x-range, and mixed heights', () => {
    expect(upwardPairs.length).toBe(40)
    expect(upwardPairs.some(([s, t]) => t.position.x > s.position.x)).toBe(true)
    expect(upwardPairs.some(([s, t]) => t.position.x < s.position.x)).toBe(true)
    expect(new Set(ALL.map((n) => n.measured!.height)).size).toBeGreaterThan(8)
  })

  it.each(upwardPairs.map(([s, t]) => [s.id, t.id, s, t] as const))('%s → %s', (_sid, _tid, src, tgt) => {
    const { container, unmount } = renderUpward(src, tgt)
    const d = drawnPath(container)
    const pts = samplePath(d)
    expect(pts.length, `no path drawn: ${d}`).toBeGreaterThan(10)
    const s = box(src)
    const t = box(tgt)
    // 1 — no loop: the whole path stays between the target's bottom and the source's top.
    const minY = Math.min(...pts.map((p) => p.y))
    const maxY = Math.max(...pts.map((p) => p.y))
    expect(minY, `rises into/above the target (${d})`).toBeGreaterThanOrEqual(t.y + t.h - 0.5)
    expect(maxY, `drops below the source's top (${d})`).toBeLessThanOrEqual(s.y + 0.5)
    // 2 — under no card that is not an endpoint (full box, a graze counts).
    const under = ALL.filter((n) => n !== src && n !== tgt).filter((n) => {
      const b = box(n)
      return pts.some((p) => p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h)
    })
    expect(under.map((n) => n.id), `passes under non-endpoint cards (${d})`).toEqual([])
    // 3 — ends just below the target's bottom edge, inside its span.
    const end = pts[pts.length - 1]
    expect(end.y).toBeGreaterThan(t.y + t.h)
    expect(end.y).toBeLessThanOrEqual(t.y + t.h + 12)
    expect(end.x).toBeGreaterThan(t.x)
    expect(end.x).toBeLessThan(t.x + t.w)
    unmount()
  })
})

describe('CONTRAST — the pairs this lane does not reroute', () => {
  it('a DOWNWARD pair with nothing in the way keeps the E9 near-straight curve', () => {
    mockStoreNodes = [card('top', 0, 0, 100), card('bot', 0, 200, 100)]
    const { container } = renderUpward(mockStoreNodes[0], mockStoreNodes[1])
    // (124, 106) → (124, 194): bend = max(6, min(30, 44)) = 30.
    expect(drawnPath(container)).toBe('M124,106 C124,136 124,164 124,194')
    expect(container.querySelector('g')!.getAttribute('data-same-row-route')).toBeNull()
  })
})

/**
 * ⭐ A DOWNWARD LINK CLEARS A CARD OF A TIER BETWEEN ITS ENDS WHEN A LEAD CAN
 * (served MRR: "Pro plan price → MRR" ran under the risk card between the
 * factor row and the goal). The source's port or the target's handle stands
 * clear of the middle card's x-range, so a vertical lead beside the card can
 * carry the link past it. Mixed heights; the port LEFT and RIGHT of the card
 * (both directions); the goal's handle across the card's whole x-range.
 */
describe('a DOWNWARD link across a tier between its ends — the whole path against every card', () => {
  const typed = (n: StoreNode, type: string): StoreNode => ({ ...n, type })
  const F1 = typed(card('f1', 0, 300, 117), 'factor') //   port x 124 (left of the risk)
  const F2 = typed(card('f2', 280, 300, 160), 'factor') // port x 404 (over the risk)
  const F3 = typed(card('f3', 580, 300, 90), 'factor') //  port x 704 (right of the risk)
  const RISK = typed(card('risk', 300, 560, 110), 'risk') // x 300..548
  const goalAt = (x: number) => typed(card('goal', x, 800, 100), 'goal')
  function renderDown(src: StoreNode, tgt: StoreNode) {
    const s = box(src)
    const t = box(tgt)
    return render(
      <StyledEdge
        {...({
          id: `e-${src.id}-${tgt.id}`,
          source: src.id,
          target: tgt.id,
          sourceX: s.x + W / 2,
          sourceY: s.y + s.h + 6,
          targetX: t.x + W / 2,
          targetY: t.y - 6,
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          selected: false,
        } as any)}
        data={{ strength_mean: 0.5, effect_direction: 'positive', beliefExists: 0.8, beliefExistsSource: 'cee' } as any}
      />,
    )
  }
  // Goal handle x = goal.x + 124: 196, 304, 404, 524, 544 — outside, just inside
  // the left edge, the middle, near and just inside the right edge of the risk.
  const cases = [
    ...[72, 180, 280, 400, 420].flatMap((gx) => [F1, F3].map((f) => [f.id, gx, f, goalAt(gx)] as const)),
    // The port OVER the risk, the handle clear of it: only the lead-IN can clear.
    ...[40, 540].map((gx) => [F2.id, gx, F2, goalAt(gx)] as const),
  ]

  it.each(cases)('%s → goal at x %d', (_fid, _gx, src, goal) => {
    const board = [F1, F2, F3, RISK, goal]
    mockStoreNodes = [...board].reverse()
    const { container, unmount } = renderDown(src, goal)
    const d = drawnPath(container)
    const pts = samplePath(d)
    expect(pts.length, `no path drawn: ${d}`).toBeGreaterThan(10)
    const under = board.filter((n) => n !== src && n !== goal).filter((n) => {
      const b = box(n)
      return pts.some((p) => p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h)
    })
    expect(under.map((n) => n.id), `passes under non-endpoint cards (${d})`).toEqual([])
    unmount()
  })

  it('CONTRAST — port AND handle both over the risk: no lead can clear it, the path is the plain E9 curve as before', () => {
    const goal = goalAt(280)
    mockStoreNodes = [goal, RISK, F3, F2, F1]
    const { container } = renderDown(F2, goal)
    // (404, 466) → (404, 794): nothing a lead can clear → the unrouted curve.
    expect(drawnPath(container)).toBe('M404,466 C404,496 404,764 404,794')
  })
})
