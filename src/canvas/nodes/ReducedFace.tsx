/**
 * The reduced face of a card or the question on the olumi-core lane, zoomed out below READABLE_WHOLE_ZOOM. DL ruling 10 Nov (evening), which
 * REVERSES the earlier 12 px rule: Paul's "the whole model in view at first open, as the previous product did" wins. The face follows the
 * previous product's treatment: the card's WHOLE name, wrapped, in the previous product's own zoomed-out type (the declared title size times
 * `labelCounterScale`, which CanvasLabelScaleSync writes: capped at LABEL_COUNTER_SCALE_CAP, 1.64), and ONE line beneath it in the card's body
 * size: an option's chance in the engine's full words, or the card's value or range. A name ends in "…" only when it truly cannot fit its card's
 * box at that size (whole lines of the box, never characters). The face fills only its box, so no card moves between the overview and zoom 1.
 * The question is never clamped; its face reserves the height it really needs in its own box, and the canvas lays the row below out from it.
 * Core's words, verbatim.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CANVAS_TYPE_PX } from '../../styles/typography'

export const REDUCED_LINE_HEIGHT = 1.15
/** The face's own vertical padding (py-1.5, top and bottom), px. */
export const REDUCED_PAD_Y = 12
/** The declared sizes of the face's two kinds of text: the previous product's card title and card body (CANVAS_TYPE_PX), before the counter-scale. */
export const REDUCED_NAME_PX = CANVAS_TYPE_PX.nodeTitleWide, REDUCED_LINE_PX = CANVAS_TYPE_PX.nodeLabel

/** How many whole name lines fit in a box `boxH` tall (CSS px, unscaled) at `px`, under a summary line `tailH` tall; at least one. */
export const headingLines = (boxH: number, px: number, tailH: number): number => Math.max(1, Math.floor((boxH - REDUCED_PAD_Y - tailH) / (px * REDUCED_LINE_HEIGHT)))

type Props = {
  /** The counter-scale the previous product's canvas draws labels at this zoom (camera.ts `reducedFaceSize`). */
  scale: number; title: ReactNode; titleAttrs?: Record<string, string>; rootAttrs?: Record<string, string>; semibold?: boolean; selected?: boolean
  /** The one line beneath the name. */
  line?: ReactNode
  /** The face is its content's height, at least its box, growing downward only; the name is never clamped (the question). */
  grow?: boolean
}

export function ReducedFace({ scale, title, titleAttrs, line = null, rootAttrs, semibold = false, selected = false, grow = false }: Props): JSX.Element {
  const root = useRef<HTMLDivElement>(null), tail = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState(0)
  useLayoutEffect(() => {
    const box = root.current?.parentElement?.clientHeight ?? 0
    setLines(box > 0 ? headingLines(box, REDUCED_NAME_PX * scale, tail.current?.offsetHeight ?? 0) : 0)
  })
  // The room the question really needs is reserved in its own box (DL 10 Nov, Codex at 900 x 704: the grown face ended 5.5 px inside the
  // options below it). The box's measured height then carries it. Measured at the face's content height, never its previous size.
  useLayoutEffect(() => {
    const face = root.current, parent = face?.parentElement ?? null
    if (!grow || face === null || parent === null) return
    face.style.minHeight = '0px'; parent.style.minHeight = ''
    const need = face.offsetHeight
    face.style.minHeight = ''
    if (need > 0) parent.style.minHeight = `${need}px`
  })
  // A tall card is not drawn mostly empty (DL 10 Nov): the face is its content's height (at most its box), and what is left of the card's box
  // below it is not drawn (brand.css `[data-reduced-clip]`). The box itself keeps its height, so no card moves between the overview and zoom 1.
  useLayoutEffect(() => {
    const face = root.current, parent = face?.parentElement ?? null
    if (grow || face === null || parent === null) return
    const rest = parent.clientHeight - face.offsetHeight
    if (face.offsetHeight > 0 && rest > 0) { parent.setAttribute('data-reduced-clip', ''); parent.style.setProperty('--reduced-clip-bottom', `${rest}px`) }
    else { parent.removeAttribute('data-reduced-clip'); parent.style.removeProperty('--reduced-clip-bottom') }
  })
  useLayoutEffect(() => { const parent = root.current?.parentElement ?? null; return () => { if (parent !== null) { parent.style.minHeight = ''; parent.removeAttribute('data-reduced-clip'); parent.style.removeProperty('--reduced-clip-bottom') } } }, [])
  const whole = typeof title === 'string' ? title : undefined
  return (
    <div ref={root} {...rootAttrs} data-reduced-face="" className={`absolute !m-0 flex flex-col gap-0.5 rounded-xl border bg-panel px-2 py-1.5 font-sans ${grow ? 'left-0 right-0 top-0 min-h-full' : 'left-0 right-0 top-0 max-h-full overflow-hidden'} ${semibold ? 'font-semibold' : 'font-medium'} text-text-header${selected ? ' ring-1 ring-text-header' : ''}`}
      // The previous product's own rule: the label scale, `labelCounterScale(zoom)`; the name and the line are declared sizes times it.
      style={{ '--canvas-label-scale': String(scale), lineHeight: REDUCED_LINE_HEIGHT, borderColor: 'inherit' } as CSSProperties}>
      <p title={whole} {...titleAttrs} data-reduced-heading="" className={grow ? 'flex-none' : 'min-h-0'}
        style={{ fontSize: `calc(${REDUCED_NAME_PX}px*var(--canvas-label-scale,1))`, overflowWrap: 'anywhere', ...(!grow && lines > 0 ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden' } : grow ? {} : { overflow: 'hidden' }) }}>{title}</p>
      {line === null ? null : (
        <div ref={tail} className="flex-none truncate font-normal text-text-body" data-reduced-chance="" style={{ fontSize: `calc(${REDUCED_LINE_PX}px*var(--canvas-label-scale,1))` }}>{line}</div>
      )}
    </div>
  )
}
