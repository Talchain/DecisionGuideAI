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

export type SameRowRouteKind = 'side' | 'under' | 'rise'

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
 * ⭐⭐ AN UPWARD LINK RISES FROM ITS SOURCE'S TOP INTO ITS TARGET'S BOTTOM —
 * NEVER A LOOP (canvas edge-drawing lane, 26 Sep 2026).
 *
 * Every card has one out port (bottom centre) and one in handle (top centre).
 * When the target sits wholly ABOVE its source — a risk that drives a factor,
 * a factor in a wrapped family's second course driving one in the first — no
 * shared row band exists, so `resolveSameRowRoute` declines, and xyflow's
 * bottom → top bezier swung an S-loop: down below the source, back up BEHIND
 * the source and every card between, and over the target's top into its
 * handle. Measured on served `853feeb7` with the MRR draft (a real CEE draft
 * graph, seeded without a turn): the AI-feature-risk → price-sensitivity link
 * rose 21.5px above the target, curled 12.8px below the source and passed
 * under "Monthly Pro new subscribers".
 *
 * The route instead leaves the source's TOP border a quarter-width off centre
 * (clear of its in handle and kind mark), and rises into the target's BOTTOM a
 * quarter-width plus one glyph ring step off centre (clear of its out port, and
 * of an `under` route's entry into the same card), the arrow stopping
 * `SAME_ROW_TARGET_STANDOFF` short — the `under` route's own entry grammar.
 * Between them the contract's near-straight cubic (`bend = max(6, min(30,
 * Δy/2))`), with vertical leads exactly as long as needed to clear any card
 * in the way: a card in the TARGET's row band is cleared by starting the
 * lead-in below it; any other card by running the lead-out above it (the
 * mirror of `resolveLayeredEdgeLeads`).
 *
 * ⭐ THE WHOLE PATH IS CHECKED, leads included. The source port is tried at
 * its facing quarter, its far quarter, then the middle of each stretch of its
 * top border no card above covers (a brick course leaves a gap between two
 * cards: that is where a lead climbs); the target port at its facing then far
 * quarter. The first pair whose whole path is clear of every card wins,
 * otherwise the one touching fewest.
 */
/** Clearance kept between a rising lead's turn and the card it clears (flow units). */
export const RISE_LEAD_CLEARANCE = 10
/** A climbing lead keeps this far from the side of a card it passes (flow units). */
const RISE_PORT_MARGIN = 6
const RISE_SAMPLES = 64
const RISE_MAX_ROUNDS = 8

interface RiseGeometry {
  sx: number
  sy: number
  outY: number
  tx: number
  inY: number
  ty: number
}

function riseBend(outY: number, inY: number): number {
  return Math.max(6, Math.min(30, (outY - inY) / 2))
}

/** Points along the WHOLE rising path: lead-out, cubic, lead-in. */
function risePoints(g: RiseGeometry): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = []
  const b = riseBend(g.outY, g.inY)
  for (let i = 1; i <= RISE_SAMPLES; i++) {
    const t = i / RISE_SAMPLES
    pts.push({ x: g.sx, y: g.sy + (g.outY - g.sy) * t })
  }
  for (let i = 1; i < RISE_SAMPLES; i++) {
    const t = i / RISE_SAMPLES
    const u = 1 - t
    pts.push({
      x: u * u * u * g.sx + 3 * u * u * t * g.sx + 3 * u * t * t * g.tx + t * t * t * g.tx,
      y: u * u * u * g.outY + 3 * u * u * t * (g.outY - b) + 3 * u * t * t * (g.inY + b) + t * t * t * g.inY,
    })
  }
  for (let i = 0; i < RISE_SAMPLES; i++) {
    const t = i / RISE_SAMPLES
    pts.push({ x: g.tx, y: g.inY + (g.ty - g.inY) * t })
  }
  return pts
}

function insideBox(p: { x: number; y: number }, o: RouteBox): boolean {
  return p.x > o.x && p.x < o.x + o.width && p.y > o.y && p.y < o.y + o.height
}

/** The cards the whole path passes under (a graze on the full box counts). */
function riseHits(g: RiseGeometry, obstacles: readonly RouteBox[]): RouteBox[] {
  const pts = risePoints(g)
  return obstacles.filter((o) => pts.some((p) => insideBox(p, o)))
}

/** The first card the cubic (leads excluded) passes under, in path order. */
function riseCubicFirstHit(sx: number, outY: number, tx: number, inY: number, span: readonly RouteBox[]): RouteBox | null {
  const b = riseBend(outY, inY)
  for (let i = 1; i < RISE_SAMPLES; i++) {
    const t = i / RISE_SAMPLES
    const u = 1 - t
    const p = {
      x: u * u * u * sx + 3 * u * u * t * sx + 3 * u * t * t * tx + t * t * t * tx,
      y: u * u * u * outY + 3 * u * u * t * (outY - b) + 3 * u * t * t * (inY + b) + t * t * t * inY,
    }
    for (const o of span) if (insideBox(p, o)) return o
  }
  return null
}

function solveRise(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  target: RouteBox,
  obstacles: readonly RouteBox[],
): RiseGeometry {
  const inTargetRow = (o: RouteBox) => o.y < target.y + target.height && o.y + o.height > target.y
  const lo = Math.min(sx, tx)
  const hi = Math.max(sx, tx)
  const span = obstacles.filter((o) => o.x < hi && o.x + o.width > lo)
  let outY = sy
  let inY = ty
  for (let round = 0; round < RISE_MAX_ROUNDS; round++) {
    const hit = riseCubicFirstHit(sx, outY, tx, inY, span)
    if (!hit) return { sx, sy, outY, tx, inY, ty }
    if (inTargetRow(hit)) inY = Math.max(inY, hit.y + hit.height + RISE_LEAD_CLEARANCE)
    else outY = Math.min(outY, hit.y - RISE_LEAD_CLEARANCE)
    if (!(outY - inY > 12)) break
  }
  // THE GUARANTEE when the minimal search does not converge: run the lead-out
  // above EVERY non-target-row card the span holds and start the lead-in below
  // every target-row card. The cubic's control points stay inside
  // [inY, outY], so its whole curve does too, and every such card lies outside
  // that band.
  outY = sy
  inY = ty
  for (const o of span) {
    if (!(o.y < sy && o.y + o.height > ty)) continue
    if (inTargetRow(o)) inY = Math.max(inY, o.y + o.height + RISE_LEAD_CLEARANCE)
    else outY = Math.min(outY, o.y - RISE_LEAD_CLEARANCE)
  }
  if (!(outY > inY)) return { sx, sy, outY: sy, tx, inY: ty, ty }
  return { sx, sy, outY, tx, inY, ty }
}

/**
 * The rising route for `source → target`, or `null` unless the target lies
 * wholly above the source (its bottom above the source's top).
 */
export function resolveRisingRoute(
  source: RouteBox,
  target: RouteBox,
  others: readonly RouteBox[],
): SameRowRoute | null {
  const sTop = source.y
  const tBottom = target.y + target.height
  if (!(tBottom < sTop)) return null
  const sCentre = source.x + source.width / 2
  const tCentre = target.x + target.width / 2
  const dir: 1 | -1 = tCentre >= sCentre ? 1 : -1
  const inset = (w: number) => Math.max(0, Math.min(w / 2 - 12, w / 4))
  const obstacles = others.filter(
    (o) => o.id !== source.id && o.id !== target.id && o.y < sTop && o.y + o.height > tBottom,
  )
  const sy = r2(sTop)
  const ty = r2(tBottom + SAME_ROW_TARGET_STANDOFF)
  const inTargetRow = (o: RouteBox) => o.y < target.y + target.height && o.y + o.height > target.y
  // Source ports: the facing quarter, the far quarter, then the middle of each
  // stretch of the source's top border that no card above it covers — the gap
  // a brick course leaves between two cards is where a lead can climb.
  const sLo = source.x + 12
  const sHi = source.x + source.width - 12
  const facing = sCentre + dir * inset(source.width)
  const blockers = obstacles
    .filter((o) => !inTargetRow(o) && o.x < sHi && o.x + o.width > sLo)
    .map((o) => [o.x - RISE_PORT_MARGIN, o.x + o.width + RISE_PORT_MARGIN] as const)
    .sort((a, b) => a[0] - b[0])
  const gaps: number[] = []
  let cursor = sLo
  for (const [a, b] of blockers) {
    if (a > cursor) gaps.push((cursor + Math.min(a, sHi)) / 2)
    cursor = Math.max(cursor, b)
    if (cursor >= sHi) break
  }
  if (cursor < sHi && blockers.length > 0) gaps.push((cursor + sHi) / 2)
  gaps.sort((a, b) => Math.abs(a - facing) - Math.abs(b - facing))
  const sPorts = [facing, sCentre - dir * inset(source.width), ...gaps]
  // The target port sits ONE GLYPH RING STEP further out than the `under`
  // route's first entry (a quarter-width in): a rising link and an under-row
  // link into the same card from the same side never share a lead or a glyph.
  const tInset = Math.max(0, Math.min(target.width / 2 - 12, target.width / 4 + GLYPH_RING_STEP))
  const tPorts = [tCentre - dir * tInset, tCentre + dir * tInset]
  let best: { g: RiseGeometry; hits: number } | null = null
  // Facing quarters first (the short, direct connector), then the others.
  search: for (const sPort of sPorts) {
    for (const tPort of tPorts) {
      const g = solveRise(r2(sPort), sy, r2(tPort), ty, target, obstacles)
      const hits = riseHits(g, obstacles).length
      if (!best || hits < best.hits) best = { g, hits }
      if (hits === 0) break search
    }
  }
  const { g } = best!
  const side = g.tx >= g.sx ? 1 : -1
  const r = (n: number) => r2(n)
  const outY = r(g.outY)
  const inY = r(g.inY)
  const bend = r(riseBend(outY, inY))
  const path =
    (outY < g.sy ? `M${g.sx},${g.sy} L${g.sx},${outY} ` : `M${g.sx},${g.sy} `) +
    `C${g.sx},${r(outY - bend)} ${g.tx},${r(inY + bend)} ${g.tx},${inY}` +
    (inY > g.ty ? ` L${g.tx},${g.ty}` : '')
  const glyphSide = GLYPH_PAINTED_BOX_FLOW / 2 + GLYPH_BOX_GAP_FLOW
  return {
    kind: 'rise',
    path,
    // Beside the rising lead, on the side away from where the curve comes in.
    glyphX: r2(g.tx + side * glyphSide),
    glyphY: r2(g.ty + glyphSide),
    // The cubic's t = 0.5 point — on the drawn line (control points share
    // their end's x, and the bends cancel).
    labelAnchor: { x: r2((g.sx + g.tx) / 2), y: r2((outY + inY) / 2) },
  }
}

/**
 * The route a bottom-port → top-handle link takes when its target's top is at
 * or above its source's bottom: the same-row route, else the rising route,
 * else `null` (xyflow's own path).
 */
export function resolveCardEdgeRoute(
  source: RouteBox,
  target: RouteBox,
  others: readonly RouteBox[],
): SameRowRoute | null {
  return resolveSameRowRoute(source, target, others) ?? resolveRisingRoute(source, target, others)
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

/**
 * ⭐⭐ v3.1 WS1 #10 (26 Sep 2026): A LAYERED EDGE NEVER RUNS UNDER A CARD THAT
 * IS NOT ITS ENDPOINT — it leaves its row, and enters its target's row, by a
 * vertical lead exactly as deep as needed.
 *
 * The near-straight diagonal (`StyledEdge`, contract E9) started at its source
 * card's own bottom and ended at its target's own top. Two things put it under
 * cards that were not its endpoints — measured at the landing zoom, 11–21 edges
 * per starter against 1 of 17 on the prototype:
 *   · cards in one row are top-aligned with varying heights (v3.1 pt 13), so a
 *     short card's edge turned while still beside its taller neighbours;
 *   · a wrapped family (above four cards) has two courses, and an edge to or
 *     from the far course crossed the near one.
 * So: sample the diagonal; if it passes under a card of the SOURCE's tier, the
 * lead-out drops below that card; if under a card of the TARGET's tier, the
 * lead-in starts above it; repeat. The leads stay as short as the geometry
 * allows, so edges still fan out across the row gap rather than collapsing
 * into one horizontal run. With the layout's brick courses (`layout.ts`
 * `brickRowOffsets`) a vertical lead runs down the gap between two cards.
 *
 * `null` — the plain path — when nothing is in the way, for anything that is
 * not a downward edge between two different tiers, or when the endpoints are
 * unknown. Offsets are measured from the endpoints xyflow supplies, so the
 * handle geometry (the target handle on the kind shape) is carried through.
 */
export interface LayeredEdgeLeads {
  /** The y the vertical lead-out ends at (≥ the source point). */
  outY: number
  /** The y the vertical lead-in starts at (≤ the target point). */
  inY: number
}

/** Clearance kept between a lead's turn and the card it clears, in flow units. */
const LEAD_CLEARANCE = 10
/** A graze counts: the test is on the card's full box (probes that grade the
 *  result use a 3-unit inset, so this is strictly the stricter of the two). */
const LEAD_HIT_INSET = 0
const LEAD_SAMPLES = 64
const LEAD_MAX_ROUNDS = 8

function contractBend(outY: number, inY: number): number {
  return Math.max(6, Math.min(30, (inY - outY) / 2))
}

function cubicPoint(sx: number, outY: number, tx: number, inY: number, t: number): { x: number; y: number } {
  const b = contractBend(outY, inY)
  const u = 1 - t
  const x = u * u * u * sx + 3 * u * u * t * sx + 3 * u * t * t * tx + t * t * t * tx
  const y = u * u * u * outY + 3 * u * u * t * (outY + b) + 3 * u * t * t * (inY - b) + t * t * t * inY
  return { x, y }
}

function firstHit(
  sx: number,
  outY: number,
  tx: number,
  inY: number,
  obstacles: ReadonlyArray<RouteBox & { tier: number }>,
): (RouteBox & { tier: number }) | null {
  for (let i = 1; i < LEAD_SAMPLES; i++) {
    const p = cubicPoint(sx, outY, tx, inY, i / LEAD_SAMPLES)
    for (const b of obstacles) {
      if (
        p.x > b.x + LEAD_HIT_INSET && p.x < b.x + b.width - LEAD_HIT_INSET &&
        p.y > b.y + LEAD_HIT_INSET && p.y < b.y + b.height - LEAD_HIT_INSET
      ) return b
    }
  }
  return null
}

function spansX(b: RouteBox, x: number): boolean {
  return x > b.x && x < b.x + b.width
}

/** A vertical lead at `x` from `y0` to `y1` passes under no card but its ends'. */
function verticalClear(
  x: number,
  y0: number,
  y1: number,
  boxes: ReadonlyArray<RouteBox>,
  sourceId: string,
  targetId: string,
): boolean {
  const lo = Math.min(y0, y1)
  const hi = Math.max(y0, y1)
  return !boxes.some((b) => b.id !== sourceId && b.id !== targetId && spansX(b, x) && b.y < hi && b.y + b.height > lo)
}

export function resolveLayeredEdgeLeads(
  sourceId: string,
  targetId: string,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  boxes: ReadonlyArray<RouteBox & { tier: number }>,
): LayeredEdgeLeads | null {
  if (!(targetY > sourceY)) return null
  const src = boxes.find((b) => b.id === sourceId)
  const tgt = boxes.find((b) => b.id === targetId)
  if (!src || !tgt || src.tier >= tgt.tier) return null
  const left = Math.min(sourceX, targetX)
  const right = Math.max(sourceX, targetX)
  // Only cards the diagonal could reach: inside its bounding box, and in the
  // source's tier, the target's tier, or a tier between them. An intermediate
  // card is cleared only where a lead can run beside it (below); one no lead
  // can clear is dropped from the search, as before 26 Sep.
  const obstacles = boxes.filter(
    (b) =>
      b.id !== sourceId && b.id !== targetId &&
      b.tier >= src.tier && b.tier <= tgt.tier &&
      b.x < right && b.x + b.width > left &&
      b.y < targetY && b.y + b.height > sourceY,
  )
  if (obstacles.length === 0) return null
  let outY = sourceY
  let inY = targetY
  let clear = false
  let active = obstacles
  // A dropped card does not spend a round (`continue` below): `active` shrinks
  // each time, so the loop still ends.
  for (let round = 0; round < LEAD_MAX_ROUNDS; ) {
    const hit = firstHit(sourceX, outY, targetX, inY, active)
    if (!hit) {
      clear = true
      break
    }
    if (hit.tier === src.tier) outY = Math.max(outY, hit.y + hit.height + LEAD_CLEARANCE)
    else if (hit.tier === tgt.tier) inY = Math.min(inY, hit.y - LEAD_CLEARANCE)
    else {
      // ⭐ AN INTERMEDIATE-TIER CARD (26 Sep 2026 — served MRR: "Pro plan price
      // → MRR" ran under the risk card between them). A lead clears it only
      // when the lead itself runs beside it: drop the lead-out below it if the
      // source's port is clear of its x-range (and the drop crosses no card),
      // else start the lead-in above it if the target's handle is. Otherwise
      // no vertical lead can (that needs a detour, not a lead): the card leaves
      // the search, and the leads answer for the two end tiers exactly as
      // they did before.
      const below = hit.y + hit.height + LEAD_CLEARANCE
      const above = hit.y - LEAD_CLEARANCE
      if (!spansX(hit, sourceX) && verticalClear(sourceX, outY, below, boxes, sourceId, targetId)) outY = Math.max(outY, below)
      else if (!spansX(hit, targetX) && verticalClear(targetX, above, inY, boxes, sourceId, targetId)) inY = Math.min(inY, above)
      else {
        active = active.filter((b) => b !== hit)
        continue
      }
    }
    if (!(inY - outY > 12)) break
    round++
  }
  if (!clear) {
    // ⭐ THE GUARANTEE, when the minimal search does not converge: leave below
    // EVERY source-tier card the diagonal spans, enter above EVERY target-tier
    // card it spans. The cubic's x runs monotonically from source to target, so
    // no card of either tier inside that span can be reached.
    outY = sourceY
    inY = targetY
    for (const b of obstacles) {
      if (b.tier === src.tier && b.y + b.height > sourceY) outY = Math.max(outY, b.y + b.height + LEAD_CLEARANCE)
      if (b.tier === tgt.tier && b.y < targetY) inY = Math.min(inY, b.y - LEAD_CLEARANCE)
    }
    if (!(inY > outY)) return null
  }
  if (outY === sourceY && inY === targetY) return null
  return { outY, inY }
}

/**
 * The layered path with its leads: vertical, the contract's near-straight
 * cubic (`bend = max(6, min(30, Δy/2))`) across the gap, vertical. The label
 * anchor is the cubic's t = 0.5 point, which is on the drawn line.
 */
export function layeredLeadPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  leads: LayeredEdgeLeads,
): [string, number, number] {
  const { outY, inY } = leads
  const bend = contractBend(outY, inY)
  const path =
    `M${sourceX},${sourceY} L${sourceX},${outY} ` +
    `C${sourceX},${outY + bend} ${targetX},${inY - bend} ${targetX},${inY} ` +
    `L${targetX},${targetY}`
  return [path, (sourceX + targetX) / 2, (outY + inY) / 2]
}
