import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { ViewModel, ViewRun } from './client'
import { FigureEdit } from './FigureEdit'
import { premisesOnce } from './layout'
import { shownModel, useViewStore } from './store'
import { WhatIfShown } from './ViewChances'
import { CheckList, CHECK_FILL, CHECK_SHOW } from './check/CheckList'
import { CHECK_WORDS } from './check/items'
import { Door, SignalRow } from './reasoning/parts'
import { TowardsCommitment } from './reasoning/TowardsCommitment'
import { useReasoningFocus } from './reasoning/focusRequest'
import { AnsweredList } from './reasoning/AnswerBox'
import { StateStrip, useTabState } from './reasoning/StateStrip'
import { ShareBar, ShareKeyMark } from './v12/scale/ShareBar'
import { GlyphMark } from './look/Hover'
import { TYPE } from './port/type'
import { typography } from '../styles/typography'

/** The tab's own labels, the only words not core's. */
export const REASONING_LABELS = {
  rests: 'What the uncertainty rests on',
  olumi: 'Olumi’s', yours: 'People’s', mixed: 'Both',
  more: (n: number) => `Show ${n} more`, fewer: 'Show fewer',
  examine: CHECK_WORDS.title,
  premises: 'Assumptions and evidence',
  fill: CHECK_FILL,
  show: CHECK_SHOW,
} as const
const H = `${typography.viewPanelHeading} m-0 text-text-header`
const MORE = `${TYPE.meta} min-h-6 px-1 text-text-light underline underline-offset-2 hover:text-text-header`
/** Figures drawn per group at rest (every group is drawn): core orders them by share, so the first is the one that carries most of that group's uncertainty. */
const REST_FIGURES = 1
/** At most this many rest groups at rest, in core's order (Paul's progressive-disclosure rule); the others sit behind the one existing "Show n more" press. */
export const RESTS_AT_REST = 3

type Rest = ViewRun['rests'][number]
/**
 * What the uncertainty rests on (core's `run.rests`): per option and aim, in core's order, each figure core names as a bar to its share of
 * the variation, Olumi's in Olumi's blue, a person's in ink; core's line beside it, and core's give ✎ at the figure's first appearance, so
 * the person can replace the guess that carries most of the uncertainty. Every group's first (largest) figure at rest; the further figures behind one press.
 */
export function RestsOn({ model, run, headed = true }: { model: ViewModel; run: ViewRun | null; headed?: boolean }) {
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
      {headed ? <h3 className={H} data-view={run.rests_heading ? 'run.rests_heading' : undefined}>{run.rests_heading || REASONING_LABELS.rests}</h3> : null}
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
          <span key={w} className="inline-flex items-center gap-1"><ShareKeyMark whose={w} />{w === 'olumi' ? REASONING_LABELS.olumi : w === 'theirs' ? REASONING_LABELS.yours : REASONING_LABELS.mixed}</span>
        ))}
      </p>
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

/** `stated`: the tab's state is said above it (`ViewReasoningBlock`'s StateStrip), so the what-if box here draws no label of its own. */
export function ViewReasoning({ model, stated = false }: { model: ViewModel; brief?: string | null; stated?: boolean }) {
  const run = model.run ?? null
  const view = useViewStore((s) => s.view)
  const sid = useViewStore((s) => s.sid)
  const rests = (run?.rests ?? []).filter((r) => r.line !== '').length
  const panel = useRef<HTMLDivElement>(null)
  const request = useReasoningFocus((s) => s.request)
  useLayoutEffect(() => {
    if (request === null || request.sid !== sid || request.key !== 'commitment' || useReasoningFocus.getState().request !== request) return
    const target = panel.current?.querySelector<HTMLElement>('[data-testid="reasoning-commitment"]')
    if (target === undefined || target === null) return
    useReasoningFocus.setState({ request: null })
    target.tabIndex = -1
    target.focus({ preventScroll: true })
    target.scrollIntoView?.({ block: 'nearest' })
  })
  return (
    <div ref={panel} className={`${TYPE.body} flex-1 min-h-0 olumi-scrollbar overflow-y-auto space-y-5 p-3`} data-testid="view-reasoning">
      <WhatIfShown model={model} labelled={!stated} />
      <CheckList model={model} view={view} sid={sid} />
      {rests === 0 ? null : <Door key={`${sid}:rests`} label={run?.rests_heading || REASONING_LABELS.rests} labelAt={run?.rests_heading ? 'run.rests_heading' : undefined} count={rests} testId="rests">
        <RestsOn model={model} run={run} headed={false} />
      </Door>}
      <AnsweredList key={`${sid}:answered`} view={view} model={model} />
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
