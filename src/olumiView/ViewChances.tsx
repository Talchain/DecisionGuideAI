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
import type { ViewCard, ViewModel, ViewRow, ViewRun } from './client'
import { comparedGroupsOf, optionCards, worthLinesOf } from './layout'
import { currentModel, useViewStore } from './store'
import { clearWhatIf, useWhatIf } from './whatif'
import { typography } from '../styles/typography'
import type { OutputTab } from '../stores/uiStore'
import { findingOf, mostLikelyBasisOf } from './standin'

function Mark({ at, mark }: { at: string; mark: { glyph: string; title: string } | null }) {
  return mark === null ? null : <span data-view={`${at}.glyph`} title={mark.title} aria-label={mark.title}>{mark.glyph}</span>
}

/**
 * Under an option's chance row on the Analysis tab: core's finding in at most two sentences (`text`), with core's line on what it rests
 * on (`rests_on_text`) as its hover, verbatim, never on screen: on real models that line runs to a paragraph (european, core 550ad5f),
 * the wall again (DL 4 Nov: provenance by icons and hover). The icons are the Rests on lens's marks on the cards it names.
 */
export function FindingLines({ at, row }: { at: string; row: ViewRow }) {
  const f = findingOf(row)
  return f.text === null ? null : (
    // The panel's body type, whatever it is drawn inside (the Summary's panel gave it none: R5, the look check's ~18 px line).
    <p className={typography.panelBody} data-view={`${at}.text`} title={f.rests_on_text ?? undefined} data-view-hover={f.rests_on_text === null ? undefined : `${at}.rests_on_text`}>{f.text}</p>
  )
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
          <span className={typography.panelTabular}>{row.approx === '' ? null : <span data-view={`${at}.approx`}>{row.approx}</span>}<span data-view={`${at}.value`}>{row.value}</span>
            {row.olumi === null ? null : <>{NBSP}<Mark at={`${at}.olumi`} mark={row.olumi} /></>}
            {row.likely === null ? null : <>{NBSP}<Mark at={`${at}.likely`} mark={row.likely} /></>}
          </span>
        </div>
      )
    case 'limit':
      return (
        <div className="flex flex-wrap items-baseline gap-x-2" title={row.title} data-view-row={at}>
          <span data-view={`${at}.aim`}>{row.aim}</span>
          <span className={typography.panelTabular}><span data-view={`${at}.value`}>{row.value}</span>{row.olumi === null ? null : <>{NBSP}<Mark at={`${at}.olumi`} mark={row.olumi} /></>}</span>
        </div>
      )
    case 'none':
      // a core before view-dock serves no `text`: the row says its title, as the base dock did (00058 P1)
      return row.text == null
        ? <div data-view-row={at}><span data-view={`${at}.title`}>{row.title}</span></div>
        : <div title={row.title} data-view-row={at}><span data-view={`${at}.text`}>{row.text}</span></div>
  }
}

/**
 * The what-if shown (core's `POST …/whatif`): marked not saved, core's words for the figure tried, then what the copy's Run gives, each
 * option's rows drawn by `Row` from core's own row shape, under the option's heading from this View. Only for the version it was asked on.
 */
export function WhatIfShown({ model }: { model: ViewModel }) {
  const sid = useViewStore((s) => s.sid)
  const shown = useWhatIf((s) => s.shown)
  if (shown === null || shown.sid !== sid || shown.base !== model.edit_base) return null
  const v = shown.variant, heading = new Map(optionCards(model).map((c) => [c.id, c]))
  return (
    <div className="space-y-2 rounded-lg border border-info/30 p-2" data-testid="view-whatif" aria-label="What-if, not saved">
      <div className="flex items-baseline justify-between gap-2">
        <p className={typography.panelHeader}>What-if, not saved</p>
        <button type="button" data-testid="view-whatif-clear" onClick={clearWhatIf} className={`${typography.panelMeta} cursor-pointer text-info underline underline-offset-2`}>Clear</button>
      </div>
      {v.edits.map((e, i) => <p key={e.quantity} data-view={`whatif.edits.${i}.words`}>{e.words}</p>)}
      {v.stopped !== null ? <p data-view="whatif.stopped">{v.stopped}</p>
        : v.blocked !== null ? <p title={v.blocked} data-testid="view-whatif-blocked">Olumi could not work this what-if out.</p>
          : (
            <>
              {v.moved || v.why_not === null ? null : <p className={typography.panelMeta} data-view="whatif.why_not">{v.why_not}</p>}
              {v.most_likely === null ? null : <p title={v.most_likely.title} data-view="whatif.most_likely.text">{v.most_likely.text}</p>}
              {v.rows.map((o) => {
                const card = heading.get(o.option_id)
                return card === undefined ? null : (
                  <div key={o.option_id} data-whatif-card={o.option_id}>
                    <div className={typography.panelHeader}>{card.heading}</div>
                    {o.rows.map((row, i) => <Row key={i} card={{ ...card, id: `whatif.${o.option_id}` }} row={row} i={i} />)}
                  </div>
                )
              })}
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
      <span data-view="run.most_likely.text">{ml.text}</span>
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
export function driverRange(d: Driver): { lowPct: number; highPct: number } | null {
  if (d.low === null || d.high === null || !Number.isFinite(d.low) || !Number.isFinite(d.high)) return null
  const at = (x: number) => Math.min(100, Math.max(0, x * 100))
  return { lowPct: at(d.low), highPct: at(d.high) }
}

/**
 * What moves an option's chance most, as v10's low→high marker (the values band's look): a track from no chance to certain, the span
 * between the chance when that figure is low (hollow ring) and when it is high (filled dot). The numbers place the marks and nothing else;
 * core's whole line is its label and hover (`data-view-label`: the path of the string drawn as the label, not as text). What the two chances are is said once for the panel (`Sensitivity`).
 */
function DriverRange({ id, driver }: { id: string; driver: Driver }) {
  const { lowPct, highPct } = driverRange(driver)!
  const left = Math.min(lowPct, highPct), width = Math.max(2, Math.abs(highPct - lowPct))
  const dot = { position: 'absolute', top: '50%', width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: 4 } as const
  return (
    <div className="mt-1 py-1" role="img" aria-label={driver.text} title={driver.title} data-view-label={`${id}.driver.text`} data-testid={`view-range-driver-${id}`}>
      <div className="relative" style={{ height: 4, background: 'var(--factor-light)', borderRadius: 2 }}>
        <div className="absolute top-0 h-full" data-range-span style={{ left: `${left}%`, width: `${width}%`, background: 'var(--option)', borderRadius: 2 }} />
        <div data-range-low style={{ ...dot, left: `${lowPct}%`, background: 'var(--surface-card)', border: '2px solid var(--option)' }} />
        <div data-range-high style={{ ...dot, left: `${highPct}%`, background: 'var(--option)' }} />
      </div>
    </div>
  )
}

/**
 * What each option's two driver chances are (core's `run.sensitivity`), said once at the head of the option rows, in core's words with its
 * hover; only when an option carries those chances (`driver.low` / `driver.high`), which then draws them as its marker.
 */
export function Sensitivity({ model }: { model: ViewModel }) {
  const s = model.run?.sensitivity ?? null
  if (s === null) return null
  let drawn = false
  for (const c of optionCards(model)) if (c.driver != null && driverRange(c.driver) !== null) drawn = true
  return drawn ? <p className={typography.panelMeta} title={s.title} data-view="run.sensitivity.text">{s.text}</p> : null
}

/**
 * One option: its heading, each row (a chance, a limit, or why there is nothing yet) with what `after` draws under it, and what moves its
 * chance most, all core's; then `children`.
 */
export function OptionLines({ card, after, children }: { card: ViewCard; after?: (row: ViewRow, i: number) => ReactNode; children?: ReactNode }) {
  return (
    <div data-view-card={card.id}>
      <div className={typography.panelHeader} data-view={`${card.id}.heading`}>{card.heading}</div>
      {card.rows.map((row, i) => <Fragment key={i}><Row card={card} row={row} i={i} />{after?.(row, i)}</Fragment>)}
      {card.driver == null ? null : driverRange(card.driver) !== null ? <DriverRange id={card.id} driver={card.driver} />
        : <p className={typography.panelMeta} title={card.driver.title} data-view={`${card.id}.driver.text`}>{card.driver.text}</p>}
      {children}
    </div>
  )
}

/**
 * Each aim's figure most worth checking first (D3), as core's page draws it: its mark when it rests on Olumi's proposals, the line in core's
 * words, the Run's whole reason on hover (olumi.view/3 model.run.science; PL review 4 Nov). `tab`: where a try from its ✎ is drawn.
 */
export function Worth({ run, tab }: { run: ViewRun | null; tab?: OutputTab }) {
  // Only the science kinds this page knows; any other kind is drawn as nothing, never as a worth line (core's D2 adds kinds).
  const worth = run?.science == null ? [] : worthLinesOf(run.science)
  return worth.length === 0 ? null : (
    <div data-testid="view-run-worth" aria-label="Worth checking first">
      <p className={typography.panelHeader}>Worth checking first</p>
      {worth.map(({ line: l, i }) => (
        <div key={l.id} title={l.hover} data-view-fact={l.id}>
          {l.olumi === null ? null : <><span title={l.olumi.title} aria-label={l.olumi.title} data-view={`run.science.${i}.olumi.glyph`}>{l.olumi.glyph}</span> </>}
          <span data-view={`run.science.${i}.line`}>{l.line}</span>
          {l.figure?.mark == null ? null : <> <span title={l.figure.mark.title} aria-label={l.figure.mark.title} data-view={`run.science.${i}.figure.mark.glyph`}>{l.figure.mark.glyph}</span></>}
          {l.figure?.give == null ? null : <> <FigureEdit id={l.figure.id} edit={l.figure.give.edit} place="worth" glyph="✎" words={false} lead={l.figure.give.text} label={`Change ${l.figure.label}`} tab={tab} /></>}
        </div>
      ))}
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

/**
 * The lines for one View model: pure, so a test draws it from a golden View. As the base dock (ViewOnlyRunChancesBlock): the Run's lead,
 * then, when every option waits (`all_withheld`), the waits-on headline; a reason every option shares (`shared_blockers`), said once
 * above the options as core's page says it, since each covered card carries only the mark; each option with its lines and what moves
 * its chance most; the
 * most likely option; the notes; and, when not every option waits, what the chances wait on. Every word is the View's.
 */
export function ViewChances({ model }: { model: ViewModel }) {
  const run = model.run ?? null // absent from a core before view-dock (00058 P1)
  const headline = run !== null && run.all_withheld && run.waits_on !== null
  return (
    <div className={`${typography.panelBody} space-y-3`} data-testid="view-chances">
      <WhatIfShown model={model} />
      {run?.lead == null ? null : <p data-view="run.lead">{run.lead}</p>}
      {!headline ? null : (
        <div data-testid="view-run-waits-headline">
          <p className={typography.panelMeta} data-view="run.waits_on.head">{run.waits_on!.head}</p>
          <p><span data-view="run.waits_on.text">{run.waits_on!.text}</span>{': '}<WaitsOnItems w={run.waits_on!} unknown /></p>
        </div>
      )}
      <SharedBlockers run={run} />
      <Sensitivity model={model} />
      {optionCards(model).map((card) => <OptionLines key={card.id} card={card} after={(row, i) => <FindingLines at={`${card.id}.rows.${i}`} row={row} />} />)}
      {run?.most_likely == null ? null : <MostLikely model={model} ml={run.most_likely} />}
      <Worth run={run} />
      {run === null || run.notes.length === 0 ? null : (
        <div data-testid="view-run-notes">
          {run.notes.map((n, i) => <p key={i} className={typography.panelMeta} title={n.title} data-view={`run.notes.${i}.text`}>{n.text}</p>)}
        </div>
      )}
      {run === null || run.waits_on === null || headline ? null : (
        <p data-testid="view-run-waits-on"><span data-view="run.waits_on.label">{run.waits_on.label}</span>{' '}<WaitsOnItems w={run.waits_on} unknown={false} /></p>
      )}
    </div>
  )
}

/** The block on the olumi-core lane: the page's View of the approved model, or nothing while none is current (`currentModel`). */
export function ViewChancesBlock() {
  const model = useViewStore(currentModel)
  return model === null ? null : <ViewChances model={model} />
}
