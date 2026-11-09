/**
 * Nothing sits under an open form (DL round 5, 9 Nov; rehearsal 2b: the zoom row covered "Set figure / Try without saving"). When focus
 * enters a form inside a canvas card (a figure editor, a set-aside ask), once the card has kept its size for a frame the board moves up by
 * just enough that the form clears every control at the canvas's foot (the zoom row, the more-below cue). Nothing moves when it is clear,
 * and nothing moves sideways or zooms.
 */
import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'

/** The canvas's foot controls a form must clear. */
export const FOOT_SELECTORS = ['nav[aria-label="Viewport controls"]', '[data-testid="view-below-cue"] button'] as const
/** Clear space kept between a form and the control under it, px. */
export const FOOT_GAP = 12

type Rect = { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number }
const across = (a: Rect, b: Rect) => Math.min(a.right, b.right) > Math.max(a.left, b.left)

/** How far up (px) the form must move to clear every foot control it shares columns with; 0 when it already does. */
export function footOverlap(form: Rect, foot: readonly Rect[]): number {
  let up = 0
  for (const f of foot) if (across(form, f) && form.bottom > f.top - FOOT_GAP) up = Math.max(up, form.bottom - (f.top - FOOT_GAP))
  return Math.ceil(up)
}

export function useFormClearOfFoot(): void {
  const { getViewport, setViewport } = useReactFlow()
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null
    const into = (e: FocusEvent) => {
      const at = e.target instanceof Element ? e.target : null
      const form = at?.closest('.react-flow__node-viewCard form, .react-flow__node-viewCard [role="group"]') ?? null
      if (form === null) return
      if (t !== null) clearInterval(t)
      let last = '', ticks = 0
      t = setInterval(() => {
        ticks += 1
        const r = form.getBoundingClientRect(), here = `${r.top},${r.height}`
        if (!form.isConnected || ticks > 40) { clearInterval(t!); t = null; return }
        if (here !== last) { last = here; return }
        clearInterval(t!); t = null
        const foot = FOOT_SELECTORS.flatMap((s) => [...document.querySelectorAll(s)].map((x) => x.getBoundingClientRect()))
        const up = footOverlap(r, foot)
        if (up === 0) return
        const v = getViewport(), still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
        void setViewport({ ...v, y: v.y - up }, { duration: still ? 0 : 200 })
      }, 50)
    }
    document.addEventListener('focusin', into)
    return () => { document.removeEventListener('focusin', into); if (t !== null) clearInterval(t) }
  }, [getViewport, setViewport])
}
