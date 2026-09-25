/**
 * ⭐ A SAME-ROW LINK IS ROUTED BETWEEN THE CARDS, NEVER LOOPED ROUND THEM
 * (canvas polish #1, 24 Sep 2026).
 *
 * Every card has ONE out port (bottom centre) and ONE in handle (top centre).
 * For two cards in the SAME row the target's top lies ABOVE the source's
 * bottom, so the bottom → top bezier swung a tall loop under the source and
 * back over the target — across the target's "Needs input" tab, with the +/−
 * glyph floating on the card's top edge. Paul's staging screenshots: the single
 * ugliest thing on the board.
 *
 * The visual contract (v3.1 `renderEdges`) only draws bottom → top and its
 * fixture holds no same-row link, so it is SILENT here. This takes the
 * least-intrusive route that never passes over another card:
 *
 *   `side`   ADJACENT cards — a straight connector between their FACING sides,
 *            at the middle of the vertical band the two cards share. It starts
 *            on the source's border (the card paints above the edge layer) and
 *            stops `SAME_ROW_TARGET_STANDOFF` short of the target's.
 *   `under`  a card stands BETWEEN them — a shallow run in the gutter UNDER the
 *            row, from the source's bottom port, rising into the target's
 *            bottom a quarter-width in from its centre (clear of the target's
 *            own out port). A straight side connector here would pass BEHIND
 *            the middle card and read as two links through it: a relationship
 *            the model does not hold.
 *
 * ⚠ WHAT DOES NOT CHANGE. Stroke colour, dash, width and the arrowhead are the
 * edge's own; only the geometry moves. Any pair that is not same-row — or whose
 * card sizes are not yet measured — gets `null`, and the caller keeps its
 * existing path.
 *
 * ⭐ THE LABEL ANCHOR FOLLOWS THE DRAWN PATH (`labelAnchor`). For `side` the
 * handle midpoint already lies on the connector for row-mates, so `labelAnchor`
 * is `null` and the caller keeps that basis unchanged. For `under` the handle
 * midpoint sits near the source card's vertical centre — ON the row, ~60 units
 * above the run — so the causal chip, its leader line and the placement pass
 * use the midpoint of the gutter run instead. The placement pass is fed the
 * SAME anchor (`PlacementEdge.anchor`), so the chip's dodge is computed from
 * where the chip actually sits.
 *
 * ⚠ GLYPHS STAY DISTINCT. Only the adjacent card on each side can take the
 * `side` route into a target. Two `under` routes into one target from the same
 * side have different numbers of cards between them, and each extra card moves
 * the entry one glyph ring step outward and the run one step deeper — so
 * neither the leads nor the glyphs coincide.
 */
import { GLYPH_BOX_GAP_FLOW, GLYPH_PAINTED_BOX_FLOW, GLYPH_RING_STEP } from '../utils/edgeGlyphPlacement'
import { EDGE_ARROWHEAD_FLOW_LENGTH } from './edgePresentation'

/** A card's box in graph units. */
export interface RouteBox {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export type SameRowRouteKind = 'side' | 'under'

export interface SameRowRoute {
  kind: SameRowRouteKind
  /** SVG path `d`. */
  path: string
  /** Absolute centre of the +/− glyph for this route. */
  glyphX: number
  glyphY: number
  /**
   * Where the causal label is anchored, ON the drawn path — or `null` to keep
   * the handle midpoint (`side`, where that midpoint is already on the line).
   */
  labelAnchor: { x: number; y: number } | null
}

/** Gap between the arrow tip and the target's border — the canvas's mark gap. */
export const SAME_ROW_TARGET_STANDOFF = GLYPH_BOX_GAP_FLOW
/** Two cards share a row only if their vertical extents overlap by this much. */
export const SAME_ROW_MIN_OVERLAP = 24
/** How far below the row's lowest card the `under` run travels. Inside the
 *  29-unit sub-row gap (`LAYOUT_LAYER_GAP` × 0.6), so it never reaches a card
 *  in the next sub-row. */
export const UNDER_ROW_DIP = 18
/** Extra depth per additional card between the pair. */
export const UNDER_ROW_STEP = 8
/** Corner radius of the `under` run (kept for importers; the route is an arc now). */
export const UNDER_ROW_CORNER = 16
/** Extra arc depth per graph unit of horizontal span, so longer links sit lower. */
export const UNDER_ARC_PER_UNIT = 0.06
/** Minimum clearance between the arc and any card it passes (graph units). */
export const UNDER_ROW_CLEARANCE = 8

const r2 = (n: number) => Math.round(n * 100) / 100

/** Parameter resolution for `underArcClearanceH`'s solve — fine enough that
 *  discretisation error is far below `UNDER_ROW_CLEARANCE`; the margin below
 *  covers what falls between samples. */
const UNDER_ARC_CLEARANCE_SAMPLES = 2000
/** Safety margin folded into the solved depth, covering the gap between
 *  sampled parameter values (the true worst point can fall between two of
 *  them). Small next to `UNDER_ROW_CLEARANCE` (8). */
const UNDER_ARC_CLEARANCE_MARGIN = 1

/**
 * The smallest control-point depth `h` (each control point sits `h` straight
 * below its own end) that keeps the under arc's y at or below `targetY` at
 * every sampled point whose x falls inside one of `between`'s spans.
 *
 * Both control points share their end's x, so x(t) is the standard smoothstep
 * ease and the cubic's y at parameter t decomposes as:
 *   y(t) = [smoothstep blend of sy, ty] + 3·t·(1−t)·h
 * the same identity the arc's `labelAnchor` already relies on at t = 0.5
 * (0.75·h there). The second term is the only place h enters, is zero at the
 * ends, and is non-negative and strictly increasing in h at every interior
 * t — so solving h from the sample with the largest requirement clears every
 * other sample too; no search needed.
 */
function underArcClearanceH(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  between: readonly RouteBox[],
  targetY: number,
): number {
  let need = 0
  for (let s = 1; s < UNDER_ARC_CLEARANCE_SAMPLES; s++) {
    const t = s / UNDER_ARC_CLEARANCE_SAMPLES
    const u = 1 - t
    const easeS = u * u * (1 + 2 * t)
    const easeT = t * t * (3 - 2 * t)
    const x = sx * easeS + tx * easeT
    if (!between.some((o) => x >= o.x && x <= o.x + o.width)) continue
    const bump = 3 * t * u
    if (bump <= 1e-9) continue
    const baseline = sy * easeS + ty * easeT
    const h = (targetY + UNDER_ARC_CLEARANCE_MARGIN - baseline) / bump
    if (h > need) need = h
  }
  return need
}

/**
 * The same-row route for `source → target`, or `null` when the pair is not in
 * one row (no shared vertical band) or overlaps horizontally.
 *
 * `others` is every other visible card; only those standing between the pair
 * within the row's band matter.
 */
export function resolveSameRowRoute(
  source: RouteBox,
  target: RouteBox,
  others: readonly RouteBox[],
): SameRowRoute | null {
  const sTop = source.y
  const sBottom = source.y + source.height
  const tTop = target.y
  const tBottom = target.y + target.height
  const bandTop = Math.max(sTop, tTop)
  const bandBottom = Math.min(sBottom, tBottom)
  if (bandBottom - bandTop < SAME_ROW_MIN_OVERLAP) return null

  const sRight = source.x + source.width
  const tRight = target.x + target.width
  // `dir` = +1 when the target is to the right of the source.
  let dir: 1 | -1
  if (sRight <= target.x) dir = 1
  else if (tRight <= source.x) dir = -1
  else return null

  const sFace = dir === 1 ? sRight : source.x
  const tFace = dir === 1 ? target.x : tRight
  const gapLo = Math.min(sFace, tFace)
  const gapHi = Math.max(sFace, tFace)
  const rowTop = Math.min(sTop, tTop)
  const rowBottom = Math.max(sBottom, tBottom)
  const between = others.filter(
    (o) =>
      o.id !== source.id &&
      o.id !== target.id &&
      o.x < gapHi &&
      o.x + o.width > gapLo &&
      o.y < rowBottom &&
      o.y + o.height > rowTop,
  )

  if (between.length === 0) {
    const y = r2((bandTop + bandBottom) / 2)
    const endX = tFace - dir * SAME_ROW_TARGET_STANDOFF
    return {
      kind: 'side',
      path: `M${sFace},${y} L${endX},${y}`,
      // In the gutter, just behind the arrowhead, clear above the line.
      glyphX: r2(endX - dir * EDGE_ARROWHEAD_FLOW_LENGTH),
      glyphY: r2(y - (GLYPH_PAINTED_BOX_FLOW / 2 + GLYPH_BOX_GAP_FLOW)),
      labelAnchor: null,
    }
  }

  const k = between.length
  const lowest = Math.max(rowBottom, ...between.map((o) => o.y + o.height))
  const sx = r2(source.x + source.width / 2)
  const tCentre = target.x + target.width / 2
  const inset = Math.min(target.width / 2 - 12, target.width / 4 + (k - 1) * GLYPH_RING_STEP)
  const tx = r2(tCentre - dir * inset)
  const ty = r2(tBottom + SAME_ROW_TARGET_STANDOFF)
  // ⭐ ONE ARC, NEVER A FLAT RUN (Paul's 25 Sep screenshots: two spans that
  // overlap by one card drew their flat runs on top of each other for a whole
  // card slot and read as one cable). A cubic from the source's port to the
  // target's bottom, with both control points straight below their ends, dips
  // `0.75·h` below its ends at its midpoint. Two arcs with different ends can
  // only CROSS at a point, never share a segment. `h` grows with the span, so
  // longer links sit lower, and grows again per card between them.
  const base = Math.max(sBottom, ty)
  const spanX = Math.abs(tx - sx)
  const wanted = UNDER_ROW_DIP + UNDER_ARC_PER_UNIT * spanX + (k - 1) * UNDER_ROW_STEP
  // Clear every between card across its WHOLE x-range, not only at the arc's
  // midpoint (review 2033: a taller between card climbed back inside the arc
  // before and after t = 0.5, since the control points only guarantee depth
  // there).
  const hClear = underArcClearanceH(sx, sBottom, tx, ty, between, lowest + UNDER_ROW_CLEARANCE)
  // ...and never reach a card in the next sub-row under the span.
  const spanLo = Math.min(sx, tx)
  const spanHi = Math.max(sx, tx)
  const belowTops = others
    .filter((o) => o.y >= rowBottom && o.x < spanHi && o.x + o.width > spanLo)
    .map((o) => o.y)
  const hRoom = belowTops.length > 0 ? (Math.min(...belowTops) - UNDER_ROW_CLEARANCE - base) / 0.75 : Infinity
  const h = r2(Math.max(hClear, Math.min(wanted, hRoom)))
  const glyphSide = GLYPH_PAINTED_BOX_FLOW / 2 + GLYPH_BOX_GAP_FLOW
  return {
    kind: 'under',
    path: `M${sx},${sBottom} C${sx},${r2(sBottom + h)} ${tx},${r2(ty + h)} ${tx},${ty}`,
    // Beside the rising lead, on the side away from the arc.
    glyphX: r2(tx + dir * glyphSide),
    glyphY: r2(ty + glyphSide),
    // The arc's own midpoint (t = 0.5): x is the ends' mean because each control
    // point shares its end's x; y is the ends' mean plus 0.75·h.
    labelAnchor: { x: r2((sx + tx) / 2), y: r2((sBottom + ty) / 2 + 0.75 * h) },
  }
}

/**
 * A store node's box, or `null` when its size is not measured yet — a route
 * is never drawn from a guessed size.
 */
export function routeBoxOf(n: {
  id: string
  position?: { x: number; y: number }
  measured?: { width?: number; height?: number }
  width?: number
  height?: number
  internals?: { positionAbsolute?: { x: number; y: number } }
}): RouteBox | null {
  const pos = n.internals?.positionAbsolute ?? n.position
  const width = n.measured?.width ?? n.width
  const height = n.measured?.height ?? n.height
  if (!pos || typeof width !== 'number' || typeof height !== 'number') return null
  return { id: n.id, x: pos.x, y: pos.y, width, height }
}
