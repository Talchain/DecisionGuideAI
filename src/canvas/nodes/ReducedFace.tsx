/**
 * The reduced face of a card or the question on the olumi-core lane, zoomed out (DL ruling, 10 Nov, on the first screen look at hiring: "a
 * reduced face never leaves its own card's box"). It fills the box of the full face it stands over, never beyond it: the chance (an option's)
 * is always drawn whole on its own line at the foot, and the heading takes the whole lines left above it, ending in "…" when it does not fit.
 * Core's words, verbatim; the clamp is by lines of the box, never by characters.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export const REDUCED_LINE_HEIGHT = 1.15
/** The face's own vertical padding (py-1.5, top and bottom), px. */
export const REDUCED_PAD_Y = 12

/** How many whole heading lines fit in a box `boxH` tall (CSS px, unscaled) at `px`, under a chance line `tailH` tall; at least one. */
export const headingLines = (boxH: number, px: number, tailH: number): number => Math.max(1, Math.floor((boxH - REDUCED_PAD_Y - tailH) / (px * REDUCED_LINE_HEIGHT)))

type Props = { px: number; title: ReactNode; titleAttrs?: Record<string, string>; chance?: ReactNode; rootAttrs?: Record<string, string>; semibold?: boolean; selected?: boolean }

export function ReducedFace({ px, title, titleAttrs, chance = null, rootAttrs, semibold = false, selected = false }: Props): JSX.Element {
  const root = useRef<HTMLDivElement>(null), tail = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState(0)
  useLayoutEffect(() => {
    const box = root.current?.parentElement?.clientHeight ?? 0
    setLines(box > 0 ? headingLines(box, px, tail.current?.offsetHeight ?? 0) : 0)
  })
  return (
    <div ref={root} {...rootAttrs} data-reduced-face="" className={`absolute inset-0 !m-0 flex flex-col gap-0.5 overflow-hidden rounded-xl border bg-panel px-2 py-1.5 font-sans ${semibold ? 'font-semibold' : 'font-medium'} text-text-header${selected ? ' ring-1 ring-text-header' : ''}`}
      style={{ fontSize: px, lineHeight: REDUCED_LINE_HEIGHT, borderColor: 'inherit' }}>
      <p {...titleAttrs} data-reduced-heading="" className="min-h-0"
        style={lines > 0 ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden' } : { overflow: 'hidden' }}>{title}</p>
      {chance === null ? null : <div ref={tail} className="flex-none font-semibold" data-reduced-chance="">{chance}</div>}
    </div>
  )
}
