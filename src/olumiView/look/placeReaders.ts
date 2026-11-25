import { canvasCardRects } from '../../canvas/components/hoverCard/hoverCardPlacement'
import { DOCK_SELECTOR } from '../../canvas/utils/computeFitPadding'
import { FOOT_CONTROLS, LENS_KEYS, type Rect } from '../regions'
import { freeCanvas } from '../v12/edit/placeBeside'

export function regionFor(el: Element | null = null): Rect {
  const dock = el?.closest(DOCK_SELECTOR)
  if (dock) return dock.getBoundingClientRect()
  if (el?.closest('.react-flow')) return freeCanvas()
  return { left: 8, top: 8, right: window.innerWidth - 8, bottom: window.innerHeight - 8 }
}

export function openBoxes(): Rect[] {
  const selectors = ['[data-testid="lane-inspector"]', ...LENS_KEYS, ...FOOT_CONTROLS]
  return [...document.querySelectorAll(selectors.join(','))].flatMap((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return []
    const visibility = getComputedStyle(el).visibility
    return visibility === 'hidden' || visibility === 'collapse' ? [] : [rect]
  })
}

export const lanePlaceHost = {
  regionFor,
  openBoxes,
  cards: (el: Element | null) => (el?.closest('.react-flow') ? canvasCardRects(el.closest('.react-flow__node')) : []),
}
