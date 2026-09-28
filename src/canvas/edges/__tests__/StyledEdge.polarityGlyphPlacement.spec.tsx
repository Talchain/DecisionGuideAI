/**
 * ⭐⭐⭐ P0 — THE POLARITY GLYPH MUST NOT PAINT ON TOP OF ANOTHER POLARITY GLYPH.
 *
 * MEASURED ON DEPLOYED `a1fd39cc` and reproduced on the geometry harness: 14
 * glyphs at 5 distinct positions on `vendor-selection`, 18 at 6 on
 * `market-entry`, 44 of 71 glyphs across the five starters painted underneath
 * another glyph — and 13 of the 27 sites held BOTH a `+` and a `−`.
 *
 * ⛔ WHY THIS IS A TRUST DEFECT AND NOT CLUTTER. `directionStroke.ts:23-32`
 * carries the measurement: this palette separates WORSE than green/red for a
 * dichromat (ΔE2000 11.7 vs 28.3 under deuteranopia), so the +/− SHAPE, not the
 * hue, is what carries polarity for a red-green dichromat. Where two glyphs
 * stack, the visible mark is whichever painted last — arbitrary. Where they
 * disagree in sign, the canvas states the OPPOSITE of the model, confidently,
 * on the one channel that exists for readers who cannot use the colour.
 *
 * ⚠ WHY THIS SUITE CAN SEE WHAT EVERY EXISTING ONE COULD NOT. The collapse is a
 * property of a SET of edges. Every existing glyph spec renders exactly ONE
 * `StyledEdge`, and one glyph can never be observed stacking on another — the
 * corpus structurally excluded the only shape that breaks it (CLAUDE.md trap
 * 22). Nothing here needs geometry jsdom cannot do: the defect is that the
 * `transform` STRINGS are byte-identical, and jsdom reads those exactly.
 *
 * ⚠ AND THE FIXTURE IS FAITHFUL, WHICH IS THE LOAD-BEARING PART. Handing every
 * edge the SAME `targetX`/`targetY` is not a convenience — it is what React
 * Flow does. `targetX/targetY` come from
 * `getHandlePosition(targetNode, targetHandle, targetPosition)`
 * (`@xyflow/system@0.0.76` `dist/esm/index.mjs:1420-1438`), a pure function of
 * the target node and its handle that takes NO EDGE INPUT. Every edge into one
 * node therefore receives byte-identical values, and a fixture that varied them
 * would be testing a wire that does not exist (trap 16-inverse: a fixture you
 * wrote yourself is not evidence about the producer).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { GLYPH_ROW_RISE } from '../../utils/edgeGlyphPlacement'

interface MockNode {
  id: string
  type?: string
  position: { x: number; y: number }
  measured?: { width: number; height: number }
  data?: Record<string, unknown>
}
interface MockEdge {
  id: string
  source: string
  target: string
  data?: Record<string, unknown>
}

let mockNodes: MockNode[] = []
let mockEdges: MockEdge[] = []

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (nodeId: string) => mockNodes.find((n) => n.id === nodeId) ?? null,
      getEdges: () => mockEdges,
      getNodes: () => mockNodes,
    }),
    // The real store slice this component's placement selector reads.
    useStore: (selector: any) => selector({ nodes: mockNodes, edges: mockEdges }),
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
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: (_: any, props: any) => props,
}))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

const TARGET = 'goal'
/** The one target handle anchor React Flow hands EVERY edge into `goal`. */
const TARGET_XY = { targetX: 900, targetY: 400 }

/** Sources arranged around the target, as a real converging fan is. */
function buildFan(n: number, signs: Array<'positive' | 'negative'>): void {
  mockNodes = [{ id: TARGET, type: 'factor', position: { x: 800, y: 360 }, measured: { width: 200, height: 80 } }]
  mockEdges = []
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * (i + 1)) / (n + 1) + Math.PI / 2
    mockNodes.push({
      id: `s${i}`,
      type: 'factor',
      position: { x: 900 + Math.cos(a) * 400 - 100, y: 400 + Math.sin(a) * 400 - 40 },
      measured: { width: 200, height: 80 },
    })
    mockEdges.push({
      id: `e-${String(i).padStart(2, '0')}`,
      source: `s${i}`,
      target: TARGET,
      data: { strength_mean: 0.6, effect_direction: signs[i % signs.length], exists_probability: 0.8 },
    })
  }
}

function renderFan(): Array<{ id: string; sign: string; transform: string }> {
  const out: Array<{ id: string; sign: string; transform: string }> = []
  for (const e of mockEdges) {
    const { container } = render(
      <StyledEdge
        {...({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceX: 0,
          sourceY: 0,
          ...TARGET_XY,
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          selected: false,
          data: e.data,
        } as any)}
      />
    )
    // Bound by IDENTITY (`data-edge-id`), never by portal order — CLAUDE.md
    // trap 19. `EdgeLabelRenderer` flattens every edge's children into one
    // layer, so the Nth glyph is not the Nth edge as soon as one is suppressed.
    const el = container.querySelector(`[data-edge-id="${e.id}"][aria-label^="Effect direction:"]`) as HTMLElement | null
    expect(el, `no glyph rendered for ${e.id} — this suite cannot observe a stack without one`).not.toBeNull()
    out.push({
      id: e.id,
      sign: el!.getAttribute('aria-label')!.replace('Effect direction: ', ''),
      transform: el!.style.transform,
    })
  }
  return out
}

beforeEach(() => {
  mockNodes = []
  mockEdges = []
})

/** Sources ABOVE the target at the given horizontal offsets from it. */
function buildRow(sources: Array<{ id: string; dx: number }>): void {
  mockNodes = [{ id: TARGET, type: 'factor', position: { x: 800, y: 360 }, measured: { width: 200, height: 80 } }]
  mockEdges = []
  for (const s of sources) {
    mockNodes.push({
      id: `src-${s.id}`,
      type: 'factor',
      position: { x: 900 + s.dx - 100, y: 0 },
      measured: { width: 200, height: 80 },
    })
    mockEdges.push({
      id: s.id,
      source: `src-${s.id}`,
      target: TARGET,
      data: { strength_mean: 0.6, effect_direction: 'positive', exists_probability: 0.8 },
    })
  }
}

/**
 * The glyph's anchor and its counter-scaled offset, read back from the
 * transform. The offset is multiplied by `--canvas-glyph-scale` so the row is
 * the contract's size on screen at every zoom; the anchor is not.
 */
// ⚠ RE-PINNED 27 Sep 2026 (code-review F1): the y term now bounds the RISE in
// flow units — `max(<dy>px * var(…), -<bound>px)` — so the row stays inside the
// tier gap at the landing. The old pattern matched only the unbounded form,
// which was the defect. The captured groups (anchor and offset) are unchanged.
const GLYPH_TRANSFORM =
  /translate\(calc\((-?[\d.]+)px \+ (-?[\d.]+)px \* var\(--canvas-glyph-scale, 1\)\), calc\((-?[\d.]+)px \+ max\((-?[\d.]+)px \* var\(--canvas-glyph-scale, 1\), -[\d.]+px\)\)\)\s*$/
function parseGlyph(transform: string): { x: number; y: number; dx: number; dy: number } {
  const m = transform.match(GLYPH_TRANSFORM)
  expect(m, `glyph transform is not a counter-scaled offset from the target anchor: ${transform}`).not.toBeNull()
  return { x: Number(m![1]), dx: Number(m![2]), y: Number(m![3]), dy: Number(m![4]) }
}


describe('P0: polarity glyphs on edges sharing a target never coincide', () => {
  it.each([2, 3, 4, 6])(
    'THE DEFECT — %i edges converging on one node paint at %i DISTINCT transforms',
    (n) => {
      buildFan(n, ['positive', 'negative'])
      const glyphs = renderFan()

      // POSITIVE CONTROL: a run that renders fewer than two glyphs cannot
      // observe a stack, so its "no duplicates" result would be vacuous.
      expect(glyphs.length, 'fewer than two glyphs — the assertion below is vacuous').toBe(n)

      const transforms = glyphs.map((g) => g.transform)
      const dupes = transforms.filter((t, i) => transforms.indexOf(t) !== i)
      expect(
        dupes,
        `glyphs stacked. ${glyphs.map((g) => `${g.id}(${g.sign})=${g.transform}`).join(' | ')}`,
      ).toEqual([])
      expect(new Set(transforms).size).toBe(n)
    },
  )

  it('THE HARM, NAMED: no two glyphs of OPPOSITE sign share a transform', () => {
    // The specific state that makes this a trust defect rather than a tidiness
    // one: where a `+` and a `−` coincide, the visible mark is arbitrary and
    // may be the opposite of the model's own direction.
    buildFan(4, ['positive', 'negative'])
    const glyphs = renderFan()
    expect(new Set(glyphs.map((g) => g.sign)).size, 'corpus carries only one sign — cannot see the harm').toBe(2)

    const bySite = new Map<string, Set<string>>()
    for (const g of glyphs) {
      if (!bySite.has(g.transform)) bySite.set(g.transform, new Set())
      bySite.get(g.transform)!.add(g.sign)
    }
    const contradictory = [...bySite.entries()].filter(([, s]) => s.size > 1)
    expect(contradictory.map(([t]) => t), 'a + and a − painted at the same point').toEqual([])
  })

  /**
   * ⭐ THE ATTRIBUTION HALF OF THE REMEDY, WHICH DISTINCTNESS ALONE DOES NOT
   * COVER. Distinct-but-arbitrary is not the fix — a reader has to be able to
   * tell which edge a `+` belongs to.
   *
   * ⭐ contract v3.1 (27 Sep 2026, side-by-side DIFF item 4): the glyphs of every
   * edge into one target stand in ONE row 19 above the arrival point, 19 apart,
   * centred on it — measured on the contract in Chromium: −17.5 / +17.5 for two
   * arrivals, −27 / +8 / +27 for three. A glyph belongs to the edge on its SIDE:
   * the row is ordered by where each edge's source sits, left to right. The
   * superseded rule scattered them along each edge's own approach (a polar
   * offset), which put them on card corners and on other edges' strokes.
   */
  it('ONE ROW: every glyph into a target is 19 above the arrival, in approach order, at the contract slots', () => {
    // Four sources above the target, deliberately listed with ids OUT of their
    // left-to-right order, so id order and approach order disagree.
    buildRow([
      { id: 'e-a', dx: 260 },
      { id: 'e-b', dx: -420 },
      { id: 'e-c', dx: 40 },
      { id: 'e-d', dx: -150 },
    ])
    const glyphs = renderFan()
    expect(glyphs.length, 'fewer than four glyphs — the row cannot be observed').toBe(4)
    const at = Object.fromEntries(glyphs.map((g) => [g.id, parseGlyph(g.transform)]))
    // Bound by IDENTITY: each edge id to the slot its own source's side earns.
    expect(at['e-b']).toEqual({ x: TARGET_XY.targetX, y: TARGET_XY.targetY, dx: -36.5, dy: -19 })
    expect(at['e-d']).toEqual({ x: TARGET_XY.targetX, y: TARGET_XY.targetY, dx: -17.5, dy: -19 })
    expect(at['e-c']).toEqual({ x: TARGET_XY.targetX, y: TARGET_XY.targetY, dx: 17.5, dy: -19 })
    expect(at['e-a']).toEqual({ x: TARGET_XY.targetX, y: TARGET_XY.targetY, dx: 36.5, dy: -19 })
    expect(GLYPH_ROW_RISE).toBe(19)
  })

  /**
   * ⭐ A RENDERING EDGE THE STORE SLICE HAS NOT CAUGHT UP WITH. `StyledEdge`
   * inserts itself into its own sibling list if the slice omits it; without
   * that, every such edge takes the resolver's caller-bug path and they all
   * share one offset — the original defect, reached through a different door.
   * The mutant that removes the insertion SURVIVED until this case existed,
   * because the fixture above always lists every edge it renders.
   */
  it('two edges missing from the store slice still get distinct offsets', () => {
    buildFan(3, ['positive', 'negative'])
    const rendered = [...mockEdges]
    // The slice lags: it knows about the first edge only.
    mockEdges = [rendered[0]]
    const seen: string[] = []
    for (const e of rendered.slice(1)) {
      const { container } = render(
        <StyledEdge
          {...({
            id: e.id, source: e.source, target: e.target,
            sourceX: 0, sourceY: 0, ...TARGET_XY,
            sourcePosition: Position.Bottom, targetPosition: Position.Top,
            selected: false, data: e.data,
          } as any)}
        />
      )
      const el = container.querySelector(`[data-edge-id="${e.id}"][aria-label^="Effect direction:"]`) as HTMLElement | null
      expect(el, `no glyph for ${e.id}`).not.toBeNull()
      seen.push(el!.style.transform)
    }
    expect(seen.length, 'fewer than two glyphs — vacuous').toBe(2)
    expect(new Set(seen).size, `edges absent from the slice stacked: ${seen.join(' | ')}`).toBe(2)
  })

  it('the transform still resolves to a real point near the shared target anchor', () => {
    // Distinctness bought by flinging glyphs across the canvas would be no fix.
    buildFan(4, ['positive'])
    for (const g of renderFan()) {
      const p = parseGlyph(g.transform)
      expect(p.x).toBe(TARGET_XY.targetX)
      expect(p.y).toBe(TARGET_XY.targetY)
      const d = Math.hypot(p.dx, p.dy)
      expect(d, `${g.id} sits ${Math.round(d)} units from its target anchor`).toBeLessThanOrEqual(120)
      expect(d).toBeGreaterThan(0)
    }
  })
})
