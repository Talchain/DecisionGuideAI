/**
 * Each card's chip rail (V11's reveal chips, the strategy chip, TM-04's doubted links), as boxes the link words keep clear of. The rail
 * hangs below its card out of flow ("so no card moves"), so React Flow's measured card box leaves it out. The link words were placed "clear
 * of every card" (canvas/edges/ViewLinkEdge.tsx), so they could land on a chip: Paul's gate, 8 Nov, found "replaces" over the end of a
 * doubted link's chip. Each rail publishes its chips' boxes in flow units from its card's top-left, and the link words keep clear of them
 * as they do of the cards. Nothing here moves a card, a chip or a line.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { create } from 'zustand'

/** A chip's box in flow units, from its card's top-left corner. */
export type RailBox = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** One rail: the card it hangs from and its chips' boxes. */
export type RailEntry = { readonly card: string; readonly boxes: readonly RailBox[] }

interface RailBoxesState {
  readonly rails: Readonly<Record<string, RailEntry>>
  put(key: string, card: string, boxes: readonly RailBox[]): void
  drop(key: string): void
}

const same = (a: RailEntry | undefined, card: string, b: readonly RailBox[]): boolean => {
  if (a === undefined || a.card !== card || a.boxes.length !== b.length) return false
  for (let k = 0; k < b.length; k += 1) { const p = a.boxes[k]!, q = b[k]!; if (p.x !== q.x || p.y !== q.y || p.w !== q.w || p.h !== q.h) return false }
  return true
}

export const useRailBoxes = create<RailBoxesState>((set, get) => ({
  rails: {},
  put: (key, card, boxes) => { if (!same(get().rails[key], card, boxes)) set((s) => ({ rails: { ...s.rails, [key]: { card, boxes } } })) },
  drop: (key) => { if (get().rails[key] !== undefined) set((s) => { const next = { ...s.rails }; delete next[key]; return { rails: next } }) },
}))

/** The rails' chips on the board, in flow units, for the cards given (each card's top-left as React Flow holds it): boxes the link
 *  words keep clear of, beside the cards themselves. A rail whose card is not given is left out. */
export function railObstacles(cards: ReadonlyArray<{ readonly id: string; readonly x: number; readonly y: number }>, rails: Readonly<Record<string, RailEntry>>):
  { id: string; x: number; y: number; w: number; h: number }[] {
  const at = new Map(cards.map((c) => [c.id, c] as const))
  const out: { id: string; x: number; y: number; w: number; h: number }[] = []
  for (const key of Object.keys(rails)) {
    const r = rails[key]!, c = at.get(r.card)
    if (c === undefined) continue
    r.boxes.forEach((b, k) => { out.push({ id: `${key}#${k}`, x: c.x + b.x, y: c.y + b.y, w: b.w, h: b.h }) })
  }
  return out
}

/** A chip's offset from its card's top-left, in flow units: the layout offsets up to the React Flow node, so the zoom does not enter.
 *  Null when the chip is not inside a node (a spec's bare render). */
function offsetInCard(el: HTMLElement): { x: number; y: number } | null {
  let x = 0, y = 0
  for (let e: HTMLElement | null = el; e !== null; e = e.offsetParent as HTMLElement | null) {
    if (e.classList.contains('react-flow__node')) return { x, y }
    x += e.offsetLeft; y += e.offsetTop
  }
  return null
}

/** Layout offsets are whole pixels; each box keeps 1 unit more on every side, so rounding never lets words graze a chip. */
const PAD = 1

function measure(rail: HTMLElement): RailBox[] {
  const out: RailBox[] = []
  for (const chip of Array.from(rail.children)) {
    if (!(chip instanceof HTMLElement) || chip.offsetWidth === 0) continue
    const at = offsetInCard(chip)
    if (at !== null) out.push({ x: at.x - PAD, y: at.y - PAD, w: chip.offsetWidth + 2 * PAD, h: chip.offsetHeight + 2 * PAD })
  }
  return out
}

/** A rail's ref (`key` names the rail, `card` the card it hangs from): it publishes the rail's chips as they are drawn, wrap or change,
 *  and as the card grows or shrinks (a "Show all" moves the rail without drawing it again), and takes them back when the rail goes. */
export function useRailBoxesRef(key: string, card: string): (el: HTMLDivElement | null) => void {
  const el = useRef<HTMLDivElement | null>(null)
  const seen = useRef<ResizeObserver | null>(null)
  const read = useCallback(() => { const r = el.current; if (r !== null) useRailBoxes.getState().put(key, card, measure(r)) }, [key, card])
  // After every render too (an equal measure is not written): a chip added in the same row does not resize the rail, so the observer
  // alone would miss it.
  useLayoutEffect(() => { read() })
  useEffect(() => () => { seen.current?.disconnect(); useRailBoxes.getState().drop(key) }, [key])
  return useCallback((r: HTMLDivElement | null) => {
    seen.current?.disconnect(); seen.current = null
    el.current = r
    if (r === null) { useRailBoxes.getState().drop(key); return }
    read()
    if (typeof ResizeObserver !== 'undefined') {
      seen.current = new ResizeObserver(read)
      seen.current.observe(r)
      // The rail hangs at the card's foot: when the card's height changes, the chips move though the rail keeps its size.
      const node = r.closest('.react-flow__node')
      if (node !== null) seen.current.observe(node)
    }
  }, [key, read])
}
