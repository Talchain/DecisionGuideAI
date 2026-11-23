/**
 * The Reasoning tab on the olumi-core lane shows how sound the thinking is.
 * The state strip and what-if come first, followed by Glance/Detail, the answer summary and the share-of-uncertainty chart.
 * The selected figure's assumption, evidence, examination and next step lead to the corresponding Model explanations passages.
 * Worth examining and Towards commitment keep Core's questions, challenges and team reasoning in view.
 * Model wording carries its Core View path (data-view). Section headings and action labels are chrome.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { View, ViewModel, ViewRun } from './client'
import { FigureEdit } from './FigureEdit'
import { OkIcon, type IconId } from './look/icons'
import { shownModel, useViewStore } from './store'
import { useWhatIfOn, WhatIfShown } from './ViewChances'
import { prefillComposer, runMethod } from './ViewChat'
import { actionable, examineOf, type Examine } from './reasoning/examine'
import { TowardsCommitment } from './reasoning/TowardsCommitment'
import { AnswerBox } from './reasoning/AnswerBox'
import { pressCard, ringFrom } from './reasoning/tabRing'
import { StateStrip, useTabState } from './reasoning/StateStrip'
import { trackPct } from './port/pick'
import { GlyphMark, Hover } from './look/Hover'
import { TYPE } from './port/type'
import { typography } from '../styles/typography'
import { controls } from '../styles/controls'
import { useCanvasStore } from '../canvas/store'
import { focusNodeById } from '../canvas/utils/focusHelpers'
import { optionLetters } from './v12/cards/letters'
import { KindName } from './v12/charts/KindName'
import { LoopDots } from './v12/charts/LoopDots'
import { PanelLevel } from './v12/charts/PanelLevel'
import { StatusRow } from './v12/charts/StatusRow'
import {
  AUTHOR_LABELS, figuresOf, figurePassage, groupPassage, groupsOf,
  loopOf, loopValues, statusId, useExplanationModel, useExplanationScope,
} from './v12/explanations'
import { LinkExplanation } from './v12/chat/ModelExplanations'

/** The tab's own labels, the only words not core's. */
export const REASONING_LABELS = {
  rests: 'What the uncertainty rests on',
  more: (n: number) => `Show ${n} more`, fewer: 'Show fewer',
  examine: 'Worth examining',
  activity: 'Something to work on',
  challenge: 'Challenge your thinking',
  questions: 'Questions worth answering',
  fill: 'Put this in the message box',
  show: 'Show in the workspace',
} as const
const RING = 'reasoning-tab'
const H = `${typography.viewPanelHeading} m-0 text-text-header`
const GREEN = `${typography.viewPanelHeading} inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 ${controls.act}`
const QUIET = `${TYPE.meta} inline-flex min-h-7 items-center gap-1 rounded-sm border border-panel-border px-2 text-text-header hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`
const MORE = `${TYPE.meta} min-h-6 px-1 text-text-light underline underline-offset-2 hover:text-text-header`
/** Figures drawn per group at rest (every group is drawn): core orders them by share, so the first is the one that carries most of that group's uncertainty. */
const REST_FIGURES = 1
/** At most this many rest groups at rest, in core's order (Paul's progressive-disclosure rule); the others sit behind the one existing "Show n more" press. */
export const RESTS_AT_REST = 3
const LIST_AT_REST = 4

type Rest = ViewRun['rests'][number]
type Figure = NonNullable<Rest['figures']>[number]
const WHOSE_FILL: Record<Figure['whose'], string> = { olumi: 'ok-loop-olumi', theirs: 'ok-loop-person', mixed: 'ok-loop-mixed' }
const REST_RING = 'reasoning-rests'
const STATUS = [
  { id: 'assumption', label: 'Assumption', icon: 'person-mark' },
  { id: 'evidence', label: 'Evidence', icon: 'file-read' },
  { id: 'examined', label: 'Examined', icon: 'review-inputs' },
  { id: 'next', label: 'Next', icon: 'next-step' },
] as const

/** One figure's share of a rest's uncertainty: a bar to core's fraction (geometry only; core's line says the number), coloured by whose figure it is. */
function ShareBar({ f }: { f: Figure }) {
  const w = trackPct(f.share)
  return (
    <svg className={`ok-loop-bar ${WHOSE_FILL[f.whose]}`} aria-hidden="true" data-testid="reasoning-share-bar" data-share={w} data-whose={f.whose}>
      <rect x="0.5" y="0.5" height="5" rx="2.5" className="ok-loop-track" />
      <rect x="0" y="0" width={`${w}%`} height="6" rx="3" className="ok-loop-share" />
    </svg>
  )
}

export function RestsOn({ model, run, reasoning = false }: { model: ViewModel; run: ViewRun | null; reasoning?: boolean }) {
  const origin = reasoning ? 'analysisNew' : 'results'
  const scope = useExplanationScope(model)
  const tried = useWhatIfOn(model)
  const expanded = useViewStore((s) => s.expandedRests[origin] === scope)
  const detail = useViewStore((s) => reasoning && s.panelLevels.reasoning === 'detail')
  const picked = useViewStore((s) => s.reasoningFigure?.scope === scope ? s.reasoningFigure : null)
  const nodeIds = useCanvasStore((s) => s.selection.nodeIds)
  const cardId = reasoning ? [...nodeIds].find((id) => model.cards.some((c) => c.id === id)) ?? picked?.record : undefined
  const view = useViewStore((s) => s.view)
  const canExplain = useExplanationModel() === model
  const moreId = useId()
  const activeRow = useRef<HTMLButtonElement>(null)
  const rests = groupsOf(run)
  const current = rests.find(({ r }) => r.id === picked?.group && figuresOf(r).some(({ f }) => f.id === cardId))
    ?? rests.find(({ r }) => figuresOf(r).some(({ f }) => f.id === cardId))
  const currentId = current?.r.id
  useEffect(() => {
    if (reasoning && nodeIds.has(cardId ?? '')) activeRow.current?.scrollIntoView?.({ block: 'nearest' })
  }, [reasoning, cardId, currentId, nodeIds])
  useEffect(() => () => ringFrom(reasoning ? REST_RING : RING, []), [reasoning])
  useEffect(() => {
    if (!reasoning) return
    ringFrom(REST_RING, currentId && cardId ? [cardId] : [])
  }, [reasoning, currentId, cardId])

  if (run === null || rests.length === 0) return null
  const given = new Set<string>()
  const letters = optionLetters(model)
  const visible = expanded ? rests : rests.slice(0, RESTS_AT_REST)
  const shownGroups = current && !visible.includes(current) ? [...visible, current] : visible
  const shownFigures = (r: Rest) => {
    const figures = figuresOf(r)
    return expanded || detail ? figures : figures.filter(({ f }, i) => i < REST_FIGURES || (r.id === currentId && f.id === cardId))
  }
  const folded = rests.reduce((n, { r }) => n + (shownGroups.some((g) => g.r === r) ? figuresOf(r).length - shownFigures(r).length : 1 + figuresOf(r).length), 0)
  const whose = new Set(shownGroups.flatMap(({ r }) => shownFigures(r).map(({ f }) => f.whose)))
  const allFigures = [...new Set(rests.flatMap(({ r }) => figuresOf(r).map(({ f }) => f.id)))]
  const loops = allFigures.map((id) => loopOf(model, canExplain ? view : null, id))
  const answered = loops.filter(({ steps }) => steps[2]).length
  const firstOpen = loops.find(({ steps, card }) => !steps[2] && card !== undefined)
  const next = loops.filter(({ steps }) => steps[3]).length
  const firstWithFigures = shownGroups.findIndex(({ r }) => shownFigures(r).length > 0)
  return (
    <section className="ok-stack" data-testid="reasoning-rests" aria-label={run.rests_heading || REASONING_LABELS.rests}>
      {reasoning && allFigures.length > 0 && <div className="ok-loop-chips" role="group" aria-label="Reasoning summary">
        <span className={typography.viewPanelMeta}>{answered} of {allFigures.length} figures with answers</span>
        <span className={typography.viewPanelMeta}>{firstOpen?.card ? <><span data-view={`${firstOpen.card.id}.heading`}>{firstOpen.card.heading}</span> still open</> : `${loops.length - answered} figures open`}</span>
        <span className={typography.viewPanelMeta}>{next} {next === 1 ? 'figure' : 'figures'} worth finding out</span>
      </div>}
      <h3 className={H} {...(run.rests_heading ? { 'data-view': 'run.rests_heading' } : {})}>{run.rests_heading || REASONING_LABELS.rests}</h3>
      {tried && <p className={`ok-loop-copy ${typography.viewPanelMeta}`}>{view?.proposal ? 'Model in the proposal' : 'Saved model'}</p>}
      <div className="ok-stack" id={moreId} data-testid="reasoning-rests-groups">
        {shownGroups.map(({ r, k }, g) => {
          const option = model.cards.find((c) => c.id === r.option), aim = model.cards.find((c) => c.id === r.aim)
          return (
            <div key={r.id} className="ok-stack" data-rest={r.id}>
              <div className="ok-loop-heading">
                {option && <KindName card={option} name={option.heading} view={`${option.id}.heading`} model={model} letter={letters.get(option.id)} />}
                {aim && <KindName card={aim} name={aim.heading} view={`${aim.id}.heading`} model={model} />}
                {canExplain && option && <LinkExplanation scope={scope} record={option.id} passage={groupPassage(r)}
                  subject={`uncertainty for ${option.heading}${aim ? ` under ${aim.heading}` : ''}`} origin={origin} />}
              </div>
              <p className={`ok-loop-copy ${typography.viewPanelMeta}`}
                data-testid="rests-sentence" data-view={`run.rests.${k}.${r.hover ? 'hover' : 'line'}`}>{r.hover || r.line}</p>
              {g === firstWithFigures && run.rests_figures_heading && <p className={`ok-loop-copy ${typography.viewPanelMeta}`} data-view="run.rests_figures_heading">{run.rests_figures_heading}</p>}
              {shownFigures(r).length > 0 && <ul className="ok-loop-chart" aria-label={run.rests_figures_heading || 'Share of uncertainty by figure'}>
                {shownFigures(r).map(({ f, j }) => {
                  const give = f.give != null && !given.has(f.id)
                  if (give) given.add(f.id)
                  const loop = loopOf(model, canExplain ? view : null, f.id, r)
                  const dotsId = reasoning ? `${moreId}-${k}-${j}` : undefined
                  const active = reasoning && cardId === f.id && r.id === currentId
                  const value = f.text || `${Math.round(trackPct(f.share))}%`
                  return (
                    <li key={f.id} className="ok-loop-chart-item" data-rest-figure={f.id}>
                      <button ref={active ? activeRow : undefined} type="button" className="ok-loop-chart-row ok-loop-control"
                        aria-pressed={reasoning ? active : undefined} aria-describedby={dotsId} aria-label={`${f.label} · ${value} of uncertainty · ${AUTHOR_LABELS[f.whose]}`}
                        onClick={() => {
                          if (reasoning) useViewStore.setState({ reasoningFigure: { scope, group: r.id, record: f.id } })
                          if (!nodeIds.has(f.id)) focusNodeById(f.id)
                          ringFrom(reasoning ? REST_RING : RING, [f.id])
                        }}>
                        <KindName name={f.label} view={`run.rests.${k}.figures.${j}.label`} model={model} card={loop.card} letter={letters.get(f.id)} />
                        <ShareBar f={f} />
                        {reasoning ? <LoopDots id={dotsId} steps={loop.steps} /> : <span />}
                        <span className={`ok-loop-value ${typography.viewPanelTabular}`} data-view={f.text ? `run.rests.${k}.figures.${j}.text` : undefined}>{value}</span>
                      </button>
                      {canExplain && loop.card ? <LinkExplanation scope={scope} record={f.id} passage={figurePassage(r)}
                        subject={`${f.label}’s share of uncertainty${option ? ` for ${option.heading}` : ''}${aim ? ` under ${aim.heading}` : ''}`} origin={origin} /> : <span />}
                      {give ? <FigureEdit id={f.id} edit={f.give!.edit} place="reasoning-rests" glyph words={false} label={`Give your figure for ${f.label}`} /> : <span />}
                      {reasoning && canExplain && loop.card ? null : (
                        <span className={`ok-loop-row-reading ${typography.viewPanelMeta}`}>
                          {f.mark && <><span data-view-hover={`run.rests.${k}.figures.${j}.mark.title`}><GlyphMark mark={f.mark} className="text-info" view={`run.rests.${k}.figures.${j}.mark.glyph`} /></span>{' '}</>}
                          <span data-view={`run.rests.${k}.figures.${j}.line`}>{f.line}</span>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>}
            </div>
          )
        })}
      </div>
      {(expanded || folded > 0) && (
        <button type="button" onClick={() => useViewStore.setState((s) => ({
          expandedRests: { ...s.expandedRests, [origin]: expanded ? undefined : scope },
        }))} aria-expanded={expanded} aria-controls={moreId} className={`${MORE} ok-loop-control`} data-testid="reasoning-rests-more">
          {expanded ? REASONING_LABELS.fewer : REASONING_LABELS.more(folded)}
        </button>
      )}
      {whose.size > 0 && <p className={`ok-loop-key ${typography.viewPanelMeta}`} data-testid="reasoning-rests-key">
        {(['olumi', 'theirs', 'mixed'] as const).filter((w) => whose.has(w)).map((w) => (
          <span key={w}><svg width="8" height="8" aria-hidden="true"><rect width="8" height="8" rx="2" className={WHOSE_FILL[w]} /></svg>{AUTHOR_LABELS[w]}</span>
        ))}
      </p>}
    </section>
  )
}

/** The words an item says (core's, at their View path) and the reason under them, if core gives one. */
function wordsOf(e: Examine): { text: string; at: string; why: string | null; whyAt: string | null; hover?: string; hoverAt?: string } {
  switch (e.kind) {
    case 'challenge': return { text: e.card.heading, at: `${e.card.id}.heading`, why: e.card.reason === null || e.card.reason === e.card.heading ? null : e.card.reason, whyAt: `${e.card.id}.reason`, hover: e.card.detail, hoverAt: `${e.card.id}.detail` }
    case 'method': return e.s.lead !== ''
      ? { text: e.s.lead, at: `sharpen.${e.i}.lead`, why: e.s.emphasis || null, whyAt: `sharpen.${e.i}.emphasis`, hover: e.s.rationale || undefined, hoverAt: `sharpen.${e.i}.rationale` }
      : { text: e.s.emphasis, at: `sharpen.${e.i}.emphasis`, why: null, whyAt: null, hover: e.s.rationale || undefined, hoverAt: `sharpen.${e.i}.rationale` }
    case 'question': return { text: e.q, at: e.typed === null ? `coaching_questions.${e.i}` : `questions.${e.i}.text`, why: null, whyAt: null }
    case 'widen': return { text: e.w.label, at: `model_words.${e.w.k}`, why: null, whyAt: null }
  }
}

/** A sharpen prompt's one action: core's method, run by its id, labelled with core's words for it. */
function Act({ e }: { e: Examine }) {
  if (e.kind !== 'method' || e.method === null) return null
  const { at, m } = e.method
  return <button type="button" className={QUIET} onClick={() => runMethod(m.id)} data-testid="reasoning-method"><OkIcon id="method-mark" size={14} decorative /><span data-view={`session.methods.${at}.text`} data-view-words={`session.methods.${at}.text`}>{m.text}</span></button>
}

/** A challenge is marked by its state; every other item is Olumi's own contribution (core's coaching), so it carries Olumi's mark. */
const MARK: Record<Examine['kind'], IconId> = { challenge: 'challenged', method: 'olumi-mark', question: 'olumi-mark', widen: 'olumi-mark' }
/** Keep the View path on every item and the chrome-word marker on coaching questions and model words. */
const at = (e: Examine, path: string) => e.kind === 'question' || e.kind === 'widen' ? { 'data-view': path, 'data-view-words': path } : { 'data-view': path }
const rowData = (e: Examine) => e.kind === 'challenge' ? { 'data-reasoning-challenge': e.card.id } : e.kind === 'method' ? { 'data-sharpen': e.s.id } : { 'data-examine': e.key }

/**
 * Every other item, compact. A challenge or a question is one press as a whole row (the card shown; core's words put in the message box);
 * a sharpen prompt keeps its words and one quiet action under them, labelled with core's method words.
 */
function Row({ e, scope, links }: { e: Examine; scope: string; links: boolean }) {
  const w = wordsOf(e)
  const ring = () => ringFrom(RING, e.kind === 'challenge' ? [e.card.id] : [])
  // `hover`: the words' longer text through the one Tip, on the words themselves (a focus stop); a challenge's whole row is a press that carries it instead.
  const wordsEl = (hover?: string, showWhy = true) => (
    <Hover words={hover} data-view-hover={hover ? w.hoverAt : undefined} className="min-w-0 flex-1">
      <span className={`${TYPE.body} block text-text-header`} {...at(e, w.at)} {...(e.kind === 'challenge' ? { 'data-testid': 'view-reasoning-challenge-question' } : {})}>{w.text}</span>
      {!showWhy || w.why === null ? null : <span className={`${TYPE.meta} block text-text-body`} data-view={w.whyAt!} {...(e.kind === 'challenge' ? { 'data-testid': 'view-reasoning-challenge-reason' } : {})}>{w.why}</span>}
    </Hover>
  )
  const words = wordsEl()
  const whole = `flex w-full items-start gap-2 rounded-sm px-1 py-2.5 text-left hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`
  const mark = <OkIcon id={MARK[e.kind]} size={14} className="mt-0.5" decorative />
  if (e.kind === 'challenge') return (
    <li className="ok-loop-with-explanation" {...rowData(e)}>
      <Hover as="button" type="button" className={whole} words={links ? undefined : w.hover} data-view-hover={!links && w.hover ? w.hoverAt : undefined}
        onClick={() => pressCard(e.card.id)} onMouseEnter={ring} data-testid="reasoning-challenge-show">{mark}{wordsEl(undefined, !links)}</Hover>
      {links && <LinkExplanation scope={scope} record={e.card.id} passage="challenge" subject={`the challenge to ${e.card.heading}`} />}
    </li>
  )
  // A coaching question is for the team to answer (core's answer-in-place route is engine ask 1): its words are the row, and putting it in the
  // message box is a quiet secondary press, never the row's primary action.
  if (e.kind === 'question') return (
    <li className="flex items-start gap-2 px-1 py-2.5" {...rowData(e)}>
      {mark}
      <span className="min-w-0 flex-1">{words}{e.typed === null ? null : <AnswerBox key={e.typed.id} q={e.typed} />}</span>
      <Hover as="button" type="button" className={`${QUIET} shrink-0`} words={REASONING_LABELS.fill} aria-label={REASONING_LABELS.fill} onClick={() => prefillComposer(e.q)} data-testid="reasoning-question"><OkIcon id="fill-box" size={14} decorative /></Hover>
    </li>
  )
  // Likewise a widening ask: core's label is the row; filling the box with core's draft is the quiet secondary press.
  if (e.kind === 'widen') return (
    <li className="flex items-start gap-2 px-1 py-2.5" {...rowData(e)}>
      {mark}
      <span className="min-w-0 flex-1">{words}</span>
      <Hover as="button" type="button" className={`${QUIET} shrink-0`} words={REASONING_LABELS.fill} aria-label={REASONING_LABELS.fill} onClick={() => prefillComposer(e.w.draft)} data-testid={`reasoning-widen-${e.w.k}`}><OkIcon id="fill-box" size={14} decorative /></Hover>
    </li>
  )
  return (
    <li className="flex items-start gap-2 px-1 py-2.5" {...rowData(e)}>
      {mark}
      <span className="min-w-0 flex-1 space-y-1">{wordsEl(links ? undefined : w.hover, !links)}<span className="block"><Act e={e} /></span></span>
      {links && (w.why || w.hover) && <LinkExplanation scope={scope} record={e.s.id} passage="method" subject={w.text} />}
    </li>
  )
}

function Examined({ items, scope, links }: { items: Examine[]; scope: string; links: boolean }) {
  const returning = useViewStore((s) => s.explanationReturn)
  const listId = useId()
  const returningToMore = returning !== null && items.slice(LIST_AT_REST).some((e) => {
    const record = e.kind === 'challenge' ? e.card.id : e.kind === 'method' ? e.s.id : null
    return record !== null && returning === JSON.stringify([scope, record, e.kind, 'analysisNew'])
  })
  const [all, setAll] = useState(returningToMore)
  useEffect(() => { if (returningToMore) setAll(true) }, [returningToMore])
  if (items.length === 0) return null
  const shown = all || returningToMore ? items : items.slice(0, LIST_AT_REST)
  return (
    <section className="space-y-2" data-testid="reasoning-examine" aria-label={REASONING_LABELS.examine}>
      <h3 className={`${H} flex items-center gap-2`}>{REASONING_LABELS.examine}<span className={`${TYPE.meta} font-normal tabular-nums text-text-light`} data-count>{items.length}</span></h3>
      <ul id={listId} className="m-0 list-none divide-y divide-panel-border p-0">{shown.map((e) => <Row key={e.key} e={e} scope={scope} links={links} />)}</ul>
      {items.length <= LIST_AT_REST ? null : (
        <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all || returningToMore} aria-controls={listId} className={MORE} data-testid="reasoning-examine-more">
          {all ? REASONING_LABELS.fewer : REASONING_LABELS.more(items.length - LIST_AT_REST)}
        </button>
      )}
    </section>
  )
}

/** The activity's one green action: a card shown, a method run, or core's words put in the message box (nothing sent). */
function LeadAct({ e }: { e: Examine }) {
  if (e.kind === 'challenge') return <button type="button" className={GREEN} onClick={() => pressCard(e.card.id)} data-testid="reasoning-challenge-show"><OkIcon id="show-in-workspace" size={14} decorative />{REASONING_LABELS.show}</button>
  if (e.kind === 'method' && e.method !== null) {
    const { at: i, m } = e.method
    return <button type="button" className={GREEN} onClick={() => runMethod(m.id)} data-testid="reasoning-method"><OkIcon id="method-mark" size={14} decorative /><span data-view={`session.methods.${i}.text`} data-view-words={`session.methods.${i}.text`}>{m.text}</span></button>
  }
  // A typed question is answered where it is asked (CONTRACT §3); only a text-only one goes to the message box.
  if (e.kind === 'question' && e.typed !== null) return <div className="w-full"><AnswerBox key={e.typed.id} q={e.typed} /></div>
  const fill = e.kind === 'question' ? { text: e.q, testId: 'reasoning-question' } : e.kind === 'widen' ? { text: e.w.draft, testId: `reasoning-widen-${e.w.k}` } : null
  // Filling the message box is never the primary (green) action: it is the quiet secondary press, the same as in the list.
  return fill === null ? null : <button type="button" className={QUIET} onClick={() => prefillComposer(fill.text)} data-testid={fill.testId}><OkIcon id="fill-box" size={14} decorative />{REASONING_LABELS.fill}</button>
}

/**
 * Something to work on, for another tab where it has no result of its own to show (Analysis while no option has a chance: Codex 011, a
 * model in words must offer an activity). An item of the Reasoning tab's list (the first that carries an action, in its order of kinds),
 * offered as an activity under a neutral label: it claims no priority (core computes none yet, engine ask 2).
 */
export function StartHere({ model }: { model: ViewModel }) {
  const methods = useViewStore((s) => s.view?.session?.methods ?? null)
  const words = useViewStore((s) => s.view?.model_words ?? null) as Record<string, unknown> | null
  const e = examineOf(model, methods, words).find(actionable)
  const scope = useExplanationScope(model)
  const links = useExplanationModel() === model
  if (e === undefined) return null
  const w = wordsOf(e)
  return (
    <section key={e.key} className="space-y-3 rounded-md bg-panel-hover p-3" data-testid="reasoning-focus" data-focus-kind={e.kind} aria-label={REASONING_LABELS.activity} {...rowData(e)}
      onMouseEnter={() => ringFrom(RING, e.kind === 'challenge' ? [e.card.id] : [])} onMouseLeave={() => ringFrom(RING, [])}>
      <p className={`${TYPE.meta} m-0 flex items-center gap-1.5 text-text-light`}><OkIcon id={MARK[e.kind]} size={14} decorative />{REASONING_LABELS.activity}</p>
      <Hover as="p" words={w.hover ?? w.text} data-view-hover={w.hover ? w.hoverAt : w.at} className={`${TYPE.headline} m-0 line-clamp-4 text-text-header`} {...at(e, w.at)}>{w.text}</Hover>
      {w.why === null ? null : <p className={`${TYPE.body} m-0 text-text-body`} data-view={w.whyAt!}>{w.why}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <LeadAct e={e} />
        {links && e.kind === 'challenge' && <LinkExplanation scope={scope} record={e.card.id} passage="challenge" subject={`the challenge to ${e.card.heading}`} origin="results" />}
        {links && e.kind === 'method' && (w.why || w.hover) && <LinkExplanation scope={scope} record={e.s.id} passage="method" subject={w.text} origin="results" />}
      </div>
    </section>
  )
}

function FigureLoop({ model, view, scope }: { model: ViewModel; view: View | null; scope: string }) {
  const picked = useViewStore((s) => s.reasoningFigure?.scope === scope ? s.reasoningFigure : null)
  const nodeIds = useCanvasStore((s) => s.selection.nodeIds)
  const card = [...nodeIds].map((id) => model.cards.find((c) => c.id === id)).find(Boolean)
    ?? model.cards.find((c) => c.id === picked?.record)
  const canExplain = useExplanationModel() === model
  if (!card) return null
  const groups = groupsOf(model.run ?? null).filter(({ r }) => figuresOf(r).some(({ f }) => f.id === card.id))
  const group = groups.find(({ r }) => r.id === picked?.group)?.r ?? groups[0]?.r
  const loop = loopOf(model, view, card.id, group)
  const values = loopValues(loop)
  const hasPassages = groups.length > 0 || loop.steps.some(Boolean) || loop.cautions.length > 0
  return (
    <section className="ok-stack" aria-label={`Reasoning for ${card.heading}`} data-testid="reasoning-figure-loop">
      <h3 className={H}><KindName card={card} model={model} name={card.heading} view={`${card.id}.heading`} letter={optionLetters(model).get(card.id)} /></h3>
      <dl className="ok-loop-statuses">
        {STATUS.map(({ id, label, icon }, i) => <StatusRow key={id} label={label} icon={icon} value={values[i]}
          explain={canExplain && hasPassages ? <LinkExplanation scope={scope} record={card.id} passage={statusId(id, group)} subject={`${label.toLowerCase()} for ${card.heading}`} /> : null} />)}
      </dl>
    </section>
  )
}

/** `stated`: the state strip above the tab already labels the what-if. */
export function ViewReasoning({ model, stated = false }: { model: ViewModel; brief?: string | null; stated?: boolean }) {
  const run = model.run ?? null
  const methods = useViewStore((s) => s.view?.session?.methods ?? null)
  const words = useViewStore((s) => s.view?.model_words ?? null) as Record<string, unknown> | null
  const view = useViewStore((s) => s.view)
  const scope = useExplanationScope(model)
  const links = useExplanationModel() === model
  const items = examineOf(model, methods, words, new Set((view?.collab.dissent ?? []).map((d) => d.id)))
  return (
    <div className={`${TYPE.body} flex-1 min-h-0 olumi-scrollbar overflow-y-auto space-y-4 p-3`} data-testid="view-reasoning" onMouseLeave={() => ringFrom(RING, [])}>
      <WhatIfShown model={model} labelled={!stated} />
      <PanelLevel panel="reasoning" />
      <RestsOn model={model} run={run} reasoning />
      <FigureLoop model={model} view={links ? view : null} scope={scope} />
      <Examined items={items} scope={scope} links={links} />
      {view === null ? null : <TowardsCommitment view={view} />}
    </div>
  )
}

/**
 * The tab's body: the View's model as shown (`shownModel`), headed by its state (`StateStrip`): a held proposal under core's heading, or a
 * what-if said once with its way back, so nothing that is not the latest approved model reads as it.
 */
export function ViewReasoningBlock() {
  const model = useViewStore(shownModel), state = useTabState(model)
  return model === null ? null : <><div className="px-3 pt-3 empty:hidden"><StateStrip state={state} proposalHere={false} /></div><ViewReasoning model={model} stated={state === 'whatif'} /></>
}
