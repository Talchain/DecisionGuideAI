/**
 * Under the chance chart, the science as short rows with one press each (design, 18 Nov). The figures the chances move most with are named
 * once, at the chart's whiskers (`ChanceChart`), with their ✎ there; this section never names them again:
 * - what would change which option leads: core's own line (`run.tipping` about the lead, else core's reason nothing tested does), with a
 *   try on its figure where core names one (nothing saved);
 * - what is worth finding out first: core's ranking (`run.find_out`, its heading and each figure's line with core's give words and ✎), then
 *   any worth line (`run.science`) the ranking does not already name. A figure the ranking gives a ✎ is not given a second ✎ at the chart.
 * Under each ranking, core's qualification sentence (`find_out[].line`) is drawn at rest, and each figure's estimate size is
 * drawn in the row (core's `estimate_text`; a worth line carries it in its `hover`, drawn whole), no longer only a title.
 * The heading and its hint are core's lens words (`lens_words.label/hint.what_changes`).
 */
import type { ViewModel, ViewRun } from '../client'
import { FigureEdit } from '../FigureEdit'
import { GlyphMark, Hover } from '../look/Hover'
import { useViewStore } from '../store'
import { TipPoint } from '../v12/scale'
import { cardOf, findOutOf, leadChangeOf, aimSilentsOf } from './pick'
import { TYPE } from './type'
import { typography } from '../../styles/typography'

/** Fixed chrome, used only where core sends no lens words. */
export const MOVES_FALLBACK = 'What would change it'

type FindOutAim = NonNullable<ViewRun['find_out']>[number]

/** A ranking's qualification, core's whole sentence (`find_out[].line`), verbatim and drawn at rest. Core sends the options and limits it compared, did not
 *  compare and held within as bare labels with no word for which is which, so they are not drawn here (a core ask: scope labels). Nothing when core sends no line. */
function RankingScope({ aim, a }: { aim: FindOutAim; a: number }) {
  return aim.line === '' ? null : <p className="ok-an-scope" data-testid="find-out-scope" data-find-out-note="" data-view={`run.find_out.${a}.line`}>{aim.line}</p>
}

type Whose = FindOutAim['figures'][number]['whose']
export type { Whose }

export function FindOutRanking({ run, only, edit }: { run: ViewRun | null; only: readonly Whose[] | null; edit: boolean }) {
  const { aims } = findOutOf(run)
  if (aims.length === 0) return null
  return (
    <div className="space-y-1" data-testid="port-find-out">
      {run?.find_out_heading == null || run.find_out_heading === '' ? null : <p className={`${TYPE.meta} m-0 text-text-light`} data-view="run.find_out_heading">{run.find_out_heading}</p>}
      {aims.map(({ aim, a }) => (
        <div key={aim.aim} className="ok-an-aim" data-find-out-aim={aim.aim}>
          <RankingScope aim={aim} a={a} />
          <ul className="m-0 list-none space-y-1 p-0">
            {aim.figures.map((f, k) => only !== null && !only.includes(f.whose) ? null : (
              <li key={f.id} className={`${TYPE.meta} text-text-body`} data-find-out-figure={f.id} data-view-fact={f.fact}>
                <span>
                  {f.mark == null ? null : <><GlyphMark mark={f.mark} className="text-info" view={`run.find_out.${a}.figures.${k}.mark.glyph`} /> </>}
                  <span data-view={`run.find_out.${a}.figures.${k}.line`}>{f.line}</span>
                </span>
                {f.estimate_text === '' ? null : <span className="ok-an-detail" data-view={`run.find_out.${a}.figures.${k}.estimate_text`}>{f.estimate_text}</span>}
                {!edit || f.give == null ? null : <span className="ml-1" data-find-out-give={f.id}><FigureEdit id={f.id} edit={f.give.edit} place="worth" glyph words={false} lead={f.give.text} label={`Change ${f.label}`} /></span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function WhatMovesIt({ model }: { model: ViewModel }) {
  const words = useViewStore((s) => s.view?.lens_words ?? null)
  const run = model.run ?? null
  const lead = leadChangeOf(run)
  const { aims, worth } = findOutOf(run)
  // Core's reason for each aim it tests no lead on, said where a lead's crossing would be; the one already drawn as `lead` is not drawn twice, and an
  // aim whose lead crossing IS drawn has no reason to add.
  const leadTipping = lead?.kind === 'tipping' ? run?.tipping?.find((_, i) => lead.at === `run.tipping.${i}.line`) : undefined
  const leadAim = leadTipping?.aim ?? null
  const silents = aimSilentsOf(run).filter((x) => x.at !== lead?.at && x.aim !== leadAim)
  if (lead === null && silents.length + aims.length + worth.length === 0) return null
  const leadCard = lead === null ? null : cardOf(model, lead.figure)
  return (
    <section className="space-y-2" data-testid="analysis-what-moves" aria-label={words?.label.what_changes ?? MOVES_FALLBACK}>
      <Hover as="h3" words={words?.hint.what_changes} className={`${typography.viewPanelHeading} m-0 text-text-header`} {...(words === null ? {} : { 'data-view-words': 'lens_words.label.what_changes' })}>
        {words?.label.what_changes ?? MOVES_FALLBACK}
      </Hover>
      {lead === null ? null : (
        <p className={`${TYPE.meta} m-0 flex items-start gap-2 text-text-body`} data-testid="analysis-lead-change" data-lead-change={lead.kind}>
          <Hover words={lead.hover} className="min-w-0 flex-1" data-view={lead.at}>{lead.line}</Hover>
          {leadCard?.figure?.edit == null ? null : <FigureEdit id={leadCard.id} edit={leadCard.figure.edit} place="analysis-lead" glyph words={false} primary="try" label={`Try a figure for ${leadCard.heading}`} />}
        </p>
      )}
      {leadTipping === undefined ? null : <TipPoint tipping={leadTipping} card={leadCard} />}
      {silents.map((x) => (
        <p key={x.at} className={`${TYPE.meta} m-0 text-text-body`} data-testid="analysis-aim-silent" data-silent-aim={x.aim}><Hover words={x.hover} data-view={x.at}>{x.line}</Hover></p>
      ))}
      <FindOutRanking run={run} only={null} edit />
      {worth.length === 0 ? null : (
        <ul className="m-0 list-none space-y-1 p-0" data-testid="view-run-worth">
          {worth.map(({ line: l, i }) => (
            <li key={l.id} className={`${TYPE.meta} text-text-body`} data-view-fact={l.id}>
              {l.olumi === null ? null : <><GlyphMark mark={l.olumi} className="text-info" view={`run.science.${i}.olumi.glyph`} /> </>}
              <span data-view={`run.science.${i}.line`}>{l.line}</span>
              {l.hover === '' ? null : <span className="ok-an-detail ok-an-detail-lines" data-view={`run.science.${i}.hover`}>{l.hover}</span>}
              {l.figure?.give == null ? null : <span className="ml-1" data-worth-give={l.id}><FigureEdit id={l.figure.id} edit={l.figure.give.edit} place="worth" glyph words={false} lead={l.figure.give.text} label={`Change ${l.figure.label}`} /></span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
