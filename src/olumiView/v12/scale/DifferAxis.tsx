import type { Difference } from '../../../olumiCore/team/differences'
import { typography } from '../../../styles/typography'
import type { View } from '../../client'
import { Hover } from '../../look/Hover'
import { OkIcon } from '../../look/icons'

type Span = { readonly lo: number; readonly hi: number }
/** A side's span and the words for it, both from the one revealed figure, so the mark and its label can never disagree. */
type Side = Span & { readonly text: string; readonly unit: string }

/** Each side's span from the revealed figure it names, or null when any side has none (a link, a factor, or a figure core did not send). */
export function sideSpans(view: View, d: Difference): Side[] | null {
  if (d.sides.length < 2) return null
  const spans = d.sides.map((s) => {
    const v = view.collab.shared.find((x) => x.id === s.view)
    const f = v?.figures.find((x) => x.quantity === d.record)
    // interim text compare: retired when Core sends a typed figure reference per side (Core ask)
    if (f === undefined || f.text !== s.figure) return null
    return 'value' in f ? { lo: f.value, hi: f.value, text: f.text, unit: f.unit } : { lo: f.low, hi: f.high, text: f.text, unit: f.unit }
  })
  if (!spans.every((s): s is Side => s !== null && Number.isFinite(s.lo) && Number.isFinite(s.hi))) return null
  // One axis only for one typed quantity in one unit: figures in different units are never drawn against each other.
  return new Set(spans.map((s) => s.unit)).size === 1 ? spans : null
}

/** The shared axis's ends: every span inside with a small margin; one point alone gets a margin of its own size (or 1). */
export function axisOf(spans: readonly Span[]): Span {
  const lo = Math.min(...spans.map((s) => s.lo)), hi = Math.max(...spans.map((s) => s.hi))
  const pad = hi > lo ? (hi - lo) * 0.08 : Math.max(Math.abs(lo) * 0.1, 1)
  return { lo: lo - pad, hi: hi + pad }
}

/** Where on a 0–100 track a value falls on the axis. */
export const at = (axis: Span, x: number): number => ((x - axis.lo) / (axis.hi - axis.lo)) * 100

const ROW = 'col-span-full grid min-w-0 grid-cols-subgrid items-center gap-x-2 rounded-sm'
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header'

/** One shared track for comparable figures, with each person's own words beside their mark. */
export function DifferAxis({ view, d, at: id, showWords = false, onFocusCard }: {
  view: View
  d: Difference
  at: string
  showWords?: boolean
  onFocusCard?: () => void
}): JSX.Element | null {
  const spans = sideSpans(view, d)
  if (spans === null && !showWords) return null
  const axis = spans === null ? null : axisOf(spans)
  const values = spans?.flatMap(({ lo, hi }) => [lo, hi]) ?? []
  return (
    <ul data-form="CH-differ" data-testid={`${id}-${axis === null ? 'sides' : 'ranges'}`}
      className={`m-0 grid list-none gap-2 p-0 ${axis === null ? 'grid-cols-[minmax(0,1fr)_minmax(0,2fr)]' : 'grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]'}`}>
      {d.sides.map((s, i) => {
        const span = spans?.[i]
        const contents = (
          <>
            <span className="flex min-w-0 items-center gap-1.5 break-words text-text-header">
              <OkIcon id="person-mark" size={14} decorative inherit testid="differ-person-mark" />
              <span className="min-w-0">{s.holder}</span>
            </span>
            {axis !== null && span !== undefined && <SpanTrack axis={axis} span={span} values={values} />}
            <span className="min-w-0 break-words text-text-body" data-range-text="">{span?.text ?? s.figure}</span>
          </>
        )
        return onFocusCard === undefined ? (
          <Hover as="li" key={s.holder_id} className={`${ROW} ${typography.viewPanelMeta} ${FOCUS}`} data-difference-side={s.holder_id} words={s.title}>
            {contents}
          </Hover>
        ) : (
          <li key={s.holder_id} className={ROW} data-difference-side={s.holder_id}>
            <Hover as="button" type="button" words={s.title} onClick={onFocusCard}
              className={`${ROW} ${typography.viewPanelMeta} ${FOCUS} text-left hover:bg-panel-hover`}>
              {contents}
            </Hover>
          </li>
        )
      })}
    </ul>
  )
}

function SpanTrack({ axis, span, values }: { axis: Span; span: Span; values: readonly number[] }): JSX.Element {
  const start = at(axis, span.lo)
  const end = at(axis, span.hi)
  const minimum = 1.6
  const point = span.lo === span.hi
  const short = end - start < minimum
  const midpoint = (start + end) / 2
  // Clip visual padding at the track and the next greater value, so a short mark cannot overtake it.
  const next = values.reduce((limit, value) => value > span.hi ? Math.min(value, limit) : limit, Infinity)
  const limit = next === Infinity ? end : at(axis, next)
  const left = short ? Math.max(0, midpoint - minimum / 2) : start
  const right = short ? Math.min(100, midpoint + minimum / 2, point ? 100 : limit) : end
  return (
    <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="block h-2 w-full overflow-visible" aria-hidden="true" data-range-lo={span.lo} data-range-hi={span.hi}>
      <rect x="0" y="3.5" width="100" height="1" className="fill-current text-panel-border" />
      <rect x={left} y={point ? 0 : 1.5} width={right - left} height={point ? 8 : 5} rx={point ? undefined : 1}
        className="fill-current text-text-header" data-range-mark={point ? 'point' : 'span'} />
    </svg>
  )
}
