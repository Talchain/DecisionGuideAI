/**
 * DL round 5 (9 Nov; rehearsal item 10): the canvas's controls along its head (Model · Explore · Team, Add a figure) sit on an opaque band
 * of the canvas colour, so a card the person pans up goes under the band instead of showing its words through the controls. The band runs
 * from the window's top to just below the lowest of those controls, across the free canvas (left of the dock). It takes no clicks and
 * says nothing; the board's fit already keeps every card below it at rest (computeFitPadding counts the lens bar).
 */
import { useLayoutEffect, useState } from 'react'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { LENS_BAR_TESTID } from '../canvas/artefacts/LensBar'

/** Clear space below the lowest head control, px. */
export const BAND_GAP = 8
const HEAD_CONTROLS = [`[data-testid="${LENS_BAR_TESTID}"]`, '[data-testid="view-add-figure"]'] as const

/** The band's height: the lowest head control's foot plus the gap; 0 when none is drawn. */
export function bandHeightOf(feet: readonly number[]): number {
  let low = 0
  for (const f of feet) if (f > low) low = f
  return low === 0 ? 0 : Math.ceil(low + BAND_GAP)
}

export function CanvasHeadBand(): JSX.Element | null {
  const [box, setBox] = useState({ h: 0, right: 0 })
  useLayoutEffect(() => {
    const measure = () => {
      const feet = HEAD_CONTROLS.flatMap((s) => [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect().bottom))
      const next = { h: bandHeightOf(feet), right: measureDockInset() }
      setBox((b) => (b.h === next.h && b.right === next.right ? b : next))
    }
    measure()
    const t = setInterval(measure, 500)
    window.addEventListener('resize', measure)
    return () => { clearInterval(t); window.removeEventListener('resize', measure) }
  }, [])
  if (box.h === 0) return null
  return (
    <div aria-hidden="true" data-testid="view-canvas-head-band"
      className="pointer-events-none fixed left-0 top-0 z-[4] bg-canvas shadow-[0_10px_14px_-10px_rgba(38,38,38,0.16)]"
      style={{ height: box.h, right: box.right }} />
  )
}
