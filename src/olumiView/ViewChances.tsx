/**
 * Each option's lines from the Run, drawn from the View (olumi.view/2) on the olumi-core lane, in place of the adapter-fed
 * `ViewOnlyRunChancesBlock`. Every word is core's, drawn exactly as it arrives: the option's heading, then each row (a chance with its
 * aim, its approximate mark and Olumi's marks, a limit, or why there is nothing yet), with core's hover. Nothing is composed, rounded or reordered
 * here, and the band is not drawn yet (a v10 slice).
 *
 * Each drawn View string carries `data-view`, the path to the exact string it shows, so a test can bind every element to its own
 * value by identity (design §3).
 */
import { Fragment, type ReactNode } from 'react'
import { FigureEdit } from './FigureEdit'
import type { ViewCard, ViewModel, ViewRow, ViewRun, ViewTurn } from './client'
import { BEHIND_SHOWN, comparedGroupsOf, firstFew, markedOptions, newestNextOf, notesBesideTiming, optionCards, SHARPEN_SHOWN, sharpenKindOf, sharpenRowsOf, tippingOf, failureOf, restsOf, worthLinesOf, type SharpenRow } from './layout'
import { NodeShapeIndicator } from '../canvas/nodes/NodeShapeIndicator'
import { MoveTap, Words } from './ViewChat'
import { shownModel, useViewStore } from './store'
import { clearWhatIf, useWhatIf } from './whatif'
import { typography } from '../styles/typography'
import type { OutputTab } from '../stores/uiStore'
import { mostLikelyBasisOf } from './standin'
import { WhatIfAxis, WhatIfBars } from './port/WhatIfBars'

function Mark({ at, mark }: { at: string; mark: { glyph: string; title: string } | null }) {
  return mark === null ? null : <span data-view={`${at}.glyph`} title={mark.title} aria-label={mark.title}>{mark.glyph}</span>
}

/** The hover for the most likely line: core's line on what it rests on when core gives one, else the line's own title. */
export const mostLikelyHover = (ml: NonNullable<ViewRun['most_likely']>): string => mostLikelyBasisOf(ml).rests_on_text ?? ml.title

const NBSP = '\u00a0'

export function Row({ card, row, i }: { card: ViewCard; row: ViewRow; i: number }) {
  const at = `${card.id}.rows.${i}`
  switch (row.kind) {
    case 'chance':
      return (
        <div className="flex flex-wrap items-baseline gap-x-2" title={row.title} data-view-row={at}>
          <span data-view={`${at}.aim`}>{row.aim}</span>
          {/* Each mark follows the value's last word after a no-break space, so it wraps with that word, never alone (R5). */}
          <span className={typography.viewPanelTabular}>{row.approx === '' ? null : <span data-view={`${at}.approx`}>{row.approx}</span>}<span data-view={`${at}.value`}>{row.value}</span>
            {row.olumi === null ? null : <>{NBSP}<Mark at={`${at}.olumi`} mark={row.olumi} /></>}
            {row.likely === null ? null : <>{NBSP}<Mark at={`${at}.likely`} mark={row.likely} /></>}
            {/* R5 core's own mark where a pending proposal moves this value ("if approved; now …"), verbatim; none on a core before R5. */}
            {row.if_approved == null ? null : <>{NBSP}<Mark at={`${at}.if_approved`} mark={row.if_approved} /></>}
          </span>
          {/* R18 fix 1: core's short companion ("about 50% without Olumi's suggested risk"), muted, its full sentence on hover; null otherwise. */}
          {row.companion == null ? null : <span className={`${typography.viewPanelMeta} basis-full`} title={row.companion_title ?? row.companion} data-view={`${at}.companion`}>{row.companion}</span>}
          {/* R19: core's timing line, the same muted second line beside the companion; its whole sentence on hover; null unless material. */}
          {row.timing == null ? null : <span className={`${typography.viewPanelMeta} basis-full`} title={row.timing_title ?? row.timing} data-view={`${at}.timing`}>{row.timing}</span>}
        </div>
      )
    case 'limit':
      return (
        <div className="flex flex-wrap items-baseline gap-x-2" title={row.title} data-view-row={at}>
          <span data-view={`${at}.aim`}>{row.aim}</span>
          <span className={typography.viewPanelTabular}><span data-view={`${at}.value`}>{row.value}</span>{row.olumi === null ? null : <>{NBSP}<Mark at={`${at}.olumi`} mark={row.olumi} /></>}</span>
        </div>
      )
    case 'none':
      // a core before view-dock serves no `text`: the row says its title, as the base dock did (00058 P1)
      return row.text == null
        ? <div data-view-row={at}><span data-view={`${at}.title`}>{row.title}</span></div>
        : <div title={row.title} data-view-row={at}><span data-view={`${at}.text`}>{row.text}</span>
          {/* core's question for the figure it waits on, readable in the row, not only on hover (DL 11 Nov) */}
          {row.question == null || row.question === '' ? null : <span className={`${typography.viewPanelMeta} block`} data-view={`${at}.question`}>{row.question}</span>}</div>
  }
}

/**
 * The what-if shown on this model's version, or null: the one gate for every block that draws it or says it is there (the what-if box
 * below, and the Reasoning tab's state strip), so the two never disagree about whether a what-if is on screen.
 */
export function useWhatIfOn(model: ViewModel | null) {
  const sid = useViewStore((s) => s.sid), shown = useWhatIf((s) => s.shown)
  return model === null || shown === null || shown.sid !== sid || shown.base !== model.edit_base ? null : shown
}

/**
 * The what-if shown (core's `POST …/whatif`): marked not saved, core's words for the figure tried, then what the copy's Run gives, each
 * option's rows drawn by `Row` from core's own row shape, under the option's heading from this View. Only for the version it was asked on.
 * `labelled={false}` where the tab says the state itself (the Reasoning tab's state strip draws the label and Clear), so it is said once.
 */
export function WhatIfShown({ model, labelled = true }: { model: ViewModel; labelled?: boolean }) {
  const shown = useWhatIfOn(model)
  if (shown === null) return null
  const v = shown.variant, heading = new Map(optionCards(model).map((c) => [c.id, c]))
  return (
    // TM-27 polish (outside grade 10 Nov: the what-if's chances sat below the fold, cut by the dock's foot at 1232): each option's chance
    // comes first, core's longer sentence after it; the box and its Clear are ink, since a what-if is the person's act (blue is only Olumi's).
    <div className="space-y-2 rounded-lg border border-panel-border p-2" data-testid="view-whatif" aria-label="What-if, not saved">
      {!labelled ? null : (
        <div className="flex items-baseline justify-between gap-2">
          <p className={typography.panelHeader}>What-if, not saved</p>
          <button type="button" data-testid="view-whatif-clear" onClick={clearWhatIf} className={`${typography.viewPanelMeta} inline-flex min-h-[24px] cursor-pointer items-center text-text-body underline underline-offset-2 hover:text-text-header`}>Clear</button>
        </div>
      )}
      {v.edits.map((e, i) => <p key={e.quantity} data-view={`whatif.edits.${i}.words`}>{e.words}</p>)}
      {v.stopped !== null ? <p data-view="whatif.stopped">{v.stopped}</p>
        : v.blocked !== null ? <p title={v.blocked} data-testid="view-whatif-blocked">Olumi could not work this what-if out.</p>
          : (
            <>
              {v.moved || v.why_not === null ? null : <p className={typography.viewPanelMeta} data-view="whatif.why_not">{v.why_not}</p>}
              {v.rows.map((o) => {
                const card = heading.get(o.option_id)
                return card === undefined ? null : (
                  <div key={o.option_id} data-whatif-card={o.option_id}>
                    <div className={typography.panelHeader}>{card.heading}</div>
                    <WhatIfBars card={card} rows={o.rows} facts={v.facts} />
                    {o.rows.map((row, i) => <Row key={i} card={{ ...card, id: `whatif.${o.option_id}` }} row={row} i={i} />)}
                  </div>
                )
              })}
              <WhatIfAxis model={model} rows={v.rows} facts={v.facts} />
              {v.most_likely === null ? null : <p title={v.most_likely.title} data-view="whatif.most_likely.text">{v.most_likely.text}</p>}
            </>
          )}
    </div>
  )
}

/**
 * The most likely line in core's words. Where it rests on Olumi's estimate (core's `estimate`, the figure's own card id), the ✎ after it is
 * that card's own edit, so the person can give theirs; nothing when no card of that id offers an edit (a figure not drawn, or a proposal held).
 */
function MostLikely({ model, ml }: { model: ViewModel; ml: NonNullable<ViewRun['most_likely']> }) {
  const card = ml.estimate === null ? undefined : model.cards.find((c) => c.id === ml.estimate && c.figure?.edit)
  return (
    <div title={mostLikelyHover(ml)} data-view-hover={mostLikelyBasisOf(ml).rests_on_text === null ? undefined : 'run.most_likely.rests_on_text'}>
      <span data-view="run.most_likely.text">{ml.text}</span>{ml.if_approved == null ? null : <>{NBSP}<Mark at="run.most_likely.if_approved" mark={ml.if_approved} /></>}
      {card === undefined ? null : <> <FigureEdit id={card.id} edit={card.figure!.edit} place="likely" glyph="✎" words={false} label={`Give your figure for ${card.heading}`} /></>}
    </div>
  )
}

type WaitsOn = NonNullable<ViewRun['waits_on']>

/** What the chances wait on, each item core's `‘label’` with its hover; a figure no one can size yet says so in the headline only. */
function WaitsOnItems({ w, unknown }: { w: WaitsOn; unknown: boolean }) {
  return (
    <>
      {w.items.map((it, i) => (
        <span key={it.id} title={it.title}>
          <span data-view={`run.waits_on.items.${i}.text`}>{it.text}</span>
          {unknown && it.unknown !== null ? <span data-view={`run.waits_on.items.${i}.unknown`}>{it.unknown}</span> : null}
          {i < w.items.length - 1 ? ', ' : null}
        </span>
      ))}
    </>
  )
}

/** A reason every option shares (`shared_blockers`), said once above the options as core's page says it, since each covered card carries only the mark. */
export function SharedBlockers({ run }: { run: ViewRun | null }) {
  return run?.shared_blockers == null ? null : (
    <>{run.shared_blockers.map((b, i) => (
      <p key={b.aim_id} data-testid="view-run-shared-blocker" data-aim={b.aim_id} data-view={`run.shared_blockers.${i}.text`}>{b.text}</p>
    ))}</>
  )
}

type Driver = NonNullable<ViewCard['driver']>

/** Where core's two driver chances (`driver.low` / `driver.high`, 0–1) sit on a 0–100% track; null unless both are numbers. */
export function driverRange(d: Pick<Driver, 'low' | 'high'>): { lowPct: number; highPct: number } | null {
  if (d.low === null || d.high === null || !Number.isFinite(d.low) || !Number.isFinite(d.high)) return null
  const at = (x: number) => Math.min(100, Math.max(0, x * 100))
  return { lowPct: at(d.low), highPct: at(d.high) }
}

/**
 * What moves an option's chance most, as v10's low→high marker (the values band's look): a track from no chance to certain, the span
 * between the chance when that figure is low (hollow ring) and when it is high (filled dot). The numbers place the marks and nothing else;
 * core's whole line is its label and hover (`data-view-label`: the path of the string drawn as the label, not as text). What the two chances are is said once for the panel (`Sensitivity`).
 */
function DriverRange({ id, driver, figure = null }: { id: string; driver: Driver; figure?: ViewCard | null }) {
  const { lowPct, highPct } = driverRange(driver)!
  const left = Math.min(lowPct, highPct), width = Math.max(2, Math.abs(highPct - lowPct))
  const dot = { position: 'absolute', top: '50%', width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: 4 } as const
  return (
    <>
      <div className="mt-1 py-1" role="img" aria-label={driver.text} title={driver.title} data-view-label={`${id}.driver.text`} data-testid={`view-range-driver-${id}`}>
        <div className="relative" style={{ height: 4, background: 'var(--factor-light)', borderRadius: 2 }}>
          <div className="absolute top-0 h-full" data-range-span style={{ left: `${left}%`, width: `${width}%`, background: 'var(--option)', borderRadius: 2 }} />
          <div data-range-low style={{ ...dot, left: `${lowPct}%`, background: 'var(--surface-card)', border: '2px solid var(--option)' }} />
          <div data-range-high style={{ ...dot, left: `${highPct}%`, background: 'var(--option)' }} />
        </div>
      </div>
      {/* The figure the marker is about, by its own card's heading (core's words), beside the marker, never inside its label element. */}
      {figure === null ? null : <p className={typography.viewPanelMeta} title={driver.title} data-driver-figure={id} data-view={`${figure.id}.heading`}>{figure.heading}</p>}
    </>
  )
}

/**
 * What each option's two driver chances are (core's `run.sensitivity`), said once at the head of the option rows, in core's words with its
 * hover; only when an option carries those chances (`driver.low` / `driver.high`), which then draws them as its marker.
 */
/** Never alone (Paul, 6 Nov: "that figure's draws" with no figure named): only when every marked option names its figure under its
 *  marker, by that figure's own card heading. A figure that is no card (folded) has no words here, so the line is left out. */
export const sensitivityShown = (model: ViewModel): boolean => {
  const marked = markedOptions(model)
  return (model.run?.sensitivity ?? null) !== null && marked.length > 0 && marked.every((c) => figureCard(model, c.driver!) !== null)
}
export function Sensitivity({ model }: { model: ViewModel }) {
  const s = model.run?.sensitivity ?? null
  return s === null || !sensitivityShown(model) ? null : <p className={typography.viewPanelMeta} title={s.title} data-view="run.sensitivity.text">{s.text}</p>
}

/** The card of the figure an option's chance moves most with (`driver.figure`), when the canvas draws it; null when it is folded. */
export const figureCard = (model: ViewModel, d: Driver): ViewCard | null => (d.figure === null ? null : model.cards.find((c) => c.id === d.figure) ?? null)

/**
 * One option: its heading, each row (a chance, a limit, or why there is nothing yet) with what `after` draws under it, and what moves its
 * chance most, all core's; then `children`.
 */
export function OptionLines({ card, after, children, model }: { card: ViewCard; after?: (row: ViewRow, i: number) => ReactNode; children?: ReactNode; model?: ViewModel }) {
  return (
    <div data-view-card={card.id}>
      <div className={typography.panelHeader} data-view={`${card.id}.heading`}>{card.heading}</div>
      {card.rows.map((row, i) => <Fragment key={i}><Row card={card} row={row} i={i} />{after?.(row, i)}</Fragment>)}
      {card.driver == null ? null : driverRange(card.driver) !== null ? <DriverRange id={card.id} driver={card.driver} figure={model === undefined ? null : figureCard(model, card.driver)} />
        : <p className={typography.viewPanelMeta} title={card.driver.title} data-view={`${card.id}.driver.text`}>{card.driver.text}</p>}
      {children}
    </div>
  )
}

type Science = NonNullable<ViewRun['science']>[number]

/** One worth line: its mark when it rests on Olumi's proposals, the line in core's words, the Run's whole reason on hover; core's give
 *  words and ✎ on a line of their own under it. */
function WorthLine({ l, i, tab }: { l: Science; i: number; tab?: OutputTab }) {
  return (
    <div title={l.hover} data-view-fact={l.id}>
      <p>
        {l.olumi === null ? null : <><span title={l.olumi.title} aria-label={l.olumi.title} data-view={`run.science.${i}.olumi.glyph`}>{l.olumi.glyph}</span> </>}
        <span data-view={`run.science.${i}.line`}>{l.line}</span>
        {l.figure?.mark == null ? null : <> <span title={l.figure.mark.title} aria-label={l.figure.mark.title} data-view={`run.science.${i}.figure.mark.glyph`}>{l.figure.mark.glyph}</span></>}
      </p>
      {/* Core's give words and ✎ on their own line under the worth line, never run on after it as one sentence (6 Nov side-by-side). */}
      {l.figure?.give == null ? null : <div className={typography.viewPanelMeta} data-worth-give={l.id}><FigureEdit id={l.figure.id} edit={l.figure.give.edit} place="worth" glyph="✎" words={false} lead={l.figure.give.text} label={`Change ${l.figure.label}`} tab={tab} /></div>}
    </div>
  )
}

/**
 * Each aim's figure most worth checking first (D3), as core's page draws it: its mark when it rests on Olumi's proposals, the line in core's
 * words, the Run's whole reason on hover (olumi.view/3 model.run.science; PL review 4 Nov). `tab`: where a try from its ✎ is drawn.
 * `shown` (the Analysis tab's "Behind this result"): the first lines shown, the rest behind "+N more", each at its own View path; its
 * heading then reads as a sub-heading of that box.
 */
export function Worth({ run, tab, shown }: { run: ViewRun | null; tab?: OutputTab; shown?: number }) {
  // Only the science kinds this page knows; any other kind is drawn as nothing, never as a worth line (core's D2 adds kinds).
  const worth = run?.science == null ? [] : worthLinesOf(run.science)
  const split = firstFew(worth, shown ?? worth.length)
  return worth.length === 0 ? null : (
    <div data-testid="view-run-worth" aria-label="Worth checking first" className="space-y-1">
      <p className={shown === undefined ? typography.panelHeader : `${typography.viewPanelMeta} text-text-light`}>Worth checking first</p>
      {split.shown.map(({ line: l, i }) => <WorthLine key={l.id} l={l} i={i} tab={tab} />)}
      {split.more.length === 0 ? null : (
        <details data-testid="view-run-worth-more" className="space-y-1">
          <summary className={`${typography.viewPanelMeta} cursor-pointer text-info`}>{`+${split.more.length} more`}</summary>
          {split.more.map(({ line: l, i }) => <WorthLine key={l.id} l={l} i={i} tab={tab} />)}
        </details>
      )}
    </div>
  )
}

/**
 * Core's comparisons (D2 on the middle figures; CHANGE 8 against carrying on: olumi.view/3 `model.run.compared`), each group under core's own
 * heading for it (`compared_headings`), never under "Worth checking first"; each line verbatim, Olumi's mark when core gives one, the Run's
 * text on hover. A group core gives no heading for, and a kind this page does not know, is drawn as nothing.
 */
export function Compared({ run }: { run: ViewRun | null }) {
  const groups = comparedGroupsOf(run)
  return groups.length === 0 ? null : (
    <div data-testid="view-run-compared" className="space-y-3">
      {groups.map(({ group, heading, lines }) => (
        <div key={group} data-testid={`view-run-compared-${group}`} aria-label={heading}>
          <p className={typography.panelHeader} data-view={`run.compared_headings.${group}`}>{heading}</p>
          {lines.map(({ line: l, i }) => (
            <div key={l.id} title={l.hover} data-view-fact={l.id}>
              {l.olumi === null ? null : <><span title={l.olumi.title} aria-label={l.olumi.title} data-view={`run.compared.${i}.olumi.glyph`}>{l.olumi.glyph}</span> </>}
              <span data-view={`run.compared.${i}.line`}>{l.line}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** A section box of the Analysis tab (the previous PoC's cards): the panel surface, a full opacity border, never a single side. */
const BOX = 'space-y-2 rounded-lg border border-panel-border bg-panel p-3'

/**
 * The coach's newest next step (`chat[].answer.next`, newest), as the previous PoC's "Suggested next step" card (paul-funding-09): core's
 * label and words verbatim at their View paths, and the conversation's own move tap as the arrow (never an act of this page's own).
 */
function SuggestedNext({ chat }: { chat: readonly ViewTurn[] | null }) {
  const n = newestNextOf(chat)
  return n === null ? null : (
    <section className={BOX} data-testid="view-run-next-step" aria-label="Suggested next step">
      <p className={`${typography.viewPanelMeta} text-text-light`}>Suggested next step</p>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1"><span className="font-medium" data-view={`chat.${n.k}.answer.next.label`}>{n.next.label}</span> <Words parts={n.next.text} at={`chat.${n.k}.answer.next.text`} first={n.first} /></p>
        <MoveTap turn={n.turn.id} next={n.next} arrow />
      </div>
    </section>
  )
}

/**
 * D6, what would have to be true (olumi.view/3 `model.run.tipping`, tipping.ts): each line core's own under core's own heading
 * (`tipping_heading`), its hover the Run's text, Olumi's mark when core gives one. Never among the "Behind this result" lines.
 */
export function Tipping({ run }: { run: ViewRun | null }) {
  const t = tippingOf(run)
  return t === null ? null : (
    <section className={BOX} data-testid="view-run-tipping" aria-label={t.heading}>
      <p className={typography.panelHeader} data-view="run.tipping_heading">{t.heading}</p>
      {t.lines.map(({ line: l, i }) => (
        <p key={l.id} title={l.hover} data-view-fact={l.id}>
          {l.olumi == null ? null : <><span title={l.olumi.title} aria-label={l.olumi.title}>{l.olumi.glyph}</span> </>}
          <span data-view={`run.tipping.${i}.line`}>{l.line}</span>
        </p>
      ))}
      {t.silent.map((s) => <p key={s.aim} data-view-silent={s.aim}>{s.line}</p>)}
    </section>
  )
}

/** D5 and D8 on the Analysis tab, as D6 is drawn: core's sentence verbatim under core's heading, its hover as the title. */
function FactCard({ testid, view, t }: { testid: string; view: string; t: { heading: string; lines: { line: { id: string; line: string; hover: string }; i: number }[] } | null }) {
  return t === null ? null : (
    <section className={BOX} data-testid={testid} aria-label={t.heading}>
      <p className={typography.panelHeader} data-view={`${view}_heading`}>{t.heading}</p>
      {t.lines.map(({ line: l, i }) => <p key={l.id} title={l.hover} data-view-fact={l.id}><span data-view={`${view}.${i}.line`}>{l.line}</span></p>)}
    </section>
  )
}
export const Failure = ({ run }: { run: ViewRun | null }) => <FactCard testid="view-run-failure" view="run.failure" t={failureOf(run)} />
export const Rests = ({ run }: { run: ViewRun | null }) => <FactCard testid="view-run-rests" view="run.rests" t={restsOf(run)} />

/** R19: Olumi's timing assumptions, once, in core's words ("Olumi's timing assumption, not your figure: 'X' is 1 to 4 months."); the generic what-if note for the same
 *  quantity is skipped beside it (layout.ts `notesBesideTiming`). Nothing when core sends none. */
export function TimingAssumptions({ run }: { run: ViewRun | null }) {
  const timing = run?.timing ?? []
  if (timing.length === 0) return null
  return (
    <div className="space-y-1" data-testid="view-run-timing">
      {timing.map((t, i) => <p key={t.quantity} className={typography.viewPanelMeta} data-timing={t.quantity} data-view={`run.timing.${i}.text`}>{t.text}</p>)}
    </div>
  )
}

/**
 * The lines for one View model: pure, so a test draws it from a golden View. As the base dock (ViewOnlyRunChancesBlock): the Run's lead,
 * then, when every option waits (`all_withheld`), the waits-on headline; a reason every option shares (`shared_blockers`), said once
 * above the options as core's page says it, since each covered card carries only the mark; each option with its lines and what moves
 * its chance most; the
 * most likely option; the notes; and, when not every option waits, what the chances wait on. Every word is the View's.
 */
export function ViewChances({ model, chat = null }: { model: ViewModel; chat?: readonly ViewTurn[] | null }) {
  const run = model.run ?? null // absent from a core before view-dock (00058 P1)
  const headline = run !== null && run.all_withheld && run.waits_on !== null
  const worth = run?.science == null ? 0 : worthLinesOf(run.science).length
  // The previous PoC's boxed sections (Paul, 6 Nov; vision-audit-20261024 cafe-09-panel-analysis.png): the chances first, the headline
  // (DL #87); then "Behind this result"; then the notes behind a closed disclosure. Each option's driver stays under its own option
  // (contract.spec: "drawn under that option"), with what its two chances are said once above the options.
  return (
    <div className={`${typography.viewPanelBody} space-y-3`} data-testid="view-chances">
      <WhatIfShown model={model} />
      <section className={BOX} data-testid="view-run-headline" aria-label="Each option's chance">
        {run?.lead == null ? null : <p className={typography.panelHeader} data-view="run.lead">{run.lead}</p>}
        {!headline ? null : (
          <div data-testid="view-run-waits-headline">
            <p className={typography.viewPanelMeta} data-view="run.waits_on.head">{run.waits_on!.head}</p>
            <p><span data-view="run.waits_on.text">{run.waits_on!.text}</span>{': '}<WaitsOnItems w={run.waits_on!} unknown /></p>
          </div>
        )}
        <SharedBlockers run={run} />
        <Sensitivity model={model} />
        {/* Each chance's definition is core's row hover (its title), never body text (Paul's look check, R5 defect 2). */}
        <div className="space-y-3">{optionCards(model).map((card) => <OptionLines key={card.id} card={card} model={model} />)}</div>
        <TimingAssumptions run={run} />
        {run?.most_likely == null ? null : <MostLikely model={model} ml={run.most_likely} />}
        {run === null || run.waits_on === null || headline ? null : (
          <p data-testid="view-run-waits-on"><span data-view="run.waits_on.label">{run.waits_on.label}</span>{' '}<WaitsOnItems w={run.waits_on} unknown={false} /></p>
        )}
      </section>
      <SuggestedNext chat={chat} />
      <Tipping run={run} />
      <Failure run={run} />
      <Rests run={run} />
      {worth === 0 ? null : (
        <section className={BOX} data-testid="view-run-behind" aria-label="Behind this result">
          <p className={typography.panelHeader}>Behind this result</p>
          <Worth run={run} shown={BEHIND_SHOWN} />
        </section>
      )}
      <SharpenCard model={model} />
      {run === null || notesBesideTiming(run).length === 0 ? null : (
        <details className={BOX} data-testid="view-run-notes">
          <summary className={`${typography.viewPanelMeta} cursor-pointer text-info`}>About these numbers</summary>
          {notesBesideTiming(run).map((n, i) => <p key={i} className={typography.viewPanelMeta} title={n.title} data-view={`run.notes.${run.notes.indexOf(n)}.text`}>{n.text}</p>)}
        </details>
      )}
    </div>
  )
}

/**
 * Sharpen your thinking (the previous PoC's block, Paul's 6 Nov side-by-side; vision-audit-20261024 paul-funding-09-panel-analysis.png):
 * core's prompts about the model's shape (`model.sharpen`), each with its family's mark, its lead, its emphasis in bold and its rationale
 * on the ⓘ hover, all core's words; the first two shown, the rest behind "+N more". Nothing when core sends none.
 */
function SharpenCard({ model }: { model: ViewModel }) {
  const rows = sharpenRowsOf(model)
  if (rows.length === 0) return null
  const split = firstFew(rows, SHARPEN_SHOWN)
  const line = ({ row, i }: { row: SharpenRow; i: number }) => (
    <div key={row.id} className="flex gap-2" data-sharpen={row.id}>
      <span className="mt-1 shrink-0"><NodeShapeIndicator nodeKind={sharpenKindOf(row.id)} size={10} /></span>
      <p className="min-w-0 flex-1">
        <span data-view={`sharpen.${i}.lead`}>{row.lead}</span>{' '}
        <span className="font-semibold" data-view={`sharpen.${i}.emphasis`}>{row.emphasis}</span>
      </p>
      <span role="img" aria-label={row.rationale} title={row.rationale} data-view-hover={`sharpen.${i}.rationale`} data-testid={`view-run-sharpen-why-${row.id}`}
        className={`${typography.viewPanelMeta} shrink-0 cursor-help`}>ⓘ</span>
    </div>
  )
  return (
    <section className={BOX} data-testid="view-run-sharpen" aria-label="Sharpen your thinking">
      <p className={typography.panelHeader}>Sharpen your thinking</p>
      {split.shown.map(line)}
      {split.more.length === 0 ? null : (
        <details data-testid="view-run-sharpen-more" className="space-y-2">
          <summary className={`${typography.viewPanelMeta} cursor-pointer text-info`}>{`+${split.more.length} more`}</summary>
          {split.more.map(line)}
        </details>
      )}
    </section>
  )
}

/** While a proposal is held, the tabs say so first in core's words: its heading and the version it is on (`proposal.heading`, `.on`). */
export function HeldProposalLine() {
  const p = useViewStore((s) => s.view?.proposal ?? null)
  return p === null ? null : (
    <p className={`${typography.viewPanelMeta} text-text-light`} data-testid="view-tabs-held-proposal">
      <span data-view-proposal="heading">{p.heading}</span> <span data-view-proposal="on">{p.on}</span>
    </p>
  )
}

/** The block on the olumi-core lane: the View's model as shown (`shownModel`: the approved one, or a held proposal's under its heading). */
export function ViewChancesBlock() {
  const model = useViewStore(shownModel), chat = useViewStore((s) => s.view?.chat ?? null)
  return model === null ? null : <><HeldProposalLine /><ViewChances model={model} chat={chat} /></>
}
