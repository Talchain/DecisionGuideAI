/**
 * V11: the team's disagreement is seen without looking for it. Once per reveal (the scenario and its chip views), after the board has
 * settled, if a chip (./RevealMarks.tsx) lies outside the canvas, the board is panned just enough to bring it in, at the person's own zoom.
 * Never after the person has moved the board themselves, and never again for the same reveal. Paul's 1232 x 704 screen framed the board
 * top-aligned with the chip below the fold (7 Nov shots).
 */
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useViewStore } from './store'
import { revealOf } from './reveal'
import { viewLaying } from './canvas'

/** Room kept between the chip and the canvas's edge (px). */
const MARGIN = 40
const TICK = 250, MAX_TICKS = 40

export function useRevealInView(movedAt: MutableRefObject<number>): void {
  const { getViewport, setViewport } = useReactFlow()
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid)
  const key = useMemo(() => {
    const ids = revealOf(view)?.marks.filter((m) => m.isChip).map((m) => m.view).join(',') ?? ''
    return ids === '' ? '' : `${sid}:${ids}`
  }, [view, sid])
  const done = useRef(new Set<string>())
  useEffect(() => {
    if (key === '' || done.current.has(key)) return
    const moves = movedAt.current
    let ticks = 0, last = ''
    const t = setInterval(() => {
      ticks += 1
      const finish = () => { clearInterval(t); done.current.add(key) }
      if (moves !== movedAt.current || ticks > MAX_TICKS) return finish()
      const chip = document.querySelector('[data-reveal-chip]'), pane = document.querySelector('.react-flow')
      if (chip === null || pane === null || viewLaying()) return
      const c = chip.getBoundingClientRect(), p = pane.getBoundingClientRect()
      // Settled: the chip has kept its place for one tick (the board's own framing eases for 400 ms).
      const here = `${Math.round(c.x)},${Math.round(c.y)}`
      if (here !== last) { last = here; return }
      finish()
      const below = c.bottom - (p.bottom - MARGIN), above = p.top + MARGIN - c.top
      if (below <= 0 && above <= 0) return
      const vp = getViewport()
      void setViewport({ ...vp, y: vp.y + (below > 0 ? -below : above) }, { duration: 300 })
    }, TICK)
    return () => clearInterval(t)
  }, [key, movedAt, getViewport, setViewport])
}
