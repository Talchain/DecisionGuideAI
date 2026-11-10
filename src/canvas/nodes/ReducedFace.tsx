/**
 * The reduced face of a card or the question on the olumi-core lane, zoomed out (DL ruling, 10 Nov, on the first screen look at hiring: "a
 * reduced face never leaves its own card's box"). It fills the box of the full face it stands over, never beyond it: the chance (an option's)
 * is always drawn whole on its own line at the foot, and the heading takes the whole lines left above it, ending in "…" when it does not fit.
 * Core's words, verbatim; the clamp is by lines of the box, never by characters.
 *
 * DL ruling 10 Nov (second look, 1232 x 704): an option's face ALWAYS shows two things and never clips either: line 1 its name (one line,
 * "…" when long, the whole name on hover), line 2 its chance. When the engine's chance words do not fit one line at 12 px as drawn, the
 * percentage part is drawn exactly as the engine words it without the trailing word "chance" ("about 23%"); the full words stay on the
 * element's title. The face grows downward past its box when the two lines need it (the layout leaves the row below free), never
 * covering a neighbour's text. The question's face is never clamped: its whole text, growing downward only.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export const REDUCED_LINE_HEIGHT = 1.15
/** The face's own vertical padding (py-1.5, top and bottom), px. */
export const REDUCED_PAD_Y = 12

/** How many whole heading lines fit in a box `boxH` tall (CSS px, unscaled) at `px`, under a chance line `tailH` tall; at least one. */
export const headingLines = (boxH: number, px: number, tailH: number): number => Math.max(1, Math.floor((boxH - REDUCED_PAD_Y - tailH) / (px * REDUCED_LINE_HEIGHT)))

/** The engine's chance words without their trailing word "chance" ("about 23% chance" -> "about 23%"); null when they do not end that way,
 *  so nothing is ever reformatted or invented. */
export const withoutChanceWord = (words: string): string | null => {
  const m = /^(.*\S)\s+chance$/.exec(words)
  return m === null ? null : m[1]!
}

type Props = {
  px: number; title: ReactNode; titleAttrs?: Record<string, string>; rootAttrs?: Record<string, string>; semibold?: boolean; selected?: boolean
  /** An option's chance, drawn whole on its own line: the engine's words, and the same words without "chance" for when those do not fit. */
  chance?: ReactNode; chanceWords?: string; chanceShort?: ReactNode
  /** The face is its content's height, at least its box, growing downward only; the heading is never clamped to the box (the question). */
  grow?: boolean
}

export function ReducedFace({ px, title, titleAttrs, chance = null, chanceWords, chanceShort = null, rootAttrs, semibold = false, selected = false, grow = false }: Props): JSX.Element {
  const root = useRef<HTMLDivElement>(null), tail = useRef<HTMLDivElement>(null), measure = useRef<HTMLSpanElement>(null)
  const [lines, setLines] = useState(0), [short, setShort] = useState(false)
  const twoLines = chance !== null
  useLayoutEffect(() => {
    const box = root.current?.parentElement?.clientHeight ?? 0
    setLines(box > 0 ? headingLines(box, px, tail.current?.offsetHeight ?? 0) : 0)
    // The chance words are drawn whole when they fit the line at this size (layout px, so the card's zoom does not enter); else the short form.
    const need = measure.current?.offsetWidth ?? 0, have = tail.current?.clientWidth ?? 0
    setShort(chanceShort !== null && need > 0 && have > 0 && need > have)
  })
  // The room this face really needs is reserved in its card's own box (DL 10 Nov, Codex at 900 x 704: the grown question face ended 5.5 px
  // inside the option faces below it, because the layout only knew the full face's height). The card's measured height then carries it, and
  // the canvas lays the row below out again from it. Measured at the face's content height, never its own previous size, so it can shrink.
  const reserves = grow || twoLines
  useLayoutEffect(() => {
    const face = root.current, parent = face?.parentElement ?? null
    if (!reserves || face === null || parent === null) return
    face.style.minHeight = '0px'; parent.style.minHeight = ''
    const need = face.offsetHeight
    face.style.minHeight = ''
    if (need > 0) parent.style.minHeight = `${need}px`
  })
  useLayoutEffect(() => { const parent = root.current?.parentElement ?? null; return () => { if (parent !== null) parent.style.minHeight = '' } }, [])
  const clamp = twoLines ? 1 : grow ? 0 : lines
  const whole = typeof title === 'string' ? title : undefined
  return (
    <div ref={root} {...rootAttrs} data-reduced-face="" className={`absolute !m-0 flex flex-col gap-0.5 rounded-xl border bg-panel px-2 py-1.5 font-sans text-[length:calc(12px*var(--canvas-label-scale,1))] ${grow || twoLines ? 'left-0 right-0 top-0 min-h-full' : 'inset-0 overflow-hidden'} ${semibold ? 'font-semibold' : 'font-medium'} text-text-header${selected ? ' ring-1 ring-text-header' : ''}`}
      // The size is the canvas's own counter-scale token: 12 px declared times the scale this face carries, 1 / zoom, so it draws at 12 px.
      style={{ '--canvas-label-scale': String(px / 12), lineHeight: REDUCED_LINE_HEIGHT, borderColor: 'inherit' } as CSSProperties}>
      <p title={whole} {...titleAttrs} data-reduced-heading="" className={twoLines || grow ? 'flex-none' : 'min-h-0'}
        style={clamp > 0 ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: clamp, overflow: 'hidden', overflowWrap: 'anywhere' } : grow ? { overflowWrap: 'anywhere' } : { overflow: 'hidden' }}>{title}</p>
      {chance === null ? null : (
        <div ref={tail} className="flex-none whitespace-nowrap font-semibold" data-reduced-chance="" data-short={short || undefined} title={short ? chanceWords : undefined}>
          {short ? chanceShort : chance}
        </div>
      )}
      {chance === null ? null : <span ref={measure} aria-hidden="true" data-reduced-measure="" className="invisible absolute left-2 top-0 whitespace-nowrap font-semibold">{chanceWords}</span>}
    </div>
  )
}
