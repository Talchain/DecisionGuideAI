/**
 * The crafted analysis option row (`components/results/analysis-hero/HeroOptionRow.tsx`), ported onto olumi.view/3: the same two-line grid
 * (mark · option name · readout · chevron, then the track on its own row), the same bar and dot, the same disclosure. Every word is core's,
 * drawn verbatim at its View path (`data-view`); the row's hover is core's definition of the chance (`row.title`).
 *
 * What changed in the port, by rule:
 * - The rank badge, "Option N" and the sr-only "highest on this view" are gone (no rank, no designation of the UI's own). The first column
 *   holds core's own most-likely mark (`row.likely`, ◉, its sentence as the accessible name) and is empty otherwise.
 * - The goal lens's readout is core's chance (`row.value`), the headline (DL #87). It draws no track: a chance is not a range.
 * - The outcome lens's readout is core's outcome band (`outcome.text`) with the band drawn on a track shared by that aim's options. It has
 *   no leader, so no mark. The band is never drawn beside the chance as if it were confidence in it.
 * - The option name is never cut (R25, Paul's 6 Nov test): no clamp, so no clip-recovery line.
 * - The detail holds core's lines only: the other lens's readout, the companion, timing, what moves the chance most (`driver`) and what
 *   would have to be true (`run.tipping`) for this option and aim. No sentence is built here.
 */
import { useId, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ViewCard } from '../client'
import { driverRange } from '../ViewChances'
import { TYPE } from './type'
import { driverRowOf, trackPct, type AimRow, type TippingLine } from './pick'

/** The row grid (prototype v6 two-line anatomy), as the crafted row: mark · name · readout · chevron, then the track spanning name and readout. */
export const HERO_ROW_GRID = 'grid w-full grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_0.875rem] items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1.5 text-left'
export const HERO_ROW_TRACK_SPAN = 'col-start-2 col-span-3'
/** Solid light-token fills, never opacity modifiers (those compile to nothing on this theme: the "invisible bars" defect). */
export const HERO_BAR_FILL = {
  // eslint-disable-next-line brand-tokens/no-bare-light-bg -- chart data-mark fill, the crafted row's prototype-mapped DS exception (issue 222)
  leader: 'bg-info-light',
  // eslint-disable-next-line brand-tokens/no-bare-light-bg -- chart data-mark fill, the crafted row's prototype-mapped DS exception (issue 222)
  rest: 'bg-option-light',
} as const
export const HERO_DOT_FILL = { leader: 'bg-primary', rest: 'bg-option' } as const

export type HeroLensId = 'goal' | 'outcome'
const NBSP = ' '

function Mark({ at, mark }: { at: string; mark: { glyph: string; title: string } | null | undefined }) {
  return mark == null ? null : <span data-view={`${at}.glyph`} title={mark.title} aria-label={mark.title}>{mark.glyph}</span>
}

/** What moves this option's chance most, in core's words, with v10's low→high marker when core gives both chances (layout only). */
function Driver({ card, figure }: { card: ViewCard; figure: ViewCard | null }) {
  const d = card.driver
  if (d == null) return null
  const range = driverRange(d)
  const left = range === null ? 0 : Math.min(range.lowPct, range.highPct)
  const width = range === null ? 0 : Math.max(2, Math.abs(range.highPct - range.lowPct))
  return (
    <div data-testid={`port-row-driver-${card.id}`} title={d.title}>
      <p className={`${TYPE.body} text-text-body`} data-view={`${card.id}.driver.text`}>{d.text}</p>
      {range === null ? null : (
        <span aria-hidden="true" className="relative mt-1 block h-1 rounded-full bg-panel-border" data-testid={`port-row-driver-range-${card.id}`}>
          <span className="absolute top-0 h-full rounded-full bg-option" style={{ left: `${left}%`, width: `${width}%` }} />
          <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-option bg-panel" style={{ left: `${range.lowPct}%` }} />
          <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-option" style={{ left: `${range.highPct}%` }} />
        </span>
      )}
      {figure === null ? null : <p className={`${TYPE.meta} text-text-light`} data-view={`${figure.id}.heading`}>{figure.heading}</p>}
    </div>
  )
}

export interface HeroOptionRowProps {
  /** The option's row, at its View path. */
  entry: AimRow
  lens: HeroLensId
  /** One-open-at-a-time is the parent's. */
  isOpen: boolean
  onToggle: () => void
  /** This aim's outcome track (`outcomeDomainOf`); null draws no outcome bar. */
  domain: { min: number; max: number } | null
  /** Core's "what would have to be true" lines for this option and aim (`tippingFor`). */
  tipping?: readonly { line: TippingLine; i: number }[]
  /** The card of the figure the driver is about (`figureCard`), when the canvas draws it. */
  figure?: ViewCard | null
  /** Anything the caller mounts at the end of the detail (e.g. the figure's ✎). */
  children?: ReactNode
}

export function HeroOptionRow({ entry, lens, isOpen, onToggle, domain, tipping = [], figure = null, children }: HeroOptionRowProps) {
  const regionId = useId(), labelId = useId()
  const { card, row, i } = entry
  const at = `${card.id}.rows.${i}`
  const chance = row.kind === 'chance' ? row : null
  const leader = lens === 'goal' && chance !== null && chance.likely != null

  // The readout, in core's words: the chance on the goal lens, the outcome band on the outcome lens (where a row has none, its chance).
  const outcomeReadout = lens === 'outcome' && chance?.outcome != null
  const readout = row.kind === 'none'
    ? (row.text == null ? <span data-view={`${at}.title`}>{row.title}</span> : <span data-view={`${at}.text`}>{row.text}</span>)
    : outcomeReadout
      ? <span data-view={`${at}.outcome.text`} title={chance!.outcome!.title}>{chance!.outcome!.text}</span>
      : (
        <>
          {row.kind === 'chance' && row.approx !== '' ? <span data-view={`${at}.approx`}>{row.approx}</span> : null}
          <span data-view={`${at}.value`}>{row.value}</span>
          {row.olumi === null ? null : <>{NBSP}<Mark at={`${at}.olumi`} mark={row.olumi} /></>}
          {chance?.if_approved == null ? null : <>{NBSP}<Mark at={`${at}.if_approved`} mark={chance.if_approved} /></>}
        </>
      )

  // The outcome band's place on this aim's track (outcome lens only): positions, never data.
  let barStart: number | null = null, barEnd: number | null = null, dotPos: number | null = null
  if (lens === 'outcome' && domain !== null && chance?.outcome != null) {
    const o = chance.outcome, span = domain.max - domain.min
    const pos = (v: number) => trackPct((v - domain.min) / span)
    barStart = pos(o.low); barEnd = pos(o.high)
    if (o.median !== null) dotPos = pos(o.median)
  }

  // The detail: core's lines only, each at its path. The driver is drawn once per option, on its first chance row.
  const otherReadout = chance === null ? null : lens === 'goal'
    ? (chance.outcome == null ? null : <p className={`${TYPE.body} text-text-body`} title={chance.outcome.title} data-view={`${at}.outcome.text`}>{chance.outcome.text}</p>)
    : (outcomeReadout ? <p className={`${TYPE.body} text-text-body`}>{chance.approx === '' ? null : <span data-view={`${at}.approx`}>{chance.approx}</span>}<span data-view={`${at}.value`}>{chance.value}</span></p> : null)
  const companion = chance?.companion == null ? null : <p className={`${TYPE.meta} text-text-light`} title={chance.companion_title ?? chance.companion} data-view={`${at}.companion`}>{chance.companion}</p>
  const timing = chance?.timing == null ? null : <p className={`${TYPE.meta} text-text-light`} title={chance.timing_title ?? chance.timing} data-view={`${at}.timing`}>{chance.timing}</p>
  const driver = chance !== null && card.driver != null && driverRowOf(card) === i ? <Driver card={card} figure={figure} /> : null
  const lines = tipping.map(({ line: l, i: k }) => (
    <p key={l.id} className={`${TYPE.body} text-text-body`} title={l.hover} data-view-fact={l.id}>
      {l.olumi == null ? null : <><span title={l.olumi.title} aria-label={l.olumi.title}>{l.olumi.glyph}</span> </>}
      <span data-view={`run.tipping.${k}.line`}>{l.line}</span>
    </p>
  ))
  const expandable = otherReadout !== null || companion !== null || timing !== null || driver !== null || lines.length > 0 || children != null
  const Chevron = isOpen ? ChevronDown : ChevronRight

  const grid = (
    <>
      <span className="flex h-6 w-6 flex-none items-center justify-center text-primary" data-testid="port-row-mark">
        {leader ? <Mark at={`${at}.likely`} mark={chance!.likely} /> : null}
      </span>
      <span id={labelId} className={`${TYPE.body} min-w-0 break-words font-medium text-text-header`} data-view={`${card.id}.heading`}>{card.heading}</span>
      <span className={`${TYPE.body} min-w-0 break-words text-right ${leader ? 'text-text-header' : 'text-text-body'}`} data-testid="port-row-readout">{readout}</span>
      <Chevron aria-hidden="true" className={`h-3.5 w-3.5 flex-none text-text-light ${expandable ? '' : 'invisible'}`} />
      {lens === 'outcome' && (
        <span aria-hidden="true" className={`${HERO_ROW_TRACK_SPAN} relative block h-5 min-w-0`} data-testid="port-row-track">
          <span className="absolute inset-x-0 top-1/2 h-px bg-panel-border" />
          <span
            data-testid="port-row-bar"
            data-visible={barStart !== null && barEnd !== null ? 'true' : 'false'}
            className={`absolute left-0 h-2.5 w-full rounded-full transition-transform motion-reduce:transition-none ${HERO_BAR_FILL.rest}`}
            style={{
              top: 'calc(50% - 5px)', transformOrigin: 'left',
              transform: `translateX(${barStart ?? 0}%) scaleX(${barStart !== null && barEnd !== null ? Math.max(barEnd - barStart, 0) / 100 : 0})`,
              opacity: barStart !== null && barEnd !== null ? 1 : 0,
            }}
          />
          <span className="absolute inset-y-0 w-0 transition-[left] motion-reduce:transition-none" style={{ left: `${dotPos ?? 0}%`, opacity: dotPos !== null ? 1 : 0 }} data-testid="port-row-dot" data-visible={dotPos !== null ? 'true' : 'false'}>
            <span className={`absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel ${HERO_DOT_FILL.rest}`} />
          </span>
        </span>
      )}
    </>
  )

  return (
    <div data-testid="port-option-row" data-view-row={at} data-option-id={card.id} data-leader={leader ? 'true' : 'false'} title={row.title}>
      {expandable ? (
        <button type="button" onClick={onToggle} aria-expanded={isOpen} aria-controls={regionId}
          className={`${HERO_ROW_GRID} transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-inset ${isOpen ? 'bg-panel-hover' : ''}`}>
          {grid}
        </button>
      ) : <div className={HERO_ROW_GRID}>{grid}</div>}
      {expandable && isOpen && (
        <div id={regionId} role="region" aria-labelledby={labelId} data-testid="port-option-detail" className="space-y-1 pb-2 pl-10 pr-2 pt-0.5">
          {otherReadout}
          {companion}
          {timing}
          {driver}
          {lines}
          {children}
        </div>
      )}
    </div>
  )
}

export default HeroOptionRow
