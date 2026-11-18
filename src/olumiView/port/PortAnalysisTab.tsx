/**
 * The Analysis tab on the olumi-core lane: WHAT THE MODEL IMPLIES, seen rather than read (design, 18 Nov 2026,
 * ~/olumi-work/claude-checks/ui-lead-20261117/overnight/analysis/DESIGN.md). The chat already says it in words; this tab draws it, once.
 * Its state is read from the options' rows (`tabStateOf`), never from run fields:
 *   - a chance: the chart (each option's chance on one track, how far it moves, core's words under it), then what would change it (the
 *     figures it moves most with, ✎ each; what would change which option leads, try it), then what is not in the result yet;
 *   - limits only: each option's state against each limit, then what a result needs;
 *   - nothing yet: what a result needs, ranked, one press each.
 * Core's long reading (its most-likely line, the comparisons, its notes) is one press away under "Why this reading", never at rest.
 * Above it all, the model's state is said once: a held proposal or a what-if (`HeldProposalLine`, `WhatIfShown`).
 * Every word about the person's model is core's, at its View path (`data-view`); the headings are the tab's own chrome.
 */
import { useState } from 'react'
import type { ViewModel } from '../client'
import { FigureEdit } from '../FigureEdit'
import { pressCard } from '../reasoning/tabRing'
import { shownModel, useViewStore } from '../store'
import { Compared, HeldProposalLine, WhatIfShown } from '../ViewChances'
import { ChanceChart } from './ChanceChart'
import { cardOf, limitGroupsOf, tabStateOf } from './pick'
import { ResultNeeds } from './ResultNeeds'
import { TYPE } from './type'
import { WhatMovesIt } from './WhatMovesIt'
import { REASONING_LABELS } from '../ViewReasoning'
import { useUIStore } from '../../stores/uiStore'
import { typography } from '../../styles/typography'

/** The tab's own chrome: the fold that holds core's long reading. */
export const ANALYSIS_WORDS = { why: 'Why this reading' } as const

/** Each limit, then each option's state against it (core's `state_text`, its line and reading on hover); a press goes to the option's card. */
function Limits({ model }: { model: ViewModel }) {
  const groups = limitGroupsOf(model)
  if (groups.length === 0) return null
  return (
    <section className="space-y-3" data-testid="analysis-limits">
      {groups.map((g) => (
        <div key={g.aimId} className="space-y-1" data-limit-aim={g.aimId}>
          <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view={g.aim.at}>{g.aim.text}</h3>
          <ul className="m-0 list-none p-0">
            {g.rows.map(({ card, row, i }) => (
              <li key={card.id}>
                <button type="button" onClick={() => pressCard(card.id)} title={row.title} className={`${TYPE.body} flex min-h-7 w-full items-baseline gap-2 rounded-sm px-1 text-left hover:bg-panel-hover`} data-limit-option={card.id}>
                  <span className="min-w-0 flex-1 text-text-header" data-view={`${card.id}.heading`}>{card.heading}</span>
                  {row.state_text == null || row.state_text === '' ? null : <span className={`${TYPE.meta} shrink-0 text-text-body`} data-view={`${card.id}.rows.${i}.state_text`}>{row.state_text}</span>}
                  {row.olumi == null ? null : <span className={`${TYPE.meta} shrink-0 text-info`} title={row.olumi.title} aria-label={row.olumi.title} data-view={`${card.id}.rows.${i}.olumi.glyph`}>{row.olumi.glyph}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

/** Core's long reading, closed at rest: its most-likely line (with ✎ for the figure it rests on), what that rests on, its comparisons, its notes. */
function WhyThisReading({ model }: { model: ViewModel }) {
  const [open, setOpen] = useState(false)
  const run = model.run ?? null
  if (run === null) return null
  const ml = run.most_likely ?? null
  const mlCard = ml?.estimate == null ? null : cardOf(model, ml.estimate)
  const compared = (run.compared ?? []).some((c) => c.line !== '')
  const notes = (run.notes ?? []).map((n, i) => ({ n, i })).filter(({ n }) => n.text !== '')
  if (ml == null && !compared && notes.length === 0) return null
  return (
    <section data-testid="analysis-why" data-disclosure={open ? 'open' : 'closed'}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${TYPE.meta} px-1 text-text-light underline underline-offset-2 hover:text-text-header`} data-testid="analysis-why-toggle">
        {ANALYSIS_WORDS.why}
      </button>
      {!open ? null : (
        <div className={`${TYPE.meta} mt-2 space-y-2 text-text-body`} data-testid="analysis-why-region">
          {ml == null ? null : (
            <p className="m-0" title={ml.title} data-testid="analysis-why-most-likely">
              <span data-view="run.most_likely.text">{ml.text}</span>
              {mlCard?.figure?.edit == null ? null : <> <FigureEdit id={mlCard.id} edit={mlCard.figure.edit} place="analysis-likely" glyph words={false} label={`Give your figure for ${mlCard.heading}`} /></>}
            </p>
          )}
          {ml?.rests_on_text == null || ml.rests_on_text === '' ? null : <p className="m-0 text-text-light" data-view="run.most_likely.rests_on_text">{ml.rests_on_text}</p>}
          {compared ? <Compared run={run} /> : null}
          {notes.map(({ n, i }) => <p key={i} className="m-0 text-text-light" title={n.title} data-view={`run.notes.${i}.text`}>{n.text}</p>)}
        </div>
      )}
    </section>
  )
}

/**
 * With no chance yet, the questions that would move the model on are the Reasoning tab's (core's `coaching_questions`): one press goes there,
 * with their count, rather than saying them twice.
 */
function ToQuestions({ model }: { model: ViewModel }) {
  const n = (model.coaching_questions ?? []).filter((q) => q !== '').length
  if (n === 0) return null
  return (
    <button type="button" onClick={() => useUIStore.getState().forceActivateOutputTab('analysisNew')} data-testid="analysis-to-questions"
      className={`${TYPE.body} flex min-h-7 w-full items-center gap-2 rounded-sm px-1 text-left text-text-body hover:bg-panel-hover`}>
      <span className="min-w-0 flex-1">{REASONING_LABELS.questions}</span>
      <span className={`${TYPE.meta} tabular-nums text-text-light`} data-count>{n}</span>
    </button>
  )
}

/** The tab's body for one model. */
export function PortAnalysis({ model }: { model: ViewModel }) {
  const state = tabStateOf(model)
  // The dock's wrapper keeps a 16px gutter; the tab takes the panel's 12px (look rule) without a shared-file edit.
  return (
    <div className={`${TYPE.body} -mx-1 space-y-5`} data-testid="port-analysis-tab" data-analysis-state={state}>
      <WhatIfShown model={model} />
      {state === 'chance' ? <ChanceChart model={model} /> : null}
      {state === 'chance' ? <WhatMovesIt model={model} /> : null}
      {state === 'limit' ? <Limits model={model} /> : null}
      <ResultNeeds model={model} under={state !== 'none'} />
      {state === 'chance' ? null : <ToQuestions model={model} />}
      <WhyThisReading model={model} />
    </div>
  )
}

/** The tab on the lane: the View's model as shown (`shownModel`: the approved one, or a held proposal's under core's heading). */
export function PortAnalysisTab() {
  const model = useViewStore(shownModel)
  return model === null ? null : <><HeldProposalLine /><PortAnalysis model={model} /></>
}

export default PortAnalysisTab
