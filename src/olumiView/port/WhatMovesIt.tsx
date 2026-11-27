import type { ViewModel, ViewRun } from '../client'
import { FigureEdit } from '../FigureEdit'
import { GlyphMark, Hover } from '../look/Hover'
import { useViewStore } from '../store'
import { TipPoint } from '../v12/scale/TipPoint'
import { cardOf, findOutOf, leadChangeOf } from './pick'
import { figureRange } from '../v12/contract'
import { spanAxisOf } from '../v12/scale/axis'
import type { TippingLine } from '../tipping'
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


/** Use the same bounds as TipPoint so an undrawable crossing has its reading in the fold. */
function canDrawTip(tipping: TippingLine, card: ReturnType<typeof cardOf>) {
  const { at, low, high } = tipping
  if (![at, low, high].every(Number.isFinite) || !(low < high)) return false
  const range = card === null ? null : figureRange(card)
  const values = [at, low, high]
  if (range !== null) values.push(range.low, range.high, range.likely ?? range.low)
  return spanAxisOf(Math.min(...values), Math.max(...values)) !== null
}

export function leadReadingOf(model: ViewModel) {
  const run = model.run ?? null
  const lead = leadChangeOf(run)
  if (lead === null) return null
  const card = cardOf(model, lead.figure)
  const crossing = lead.kind === 'tipping' ? run?.tipping?.find((_, i) => lead.at === `run.tipping.${i}.line`) : undefined
  const tipping = crossing !== undefined && canDrawTip(crossing, card) ? crossing : null
  return { ...lead, card, tipping, hoverAt: lead.at.replace(/\.line$/, lead.kind === 'tipping' ? '.hover' : '.text') }
}

export function MovesHeading() {
  const words = useViewStore((s) => s.view?.lens_words ?? null)
  return (
    <Hover as="h3" words={words?.hint.what_changes} wordsAt="lens_words.hint.what_changes"
      className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view-words={words === null ? undefined : 'lens_words.label.what_changes'}>
      {words?.label.what_changes ?? MOVES_FALLBACK}
    </Hover>
  )
}

type LeadReading = NonNullable<ReturnType<typeof leadReadingOf>>

export function LeadTry({ card }: Pick<LeadReading, 'card'>) {
  return card?.figure?.edit == null ? null : (
    <FigureEdit id={card.id} edit={card.figure.edit} place="analysis-lead" glyph words={false} primary="try" label={`Try a figure for ${card.heading}`} />
  )
}

export function WhatMovesIt({ lead }: { lead: LeadReading | null }) {
  if (lead?.tipping == null) return null
  const { card, tipping } = lead
  const figureAt = lead.at.replace(/\.line$/, '.figure.label')
  return (
    <section className="space-y-2" data-testid="analysis-what-moves">
      <MovesHeading />
      <div className="-mx-1 grid w-[calc(100%+0.5rem)] grid-cols-[minmax(0,3fr)_minmax(0,8fr)_minmax(0,3fr)] items-center gap-x-2 px-1 py-1" data-testid="analysis-lead-change" data-lead-change={lead.kind}>
        <Hover as="div" className="col-span-2 grid min-w-0 grid-cols-subgrid items-center rounded-sm" data-testid="analysis-lead-picture"
          words={lead.line} wordsAt={lead.at}>
          {tipping.figure == null ? null : <span className={`${TYPE.meta} min-w-0 break-words text-text-header`} data-view={figureAt}>{tipping.figure.label}</span>}
          <div className="col-start-2 min-w-0"><TipPoint tipping={tipping} card={card} /></div>
        </Hover>
        <div className="justify-self-start"><LeadTry card={card} /></div>
      </div>
    </section>
  )
}
