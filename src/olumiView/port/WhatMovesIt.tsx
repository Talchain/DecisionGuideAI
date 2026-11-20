/**
 * Under the chance chart, the science as short rows with one press each (design, 18 Nov). The figures the chances move most with are named
 * once, at the chart's whiskers (`ChanceChart`), with their ✎ there; this section never names them again:
 * - what would change which option leads: core's own line (`run.tipping` about the lead, else core's reason nothing tested does), with a
 *   try on its figure where core names one (nothing saved);
 * - what is worth finding out first: core's ranking (`run.find_out`, its heading and each figure's line with core's give words and ✎), then
 *   any worth line (`run.science`) the ranking does not already name. A figure the ranking gives a ✎ is not given a second ✎ at the chart.
 * Under each ranking, one meta line says its scope in core's labels (`find_out[].compared / not_compared / within`), and each figure's estimate size is
 * drawn in the row (core's `estimate_text`; a worth line carries it in its `hover`, drawn whole), no longer only a title.
 * The heading and its hint are core's lens words (`lens_words.label/hint.what_changes`).
 */
import type { ViewModel } from '../client'
import { FigureEdit } from '../FigureEdit'
import { useViewStore } from '../store'
import { cardOf, findOutOf, leadChangeOf, aimSilentsOf } from './pick'
import { TYPE } from './type'
import { typography } from '../../styles/typography'

/** Fixed chrome, used only where core sends no lens words. */
export const MOVES_FALLBACK = 'What would change it'
/** The ranking's scope line (A3): core sends the options and limits a ranking compared, did not compare, and held within, as bare labels; these three words join them. */
export const SCOPE_WORDS = { compared: 'Compared', not_compared: 'Not compared', within: 'Within' } as const
const SCOPE_KEYS = ['compared', 'not_compared', 'within'] as const

export function WhatMovesIt({ model }: { model: ViewModel }) {
  const words = useViewStore((s) => s.view?.lens_words ?? null)
  const run = model.run ?? null
  const lead = leadChangeOf(run)
  const { aims, worth } = findOutOf(run)
  // Core's reason for each aim it tests no lead on, said where a lead's crossing would be; the one already drawn as `lead` is not drawn twice, and an
  // aim whose lead crossing IS drawn has no reason to add.
  const leadAim = lead?.kind === 'tipping' ? (run?.tipping ?? []).find((_, i) => lead.at === `run.tipping.${i}.line`)?.aim ?? null : null
  const silents = aimSilentsOf(run).filter((x) => x.at !== lead?.at && x.aim !== leadAim)
  if (lead === null && silents.length + aims.length + worth.length === 0) return null
  const leadCard = lead === null ? null : cardOf(model, lead.figure)
  return (
    <section className="space-y-2" data-testid="analysis-what-moves" aria-label={words?.label.what_changes ?? MOVES_FALLBACK}>
      <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`} title={words?.hint.what_changes} {...(words === null ? {} : { 'data-view-words': 'lens_words.label.what_changes' })}>
        {words?.label.what_changes ?? MOVES_FALLBACK}
      </h3>
      {lead === null ? null : (
        <p className={`${TYPE.meta} m-0 flex items-start gap-2 text-text-body`} title={lead.hover} data-testid="analysis-lead-change" data-lead-change={lead.kind}>
          <span className="min-w-0 flex-1" data-view={lead.at}>{lead.line}</span>
          {leadCard?.figure?.edit == null ? null : <FigureEdit id={leadCard.id} edit={leadCard.figure.edit} place="analysis-lead" glyph words={false} primary="try" label={`Try a figure for ${leadCard.heading}`} />}
        </p>
      )}
      {silents.map((x) => (
        <p key={x.at} className={`${TYPE.meta} m-0 text-text-body`} title={x.hover} data-testid="analysis-aim-silent" data-silent-aim={x.aim}><span data-view={x.at}>{x.line}</span></p>
      ))}
      {aims.length === 0 ? null : (
        <div className="space-y-1" data-testid="port-find-out">
          {run?.find_out_heading == null || run.find_out_heading === '' ? null : <p className={`${TYPE.meta} m-0 text-text-light`} data-view="run.find_out_heading">{run.find_out_heading}</p>}
          {aims.map(({ aim, a }) => (
            <div key={aim.aim} className="space-y-1" data-find-out-aim={aim.aim} title={aim.line || undefined}>
            {SCOPE_KEYS.every((k) => aim[k].length === 0) ? null : (
              <p className={`${TYPE.meta} m-0 text-text-light`} data-testid="find-out-scope">
                {SCOPE_KEYS.filter((k) => aim[k].length > 0).map((k, n) => (
                  <span key={k} data-find-out-scope={k}>{n === 0 ? '' : ' · '}{SCOPE_WORDS[k]}: {aim[k].map((x, j) => <span key={x.id} data-view={`run.find_out.${a}.${k}.${j}.label`}>{j === 0 ? '' : ', '}{x.label}</span>)}</span>
                ))}
              </p>
            )}
            <ul className="m-0 list-none space-y-1 p-0">
              {aim.figures.map((f, k) => (
                <li key={f.id} className={`${TYPE.meta} text-text-body`} data-find-out-figure={f.id} data-view-fact={f.fact}>
                  <span title={f.estimate_text || undefined}>
                    {f.mark == null ? null : <><span className="text-info" title={f.mark.title} aria-label={f.mark.title} data-view={`run.find_out.${a}.figures.${k}.mark.glyph`}>{f.mark.glyph}</span> </>}
                    <span data-view={`run.find_out.${a}.figures.${k}.line`}>{f.line}</span>
                  </span>
                  {f.estimate_text === '' ? null : <span className="block text-text-light" data-view={`run.find_out.${a}.figures.${k}.estimate_text`}>{f.estimate_text}</span>}
                  {f.give == null ? null : <span className="ml-1" data-find-out-give={f.id}><FigureEdit id={f.id} edit={f.give.edit} place="worth" glyph words={false} lead={f.give.text} label={`Change ${f.label}`} /></span>}
                </li>
              ))}
            </ul>
            </div>
          ))}
        </div>
      )}
      {worth.length === 0 ? null : (
        <ul className="m-0 list-none space-y-1 p-0" data-testid="view-run-worth">
          {worth.map(({ line: l, i }) => (
            <li key={l.id} className={`${TYPE.meta} text-text-body`} title={l.hover} data-view-fact={l.id}>
              {l.olumi === null ? null : <><span className="text-info" title={l.olumi.title} aria-label={l.olumi.title} data-view={`run.science.${i}.olumi.glyph`}>{l.olumi.glyph}</span> </>}
              <span data-view={`run.science.${i}.line`}>{l.line}</span>
              {l.hover === '' ? null : <span className="block whitespace-pre-line text-text-light" data-view={`run.science.${i}.hover`}>{l.hover}</span>}
              {l.figure?.give == null ? null : <span className="ml-1" data-worth-give={l.id}><FigureEdit id={l.figure.id} edit={l.figure.give.edit} place="worth" glyph words={false} lead={l.figure.give.text} label={`Change ${l.figure.label}`} /></span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
