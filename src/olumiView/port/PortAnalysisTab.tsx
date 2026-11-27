/**
 * The Analysis tab on the olumi-core lane: WHAT THE MODEL IMPLIES, seen rather than read (design, 18 Nov 2026,
 * ~/olumi-work/claude-checks/ui-lead-20261117/overnight/analysis/DESIGN.md). The chat already says it in words; this tab draws it, once.
 * Its state is read from the options' rows (`tabStateOf`), never from run fields:
 *   - a chance: the chart (each option's chance on one track, how far it moves, core's words under it), then what would change it (the
 *     figures it moves most with, ✎ each; what would change which option leads, try it), then what is not in the result yet;
 *   - limits (alone, or under a chance): each option's state against each limit, core's line for it under;
 *   - nothing yet: what a result needs, ranked, one press each.
 * Core's notes (`run.notes`: what the result leaves out, assumes or cannot say) are drawn at rest, whatever the state, as one quiet list under the
 * chart (A2); core's long reading (its most-likely line, the comparisons) is one press away under "Why this reading", never at rest.
 * Above it all, the model's state is said once, in the Reasoning tab's own strip (`StateStrip`): a held proposal, or a what-if with its way back.
 * Every word about the person's model is core's, at its View path (`data-view`); the headings are the tab's own chrome.
 */
import { useId, useState } from 'react'
import type { ViewModel } from '../client'
import { FigureEdit } from '../FigureEdit'
import { pressCard } from '../reasoning/tabRing'
import { shownModel, useViewStore } from '../store'
import { WhatIfShown } from '../ViewChances'
import { StateStrip, useTabState } from '../reasoning/StateStrip'
import { comparedGroupsOf, notesBesideTiming } from '../layout'
import { ChanceChart } from './ChanceChart'
import { LikelyOutcome } from './LikelyOutcome'
import { cardOf, limitGroupsOf, tabStateOf } from './pick'
import { ResultNeeds } from './ResultNeeds'
import { TYPE } from './type'
import { FailureAfterYours, TippingPerOption } from './AnalysisReaders'
import { WhatMovesIt } from './WhatMovesIt'
import { FoldChevron } from '../look/FoldChevron'
import { REASONING_LABELS, RestsOn } from '../ViewReasoning'
import { checkItemsOf } from '../check/items'
import { COMMITMENT_WORDS, displayedDissent } from '../reasoning/TowardsCommitment'
import { useReasoningFocus } from '../reasoning/focusRequest'
import { useUIStore } from '../../stores/uiStore'
import { typography } from '../../styles/typography'
import { useAnchoredTip } from '../look/Tip'
import { GlyphMark, Hover } from '../look/Hover'

/** The tab's own chrome: the fold that holds core's long reading. */
export const ANALYSIS_WORDS = { why: 'Why this reading' } as const

/** One of core's notes, verbatim; its longer words (`title`), when core sends them, through the one Tip on pointer and on keyboard focus. */
function NoteLine({ n, i }: { n: NonNullable<ViewModel['run']>['notes'][number]; i: number }) {
  const longer = n.title !== '' && n.title !== n.text ? n.title : undefined
  const { handlers, tip, describedBy } = useAnchoredTip(longer)
  return (
    <>
      <li tabIndex={longer === undefined ? undefined : 0} aria-describedby={describedBy} data-view={`run.notes.${i}.text`} {...handlers}>{n.text}</li>
      {tip}
    </>
  )
}

/** One of core's timing assumptions (`run.timing`), its whole sentence verbatim ("Olumi's timing assumption, not your figure: 'X' is 1 to 4 months."); core sends no title or mark for it. */
function TimingLine({ t, i }: { t: NonNullable<ViewModel['run']>['timing'][number]; i: number }) {
  return <li data-timing={t.quantity} data-view={`run.timing.${i}.text`}>{t.text}</li>
}

/** Core's notes on the result (`run.notes`: what it leaves out, assumes or cannot say), one quiet list at rest, with Olumi's timing assumptions (`run.timing`) each once in the
 *  same list, in core's words. The generic what-if note for a quantity a timing line says is skipped (layout.ts `notesBesideTiming`), so the assumption is said once.
 *  Core sends no heading for them and no kind (caveat or question), so none is written here and they are not split. */
function LeavesOut({ model }: { model: ViewModel }) {
  const run = model.run ?? null
  const timing = (run?.timing ?? []).map((t, i) => ({ t, i })).filter(({ t }) => t.text !== '')
  // Only a timing line that is drawn may suppress a note.
  const kept = new Set(run === null ? [] : notesBesideTiming({ ...run, timing: timing.map(({ t }) => t) }))
  const notes = (run?.notes ?? []).map((n, i) => ({ n, i })).filter(({ n }) => n.text !== '' && kept.has(n))
  if (notes.length === 0 && timing.length === 0) return null
  return (
    <section data-testid="analysis-leaves-out">
      <ul className="ok-an-notes">
        {timing.map(({ t, i }) => <TimingLine key={t.quantity} t={t} i={i} />)}
        {notes.map(({ n, i }) => <NoteLine key={i} n={n} i={i} />)}
      </ul>
    </section>
  )
}

/** Each limit, then each option's state against it (core's `state_text`) and core's line for it under (its condition kept), its reading on hover;
 *  a press goes to the option's card. */
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
                <Hover as="button" type="button" onClick={() => pressCard(card.id)} words={row.olumi == null ? row.title : `${row.title}\n${row.olumi.title}`} className={`${TYPE.body} block min-h-7 w-full rounded-sm px-1 py-0.5 text-left hover:bg-panel-hover`} data-limit-option={card.id}>
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 text-text-header" data-view={`${card.id}.heading`}>{card.heading}</span>
                    {row.state_text == null || row.state_text === '' ? null : <span className={`${TYPE.meta} shrink-0 text-text-body`} data-view={`${card.id}.rows.${i}.state_text`}>{row.state_text}</span>}
                    {row.olumi == null ? null : <GlyphMark mark={row.olumi} tip={false} className={`${TYPE.meta} shrink-0 text-info`} view={`${card.id}.rows.${i}.olumi.glyph`} />}
                  </span>
                  {/* Core's own line for the state, with any condition it rests on ("if … does not happen"), always visible. */}
                  {row.value === '' ? null : <span className={`${TYPE.meta} block text-text-light`} data-view={`${card.id}.rows.${i}.value`}>{row.value}</span>}
                </Hover>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

/**
 * Core's comparisons, each group under core's own heading for it (`compared_headings`), each line verbatim with Olumi's mark where core gives one,
 * the Run's text on hover; a kind this page does not know, or a group core gives no heading for, draws nothing. Drawn on the panel's scale
 * (the shared `Compared` uses the larger legacy header token).
 */
function ComparedLines({ run }: { run: NonNullable<ViewModel['run']> }) {
  const groups = comparedGroupsOf(run)
  return groups.length === 0 ? null : (
    <div data-testid="view-run-compared" className="space-y-3">
      {groups.map(({ group, heading, lines }) => (
        <div key={group} className="space-y-1" data-testid={`view-run-compared-${group}`} aria-label={heading}>
          <p className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view={`run.compared_headings.${group}`}>{heading}</p>
          {lines.map(({ line: l, i }) => (
            <div key={l.id} data-view-fact={l.id}>
              {l.olumi === null ? null : <><GlyphMark mark={l.olumi} className="text-info" view={`run.compared.${i}.olumi.glyph`} /> </>}
              <Hover words={l.hover} data-view={`run.compared.${i}.line`}>{l.line}</Hover>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Core's long reading, closed at rest: its most-likely line (with ✎ for the figure it rests on), what that rests on, its comparisons. */
function WhyThisReading({ model }: { model: ViewModel }) {
  const [open, setOpen] = useState(false)
  const regionId = useId()
  const run = model.run ?? null
  if (run === null) return null
  const ml = run.most_likely ?? null
  const mlCard = ml?.estimate == null ? null : cardOf(model, ml.estimate)
  const compared = (run.compared ?? []).some((c) => c.line !== '')
  if (ml == null && !compared) return null
  return (
    <section data-testid="analysis-why" data-disclosure={open ? 'open' : 'closed'}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={open ? regionId : undefined} className={`${TYPE.meta} inline-flex min-h-7 items-center gap-1 px-1 text-text-body hover:text-text-header`} data-testid="analysis-why-toggle">
        <FoldChevron open={open} />{ANALYSIS_WORDS.why}
      </button>
      {!open ? null : (
        <div id={regionId} className={`${TYPE.meta} mt-2 space-y-2 text-text-body`} data-testid="analysis-why-region">
          {ml == null ? null : (
            <p className="m-0" data-testid="analysis-why-most-likely">
              <Hover words={ml.title} data-view="run.most_likely.text">{ml.text}</Hover>
              {mlCard?.figure?.edit == null ? null : <> <FigureEdit id={mlCard.id} edit={mlCard.figure.edit} place="analysis-likely" glyph words={false} label={`Give your figure for ${mlCard.heading}`} /></>}
            </p>
          )}
          {ml?.rests_on_text == null || ml.rests_on_text === '' ? null : <p className="m-0 text-text-light" data-view="run.most_likely.rests_on_text">{ml.rests_on_text}</p>}
          {compared ? <ComparedLines run={run} /> : null}
        </div>
      )}
    </section>
  )
}

function ToReasoning({ model }: { model: ViewModel }) {
  const view = useViewStore((s) => s.view)
  const dissent = view?.collab.dissent ?? []
  const items = checkItemsOf(model, view).flatMap((group) => group.blocks.flatMap((block) => block.items))
  const first = items[0]
  if (first === undefined && !dissent.some(displayedDissent)) return null
  return (
    <button type="button" data-testid="analysis-to-reasoning" onClick={() => {
      const { sid } = useViewStore.getState()
      if (sid !== null) useReasoningFocus.setState({ request: { sid, key: first?.key ?? 'commitment' } })
      useUIStore.getState().forceActivateOutputTab('analysisNew')
    }}
      className={`${TYPE.body} flex min-h-7 w-full items-center gap-2 rounded-sm px-1 text-left text-text-body hover:bg-panel-hover`}>
      <span className="min-w-0 flex-1">{first === undefined ? COMMITMENT_WORDS.heading : REASONING_LABELS.examine}</span>
      {first === undefined ? null : <span className={`${TYPE.meta} tabular-nums text-text-light`} data-count>{items.length}</span>}
    </button>
  )
}

/** The tab's body for one model. */
export function PortAnalysis({ model, stated = false }: { model: ViewModel; stated?: boolean }) {
  const state = tabStateOf(model)
  // The dock's wrapper keeps a 16px gutter; the tab takes the panel's 12px (look rule) without a shared-file edit.
  return (
    <div className={`${TYPE.body} -mx-1 space-y-5`} data-testid="port-analysis-tab" data-analysis-state={state}>
      <WhatIfShown model={model} labelled={!stated} />
      {state === 'chance' ? <ChanceChart model={model} /> : null}
      {state === 'chance' ? <LeavesOut model={model} /> : null}
      {state === 'chance' ? <LikelyOutcome model={model} /> : null}
      {state === 'chance' ? <WhatMovesIt model={model} /> : null}
      {state === 'chance' ? <TippingPerOption model={model} /> : null}
      {state === 'chance' ? <RestsOn model={model} run={model.run ?? null} /> : null}
      {state === 'chance' ? <FailureAfterYours model={model} /> : null}
      {state === 'chance' ? null : <ToReasoning model={model} />}
      <Limits model={model} />
      <ResultNeeds model={model} under={state !== 'none'} />
      {state === 'chance' ? null : <LeavesOut model={model} />}
      {/* Core's reading speaks of the chances shown; with none shown it would offer what no chance rests on (Paul's finding), so it is not drawn. */}
      {state === 'chance' ? <WhyThisReading model={model} /> : null}
    </div>
  )
}

/** The tab on the lane: the View's model as shown (`shownModel`: the approved one, or a held proposal's under core's heading). */
export function PortAnalysisTab() {
  const model = useViewStore(shownModel), state = useTabState(model)
  // The model's state is said once, above the tab, in the same strip the Reasoning tab draws (a held proposal, or a what-if with its way
  // back), on the tab's own 12px gutter with a gap under it; nothing at rest.
  return model === null ? null : <><div className="-mx-1 mb-3 empty:hidden"><StateStrip state={state} /></div><PortAnalysis model={model} stated={state === 'whatif'} /></>
}

export default PortAnalysisTab
