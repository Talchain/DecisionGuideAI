/**
 * The Reasoning tab on the olumi-core lane, drawn from the View (olumi.view/3) in place of `AnalysisNewTabBody`, which reads CEE's report
 * and has no source here. Paul, 6 and 7 Nov ("we did so much work on the previous version"; reinstate the crafted Reasoning tab): the
 * crafted Reasoning V2 composition (`analysisNew/prototype/ReasoningPanelV3.tsx`, served 24 Oct, vision-audit-20261024
 * *-panel-reasoning.png) on core's View, with its parts ported in `reasoning/parts.tsx`. Top to bottom:
 *   0. above the tab, its state, said once (`reasoning/StateStrip.tsx`, the redesign's head row): a proposal held, a past version looked
 *      at, or a what-if shown, each with its way back; nothing at rest;
 *   1. a what-if tried here, its answer first;
 *   2. the model at a glance: the brief, the goal, and one mark per option, factor, risk and outcome in the canvas's shape and colour for
 *      its kind (core's glyph kept for a reader, its heading on hover), with each row's count, as the crafted strip; each mark a control
 *      that rings, selects and follows its card on the canvas (`reasoning/Spine.tsx`, the redesign's spine);
 *   2b. the option rack (`reasoning/Rack.tsx`, the redesign's Z3; DL ruling 1, 7 Nov): each option's chance through the one readout the
 *      Analysis tab's option row draws it with (`port/HeroOptionRow` HeroReadout), in core's order, beside the marks of what it rests on;
 *   2c. the people strip (`reasoning/People.tsx`, the redesign's Z4; DL ruling 2, 7 Nov): read-only, one chip per view core shares,
 *      pressed to play its figures' effects in the Team tab's own components;
 *   3. Challenge Your Thinking (the crafted `ChallengeCard`): each card core marks `challenged`, its heading as the zone's question (14px,
 *      weight 400) led by core's glyph, its reason under it, whole; and under them the crafted "Assumptions and evidence" door
 *      (`ReasoningSignals`, closed at rest), holding every premise core puts on a card and the reasoning cards core draws, each once, in
 *      the crafted `SignalRow` grid with core's Olumi mark in the end column;
 *   4. What would change your mind (the crafted `SectionShell` row, closed, with its count): each aim's figure worth checking first, and
 *      core's comparisons;
 *   5. each aim's outcome under every option on the aim's one axis (the crafted option bars);
 *   6. Try a figure, behind the same row: core's what-if on a copy, nothing saved, the answer at the top of this tab.
 * Not ported, by the DL's port rulings (7 Nov 08:30Z/08:41Z): `CommitmentSummary` (R2: its sentences were DGAI's, and the Team tab owns
 * commitments); ChallengeCard's Respond (R3: core's challenge route carries no words, so the composer is the one home for them); the
 * method strip, the ask box and the action bar (the conversation already carries core's `session.methods` and the composer: one home per
 * content, R4). Every word is core's, drawn exactly as it arrives, in core's order: nothing is composed, ranked or recommended here, and the
 * figures are on hover. The section headings are this tab's own labels; a count is how many rows a disclosure holds.
 *
 * Each drawn View string carries `data-view`, the path to the exact string it shows (design §3).
 */
import { Activity, FlaskConical } from 'lucide-react'
import { FigureEdit } from './FigureEdit'
import type { ViewCard, ViewModel, ViewRow } from './client'
import { bandPlace, challengedCards, comparedGroupsOf, olumiKey, optionBands, optionCards, outcomePlace, premisesOnce, rowsCarryOutcome, settableFigures, worthLinesOf, type Place } from './layout'
import { shownModel, useViewStore } from './store'
import { Compared, WhatIfShown, Worth } from './ViewChances'
import { Door, SectionRow, SignalRow, ZoneTitle } from './reasoning/parts'
import { Spine } from './reasoning/Spine'
import { ReviewStrip } from './reasoning/ReviewStrip'
import { Commitment } from './reasoning/Commitment'
import { Rack } from './reasoning/Rack'
import { People } from './reasoning/People'
import { StateStrip, useTabState } from './reasoning/StateStrip'
import { typography } from '../styles/typography'

/** The tab's own labels (the crafted Reasoning tab's), the only words not core's. */
export const REASONING_LABELS = {
  brief: 'Brief', goal: 'Goal', options: 'Options', factors: 'Factors', risks: 'Risks', outcomes: 'Outcomes',
  challenge: 'Challenge Your Thinking', commitment: 'Move towards commitment', premises: 'Assumptions and evidence', change: 'What would change your mind', tryFigure: 'Try a figure',
  more: 'More', less: 'Less', glance: 'The model at a glance', review: 'to review',
} as const

/**
 * Core's own mark on a card Olumi added (`cards[].olumi`, as the canvas draws it): its glyph, with core's words on hover and for a reader,
 * so Olumi's additions stay visibly Olumi's here too. Nothing on a card core does not mark (a person's own).
 */
function OlumiMark({ card, inline = true }: { card: ViewCard; inline?: boolean }) {
  if (card.olumi === null) return null
  const mark = <span className="text-text-light" title={card.olumi.title} aria-label={card.olumi.title} data-view={`${card.id}.olumi.glyph`}>{card.olumi.glyph}</span>
  return inline ? <>{' '}{mark}</> : mark
}

/**
 * The crafted ChallengeCard's question (analysisNew/sections/ChallengeCard.tsx), one per card core marks challenged: the card's heading as
 * the zone's question on its own line, 14px at weight 400, led by a quiet mark (core's glyph for the card, in place of the crafted dot),
 * core's Olumi mark after it; then its reason, indented under it, in full. The crafted one-line clamp is not ported: no core words are cut.
 */
function Challenge({ card: c }: { card: ViewCard }) {
  return (
    <div title={c.detail} data-reasoning-challenge={c.id}>
      <p className={`${typography.panelQuestion} m-0 mb-1 mt-2 flex min-w-0 gap-2 text-text-header`} data-testid="view-reasoning-challenge-question">
        <span className="text-text-light" aria-hidden="true" data-view={`${c.id}.glyph`}>{c.glyph}</span>
        <span className="min-w-0"><span data-view={`${c.id}.heading`}>{c.heading}</span><OlumiMark card={c} /></span>
      </p>
      {c.reason === null || c.reason === c.heading ? null : <p className={`${typography.viewPanelMeta} m-0 mb-1 pl-3 text-text-light`} data-testid="view-reasoning-challenge-reason" data-view={`${c.id}.reason`}>{c.reason}</p>}
    </div>
  )
}

/** `stated`: the tab's state is said above it (`ViewReasoningBlock`'s StateStrip), so the what-if box here draws no label of its own. */
export function ViewReasoning({ model, brief = null, stated = false }: { model: ViewModel; brief?: string | null; stated?: boolean }) {
  const view = useViewStore((st) => st.view)
  const run = model.run ?? null, settable = settableFigures(model)
  const challenges = challengedCards(model)
  // Each premise once, wherever core put it (an option's own premises, and the notes on the card they concern), by core's words.
  // An option's own premises are said in its row of the rack (each option's reasoning), so the door holds every other one (one home).
  const { premises, cards: reasoning } = premisesOnce(model, true)
  const notes = premises.length + reasoning.length
  // What would change your mind holds core's worth lines and its compared lines, as Worth and Compared draw them (a group core gives no
  // heading for is drawn as nothing, so it is not counted).
  const change = (run?.science == null ? 0 : worthLinesOf(run.science).length) + comparedGroupsOf(run).flatMap((g) => g.lines).length
  return (
    <div className={`${typography.viewPanelBody} flex-1 min-h-0 olumi-scrollbar overflow-y-auto space-y-6 px-4 py-3`} data-testid="view-reasoning">
      <WhatIfShown model={model} labelled={!stated} />
      <Spine model={model} brief={brief} labels={REASONING_LABELS} />
      <ReviewStrip model={model} review={REASONING_LABELS.review} />
      <Rack model={model} />
      <People view={view} />
      {challenges.length + notes === 0 ? null : (
        <section data-testid="view-reasoning-challenge" aria-label={REASONING_LABELS.challenge} className="space-y-1">
          <ZoneTitle>{REASONING_LABELS.challenge}</ZoneTitle>
          {challenges.map((c) => <Challenge key={c.id} card={c} />)}
          {notes === 0 ? null : (
            <div className="pt-1">
              <Door label={REASONING_LABELS.premises} count={notes} testId="premises">
                {premises.map(({ card, p, j }) => (
                  <SignalRow key={`${card.id}.${j}`} title={p.title} data-reasoning-premise={`${card.id}.${j}`} mark={<span data-view={`${card.id}.premises.${j}.glyph`}>{p.glyph}</span>}>
                    <span data-view={`${card.id}.premises.${j}.text`}>{p.text}</span>{(p.olumi ?? null) === null ? null : <>{' '}<span title={p.olumi!.title} aria-label={p.olumi!.title} data-view={`${card.id}.premises.${j}.olumi.glyph`}>{p.olumi!.glyph}</span></>}
                  </SignalRow>
                ))}
                {reasoning.map((c) => (
                  <SignalRow key={c.id} title={c.detail} data-reasoning-card={c.id} mark={<span data-view={`${c.id}.glyph`}>{c.glyph}</span>} end={<OlumiMark card={c} inline={false} />}>
                    <span data-view={`${c.id}.reason`}>{c.reason}</span>
                  </SignalRow>
                ))}
              </Door>
            </div>
          )}
        </section>
      )}
      {view === null ? null : <Commitment view={view} title={REASONING_LABELS.commitment} />}
      {change === 0 ? null : (
        <SectionRow title={REASONING_LABELS.change} Icon={Activity} count={change} testId="change">
          <Worth run={run} tab="analysisNew" />
          <Compared run={run} />
        </SectionRow>
      )}
      <Outcomes model={model} />
      {settable.length === 0 ? null : (
        <SectionRow title={REASONING_LABELS.tryFigure} Icon={FlaskConical} count={settable.length} testId="try">
          {settable.map((c) => (
            <div key={c.id} className="group" title={c.figure!.text} data-reasoning-try={c.id}>
              <span data-view={`${c.id}.heading`}>{c.heading}</span>{' '}
              <FigureEdit id={c.id} edit={c.figure!.edit} place="reasoning" glyph="✎" quiet label="Try a figure" tab="analysisNew" primary="try" />
            </div>
          ))}
        </SectionRow>
      )}
    </div>
  )
}

/**
 * Each aim's outcome under every option, on the aim's one axis (the previous tab's option bars, core c838f56 `rows[].outcome`): the aim in
 * core's words, then each option's heading, core's own line for its outcome (its range reading on hover) and a bar. From a core before
 * the row outcome (e16a497): each option's outcome bands (`cards[].values`) instead. Nothing where core gives none.
 */
function Outcomes({ model }: { model: ViewModel }) {
  const options = optionCards(model)
  if (!rowsCarryOutcome(model)) {
    const any = options.some((o) => optionBands(model, o.id).length > 0)
    return !any ? null : (
      <div data-testid="view-reasoning-outcomes" className="space-y-2 pt-2">
        {options.map((o) => (
          <div key={o.id} data-view-card={o.id}>
            <div className={typography.panelHeader} data-view={`${o.id}.heading`}>{o.heading}</div>
            <Bands model={model} option={o.id} />
          </div>
        ))}
      </div>
    )
  }
  // The aims in the order core's option rows give them; each aim's heading is core's row words where it first appears.
  const aims: { aim: string; card: ViewCard; i: number }[] = []
  for (const o of options) o.rows.forEach((r, i) => { if (r.kind === 'chance' && r.outcome != null && r.aim_id !== null && !aims.some((a) => a.aim === r.aim_id)) aims.push({ aim: r.aim_id, card: o, i }) })
  return aims.length === 0 ? null : (
    <div data-testid="view-reasoning-outcomes" className="space-y-3 pt-2">
      {aims.map(({ aim, card, i }) => (
        <div key={aim} data-reasoning-aim={aim}>
          <p className={typography.panelHeader} data-view={`${card.id}.rows.${i}.aim`}>{(card.rows[i] as Extract<ViewRow, { kind: 'chance' }>).aim}</p>
          {options.map((o) => {
            const k = o.rows.findIndex((r) => r.kind === 'chance' && r.aim_id === aim && r.outcome != null)
            return k < 0 ? null : (
              <div key={o.id} data-view-card={o.id}>
                <div className={typography.viewPanelMeta} data-view={`${o.id}.heading`}>{o.heading}</div>
                <AimOutcome model={model} card={o} row={o.rows[k]!} i={k} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** A band on its axis: the range as a bar, its middle as a tick (positions only; the words are core's line beside it). */
function Bar({ at }: { at: Place }) {
  return (
    <div aria-hidden="true" className="relative mt-0.5 h-1.5 w-full rounded-full bg-panel-border/50">
      <span data-band-bar className="absolute inset-y-0 min-w-[4px] rounded-full bg-text-light/40" style={{ left: `${at.left}%`, width: `${at.width}%` }} />
      {at.mid === null ? null : <span data-band-mid className="absolute -inset-y-0.5 w-0.5 bg-text-body" style={{ left: `${at.mid}%` }} />}
    </div>
  )
}

/**
 * Under a chance row, the aim's measured quantity under this option (core c838f56 `rows[].outcome`): core's own line, its range reading on
 * hover, and a bar on the aim's one axis, so every option's outcome for that aim reads together. Nothing where core gives none.
 */
function AimOutcome({ model, card, row, i }: { model: ViewModel; card: ViewCard; row: ViewRow; i: number }) {
  if (row.kind !== 'chance' || row.outcome == null) return null
  return (
    <div className="mb-1" title={row.outcome.title} data-outcome={row.aim_id}>
      <span className={typography.viewPanelTabular} data-view={`${card.id}.rows.${i}.outcome.text`}>{row.outcome.text}</span>
      <Bar at={outcomePlace(model, row.aim_id, row.outcome)} />
    </div>
  )
}

/**
 * From a core before the row outcome (e16a497), under an option, each outcome band core gives it (`cards[].values`): the card, core's own line for this option, ◆ (core's key) where
 * core marks it Olumi's, the card's range reading on hover, and a bar placed on the card's one axis so the options can be read together.
 */
function Bands({ model, option }: { model: ViewModel; option: string }) {
  const olumi = olumiKey(model)
  return (
    <>
      {optionBands(model, option).map(({ card, band, i }) => {
        const at = bandPlace(card.values!, band)
        return (
          <div key={card.id} className="mt-1" title={card.figure?.title} data-band={card.id}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={typography.viewPanelMeta} data-view={`${card.id}.heading`}>{card.heading}</span>
              <span className={typography.viewPanelTabular} data-view={`${card.id}.values.${i}.text`}>{band.text}</span>
              {band.olumi && olumi !== null ? <span aria-label={olumi.text} data-view={`key.${olumi.i}.glyph`}>{olumi.glyph}</span> : null}
            </div>
            <Bar at={at} />
          </div>
        )
      })}
    </>
  )
}

/**
 * The tab's body: the View's model as shown (`shownModel`), headed by its state (`StateStrip`): a held proposal under core's heading and
 * base, a past version or a what-if each said once with its way back, so nothing that is not the latest approved model reads as it.
 */
export function ViewReasoningBlock() {
  const model = useViewStore(shownModel), brief = useViewStore((st) => st.view?.brief ?? null), state = useTabState(model)
  // The strip sits on the tab's own 16px gutter (it draws none of its own); nothing at all, and no gap, at rest. The what-if box drops its
  // own label only when the strip is the one saying the what-if (one answer, `useTabState`), never under a proposal's strip.
  return model === null ? null : <><div className="px-4 pt-3 empty:hidden"><StateStrip state={state} /></div><ViewReasoning model={model} brief={brief} stated={state === 'whatif'} /></>
}
