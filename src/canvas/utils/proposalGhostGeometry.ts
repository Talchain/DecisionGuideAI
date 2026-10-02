/**
 * Suggestion preview: WHERE the ghost of a proposed change is drawn (pure; no store, no React).
 *
 * Inputs are the proposal's display ops (proposalPreview.ts) and the canvas nodes as drawn NOW (id, position, measured
 * size). Output is flow-space geometry for the overlay (ProposalGhostLayer.tsx):
 *   - a CARD per `add_node` whose id is not already on the canvas (once the real node lands, its ghost is gone), placed
 *     beside the existing node an `add_edge` ties it to: the first free slot touching it (right, left, below, above),
 *     else the NEAREST free spot whose line to it crosses no other node, else to the right of the drawing. (No producer
 *     emits `add_node` yet: INERT.) ⛔ A card never covers a node or another card. Served layouts are dense (CDP
 *     template: cards 276-325 wide, 48 px column and 64 px row gaps), so the slot beside a node is usually its sibling's.
 *     A card's height is its MEASURED height when the overlay has one (canvas text is counter-scaled, so it grows as
 *     the camera zooms out);
 *   - a LINE per `add_edge` whose two ends are on the canvas or ghost cards, clipped to the card borders;
 *   - a BAND mark per `set_link_strength` / `update_edge` between two nodes on the canvas: ON the real edge, at the
 *     first point along its drawn path (the overlay samples it, middle first) where the mark covers no node, card or
 *     edge label, the edge itself highlighted; else a callout (nearest free spot + a connector to the edge's middle). In a
 *     layered layout an edge's whole run can be a 48 px column gap (served CDP template: GDPR → GDPR risk at zoom 0.5).
 *     An `add_edge` with a band marks its ghost line the same way. The centres' midpoint only when nothing is drawn;
 *   - a STATUS mark per `set_option_status` on an option on the canvas: just above its card, else just below, else a
 *     callout. No mark ever covers a node, card or edge label while a clear place exists.
 * An op naming anything that is neither on the canvas nor a ghost card is dropped (fail closed: never a guessed place).
 */
import type { PreviewBand, PreviewOptionStatus, ProposalPreview } from '../conversation/proposalPreview'

export const GHOST_CARD_WIDTH = 220
export const GHOST_CARD_HEIGHT = 64
/** Horizontal gap from the anchor card; vertical gap between ghosts stacked on one anchor. */
export const GHOST_GAP_X = 48
export const GHOST_GAP_Y = 16
const FALLBACK_W = 200
const FALLBACK_H = 72
/** Clearance a card keeps from every node and card. */
const CLEARANCE = 8
/** The nearest-free search: grid step and reach from the anchor's centre (flow units). */
const SEARCH_STEP = 32
const SEARCH_RADIUS = 960
/** Any spot whose line crosses a node ranks behind every spot whose line does not. */
const CROSSING_PENALTY = 4 * SEARCH_RADIUS
/** A mark's size before the overlay has measured it. */
const BAND_FALLBACK = { w: 140, h: 24 } as const

export interface GhostNodeInput {
  readonly id: string
  readonly position: { readonly x: number; readonly y: number }
  readonly measured?: { readonly width?: number; readonly height?: number }
  readonly width?: number
  readonly height?: number
}

interface Rect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface GhostCard extends Rect { readonly id: string; readonly label: string; readonly kind: string | null }
export interface GhostLine { readonly key: string; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
export interface GhostBand {
  readonly key: string
  /** The mark's centre. */
  readonly x: number
  readonly y: number
  readonly band: PreviewBand
  /** The Yes only RECORDS the strength the link already has: never drawn as a change. */
  readonly keeps: boolean
  /** The Yes reverses the link's direction. */
  readonly reverses: boolean
  /** The real edge's drawn path, to highlight (absent when the edge is not drawn). */
  readonly edgePath?: string
  /** When the mark could not sit on the edge: a line from the edge's middle to the mark's border. */
  readonly connector?: GhostConnector
}
export interface GhostConnector { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
export interface GhostStatus {
  readonly key: string
  readonly optionId: string
  readonly status: PreviewOptionStatus
  readonly x: number
  readonly y: number
  readonly connector?: GhostConnector
}
export interface GhostGeometry {
  readonly cards: GhostCard[]
  readonly lines: GhostLine[]
  readonly bands: GhostBand[]
  readonly statuses: GhostStatus[]
}

const rectOf = (n: GhostNodeInput): Rect => ({
  x: n.position.x,
  y: n.position.y,
  w: n.measured?.width ?? n.width ?? FALLBACK_W,
  h: n.measured?.height ?? n.height ?? FALLBACK_H,
})
const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
const collides = (a: Rect, b: Rect) =>
  a.x < b.x + b.w + CLEARANCE && a.x + a.w + CLEARANCE > b.x && a.y < b.y + b.h + CLEARANCE && a.y + a.h + CLEARANCE > b.y

/** Does the segment (x1,y1)→(x2,y2) pass through r? (Liang–Barsky clip.) */
function segmentHits(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  const dx = x2 - x1
  const dy = y2 - y1
  let t0 = 0
  let t1 = 1
  for (const [p, q] of [[-dx, x1 - r.x], [dx, r.x + r.w - x1], [-dy, y1 - r.y], [dy, r.y + r.h - y1]] as const) {
    if (p === 0) { if (q < 0) return false; continue }
    const t = q / p
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t } else { if (t < t0) return false; if (t < t1) t1 = t }
  }
  return t0 <= t1
}

/** Where the segment from r's centre towards (tx, ty) leaves r's border. */
function exitPoint(r: Rect, tx: number, ty: number): { x: number; y: number } {
  const c = centre(r)
  const dx = tx - c.x
  const dy = ty - c.y
  if (dx === 0 && dy === 0) return c
  const sx = dx === 0 ? Infinity : (r.w / 2) / Math.abs(dx)
  const sy = dy === 0 ? Infinity : (r.h / 2) / Math.abs(dy)
  const s = Math.min(sx, sy)
  return { x: c.x + dx * s, y: c.y + dy * s }
}

/** The four slots touching an anchor, in preference order: right, left, below, above. */
const slotsBeside = (a: Rect, h: number) => [
  { x: a.x + a.w + GHOST_GAP_X, y: a.y },
  { x: a.x - GHOST_GAP_X - GHOST_CARD_WIDTH, y: a.y },
  { x: a.x, y: a.y + a.h + GHOST_GAP_Y },
  { x: a.x, y: a.y - GHOST_GAP_Y - h },
]

/** What the overlay measured on the drawn canvas (flow units). Everything is optional: geometry works without it. */
export interface GhostMeasures {
  /** Card height by proposed node id; a missing or zero height reads as GHOST_CARD_HEIGHT. */
  readonly heights?: ReadonlyMap<string, number>
  /** Mark size by mark key (`from->to` for a link, `option:<id>` for an option). */
  readonly markSizes?: ReadonlyMap<string, { readonly w: number; readonly h: number }>
  /** Points along the real edge's drawn path by band key, in preference order (the middle first). */
  readonly bandPaths?: ReadonlyMap<string, ReadonlyArray<{ readonly x: number; readonly y: number }>>
  /** The real edge's drawn path (`d`) by band key. */
  readonly bandEdgePaths?: ReadonlyMap<string, string>
  /** Other drawn marks a ghost must not cover (the edges' own labels: sign, strength). */
  readonly obstacles?: ReadonlyArray<{ readonly x: number; readonly y: number; readonly w: number; readonly h: number }>
}

export function proposalGhostGeometry(
  preview: ProposalPreview,
  nodes: readonly GhostNodeInput[],
  measures: GhostMeasures = {},
): GhostGeometry {
  const { heights, markSizes, bandPaths, bandEdgePaths, obstacles = [] } = measures
  const real = new Map(nodes.map((n) => [n.id, rectOf(n)] as const))
  const heightOf = (id: string) => {
    const h = heights?.get(id)
    return h !== undefined && h > 0 ? h : GHOST_CARD_HEIGHT
  }
  const edges = preview.ops.filter((o): o is Extract<typeof o, { op: 'add_edge' }> => o.op === 'add_edge')

  // The drawing's right edge and top, for a ghost with no anchor on the canvas.
  let right = 0
  let top = Infinity
  for (const r of real.values()) { right = Math.max(right, r.x + r.w); top = Math.min(top, r.y) }
  if (top === Infinity) top = 0

  const cards: GhostCard[] = []
  // Nodes and cards: nothing may cover them and no line should cross them. Edge labels: nothing may cover them.
  const taken: Rect[] = [...real.values()]
  const covered = (r: Rect) => taken.some((t) => collides(r, t)) || obstacles.some((o) => collides(r, o))
  const free = (x: number, y: number, h: number) => !covered({ x, y, w: GHOST_CARD_WIDTH, h })
  /**
   * The top-left of the nearest free w×h box around `from` whose line to from's centre crosses no other node or card
   * (or, failing that, the nearest free box). `from` itself never counts as crossed.
   */
  const nearestFree = (from: Rect, w: number, h: number): { x: number; y: number } | undefined => {
    const c = centre(from)
    const n = SEARCH_RADIUS / SEARCH_STEP
    let best: { x: number; y: number } | undefined
    let bestScore = Infinity
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const d = Math.hypot(i, j) * SEARCH_STEP
        if (d >= bestScore) continue
        const x = c.x + i * SEARCH_STEP - w / 2
        const y = c.y + j * SEARCH_STEP - h / 2
        if (covered({ x, y, w, h })) continue
        const crosses = taken.some((t) => t !== from && segmentHits(c.x, c.y, x + w / 2, y + h / 2, t))
        const score = d + (crosses ? CROSSING_PENALTY : 0)
        if (score < bestScore) { best = { x, y }; bestScore = score }
      }
    }
    return best
  }
  for (const op of preview.ops) {
    if (op.op !== 'add_node' || real.has(op.id)) continue
    const h = heightOf(op.id)
    const tie = edges.find((e) => (e.fromId === op.id && real.has(e.toId)) || (e.toId === op.id && real.has(e.fromId)))
    const a = tie ? real.get(tie.fromId === op.id ? tie.toId : tie.fromId)! : null
    let slot = a ? (slotsBeside(a, h).find((s) => free(s.x, s.y, h)) ?? nearestFree(a, GHOST_CARD_WIDTH, h)) : undefined
    if (!slot) {
      // Right of the drawing never meets a node; step down past any card already there.
      slot = { x: right + GHOST_GAP_X, y: top }
      while (!free(slot.x, slot.y, h)) slot = { x: slot.x, y: slot.y + GHOST_CARD_HEIGHT + GHOST_GAP_Y }
    }
    const card = { id: op.id, label: op.label, kind: op.kind, x: slot.x, y: slot.y, w: GHOST_CARD_WIDTH, h }
    cards.push(card)
    taken.push(card)
  }

  const rect = (id: string): Rect | undefined => real.get(id) ?? cards.find((c) => c.id === id)
  const lines: GhostLine[] = []
  for (const e of edges) {
    const a = rect(e.fromId)
    const b = rect(e.toId)
    if (!a || !b) continue
    const p = exitPoint(a, centre(b).x, centre(b).y)
    const q = exitPoint(b, centre(a).x, centre(a).y)
    lines.push({ key: `${e.fromId}->${e.toId}`, x1: p.x, y1: p.y, x2: q.x, y2: q.y })
  }

  /**
   * Where a mark of `key` goes: the first of `along` where it covers nothing; else a callout (the nearest free spot,
   * with a connector to `along[0]`); `fallback` when there is nothing to sit along.
   */
  const placeMark = (key: string, along: ReadonlyArray<{ x: number; y: number }>, fallback: { x: number; y: number }) => {
    const size = markSizes?.get(key) ?? BAND_FALLBACK
    const box = (p: { x: number; y: number }): Rect => ({ x: p.x - size.w / 2, y: p.y - size.h / 2, w: size.w, h: size.h })
    let at = along.find((p) => !covered(box(p)))
    let connector: GhostBand['connector']
    if (!at && along.length > 0) {
      // Nowhere along is clear (dense rows: an edge's whole run can be a column gap). A callout.
      const from = along[0]
      const spot = nearestFree({ x: from.x, y: from.y, w: 0, h: 0 }, size.w, size.h)
      at = spot ? { x: spot.x + size.w / 2, y: spot.y + size.h / 2 } : from
      if (spot) {
        const q = exitPoint(box(at), from.x, from.y)
        connector = { x1: from.x, y1: from.y, x2: q.x, y2: q.y }
      }
    }
    const placed = at ?? fallback
    taken.push(box(placed))
    return { x: placed.x, y: placed.y, ...(connector ? { connector } : {}) }
  }

  const bands: GhostBand[] = []
  for (const op of preview.ops) {
    if (op.op !== 'set_link_strength' && op.op !== 'update_edge' && op.op !== 'add_edge') continue
    if (op.op === 'add_edge' && op.band === null) continue
    const a = real.get(op.fromId)
    const b = real.get(op.toId)
    if (!a || !b) continue
    const key = `${op.fromId}->${op.toId}`
    const ca = centre(a)
    const cb = centre(b)
    const mid = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 }
    const keeps = op.op === 'add_edge' ? false : op.keeps
    const reverses = op.op === 'update_edge' ? op.reverses : false
    if (op.op === 'add_edge') {
      // A new link has no drawn edge: its mark sits on the ghost line.
      const l = lines.find((x) => x.key === key)
      const along = l ? [{ x: (l.x1 + l.x2) / 2, y: (l.y1 + l.y2) / 2 }] : []
      bands.push({ key, band: op.band!, keeps, reverses, ...placeMark(key, along, mid) })
      continue
    }
    const edgePath = bandEdgePaths?.get(key)
    bands.push({
      key, band: op.band, keeps, reverses, ...placeMark(key, bandPaths?.get(key) ?? [], mid), ...(edgePath ? { edgePath } : {}),
    })
  }

  // An option put in or taken out of the comparison: a mark just above its card, else just below, else a callout.
  const statuses: GhostStatus[] = []
  for (const op of preview.ops) {
    if (op.op !== 'set_option_status') continue
    const o = real.get(op.optionId)
    if (!o) continue
    const key = `option:${op.optionId}`
    const h = (markSizes?.get(key) ?? BAND_FALLBACK).h
    const above = { x: o.x + o.w / 2, y: o.y - CLEARANCE - h / 2 }
    const below = { x: o.x + o.w / 2, y: o.y + o.h + CLEARANCE + h / 2 }
    statuses.push({ key, optionId: op.optionId, status: op.status, ...placeMark(key, [above, below], above) })
  }
  return { cards, lines, bands, statuses }
}
