/**
 * Under the chance chart, the science as short rows with one press each (design, 18 Nov):
 * - what the chances move most with: each figure the chart's whiskers are drawn for, once, with core's words for its value and whose it is
 *   (Olumi's mark), and ✎ to give your own figure, which is what narrows a range Olumi estimated;
 * - what would change which option leads: core's own line (`run.tipping` about the lead, else core's reason nothing tested does), with a
 *   try on its figure where core names one (nothing saved);
 * - what is worth finding out first: core's ranking (`run.find_out`, its heading and each figure's line with core's give words and ✎), then
 *   any worth line (`run.science`) the ranking does not already name. A figure the ranking gives a ✎ is not given a second ✎ above.
 * The heading and its hint are core's lens words (`lens_words.label/hint.what_changes`).
 */
import type { ViewModel, ViewRun } from '../client'
import { FigureEdit } from '../FigureEdit'
import { worthLinesOf } from '../layout'
import { useViewStore } from '../store'
import { cardOf, leadChangeOf, moversOf } from './pick'
import { TYPE } from './type'
import { typography } from '../../styles/typography'

/** Fixed chrome, used only where core sends no lens words. */
export const MOVES_FALLBACK = 'What would change it'

/** Core's ranking of what to find out first, per aim, with any line or figure; and its worth lines not already named by it (one home). */
export function findOutOf(run: ViewRun | null) {
  const aims = (run?.find_out ?? []).map((aim, a) => ({ aim, a })).filter(({ aim }) => aim.line !== '' || aim.figures.length > 0)
  const said = new Set(aims.flatMap(({ aim }) => aim.figures.map((f) => f.fact)))
  const worth = run?.science == null ? [] : worthLinesOf(run.science).filter(({ line }) => !said.has(line.id) && line.line !== '')
  const given = new Set(aims.flatMap(({ aim }) => aim.figures.filter((f) => f.give != null).map((f) => f.id)))
  for (const { line } of worth) if (line.figure?.give != null) given.add(line.figure.id)
  return { aims, worth, given }
}

export function WhatMovesIt({ model }: { model: ViewModel }) {
  const words = useViewStore((s) => s.view?.lens_words ?? null)
  const run = model.run ?? null
  const movers = moversOf(model)
  const lead = leadChangeOf(run)
  const { aims, worth, given } = findOutOf(run)
  if (movers.length === 0 && lead === null && aims.length + worth.length === 0) return null
  const leadCard = lead === null ? null : cardOf(model, lead.figure)
  return (
    <section className="space-y-2" data-testid="analysis-what-moves" aria-label={words?.label.what_changes ?? MOVES_FALLBACK}>
      <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`} title={words?.hint.what_changes} {...(words === null ? {} : { 'data-view-words': 'lens_words.label.what_changes' })}>
        {words?.label.what_changes ?? MOVES_FALLBACK}
      </h3>
      {movers.length === 0 ? null : (
        <ul className="m-0 list-none space-y-1 p-0" data-testid="analysis-movers">
          {movers.map(({ card, share }) => (
            <li key={card.id} className={`${TYPE.body} flex min-h-6 items-center gap-2`} data-mover={card.id} title={share?.f.line ?? card.figure?.title}>
              <span className="min-w-0 flex-1">
                <span className="text-text-header" data-view={`${card.id}.heading`}>{card.heading}</span>
                {card.figure == null || card.figure.text === '' ? null : <>{' '}<span className={`${TYPE.meta} text-text-body`} data-view={`${card.id}.figure.text`}>{card.figure.text}</span></>}
                {card.olumi == null ? null : <>{' '}<span className={`${TYPE.meta} text-info`} title={card.olumi.title} aria-label={card.olumi.title} data-view={`${card.id}.olumi.glyph`}>{card.olumi.glyph}</span></>}
              </span>
              {card.figure?.edit == null || given.has(card.id) ? null : <FigureEdit id={card.id} edit={card.figure.edit} place="analysis-mover" glyph words={false} label={`Give your figure for ${card.heading}`} />}
            </li>
          ))}
        </ul>
      )}
      {lead === null ? null : (
        <p className={`${TYPE.meta} m-0 flex items-start gap-2 text-text-body`} title={lead.hover} data-testid="analysis-lead-change" data-lead-change={lead.kind}>
          <span className="min-w-0 flex-1" data-view={lead.at}>{lead.line}</span>
          {leadCard?.figure?.edit == null ? null : <FigureEdit id={leadCard.id} edit={leadCard.figure.edit} place="analysis-lead" glyph words={false} primary="try" label={`Try a figure for ${leadCard.heading}`} />}
        </p>
      )}
      {aims.length === 0 ? null : (
        <div className="space-y-1" data-testid="port-find-out">
          {run?.find_out_heading == null || run.find_out_heading === '' ? null : <p className={`${TYPE.meta} m-0 text-text-light`} data-view="run.find_out_heading">{run.find_out_heading}</p>}
          {aims.map(({ aim, a }) => (
            <ul key={aim.aim} className="m-0 list-none space-y-1 p-0" data-find-out-aim={aim.aim} title={aim.line || undefined}>
              {aim.figures.map((f, k) => (
                <li key={f.id} className={`${TYPE.meta} text-text-body`} data-find-out-figure={f.id} data-view-fact={f.fact}>
                  <span title={f.estimate_text || undefined}>
                    {f.mark == null ? null : <><span className="text-info" title={f.mark.title} aria-label={f.mark.title} data-view={`run.find_out.${a}.figures.${k}.mark.glyph`}>{f.mark.glyph}</span> </>}
                    <span data-view={`run.find_out.${a}.figures.${k}.line`}>{f.line}</span>
                  </span>
                  {f.give == null ? null : <span className="ml-1" data-find-out-give={f.id}><FigureEdit id={f.id} edit={f.give.edit} place="worth" glyph words={false} lead={f.give.text} label={`Change ${f.label}`} /></span>}
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
      {worth.length === 0 ? null : (
        <ul className="m-0 list-none space-y-1 p-0" data-testid="view-run-worth">
          {worth.map(({ line: l, i }) => (
            <li key={l.id} className={`${TYPE.meta} text-text-body`} title={l.hover} data-view-fact={l.id}>
              {l.olumi === null ? null : <><span className="text-info" title={l.olumi.title} aria-label={l.olumi.title} data-view={`run.science.${i}.olumi.glyph`}>{l.olumi.glyph}</span> </>}
              <span data-view={`run.science.${i}.line`}>{l.line}</span>
              {l.figure?.give == null ? null : <span className="ml-1" data-worth-give={l.id}><FigureEdit id={l.figure.id} edit={l.figure.give.edit} place="worth" glyph words={false} lead={l.figure.give.text} label={`Change ${l.figure.label}`} /></span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
