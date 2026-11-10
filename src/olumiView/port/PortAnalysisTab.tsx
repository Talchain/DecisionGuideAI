/**
 * The Analysis tab on the olumi-core lane, drawn with the crafted components ported onto olumi.view/3 (in place of `ViewChancesBlock`).
 * This is the one wiring module: it reads the View store and passes the store-reading controls (the ✎ figure edit, the coach's move tap)
 * into the components' slots. Every word is still core's, drawn by the ported components at their View paths.
 *
 * Order, as the crafted hero (answer first): core's proposal heading while one is held; a what-if shown; the hero (lead, most likely line,
 * each aim's options, waits-on, next step) with, under the rows, the range lines, the evidence disclosure ("Why and what could change
 * it": drivers, what would have to be true, D8, D5, trade-offs, worth checking first) and "What to act on next"; then core's notes behind
 * "About these numbers".
 *
 * The crafted key-question card and factor insights are not ported (removed 7 Nov, UI's checker): core's first prompt is already a row of
 * "What to act on next", and the Reasoning tab already draws every premise once, under "Assumptions and evidence".
 */
import type { ViewModel, ViewTurn } from '../client'
import { FigureEdit } from '../FigureEdit'
import { newestNextOf, notesBesideTiming } from '../layout'
import { shownModel, useViewStore } from '../store'
import { HeldProposalLine, WhatIfShown } from '../ViewChances'
import { MoveTap } from '../ViewChat'
import { ActOnIt } from './ActOnIt'
import { actRowsOf } from './pick'
import { AnalysisHeroPanel } from './AnalysisHeroPanel'
import { DriverTornado } from './DriverTornado'
import { GoalChanceRangeLines } from './GoalChanceRangeLines'
import { HeroEvidenceDisclosure } from './HeroEvidenceDisclosure'
import { TYPE } from './type'
import { YourOptions } from './YourOptions'

/** The tab's body for one model: the ported components with the alpha's own controls in their slots. */
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
        waitsBelow={actRowsOf(model).some((r) => r.kind === 'wait')}
        mostLikelyAction={mlCard === undefined ? undefined : <FigureEdit id={mlCard.id} edit={mlCard.figure!.edit} place="likely" glyph="✎" words={false} label={`Give your figure for ${mlCard.heading}`} />}
        nextAction={next === null ? undefined : <MoveTap turn={next.turn.id} next={next.next} arrow />}
      >
        <GoalChanceRangeLines model={model} />
        <HeroEvidenceDisclosure
          model={model}
          giveAction={(l) => (l.figure?.give == null ? null : <FigureEdit id={l.figure.id} edit={l.figure.give.edit} place="worth" glyph="✎" words={false} lead={l.figure.give.text} label={`Change ${l.figure.label}`} />)}
        />
        <ActOnIt
          model={model}
          action={(r) => (r.kind === 'wait' && r.item.edit !== null ? <FigureEdit id={r.item.id} edit={r.item.edit} place="act" glyph="✎" words={false} label={`Give your figure for ${r.item.text}`} /> : null)}
        />
      </AnalysisHeroPanel>
      <YourOptions model={model} />
      <DriverTornado model={model} />
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
