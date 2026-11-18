/**
 * Where two or more people differ on one card, DRAWN (overnight 18 Nov, lane wip/v12-tab-team): who said what as marks on one shared axis,
 * and what each person's figure does to each option's chance as bars on a 0–100% track. Every number drawn is the engine's own: a revealed
 * figure's `value` or `low`/`high` (`collab.shared[].figures`, found by the side's `view` id and the difference's `record`), labelled with that
 * same figure's own `text`, and core's `chance` for each holder, labelled with its `text`. Nothing is rounded, averaged, ranked or marked right; the axis
 * carries no tick of its own. Lengths are SVG attributes, so no inline style is written.
 */
import type { View } from '../../client'
import type { Difference } from '../../../olumiCore/team/differences'
import { AVATAR, LABEL, META } from '../../../olumiCore/team/ui'
import { typography } from '../../../styles/typography'

type Span = { readonly lo: number; readonly hi: number }
/** A side's span and the words for it, both from the one revealed figure, so the mark and its label can never disagree. */
type Side = Span & { readonly text: string }

/** Each side's span from the revealed figure it names, or null when any side has none (a link, a factor, or a figure core did not send). */
export function sideSpans(view: View, d: Difference): Side[] | null {
  if (d.sides.length < 2) return null
  const spans = d.sides.map((s) => {
    const v = view.collab.shared.find((x) => x.id === s.view)
    const f = v?.figures.find((x) => x.quantity === d.record)
    if (f === undefined) return null
    return 'value' in f ? { lo: f.value, hi: f.value, text: f.text, unit: f.unit } : { lo: f.low, hi: f.high, text: f.text, unit: f.unit }
  })
  if (!spans.every((s): s is Side & { unit: string } => s !== null && Number.isFinite(s.lo) && Number.isFinite(s.hi))) return null
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

const TRACK = 'block h-2 w-full overflow-visible'
const initial = (name: string) => (Array.from(name)[0] ?? '').toUpperCase()

/** Who said what: one row per person, their figure's span as a bar (a single figure as a tick) on the one axis, core's words for it beside. */
export function FigureSides({ view, d, at: id }: { view: View; d: Difference; at: string }): JSX.Element | null {
  const spans = sideSpans(view, d)
  if (spans === null) return null
  const axis = axisOf(spans)
  return (
    <ul className="m-0 grid list-none gap-2 p-0" data-testid={`${id}-ranges`}>
      {d.sides.map((s, i) => {
        const sp = spans[i]!
        const x0 = at(axis, sp.lo), x1 = at(axis, sp.hi)
        const point = sp.hi === sp.lo
        return (
          <li key={s.holder_id} className="grid gap-1" data-difference-side={s.holder_id} title={s.title}>
            <p className={`${META} flex items-center gap-1.5`}>
              <span aria-hidden="true" className={AVATAR}>{initial(s.holder)}</span>
              <span className="text-text-header">{s.holder}</span>
              <span className="min-w-0 break-words text-text-body" data-range-text="">{sp.text}</span>
            </p>
            <svg viewBox="0 0 100 8" preserveAspectRatio="none" className={TRACK} aria-hidden="true" data-range-lo={sp.lo} data-range-hi={sp.hi}>
              <rect x="0" y="3.5" width="100" height="1" className="fill-current text-panel-border" />
              {point
                ? <rect x={Math.max(0, x0 - 0.8)} y="0" width="1.6" height="8" className="fill-current text-text-header" data-range-mark="point" />
                : <rect x={x0} y="1.5" width={Math.max(1.6, x1 - x0)} height="5" rx="1" className="fill-current text-text-header" data-range-mark="span" />}
            </svg>
          </li>
        )
      })}
    </ul>
  )
}

/** What each person's figure does to each option's chance of meeting the aim: per option, one bar per holder on a 0–100% track, labelled
 *  with core's own text; a withheld chance draws no bar, only core's words for it. Core's figure with the model's own value follows as words. */
export function ChanceBars({ d, heading, modelHeading, at: id }: { d: Difference; heading: string; modelHeading: string; at: string }): JSX.Element | null {
  if (d.options.length === 0) return null
  const holder = (hid: string) => d.sides.find((s) => s.holder_id === hid)?.holder ?? ''
  return (
    <div className="grid gap-2" data-testid={`${id}-options`}>
      <p className={LABEL}>{heading}</p>
      {d.options.map((o) => (
        <div key={o.option} className="grid gap-1" data-difference-option={o.option}>
          <p className={`${typography.viewPanelBody} m-0 break-words text-text-header`}>{o.label}
            {o.model !== '' && <span className={`${META} ml-1.5`} data-difference-model="">· {modelHeading} {o.model}</span>}</p>
          {o.chances.map((c) => (
            <p key={c.holder_id} className={`${META} m-0 grid grid-cols-[22px_1fr_auto] items-center gap-2`} data-difference-chance={c.holder_id} title={c.withheld?.reason}>
              <span aria-hidden="true" className={AVATAR}>{initial(holder(c.holder_id))}</span>
              <span className="sr-only">{holder(c.holder_id)}</span>
              {c.chance === null
                ? <span className="text-text-light" data-chance-withheld="" />
                : (
                  <svg viewBox="0 0 100 8" preserveAspectRatio="none" className={TRACK} aria-hidden="true" data-chance={c.chance}>
                    <rect x="0" y="1" width="100" height="6" rx="1" className="fill-current text-panel-border" />
                    <rect x="0" y="1" width={Math.min(100, Math.max(0, c.chance * 100))} height="6" rx="1" className="fill-current text-text-header" />
                  </svg>
                )}
              <span className="tabular-nums text-text-body">{c.text}</span>
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}
