/**
 * WHERE YOU DIFFER, ON THE CARD IT IS ABOUT (experience review 18 Nov, job 4 and change 5). After two people reveal their views, core's
 * `GET …/differences` names, for a figure, the card it is about (`record`, also `cards`). That card carries one small mark; pressing it
 * opens the card's details with the difference said in core's words, so a team sees WHERE it differs, WHETHER that changes what the model
 * implies, and what would settle it, with each person's view kept apart, never merged and never chosen between:
 * - the mark: the registry's one icon; its name and hover are core's sentence for what the difference does (`status_text`);
 * - the details: core's sentence, each person's figure (`sides[].text`), each person's chance for each option (`options[].chances[].text`,
 *   as given; a chance a person's version withholds says core's words, its reason on hover) and what would settle it (`settle[].text`).
 * Surfaces step A: it is one section of the card's one box. The preview says the mark and core's sentence on one line, nothing to press; pinned, that
 * sentence is a fold's own row (open when the mark opened the details) over each person's figure, chance and what would settle it.
 * A difference core has not run (`not_run`, `pending`) says core's sentence alone: no figure and no chance is drawn for it.
 * Links and factors are CardDiffers' chips; the Team tab is unchanged. Nothing is composed here beyond naming whose chance a line is.
 */
import { controls } from '../../styles/controls'
import { useEffect, useMemo, useRef } from 'react'
import { ICONS, OkIcon } from '../../olumiView/look/icons'
import { Hover, HoverButton } from '../../olumiView/look/Hover'
import { useLaneInspector } from '../../olumiView/v12/edit/inspectorStore'
import { typography } from '../../styles/typography'
import { FOLD_SUMMARY_TOP, FoldChevron } from '../../olumiView/look/FoldChevron'
import { useRevealedDifferences } from './CardDiffers'
import type { Difference } from './differences'
import { useViewStore } from '../../olumiView/store'
import type { ViewCard } from '../../olumiView/client'
import { sideSpans } from '../../olumiView/v12/views/DiffChart'
import { axisOf, fmt, pctOf } from '../../olumiView/v12/scale/axis'
import { figureRange } from '../../olumiView/v12/contract'

const NONE: readonly Difference[] = []
/** The pinned box's CLOSED fold shows two lines of core's sentence; open (its own details, never an outer one) it shows the whole of it. */
const DIFFER_CLOSED_CLAMP = 'line-clamp-2 [details[open]>summary>&]:line-clamp-none'
/** A difference core did not run says its sentence only. */
const sayOnly = (d: Difference): boolean => d.status === 'not_run' || d.status === 'pending'

/** The revealed differences of figure kind whose record is this card, in core's order (one per aim). */
export function useFigureDiffers(card: string): readonly Difference[] {
  const data = useRevealedDifferences()
  if (data === null) return NONE
  const own = data.differences.filter((d) => (d.kind ?? 'figure') === 'figure' && d.record === card)
  return own.length === 0 ? NONE : own
}

/** Each person whose revealed figure for this card differs from another's: their figure's span and words, read from the revealed View by the
 *  difference's own sides (DiffChart.sideSpans, so a newer or older figure of the same person is never drawn). Once per person, in core's order. */
export function usePeopleOnCard(card: string): readonly CardPerson[] {
  const own = useFigureDiffers(card)
  const view = useViewStore((s) => s.view)
  return useMemo(() => {
    if (view === null || own.length === 0) return []
    const seen = new Set<string>(), out: CardPerson[] = []
    for (const d of own) {
      const spans = sideSpans(view, d)
      // One unit on one card (Codex C1 HOLD 1): a difference whose figures are in another unit than those already drawn is never put beside them.
      if (spans === null || (out.length > 0 && spans[0]!.unit !== out[0]!.unit)) continue
      d.sides.forEach((s, i) => {
        const sp = spans[i]!
        if (seen.has(s.holder_id)) return
        seen.add(s.holder_id)
        out.push({ id: s.holder_id, holder: s.holder, lo: sp.lo, hi: sp.hi, text: sp.text, unit: sp.unit })
      })
    }
    return out
  }, [own, view])
}

/** One person's revealed figure for a card: their name, its span (a single figure has lo === hi) and the figure's own words. */
export type CardPerson = { readonly id: string; readonly holder: string; readonly lo: number; readonly hi: number; readonly text: string; readonly unit: string }

/**
 * THE SPLIT ON THE CARD (Team critique 2, track C1; Paul's go 19 Nov): after a reveal, the card the team's figures differ on draws each
 * person's revealed figure as a mark on one axis, with the card's own range (where core gives one in numbers) as a light band behind every
 * row, so the team sees where they differ on the model they look at. Every number is the revealed figure's own (DiffChart.sideSpans); each
 * row is named with the person and the figure's words. Lengths are SVG attributes, so no inline style is written. Nothing when fewer than two.
 */
export function CardSplit({ card, people }: { card: ViewCard; people: readonly CardPerson[] }): JSX.Element | null {
  if (people.length < 2) return null
  const unit = people[0]!.unit
  const range = figureRange(card)
  // The card's own range is drawn behind the rows only in the same unit as the people's figures (Codex C1 HOLD 1); never converted.
  const ref = range !== null && range.unit === unit ? { lo: range.low, hi: range.high } : null
  // The range bar's own scale rule (v12/scale axis: 0-based, rounded), with its ends labelled as the range bar labels its own (Codex C1 HOLD 2).
  const all = [...people, ...(ref === null ? [] : [ref])]
  const axis = axisOf(Math.min(...all.map((s) => s.lo)), Math.max(...all.map((s) => s.hi)), 1)
  const said = people.map((p) => `${p.holder}: ${p.text}`)
  return (
    <div className="mt-1 grid gap-0.5" data-testid="card-split" data-card-split={card.id} data-axis-min={axis.min} data-axis-max={axis.max} aria-label={said.join('; ')}>
      <ul className="m-0 grid list-none gap-0.5 p-0">
        {people.map((p, i) => {
          const x0 = pctOf(axis, p.lo), x1 = pctOf(axis, p.hi)
          return (
            <li key={p.id} data-card-person={p.id} data-range-lo={p.lo} data-range-hi={p.hi}>
              <Hover as="div" words={said[i]} className="grid grid-cols-[14px_minmax(0,1fr)] items-center gap-1">
              <span aria-hidden="true" className={`${typography.viewLabel} text-center text-text-light`}>{(Array.from(p.holder)[0] ?? '').toUpperCase()}</span>
              <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="block h-1.5 w-full" aria-hidden="true">
                {ref === null
                  ? <rect x="0" y="2.5" width="100" height="1" className="fill-current text-panel-border" />
                  : <rect x={pctOf(axis, ref.lo)} y="1" width={Math.max(1, pctOf(axis, ref.hi) - pctOf(axis, ref.lo))} height="4" rx="1" className="fill-current text-panel-border" data-card-split-model="" />}
                {p.hi === p.lo
                  ? <rect x={Math.max(0, x0 - 0.8)} y="0" width="1.6" height="6" className="fill-current text-text-header" data-card-person-mark="point" />
                  : <rect x={x0} y="1" width={Math.max(1.6, x1 - x0)} height="4" rx="1" className="fill-current text-text-header" data-card-person-mark="span" />}
              </svg>
              </Hover>
            </li>
          )
        })}
      </ul>
      <p className={`${typography.viewLabel} m-0 ml-[18px] flex justify-between gap-2 whitespace-nowrap text-text-light`} data-card-split-axis="">
        <span aria-label={`${fmt(axis.min)} ${unit}`}>{fmt(axis.min)}</span><span>{fmt(axis.max)} {unit}</span>
      </p>
    </div>
  )
}

/** The mark on the card a revealed difference is about: pressing it opens the card's details (the one details panel). */
export function CardDisputeMark({ card }: { card: string }): JSX.Element | null {
  const own = useFigureDiffers(card)
  if (own.length === 0) return null
  const words = [...new Set(own.map((d) => d.status_text))].join('\n')
  return (
    <HoverButton words={words} type="button" aria-label={words} data-differ-mark={card}
      onClick={(e) => { e.stopPropagation(); useLaneInspector.getState().show({ kind: 'details', target: { kind: 'card', id: card }, section: 'differ' }) }}
      className={`${controls.chipIcon} nodrag pointer-events-auto inline-grid cursor-pointer place-items-center border border-panel-border bg-canvas text-text-body transition-colors duration-fast hover:border-text-header`}>
      <OkIcon id="revealed-difference" size={12} decorative />
    </HoverButton>
  )
}

/** "Where you differ", in the card's details: core's words for each aim the difference was run for. Nothing when none is about this card. */
export function WhereYouDiffer({ card, peek = false, open = false }: { card: string; /** The box's preview: core's sentence alone, three lines of it at most (it is whole in the pinned box). */ peek?: boolean; /** The difference mark opened these details: the fold starts open. */ open?: boolean }): JSX.Element | null {
  const own = useFigureDiffers(card)
  // Opened from the difference mark, the section is what the person asked for: it is brought into view in the box's own scrolling body (never moving the page).
  const fold = useRef<HTMLDetailsElement>(null)
  const there = own.length > 0
  useEffect(() => { if (open && there) fold.current?.scrollIntoView?.({ block: 'nearest' }) }, [open, there])
  if (own.length === 0) return null
  const said = [...new Set(own.map((d) => d.status_text))].join(' ')
  const one = own.length === 1
  if (peek) return (
    <p className="m-0 flex items-start gap-1.5 text-text-body" data-testid="lane-differ-line"><OkIcon id="revealed-difference" size={14} decorative className="mt-0.5" /><span className="line-clamp-3 min-w-0 break-words">{said}</span></p>
  )
  return (
    <details ref={fold} open={open} aria-label={ICONS['revealed-difference'].hover} className="space-y-1" data-testid="lane-differ">
      <summary className={`${FOLD_SUMMARY_TOP} cursor-pointer text-text-body`}><FoldChevron className="mt-0.5" /><OkIcon id="revealed-difference" size={14} decorative className="mt-0.5" />{one ? <span className={`min-w-0 break-words ${DIFFER_CLOSED_CLAMP}`} data-differ-status-text="">{said}</span> : <span className="min-w-0 break-words" data-differ-several="">{ICONS['revealed-difference'].hover}</span>}</summary>
      {own.map((d) => {
        const whose = (id: string) => d.sides.find((s) => s.holder_id === id)?.holder ?? ''
        return (
          <div key={`${d.record}|${d.goal}`} className="space-y-1" data-differ-entry={d.goal} data-differ-status={d.status}>
            {own.length > 1 && d.goal_label !== '' ? <p className={`${typography.viewPanelMeta} text-text-light`}>{d.goal_label}</p> : null}
            {one ? null : <p className="text-text-body" data-differ-status-text="">{d.status_text}</p>}
            {sayOnly(d) ? null : (
              <>
                <ul className="m-0 list-none space-y-0.5 p-0" data-differ-sides="">
                  {d.sides.map((s) => <li key={s.holder_id} className="text-text-body" data-differ-side={s.holder_id}><Hover as="span" words={s.title}>{s.text}</Hover></li>)}
                </ul>
                {d.options.map((o) => (
                  <div key={o.option} data-differ-option={o.option}>
                    <p className={`${typography.viewPanelMeta} text-text-light`}>{o.label}</p>
                    <ul className="m-0 list-none space-y-0.5 p-0">
                      {o.chances.map((c) => (
                        <li key={c.holder_id} className="text-text-body" data-differ-chance={c.holder_id}>
                          <Hover as="span" words={c.withheld?.reason}>{whose(c.holder_id) === '' ? null : <>{whose(c.holder_id)}: </>}<span data-differ-chance-text="">{c.text}</span></Hover>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {d.settle.length === 0 ? null : (
                  <ul className="m-0 list-none space-y-0.5 p-0" data-differ-settle="">
                    {d.settle.map((s, i) => <li key={i} className={`${typography.viewPanelMeta} text-text-light`}>{s.text}</li>)}
                  </ul>
                )}
              </>
            )}
          </div>
        )
      })}
    </details>
  )
}
