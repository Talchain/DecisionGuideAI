/**
 * The Reasoning tab on the olumi-core lane, drawn from the View (olumi.view/3) in place of `AnalysisNewTabBody`, which reads CEE's report
 * and has no source here. Paul, 6 Nov ("the right-hand panel tabs' content is completely unacceptable… we did so much work on the
 * previous version"): it follows the previous PoC's Reasoning tab (vision-audit-20261024 *-panel-reasoning.png), under C1 (4 Nov, DGAI's
 * look on core's View), and no longer repeats the Analysis tab's per-option chance rows:
 *   1. the model at a glance: the brief, the goal, and one mark per option, factor, risk and outcome in the canvas's shape and colour for
 *      its kind (core's glyph kept for a reader, its heading on hover), with each row's count, as the previous strip;
 *   2. Challenge Your Thinking: the cards core marks `challenged` (a challenge, a disagreement, evidence that challenges);
 *   3. Assumptions and evidence: every premise core puts on a card, and the reasoning cards core draws, each once;
 *   4. What would change your mind: each aim's figure worth checking first, and core's comparisons;
 *   5. each aim's outcome under every option on the aim's one axis (the previous tab's option bars);
 *   6. Try a figure: core's what-if on a copy, nothing saved, the answer at the top of this tab.
 * The previous tab's "Move towards commitment" sentences were written by DGAI (commitmentSynthesis.ts); core sends no such words, so that
 * part is left out (UI formats no model value). Every word is core's, drawn exactly as it arrives, in core's order: nothing is composed,
 * ranked or recommended here, and the figures are on hover. The section headings are this tab's own labels.
 *
 * Each drawn View string carries `data-view`, the path to the exact string it shows (design §3).
 */
import type { ReactNode } from 'react'
import { FigureEdit } from './FigureEdit'
import type { ViewCard, ViewModel, ViewRow } from './client'
import type { GlanceKind } from './layout'
import { bandPlace, challengedCards, familyCards, glanceRows, olumiKey, optionBands, optionCards, outcomePlace, premisesOnce, rowsCarryOutcome, settableFigures, type Place } from './layout'
import { shownModel, useViewStore } from './store'
import { HeldProposalLine } from './ViewChances'
import { Compared, WhatIfShown, Worth } from './ViewChances'
import { typography } from '../styles/typography'
import { NodeShapeIndicator } from '../canvas/nodes/NodeShapeIndicator'

/** The tab's own labels (the previous PoC's Reasoning tab), the only words not core's. */
export const REASONING_LABELS = {
  brief: 'Brief', goal: 'Goal', options: 'Options', factors: 'Factors', risks: 'Risks', outcomes: 'Outcomes',
  challenge: 'Challenge Your Thinking', premises: 'Assumptions and evidence', change: 'What would change your mind', tryFigure: 'Try a figure',
} as const
/** The model at a glance: each row's label and test id, by the kind the canvas draws its cards as (layout.ts glanceRows picks them). */
const GLANCE: Record<GlanceKind, { label: string; testId: string }> = {
  option: { label: REASONING_LABELS.options, testId: 'options' }, factor: { label: REASONING_LABELS.factors, testId: 'factors' },
  risk: { label: REASONING_LABELS.risks, testId: 'risks' }, outcome: { label: REASONING_LABELS.outcomes, testId: 'outcomes' },
}

function Section({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <section data-testid={`view-reasoning-${testId}`} aria-label={label} className="space-y-1 pt-2">
      <p className={typography.panelHeader}>{label}</p>
      {children}
    </section>
  )
}

export function ViewReasoning({ model, brief = null }: { model: ViewModel; brief?: string | null }) {
  const run = model.run ?? null, settable = settableFigures(model)
  const goals = familyCards(model, ['goal']), challenges = challengedCards(model)
  // Each premise once, wherever core put it (an option's own premises, and the notes on the card they concern), by core's words.
  const { premises, cards: reasoning } = premisesOnce(model)
  const change = (run?.science?.length ?? 0) > 0 || (run?.compared?.length ?? 0) > 0
  return (
    <div className={`${typography.panelBody} flex-1 min-h-0 olumi-scrollbar overflow-y-auto space-y-3 px-4 py-3`} data-testid="view-reasoning">
      <WhatIfShown model={model} />
      <div data-testid="view-reasoning-glance" className="space-y-1">
        {brief === null ? null : (
          <div className="flex gap-2"><span className={`${typography.panelMeta} flex w-20 shrink-0 items-center gap-1.5`}><NodeShapeIndicator nodeKind="decision" size={10} />{REASONING_LABELS.brief}</span><span className="min-w-0 truncate" title={brief} data-view="brief">{brief}</span></div>
        )}
        {goals.map((g) => (
          <div key={g.id} className="flex gap-2"><span className={`${typography.panelMeta} flex w-20 shrink-0 items-center gap-1.5`}><NodeShapeIndicator nodeKind="goal" size={10} />{REASONING_LABELS.goal}</span><span className="min-w-0 truncate" title={g.detail} data-view={`${g.id}.heading`}>{g.heading}</span></div>
        ))}
        {/* As the previous strip: the kind's canvas shape before its label, one mark per card in the canvas's own shape and colour (core's
            glyph kept for a reader, its heading on hover), and how many cards the row has, right-aligned. */}
        {glanceRows(model).map(({ kind, cards }) => (
          <div key={kind} className="flex items-center gap-2" data-testid={`view-reasoning-glance-${GLANCE[kind].testId}`}>
            <span className={`${typography.panelMeta} flex w-20 shrink-0 items-center gap-1.5`}><NodeShapeIndicator nodeKind={kind} size={10} />{GLANCE[kind].label}</span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {cards.map((c) => (
                <span key={c.id} className="inline-flex" title={c.heading} aria-label={c.heading} data-glance-card={c.id} data-glance-kind={kind}>
                  <NodeShapeIndicator nodeKind={kind} size={10} /><span className="sr-only" data-view={`${c.id}.glyph`}>{c.glyph}</span>
                </span>
              ))}
            </span>
            <span className={`${typography.panelMeta} shrink-0 tabular-nums`} data-glance-count={kind}>{cards.length}</span>
          </div>
        ))}
      </div>
      {challenges.length === 0 ? null : (
        <Section label={REASONING_LABELS.challenge} testId="challenge">
          {challenges.map((c) => (
            <div key={c.id} title={c.detail} data-reasoning-challenge={c.id}>
              <span aria-hidden="true" data-view={`${c.id}.glyph`}>{c.glyph}</span>{' '}
              <span className="font-medium" data-view={`${c.id}.heading`}>{c.heading}</span>
              {c.reason === null || c.reason === c.heading ? null : <p className={typography.panelMeta} data-view={`${c.id}.reason`}>{c.reason}</p>}
            </div>
          ))}
        </Section>
      )}
      {premises.length + reasoning.length === 0 ? null : (
        <Section label={REASONING_LABELS.premises} testId="premises">
          {premises.map(({ card, p, j }) => (
            <p key={`${card.id}.${j}`} title={p.title} data-reasoning-premise={`${card.id}.${j}`}>
              <span aria-hidden="true" data-view={`${card.id}.premises.${j}.glyph`}>{p.glyph}</span>{' '}<span data-view={`${card.id}.premises.${j}.text`}>{p.text}</span>
            </p>
          ))}
          {reasoning.map((c) => (
            <p key={c.id} title={c.detail} data-reasoning-card={c.id}>
              <span aria-hidden="true" data-view={`${c.id}.glyph`}>{c.glyph}</span>{' '}<span data-view={`${c.id}.reason`}>{c.reason}</span>
            </p>
          ))}
        </Section>
      )}
      {!change ? null : (
        <Section label={REASONING_LABELS.change} testId="change">
          <Worth run={run} tab="analysisNew" />
          <Compared run={run} />
        </Section>
      )}
      <Outcomes model={model} />
      {settable.length === 0 ? null : (
        <div data-testid="view-reasoning-try" aria-label={REASONING_LABELS.tryFigure} className="pt-2">
          <p className={typography.panelHeader}>{REASONING_LABELS.tryFigure}</p>
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
                <div className={typography.panelMeta} data-view={`${o.id}.heading`}>{o.heading}</div>
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
      <span className={typography.panelTabular} data-view={`${card.id}.rows.${i}.outcome.text`}>{row.outcome.text}</span>
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
              <span className={typography.panelMeta} data-view={`${card.id}.heading`}>{card.heading}</span>
              <span className={typography.panelTabular} data-view={`${card.id}.values.${i}.text`}>{band.text}</span>
              {band.olumi && olumi !== null ? <span aria-label={olumi.text} data-view={`key.${olumi.i}.glyph`}>{olumi.glyph}</span> : null}
            </div>
            <Bar at={at} />
          </div>
        )
      })}
    </>
  )
}

/** The tab's body: the View's model as shown (`shownModel`); a held proposal's under its heading (`HeldProposalLine`), never unlabelled. */
export function ViewReasoningBlock() {
  const model = useViewStore(shownModel), brief = useViewStore((st) => st.view?.brief ?? null)
  return model === null ? null : <><HeldProposalLine /><ViewReasoning model={model} brief={brief} /></>
}
