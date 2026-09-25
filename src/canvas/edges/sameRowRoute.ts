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
/** Corner radius of the `under` run. */
export const UNDER_ROW_CORNER = 16

const r2 = (n: number) => Math.round(n * 100) / 100

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
  const low = r2(lowest + UNDER_ROW_DIP + (k - 1) * UNDER_ROW_STEP)
  const sx = r2(source.x + source.width / 2)
  const tCentre = target.x + target.width / 2
  const inset = Math.min(target.width / 2 - 12, target.width / 4 + (k - 1) * GLYPH_RING_STEP)
  const tx = r2(tCentre - dir * inset)
  const ty = r2(tBottom + SAME_ROW_TARGET_STANDOFF)
  const r = Math.min(UNDER_ROW_CORNER, Math.abs(tx - sx) / 2)
  const glyphSide = GLYPH_PAINTED_BOX_FLOW / 2 + GLYPH_BOX_GAP_FLOW
  return {
    kind: 'under',
    path:
      `M${sx},${sBottom} Q${sx},${low} ${r2(sx + dir * r)},${low} ` +
      `L${r2(tx - dir * r)},${low} Q${tx},${low} ${tx},${ty}`,
    // Beside the rising lead, on the side away from the run.
    glyphX: r2(tx + dir * glyphSide),
    glyphY: r2(ty + glyphSide),
    // The midpoint of the horizontal gutter run: `(sx + tx) / 2` is the centre
    // of the straight segment between the two corners, at the run's depth.
    labelAnchor: { x: r2((sx + tx) / 2), y: low },
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
