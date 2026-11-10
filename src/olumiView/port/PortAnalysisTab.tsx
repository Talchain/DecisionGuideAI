/**
 * The Analysis tab on the olumi-core lane. This is the one wiring module: it reads the View store and passes the store-reading controls
 * (the ✎ figure edit, the coach's move tap) into the sections' slots. Every word a section draws is core's.
 *
 * UI recovery (DL 10 Nov 2026): the previous product's Analysis sections are back, in its order, each fed by core's View:
 *   1. the hero (core's lead, the lens switch, each aim's options, the most likely line, timing, what the chances wait on);
 *   2. Focus now (the coach's next step, and each figure the chances wait on);
 *   3. Strengthen your model (what is worth finding out, and core's prompts about the model's shape);
 *   4. Your options (the previous option cards: each option's chance of meeting the aim);
 *   5. What could change the result (the driver chart);
 *   6. Stress test (what would have to be true, what could go wrong, how much rests on Olumi's guesses);
 *   then core's notes behind "About these numbers".
 * Each thing is said once (SC-02): what a section below draws is taken out of the hero (its next step, its rows' "would have to be
 * true" lines, and every view of its disclosure but the trade-offs).
 *
 * Not drawn, because core sends nothing for them (listed in BUILD-LEDGER, A3 10 Nov): a factor ranking, per-factor tornado rows, the
 * previous stress test's own sentences, the risk-appetite filter and the advanced block.
 */
import type { ViewModel, ViewTurn } from '../client'
import { FigureEdit } from '../FigureEdit'
import { newestNextOf, notesBesideTiming } from '../layout'
import { shownModel, useViewStore } from '../store'
import { HeldProposalLine, WhatIfShown } from '../ViewChances'
import { MoveTap } from '../ViewChat'
import { AnalysisHeroPanel } from './AnalysisHeroPanel'
import { FocusNow } from './FocusNow'
import { GoalChanceRangeLines } from './GoalChanceRangeLines'
import { HeroEvidenceDisclosure } from './HeroEvidenceDisclosure'
import { Strengthen } from './Strengthen'
import { StressTest } from './StressTest'
import { TYPE } from './type'
import { WhatWouldChange } from './WhatWouldChange'
import { YourOptions } from './YourOptions'

/** The tab's body for one model: the sections with the alpha's own controls in their slots. */
export function PortAnalysis({ model, chat = null }: { model: ViewModel; chat?: readonly ViewTurn[] | null }) {
  const run = model.run ?? null
  const ml = run?.most_likely ?? null
  // The ✎ after the most likely line: the card of the figure it rests on, where core offers that card's edit (as ViewChances draws it).
  const mlCard = ml?.estimate == null ? undefined : model.cards.find((c) => c.id === ml.estimate && c.figure?.edit)
  const next = newestNextOf(chat)
  const notes = run === null ? [] : notesBesideTiming(run)
  return (
    <div className={`${TYPE.body} space-y-3`} data-testid="port-analysis-tab">
      <WhatIfShown model={model} />
      <AnalysisHeroPanel
        model={model}
        chat={chat}
        waitsBelow={(run?.waits_on?.items ?? []).some((it) => it.text !== '')}
        nextBelow
        tippingBelow
        mostLikelyAction={mlCard === undefined ? undefined : <FigureEdit id={mlCard.id} edit={mlCard.figure!.edit} place="likely" glyph="✎" words={false} label={`Give your figure for ${mlCard.heading}`} />}
      >
        <GoalChanceRangeLines model={model} />
        {/* The disclosure keeps only what no section below draws: the trade-offs (`run.compared`). */}
        <HeroEvidenceDisclosure model={model} omit={['drivers', 'tipping', 'rests', 'failure', 'worth']} />
      </AnalysisHeroPanel>
      <FocusNow
        model={model}
        chat={chat}
        nextAction={next === null ? undefined : <MoveTap turn={next.turn.id} next={next.next} arrow />}
        waitAction={(it) => (it.edit === null ? null : <FigureEdit id={it.id} edit={it.edit} place="act" glyph="✎" words={false} label={`Give your figure for ${it.text}`} />)}
      />
      <Strengthen
        model={model}
        giveAction={(l) => (l.figure?.give == null ? null : <FigureEdit id={l.figure.id} edit={l.figure.give.edit} place="worth" glyph="✎" words={false} lead={l.figure.give.text} label={`Change ${l.figure.label}`} />)}
      />
      <YourOptions model={model} />
      <WhatWouldChange model={model} />
      <StressTest model={model} />
      {run === null || notes.length === 0 ? null : (
        <details className="space-y-2 rounded-lg border border-panel-border bg-panel p-3" data-testid="port-analysis-notes">
          <summary className={`${TYPE.meta} cursor-pointer text-info`}>About these numbers</summary>
          {notes.map((n, i) => <p key={i} className={TYPE.meta} title={n.title} data-view={`run.notes.${run.notes.indexOf(n)}.text`}>{n.text}</p>)}
        </details>
      )}
    </div>
  )
}

/** The tab on the lane: the View's model as shown (`shownModel`: the approved one, or a held proposal's under core's heading). */
export function PortAnalysisTab() {
  const model = useViewStore(shownModel), chat = useViewStore((s) => s.view?.chat ?? null)
  return model === null ? null : <><HeldProposalLine /><PortAnalysis model={model} chat={chat} /></>
}

export default PortAnalysisTab
