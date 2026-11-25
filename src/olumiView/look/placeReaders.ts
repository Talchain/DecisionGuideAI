import { canvasCardRects, viewportSize } from '../../canvas/components/hoverCard/hoverCardPlacement'
import { DOCK_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR } from '../../canvas/utils/computeFitPadding'
import { FOOT_CONTROLS, frameTop, LENS_KEYS, type Rect } from '../regions'
import type { ClosestAnchor } from './Tip'

/** The canvas below the head and top bar, between the left rail and the dock. */
export function freeCanvas(): Rect {
  const rail = document.querySelector(SIDEBAR_SELECTOR)?.getBoundingClientRect()
  const bar = document.querySelector(TOP_BAR_SELECTOR)?.getBoundingClientRect()
  const left = rail !== undefined && rail.width > 0 && rail.right < window.innerWidth / 2 ? rail.right : 0
  const barBottom = bar !== undefined && bar.height > 0 ? bar.bottom : 0
  return { left, top: Math.max(frameTop(0), barBottom), right: viewportSize().width, bottom: window.innerHeight }
}

export function regionFor(el: ClosestAnchor | 'canvas' | null = null): Rect {
  if (el === 'canvas') return freeCanvas()
  const dock = el?.closest(DOCK_SELECTOR)
  if (dock) return dock.getBoundingClientRect()
  if (el?.closest('.react-flow')) return freeCanvas()
  return { left: 8, top: 8, right: window.innerWidth - 8, bottom: window.innerHeight - 8 }
}

export function openBoxes({ except, chromeOnly = false }: { except?: Element; chromeOnly?: boolean } = {}): Rect[] {
  const chrome = [...LENS_KEYS, ...FOOT_CONTROLS]
  const selectors = chromeOnly ? chrome : ['[data-testid="lane-inspector"]', ...chrome]
  return [...document.querySelectorAll(selectors.join(','))].flatMap((el) => {
    if (el === except) return []
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return []
    const visibility = getComputedStyle(el).visibility
    return visibility === 'hidden' || visibility === 'collapse' ? [] : [rect]
  })
}

export const lanePlaceHost = {
  regionFor,
  openBoxes,
  cards: (el: ClosestAnchor | null) => (el?.closest('.react-flow') ? canvasCardRects(el.closest('.react-flow__node')) : []),
}
