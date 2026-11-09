/**
 * The canvas's HEAD region drawn (./regions.ts): an opaque band of the canvas colour under Model · Explore · Team and Add a figure, from
 * the window's top to just below the lowest of them, across the free canvas, so a card the person pans up goes under it instead of showing
 * its words through the controls (DL round 5). It takes no clicks and says nothing.
 */
import { useLayoutEffect, useState } from 'react'
import { regionsOf } from './regions'

export function CanvasHeadBand(): JSX.Element | null {
  const [box, setBox] = useState({ h: 0, right: 0 })
  useLayoutEffect(() => {
    const measure = () => {
      const { head } = regionsOf(), next = { h: head.bottom, right: window.innerWidth - head.right }
      setBox((b) => (b.h === next.h && b.right === next.right ? b : next))
    }
    measure()
    // The lens bar settles its place after mount and moves with the dock; a light re-read keeps the band under it.
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
