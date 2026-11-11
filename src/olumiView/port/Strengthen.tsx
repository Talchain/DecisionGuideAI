/**
 * "Strengthen your model", restored (UI recovery row 17, DL 10 Nov 2026): the previous product's panel title and its focus rows
 * (`coaching-panel/focus-now`, the panel that held this slot), fed by core's View. Every word is core's, in core's order within each
 * source, never ranked here:
 * - each figure worth finding out (`run.science` worth lines): the figure's name; opened, core's line and its hover in full, with the
 *   figure's give words and ✎ in the caller's slot;
 * - each prompt about the model's shape (`model.sharpen`): its lead; opened, its emphasis and the method it rests on (`rationale`).
 * Core holds no steps, effort, status or priority, so the previous "Try this", "Not relevant" and "Mark addressed" are not drawn.
 *
 * UI-9 (DL 11 Nov): where core sends `run.find_out` (science surface 4, SCI-8: every figure the Run found worth finding out for an aim, in
 * the order of the model's estimate of what knowing each is worth), it is drawn first, under core's `find_out_heading`: for each aim core's
 * line, then each figure's line, verbatim, in core's order, with core's mark (whose the figure is, in core's words in the line and its
 * mark's title), its give words and ✎ in the caller's slot, and the Run's estimate (`estimate_text`) only on hover. `points` is never
 * drawn. Each figure is said once: a worth line (`run.science`) for the same figure (its id is a figure's `fact`) is not drawn again as a
 * row. Each figure's line is drawn whole (never the row card's one-line clamp). Absent, nothing is drawn: stored facts cannot tell "none
 * found" from "not worked out", so the page never says there is nothing to find out.
 */
import type { ReactNode } from 'react'
import { FocusNowPanel } from '../../canvas/components/coaching-panel/focus-now/FocusNowPanel'
import { FOCUS_TITLE } from '../../canvas/components/coaching-panel/focus-now/focusConstants'
import type { FocusRow } from '../../canvas/components/coaching-panel/focus-now/focusTypes'
import { SectionHeader } from '../../components/results/SectionHeader'
import type { ViewModel, ViewRun } from '../client'
import { worthLinesOf } from '../layout'
import { CORE_ROW } from './FocusNow'
import { TYPE } from './type'

export type WorthLine = NonNullable<ViewRun['science']>[number]
export type FindOutFigure = NonNullable<ViewRun['find_out']>[number]['figures'][number]
/** The previous rows' icons, by what a prompt is about. */
const SHARPEN_ICON = { risk_count: 'shield-alert', option_breadth: 'scale', shared_mechanism: 'lightbulb' } as const

export interface StrengthenProps {
  model: ViewModel
  /** Mounted in an opened worth row (its figure's give words and ✎, `science[].figure.give`). */
  giveAction?: (line: WorthLine, i: number) => ReactNode
  /** Mounted under a figure worth finding out (its give words and ✎, `find_out[].figures[].give`). */
  findOutGive?: (figure: FindOutFigure) => ReactNode
}

/** Core's figures worth finding out, each aim with its place in `run.find_out` (its View path); only an aim with a line or a figure. */
export const findOutOf = (run: ViewRun | null) =>
  (run?.find_out ?? []).map((aim, a) => ({ aim, a })).filter(({ aim }) => aim.line !== '' || aim.figures.length > 0)

export function Strengthen({ model, giveAction, findOutGive }: StrengthenProps) {
  const run = model.run ?? null
  const findOut = findOutOf(run)
  // One home per figure: a worth line is the Run's fact for a figure, and a figure worth finding out names that same fact (SCI-8:
  // `figures[0].fact` is the aim's `science[]` line), so that line is drawn here once, under core's heading, never again as a row.
  const saidBelow = new Set(findOut.flatMap(({ aim }) => aim.figures.map((f) => f.fact)))
  const worth = run?.science == null ? [] : worthLinesOf(run.science).filter(({ line }) => !saidBelow.has(line.id))
  const sharpen = (model.sharpen ?? []).filter((s) => s.lead !== '' || s.emphasis !== '')
  if (findOut.length + worth.length + sharpen.length === 0) return null
  const rows: FocusRow[] = [
    ...worth.map(({ line: l }): FocusRow => ({
      ...CORE_ROW, id: `worth:${l.id}`, iconKey: 'target',
      primary: l.figure?.label ?? l.line,
      noticed: l.figure == null ? undefined : l.line,
      whyItMatters: l.hover !== '' && l.hover !== l.line ? l.hover : undefined,
    })),
    ...sharpen.map((s): FocusRow => ({
      ...CORE_ROW, id: `sharpen:${s.id}`, iconKey: SHARPEN_ICON[s.id],
      primary: s.lead !== '' ? s.lead : s.emphasis,
      noticed: s.lead !== '' && s.emphasis !== '' ? s.emphasis : undefined,
      whyItMatters: s.rationale !== '' ? s.rationale : undefined,
    })),
  ]
  const byRow = new Map(worth.map((w) => [`worth:${w.line.id}`, w]))
  return (
    <section className="space-y-2 rounded-lg border border-panel-border bg-panel p-3" data-testid="port-strengthen">
      <SectionHeader title={FOCUS_TITLE} testId="section-header-strengthen" className="mb-0" />
      {findOut.length === 0 ? null : (
        <div className="space-y-2" data-testid="port-find-out">
          {run?.find_out_heading == null || run.find_out_heading === '' ? null
            : <p className={`${TYPE.body} font-medium text-text-header`} data-view="run.find_out_heading">{run.find_out_heading}</p>}
          {findOut.map(({ aim, a }) => (
            <div key={aim.aim} className="space-y-1.5" data-find-out-aim={aim.aim}>
              {aim.line === '' ? null : <p className={`${TYPE.meta} text-text-light`} data-view={`run.find_out.${a}.line`}>{aim.line}</p>}
              <ul className="m-0 list-none space-y-1.5 p-0">
                {aim.figures.map((f, k) => (
                  <li key={f.id} className="space-y-0.5" data-find-out-figure={f.id} data-find-out-whose={f.whose} data-view-fact={f.fact}>
                    <p className={`${TYPE.body} text-text-body`} title={f.estimate_text === '' ? undefined : f.estimate_text}>
                      {f.mark == null ? null : <><span title={f.mark.title} aria-label={f.mark.title} data-view={`run.find_out.${a}.figures.${k}.mark.glyph`}>{f.mark.glyph}</span> </>}
                      <span data-view={`run.find_out.${a}.figures.${k}.line`}>{f.line}</span>
                    </p>
                    {f.give == null || findOutGive === undefined ? null : <div className={TYPE.meta} data-find-out-give={f.id}>{findOutGive(f)}</div>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {rows.length === 0 ? null : (
        <FocusNowPanel bare whole summary={null} rows={rows} banner={{ kind: 'none' }} showFreshnessBanner={false}
          rowExtra={giveAction === undefined ? undefined : (row) => { const w = byRow.get(row.id); return w === undefined ? null : giveAction(w.line, w.i) }} />
      )}
    </section>
  )
}

export default Strengthen
