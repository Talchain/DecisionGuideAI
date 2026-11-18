/**
 * The Reasoning tab on the olumi-core lane: HOW SOUND THE THINKING IS (design, 18 Nov 2026,
 * ~/olumi-work/claude-checks/ui-lead-20261117/overnight/analysis/DESIGN.md). Analysis draws what the model implies; this tab draws what that
 * rests on and where it could be wrong, each as one visual or one ranked list with one press per row. Nothing here repeats Analysis, the
 * chat, the canvas or the Team tab. Top to bottom:
 *   0. above the tab, its state, said once (`reasoning/StateStrip.tsx`): a proposal held, or a what-if shown, with its way back;
 *   1. whose figures the result rests on (`run.rests`, only when core sends it): per option, one bar split into Olumi's share, the person's
 *      and what no one figure carries, core's line on hover; then each figure it rests on most, with core's give ✎;
 *   2. Challenge your thinking: each card core marks `challenged`, its heading and core's reason, a press to the card; under them the
 *      "Assumptions and evidence" door (every premise core puts on a card, once);
 *   3. Questions worth answering: core's `coaching_questions`, each a press that fills the message box (`prefillComposer`, nothing sent), then
 *      core's two asks that widen the model (`model_words.askOption` / `askRisk`, their drafts as the fill);
 *   4. Try a method: core's `sharpen` prompts, each with ONE press labelled by core's method words (`session.methods[move].text`, `runMethod`).
 * Deleted with this redesign: the model-at-a-glance strip (the canvas and Model tab draw it), the option rack and the outcome bars (Analysis
 * draws the chances), the people strip and commitment (the Team tab), "What would change your mind" and "Try a figure" (Analysis).
 * Every word about the person's model is core's, at its View path (`data-view`); the headings are this tab's own chrome.
 */
import type { ViewCard, ViewModel, ViewRun } from './client'
import { FigureEdit } from './FigureEdit'
import { challengedCards, premisesOnce } from './layout'
import { OkIcon } from './look/icons'
import { shownModel, useViewStore } from './store'
import { WhatIfShown } from './ViewChances'
import { prefillComposer, runMethod } from './ViewChat'
import { Door, SignalRow } from './reasoning/parts'
import { pressCard, ringFrom } from './reasoning/tabRing'
import { StateStrip, useTabState } from './reasoning/StateStrip'
import { trackPct } from './port/pick'
import { TYPE } from './port/type'
import { typography } from '../styles/typography'

/** The tab's own labels, the only words not core's. */
export const REASONING_LABELS = {
  rests: 'Whose figures it rests on',
  olumi: 'Olumi’s', yours: 'People’s', none: 'No one figure',
  challenge: 'Challenge your thinking',
  premises: 'Assumptions and evidence',
  questions: 'Questions worth answering',
  fill: 'Put this in the message box',
  methods: 'Try a method',
} as const
const RING = 'reasoning-tab'
const H = `${typography.viewPanelHeading} m-0 text-text-header`

type Rest = ViewRun['rests'][number]

/** One rest as a bar: Olumi's share in Olumi's blue, the person's in ink, the rest unfilled. Geometry in SVG attributes; core's line on hover. */
function RestBar({ rest }: { rest: Rest }) {
  const o = trackPct(rest.olumi_share), p = trackPct(rest.person_share)
  return (
    <svg className="block h-2 w-full" aria-hidden="true" data-testid="reasoning-rests-bar" data-rests-olumi={o} data-rests-person={p}>
      <rect x="0" y="0" width="100%" height="8" rx="2" className="fill-panel-border" />
      <rect x="0" y="0" width={`${o}%`} height="8" className="fill-info" />
      <rect x={`${o}%`} y="0" width={`${p}%`} height="8" className="fill-text-header" />
    </svg>
  )
}

function RestsOn({ model, run }: { model: ViewModel; run: ViewRun | null }) {
  const rests = (run?.rests ?? []).map((r, k) => ({ r, k })).filter(({ r }) => r.line !== '')
  if (run === null || rests.length === 0) return null
  // Each figure the result rests on, once, at the first rest that names it (core's order).
  const figures: { f: NonNullable<Rest['figures']>[number]; at: string }[] = []
  for (const { r, k } of rests) (r.figures ?? []).forEach((f, j) => { if (f.line !== '' && !figures.some((x) => x.f.id === f.id)) figures.push({ f, at: `run.rests.${k}.figures.${j}` }) })
  return (
    <section className="space-y-2" data-testid="reasoning-rests" aria-label={run.rests_heading || REASONING_LABELS.rests}>
      <h3 className={H} {...(run.rests_heading ? { 'data-view': 'run.rests_heading' } : {})}>{run.rests_heading || REASONING_LABELS.rests}</h3>
      <ul className="m-0 list-none space-y-1.5 p-0">
        {rests.map(({ r, k }) => {
          const option = model.cards.find((c) => c.id === r.option)
          return (
            <li key={r.id} title={r.hover} data-rest={r.id}>
              {option === undefined ? null : <span className={`${TYPE.meta} block text-text-body`} data-view={`${option.id}.heading`}>{option.heading}</span>}
              <span className="mt-0.5 block" role="img" aria-label={r.line} data-view-label={`run.rests.${k}.line`}><RestBar rest={r} /></span>
            </li>
          )
        })}
      </ul>
      <p className={`${TYPE.meta} m-0 flex flex-wrap items-center gap-3 text-text-light`} aria-hidden="true" data-testid="reasoning-rests-key">
        <span className="inline-flex items-center gap-1"><svg className="h-2 w-2"><rect width="8" height="8" className="fill-info" /></svg>{REASONING_LABELS.olumi}</span>
        <span className="inline-flex items-center gap-1"><svg className="h-2 w-2"><rect width="8" height="8" className="fill-text-header" /></svg>{REASONING_LABELS.yours}</span>
        <span className="inline-flex items-center gap-1"><svg className="h-2 w-2"><rect width="8" height="8" className="fill-panel-border" /></svg>{REASONING_LABELS.none}</span>
      </p>
      {figures.length === 0 ? null : (
        <ul className="m-0 list-none p-0" data-testid="reasoning-rests-figures">
          {figures.map(({ f, at }) => (
            <li key={f.id} className={`${TYPE.body} flex items-center gap-2`} data-rest-figure={f.id}>
              <span className="min-w-0 flex-1 text-text-body">
                {f.mark == null ? null : <><span className="text-info" title={f.mark.title} aria-label={f.mark.title} data-view={`${at}.mark.glyph`}>{f.mark.glyph}</span>{' '}</>}
                <span data-view={`${at}.line`}>{f.line}</span>
              </span>
              {f.give == null ? null : <FigureEdit id={f.id} edit={f.give.edit} place="reasoning-rests" glyph words={false} label={`Give your figure for ${f.label}`} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** A card core marks challenged: core's mark, its heading, core's reason under it; a press selects and centres the card. */
function Challenge({ card: c }: { card: ViewCard }) {
  return (
    <li data-reasoning-challenge={c.id}>
      <button type="button" onClick={() => pressCard(c.id)} onMouseEnter={() => ringFrom(RING, [c.id])} onMouseLeave={() => ringFrom(RING, [])} title={c.detail}
        className="flex w-full items-start gap-2 rounded-sm px-1 py-1 text-left hover:bg-panel-hover">
        <OkIcon id="challenged" size={14} className="mt-0.5" decorative />
        <span className="min-w-0 flex-1">
          <span className={`${TYPE.body} block text-text-header`} data-testid="view-reasoning-challenge-question" data-view={`${c.id}.heading`}>{c.heading}</span>
          {c.reason === null || c.reason === c.heading ? null : <span className={`${TYPE.meta} block text-text-body`} data-testid="view-reasoning-challenge-reason" data-view={`${c.id}.reason`}>{c.reason}</span>}
        </span>
        {c.olumi === null ? null : <span className={`${TYPE.meta} text-info`} title={c.olumi.title} aria-label={c.olumi.title} data-view={`${c.id}.olumi.glyph`}>{c.olumi.glyph}</span>}
      </button>
    </li>
  )
}

function Challenges({ model }: { model: ViewModel }) {
  const challenges = challengedCards(model)
  const { premises, cards: reasoning } = premisesOnce(model)
  const notes = premises.length + reasoning.length
  if (challenges.length + notes === 0) return null
  return (
    <section className="space-y-1" data-testid="view-reasoning-challenge" aria-label={REASONING_LABELS.challenge}>
      <h3 className={H}>{REASONING_LABELS.challenge}</h3>
      {challenges.length === 0 ? null : <ul className="m-0 list-none p-0">{challenges.map((c) => <Challenge key={c.id} card={c} />)}</ul>}
      {notes === 0 ? null : (
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
      )}
    </section>
  )
}

/** One press that fills the message box with core's words (nothing is sent). */
function FillRow({ text, at, fill, testId }: { text: string; at: string; fill: string; testId: string }) {
  return (
    <li>
      <button type="button" onClick={() => prefillComposer(fill)} title={REASONING_LABELS.fill} data-testid={testId}
        className={`${TYPE.body} flex min-h-7 w-full items-start gap-2 rounded-sm px-1 py-1 text-left text-text-body hover:bg-panel-hover`}>
        <OkIcon id="talk-first" size={14} inherit className="mt-0.5" decorative />
        <span className="min-w-0 flex-1" data-view-words={at}>{text}</span>
      </button>
    </li>
  )
}

function Questions({ model }: { model: ViewModel }) {
  const words = useViewStore((s) => s.view?.model_words ?? null) as Record<string, string | undefined> | null
  const qs = (model.coaching_questions ?? []).map((q, i) => ({ q, i })).filter(({ q }) => q !== '')
  // Core's two asks that push past the current model (its own label and the draft it gives for the box).
  const widen = (['askOption', 'askRisk'] as const).flatMap((k) => {
    const label = words?.[k], draft = words?.[`${k}Draft`]
    return typeof label === 'string' && label !== '' && typeof draft === 'string' && draft !== '' ? [{ k, label, draft }] : []
  })
  if (qs.length + widen.length === 0) return null
  return (
    <section className="space-y-1" data-testid="reasoning-questions" aria-label={REASONING_LABELS.questions}>
      <h3 className={H}>{REASONING_LABELS.questions}</h3>
      <ul className="m-0 list-none p-0">
        {qs.map(({ q, i }) => <FillRow key={`q${i}`} text={q} at={`coaching_questions.${i}`} fill={q} testId="reasoning-question" />)}
        {widen.map(({ k, label, draft }) => <FillRow key={k} text={label} at={`model_words.${k}`} fill={draft} testId={`reasoning-widen-${k}`} />)}
      </ul>
    </section>
  )
}

function Methods({ model }: { model: ViewModel }) {
  const methods = useViewStore((s) => s.view?.session?.methods ?? null)
  const rows = (model.sharpen ?? []).map((s, i) => ({ s, i, m: methods?.findIndex((x) => x.id === s.move) ?? -1 })).filter(({ s }) => s.lead !== '' || s.emphasis !== '')
  if (rows.length === 0) return null
  return (
    <section className="space-y-1" data-testid="reasoning-methods" aria-label={REASONING_LABELS.methods}>
      <h3 className={H}>{REASONING_LABELS.methods}</h3>
      <ul className="m-0 list-none space-y-2 p-0">
        {rows.map(({ s, i, m }) => (
          <li key={s.id} className="space-y-1 px-1" title={s.rationale || undefined} data-sharpen={s.id}>
            <p className={`${TYPE.body} m-0 text-text-body`}>
              {s.lead === '' ? null : <span data-view={`sharpen.${i}.lead`}>{s.lead}</span>}
              {s.lead !== '' && s.emphasis !== '' ? ' ' : null}
              {s.emphasis === '' ? null : <span className="text-text-light" data-view={`sharpen.${i}.emphasis`}>{s.emphasis}</span>}
            </p>
            {m < 0 || methods === null ? null : (
              <button type="button" onClick={() => runMethod(methods[m]!.id)} data-testid="reasoning-method"
                className={`${TYPE.meta} inline-flex min-h-7 items-center gap-1 rounded-sm border border-panel-border px-2 text-text-header hover:bg-panel-hover`}>
                <OkIcon id="method-mark" size={12} decorative />
                <span data-view-words={`session.methods.${m}.text`}>{methods[m]!.text}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** `stated`: the tab's state is said above it (`ViewReasoningBlock`'s StateStrip), so the what-if box here draws no label of its own. */
export function ViewReasoning({ model, stated = false }: { model: ViewModel; brief?: string | null; stated?: boolean }) {
  const run = model.run ?? null
  return (
    <div className={`${TYPE.body} flex-1 min-h-0 olumi-scrollbar overflow-y-auto space-y-5 px-3 py-3`} data-testid="view-reasoning" onMouseLeave={() => ringFrom(RING, [])}>
      <WhatIfShown model={model} labelled={!stated} />
      <RestsOn model={model} run={run} />
      <Challenges model={model} />
      <Questions model={model} />
      <Methods model={model} />
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
