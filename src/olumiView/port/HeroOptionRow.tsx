/**
 * The crafted analysis option row (`components/results/analysis-hero/HeroOptionRow.tsx`), ported onto olumi.view/3: the same two-line grid
 * (mark · option name · readout · chevron, then the track on its own row), the same bar and dot, the same disclosure. Every word is core's,
 * drawn verbatim at its View path (`data-view`); the row's hover is core's definition of the chance (`row.title`).
 *
 * What changed in the port, by rule (and layout: stacked, see HERO_ROW_STACK):
 * - The rank badge, "Option N" and the sr-only "highest on this view" are gone (no rank, no designation of the UI's own). The first column
 *   holds core's own most-likely mark (`row.likely`, ◉, its sentence as the accessible name) and is empty otherwise.
 * - The goal lens's readout is core's chance (`row.value`), the headline (DL #87). It draws no track: a chance is not a range.
 * - The outcome lens's readout is core's outcome band (`outcome.text`) with the band drawn on a track shared by that aim's options, and
 *   nothing where a row has no band. It never draws the chance, has no leader and so no mark; the band is never shown as confidence in it.
 * - The option name is never cut (R25, Paul's 6 Nov test): no clamp, so no clip-recovery line.
 * - Under the row, at rest: what the chance rests on (`row.rests_on_text`, e.g. "Rests on Olumi's proposed target and what-if for …"),
 *   verbatim (DL 7 Nov: where Paul sees Olumi's target, in place of a bare ◆).
 * - The detail holds core's lines only: the other lens's readout, the companion, timing, what moves the chance most (`driver`) and what
 *   would have to be true (`run.tipping`) for this option and aim. No sentence is built here.
 */
import { useId, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ViewCard } from '../client'
import { driverRange } from '../ViewChances'
import { TYPE } from './type'
import { driverRowOf, headlineRowOf, trackPct, type AimRow, type TippingLine } from './pick'

/**
 * The row, stacked for the 347px dock (UI's 1232 look, 7 Nov): the option name on its own full-width line, never cut; under it core's
 * likely mark, the readout and its marks, with the chevron at the right of that line; then the track (outcome lens). No indent; a 44px
 * target. (The crafted grid put the name in a narrow column beside the readout, which wrapped long names to five lines.)
 */
export const HERO_ROW_STACK = 'flex w-full min-h-[44px] flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left'
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

/**
 * v10's low→high marker for what moves this option's chance most: a track from no chance to certain, the span between the chance when
 * that figure is low (hollow ring) and when it is high (filled dot), and, on the headline, the chance itself (a tick). The numbers place
 * the marks and nothing else; the marker's name is core's driver sentence, never a range the UI writes.
 */
function DriverTrack({ card, chance = null, labelled = false }: { card: ViewCard; chance?: number | null; labelled?: boolean }) {
  const d = card.driver
  const range = d == null ? null : driverRange(d)
  if (d == null || range === null) return null
  const left = Math.min(range.lowPct, range.highPct), width = Math.max(2, Math.abs(range.highPct - range.lowPct))
  const tick = chance === null || !Number.isFinite(chance) ? null : trackPct(chance)
  return (
    <span {...(labelled ? { role: 'img', 'aria-label': d.text, title: d.title } : { 'aria-hidden': true })}
      className="relative mt-1 block h-1 rounded-full bg-panel-border" data-testid={`port-row-driver-range-${card.id}`}>
      <span className="absolute top-0 h-full rounded-full bg-option" style={{ left: `${left}%`, width: `${width}%` }} />
      <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-option bg-panel" style={{ left: `${range.lowPct}%` }} />
      <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-option" style={{ left: `${range.highPct}%` }} />
      {tick === null ? null : <span className="absolute -top-1 h-3 w-0.5 -translate-x-1/2 rounded-full" style={{ left: `${tick}%`, background: 'var(--text-header)' }} data-testid={`port-row-driver-chance-${card.id}`} />}
    </span>
  )
}

/** What moves this option's chance most, in core's words, in the detail: its sentence (unless the headline already says it), the marker
 *  when the headline does not draw it, and the figure's name. */
function Driver({ card, figure, words, track }: { card: ViewCard; figure: ViewCard | null; words: boolean; track: boolean }) {
  const d = card.driver
  if (d == null) return null
  return (
    <div data-testid={`port-row-driver-${card.id}`} title={d.title}>
      {words ? <p className={`${TYPE.body} text-text-body`} data-view={`${card.id}.driver.text`}>{d.text}</p> : null}
      {track ? <DriverTrack card={card} /> : null}
      {figure === null ? null : <p className={`${TYPE.meta} text-text-light`} data-view={`${figure.id}.heading`}>{figure.heading}</p>}
    </div>
  )
}

/** Core's own most-likely mark on this row (`row.likely`, ◉), on the goal lens only: the one designation, core's. */
export const isLeader = ({ row }: AimRow, lens: HeroLensId): boolean => lens === 'goal' && row.kind === 'chance' && row.likely != null

/**
 * The row's readout, in core's words at its paths: core's most-likely mark in its own column, then the chance (approx, value and its
 * marks) on the goal lens, the outcome band on the outcome lens, or why there is nothing yet. The one drawing of an option's chance on
 * the lane: the Analysis tab's option row and the Reasoning tab's rack both draw it with this (DL ruling 1, 7 Nov).
 */
export function HeroReadout({ entry, lens }: { entry: AimRow; lens: HeroLensId }) {
  const { card, row, i } = entry
  const at = `${card.id}.rows.${i}`
  const chance = row.kind === 'chance' ? row : null
  const leader = isLeader(entry, lens)
  // The readout, in core's words: the chance on the goal lens; on the outcome lens the outcome band, and nothing where a row has none
  // (never the chance or a limit's value under "Likely outcome": checker, 7 Nov). A row that says why it has nothing says so on both.
  const outcomeReadout = lens === 'outcome' && chance?.outcome != null
  const readout = row.kind === 'none'
    ? (row.text == null ? <span data-view={`${at}.title`}>{row.title}</span> : <span data-view={`${at}.text`}>{row.text}</span>)
    : lens === 'outcome'
      ? (outcomeReadout ? <span data-view={`${at}.outcome.text`} title={chance!.outcome!.title}>{chance!.outcome!.text}</span> : null)
      : (
        <>
          {row.kind === 'chance' && row.approx !== '' ? <span data-view={`${at}.approx`}>{row.approx}</span> : null}
          <span data-view={`${at}.value`}>{row.value}</span>
          {row.olumi === null ? null : <>{NBSP}<Mark at={`${at}.olumi`} mark={row.olumi} /></>}
          {chance?.if_approved == null ? null : <>{NBSP}<Mark at={`${at}.if_approved`} mark={chance.if_approved} /></>}
        </>
      )

  return (
    <>
      <span className="flex-none text-primary" data-testid="port-row-mark">{leader ? <Mark at={`${at}.likely`} mark={chance!.likely} /> : null}</span>
      <span className={`${TYPE.body} min-w-0 flex-1 break-words font-semibold text-text-header`} data-testid="port-row-readout">{readout}</span>
    </>
  )
}

/**
 * One of core's lines on the headline, whole: supporting size (12px, under the 14px chance), never clamped and with no "Show all"
 * (Paul's gate, 8 Nov: nothing cut; the independent grade named the clamped line). The row grows to hold it.
 */
function WholeLine({ id, title, children }: { id: string; title?: string; children: ReactNode }) {
  return <p id={id} title={title} className={`${TYPE.meta} text-text-body`}>{children}</p>
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
  const leader = isLeader(entry, lens)

  // The outcome band's place on this aim's track (outcome lens only): positions, never data.
  let barStart: number | null = null, barEnd: number | null = null, dotPos: number | null = null
  if (lens === 'outcome' && domain !== null && chance?.outcome != null) {
    const o = chance.outcome, span = domain.max - domain.min
    const pos = (v: number) => trackPct((v - domain.min) / span)
    barStart = pos(o.low); barEnd = pos(o.high)
    if (o.median !== null) dotPos = pos(o.median)
  }

  // The detail: core's lines only, each at its path. The driver is drawn once per option, on its first chance row. On the goal lens the
  // outcome band is in the detail; the outcome lens never draws the chance (the goal lens owns it).
  const otherReadout = chance === null || lens !== 'goal' || chance.outcome == null ? null
    : <p className={`${TYPE.body} text-text-body`} title={chance.outcome.title} data-view={`${at}.outcome.text`}>{chance.outcome.text}</p>
  const companion = chance?.companion == null ? null : <p className={`${TYPE.meta} text-text-light`} title={chance.companion_title ?? chance.companion} data-view={`${at}.companion`}>{chance.companion}</p>
  const timing = chance?.timing == null ? null : <p className={`${TYPE.meta} text-text-light`} title={chance.timing_title ?? chance.timing} data-view={`${at}.timing`}>{chance.timing}</p>
  // THE HEADLINE (DL 7 Nov, track 4 step 1): on the goal lens, under core's chance, at rest and never behind the chevron:
  //  - its uncertainty: v10's marker of how far the chance moves with the figure it moves most with, the chance ticked on it (core's
  //    `driver.low/high` and `chance` place the marks; the marker's name is core's driver sentence);
  //  - what would change it: this option's own "what would have to be true" line for this aim (`run.tipping`, kind chance), verbatim,
  //    which names that figure and where it tips; where core gives none, core's driver sentence itself.
  // Win share stays out of it (supporting detail, never called a chance); every other line stays in the detail.
  const driverRow = chance !== null && card.driver != null && driverRowOf(card) === i
  // AN-01 (core cards[].headline, e179f7c6): the option's headline for the dock's aim, on the row it is about (`headlineRowOf`: its row
  // for that aim, else its option-wide reason). On this row its line IS the aim heading above and the readout (both core's words already),
  // so only what it adds is drawn: `range`, core's short phrase for what this chance moves with, and, with no chance yet, `add` (what the
  // person can give to get one). Its `why` is never drawn here: it is the Run's shared reason, said once above the rows, or this row's own
  // refusal, already the readout. An option with no row for the aim draws its headline on its own (HeroHeadlineAlone).
  const hl = lens === 'goal' && card.headline != null && headlineRowOf(card) === i ? card.headline : null
  const range = hl?.state === 'chance' && hl.range !== null && hl.range !== '' ? hl.range : null
  const add = hl?.state === 'none' && hl.add !== null && hl.add !== '' ? hl.add : null
  // Science (core wip/science-spread-chance): a chance headline's own sentence on why it is what it is, under its range; null for none.
  const why = hl?.state === 'chance' && hl.why !== null && hl.why !== '' ? hl.why : null
  // Where the range is drawn on the driver's own row and the driver's sentence opens with it (the same driver), that sentence is not
  // drawn as words; on any other row or lens, or for another driver, it is drawn as before.
  const shortDriver = range !== null && driverRow && card.driver!.text.startsWith(range)
  const headTrack = lens === 'goal' && driverRow && driverRange(card.driver!) !== null
  const headLine = lens !== 'goal' || chance === null ? null : (tipping.find(({ line: l }) => l.kind === 'chance' && l.line !== '') ?? null)
  const headDriverWords = lens === 'goal' && driverRow && headLine === null && !shortDriver
  // The detail draws core's driver sentence whenever the headline does not: a headline's `range` is core's short phrase, never the
  // sentence, so the sentence is still said once, whole, in the detail (integration of AN-01 on the paired goldens, 8 Nov).
  const driverWords = !headDriverWords
  const driver = driverRow && (driverWords || !headTrack || figure !== null) ? <Driver card={card} figure={figure} words={driverWords} track={!headTrack} /> : null
  const lines = tipping.filter((t) => t !== headLine).map(({ line: l, i: k }) => (
    <p key={l.id} className={`${TYPE.body} text-text-body`} title={l.hover} data-view-fact={l.id}>
      {l.olumi == null ? null : <><span title={l.olumi.title} aria-label={l.olumi.title}>{l.olumi.glyph}</span> </>}
      <span data-view={`run.tipping.${k}.line`}>{l.line}</span>
    </p>
  ))
  const expandable = otherReadout !== null || companion !== null || timing !== null || driver !== null || lines.length > 0 || children != null
  const Chevron = isOpen ? ChevronDown : ChevronRight

  const grid = (
    <>
      {/* 1232 polish (track 4 step 3): the option's name is the row's label (12px) and core's chance is its finding, full weight on every
          row (none dims), so the eye lands on the chance first. */}
      <span id={labelId} className={`${TYPE.meta} block w-full break-words text-text-body`} data-view={`${card.id}.heading`}>{card.heading}</span>
      {/* Every option shows a chance or one plain reason (DL 9 Nov): a row a shared reason covers draws core's short mark ("No chance
          yet", design call 8 Nov (c)), its hover the reason; the reason itself is said once at the panel's head. */}
      <span className="flex w-full items-baseline gap-1.5">
        <HeroReadout entry={entry} lens={lens} />
        <Chevron aria-hidden="true" className={`h-3.5 w-3.5 flex-none self-center text-text-light ${expandable ? '' : 'invisible'}`} />
      </span>
      {lens === 'outcome' && (
        <span aria-hidden="true" className="relative block h-5 w-full" data-testid="port-row-track">
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
          className={`${HERO_ROW_STACK} transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-inset ${isOpen ? 'bg-panel-hover' : ''}`}>
          {grid}
        </button>
      ) : <div className={HERO_ROW_STACK}>{grid}</div>}
      {headTrack || headLine !== null || headDriverWords || range !== null || why !== null || add !== null ? (
        <div className="space-y-1 px-2 pb-1" data-testid="port-row-headline">
          {headTrack ? <DriverTrack card={card} chance={chance!.chance} labelled /> : null}
          {range === null ? null : <p className={`${TYPE.meta} m-0 text-text-body`} title={hl!.title} data-testid="port-row-headline-range" data-view={`${card.id}.headline.range`}>{range}</p>}
          {why === null ? null : <p className={`${TYPE.meta} m-0 text-text-body`} data-testid="port-row-headline-why" data-view={`${card.id}.headline.why`}>{why}</p>}
          {add === null ? null : <p className={`${TYPE.meta} m-0 text-text-body`} data-testid="port-row-headline-add" data-view={`${card.id}.headline.add`}>{add}</p>}
          {headLine !== null ? (
            <WholeLine id={`${regionId}-tip`} title={headLine.line.hover}>
              {headLine.line.olumi == null ? null : <><span title={headLine.line.olumi.title} aria-label={headLine.line.olumi.title}>{headLine.line.olumi.glyph}</span> </>}
              <span data-view-fact={headLine.line.id} data-view={`run.tipping.${headLine.i}.line`}>{headLine.line.line}</span>
            </WholeLine>
          ) : headDriverWords ? (
            <WholeLine id={`${regionId}-drv`} title={card.driver!.title}><span data-view={`${card.id}.driver.text`}>{card.driver!.text}</span></WholeLine>
          ) : null}
        </div>
      ) : null}
      {/* A withheld row's question (core's `rows[].question`: the ask for the figure the chance waits on), at rest and in the row, never only on
          hover (DL 11 Nov, UI-7 item 1): when Olumi cannot give a chance it is the one useful thing on the row. Said once where the headline's
          `add` already says the same words. */}
      {row.kind !== 'none' || row.question == null || row.question === '' || row.question === add ? null : (
        <p className={`${TYPE.meta} px-2 pb-1 text-text-body`} data-testid="port-row-question" data-view={`${at}.question`}>{row.question}</p>
      )}
      {/* What this chance rests on, in core's words, at rest (DL 7 Nov: the place Paul sees Olumi's proposed target, in place of a bare ◆). */}
      {chance?.rests_on_text == null || chance.rests_on_text === '' ? null : (
        <p className={`${TYPE.meta} px-2 pb-1 text-text-light`} data-testid="port-row-rests-on" data-view={`${at}.rests_on_text`}>{chance.rests_on_text}</p>
      )}
      {/* SCI-12b (JOIN-10, DL 11 Nov): a chance worked out beside a recorded dissent says so, under that chance, at rest: core's sentence
          (`cards[].disputed[].line`: whose version the number uses, what is disputed and whose view that is, and that it is not in this
          number), verbatim, on the row for each aim it names (`aims`, by id). Core sends it only where the chance has a number. */}
      {lens !== 'goal' || chance === null ? null : (card.disputed ?? []).map((d, k) => (!d.aims.includes(chance.aim_id) || d.line === '' ? null : (
        <p key={d.id} className={`${TYPE.meta} px-2 pb-1 text-text-body`} data-row-disputed={d.id} data-view={`${card.id}.disputed.${k}.line`}>{d.line}</p>
      )))}
      {expandable && isOpen && (
        <div id={regionId} role="region" aria-labelledby={labelId} data-testid="port-option-detail" className="space-y-1 px-2 pb-2 pt-0.5">
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

/**
 * AN-01: an option with no row for the dock's aim (core: no line for it, so no chance yet), drawn in that aim's group so its headline is
 * never dropped: its heading, its reason (`why`; the Run's shared reason is said once above the rows instead) and what to add (`add`).
 * Where the group has no heading of its own, core's headline line names the aim (`text`).
 */
export function HeroHeadlineAlone({ card, named }: { card: ViewCard; named: boolean }) {
  const h = card.headline
  if (h == null) return null
  const why = h.shared || h.why === null || h.why === '' ? null : h.why
  const add = h.add === null || h.add === '' ? null : h.add
  return (
    <div data-testid="port-option-row" data-view-row={`${card.id}.headline`} data-option-id={card.id} data-leader="false" title={h.title}>
      <div className={HERO_ROW_STACK}>
        <span className={`${TYPE.meta} block w-full break-words text-text-body`} data-view={`${card.id}.heading`}>{card.heading}</span>
        {named ? null : <span className={`${TYPE.body} block w-full break-words font-semibold text-text-header`} data-view={`${card.id}.headline.text`}>{h.text}</span>}
        {why === null ? null : <span className={`${TYPE.body} block w-full break-words font-semibold text-text-header`} data-testid="port-row-readout" data-view={`${card.id}.headline.why`}>{why}</span>}
      </div>
      {add === null ? null : (
        <div className="space-y-1 px-2 pb-1" data-testid="port-row-headline">
          <p className={`${TYPE.meta} m-0 text-text-body`} data-testid="port-row-headline-add" data-view={`${card.id}.headline.add`}>{add}</p>
        </div>
      )}
    </div>
  )
}

export default HeroOptionRow
