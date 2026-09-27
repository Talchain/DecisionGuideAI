/**
 * POLARITY-GLYPH PLACEMENT — one row above the arrival, one slot per edge.
 *
 * ⭐⭐ WHAT THE CONTRACT DRAWS (side-by-side DIFF item 4, 27 Sep 2026). Every
 * edge into a card ends at the card's kind-glyph apex, and each causal edge's
 * `+` / `−` stands in ONE ROW above that point
 * (`olumi-canvas-visual-contract-v31.html`, `renderEdges`:
 * `off = (seen − (count + 1) / 2) · 19`, `gx = bx + off ± 8`). Measured in
 * Chromium on the contract itself — each `.polarity` box centre against its own
 * path end: two arrivals at −17.5 / +17.5, three at −27 / +8 / +27, all 19 above
 * the arrival (the odd group's middle glyph drops to 12 there; see below).
 *
 * The rule this replaces placed each glyph along its OWN edge's approach — a
 * polar offset `dir · radius + perp · 8` from the target — which scattered a
 * target's glyphs 7–47 units above it and 69 wide, onto card corners and onto
 * other edges' strokes in a converging bundle (DIFF item 4, all five starters).
 *
 * ⭐ THE ROW, in GLYPH UNITS (screen px at glyph-scale 1, i.e. contract px):
 *   - every glyph `GLYPH_ROW_RISE` above the arrival point;
 *   - slot k of n at `(k − (n − 1) / 2) · GLYPH_ROW_PITCH`, pushed
 *     `GLYPH_ROW_CENTRE_CLEARANCE` further out from the arrival column (the
 *     middle slot of an odd row goes to +8, as the contract's does);
 *   - slots ordered by where each edge's SOURCE sits, left to right, so a glyph
 *     stands on the side its own line arrives from. That is how a reader tells
 *     which edge a sign belongs to once every line has converged on one point.
 *
 * ⚠ ONE DEPARTURE FROM THE CONTRACT, ON PURPOSE. The contract drops the odd
 * group's middle glyph to 12 above the arrival. At +8 across and 12 up it sits
 * inside the arrowhead of any line 3px or wider (the head is 4× the line,
 * `edgeArrowheadSize`), so here it stays in the row at 19. Even at 19 its box
 * corner meets a strong or very strong head; its halo keeps it legible there.
 *
 * ⭐ COUNTER-SCALED ON PAINT. `StyledEdge` multiplies the offset — never the
 * anchor — by `--canvas-glyph-scale` (`polarityGlyphTransform`), the scale the
 * arrowheads, kind glyphs and hit targets carry. The row is therefore the
 * contract's 19 px up and 19 px apart ON SCREEN at every zoom from the landing
 * floor to 1:1, beside heads that are the contract's size at the same zooms.
 *
 * ⭐ THE GUARANTEE, and why it is one: slot x is STRICTLY increasing in k (each
 * step adds a pitch; crossing the arrival column adds the clearance twice more),
 * every glyph shares one height, and each sibling takes its own k in ONE total
 * order (source x, then id) that every instance computes from the same store
 * snapshot. So two distinct edges into one target never share an offset — the
 * P0 this module exists for (21 of 21 stacks on the harness at `a1fd39cc`, with
 * `+` and `−` painted on one point). A keep-out shifts the whole row by whole
 * slots, which keeps the order, the height and the empty arrival column.
 *
 * ⚠ THE DEGRADED CASE IS SAFE BY CONSTRUCTION. If ANY sibling's source is
 * unresolvable, every instance sees the same gap in the same store and orders
 * the whole group by id alone — still one total order, still distinct slots.
 */
import { MAX_GLYPH_COUNTER_SCALE } from './zoomLegibility'

/** A sibling edge into the same target. `sourceCentre` is null when unresolvable. */
export interface GlyphSibling {
  id: string
  /** Centre of the edge's SOURCE node, in graph units. */
  sourceCentre: { x: number; y: number } | null
}

/** An offset from the target handle anchor, in GLYPH units (scaled on paint). */
export interface GlyphOffset {
  dx: number
  dy: number
}

/** How far above the arrival point the row stands — the contract's measured box centre. */
export const GLYPH_ROW_RISE = 19

/** The distance between neighbouring slots — the contract's `· 19`. */
export const GLYPH_ROW_PITCH = 19

/** How far every slot is pushed out of the arrival column — the contract's `± 8`. */
export const GLYPH_ROW_CENTRE_CLEARANCE = 8

/**
 * The glyph's painted box, in graph units AT THE COUNTER-SCALE BOUND (the 0.50
 * landing floor). Read by `sameRowRoute.ts` and by the keep-out test below.
 *
 * ⚠ Arithmetic, not a measurement: `typography.edgeLabel` is 11px × the text
 * counter-scale, and at the bound that line box is under 20 units; the ink of a
 * `+`/`−` is smaller still. Kept as found — it is the conservative figure.
 */
export const GLYPH_PAINTED_BOX_FLOW = 20

/**
 * The gap this canvas leaves between two marks so they read as separate — 4
 * graph units is 2px at the 0.50 park, one causal stroke width.
 */
export const GLYPH_BOX_GAP_FLOW = 4

/** One glyph box plus the gap. Read by `sameRowRoute.ts`. */
export const GLYPH_RING_STEP = GLYPH_PAINTED_BOX_FLOW + GLYPH_BOX_GAP_FLOW

/**
 * ⭐ v3.1 WS1 #28 (26 Sep 2026): a region the glyph must not be painted over —
 * the target row's band title ("OUTCOMES / RISKS" was overdrawn by a `+` at the
 * landing zoom). In GRAPH units at the counter-scale bound, relative to the
 * target handle anchor — the frame `tierLaneTitleBoxFor` returns
 * (`boxAtBound`), where the title is largest against the cards.
 */
export interface GlyphKeepOut {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** How many whole slots the keep-out may shift the row by before giving up. */
const KEEP_OUT_MAX_SHIFT = 8

/**
 * The x of slot `j` in a row of `n`, in glyph units. Defined for every integer
 * `j` (a keep-out shift reads slots past either end); strictly increasing in j.
 */
export function glyphRowSlotX(j: number, n: number): number {
  const off = (j - (n - 1) / 2) * GLYPH_ROW_PITCH
  return off + (off >= 0 ? GLYPH_ROW_CENTRE_CLEARANCE : -GLYPH_ROW_CENTRE_CLEARANCE)
}

/** Does a glyph at (x, y) glyph units, painted at the bound, touch `k`? */
function hitsAtBound(x: number, y: number, k: GlyphKeepOut): boolean {
  const half = GLYPH_PAINTED_BOX_FLOW / 2 + GLYPH_BOX_GAP_FLOW
  const cx = x * MAX_GLYPH_COUNTER_SCALE
  const cy = y * MAX_GLYPH_COUNTER_SCALE
  return cx + half > k.x0 && cx - half < k.x1 && cy + half > k.y0 && cy - half < k.y1
}

/** The smallest rightward whole-slot shift that clears `keepOut` for the whole row. */
function rowShift(n: number, keepOut: GlyphKeepOut): number {
  for (let s = 0; s <= KEEP_OUT_MAX_SHIFT; s++) {
    let clear = true
    for (let k = 0; k < n && clear; k++) {
      if (hitsAtBound(glyphRowSlotX(k + s, n), -GLYPH_ROW_RISE, keepOut)) clear = false
    }
    if (clear) return s
  }
  return 0
}

const resolvable = (s: GlyphSibling): boolean =>
  s.sourceCentre !== null && Number.isFinite(s.sourceCentre.x)

/**
 * Where this edge's polarity glyph sits, as an offset from the TARGET HANDLE
 * ANCHOR (`targetX`/`targetY`), in glyph units — `StyledEdge` scales it on paint
 * (`polarityGlyphTransform`).
 *
 * `siblings` is every edge sharing this target, INCLUDING the one asking (and,
 * as in the contract's own count, edges whose glyph is not drawn, so a slot does
 * not move when a neighbour's glyph appears). Order is irrelevant: the function
 * sorts. `targetCentre` is the basis the approach side is read against.
 */
export function resolvePolarityGlyphOffset(
  edgeId: string,
  targetCentre: { x: number; y: number },
  siblings: GlyphSibling[],
  keepOut?: GlyphKeepOut,
): GlyphOffset {
  const byGeometry = siblings.every(resolvable)
  const ordered = [...siblings].sort((a, b) => {
    if (byGeometry) {
      const ax = a.sourceCentre!.x - targetCentre.x
      const bx = b.sourceCentre!.x - targetCentre.x
      if (ax !== bx) return ax - bx
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  let k = ordered.findIndex((s) => s.id === edgeId)
  let n = ordered.length
  // An edge absent from its own sibling list is a caller bug (`StyledEdge`
  // inserts itself). Give it a slot past the listed ones rather than throw
  // inside a render: a crudely placed glyph beats a canvas taken down.
  if (k === -1) {
    k = n
    n += 1
  }
  const shift = keepOut ? rowShift(n, keepOut) : 0
  return { dx: glyphRowSlotX(k + shift, n), dy: -GLYPH_ROW_RISE }
}

/**
 * The glyph's CSS transform: centred on the target handle anchor plus the
 * offset × `--canvas-glyph-scale`. The ANCHOR is a graph position and is never
 * scaled; only the offset is, so the row keeps its screen size at every zoom.
 */
export function polarityGlyphTransform(targetX: number, targetY: number, offset: GlyphOffset): string {
  // The var name is written literally (it is `CANVAS_GLYPH_SCALE_VAR`): the
  // css-var census guard (`tests/ci-guards/css-var-resolution.spec.ts`)
  // resolves literal names and counts every interpolated one as a new site.
  const scale = 'var(--canvas-glyph-scale, 1)'
  return (
    `translate(-50%, -50%) translate(` +
    `calc(${targetX}px + ${offset.dx}px * ${scale}), ` +
    `calc(${targetY}px + ${offset.dy}px * ${scale}))`
  )
}
