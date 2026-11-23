import { useLayoutEffect, useRef, useState } from 'react'
import { DOCK_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR } from '../../canvas/utils/computeFitPadding'
import { FOOT_CONTROLS, HEAD_CONTROLS } from '../regions'
import { freeCanvas } from '../v12/edit/placeBeside'

const GAP = 8
const BOUNDARIES = [DOCK_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR, FOOT_CONTROLS[0], ...HEAD_CONTROLS].join(',')

/** Place the foot between the rails and the dock. The flex layout centres a tray above the row. */
export function useFootLayout() {
  const footRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)

  useLayoutEffect(() => {
    const foot = footRef.current
    const row = rowRef.current
    if (foot === null || row === null) return

    const measure = () => {
      const free = freeCanvas()
      const rail = document.querySelector(FOOT_CONTROLS[0])?.getBoundingClientRect()
      const railVisible = rail !== undefined && rail.width > 0 && rail.height > 0
      const left = Math.max(free.left, railVisible ? rail.right : 0) + GAP
      const bottom = railVisible ? Math.min(free.bottom - GAP, rail.bottom) : free.bottom - GAP
      const width = Math.max(0, free.right - GAP - left)
      foot.style.setProperty('--foot-left', `${left}px`)
      foot.style.setProperty('--foot-width', `${width}px`)
      foot.style.setProperty('--foot-bottom', `${window.innerHeight - bottom}px`)
      foot.style.setProperty('--foot-height', `${Math.max(0, bottom - free.top - GAP)}px`)

      // Read the expanded notice even when folded, so a resize can give the words back.
      // Restore the measured mode in the same frame; the zoom button keeps its DOM identity.
      delete row.dataset.compact
      const cue = row.querySelector('[data-testid="view-below-cue"]')?.getBoundingClientRect()
      const notice = row.querySelector('[data-foot-zoom]')?.getBoundingClientRect()
      const fold = notice !== undefined && notice.width + (cue ? cue.width + GAP : 0) > width
      if (fold) row.dataset.compact = 'true'
      setCompact(fold)
    }

    let frame = 0
    const schedule = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => { frame = 0; measure() })
    }
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    const observeSizes = () => {
      sizes?.disconnect()
      for (const element of document.querySelectorAll(BOUNDARIES)) sizes?.observe(element)
      for (const element of row.children) sizes?.observe(element)
      schedule()
    }
    const children = new MutationObserver(observeSizes)
    children.observe(row, { childList: true })
    // The dock can mount after the canvas has drawn its model.
    if (foot.parentElement !== null) children.observe(foot.parentElement, { childList: true })
    observeSizes()
    measure()
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
      sizes?.disconnect()
      children.disconnect()
    }
  }, [])

  return { footRef, rowRef, compact }
}
