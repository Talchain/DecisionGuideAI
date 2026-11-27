import { Fragment } from 'react'
import type { ViewModel, ViewRun } from '../client'
import { failureOf, tippingOf, worthLinesOf } from '../layout'
import { useMineWritten } from '../lens'
import { useViewStore } from '../store'
import { pressCard } from '../reasoning/tabRing'
import { recordReach, showRecord } from '../v12/showInWorkspace/show'
import { TipPoint } from '../v12/scale/TipPoint'
import { aimSilentsOf, cardOf } from './pick'
import { LeadTry, MovesHeading, type leadReadingOf } from './WhatMovesIt'
import { TYPE } from './type'
import { typography } from '../../styles/typography'
import { OkIcon } from '../look/icons'
import { FigureEdit } from '../FigureEdit'
import { GlyphMark, Hover } from '../look/Hover'

/** The pressable figure's name (mark + hover), as the finding line names its own: never a bare card heading after the sentence. */
export const TIPPING_FIGURE = 'Show this figure on the model'

export function optionTippingOf(run: ViewRun | null, leadAt?: string) {
  const tipping = tippingOf(run)
  if (tipping === null) return null
  const lines = tipping.lines.filter(({ i }) => leadAt !== `run.tipping.${i}.line`)
  return lines.length + tipping.optionSilent.length === 0 ? null : { ...tipping, lines }
}

export function TippingPerOption({ model, reading: t }: { model: ViewModel; reading: ReturnType<typeof optionTippingOf> }) {
  if (t === null) return null
  return (
    <section className="space-y-1" data-testid="analysis-tipping" aria-label={t.heading}>
      <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view="run.tipping_heading">{t.heading}</h3>
      {t.lines.map(({ line: l, i }) => {
        const card = l.figure?.id == null ? null : cardOf(model, l.figure.id)
        return (
          <Fragment key={l.id}>
            <p className={`${TYPE.body} m-0 text-text-body`} data-view-fact={l.id}>
              {l.olumi == null ? null : <><GlyphMark mark={l.olumi} className="text-info" /> </>}
              <Hover words={l.hover} wordsAt={`run.tipping.${i}.hover`} data-view={`run.tipping.${i}.line`}>{l.line}</Hover>
              {card == null ? null : <Hover as="button" type="button" className={`${TYPE.meta} nodrag inline-flex max-w-full items-center gap-1 rounded-sm p-0 align-middle text-left text-text-light underline-offset-2 hover:underline`} words={`${TIPPING_FIGURE}: ${card.heading}`} aria-label={`${TIPPING_FIGURE}: ${card.heading}`}
                onClick={() => { if (recordReach(card.id) === 'show') void showRecord(card.id); else pressCard(card.id) }} data-tipping-figure={card.id}><OkIcon id="why-moves" size={14} inherit decorative /><span className="min-w-0 truncate">{card.heading}</span></Hover>}
              {/* The figure press is inline-flex (never a block) so the pencil after it ends the same line as the row's words, as the card pencils do. What would have to be true: try the figure on a copy (nothing saved); the person types the value, nothing is prefilled from core's threshold. */}
              {card?.figure?.edit == null ? null : <FigureEdit id={card.id} edit={card.figure.edit} place="analysis-tip" glyph words={false} primary="try" label={`Try a figure for ${card.heading}`} />}
            </p>
            <TipPoint tipping={l} card={card} />
          </Fragment>
        )
      })}
      {/* An option core says nothing about, in core's own reason, where its crossing would be (and core's nearest group after it, where sent). */}
      {t.optionSilent.map((x) => (
        <p key={x.at} className={`${TYPE.body} m-0 text-text-body`} data-tipping-silent={x.option ?? ''}>
          <span data-view={x.at}>{x.line}</span>{x.best === null ? null : <>{' '}<span data-view={x.best.at}>{x.best.line}</span></>}
        </p>
      ))}
    </section>
  )
}

export function useFailureReading(run: ViewRun | null) {
  const gate = useViewStore((s) => s.view?.session?.pre_mortem ?? null)
  const chat = useMineWritten()
  const written = gate === null ? chat : gate.state === 'wrote'
  return written ? failureOf(run) : null
}

export function FailureAfterYours({ reading: t }: { reading: ReturnType<typeof useFailureReading> }) {
  if (t === null) return null
  return (
    <section className="space-y-1" data-testid="analysis-failure" aria-label={t.heading}>
      <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view="run.failure_heading">{t.heading}</h3>
      {/* Core's `hover` is the same finding with its count and its limit ("an association only…"): it is what is drawn in the fold, whole, so the limit is
          never hover-only (science lead, 18 Nov; no sentence is cut out of it). A line with no hover is drawn as before. */}
      {t.lines.map(({ line: l, i }) => (l.hover ?? '') !== ''
        ? <p key={l.id} className={`${TYPE.body} m-0 text-text-body`} data-view-fact={l.id}><span data-view={`run.failure.${i}.hover`}>{l.hover}</span></p>
        : <p key={l.id} className={`${TYPE.body} m-0 text-text-body`} data-view-fact={l.id}><span data-view={`run.failure.${i}.line`}>{l.line}</span></p>)}
    </section>
  )
}

export function worthReadingOf(run: ViewRun | null) {
  return worthLinesOf(run?.science ?? []).filter(({ line }) => line.line !== '')
}

export function WorthReading({ lines }: { lines: ReturnType<typeof worthReadingOf> }) {
  if (lines.length === 0) return null
  return (
    <ul className="m-0 list-none space-y-1 p-0" data-testid="view-run-worth">
      {lines.map(({ line: l, i }) => (
        <li key={l.id} className={`${TYPE.meta} text-text-body`} data-view-fact={l.id}>
          {l.olumi === null ? null : <><GlyphMark mark={l.olumi} className="text-info" view={`run.science.${i}.olumi.glyph`} /> </>}
          <span data-view={`run.science.${i}.line`}>{l.line}</span>
          {l.figure?.give == null ? null : <span className="ml-1" data-worth-give={l.id}><FigureEdit id={l.figure.id} edit={l.figure.give.edit} place="worth" glyph words={false} lead={l.figure.give.text} label={`Change ${l.figure.label}`} /></span>}
          {l.hover ? <p className="m-0 whitespace-pre-line text-text-light" data-view={`run.science.${i}.hover`}>{l.hover}</p> : null}
        </li>
      ))}
    </ul>
  )
}

type LeadReading = ReturnType<typeof leadReadingOf>

export function aimReadingOf(run: ViewRun | null, lead: LeadReading) {
  return aimSilentsOf(run).filter((x) => x.at !== lead?.at && x.aim !== lead?.tipping?.aim)
}

export function AimReading({ lead, silents }: { lead: LeadReading; silents: ReturnType<typeof aimReadingOf> }) {
  const withoutPicture = lead !== null && lead.tipping === null ? lead : null
  const withPicture = lead?.tipping == null ? null : lead
  if (withoutPicture === null && withPicture === null && silents.length === 0) return null
  return (
    <section className="space-y-1" data-testid="analysis-aim-reading">
      {lead?.tipping == null ? <MovesHeading /> : null}
      {withoutPicture === null ? null : (
        <p className={`${TYPE.meta} m-0 flex items-start gap-2 text-text-body`} data-testid="analysis-lead-change" data-lead-change={withoutPicture.kind}>
          <Hover words={withoutPicture.hover} wordsAt={withoutPicture.hoverAt} className="min-w-0 flex-1" data-view={withoutPicture.at}>{withoutPicture.line}</Hover>
          <LeadTry card={withoutPicture.card} />
        </p>
      )}
      {withPicture === null ? null : (
        <div className="space-y-1">
          <p className="m-0" data-view={withPicture.at}>{withPicture.line}</p>
          {withPicture.hover ? <p className="m-0 text-text-light" data-view={withPicture.hoverAt}>{withPicture.hover}</p> : null}
        </div>
      )}
      {silents.map((x) => (
        <p key={x.at} className={`${TYPE.meta} m-0 text-text-body`} data-testid="analysis-aim-silent" data-silent-aim={x.aim}>
          <Hover words={x.hover} wordsAt={x.at.replace(/\.line$/, '.text')} data-view={x.at}>{x.line}</Hover>
        </p>
      ))}
    </section>
  )
}
