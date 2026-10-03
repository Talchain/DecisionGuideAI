/**
 * Hover cards on the canvas — the shared surface, timing and placement for the
 * card pop-up (`NodeHoverCard`) and the link pop-up (`LinkHoverCard`).
 *
 * Paul, 29 Sep 2026: bring both pop-ups back, in the LIGHT panel style (never
 * the black tooltip), showing only what the server sent, and never over the
 * neighbouring cards. The last card pop-up opened BELOW its card at a fixed
 * width, so it covered the next row on every starter (#2197). Placement here
 * measures the pop-up and picks the side of its anchor that covers the fewest
 * other cards, then the side with the most free screen space.
 */

/** The design system's panel surface — the same one the inspector and dock wear. */
export const HOVER_CARD_SURFACE_CLASS =
  'bg-panel border border-panel-border rounded-lg shadow-lg px-3 py-2.5 text-left font-sans'

export const HOVER_CARD_MAX_WIDTH = 300
/** Hover intent: a pointer passing over a card on its way elsewhere opens nothing. */
export const HOVER_CARD_OPEN_DELAY_MS = 400
/** Space between the anchor and the pop-up, and between the pop-up and the viewport edge. */
export const HOVER_CARD_GAP = 8

export interface Rect { left: number; top: number; right: number; bottom: number }
export type HoverCardSide = 'right' | 'left' | 'below' | 'above'
export interface HoverCardPlacement { left: number; top: number; side: HoverCardSide }

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))

/**
 * Where a `size` pop-up goes beside `anchor`, in the same (screen) coordinates.
 * Sides that fit on screen are preferred; among them the one overlapping the
 * least card area wins, and a tie goes to the side with the most free space.
 */
export function placeHoverCard(
  anchor: Rect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  obstacles: readonly Rect[],
  gap = HOVER_CARD_GAP,
): HoverCardPlacement {
  const { width: w, height: h } = size
  const space: Record<HoverCardSide, number> = {
    right: viewport.width - anchor.right,
    left: anchor.left,
    below: viewport.height - anchor.bottom,
    above: anchor.top,
  }
  const maxLeft = viewport.width - w - gap
  const maxTop = viewport.height - h - gap
  const at: Record<HoverCardSide, { left: number; top: number }> = {
    right: { left: anchor.right + gap, top: clamp(anchor.top, gap, maxTop) },
    left: { left: anchor.left - gap - w, top: clamp(anchor.top, gap, maxTop) },
    below: { left: clamp(anchor.left, gap, maxLeft), top: anchor.bottom + gap },
    above: { left: clamp(anchor.left, gap, maxLeft), top: anchor.top - gap - h },
  }
  const sides: HoverCardSide[] = ['right', 'left', 'below', 'above']
  const scored = sides.map(side => {
    const { left, top } = at[side]
    const box = { left, top, right: left + w, bottom: top + h }
    const fits = space[side] >= (side === 'right' || side === 'left' ? w : h) + 2 * gap
    const covered = obstacles.reduce((sum, o) => sum + overlapArea(box, o), 0)
    return { side, left, top, fits, covered }
  })
  const pool = scored.some(s => s.fits) ? scored.filter(s => s.fits) : scored
  pool.sort((a, b) => a.covered - b.covered || space[b.side] - space[a.side])
  const best = pool[0]
  return { side: best.side, left: clamp(best.left, gap, maxLeft), top: clamp(best.top, gap, maxTop) }
}

/** Screen rects of every card on the canvas except `own` (the anchor's card, if any). */
export function canvasCardRects(own: Element | null): Rect[] {
  if (typeof document === 'undefined') return []
  const out: Rect[] = []
  document.querySelectorAll('.react-flow__node').forEach(el => {
    if (el === own) return
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
  })
  return out
}

export function viewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 0, height: 0 }
  return { width: window.innerWidth, height: window.innerHeight }
}
