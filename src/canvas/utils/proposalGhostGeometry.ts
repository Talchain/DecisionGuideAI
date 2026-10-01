/**
 * Suggestion preview: WHERE the ghost of a proposed change is drawn (pure; no store, no React).
 *
 * Inputs are the proposal's display ops (proposalPreview.ts) and the canvas nodes as drawn NOW (id, position, measured
 * size). Output is flow-space geometry for the overlay (ProposalGhostLayer.tsx):
 *   - a CARD per `add_node` whose id is not already on the canvas (once the real node lands, its ghost is gone), placed
 *     beside the existing node an `add_edge` ties it to, else to the right of the drawing;
 *   - a LINE per `add_edge` whose two ends are on the canvas or ghost cards, clipped to the card borders so it never
 *     crosses the text of the cards it joins;
 *   - a BAND mark per `set_link_strength` between two nodes on the canvas, at the midpoint of their centres.
 * An op naming anything that is neither on the canvas nor a ghost card is dropped (fail closed: never a guessed place).
 */
import type { ProposalPreview } from '../conversation/proposalPreview'

export const GHOST_CARD_WIDTH = 220
export const GHOST_CARD_HEIGHT = 64
/** Horizontal gap from the anchor card; vertical gap between ghosts stacked on one anchor. */
export const GHOST_GAP_X = 48
export const GHOST_GAP_Y = 16
const FALLBACK_W = 200
const FALLBACK_H = 72

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
export interface GhostBand { readonly key: string; readonly x: number; readonly y: number; readonly band: string }
export interface GhostGeometry { readonly cards: GhostCard[]; readonly lines: GhostLine[]; readonly bands: GhostBand[] }

const rectOf = (n: GhostNodeInput): Rect => ({
  x: n.position.x,
  y: n.position.y,
  w: n.measured?.width ?? n.width ?? FALLBACK_W,
  h: n.measured?.height ?? n.height ?? FALLBACK_H,
})
const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

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

export function proposalGhostGeometry(preview: ProposalPreview, nodes: readonly GhostNodeInput[]): GhostGeometry {
  const real = new Map(nodes.map((n) => [n.id, rectOf(n)] as const))
  const edges = preview.ops.filter((o): o is Extract<typeof o, { op: 'add_edge' }> => o.op === 'add_edge')

  // The drawing's right edge and top, for a ghost with no anchor on the canvas.
  let right = 0
  let top = Infinity
  for (const r of real.values()) { right = Math.max(right, r.x + r.w); top = Math.min(top, r.y) }
  if (top === Infinity) top = 0

  const cards: GhostCard[] = []
  const stacked = new Map<string, number>()
  for (const op of preview.ops) {
    if (op.op !== 'add_node' || real.has(op.id)) continue
    const tie = edges.find((e) => (e.fromId === op.id && real.has(e.toId)) || (e.toId === op.id && real.has(e.fromId)))
    const anchorId = tie ? (tie.fromId === op.id ? tie.toId : tie.fromId) : '__right__'
    const k = stacked.get(anchorId) ?? 0
    stacked.set(anchorId, k + 1)
    const a = tie ? real.get(anchorId)! : null
    const x = a ? a.x + a.w + GHOST_GAP_X : right + GHOST_GAP_X
    const y = (a ? a.y : top) + k * (GHOST_CARD_HEIGHT + GHOST_GAP_Y)
    cards.push({ id: op.id, label: op.label, kind: op.kind, x, y, w: GHOST_CARD_WIDTH, h: GHOST_CARD_HEIGHT })
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

  const bands: GhostBand[] = []
  for (const op of preview.ops) {
    if (op.op !== 'set_link_strength') continue
    const a = real.get(op.fromId)
    const b = real.get(op.toId)
    if (!a || !b) continue
    const ca = centre(a)
    const cb = centre(b)
    bands.push({ key: `${op.fromId}->${op.toId}`, x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2, band: op.band })
  }
  return { cards, lines, bands }
}
