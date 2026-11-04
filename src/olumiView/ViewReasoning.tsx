/**
 * The Reasoning tab on the olumi-core lane, drawn from the View (olumi.view/3) in place of `AnalysisNewTabBody`, which reads CEE's report
 * and has no source here. From the Run (`model.run`): its lead; each option's chance, limit, or why there is nothing yet, with what moves its
 * chance most; each aim's figure most worth checking first; core's comparisons under core's own headings; then each figure the person may set, to try on a copy with core's what-if
 * (`POST …/whatif`, nothing saved), the answer drawn at the top of this tab. Every word is core's, drawn exactly as it arrives, in core's
 * order: nothing is composed, ranked or recommended here, and the figures are on hover.
 *
 * Each drawn View string carries `data-view`, the path to the exact string it shows (design §3).
 */
import { FigureEdit } from './FigureEdit'
import type { ViewCard, ViewModel, ViewRow } from './client'
import { bandPlace, olumiKey, optionBands, optionCards, outcomePlace, rowsCarryOutcome, settableFigures, type Place } from './layout'
import { currentModel, useViewStore } from './store'
import { Compared, OptionLines, SharedBlockers, WhatIfShown, Worth } from './ViewChances'
import { typography } from '../styles/typography'

export function ViewReasoning({ model }: { model: ViewModel }) {
  const run = model.run ?? null, settable = settableFigures(model)
  return (
    <div className={`${typography.panelBody} flex-1 min-h-0 olumi-scrollbar overflow-y-auto space-y-3 px-4 py-3`} data-testid="view-reasoning">
      <WhatIfShown model={model} />
      {run?.lead == null ? null : <p data-view="run.lead">{run.lead}</p>}
      <SharedBlockers run={run} />
      {optionCards(model).map((card) => (rowsCarryOutcome(model)
        ? <OptionLines key={card.id} card={card} after={(row, i) => <AimOutcome model={model} card={card} row={row} i={i} />} />
        : <OptionLines key={card.id} card={card}><Bands model={model} option={card.id} /></OptionLines>))}
      <Worth run={run} tab="analysisNew" />
      <Compared run={run} />
      {settable.length === 0 ? null : (
        <div data-testid="view-reasoning-try" aria-label="Try a figure">
          <p className={typography.panelHeader}>Try a figure</p>
          {settable.map((c) => (
            <div key={c.id} className="group" title={c.figure!.text} data-reasoning-try={c.id}>
              <span data-view={`${c.id}.heading`}>{c.heading}</span>{' '}
              <FigureEdit id={c.id} edit={c.figure!.edit} place="reasoning" glyph="✎" quiet label="Try a figure" tab="analysisNew" primary="try" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** A band on its axis: the range as a bar, its middle as a tick (positions only; the words are core's line beside it). */
function Bar({ at }: { at: Place }) {
  return (
    <div aria-hidden="true" className="relative mt-0.5 h-1.5 w-full rounded-full bg-panel-border/50">
      <span data-band-bar className="absolute inset-y-0 min-w-[4px] rounded-full bg-text-light/40" style={{ left: `${at.left}%`, width: `${at.width}%` }} />
      {at.mid === null ? null : <span data-band-mid className="absolute -inset-y-0.5 w-0.5 bg-text-body" style={{ left: `${at.mid}%` }} />}
    </div>
  )
}

/**
 * Under a chance row, the aim's measured quantity under this option (core c838f56 `rows[].outcome`): core's own line, its range reading on
 * hover, and a bar on the aim's one axis, so every option's outcome for that aim reads together. Nothing where core gives none.
 */
function AimOutcome({ model, card, row, i }: { model: ViewModel; card: ViewCard; row: ViewRow; i: number }) {
  if (row.kind !== 'chance' || row.outcome == null) return null
  return (
    <div className="mb-1" title={row.outcome.title} data-outcome={row.aim_id}>
      <span className={typography.panelTabular} data-view={`${card.id}.rows.${i}.outcome.text`}>{row.outcome.text}</span>
      <Bar at={outcomePlace(model, row.aim_id, row.outcome)} />
    </div>
  )
}

/**
 * From a core before the row outcome (e16a497), under an option, each outcome band core gives it (`cards[].values`): the card, core's own line for this option, ◆ (core's key) where
 * core marks it Olumi's, the card's range reading on hover, and a bar placed on the card's one axis so the options can be read together.
 */
function Bands({ model, option }: { model: ViewModel; option: string }) {
  const olumi = olumiKey(model)
  return (
    <>
      {optionBands(model, option).map(({ card, band, i }) => {
        const at = bandPlace(card.values!, band)
        return (
          <div key={card.id} className="mt-1" title={card.figure?.title} data-band={card.id}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={typography.panelMeta} data-view={`${card.id}.heading`}>{card.heading}</span>
              <span className={typography.panelTabular} data-view={`${card.id}.values.${i}.text`}>{band.text}</span>
              {band.olumi && olumi !== null ? <span aria-label={olumi.text} data-view={`key.${olumi.i}.glyph`}>{olumi.glyph}</span> : null}
            </div>
            <Bar at={at} />
          </div>
        )
      })}
    </>
  )
}

/** The tab's body: the approved model's View while it is current (`currentModel`), else nothing, so a held proposal never reads as the Run. */
export function ViewReasoningBlock() {
  const model = useViewStore(currentModel)
  return model === null ? null : <ViewReasoning model={model} />
}
