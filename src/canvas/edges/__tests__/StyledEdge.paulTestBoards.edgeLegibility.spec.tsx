/**
 * ⭐⭐ EDGE LEGIBILITY ON PAUL'S TWO STAGING MODELS (28 Sep 2026) — the three
 * defects he reported, each bound by EDGE ID on the board he saw it on, through
 * the real `StyledEdge` (every edge rendered on its own, as React Flow mounts
 * them, against one store snapshot of the whole laid-out board).
 *
 *   A. `tech_lead`: six links enter the goal `productivity`; they all ended at
 *      the goal's one handle, six arrowheads on one point and their signs in
 *      one unreadable row. → each link now ends at its OWN point on the card's
 *      top, in the left-to-right order of its source, a pitch apart.
 *   B. `pa_vs_ai`: a `+` stood ~65px from the link into "Assistant coordination
 *      overhead", beside the band word, on no line. → every sign's centre is
 *      within 6 flow units of its OWN link's drawn path.
 *   C. `pa_vs_ai`: 4 options × 3 factors drew a web of grey links. → an option
 *      → factor link rests at the canvas's dim, and returns to full while its
 *      option or factor is hovered or selected; question → option links do not.
 *
 * ## What is real here
 * - LAYOUT: the repo's own `layoutGraph` on the two boards
 *   (`__helpers__/paulTestBoards.ts`; card heights per kind stated in the
 *   fixture's provenance — these boards were not captured in a browser).
 * - HANDLES: xyflow's handle points as `BaseNode` places them at the 1280-wide
 *   landing, measured in Chromium (`LANDING_ENDS`: port 5.02 below the card,
 *   target handle 26.36 above it), and the store's zoom at the landing (0.5).
 * - PATH and SIGN: whatever `StyledEdge` draws — the `d` it hands `BaseEdge`
 *   and the sign's own `transform`. The transform is read in BOTH the grammar
 *   this change replaced (a counter-scaled offset, evaluated at the landing's
 *   glyph scale 2) and the one it introduced (a flow point), so this suite runs
 *   unchanged against the code before the fix, which is how its RED was taken.
 *
 * ## What is not
 * No paint: jsdom has no layout. Distances are graph (flow) units at the
 * landing; a browser witness on the served build is a separate rung.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge, EDGE_SELECTION_DIM_OPACITY } from '../StyledEdge'
import { flattenSvgPath } from '../fragileCuePlacement'
import { layOutBoard, isStructuralPair, LANDING_ENDS, distanceToPolyline, type LaidBoard } from './__helpers__/paulTestBoards'
import { useCanvasNodeHoverStore } from '../../stores/canvasNodeHoverStore'
import { tierLaneTitleBoxFor } from '../../utils/tierLanes'

interface StoreNode { id: string; type?: string; position: { x: number; y: number }; measured?: { width: number; height: number }; data?: Record<string, unknown> }
interface StoreEdge { id: string; source: string; target: string; data?: Record<string, unknown> }

let mockNodes: StoreNode[] = []
let mockEdges: StoreEdge[] = []
let mockSelectedNodeIds = new Set<string>()
/** The landing zoom (1280-wide viewport): the glyph counter-scale is 2 there. */
const LANDING_ZOOM = 0.5

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ id, path }: { id: string; path: string }) => <path data-testid="base-edge" data-edge={id} d={path} />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    useReactFlow: () => ({
      getNode: (nodeId: string) => mockNodes.find((n) => n.id === nodeId) ?? null,
      getEdges: () => mockEdges,
      getNodes: () => mockNodes,
    }),
    useStore: (selector: any) => selector({ nodes: mockNodes, edges: mockEdges, transform: [0, 0, LANDING_ZOOM] }),
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
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      selection: { nodeIds: mockSelectedNodeIds, edgeIds: new Set<string>() },
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
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))

const BOARDS: Record<string, LaidBoard> = {}
beforeAll(async () => {
  BOARDS.pa_vs_ai = await layOutBoard('pa_vs_ai')
  BOARDS.tech_lead = await layOutBoard('tech_lead')
})

function seedBoard(b: LaidBoard): void {
  mockNodes = b.nodes.map((n) => ({
    id: n.id,
    type: n.type as string,
    position: n.position,
    measured: { width: n.measured!.width!, height: n.measured!.height! },
    data: { label: (n.data as { label: string }).label, kind: n.type },
  }))
  mockEdges = b.raw.edges.map((e) => ({
    id: e.id,
    source: e.s,
    target: e.t,
    data: { strength_mean: e.m, effect_direction: e.dir, exists_probability: 0.8 },
  }))
}

beforeEach(() => {
  mockSelectedNodeIds = new Set<string>()
  useCanvasNodeHoverStore.setState({ hoveredNodeId: null })
})
afterEach(() => cleanup())

/** xyflow's handle points for an edge, at the landing: bottom-centre port, top-centre target handle. */
function handles(b: LaidBoard, e: StoreEdge) {
  const s = b.box(e.source)
  const t = b.box(e.target)
  return {
    sourceX: s.x + s.width / 2,
    sourceY: s.y + s.height + LANDING_ENDS.sourceDy,
    targetX: t.x + t.width / 2,
    targetY: t.y + LANDING_ENDS.targetDy,
  }
}

function renderEdge(b: LaidBoard, e: StoreEdge) {
  return render(
    <svg>
      <StyledEdge
        {...({
          id: e.id,
          source: e.source,
          target: e.target,
          ...handles(b, e),
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          selected: false,
          data: e.data,
        } as any)}
      />
    </svg>,
  )
}

/**
 * The sign's centre in flow units, from its transform — either grammar:
 *   before: `translate(calc(Xpx + DXpx * var(--canvas-glyph-scale, 1)), calc(Ypx + max(DYpx * var(…), -Bpx)))`
 *   after:  `translate(Xpx, Ypx)`
 */
function glyphCentre(transform: string, glyphScale: number): { x: number; y: number } {
  const plain = transform.match(/translate\(-50%, -50%\) translate\((-?[\d.]+)px, (-?[\d.]+)px\)\s*$/)
  if (plain) return { x: Number(plain[1]), y: Number(plain[2]) }
  const old = transform.match(
    /translate\(calc\((-?[\d.]+)px \+ (-?[\d.]+)px \* var\(--canvas-glyph-scale, 1\)\), calc\((-?[\d.]+)px \+ max\((-?[\d.]+)px \* var\(--canvas-glyph-scale, 1\), (-?[\d.]+)px\)\)\)\s*$/,
  )
  if (old) {
    return { x: Number(old[1]) + Number(old[2]) * glyphScale, y: Number(old[3]) + Math.max(Number(old[4]) * glyphScale, Number(old[5])) }
  }
  const route = transform.match(/translate\(-50%, -50%\) translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/)
  if (route) return { x: Number(route[1]), y: Number(route[2]) }
  throw new Error(`unreadable glyph transform: ${transform}`)
}

interface Drawn { id: string; source: string; target: string; d: string; end: { x: number; y: number }; glyph: { x: number; y: number } | null; offPath: number | null }

/** Every edge of the board, drawn one at a time: its path, its end, its sign's centre and that centre's distance to its OWN path. */
function drawBoard(b: LaidBoard): Drawn[] {
  seedBoard(b)
  const out: Drawn[] = []
  for (const e of mockEdges) {
    const { container } = renderEdge(b, e)
    const d = container.querySelector(`[data-testid="base-edge"][data-edge="${e.id}"]`)!.getAttribute('d')!
    const poly = flattenSvgPath(d)!
    const el = container.querySelector(`[data-edge-id="${e.id}"][aria-label^="Effect direction:"]`) as HTMLElement | null
    const glyph = el ? glyphCentre(el.style.transform, 1 / LANDING_ZOOM) : null
    out.push({
      id: e.id,
      source: e.source,
      target: e.target,
      d,
      end: poly.points[poly.points.length - 1],
      glyph,
      offPath: glyph ? distanceToPolyline(glyph, poly.points) : null,
    })
    cleanup()
  }
  return out
}

const r1 = (v: number) => Math.round(v * 10) / 10

describe('B — every sign sits on its OWN link (≤ 6 flow units from its drawn path)', () => {
  it.each(['pa_vs_ai', 'tech_lead'])('%s', (name) => {
    const b = BOARDS[name]
    const drawn = drawBoard(b)
    const signed = drawn.filter((x) => x.glyph !== null)
    // PRECONDITION: every causal link carries a sign, and no structural one does.
    const causal = b.raw.edges.filter((e) => !isStructuralPair(b.kindOf(e.s), b.kindOf(e.t))).map((e) => e.id).sort()
    expect(signed.map((x) => x.id).sort()).toEqual(causal)
    const off = Object.fromEntries(signed.map((x) => [x.id, r1(x.offPath!)]))
    const bad = Object.entries(off).filter(([, v]) => v > 6)
    expect(bad, `signs off their own link (flow units): ${JSON.stringify(off)}`).toEqual([])
  })

  it('pa_vs_ai e-17 — the `+` into "Assistant coordination overhead" is on its own line, within one head and one sign of its arrowhead', () => {
    const b = BOARDS.pa_vs_ai
    const e17 = drawBoard(b).find((x) => x.id === 'e-17')!
    expect(e17.source).toBe('human_assistant_capacity')
    expect(e17.target).toBe('assistant_coordination_overhead')
    expect(e17.offPath!).toBeLessThanOrEqual(6)
    // The widest head (40) + the mark gap (4) + a box (20) at the landing bound.
    expect(Math.hypot(e17.glyph!.x - e17.end.x, e17.glyph!.y - e17.end.y)).toBeLessThanOrEqual(64)
  })
})

describe('A — links arriving at one card spread along its top, in their sources\' order', () => {
  /** The ends of every link entering `target` from a card wholly above it, left to right by source x. */
  function arrivals(b: LaidBoard, drawn: Drawn[], target: string) {
    const t = b.box(target)
    return drawn
      .filter((x) => x.target === target)
      .filter((x) => {
        const s = b.box(x.source)
        return s.y + s.height < t.y
      })
      .sort((p, q) => b.centre(p.source).x - b.centre(q.source).x || (p.id < q.id ? -1 : 1))
  }

  it('tech_lead — the six links into the goal `productivity` end at six points, a pitch apart, left to right by source', () => {
    const b = BOARDS.tech_lead
    const into = arrivals(b, drawBoard(b), 'productivity')
    expect(into.map((x) => x.id).sort()).toEqual(['e-0-a', 'e-13', 'e-14', 'e-17', 'e-19', 'e-20'])
    const xs = into.map((x) => r1(x.end.x))
    expect(new Set(xs).size, `ends: ${JSON.stringify(into.map((x) => [x.id, xs[into.indexOf(x)]]))}`).toBe(6)
    // Ordered by source, so no two cross at the card: strictly increasing.
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1], `${into[i - 1].id} → ${into[i].id}`).toBeGreaterThanOrEqual(40)
    // Every end is ON the card's top side (the border, or the kind apex for an odd group's middle).
    const goal = b.box('productivity')
    for (const x of into) {
      expect(x.end.x, x.id).toBeGreaterThan(goal.x)
      expect(x.end.x, x.id).toBeLessThan(goal.x + goal.width)
      expect(x.end.y, x.id).toBeGreaterThanOrEqual(goal.y + LANDING_ENDS.targetDy - 0.01)
      expect(x.end.y, x.id).toBeLessThanOrEqual(goal.y + 0.01)
    }
  })

  it('tech_lead — the goal\'s six signs are six distinct marks, each nearer its own arrowhead than any other', () => {
    const b = BOARDS.tech_lead
    const into = arrivals(b, drawBoard(b), 'productivity')
    for (const x of into) {
      const own = Math.hypot(x.glyph!.x - x.end.x, x.glyph!.y - x.end.y)
      for (const y of into) {
        if (y.id === x.id) continue
        expect(own, `${x.id}'s sign is nearer ${y.id}'s arrowhead`).toBeLessThan(Math.hypot(x.glyph!.x - y.end.x, x.glyph!.y - y.end.y))
      }
    }
  })

  it('every card with several arrivals, on both boards (outcomes and risks too): distinct ends in source order', () => {
    let multi = 0
    for (const name of ['pa_vs_ai', 'tech_lead']) {
      const b = BOARDS[name]
      const drawn = drawBoard(b)
      for (const t of b.routeBoxes) {
        const into = arrivals(b, drawn, t.id)
        if (into.length < 2) continue
        multi++
        const xs = into.map((x) => x.end.x)
        for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1], `${name} ${t.id}: ${into[i - 1].id} → ${into[i].id}`).toBeGreaterThan(0)
      }
    }
    // Non-vacuity: the goal, delegation_quality, the four factors of pa_vs_ai, …
    expect(multi).toBeGreaterThanOrEqual(6)
  })

  it('a card with ONE arriving link keeps it on the kind apex (xyflow\'s handle), unchanged', () => {
    const b = BOARDS.pa_vs_ai
    const drawn = drawBoard(b)
    const e19 = drawn.find((x) => x.id === 'e-19')!
    const t = b.box('ai_output_error_risk')
    expect(arrivals(b, drawn, t.id).map((x) => x.id)).toEqual(['e-19'])
    expect(e19.end.x).toBeCloseTo(t.x + t.width / 2, 6)
    expect(e19.end.y).toBeCloseTo(t.y + LANDING_ENDS.targetDy, 6)
  })

  it('pa_vs_ai — where the row\'s band word covers a card\'s apex, every link arriving from above lands past the word, inside the card', () => {
    const b = BOARDS.pa_vs_ai
    const drawn = drawBoard(b)
    // DERIVED, not named: which card stands under "OUTCOMES / RISKS" is the
    // layout's answer, and the consequence row's order is re-seated by its
    // links (utils/layout.ts, orderConsequenceRowsByUpstream).
    const under = b.nodes
      .filter((n) => n.type === 'outcome' || n.type === 'risk')
      .map((n) => ({ n, t: b.box(n.id), title: tierLaneTitleBoxFor(b.nodes, n.id) }))
      .filter(({ t, title }) => title && title.x0 < t.x + t.width / 2 && title.x1 > t.x + t.width / 2)
    // PRECONDITION (non-vacuity): exactly one consequence card has the word over its apex,
    // and at least one link arrives at it from above.
    expect(under.map(({ n }) => n.id)).toHaveLength(1)
    const { t, title } = under[0]!
    const into = arrivals(b, drawn, t.id)
    expect(into.length).toBeGreaterThanOrEqual(1)
    for (const a of into) {
      expect(a.end.x, a.id).toBeGreaterThan(title!.x1)
      expect(a.end.x, a.id).toBeLessThanOrEqual(t.x + t.width)
    }
  })
})

describe('C — option → factor links rest at low emphasis; an endpoint hovered or selected restores them', () => {
  const OPTION_FACTOR = ['e-4', 'e-5', 'e-6', 'e-7', 'e-8', 'e-9', 'e-10', 'e-11', 'e-12', 'e-13', 'e-14', 'e-15']
  const QUESTION_OPTION = ['e-0', 'e-1', 'e-2', 'e-3']
  function restState(id: string) {
    const b = BOARDS.pa_vs_ai
    seedBoard(b)
    const e = mockEdges.find((x) => x.id === id)!
    const { container } = renderEdge(b, e)
    // The wrapping group xyflow's hover handlers hang on: the one carrying the edge's hitbox.
    const hit = container.querySelector('path[stroke="transparent"]')!
    const g = hit.parentElement as unknown as SVGGElement
    const out = { rest: g.getAttribute('data-option-link-rest'), opacity: (g as unknown as HTMLElement).style.opacity, pointer: (hit as unknown as HTMLElement).style.pointerEvents }
    cleanup()
    return out
  }

  it('pa_vs_ai — each of the 12 option → factor links rests at the canvas dim, still hit-testable', () => {
    for (const id of OPTION_FACTOR) {
      const s = restState(id)
      expect(s.rest, id).toBe('true')
      expect(Number(s.opacity), id).toBe(EDGE_SELECTION_DIM_OPACITY)
      expect(s.pointer, id).toBe('stroke')
    }
  })

  it('pa_vs_ai — question → option links and causal links are NOT dimmed at rest', () => {
    for (const id of [...QUESTION_OPTION, 'e-16', 'e-17', 'e-20', 'e-25']) {
      const s = restState(id)
      expect(s.rest, id).toBeNull()
      expect(s.opacity, id).toBe('')
    }
  })

  it('hovering the OPTION restores its three links, and only those', () => {
    act(() => useCanvasNodeHoverStore.setState({ hoveredNodeId: 'personal_assistant' }))
    for (const id of ['e-4', 'e-5', 'e-6']) expect(restState(id).rest, id).toBeNull()
    for (const id of ['e-7', 'e-10', 'e-13']) expect(restState(id).rest, id).toBe('true')
  })

  it('hovering a FACTOR restores the four links into it', () => {
    act(() => useCanvasNodeHoverStore.setState({ hoveredNodeId: 'ai_assistant_use' }))
    for (const id of ['e-5', 'e-8', 'e-11', 'e-14']) expect(restState(id).rest, id).toBeNull()
    for (const id of ['e-4', 'e-9']) expect(restState(id).rest, id).toBe('true')
  })

  it('selecting the option or a factor restores them too', () => {
    mockSelectedNodeIds = new Set(['ai_assistant'])
    for (const id of ['e-7', 'e-8', 'e-9']) expect(restState(id).rest, id).toBeNull()
    expect(restState('e-4').rest).toBe('true')
    mockSelectedNodeIds = new Set(['annual_assistant_tool_cost'])
    for (const id of ['e-6', 'e-9', 'e-12', 'e-15']) expect(restState(id).rest, id).toBeNull()
    expect(restState('e-5').rest).toBe('true')
  })
})
