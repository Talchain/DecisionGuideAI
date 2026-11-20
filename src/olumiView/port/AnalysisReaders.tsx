/**
 * Two readers of core's Run that say where the result is weak, drawn on the Analysis tab in core's own words (never rewritten, hover kept):
 * - what would have to be true, per option (`run.tipping`): each crossing core gives for an option, under core's heading. The lead's crossing is
 *   WhatMovesIt's and is not drawn twice (matched by the line's place in `run.tipping`); a figure core names is one press away (as FindingLine).
 * - what could go wrong (`run.failure`): shown only after the person has written their own reasons (core's pre-mortem gate, `session.pre_mortem.state`
 *   'wrote'; a View with no gate falls back to the earlier chat rule), never before, so their reasons come first.
 */
import type { ViewModel } from '../client'
import { failureOf, tippingOf } from '../layout'
import { useMineWritten } from '../lens'
import { useViewStore } from '../store'
import { pressCard } from '../reasoning/tabRing'
import { recordReach, showRecord } from '../v12/showInWorkspace/show'
import { cardOf, leadChangeOf } from './pick'
import { TYPE } from './type'
import { typography } from '../../styles/typography'
import { OkIcon } from '../look/icons'
import { FigureEdit } from '../FigureEdit'
import { GlyphMark, Hover } from '../look/Hover'

/** The pressable figure's name (mark + hover), as the finding line names its own: never a bare card heading after the sentence. */
export const TIPPING_FIGURE = 'Show this figure on the model'

export function TippingPerOption({ model }: { model: ViewModel }) {
  const run = model.run ?? null
  const t = tippingOf(run), lead = leadChangeOf(run)
  const lines = (t?.lines ?? []).filter(({ i }) => !(lead?.kind === 'tipping' && lead.at === `run.tipping.${i}.line`))
  const silents = t?.optionSilent ?? []
  if (t === null || lines.length + silents.length === 0) return null
  return (
    <section className="space-y-1" data-testid="analysis-tipping" aria-label={t.heading}>
      <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view="run.tipping_heading">{t.heading}</h3>
      {lines.map(({ line: l, i }) => {
        const card = l.figure?.id == null ? null : cardOf(model, l.figure.id)
        return (
          <p key={l.id} className={`${TYPE.body} m-0 text-text-body`} data-view-fact={l.id}>
            {l.olumi == null ? null : <><GlyphMark mark={l.olumi} className="text-info" /> </>}
            <Hover words={l.hover} data-view={`run.tipping.${i}.line`}>{l.line}</Hover>
            {card == null ? null : <Hover as="button" type="button" className={`${TYPE.meta} nodrag inline-flex max-w-full items-center gap-1 rounded-sm p-0 align-middle text-left text-text-light underline-offset-2 hover:underline`} words={`${TIPPING_FIGURE}: ${card.heading}`} aria-label={`${TIPPING_FIGURE}: ${card.heading}`}
              onClick={() => { if (recordReach(card.id) === 'show') void showRecord(card.id); else pressCard(card.id) }} data-tipping-figure={card.id}><OkIcon id="why-moves" size={14} inherit decorative /><span className="min-w-0 truncate">{card.heading}</span></Hover>}
            {/* The figure press is inline-flex (never a block) so the pencil after it ends the same line as the row's words, as the card pencils do. What would have to be true: try the figure on a copy (nothing saved); the person types the value, nothing is prefilled from core's threshold. */}
            {card?.figure?.edit == null ? null : <FigureEdit id={card.id} edit={card.figure.edit} place="analysis-tip" glyph words={false} primary="try" label={`Try a figure for ${card.heading}`} />}
          </p>
        )
      })}
      {/* An option core says nothing about, in core's own reason, where its crossing would be (and core's nearest group after it, where sent). */}
      {silents.map((x) => (
        <p key={x.at} className={`${TYPE.body} m-0 text-text-body`} data-tipping-silent={x.option ?? ''}>
          <span data-view={x.at}>{x.line}</span>{x.best === null ? null : <>{' '}<span data-view={x.best.at}>{x.best.line}</span></>}
        </p>
      ))}
    </section>
  )
}

export function FailureAfterYours({ model }: { model: ViewModel }) {
  const gate = useViewStore((s) => s.view?.session?.pre_mortem ?? null)
  const chat = useMineWritten()
  const written = gate === null ? chat : gate.state === 'wrote'
  const t = failureOf(model.run ?? null)
  if (!written || t === null) return null
  return (
    <section className="space-y-1" data-testid="analysis-failure" aria-label={t.heading}>
      <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view="run.failure_heading">{t.heading}</h3>
      {/* Core's `hover` is the same finding with its count and its limit ("an association only…"): it is what is drawn at rest, whole, so the limit is
          never hover-only (science lead, 18 Nov; no sentence is cut out of it). A line with no hover is drawn as before. */}
      {t.lines.map(({ line: l, i }) => (l.hover ?? '') !== ''
        ? <p key={l.id} className={`${TYPE.body} m-0 text-text-body`} data-view-fact={l.id}><span data-view={`run.failure.${i}.hover`}>{l.hover}</span></p>
        : <p key={l.id} className={`${TYPE.body} m-0 text-text-body`} data-view-fact={l.id}><span data-view={`run.failure.${i}.line`}>{l.line}</span></p>)}
    </section>
  )
}
