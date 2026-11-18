/**
 * The Reasoning tab on the olumi-core lane: HOW SOUND THE THINKING IS (redesign 2, 18 Nov 2026, after Paul compared it with the Reasoning
 * prototypes: one place to start, a visual of where the uncertainty comes from, presses that change the model). Analysis draws what the
 * model implies; this tab draws what that rests on and what is worth examining. Top to bottom:
 *   0. above the tab, its state, said once (`reasoning/StateStrip.tsx`);
 *   1. Start here: the first actionable item of the queue (`reasoning/examine.ts`), core's words in the panel's one headline size, core's
 *      reason under it, ONE green action (show the challenged card, run core's method, or put core's words in the message box);
 *   2. What the uncertainty rests on (`run.rests`): per option and aim, each figure as a bar to its share of the variation, coloured by whose
 *      figure it is, core's line beside it and core's give ✎, so the guess that carries the most uncertainty can be replaced in place;
 *   3. Also worth examining: the rest of the queue, each row core's words with one quiet action;
 *   4. Towards commitment (`reasoning/TowardsCommitment.tsx`): disagreements still open, what the team has recorded it will do, and one
 *      press into the ONE commitment form (the chat's and Team tab's shared draft);
 *   5. Assumptions and evidence: every premise core puts on a card, once, behind one door.
 * Every word about the person's model is core's, at its View path (`data-view`); the headings and action labels are this tab's own chrome.
 */
import { useState } from 'react'
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
import { pressCard, ringFrom } from './reasoning/tabRing'
import { StateStrip, useTabState } from './reasoning/StateStrip'
import { trackPct } from './port/pick'
import { TYPE } from './port/type'
import { typography } from '../styles/typography'

/** The tab's own labels, the only words not core's. */
export const REASONING_LABELS = {
  start: 'Start here',
  rests: 'What the uncertainty rests on',
  olumi: 'Olumi’s', yours: 'People’s', mixed: 'Both',
  more: (n: number) => `Show ${n} more`, fewer: 'Show fewer',
  examine: 'Also worth examining',
  challenge: 'Challenge your thinking',
  premises: 'Assumptions and evidence',
  questions: 'Questions worth answering',
  fill: 'Put this in the message box',
  show: 'Show in the workspace',
} as const
const RING = 'reasoning-tab'
const H = `${typography.viewPanelHeading} m-0 text-text-header`
const GREEN = `${typography.viewPanelHeading} inline-flex min-h-8 items-center gap-1.5 rounded-full border border-success bg-success px-3 text-text-header hover:border-success-hover hover:bg-success-hover active:bg-success-active focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`
const QUIET = `${TYPE.meta} inline-flex min-h-7 items-center gap-1 rounded-sm border border-panel-border px-2 text-text-header hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`
const MORE = `${TYPE.meta} min-h-6 px-1 text-text-light underline underline-offset-2 hover:text-text-header`
const REST_GROUPS = 2
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
 * the person can replace the guess that carries most of the uncertainty. Two groups at rest; the rest behind one press.
 */
function RestsOn({ model, run }: { model: ViewModel; run: ViewRun | null }) {
  const [all, setAll] = useState(false)
  const rests = (run?.rests ?? []).map((r, k) => ({ r, k })).filter(({ r }) => r.line !== '' && (r.figures ?? []).some((f) => f.line !== ''))
  if (run === null || rests.length === 0) return null
  const given = new Set<string>()
  const shown = all ? rests : rests.slice(0, REST_GROUPS)
  const whose = new Set(rests.flatMap(({ r }) => (r.figures ?? []).map((f) => f.whose)))
  return (
    <section className="space-y-2" data-testid="reasoning-rests" aria-label={run.rests_heading || REASONING_LABELS.rests}>
      <h3 className={H} {...(run.rests_heading ? { 'data-view': 'run.rests_heading' } : {})}>{run.rests_heading || REASONING_LABELS.rests}</h3>
      {shown.map(({ r, k }) => {
        const option = model.cards.find((c) => c.id === r.option), aim = model.cards.find((c) => c.id === r.aim)
        return (
          <div key={r.id} className="space-y-1" title={r.hover} data-rest={r.id}>
            <p className={`${TYPE.meta} m-0 text-text-light`} aria-label={r.line} data-view-label={`run.rests.${k}.line`}>
              {option === undefined ? null : <span data-view={`${option.id}.heading`}>{option.heading}</span>}
              {option !== undefined && aim !== undefined ? ' · ' : null}
              {aim === undefined ? null : <span data-view={`${aim.id}.heading`}>{aim.heading}</span>}
            </p>
            <ul className="m-0 list-none space-y-1 p-0">
              {(r.figures ?? []).map((f, j) => ({ f, j })).filter(({ f }) => f.line !== '').map(({ f, j }) => {
                const give = f.give !== null && !given.has(f.id)
                if (give) given.add(f.id)
                return (
                  <li key={f.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2" data-rest-figure={f.id}>
                    <ShareBar f={f} />
                    <span className={`${TYPE.meta} min-w-0 text-text-body`}>
                      {f.mark == null ? null : <><span className="text-info" title={f.mark.title} aria-label={f.mark.title} data-view={`run.rests.${k}.figures.${j}.mark.glyph`}>{f.mark.glyph}</span>{' '}</>}
                      <span data-view={`run.rests.${k}.figures.${j}.line`}>{f.line}</span>
                    </span>
                    {give ? <FigureEdit id={f.id} edit={f.give!.edit} place="reasoning-rests" glyph words={false} label={`Give your figure for ${f.label}`} /> : <span />}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      {rests.length <= REST_GROUPS ? null : (
        <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className={MORE} data-testid="reasoning-rests-more">
          {all ? REASONING_LABELS.fewer : REASONING_LABELS.more(rests.length - REST_GROUPS)}
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
    case 'question': return { text: e.q, at: `coaching_questions.${e.i}`, why: null, whyAt: null }
    case 'widen': return { text: e.w.label, at: `model_words.${e.w.k}`, why: null, whyAt: null }
  }
}

/** The item's one action: a card shown, a method run, or core's words put in the message box (nothing sent). */
function Act({ e, lead }: { e: Examine; lead: boolean }) {
  const cls = lead ? GREEN : QUIET, size = lead ? 14 : 12
  if (e.kind === 'challenge') return <button type="button" className={cls} onClick={() => pressCard(e.card.id)} data-testid="reasoning-challenge-show"><OkIcon id="show-in-workspace" size={size} decorative />{REASONING_LABELS.show}</button>
  if (e.kind === 'method' && e.method !== null) {
    const { at, m } = e.method
    return <button type="button" className={cls} onClick={() => runMethod(m.id)} data-testid="reasoning-method"><OkIcon id="method-mark" size={size} decorative /><span data-view-words={`session.methods.${at}.text`}>{m.text}</span></button>
  }
  const fill = e.kind === 'question' ? { text: e.q, testId: 'reasoning-question' } : e.kind === 'widen' ? { text: e.w.draft, testId: `reasoning-widen-${e.w.k}` } : null
  if (fill === null) return null
  return <button type="button" className={cls} onClick={() => prefillComposer(fill.text)} title={REASONING_LABELS.fill} data-testid={fill.testId}><OkIcon id="talk-first" size={size} decorative />{REASONING_LABELS.fill}</button>
}

const MARK: Record<Examine['kind'], IconId> = { challenge: 'challenged', method: 'method-mark', question: 'talk-first', widen: 'talk-first' }
/** Where an item's words sit: on the model (`data-view`), or in core's chrome words (`data-view-words`: the coaching questions and model words). */
const at = (e: Examine, path: string) => e.kind === 'question' || e.kind === 'widen' ? { 'data-view-words': path } : { 'data-view': path }
const rowData = (e: Examine) => e.kind === 'challenge' ? { 'data-reasoning-challenge': e.card.id } : e.kind === 'method' ? { 'data-sharpen': e.s.id } : { 'data-examine': e.key }

/** The first actionable item, said large with its reason and one green action: the tab's one place to start. */
function Focus({ e }: { e: Examine }) {
  const w = wordsOf(e)
  return (
    <section className="space-y-2 rounded-md bg-panel-hover px-3 py-3" data-testid="reasoning-focus" data-focus-kind={e.kind} aria-label={REASONING_LABELS.start} {...rowData(e)}
      onMouseEnter={() => ringFrom(RING, e.kind === 'challenge' ? [e.card.id] : [])}>
      <p className={`${TYPE.meta} m-0 flex items-center gap-1.5 text-text-light`}><OkIcon id={MARK[e.kind]} size={12} decorative />{REASONING_LABELS.start}</p>
      <p className={`${TYPE.headline} m-0 line-clamp-4 text-text-header`} title={w.hover ?? w.text} {...at(e, w.at)}
        {...(e.kind === 'challenge' ? { 'data-testid': 'view-reasoning-challenge-question' } : {})}>{w.text}</p>
      {w.why === null ? null : <p className={`${TYPE.body} m-0 text-text-body`} data-view={w.whyAt!} {...(e.kind === 'challenge' ? { 'data-testid': 'view-reasoning-challenge-reason' } : {})}>{w.why}</p>}
      <div className="flex flex-wrap items-center gap-2 pt-1"><Act e={e} lead /></div>
    </section>
  )
}

/**
 * Every other item, compact. A challenge or a question is one press as a whole row (the card shown; core's words put in the message box);
 * a sharpen prompt keeps its words and one quiet action under them, labelled with core's method words.
 */
function Row({ e }: { e: Examine }) {
  const w = wordsOf(e)
  const ring = () => ringFrom(RING, e.kind === 'challenge' ? [e.card.id] : [])
  const words = (
    <span className="min-w-0 flex-1">
      <span className={`${TYPE.body} block text-text-header`} {...at(e, w.at)} {...(e.kind === 'challenge' ? { 'data-testid': 'view-reasoning-challenge-question' } : {})}>{w.text}</span>
      {w.why === null ? null : <span className={`${TYPE.meta} block text-text-body`} data-view={w.whyAt!} {...(e.kind === 'challenge' ? { 'data-testid': 'view-reasoning-challenge-reason' } : {})}>{w.why}</span>}
    </span>
  )
  const whole = `flex min-h-7 w-full items-start gap-2 rounded-sm px-1 py-1.5 text-left hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`
  const mark = <OkIcon id={MARK[e.kind]} size={14} className="mt-0.5" decorative />
  if (e.kind === 'challenge') return <li {...rowData(e)}><button type="button" className={whole} title={w.hover} onClick={() => pressCard(e.card.id)} onMouseEnter={ring} data-testid="reasoning-challenge-show">{mark}{words}</button></li>
  if (e.kind === 'question') return <li {...rowData(e)}><button type="button" className={whole} title={REASONING_LABELS.fill} onClick={() => prefillComposer(e.q)} data-testid="reasoning-question">{mark}{words}</button></li>
  if (e.kind === 'widen') return <li {...rowData(e)}><button type="button" className={whole} title={REASONING_LABELS.fill} onClick={() => prefillComposer(e.w.draft)} data-testid={`reasoning-widen-${e.w.k}`}>{mark}{words}</button></li>
  return (
    <li className="flex items-start gap-2 px-1 py-1.5" title={w.hover} {...rowData(e)}>
      {mark}
      <span className="min-w-0 flex-1 space-y-1">{words}<span className="block"><Act e={e} lead={false} /></span></span>
    </li>
  )
}

function Examined({ items }: { items: Examine[] }) {
  const [all, setAll] = useState(false)
  if (items.length === 0) return null
  const shown = all ? items : items.slice(0, LIST_AT_REST)
  return (
    <section className="space-y-1" data-testid="reasoning-examine" aria-label={REASONING_LABELS.examine}>
      <h3 className={`${H} flex items-center gap-2`}>{REASONING_LABELS.examine}<span className={`${TYPE.meta} font-normal tabular-nums text-text-light`} data-count>{items.length}</span></h3>
      <ul className="m-0 list-none divide-y divide-panel-border p-0">{shown.map((e) => <Row key={e.key} e={e} />)}</ul>
      {items.length <= LIST_AT_REST ? null : (
        <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className={MORE} data-testid="reasoning-examine-more">
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
          <SignalRow key={`${card.id}.${j}`} title={p.title} data-reasoning-premise={`${card.id}.${j}`} mark={<span data-view={`${card.id}.premises.${j}.glyph`}>{p.glyph}</span>}>
            <span data-view={`${card.id}.premises.${j}.text`}>{p.text}</span>{(p.olumi ?? null) === null ? null : <>{' '}<span className="text-info" title={p.olumi!.title} aria-label={p.olumi!.title} data-view={`${card.id}.premises.${j}.olumi.glyph`}>{p.olumi!.glyph}</span></>}
          </SignalRow>
        ))}
        {reasoning.map((c) => (
          <SignalRow key={c.id} title={c.detail} data-reasoning-card={c.id} mark={<span data-view={`${c.id}.glyph`}>{c.glyph}</span>}
            end={c.olumi === null ? null : <span className="text-info" title={c.olumi.title} aria-label={c.olumi.title} data-view={`${c.id}.olumi.glyph`}>{c.olumi.glyph}</span>}>
            <span data-view={`${c.id}.reason`}>{c.reason}</span>
          </SignalRow>
        ))}
      </Door>
    </section>
  )
}

/** `stated`: the tab's state is said above it (`ViewReasoningBlock`'s StateStrip), so the what-if box here draws no label of its own. */
export function ViewReasoning({ model, stated = false }: { model: ViewModel; brief?: string | null; stated?: boolean }) {
  const run = model.run ?? null
  const methods = useViewStore((s) => s.view?.session?.methods ?? null)
  const words = useViewStore((s) => s.view?.model_words ?? null) as Record<string, unknown> | null
  const view = useViewStore((s) => s.view)
  const items = examineOf(model, methods, words)
  const lead = items.find(actionable)
  return (
    <div className={`${TYPE.body} flex-1 min-h-0 olumi-scrollbar overflow-y-auto space-y-5 px-3 py-3`} data-testid="view-reasoning" onMouseLeave={() => ringFrom(RING, [])}>
      <WhatIfShown model={model} labelled={!stated} />
      {lead === undefined ? null : <Focus e={lead} />}
      <RestsOn model={model} run={run} />
      <Examined items={items.filter((e) => e !== lead)} />
      {view === null ? null : <TowardsCommitment view={view} model={model} />}
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
  return model === null ? null : <><div className="px-3 pt-3 empty:hidden"><StateStrip state={state} /></div><ViewReasoning model={model} stated={state === 'whatif'} /></>
}
