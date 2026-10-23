/**
 * WHERE A LINK ARRIVES AT ITS CARD, AND WHERE ITS `+` / `−` SITS.
 *
 * ⭐⭐ THE RULE (Paul's two staging models, 28 Sep 2026 — Canvas lead's ruling
 * in the edge-legibility brief, `canvas/paul-test-edges`):
 *
 *   A. LINKS ARRIVING AT ONE CARD'S TOP ARE SPREAD ALONG IT. Every link that
 *      enters a card from above takes its own ARRIVAL SLOT on the card's top
 *      side (`resolveArrivalSlot`), ordered left to right by where its SOURCE
 *      sits, so the lines do not cross at the card. Each keeps its own
 *      arrowhead. A card with one arriving link keeps it on the kind shape's
 *      apex, exactly as before; with several, an odd group's middle link keeps
 *      the apex and every other slot lands on the card's top border, one
 *      `ARRIVAL_PITCH_FLOW` apart, clear of the kind shape.
 *   B. A LINK'S SIGN SITS ON ITS OWN LINE, AT ITS MIDDLE
 *      (`resolvePolarityGlyphOnPath`; vision spec, gap P0 #4, 23 Oct 2026). Until
 *      then it stood just above its own arrowhead, so a card's signs read as one
 *      row over it. The halo (`StyledEdge` `POLARITY_GLYPH_HALO`) knocks the line
 *      out behind it.
 *
 * ── WHAT IT REPLACES, MEASURED ───────────────────────────────────────────────
 *
 * Every link into a card ended at ONE point, the kind shape's apex, and the
 * card's signs stood in one row 19 glyph units above it (contract v3.1
 * `renderEdges`: `off = (seen − (count + 1) / 2) · 19`, `gx = bx + off ± 8`),
 * a band-title keep-out shifting the whole row by whole slots. On Paul's
 * `tech_lead` board six links entered the goal at one point — six arrowheads
 * piled on it and the row read "− + − + + − +" with no way to tell which sign
 * was whose. On `pa_vs_ai` the keep-out pushed the one `+` into "Assistant
 * coordination overhead" 65 glyph units right of its arrival (130 flow units,
 * ~65px at the landing), beside the "OUTCOMES / RISKS" band word and on no
 * line. Laid out by the repo's own layout at the landing (zoom 0.5), the old
 * row put EVERY one of the two boards' 23 signs more than 6 flow units off its
 * own drawn line — 7.3 to 41.6 — and, on `tech_lead`, six ends on one point
 * (`StyledEdge.paulTestBoards.edgeLegibility.spec.tsx`, its RED on the code
 * before this change).
 *
 * ⚠ THIS DEPARTS FROM CONTRACT v3.1, ON THE CANVAS LEAD'S RULING. The contract
 * ends every link at the kind apex and stands the signs in a row. That row is
 * why a reader could not attribute a sign once several lines converged; the
 * spread arrivals and the on-line sign are the remedy the ruling asked for.
 *
 * ── THE RULES KEPT ───────────────────────────────────────────────────────────
 *
 *   · ARROWHEAD CLEARANCE — the sign never stands nearer the tip than one head
 *     length plus half its box, at the live counter-scales.
 *   · NO SIGN UNDER A CARD — every candidate spot is tested against every card
 *     box and the target row's band title (the WS1 #28 keep-out); the sign
 *     slides along its OWN line to the nearest clear spot, never off it.
 *   · (RETIRED 23 Oct 2026, gap P0 #4) THE RISE BOUND held the sign within
 *     `GLYPH_RISE_MAX_ABOVE_CARD_FLOW` of its target card, which is what stood a
 *     card's signs in a row over it. The constants stay for the gap they measure.
 *
 * ⚠ STATED LIMITS (arithmetic, not paint):
 *   · An APEX arrival at the landing bound has 22.64 units above its tip for a
 *     head of 16–40 plus a sign: the sign stays on its line at the rise bound
 *     and its box reaches into the head's base. Its halo keeps it legible. It
 *     clears from zoom ≈ 0.65 up. (The row this replaces had the same limit for
 *     an odd group's middle glyph.)
 *   · On a card too narrow for its group at `ARRIVAL_PITCH_FLOW`, the pitch is
 *     compressed to fit and neighbouring heads may touch.
 *   · Signs of DIFFERENT cards are not tested against each other; spread
 *     arrivals keep one card's signs a pitch apart.
 *
 * ⭐ THE GUARANTEE, and why it is one: arrival slot x is STRICTLY increasing in
 * the sibling order, and each sibling takes its own position in ONE total order
 * (source x, then id) that every instance computes from the same store
 * snapshot, so two links into one card never share an end point, and a sign on
 * its own path never shares a spot with another link's sign at that card. If
 * ANY sibling's source is unresolvable, the whole group is ordered by id alone
 * — still one total order, still distinct slots.
 */
import { MAX_GLYPH_COUNTER_SCALE, MAX_LABEL_COUNTER_SCALE } from './zoomLegibility'
import { LAYOUT_LAYER_GAP, LAYOUT_PADDING_Y, kindGlyphOverhangAt, kindGlyphSizeAt } from './nodeLayoutConstants'
import { edgeArrowheadSize } from '../edges/edgePresentation'

/**
 * The glyph's painted box, in graph units AT THE COUNTER-SCALE BOUND (the 0.50
 * landing floor). Read by `sameRowRoute.ts` and by the placement below.
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
 * ⭐⭐ THE RISE BOUND, above the TARGET CARD'S TOP (code-review F1, 27 Sep 2026):
 * the highest a sign's centre may stand and still sit INSIDE the tier gap,
 * clear of the row above — at the bound (the largest glyph box):
 *
 *   the visible gap        LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y  = 64
 *   less half the box      GLYPH_PAINTED_BOX_FLOW / 2           = 10
 *   less the mark gap      GLYPH_BOX_GAP_FLOW                   =  4
 *                                                                 ──
 *                                                                 50
 *
 * The row this module used to draw stood above the kind apex, so the same bound
 * was stated from there (`GLYPH_ROW_RISE_MAX_FLOW`). Since the sign now stands
 * on its own line above arrivals that may land on the card's border, it is
 * stated from the card; the two are the same height on the board.
 * `polarityGlyphRowClearsCards.guard.spec.ts` asserts the budget.
 */
export const GLYPH_RISE_MAX_ABOVE_CARD_FLOW =
  LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y - GLYPH_PAINTED_BOX_FLOW / 2 - GLYPH_BOX_GAP_FLOW

/** The same bound above the kind shape's apex, at the label bound (22.64). */
export const GLYPH_ROW_RISE_MAX_FLOW =
  GLYPH_RISE_MAX_ABOVE_CARD_FLOW - kindGlyphOverhangAt(MAX_LABEL_COUNTER_SCALE)

/**
 * The widest arrowhead the width channel draws, in flow units at the bound:
 * `edgeArrowheadSize` of the widest band (very strong, 5) × the glyph
 * counter-scale bound — 25. Its length and its base are the same figure.
 */
// Frozen at the pre-removal clearance (Paul, 7 Oct); signs and arrival slots must not move.
export const ARRIVAL_HEAD_MAX_FLOW = 25

/** Half the kind shape's width at the label bound — it stands on the card's top centre. */
const KIND_SHAPE_HALF_FLOW = kindGlyphSizeAt(MAX_LABEL_COUNTER_SCALE) / 2

/**
 * ⭐ THE DISTANCE BETWEEN TWO NEIGHBOURING ARRIVALS, in flow units — derived,
 * never a literal, as the larger of the two things it must keep apart at the
 * bound, rounded up to a whole unit:
 *
 *   two widest heads side by side     ARRIVAL_HEAD_MAX_FLOW + GLYPH_BOX_GAP_FLOW          = 29
 *   a border head beside the kind      KIND_SHAPE_HALF_FLOW + ARRIVAL_HEAD_MAX_FLOW / 2
 *   shape (the apex slot is 0)           + GLYPH_BOX_GAP_FLOW                             → 33
 *
 * (It was 44 until Paul's 1 Oct feedback, #2409: heads 2.5× the stroke instead of 4×, kind shapes 20% smaller.)
 *
 * A sign's box (20) plus its gap clears a neighbour's LINE at this pitch too.
 */
export const ARRIVAL_PITCH_FLOW = Math.ceil(
  Math.max(
    ARRIVAL_HEAD_MAX_FLOW + GLYPH_BOX_GAP_FLOW,
    KIND_SHAPE_HALF_FLOW + ARRIVAL_HEAD_MAX_FLOW / 2 + GLYPH_BOX_GAP_FLOW,
  ),
)

/** How far the outermost arrival stays in from the card's side: half the widest head. */
export const ARRIVAL_CARD_MARGIN_FLOW = ARRIVAL_HEAD_MAX_FLOW / 2

/** A sibling link into the same card. `sourceCentre` is null when unresolvable. */
export interface ArrivalSibling {
  id: string
  /** Centre of the link's SOURCE card, in graph units. */
  sourceCentre: { x: number; y: number } | null
}

/** Where one link arrives: `dx` flow units from the card's top centre; on the kind apex or on the border. */
export interface ArrivalSlot {
  dx: number
  onKindShape: boolean
}

const resolvable = (s: ArrivalSibling): boolean =>
  s.sourceCentre !== null && Number.isFinite(s.sourceCentre.x)

/**
 * The ONE total order of a card's arriving links: by where the source sits,
 * left to right, then by id — or by id alone when any source is unresolvable,
 * so every instance reading one snapshot agrees.
 */
export function orderArrivals(siblings: readonly ArrivalSibling[]): ArrivalSibling[] {
  const byGeometry = siblings.every(resolvable)
  return [...siblings].sort((a, b) => {
    if (byGeometry) {
      const ax = a.sourceCentre!.x
      const bx = b.sourceCentre!.x
      if (ax !== bx) return ax - bx
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/**
 * The symmetric slots of a group of `n`, in pitches from the top centre: an odd
 * group centred on the apex (…, −1, 0, 1, …), an even group leaving the apex to
 * the kind shape (…, −2, −1, 1, 2, …). The DEGRADED order's positions — used
 * only when a source cannot be located, so nothing better is known.
 */
function symmetricSlots(n: number): number[] {
  if (n % 2 === 1) return Array.from({ length: n }, (_, k) => k - (n - 1) / 2)
  const half = n / 2
  return Array.from({ length: n }, (_, k) => (k < half ? k - half : k - half + 1))
}

/**
 * Positions `p` (in order) nearest the `desired` ones, in least squares, with
 * every neighbour at least `pitch` apart and all inside [`lo`, `hi`]:
 * pool-adjacent-violators on `desired[k] − k·pitch`, then pushed inside the
 * bounds (each push keeps the spacing). The caller has checked the group fits.
 */
function spaceInOrder(desired: readonly number[], lo: number, hi: number, pitch: number): number[] {
  const n = desired.length
  const blocks: Array<{ sum: number; count: number }> = []
  for (let k = 0; k < n; k++) {
    blocks.push({ sum: desired[k] - k * pitch, count: 1 })
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1]
      const a = blocks[blocks.length - 2]
      if (a.sum / a.count <= b.sum / b.count) break
      a.sum += b.sum
      a.count += b.count
      blocks.pop()
    }
  }
  const p: number[] = []
  for (const b of blocks) for (let c = 0; c < b.count; c++) p.push(b.sum / b.count + p.length * pitch)
  for (let k = 0; k < n; k++) p[k] = Math.max(p[k], lo + k * pitch)
  for (let k = 0; k < n; k++) p[k] = Math.min(p[k], hi - (n - 1 - k) * pitch)
  return p
}

/**
 * How far an arrival keeps from its row's band title, across: half the widest
 * head and the mark gap, so neither the head nor the sign above it meets the
 * word (the WS1 #28 keep-out, applied to the arrival itself).
 */
export const ARRIVAL_TITLE_CLEARANCE_FLOW = ARRIVAL_HEAD_MAX_FLOW / 2 + GLYPH_BOX_GAP_FLOW

/**
 * ⭐ WHERE link `edgeId` ARRIVES on a card (`target`: its left `x` and
 * `width`), among `siblings` — every link entering that card from above,
 * INCLUDING the one asking (an edge missing from the list is placed past the
 * listed ones rather than sharing a slot). Order-independent: it sorts.
 *
 *   · ONE link keeps the kind apex, as it always did.
 *   · SEVERAL: each link's slot is as near as the rules allow to the point
 *     straight below its own source — so a line drops into its card instead of
 *     crossing a neighbour's arrival — in the one source order, every pair at
 *     least `ARRIVAL_PITCH_FLOW` apart, inside the card less
 *     `ARRIVAL_CARD_MARGIN_FLOW` at each side. The kind shape's column
 *     (within a pitch of the centre) holds at most one link, ON the apex: the
 *     slot nearest the centre, if one falls in it; the others keep a pitch
 *     from it. A group too wide for its card is spread evenly across it (the
 *     stated limit: its heads may touch).
 *   · THE ROW'S BAND TITLE (`title`, `tierLaneTitleBoxFor`'s box) stands in the
 *     gap above the row's first card. No arrival lands under it: the part of
 *     the card it covers, `ARRIVAL_TITLE_CLEARANCE_FLOW` either side, takes no
 *     slot — a single link whose apex it covers arrives just past the word
 *     instead (on `pa_vs_ai`, "OUTCOMES / RISKS" over "Assistant coordination
 *     overhead"). With no room past it, the title is not avoided.
 */
export function resolveArrivalSlot(
  edgeId: string,
  target: { x: number; width: number },
  siblings: readonly ArrivalSibling[],
  title?: GlyphKeepOut,
): ArrivalSlot {
  const ordered = orderArrivals(siblings)
  let k = ordered.findIndex((s) => s.id === edgeId)
  let n = ordered.length
  if (k === -1) {
    k = n
    n += 1
  }
  const cx = target.x + target.width / 2
  const pitch = ARRIVAL_PITCH_FLOW
  const half = Math.max(0, target.width / 2 - ARRIVAL_CARD_MARGIN_FLOW)
  let lo = -half
  let hi = half
  if (title) {
    const t0 = title.x0 - ARRIVAL_TITLE_CLEARANCE_FLOW - cx
    const t1 = title.x1 + ARRIVAL_TITLE_CLEARANCE_FLOW - cx
    if (t0 < hi && t1 > lo) {
      // The word covers the card's left part (it is left-anchored at the board
      // column): start past it — at the card's usable end when it reaches
      // that far. Mirrored for a right part.
      if (t0 <= lo) lo = Math.min(hi, t1)
      else if (t1 >= hi) hi = Math.max(lo, t0)
    }
    // A GROUP that does not fit the room the word leaves ignores the word.
    if (n > 1 && (n - 1) * pitch > hi - lo) {
      lo = -half
      hi = half
    }
  }
  const apexFree = lo <= 0 && hi >= 0
  if (n <= 1) {
    if (apexFree) return { dx: 0, onKindShape: true }
    // The title covers the apex: just past it, clear of the kind shape.
    return lo > 0 ? { dx: Math.min(hi, Math.max(lo, pitch)), onKindShape: false } : { dx: Math.max(lo, Math.min(hi, -pitch)), onKindShape: false }
  }
  if (!apexFree) {
    // The kind column is out of reach on this side: keep a pitch from it.
    if (lo > 0) lo = Math.min(hi, Math.max(lo, pitch))
    else hi = Math.max(lo, Math.min(hi, -pitch))
  }
  // Too many for the room: evenly across it, in order.
  if ((n - 1) * pitch > hi - lo) {
    return { dx: lo + (k * (hi - lo)) / (n - 1), onKindShape: false }
  }
  const byGeometry = ordered.every(resolvable) && k < ordered.length
  const symmetric = symmetricSlots(n).map((j) => j * pitch)
  const desired = (byGeometry ? ordered.map((s) => s.sourceCentre!.x - cx) : symmetric).map((d) => Math.max(lo, Math.min(hi, d)))
  let p = spaceInOrder(desired, lo, hi, pitch)
  let apex = -1
  const inColumn = apexFree ? p.map((v, i) => ({ v, i })).filter(({ v }) => Math.abs(v) < pitch) : []
  if (inColumn.length > 0) {
    // The kind shape's column: at most one link, on the apex.
    apex = inColumn.reduce((best, c) => (Math.abs(c.v) < Math.abs(best.v) ? c : best)).i
    const leftGroup = p.slice(0, apex)
    const rightGroup = p.slice(apex + 1)
    const fits = (g: number[], a: number, b: number) => g.length === 0 || (a <= b && (g.length - 1) * pitch <= b - a)
    if (fits(leftGroup, lo, -pitch) && fits(rightGroup, pitch, hi)) {
      p = [...spaceInOrder(leftGroup, lo, -pitch, pitch), 0, ...spaceInOrder(rightGroup, pitch, hi, pitch)]
    } else {
      // One side cannot hold its links beside the apex: the symmetric slots,
      // which clear the column whenever they fit the room.
      p = spaceInOrder(symmetric.map((d) => Math.max(lo, Math.min(hi, d))), lo, hi, pitch)
      apex = p.findIndex((v) => v === 0)
    }
  }
  return { dx: p[k], onKindShape: k === apex }
}

/** A card, as the board-level helpers below read it. */
export interface ArrivalBox {
  id: string
  x: number
  y: number
  width: number
  height: number
}

/**
 * The card's arriving links, from the boxes: every edge into `targetId` whose
 * source card sits wholly above the target's top (the layered, top-arrival
 * geometry — the only one that ends on the top handle). A source with no box
 * is kept, unresolvable, so the degraded order still holds.
 */
export function arrivalSiblingsOnBoard(
  targetId: string,
  boxes: ReadonlyMap<string, ArrivalBox>,
  edges: ReadonlyArray<{ id: string; source: string; target: string }>,
): ArrivalSibling[] {
  const tgt = boxes.get(targetId)
  if (!tgt) return []
  const out: ArrivalSibling[] = []
  for (const e of edges) {
    if (e.target !== targetId) continue
    const src = boxes.get(e.source)
    if (!src) {
      out.push({ id: e.id, sourceCentre: null })
      continue
    }
    if (!(src.y + src.height < tgt.y)) continue
    out.push({ id: e.id, sourceCentre: { x: src.x + src.width / 2, y: src.y + src.height / 2 } })
  }
  return out
}

/**
 * The slot for `edgeId` on a board of boxes — `resolveArrivalSlot` over
 * `arrivalSiblingsOnBoard`. A link that is not one of its card's top arrivals
 * by the boxes (a same-row or rising pair) keeps the apex, so every instance
 * reading one snapshot agrees on the set. `title` is the card's row's band
 * word, honoured when any of its arrivals `carriesSign` (a causal link; the
 * default says every link does).
 */
export function resolveArrivalSlotOnBoard<E extends { id: string; source: string; target: string }>(
  edgeId: string,
  targetId: string,
  boxes: ReadonlyMap<string, ArrivalBox>,
  edges: readonly E[],
  title?: GlyphKeepOut,
  carriesSign: (e: E) => boolean = () => true,
): ArrivalSlot {
  const tgt = boxes.get(targetId)
  if (!tgt) return { dx: 0, onKindShape: true }
  const siblings = arrivalSiblingsOnBoard(targetId, boxes, edges)
  if (!siblings.some((s) => s.id === edgeId)) return { dx: 0, onKindShape: true }
  // The band word is a keep-out for the SIGNS and heads standing above a card:
  // a card whose arrivals carry none (question → option, option → factor)
  // keeps its slots as before.
  const ids = new Set(siblings.map((s) => s.id))
  const signed = edges.some((e) => ids.has(e.id) && carriesSign(e))
  return resolveArrivalSlot(edgeId, tgt, siblings, signed ? title : undefined)
}

// ── THE SIGN ON ITS OWN LINE ────────────────────────────────────────────────

/** A region a sign must not be painted over, in graph units (a card, a band title). */
export interface GlyphKeepOut {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** The sign's sizes in flow units at one zoom. */
export interface GlyphMetrics {
  /** The arrowhead's length (the path's last `headLength` units are under it). */
  headLength: number
  /** Half the sign's painted box. */
  halfBox: number
  /** The mark gap. */
  gap: number
}

/**
 * The sign's sizes at the live counter-scales: the head is `edgeArrowheadSize`
 * × the glyph scale (as `EDGE_ARROWHEAD_COUNTER_SCALE_STYLE` paints it), the box
 * follows the TEXT scale (its font is `typography.edgeLabel`), the mark gap the
 * glyph scale. At the bound (glyph 2, label 1.64) these are the module's own
 * conservative figures: box 20, gap 4.
 */
export function glyphMetricsAt(strokeWidth: number, glyphScale: number, labelScale: number): GlyphMetrics {
  return {
    headLength: edgeArrowheadSize(strokeWidth) * glyphScale,
    halfBox: (GLYPH_PAINTED_BOX_FLOW / 2) * (labelScale / MAX_LABEL_COUNTER_SCALE),
    gap: GLYPH_BOX_GAP_FLOW * (glyphScale / MAX_GLYPH_COUNTER_SCALE),
  }
}

/** A flattened path: points with their cumulative arc length (`fragileCuePlacement.flattenSvgPath`). */
export interface GlyphPath {
  points: ReadonlyArray<{ x: number; y: number }>
  cumulative: readonly number[]
  length: number
}

/** The point `s` units back from the path's END, by arc length. */
export function pointBackFromEnd(poly: GlyphPath, s: number): { x: number; y: number } {
  const target = Math.max(0, Math.min(poly.length, poly.length - s))
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

/** The step, in flow units, a sign slides along its line looking for a clear spot. */
const GLYPH_SLIDE_STEP = 2

export interface GlyphOnPath {
  x: number
  y: number
  /** Arc length back from the tip. */
  setback: number
  /** False when no spot on the line met every rule (the sign stands at its ideal spot, bounded). */
  clear: boolean
}

/**
 * A source mark sits on the first quarter of its own path. The polarity mark
 * takes the middle (gap P0 #4) and slides off the fragility disc there, so the
 * seats stay apart.
 */
export function resolveSourceGlyphOnPath(poly: GlyphPath): { x: number; y: number } {
  const fromEnd = poly.length * 0.75
  return pointBackFromEnd(poly, fromEnd)
}

/**
 * ⭐ WHERE A "RESTS ON" NUMBER SITS: the source mark's seat (a quarter along its own line), unless a card covers it.
 * Then it slides along the same line, nearest the seat first, either way, to the first spot whose box clears every
 * card. Measured at 1280×800 on the MRR board (19 Oct 2026): 3 of 13 numbers sat on links leaving a card sideways, and
 * their seats were under the next card, so they could not be seen or picked. With no clear spot it stands at the seat.
 * `half` is the number's painted half-size in flow units at the live zoom.
 */
export function resolveRestsOnMarkerOnPath(
  poly: GlyphPath,
  half: { readonly w: number; readonly h: number },
  keepOuts: readonly GlyphKeepOut[],
): { x: number; y: number; clear: boolean } {
  const seat = poly.length * 0.75
  const clearAt = (s: number): { x: number; y: number } | null => {
    const p = pointBackFromEnd(poly, s)
    const hit = keepOuts.some((k) => p.x + half.w > k.x0 && p.x - half.w < k.x1 && p.y + half.h > k.y0 && p.y - half.h < k.y1)
    return hit ? null : p
  }
  for (let d = 0; d <= poly.length; d += GLYPH_SLIDE_STEP) {
    for (const s of d === 0 ? [seat] : [seat - d, seat + d]) {
      if (s < 0 || s > poly.length) continue
      const p = clearAt(s)
      if (p) return { ...p, clear: true }
    }
  }
  // No clear spot (a line running through a card row, whose gaps are narrower than the number): the spot where the
  // number overlaps the cards least, nearest the seat on a tie. The caller draws it above the cards there.
  const overlap = (p: { x: number; y: number }) => keepOuts.reduce((sum, k) => {
    const w = Math.min(p.x + half.w, k.x1) - Math.max(p.x - half.w, k.x0)
    const h = Math.min(p.y + half.h, k.y1) - Math.max(p.y - half.h, k.y0)
    return w > 0 && h > 0 ? sum + w * h : sum
  }, 0)
  let best = { ...pointBackFromEnd(poly, seat), s: seat }
  let bestArea = overlap(best)
  for (let s = 0; s <= poly.length; s += GLYPH_SLIDE_STEP) {
    const p = pointBackFromEnd(poly, s)
    const area = overlap(p)
    if (area < bestArea || (area === bestArea && Math.abs(s - seat) < Math.abs(best.s - seat))) {
      best = { ...p, s }
      bestArea = area
    }
  }
  return { x: best.x, y: best.y, clear: false }
}

/**
 * ⭐ WHERE THE SIGN SITS — at the MIDDLE of its own drawn path (vision spec, canvas-vs-vision gap P0 #4, 23 Oct 2026:
 * "the sign glyph sits on each line at its midpoint"), `metrics` read at the zoom it is painted at; `keepOuts` are every
 * card box, the target row's band title and the other heads at the target card.
 *
 * It used to stand one head, one gap and half a box back from the tip, under a rise bound above the target card. Where
 * several links meet one card that put every sign in a row just above it, a line of "+ + − +" no reader could tie to
 * its link (Paul's funding board, 23 Oct). At the middle, each sign reads as its own line's.
 *
 * If its box (grown by the gap) meets a keep-out, the sign slides along its line — in steps, towards the tip first and
 * then towards the start — to the first clear spot that keeps half a box plus a head clear of the tip and half a box
 * clear of the start. With none (a line that runs through a card row whose gaps are narrower than the sign), it stands at the middle
 * and says so; the caller draws it with its halo as before.
 *
 * `stagger` (in sign pitches, + towards the source): links leaving one card share their first stretch of line, so two
 * siblings can find the same first clear spot on that trunk (measured on the funding board, 23 Oct). The caller gives
 * each its own offset, in the order of their targets; from the clear spot it stands that many pitches along, where that
 * is clear too.
 */
export function resolvePolarityGlyphOnPath(
  poly: GlyphPath,
  metrics: GlyphMetrics,
  keepOuts: readonly GlyphKeepOut[] = [],
  stagger = 0,
): GlyphOnPath {
  const { headLength, halfBox, gap } = metrics
  const mid = poly.length / 2
  const nearTip = Math.min(headLength + halfBox, mid)
  const nearStart = Math.max(poly.length - halfBox, mid)
  const reach = halfBox + gap
  const clearAt = (p: { x: number; y: number }) =>
    keepOuts.every((k) => p.x + reach <= k.x0 || p.x - reach >= k.x1 || p.y + reach <= k.y0 || p.y - reach >= k.y1)
  // Towards the tip first, then towards the start: links leaving one card share their first stretch, while every link
  // into a card has its own arrival slot, so the arrival half keeps signs apart and attributable.
  const candidates: number[] = []
  for (let s = mid; s >= nearTip; s -= GLYPH_SLIDE_STEP) candidates.push(s)
  for (let s = mid + GLYPH_SLIDE_STEP; s <= nearStart; s += GLYPH_SLIDE_STEP) candidates.push(s)
  for (const s of candidates) {
    const p = pointBackFromEnd(poly, s)
    if (!clearAt(p)) continue
    // A sibling on the same trunk found this same spot: stand `stagger` pitches along, where that is clear too.
    const t = s + stagger * 2 * (2 * halfBox + gap)
    const q = stagger !== 0 && t >= nearTip && t <= nearStart ? pointBackFromEnd(poly, t) : null
    return q && clearAt(q) ? { x: q.x, y: q.y, setback: t, clear: true } : { x: p.x, y: p.y, setback: s, clear: true }
  }
  const p = pointBackFromEnd(poly, mid)
  return { x: p.x, y: p.y, setback: mid, clear: false }
}

/**
 * The region an arrowhead occupies at an arrival point, as a keep-out for the
 * OTHER signs at that card: the widest head the width channel draws, at the
 * glyph scale it is painted at, standing on the arrival point (heads into a
 * card point down into it).
 */
export function arrivalHeadKeepOut(end: { x: number; y: number }, glyphScale: number): GlyphKeepOut {
  const size = (ARRIVAL_HEAD_MAX_FLOW / MAX_GLYPH_COUNTER_SCALE) * glyphScale
  return { x0: end.x - size / 2, y0: end.y - size, x1: end.x + size / 2, y1: end.y }
}

/**
 * The sign's CSS transform: centred on its point. A flow position — the line it
 * sits on is in flow units — so no counter-scale term; the sign's own SIZE
 * carries the text scale through its font.
 */
export function polarityGlyphTransform(x: number, y: number): string {
  const r2 = (v: number) => Math.round(v * 100) / 100
  return `translate(-50%, -50%) translate(${r2(x)}px, ${r2(y)}px)`
}
