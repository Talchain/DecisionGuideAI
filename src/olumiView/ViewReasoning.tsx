/**
 * The Reasoning tab on the olumi-core lane, drawn from the View (olumi.view/3) in place of `AnalysisNewTabBody`, which reads CEE's report
 * and has no source here. From the Run (`model.run`): its lead; each option's chance, limit, or why there is nothing yet, with what moves its
 * chance most; each aim's figure most worth checking first; then each figure the person may set, to try on a copy with core's what-if
 * (`POST …/whatif`, nothing saved), the answer drawn at the top of this tab. Every word is core's, drawn exactly as it arrives, in core's
 * order: nothing is composed, ranked or recommended here, and the figures are on hover.
 *
 * Each drawn View string carries `data-view`, the path to the exact string it shows (design §3).
 */
import { FigureEdit } from './FigureEdit'
import type { ViewModel } from './client'
import { optionCards, settableFigures } from './layout'
import { currentModel, useViewStore } from './store'
import { OptionLines, SharedBlockers, WhatIfShown, Worth } from './ViewChances'
import { typography } from '../styles/typography'

export function ViewReasoning({ model }: { model: ViewModel }) {
  const run = model.run ?? null, settable = settableFigures(model)
  return (
    <div className={`${typography.panelBody} flex-1 min-h-0 olumi-scrollbar overflow-y-auto space-y-3 px-4 py-3`} data-testid="view-reasoning">
      <WhatIfShown model={model} />
      {run?.lead == null ? null : <p data-view="run.lead">{run.lead}</p>}
      <SharedBlockers run={run} />
      {optionCards(model).map((card) => <OptionLines key={card.id} card={card} />)}
      <Worth run={run} tab="analysisNew" />
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

/** The tab's body: the approved model's View while it is current (`currentModel`), else nothing, so a held proposal never reads as the Run. */
export function ViewReasoningBlock() {
  const model = useViewStore(currentModel)
  return model === null ? null : <ViewReasoning model={model} />
}
