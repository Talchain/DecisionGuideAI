/**
 * ⭐ THE FRAGILE-EDGE CUE SITS AT ITS CONNECTION'S MIDPOINT (post-run DIFF item
 * 12, 27 Sep 2026; contract v3.1 `renderEdges`: `cx=(ax+bx)/2, cy=(ay+by)/2`,
 * one neutral r=8 disc per fragile connection).
 *
 * ── WHAT IT REPLACES ─────────────────────────────────────────────────────────
 *
 * The cue disc rode the edge-LABEL placement: the label anchor (for a layered
 * edge with leads, the t = 0.5 point of the short cubic between the leads,
 * which on a long lead sits just above the TARGET) moved by the label resolver,
 * which clears a 240-wide strength-chip box — 22× the disc's width. Measured on
 * `mrr-90b8f080` at landing: "Pro plan price → MRR" is a 468-unit vertical lead
 * and a 26-unit cubic into the Goal, so the disc painted ON the Goal card beside
 * its arrival glyphs (0.95 of the way along the connection), not mid-edge.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────
 *
 *   · The cue sits on the drawn path at HALF ITS ARC LENGTH.
 *   · If the disc there would touch a card, the row of sign glyphs above a card,
 *     or another cue, it slides ALONG ITS OWN PATH to the nearest clear point,
 *     never further than a quarter of the path either way — so it can never
 *     reach an arrival (or a departure). With no clear point in that window it
 *     stays at the midpoint and says so (`clear: false`): the contract's place,
 *     not a guess further away.
 *   · Sizes are GRAPH units at the counter-scale BOUND (the landing floor), the
 *     conservative figure the label resolver and the glyph keep-out use too: the
 *     disc is `FRAGILE_CUE_DISC_PX × MAX_LABEL_COUNTER_SCALE` across and the
 *     glyph row stands `GLYPH_ROW_RISE × MAX_GLYPH_COUNTER_SCALE` above a card's
 *     ARRIVAL POINT, across the row's own span (`arrivalGlyphRowSpan`).
 *   · Paths are rebuilt from the card boxes by the helpers `StyledEdge` draws
 *     with (`cardEdgePathFromBoxes`), from the handle points xyflow gives: the
 *     offsets are read off the asking edge's own endpoints.
 *   · One deterministic pass for every cue on the canvas, in id order, from the
 *     same store snapshot — each edge takes its own answer, as the label and
 *     glyph resolvers do.
 *
 * ⚠ THE BUDGET IS NOT DECIDED HERE. Which connections carry a cue — every
 * fragile one in Detailed, the single top one in Standard — is `StyledEdge`'s
 * membership rule, unchanged: "Paul's 2026-07-11 verdict E4" as recorded in
 * a2255511 (#277), "the SINGLE most fragile relationship … badges in the
 * standard view too, so the top flip risk is on the map by default without
 * clutter; Detailed view still badges every fragile edge". The pass places
 * however many cues that rule admits, so widening the budget is a one-line
 * membership change, not a placement one.
 */
import { MAX_GLYPH_COUNTER_SCALE, MAX_LABEL_COUNTER_SCALE } from '../utils/zoomLegibility'
import {
  GLYPH_BOX_GAP_FLOW,
  GLYPH_PAINTED_BOX_FLOW,
  GLYPH_ROW_RISE,
  resolvePolarityGlyphOffset,
  type GlyphKeepOut,
} from '../utils/edgeGlyphPlacement'
import { KIND_GLYPH_PX } from '../utils/nodeLayoutConstants'
import {
  contractLayeredPath,
  layeredLeadPath,
  resolveCardEdgeRoute,
  resolveLayeredEdgeLeads,
  type RouteBox,
} from './sameRowRoute'

/** The cue disc's diameter in DECLARED px — the contract's `<circle r="8">`. */
export const FRAGILE_CUE_DISC_PX = 16

/** The disc's radius in graph units at the counter-scale bound. */
export const FRAGILE_CUE_RADIUS_FLOW = (FRAGILE_CUE_DISC_PX / 2) * MAX_LABEL_COUNTER_SCALE

/** The gap a cue keeps from a card, a glyph row and another cue — the canvas's mark gap. */
export const FRAGILE_CUE_CLEARANCE_FLOW = GLYPH_BOX_GAP_FLOW

/**
 * How far above a card's top its arrival glyph row reaches, at the bound: the
 * row's centre (`GLYPH_ROW_RISE`, scaled) plus half a painted glyph box.
 */
export const GLYPH_ROW_BAND_FLOW = GLYPH_ROW_RISE * MAX_GLYPH_COUNTER_SCALE + GLYPH_PAINTED_BOX_FLOW / 2

/** The search step, as a fraction of the path's length. */
const SLIDE_STEP = 0.01
/** The furthest a cue may slide from the midpoint, as a fraction of the length. */
export const FRAGILE_CUE_MAX_SLIDE = 0.25

/** Segments per curve when a path is flattened for its arc length. */
const CURVE_SEGMENTS = 48

export interface PathPolyline {
  points: ReadonlyArray<{ x: number; y: number }>
  /** Cumulative length at each point (`cumulative[0] === 0`). */
  cumulative: readonly number[]
  length: number
}

const TOKEN = /[MLCQHVZmlcqhvz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g

/**
 * An SVG path `d` flattened to a polyline with its cumulative arc length — or
 * `null` for a command this canvas never draws (arcs), an empty path or a
 * malformed one. Covers what the edge paths use: M, L, H, V, C, Q, Z, absolute
 * or relative, comma- or space-separated (xyflow and `sameRowRoute` alike).
 */
export function flattenSvgPath(d: string | null | undefined): PathPolyline | null {
  if (typeof d !== 'string') return null
  const tokens = d.match(TOKEN)
  if (!tokens || tokens.length === 0) return null
  const points: Array<{ x: number; y: number }> = []
  let i = 0
  let cmd = ''
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  const num = (): number | null => {
    const t = tokens[i]
    if (t === undefined || /^[A-Za-z]$/.test(t)) return null
    i++
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  const push = (px: number, py: number) => points.push({ x: px, y: py })
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) {
      cmd = tokens[i]
      i++
      if (cmd === 'Z' || cmd === 'z') {
        x = startX
        y = startY
        push(x, y)
        continue
      }
    } else if (cmd === '') {
      return null
    }
    const rel = cmd === cmd.toLowerCase()
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    switch (cmd.toUpperCase()) {
      case 'M': {
        const a = num(), b = num()
        if (a === null || b === null) return null
        x = ox + a
        y = oy + b
        startX = x
        startY = y
        push(x, y)
        // Implicit coordinate pairs after a moveto are linetos.
        cmd = rel ? 'l' : 'L'
        break
      }
      case 'L': {
        const a = num(), b = num()
        if (a === null || b === null) return null
        x = ox + a
        y = oy + b
        push(x, y)
        break
      }
      case 'H': {
        const a = num()
        if (a === null) return null
        x = ox + a
        push(x, y)
        break
      }
      case 'V': {
        const b = num()
        if (b === null) return null
        y = oy + b
        push(x, y)
        break
      }
      case 'C': {
        const v = [num(), num(), num(), num(), num(), num()]
        if (v.some((n) => n === null)) return null
        const [x1, y1, x2, y2, x3, y3] = v as number[]
        const p0x = x, p0y = y
        const c1x = ox + x1, c1y = oy + y1, c2x = ox + x2, c2y = oy + y2, ex = ox + x3, ey = oy + y3
        for (let k = 1; k <= CURVE_SEGMENTS; k++) {
          const t = k / CURVE_SEGMENTS
          const u = 1 - t
          push(
            u * u * u * p0x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
            u * u * u * p0y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey,
          )
        }
        x = ex
        y = ey
        break
      }
      case 'Q': {
        const v = [num(), num(), num(), num()]
        if (v.some((n) => n === null)) return null
        const [x1, y1, x2, y2] = v as number[]
        const p0x = x, p0y = y
        const cx = ox + x1, cy = oy + y1, ex = ox + x2, ey = oy + y2
        for (let k = 1; k <= CURVE_SEGMENTS; k++) {
          const t = k / CURVE_SEGMENTS
          const u = 1 - t
          push(u * u * p0x + 2 * u * t * cx + t * t * ex, u * u * p0y + 2 * u * t * cy + t * t * ey)
        }
        x = ex
        y = ey
        break
      }
      default:
        return null
    }
  }
  if (points.length < 2) return null
  const cumulative: number[] = [0]
  for (let k = 1; k < points.length; k++) {
    cumulative.push(cumulative[k - 1] + Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y))
  }
  const length = cumulative[cumulative.length - 1]
  if (!(length > 0)) return null
  return { points, cumulative, length }
}

/** The point `fraction` of the way along the polyline, by arc length. */
export function pointAtFraction(poly: PathPolyline, fraction: number): { x: number; y: number } {
  const target = Math.max(0, Math.min(1, fraction)) * poly.length
  const { points, cumulative } = poly
  let k = 1
  while (k < cumulative.length - 1 && cumulative[k] < target) k++
  const seg = cumulative[k] - cumulative[k - 1]
  const t = seg > 0 ? (target - cumulative[k - 1]) / seg : 0
  return {
    x: points[k - 1].x + (points[k].x - points[k - 1].x) * t,
    y: points[k - 1].y + (points[k].y - points[k - 1].y) * t,
  }
}

/** Distance from a point to a rectangle (0 inside it). */
function distanceToRect(px: number, py: number, r: { x: number; y: number; width: number; height: number }): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.width))
  const dy = Math.max(r.y - py, 0, py - (r.y + r.height))
  return Math.hypot(dx, dy)
}

/**
 * A card's arrival glyph row, as the span of its slot centres from the arrival
 * point in GLYPH units (`dxMin` … `dxMax`), for `n` arriving edges — the same
 * `resolvePolarityGlyphOffset` the glyphs are placed by, so the row's width and
 * its band-title shift (`keepOut`) are the glyphs' own. `null` for `n = 0`.
 */
export function arrivalGlyphRowSpan(n: number, keepOut?: GlyphKeepOut): { dxMin: number; dxMax: number } | null {
  if (!(n > 0)) return null
  const siblings = Array.from({ length: n }, (_, k) => ({ id: `slot-${String(k).padStart(4, '0')}`, sourceCentre: null }))
  const first = resolvePolarityGlyphOffset(siblings[0].id, { x: 0, y: 0 }, siblings, keepOut)
  const last = resolvePolarityGlyphOffset(siblings[n - 1].id, { x: 0, y: 0 }, siblings, keepOut)
  return { dxMin: first.dx, dxMax: last.dx }
}

/** Half the kind shape's width at the counter-scale bound — it stands on every card's top border. */
const KIND_SHAPE_HALF_FLOW = (KIND_GLYPH_PX * MAX_LABEL_COUNTER_SCALE) / 2

/**
 * Is a cue disc centred at `p` clear of every card, every card's arrival marks
 * and every cue already placed? A card's arrival marks are its kind shape and
 * its glyph row: the band from its top up past its ARRIVAL POINT (`arrivalDy`
 * above the top — the handle stands on the kind shape, which scales with the
 * zoom) by `GLYPH_ROW_BAND_FLOW`, across the row's own span (`rows`, from
 * `arrivalGlyphRowSpan`) and the kind shape's width. A card with no entry in
 * `rows` keeps the whole card width — over-covering, never missing.
 */
export function fragileCueSpotIsClear(
  p: { x: number; y: number },
  cards: readonly RouteBox[],
  placed: ReadonlyArray<{ x: number; y: number }>,
  arrivalDy = 0,
  rows?: ReadonlyMap<string, { dxMin: number; dxMax: number } | null>,
  chips: readonly RouteBox[] = [],
): boolean {
  const reach = FRAGILE_CUE_RADIUS_FLOW + FRAGILE_CUE_CLEARANCE_FLOW
  // A strength chip the label pass pinned (Detailed view) is a mark like a card.
  for (const c of chips) if (distanceToRect(p.x, p.y, c) < reach) return false
  const rise = GLYPH_ROW_BAND_FLOW + Math.max(0, -arrivalDy)
  for (const c of cards) {
    if (distanceToRect(p.x, p.y, c) < reach) return false
    let x0 = c.x
    let x1 = c.x + c.width
    if (rows?.has(c.id)) {
      const cx = c.x + c.width / 2
      const span = rows.get(c.id)
      x0 = cx - KIND_SHAPE_HALF_FLOW
      x1 = cx + KIND_SHAPE_HALF_FLOW
      if (span) {
        x0 = Math.min(x0, cx + span.dxMin * MAX_GLYPH_COUNTER_SCALE - GLYPH_PAINTED_BOX_FLOW / 2)
        x1 = Math.max(x1, cx + span.dxMax * MAX_GLYPH_COUNTER_SCALE + GLYPH_PAINTED_BOX_FLOW / 2)
      }
    }
    const band = { x: x0, y: c.y - rise, width: x1 - x0, height: rise }
    if (distanceToRect(p.x, p.y, band) < reach) return false
  }
  for (const q of placed) {
    if (Math.hypot(q.x - p.x, q.y - p.y) < 2 * FRAGILE_CUE_RADIUS_FLOW + FRAGILE_CUE_CLEARANCE_FLOW) return false
  }
  return true
}

export interface FragileCuePlacement {
  /** Where along its own path the cue sits, as a fraction of the arc length (0.5 = midpoint). */
  fraction: number
  /** False when no point within `FRAGILE_CUE_MAX_SLIDE` of the midpoint was clear. */
  clear: boolean
}

/** Candidate fractions, nearest the midpoint first, towards the target before the source on a tie. */
const CANDIDATES: readonly number[] = (() => {
  const out = [0.5]
  const n = Math.round(FRAGILE_CUE_MAX_SLIDE / SLIDE_STEP)
  for (let k = 1; k <= n; k++) out.push(0.5 + k * SLIDE_STEP, 0.5 - k * SLIDE_STEP)
  return out.map((f) => Math.round(f * 1000) / 1000)
})()

/**
 * Every cue's place, in one deterministic pass: cues in id order, each at the
 * first clear candidate along its own path, clear of the cues placed before it.
 * A cue whose path cannot be read is left out (its caller keeps the midpoint).
 */
export function resolveFragileCuePlacements(
  cues: ReadonlyArray<{ id: string; path: string | null }>,
  cards: readonly RouteBox[],
  arrivalDy = 0,
  rows?: ReadonlyMap<string, { dxMin: number; dxMax: number } | null>,
  chips: readonly RouteBox[] = [],
): Map<string, FragileCuePlacement> {
  const out = new Map<string, FragileCuePlacement>()
  const placed: Array<{ x: number; y: number }> = []
  const ordered = [...cues].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const cue of ordered) {
    const poly = flattenSvgPath(cue.path)
    if (!poly) continue
    let chosen: FragileCuePlacement = { fraction: 0.5, clear: false }
    for (const f of CANDIDATES) {
      if (fragileCueSpotIsClear(pointAtFraction(poly, f), cards, placed, arrivalDy, rows, chips)) {
        chosen = { fraction: f, clear: true }
        break
      }
    }
    placed.push(pointAtFraction(poly, chosen.fraction))
    out.set(cue.id, chosen)
  }
  return out
}

/**
 * Where a card's handles stand relative to its box: the source port `sourceDy`
 * below its bottom edge, the target handle `targetDy` below its top edge (so
 * NEGATIVE — the handle is on the kind shape, which stands above the card by an
 * amount that scales with the zoom). The same for every card at one zoom, so
 * one edge that knows its own endpoints can supply them for all the others.
 */
export interface CardHandleOffsets {
  sourceDy: number
  targetDy: number
}

/**
 * The path `StyledEdge` draws for a bottom-port → top-handle connection, from
 * the card boxes alone — the same three helpers in the same order: a target at
 * or above the source's bottom takes the same-row / rising route; a target
 * below takes the layered leads when a card is in the way, else the contract's
 * near-straight cubic. Handles are the boxes' bottom-centre and top-centre,
 * moved by `ends` (`CardHandleOffsets`, read by the caller off its own edge).
 * `null` when either box is unknown or no route applies.
 *
 * `routeBoxes` is every visible card (the same-row resolver's obstacles);
 * `tieredBoxes` the non-ghost cards with their tier (the layered resolver's).
 */
export function cardEdgePathFromBoxes(
  sourceId: string,
  targetId: string,
  routeBoxes: readonly RouteBox[],
  tieredBoxes: ReadonlyArray<RouteBox & { tier: number }>,
  ends: CardHandleOffsets = { sourceDy: 0, targetDy: 0 },
): string | null {
  const src = routeBoxes.find((b) => b.id === sourceId)
  const tgt = routeBoxes.find((b) => b.id === targetId)
  if (!src || !tgt) return null
  const sx = src.x + src.width / 2
  const sy = src.y + src.height + ends.sourceDy
  const tx = tgt.x + tgt.width / 2
  const ty = tgt.y + ends.targetDy
  if (!(ty > sy)) {
    const others = routeBoxes.filter((b) => b.id !== sourceId && b.id !== targetId)
    return resolveCardEdgeRoute(src, tgt, others)?.path ?? null
  }
  const leads = resolveLayeredEdgeLeads(sourceId, targetId, sx, sy, tx, ty, tieredBoxes)
  if (leads) return layeredLeadPath(sx, sy, tx, ty, leads)[0]
  return contractLayeredPath(sx, sy, tx, ty)
}

/**
 * Where `StyledEdge` renders a connection's LABEL (the point a pinned strength
 * chip is offset from), from the card boxes — the same branches as its path:
 * a same-row / rising route's own anchor, else the handle midpoint; a lead
 * path's short cubic's t = 0.5 point; else the handle midpoint. `null` when
 * either box is unknown.
 */
export function cardEdgeLabelAnchorFromBoxes(
  sourceId: string,
  targetId: string,
  routeBoxes: readonly RouteBox[],
  tieredBoxes: ReadonlyArray<RouteBox & { tier: number }>,
  ends: CardHandleOffsets = { sourceDy: 0, targetDy: 0 },
): { x: number; y: number } | null {
  const src = routeBoxes.find((b) => b.id === sourceId)
  const tgt = routeBoxes.find((b) => b.id === targetId)
  if (!src || !tgt) return null
  const sx = src.x + src.width / 2
  const sy = src.y + src.height + ends.sourceDy
  const tx = tgt.x + tgt.width / 2
  const ty = tgt.y + ends.targetDy
  if (!(ty > sy)) {
    const others = routeBoxes.filter((b) => b.id !== sourceId && b.id !== targetId)
    return resolveCardEdgeRoute(src, tgt, others)?.labelAnchor ?? { x: (sx + tx) / 2, y: (sy + ty) / 2 }
  }
  const leads = resolveLayeredEdgeLeads(sourceId, targetId, sx, sy, tx, ty, tieredBoxes)
  if (leads) {
    const [, lx, ly] = layeredLeadPath(sx, sy, tx, ty, leads)
    return { x: lx, y: ly }
  }
  return { x: (sx + tx) / 2, y: (sy + ty) / 2 }
}
