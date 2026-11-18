import { useId, useState } from 'react'
import type { View } from '../../client'
import { focusNodeById } from '../../../canvas/utils/focusHelpers'
import { ringCards } from '../../ring'
import { OkIcon } from '../../look/icons'
import { TeamApiError } from '../../../olumiCore/team/api'
import { putDraft } from '../../../olumiCore/team/drafts'
import { readDifferences, stepDifference, differencesKey, useDifferences, type Difference, type Differences as DifferencesData } from '../../../olumiCore/team/differences'
import { runWrite } from '../../../olumiCore/team/writes'
import { openStep, revealed, STEP_WORDS } from '../../../olumiCore/team/flow'
import { AVATAR, BODY, ERR, FIELD, GO, LABEL, META, QUIET } from '../../../olumiCore/team/ui'
import { emptyConsequence, groupDifferences, NOTHING_CALCULATED, revealedForYou } from './differGroups'
import { useDifferLine, useRevealedDifferences } from './SimpleSummary'
import { AskButton, AskToCompare } from './AskToCompare'
import { answerMessage, ASK_SAID, ASK_WORDS, askOlumi, differenceQuestion, type AskOutcome } from './askOlumi'
import { useCompare } from './useCompare'
import { DissentPanel } from '../../../olumiCore/team/DissentPanel'
import { LinkStance } from '../../../olumiCore/team/LinkStance'
import { markCounts, RevealedViews, RevealMarks } from '../../../olumiCore/team/ViewsPanel'
import { Fold, FLOW_WORDS } from '../../../olumiCore/team/steps'
import { FrameLines } from './FrameLines'
import { frameIsEmpty, frameOf } from './frame'
import { ChanceBars, FigureSides, sideSpans } from './DiffChart'

/**
 * Where we differ, after an authorised reveal (overnight 18 Nov redesign; crux first after Paul's critique, 18 Nov ~23:50Z): core's
 * differences (`GET …/differences`), each one a card that LEADS with core's own sentence for it and what would tell the views apart, then
 * Ask Olumi (sent on the press, ./askOlumi.ts) and the two next steps, then the drawing as support (./DiffChart.tsx): who said what on one
 * axis and what each person's figure does to each option's chance. Drawn in the Team tab's "Where you differ"
 * step and, wide, in the main workspace (./CompareViewsStage.tsx): one component, one read (`useRevealedDifferences`), so the gate is the
 * same wherever it is drawn. Nothing before an authorised reveal; no side is marked right, nothing is averaged or ranked.
 */

/** The comparison's fixed chrome (UI words; every heading, status and step in the cards is core's). */
export const COMPARE_WORDS = {
  open: 'Compare side by side in the workspace',
  back: 'Back to the model',
  inCentre: 'Everyone’s views and where they differ are open in the main workspace.',
  control: 'Compare views',
  toCanvas: 'Show it on the canvas',
} as const

/** Commit to an action from a difference or the step's own press: the Team tab's commitment form opens, holding the draft, in view. */
export function startCommit(sid: string, view: View, before?: () => void): void {
  before?.()
  putDraft<Record<string, unknown>>(`${sid}:commitment`, (prev) => ({ action: '', expect: '', reconsider: '', keeps: [], option: '', reviewOn: '', ...(prev ?? {}), owner: (prev?.['owner'] as string | undefined) || view.you_id, open: true }))
  openStep('commit')
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector('[data-testid="team-commitment-form"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })))
}

export function Differences({ sid, view, onWrote, wide = false, onFocusCard }: { sid: string; view: View; onWrote: () => Promise<boolean>; wide?: boolean; onFocusCard?: () => void }): JSX.Element | null {
  const data = useRevealedDifferences(sid, view)
  const error = useDifferences((s) => (s.sid === sid ? s.error : null))
  const revealed = revealedForYou(view)
  const key = differencesKey(sid, view)
  if (!revealed) return null
  const shown = data !== null && !data.gated ? data : null
  const groups = shown === null ? [] : groupDifferences(shown)
  const rowsClass = wide ? 'grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]' : 'grid gap-5'
  return (
    <div className="grid gap-4" data-testid="differ-differences" data-differences-state={typeof shown?.state === 'string' ? shown.state : undefined}>
      {error && shown === null && <p role="alert" className={ERR} data-testid="differ-error">{error}</p>}
      {shown !== null && shown.differences.length === 0 && <p className={META} data-testid="differ-empty">{shown.empty}</p>}
      {shown !== null && groups.map((g) => (
        <div key={g.id} className="grid gap-2" data-testid={`differ-group-${g.id}`}>
          <p className={LABEL} data-testid={`differ-group-${g.id}-heading`}>{g.heading}</p>
          <div className={rowsClass}>
            {g.rows.map((d) => <DiffCard key={`${d.record}|${d.goal}`} sid={sid} view={view} data={shown} d={d} onFocusCard={onFocusCard}
              onWrote={async () => { await readDifferences(sid, key); return onWrote() }} />)}
          </div>
        </div>
      ))}
      {shown !== null && (() => { const g = emptyConsequence(shown); return g === null ? null : (
        <div className="grid gap-1" data-testid="differ-group-consequence">
          <p className={LABEL} data-testid="differ-group-consequence-heading">{g.heading}</p>
          <p className={META} data-testid="differ-group-consequence-empty">{NOTHING_CALCULATED}</p>
        </div>
      ) })()}
      {/* The coaching step (./AskToCompare): views in words can be compared in words, before or after a model is approved; it reads only the
          View's revealed views, so it stands whether or not core's read of figures has arrived. One wherever the differences are drawn. */}
      <AskToCompare view={view} at="differ" />
    </div>
  )
}

/** Each revealed member's whole view in words (core's `frame`), named. Nothing before a reveal. */
export function MemberFrames({ view }: { view: View }): JSX.Element | null {
  const framed = revealedForYou(view) ? view.collab.shared.filter((v) => !frameIsEmpty(frameOf(v))) : []
  if (framed.length === 0) return null
  return (
    <div className="grid gap-4" data-testid="differ-frames">
      {framed.map((v) => (
        <div key={v.id} className="grid gap-1" data-testid={`differ-frame-${v.id}`}>
          <p className={`${BODY} text-text-header`}>{v.by}</p>
          <FrameLines at={`differ-frame-${v.id}`} v={v} />
        </div>
      ))}
    </div>
  )
}

/** The two steps' fixed labels (Sprint-Resolve board). */
const STEP_LABELS = { dissent: 'Keep as a disagreement', research: 'Agree to find out' } as const

/** One difference: its name to the canvas, core's sentence and what would tell the views apart, Ask Olumi and the two steps, then drawn. */
export function DiffCard({ sid, view, data, d, onWrote, onFocusCard }: { sid: string; view: View; data: DifferencesData; d: Difference; onWrote: () => Promise<boolean>; onFocusCard?: () => void }): JSX.Element {
  const h = data.headings
  const at = `differ-row-${d.record}${d.goal ? `-${d.goal}` : ''}`
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = new Set(d.steps.filter((s) => s.by_id === view.you_id).map((s) => s.step))
  const cards = d.cards ?? [d.record]
  const drawn = sideSpans(view, d) !== null
  const step = async (s: 'dissent' | 'research') => {
    setBusy(true); setError(null)
    try { await runWrite(`${sid}:difference:${d.record}:${s}`, { op: true }, { record: d.record, step: s }, () => stepDifference(sid, d.record, s)); await onWrote() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }
  return (
    <article className="grid content-start gap-2.5" data-testid={at} data-difference-status={d.status}>
      <div className="grid gap-0.5">
        {cards.length > 0
          ? <button type="button" data-testid={`${at}-focus`} title={COMPARE_WORDS.toCanvas} onClick={() => { ringCards([]); onFocusCard?.(); focusNodeById(cards[0]!) }}
              onMouseEnter={() => ringCards(cards)} onMouseLeave={() => ringCards([])} onFocus={() => ringCards(cards)} onBlur={() => ringCards([])}
              className={`${BODY} inline-flex items-start gap-1.5 text-left font-medium text-text-header hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
              <span className="min-w-0 break-words">{d.label}{d.goal_label ? <span className="font-normal text-text-light"> · {d.goal_label}</span> : null}</span>
              <span className="mt-0.5 flex-none text-text-light"><OkIcon id="on-canvas" size={14} decorative /></span>
            </button>
          : <p className={`${BODY} font-medium text-text-header`}>{d.label}</p>}
      </div>
      {/* Crux first (Paul, 18 Nov): core's own sentence for this difference, at rest; then what would tell the views apart. */}
      <p className={`${BODY} break-words`} data-testid={`${at}-status`}>{d.status_text}</p>
      {d.settle.length > 0 && (
        <div className="grid gap-1" data-testid={`${at}-apart`}>
          <p className={LABEL}>{h.settle}</p>
          <ul className="m-0 grid list-disc gap-1 pl-4" data-testid={`${at}-settle`}>{d.settle.map((s, i) => <li key={i} className={`${BODY} break-words`} data-settle={s.kind}>{s.text}</li>)}</ul>
        </div>
      )}
      {/* Core's step route takes any difference this member can see now, calculated or not, so the two steps are offered on every card; a
          step records what the team will do about the difference and changes no model. Ask Olumi sends one question shaped by this difference. */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1" data-testid={`${at}-actions`}>
        <AskButton label={ASK_WORDS.difference} question={differenceQuestion(view, d)} at={`${at}-ask`} />
        <button type="button" className={`${QUIET} mt-1`} data-testid={`${at}-dissent`} disabled={busy || mine.has('dissent')} aria-pressed={mine.has('dissent')} onClick={() => void step('dissent')}>{STEP_LABELS.dissent}</button>
        <button type="button" className={`${QUIET} mt-1`} data-testid={`${at}-research`} disabled={busy || mine.has('research')} aria-pressed={mine.has('research')} onClick={() => void step('research')}>{STEP_LABELS.research}</button>
      </div>
      {d.steps.length > 0 && <ul className="m-0 grid list-none gap-1 p-0" data-testid={`${at}-steps`}>{d.steps.map((s) => <li key={s.id} className={`${META} break-words text-text-body`} data-step={s.step}>{s.text}</li>)}</ul>}
      {/* The drawing supports the sentence: who said what, and each option's chance with each person's figure. */}
      <div className="grid gap-2.5 border-t border-panel-border pt-2.5" data-testid={`${at}-drawn`}>
        {drawn ? <FigureSides view={view} d={d} at={at} /> : (
          <ul className="m-0 grid list-none gap-1 p-0" data-testid={`${at}-sides`}>
            {d.sides.map((s) => (
              <li key={s.holder_id} className={`${BODY} flex items-start gap-1.5 break-words`} data-difference-side={s.holder_id} title={s.title}>
                <span aria-hidden="true" className={AVATAR}>{s.holder.slice(0, 1).toUpperCase()}</span>
                <span><span className="text-text-header">{s.holder}</span>: {s.figure ? s.figure : s.text}</span>
              </li>
            ))}
          </ul>
        )}
        <ChanceBars d={d} heading={h.options} modelHeading={h.model} at={at} />
      </div>
      {error && <p role="alert" className={ERR} data-testid={`${at}-error`}>{error}</p>}
    </article>
  )
}

/**
 * Step 4, after an authorised reveal: Olumi's one question for the round (core's `collab.next`) with the person's answer sent to Olumi,
 * the count line, each of core's differences crux first, Ask Olumi to compare (sent), then the detail folded: everyone's views in words
 * (open and first where nothing is plotted), the canvas marks, the disagreements kept; and, quietly, commit to an action.
 */
export function WhereWeDiffer({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element {
  const c = view.collab
  const line = useDifferLine(sid, view)
  const centred = useCompare((s) => s.open)
  const data = useRevealedDifferences(sid, view)
  // The disagreements the approved model records are the model's, not anyone's private view: drawn before a reveal, and to a member core holds.
  const dissent = c.dissent.length > 0 ? <Fold at="differ-dissent" summary={FLOW_WORDS.dissent(c.dissent.length)}><DissentPanel sid={sid} view={view} onWrote={onWrote} /></Fold> : null
  if (view.gated) return <div className="grid gap-3"><RevealedViews view={view} />{dissent}</div>
  if (!revealed(view)) return <div className="grid gap-3"><p className={META} data-testid="differ-later">{STEP_WORDS.differLaterBody}</p>{dissent}</div>
  const marks = markCounts(view)
  const shared = c.shared.length
  // Views in words are the comparison wherever core draws nothing to plot (before approval, or no figures): their positions lead, open,
  // in their own words (Codex 008 #2). Where core's read plots figures or chances, the differences lead and the words fold below.
  const plotted = data !== null && !data.gated && data.differences.some((d) => sideSpans(view, d) !== null || d.options.some((o) => o.chances.some((x) => x.chance !== null)))
  const words = <><RevealedViews view={view} /><MemberFrames view={view} /></>
  return (
    <section data-testid="differ-after" aria-label={c.heading} className="grid gap-4">
      {c.next == null ? null : <NextQuestion question={c.next.text} />}
      {line !== null && <p className={`${BODY} font-medium text-text-header`} data-testid="differ-summary">{line}</p>}
      {!plotted && !centred && <div className="grid gap-3" data-testid="differ-views-open">{words}</div>}
      {/* Doubt or keep one link in your own words (core POST …/links/stance) sits above the differences (the UI gate, 8 Nov). */}
      <LinkStance sid={sid} view={view} onWrote={onWrote} />
      {centred ? (
        <div className="grid justify-items-start gap-2" data-testid="differ-in-centre">
          <p className={META}>{COMPARE_WORDS.inCentre}</p>
          <button type="button" className={QUIET} data-testid="differ-back-to-model" onClick={() => useCompare.getState().hide()}>{COMPARE_WORDS.back}</button>
        </div>
      ) : (
        <>
          <Differences sid={sid} view={view} onWrote={onWrote} />
          <div><button type="button" className={QUIET} data-testid="differ-open-centre" onClick={() => useCompare.getState().show()}><OkIcon id="compare-views" size={14} decorative />{COMPARE_WORDS.open}</button></div>
        </>
      )}
      <div className="grid gap-2">
        {plotted && !centred && <Fold at="differ-views" summary={FLOW_WORDS.views(shared)}>{words}</Fold>}
        {/* Core's `shared` marks mean several of you spoke to a card, never that you agree (core reveal.ts): counted as marks, not "common ground". */}
        {marks.all > 0 && <Fold at="differ-marks" summary={FLOW_WORDS.marked(marks.all)}><RevealMarks view={view} /></Fold>}
        {dissent}
      </div>
      {/* An action is one optional activity among exploring, evidence and dissent (Codex 008 #3): offered, never the lead. */}
      <div><button type="button" className={QUIET} data-testid="differ-commit" onClick={() => startCommit(sid, view)}><OkIcon id="commit-action" size={14} decorative />{STEP_WORDS.commitGo}</button></div>
    </section>
  )
}

/** Olumi's one question for the round (core's `collab.next`): the person answers in their own words and the answer is sent to Olumi with the
 *  question it answers (./askOlumi.ts). Nothing is sent until they press Send; an empty answer sends nothing. */
function NextQuestion({ question }: { question: string }): JSX.Element {
  const [open, setOpen] = useState(false)
  const [words, setWords] = useState('')
  const [said, setSaid] = useState<AskOutcome | null>(null)
  const id = useId()
  const send = () => { if (words.trim() === '') return; const out = askOlumi(answerMessage(question, words)); setSaid(out); if (out !== 'placed') { setWords(''); setOpen(false) } }
  return (
    <div className="grid gap-1.5" data-testid="team-views-next-block">
      {/* `team-views-next` is the question alone (its words are core's), as before: other specs read its text. */}
      <p className={`${BODY} flex items-start gap-1.5`} data-testid="team-views-next">
        <span className="mt-0.5 flex-none"><OkIcon id="olumi-mark" size={14} decorative /></span><span className="min-w-0 break-words">{question}</span>
      </p>
      {!open ? (
        <div className="pl-5"><button type="button" className={QUIET} data-testid="team-views-next-answer" onClick={() => { setOpen(true); setSaid(null) }}>{ASK_WORDS.answer}</button></div>
      ) : (
        <div className="grid gap-1.5 pl-5">
          <label htmlFor={id} className="sr-only">{ASK_WORDS.answerLabel}</label>
          <textarea id={id} rows={3} className={FIELD} value={words} data-testid="team-views-next-words" onChange={(e) => setWords(e.target.value)} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={GO} data-testid="team-views-next-send" disabled={words.trim() === ''} onClick={send}><OkIcon id="olumi-mark" size={14} decorative />{ASK_WORDS.send}</button>
            <button type="button" className={QUIET} data-testid="team-views-next-cancel" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      <p role="status" className={`${META} pl-5`} data-testid="team-views-next-said">{said === null ? '' : ASK_SAID[said]}</p>
    </div>
  )
}
