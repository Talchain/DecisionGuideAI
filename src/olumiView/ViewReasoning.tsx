/**
 * The Reasoning tab on the olumi-core lane: HOW SOUND THE THINKING IS (redesign 2 + the UI pass after the Codex critique, 18 Nov 2026:
 * overnight/analysis/REASONING-CRITIQUE.md). Analysis draws what the model implies; this tab draws what that rests on and what is worth
 * examining. It claims no priority core has not computed (core's ranked queue is engine ask 2, ENGINE-ASKS-REASONING.md). Top to bottom:
 *   0. above the tab, its state, said once (`reasoning/StateStrip.tsx`);
 *   1. What the uncertainty rests on (`run.rests`): core's sentence per option and aim, each figure a bar to its share of the variation,
 *      coloured by whose figure it is, core's give ✎ once per figure;
 *   2. Worth examining (`reasoning/examine.ts`): challenged cards, core's coaching questions, its widening asks and its sharpen prompts, each
 *      with Olumi's mark where it is Olumi's and one press (the card, the message box, or core's method);
 *   3. Towards commitment (`reasoning/TowardsCommitment.tsx`): where revealed views differ (core's differences), disagreements still open,
 *      what the team has recorded in full, and one press into the ONE commitment form;
 *   4. Assumptions and evidence: every premise core puts on a card, once, behind one door.
 * Every word about the person's model is core's, at its View path (`data-view`); headings and action labels are the tab's own chrome.
 */
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { ViewModel, ViewRun } from './client'
import { FigureEdit } from './FigureEdit'
import { premisesOnce } from './layout'
import { OkIcon, type IconId } from './look/icons'
import { shownModel, useViewStore } from './store'
import { WhatIfShown } from './ViewChances'
import { prefillComposer, runMethod } from './ViewChat'
import { Door, SignalRow } from './reasoning/parts'
import { actionable, examineOf, type Examine } from './reasoning/examine'
import { TowardsCommitment } from './reasoning/TowardsCommitment'
import { useReasoningFocus } from './reasoning/focusRequest'
import { AnswerBox, AnsweredList } from './reasoning/AnswerBox'
import { pressCard, ringFrom } from './reasoning/tabRing'
import { StateStrip, useTabState } from './reasoning/StateStrip'
import { trackPct } from './port/pick'
import { GlyphMark, Hover } from './look/Hover'
import { TYPE } from './port/type'
import { typography } from '../styles/typography'
import { controls } from '../styles/controls'

/** The tab's own labels, the only words not core's. */
export const REASONING_LABELS = {
  rests: 'What the uncertainty rests on',
  olumi: 'Olumi’s', yours: 'People’s', mixed: 'Both',
  more: (n: number) => `Show ${n} more`, fewer: 'Show fewer',
  examine: 'Worth examining',
  activity: 'Something to work on',
  challenge: 'Challenge your thinking',
  premises: 'Assumptions and evidence',
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
const WHOSE_FILL: Record<Figure['whose'], string> = { olumi: 'fill-info', theirs: 'fill-text-header', mixed: 'fill-text-light' }

/** One figure's share of a rest's uncertainty: a bar to core's fraction (geometry only; core's line says the number), coloured by whose figure it is. */
function ShareBar({ f }: { f: Figure }) {
  const w = trackPct(f.share)
  return (
    <svg className="block h-1.5 w-full" aria-hidden="true" data-testid="reasoning-share-bar" data-share={w} data-whose={f.whose}>
      <rect x="0" y="0" width="100%" height="6" rx="3" className="fill-panel-border" />
      <rect x="0" y="0" width={`${w}%`} height="6" rx="3" className={WHOSE_FILL[f.whose]} />
    </svg>
  )
}

/**
 * What the uncertainty rests on (core's `run.rests`): per option and aim, in core's order, each figure core names as a bar to its share of
 * the variation, Olumi's in Olumi's blue, a person's in ink; core's line beside it, and core's give ✎ at the figure's first appearance, so
 * the person can replace the guess that carries most of the uncertainty. Every group's first (largest) figure at rest; the further figures behind one press.
 */
export function RestsOn({ model, run }: { model: ViewModel; run: ViewRun | null }) {
  const [all, setAll] = useState(false)
  const moreId = useId()
  const rests = (run?.rests ?? []).map((r, k) => ({ r, k })).filter(({ r }) => r.line !== '')  // a group with a headline and no figure detail is kept (A4): its headline is drawn, only the empty figure list is omitted
  if (run === null || rests.length === 0) return null
  const given = new Set<string>()
  const figuresOf = (r: Rest) => (r.figures ?? []).map((f, j) => ({ f, j })).filter(({ f }) => f.line !== '')
  // At rest: the first RESTS_AT_REST groups in core's order, each with its first figure. Everything else is one press away: the later groups (counted as
  // the group and its figures) and the further figures of the groups shown.
  const shownGroups = all ? rests : rests.slice(0, RESTS_AT_REST)
  const folded = all ? 0 : rests.slice(0, RESTS_AT_REST).reduce((n, { r }) => n + Math.max(0, figuresOf(r).length - REST_FIGURES), 0)
    + rests.slice(RESTS_AT_REST).reduce((n, { r }) => n + 1 + figuresOf(r).length, 0)
  const toggle = all || folded > 0
  const firstWithFigures = shownGroups.findIndex(({ r }) => figuresOf(r).length > 0)
  const whose = new Set(shownGroups.flatMap(({ r }) => (all ? figuresOf(r) : figuresOf(r).slice(0, REST_FIGURES)).map(({ f }) => f.whose)))
  return (
    <section className="space-y-2" data-testid="reasoning-rests" aria-label={run.rests_heading || REASONING_LABELS.rests}>
      <h3 className={H} {...(run.rests_heading ? { 'data-view': 'run.rests_heading' } : {})}>{run.rests_heading || REASONING_LABELS.rests}</h3>
      <div className="space-y-3" id={moreId} data-testid="reasoning-rests-groups">
      {shownGroups.map(({ r, k }, g) => {
        const option = model.cards.find((c) => c.id === r.option), aim = model.cards.find((c) => c.id === r.aim)
        return (
          <div key={r.id} className="space-y-2" data-rest={r.id}>
            <p className={`${TYPE.meta} m-0 text-text-light`}>
              {option === undefined ? null : <span data-view={`${option.id}.heading`}>{option.heading}</span>}
              {option !== undefined && aim !== undefined ? ' · ' : null}
              {aim === undefined ? null : <span data-view={`${aim.id}.heading`}>{aim.heading}</span>}
            </p>
            {/* Core's `hover` is its line plus what the people's ranges carry and the limit ("it is not a prediction"): drawn at rest, whole, so the limit
                is never hover-only (science lead, 18 Nov). A row with no hover keeps its line. */}
            {(r.hover ?? '') !== ''
              ? <p className={`${TYPE.meta} m-0 text-text-body`} data-testid="rests-sentence" data-view={`run.rests.${k}.hover`}>{r.hover}</p>
              : <p className={`${TYPE.meta} m-0 text-text-body`} data-testid="rests-sentence" data-view={`run.rests.${k}.line`}>{r.line}</p>}
            {/* Core's label for the figure list (`run.rests_figures_heading`, when it sends one), said once, above the first group that has figures. */}
            {g !== firstWithFigures || !run.rests_figures_heading ? null : <p className={`${TYPE.meta} m-0 text-text-light`} data-view="run.rests_figures_heading">{run.rests_figures_heading}</p>}
            {figuresOf(r).length === 0 ? null : <ul className="m-0 list-none space-y-3 p-0" {...(run.rests_figures_heading ? { 'aria-label': run.rests_figures_heading } : {})}>
              {(all ? figuresOf(r) : figuresOf(r).slice(0, REST_FIGURES)).map(({ f, j }) => {
                const give = f.give != null && !given.has(f.id)
                if (give) given.add(f.id)
                return (
                  <li key={f.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2" data-rest-figure={f.id}>
                    <ShareBar f={f} />
                    <span className={`${TYPE.meta} min-w-0 text-text-body`}>
                      {f.mark == null ? null : <><GlyphMark mark={f.mark} className="text-info" view={`run.rests.${k}.figures.${j}.mark.glyph`} />{' '}</>}
                      <span data-view={`run.rests.${k}.figures.${j}.line`}>{f.line}</span>
                    </span>
                    {give ? <FigureEdit id={f.id} edit={f.give!.edit} place="reasoning-rests" glyph words={false} label={`Give your figure for ${f.label}`} /> : <span />}
                  </li>
                )
              })}
            </ul>}
          </div>
        )
      })}
      </div>
      {!toggle ? null : (
        <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} aria-controls={moreId} className={MORE} data-testid="reasoning-rests-more">
          {all ? REASONING_LABELS.fewer : REASONING_LABELS.more(folded)}
        </button>
      )}
      <p className={`${TYPE.meta} m-0 flex flex-wrap items-center gap-3 text-text-light`} aria-hidden="true" data-testid="reasoning-rests-key">
        {(['olumi', 'theirs', 'mixed'] as const).filter((w) => whose.has(w)).map((w) => (
          <span key={w} className="inline-flex items-center gap-1"><svg className="h-2 w-2"><rect width="8" height="8" rx="2" className={WHOSE_FILL[w]} /></svg>{w === 'olumi' ? REASONING_LABELS.olumi : w === 'theirs' ? REASONING_LABELS.yours : REASONING_LABELS.mixed}</span>
        ))}
      </p>
    </section>
  )
}

/** The words an item says (core's, at their View path) and the reason under them, if core gives one. */
function wordsOf(e: Examine): { text: string; at: string; why: string | null; whyAt: string | null; hover?: string } {
  switch (e.kind) {
    case 'challenge': return { text: e.card.heading, at: `${e.card.id}.heading`, why: e.card.reason === null || e.card.reason === e.card.heading ? null : e.card.reason, whyAt: `${e.card.id}.reason`, hover: e.card.detail }
    case 'method': return e.s.lead !== ''
      ? { text: e.s.lead, at: `sharpen.${e.i}.lead`, why: e.s.emphasis || null, whyAt: `sharpen.${e.i}.emphasis`, hover: e.s.rationale || undefined }
      : { text: e.s.emphasis, at: `sharpen.${e.i}.emphasis`, why: null, whyAt: null, hover: e.s.rationale || undefined }
    case 'question': return { text: e.q, at: e.typed === null ? `coaching_questions.${e.i}` : `questions.${e.i}.text`, why: null, whyAt: null }
    case 'widen': return { text: e.w.label, at: `model_words.${e.w.k}`, why: null, whyAt: null }
  }
}

/** A sharpen prompt's one action: core's method, run by its id, labelled with core's words for it. */
function Act({ e }: { e: Examine }) {
  if (e.kind !== 'method' || e.method === null) return null
  const { at, m } = e.method
  return <button type="button" className={QUIET} onClick={() => runMethod(m.id)} data-testid="reasoning-method"><OkIcon id="method-mark" size={14} decorative /><span data-view-words={`session.methods.${at}.text`}>{m.text}</span></button>
}

/** A challenge is marked by its state; every other item is Olumi's own contribution (core's coaching), so it carries Olumi's mark. */
const MARK: Record<Examine['kind'], IconId> = { challenge: 'challenged', method: 'olumi-mark', question: 'olumi-mark', widen: 'olumi-mark' }
/** Where an item's words sit: on the model (`data-view`), or in core's chrome words (`data-view-words`: the coaching questions and model words). */
const at = (e: Examine, path: string) => e.kind === 'question' || e.kind === 'widen' ? { 'data-view-words': path } : { 'data-view': path }
const rowData = (e: Examine) => e.kind === 'challenge' ? { 'data-reasoning-challenge': e.card.id } : e.kind === 'method' ? { 'data-sharpen': e.s.id } : { 'data-examine': e.key }

/**
 * Every other item, compact. A challenge or a question is one press as a whole row (the card shown; core's words put in the message box);
 * a sharpen prompt keeps its words and one quiet action under them, labelled with core's method words.
 */
function Row({ e }: { e: Examine }) {
  const w = wordsOf(e)
  const ring = () => ringFrom(RING, e.kind === 'challenge' ? [e.card.id] : [])
  // `hover`: the words' longer text through the one Tip, on the words themselves (a focus stop); a challenge's whole row is a press that carries it instead.
  const wordsEl = (hover?: string) => (
    <Hover words={hover} className="min-w-0 flex-1">
      <span className={`${TYPE.body} block text-text-header`} {...at(e, w.at)} {...(e.kind === 'challenge' ? { 'data-testid': 'view-reasoning-challenge-question' } : {})}>{w.text}</span>
      {w.why === null ? null : <span className={`${TYPE.meta} block text-text-body`} data-view={w.whyAt!} {...(e.kind === 'challenge' ? { 'data-testid': 'view-reasoning-challenge-reason' } : {})}>{w.why}</span>}
    </Hover>
  )
  const words = wordsEl()
  const whole = `flex w-full items-start gap-2 rounded-sm px-1 py-2.5 text-left hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`
  const mark = <OkIcon id={MARK[e.kind]} size={14} className="mt-0.5" decorative />
  if (e.kind === 'challenge') return <li {...rowData(e)}><Hover as="button" type="button" className={whole} words={w.hover} onClick={() => pressCard(e.card.id)} onMouseEnter={ring} data-testid="reasoning-challenge-show">{mark}{words}</Hover></li>
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
      <span className="min-w-0 flex-1 space-y-1">{wordsEl(w.hover)}<span className="block"><Act e={e} /></span></span>
    </li>
  )
}

function Examined({ items, onReveal }: { items: Examine[]; onReveal: () => void }) {
  const [all, setAll] = useState(false)
  const listId = useId()
  const request = useReasoningFocus((s) => s.request)
  useLayoutEffect(() => {
    if (request === null || request.sid !== useViewStore.getState().sid || useReasoningFocus.getState().request !== request) return
    if (items.findIndex((item) => item.key === request.key) < LIST_AT_REST) return
    // Expanding this list mounts the row without rerendering ViewReasoning.
    if (all) onReveal()
    else setAll(true)
  }, [all, items, onReveal, request])
  if (items.length === 0) return null
  const shown = all ? items : items.slice(0, LIST_AT_REST)
  return (
    <section className="space-y-2" data-testid="reasoning-examine" aria-label={REASONING_LABELS.examine}>
      <h3 className={`${H} flex items-center gap-2`}>{REASONING_LABELS.examine}<span className={`${TYPE.meta} font-normal tabular-nums text-text-light`} data-count>{items.length}</span></h3>
      <ul id={listId} className="m-0 list-none divide-y divide-panel-border p-0">{shown.map((e) => <Row key={e.key} e={e} />)}</ul>
      {items.length <= LIST_AT_REST ? null : (
        <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} aria-controls={listId} className={MORE} data-testid="reasoning-examine-more">
          {all ? REASONING_LABELS.fewer : REASONING_LABELS.more(items.length - LIST_AT_REST)}
        </button>
      )}
    </section>
  )
}

/** Every premise core puts on a card, once, behind one door (closed at rest). */
function Premises({ model }: { model: ViewModel }) {
  const { premises, cards: reasoning } = premisesOnce(model)
  const notes = premises.length + reasoning.length
  if (notes === 0) return null
  return (
    <section data-testid="view-reasoning-challenge" aria-label={REASONING_LABELS.premises}>
      <Door label={REASONING_LABELS.premises} count={notes} testId="premises">
        {premises.map(({ card, p, j }) => (
          <SignalRow key={`${card.id}.${j}`} words={p.title} data-reasoning-premise={`${card.id}.${j}`} mark={<span data-view={`${card.id}.premises.${j}.glyph`}>{p.glyph}</span>}
            end={(p.olumi ?? null) === null ? null : <GlyphMark mark={p.olumi!} className="text-info" view={`${card.id}.premises.${j}.olumi.glyph`} />}>
            <span data-view={`${card.id}.premises.${j}.text`}>{p.text}</span>
          </SignalRow>
        ))}
        {reasoning.map((c) => (
          <SignalRow key={c.id} words={c.detail} data-reasoning-card={c.id} mark={<span data-view={`${c.id}.glyph`}>{c.glyph}</span>}
            end={c.olumi === null ? null : <GlyphMark mark={c.olumi} className="text-info" view={`${c.id}.olumi.glyph`} />}>
            <span data-view={`${c.id}.reason`}>{c.reason}</span>
          </SignalRow>
        ))}
      </Door>
    </section>
  )
}

/** The activity's one green action: a card shown, a method run, or core's words put in the message box (nothing sent). */
function LeadAct({ e }: { e: Examine }) {
  if (e.kind === 'challenge') return <button type="button" className={GREEN} onClick={() => pressCard(e.card.id)} data-testid="reasoning-challenge-show"><OkIcon id="show-in-workspace" size={14} decorative />{REASONING_LABELS.show}</button>
  if (e.kind === 'method' && e.method !== null) {
    const { at: i, m } = e.method
    return <button type="button" className={GREEN} onClick={() => runMethod(m.id)} data-testid="reasoning-method"><OkIcon id="method-mark" size={14} decorative /><span data-view-words={`session.methods.${i}.text`}>{m.text}</span></button>
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
  if (e === undefined) return null
  const w = wordsOf(e)
  return (
    <section key={e.key} className="space-y-3 rounded-md bg-panel-hover p-3" data-testid="reasoning-focus" data-focus-kind={e.kind} aria-label={REASONING_LABELS.activity} {...rowData(e)}
      onMouseEnter={() => ringFrom(RING, e.kind === 'challenge' ? [e.card.id] : [])} onMouseLeave={() => ringFrom(RING, [])}>
      <p className={`${TYPE.meta} m-0 flex items-center gap-1.5 text-text-light`}><OkIcon id={MARK[e.kind]} size={14} decorative />{REASONING_LABELS.activity}</p>
      <Hover as="p" words={w.hover ?? w.text} className={`${TYPE.headline} m-0 line-clamp-4 text-text-header`} {...at(e, w.at)}>{w.text}</Hover>
      {w.why === null ? null : <p className={`${TYPE.body} m-0 text-text-body`} data-view={w.whyAt!}>{w.why}</p>}
      <div className="flex flex-wrap items-center gap-2"><LeadAct e={e} /></div>
    </section>
  )
}

/** `stated`: the tab's state is said above it (`ViewReasoningBlock`'s StateStrip), so the what-if box here draws no label of its own. */
export function ViewReasoning({ model, stated = false }: { model: ViewModel; brief?: string | null; stated?: boolean }) {
  const run = model.run ?? null
  const methods = useViewStore((s) => s.view?.session?.methods ?? null)
  const words = useViewStore((s) => s.view?.model_words ?? null) as Record<string, unknown> | null
  const view = useViewStore((s) => s.view)
  const items = examineOf(model, methods, words, new Set((view?.collab.dissent ?? []).map((d) => d.id)))
  const panel = useRef<HTMLDivElement>(null)
  const request = useReasoningFocus((s) => s.request)
  function focusRequestedRow() {
    if (request === null || request.sid !== useViewStore.getState().sid || useReasoningFocus.getState().request !== request) return
    const item = items.find((e) => e.key === request.key)
    const match = request.key === 'commitment' ? ['data-testid', 'reasoning-commitment'] as const : item && Object.entries(rowData(item))[0]
    if (match === undefined) {
      useReasoningFocus.setState({ request: null })
      return
    }
    const [attribute, value] = match
    const rows = panel.current?.querySelectorAll<HTMLElement>(`[${attribute}]`)
    const target = Array.from(rows ?? []).find((row) => row.getAttribute(attribute) === value)
    if (!target) return
    useReasoningFocus.setState({ request: null })
    target.tabIndex = -1
    target.focus({ preventScroll: true })
    target.scrollIntoView?.({ block: 'nearest' })
  }
  useLayoutEffect(focusRequestedRow)
  return (
    <div ref={panel} className={`${TYPE.body} flex-1 min-h-0 olumi-scrollbar overflow-y-auto space-y-4 p-3`} data-testid="view-reasoning" onMouseLeave={() => ringFrom(RING, [])}>
      <WhatIfShown model={model} labelled={!stated} />
      <RestsOn model={model} run={run} />
      <Examined items={items} onReveal={focusRequestedRow} />
      <AnsweredList view={view} model={model} />
      {view === null ? null : <TowardsCommitment view={view} />}
      <Premises model={model} />
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
