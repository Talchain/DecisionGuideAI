import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { View } from '../../client'
import { focusNodeById } from '../../../canvas/utils/focusHelpers'
import { TeamApiError } from '../../../olumiCore/team/api'
import { putDraft } from '../../../olumiCore/team/drafts'
import { readDifferences, stepDifference, differencesKey, useDifferences, type Difference, type Differences as DifferencesData } from '../../../olumiCore/team/differences'
import { runWrite } from '../../../olumiCore/team/writes'
import { NudgesPanel } from '../../../olumiCore/team/NudgesPanel'
import { ViewsPanel } from '../../../olumiCore/team/ViewsPanel'
import { DissentPanel } from '../../../olumiCore/team/DissentPanel'
import { AVATAR, BODY, CARD, ERR, H, LABEL, META } from '../../../olumiCore/team/ui'
import { emptyConsequence, groupDifferences, NOTHING_CALCULATED, revealedForYou } from './differGroups'
import { SimpleSummary, useRevealedDifferences } from './SimpleSummary'
import { FrameEntry, MyFrames } from './FrameEntry'
import { FrameLines } from './FrameLines'
import { frameIsEmpty, frameOf } from './frame'
import { useCompare } from './useCompare'
import { AskToCompare } from './AskToCompare'

/**
 * V12 "Where we differ", a section of the AI panel (proposal: "The centre: member views").
 *
 * Before an authorised reveal it shows only the member's own private-view entry (the Team tab's ViewsPanel) and the reveal state as core
 * reports it (`collab.waiting`, `collab.can_reveal`: "together" once everyone has contributed; an early share from the member's own view).
 * It asks core for no differences, draws no count and no summary, so nothing about anyone else's view can leak.
 *
 * "My whole view, in words" (./FrameEntry.tsx) sits beside that entry; after a reveal each person's words are listed as core gives them.
 *
 * After it: core's differences in three groups (./differGroups.ts), in core's words, each with core's own next steps: keep it as a
 * disagreement, agree to find out (POST …/differences/:record/steps, one shared row, no AI call) or commit (opens the Commitments form).
 * No side is marked right, nothing is averaged or ranked.
 */
export function WhereWeDiffer({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element {
  const revealed = revealedForYou(view)
  // V12 (Codex 16:52Z, proposal 005 "The centre: member views"): after a reveal the comparison can stand in the main workspace. While it does,
  // the dock says so and offers the way back, so the same rows and frames are never drawn twice (one set of actions, one set of test ids).
  const centred = useCompare((s) => s.open)
  return (
    <section data-testid={revealed ? 'differ-after' : 'differ-before'} aria-label={view.collab.heading} className="grid gap-4">
      <NudgesPanel sid={sid} view={view} onWrote={onWrote} />
      <ViewsPanel sid={sid} view={view} onWrote={onWrote} />
      {/* Collapsed to its own button: opened by default it drew a second "Your view, private until revealed" form under the team panel's
          (Paul's 15:00Z test). The team panel's form takes the view; this one adds its question, aim, options and links when asked for. */}
      <FrameEntry sid={sid} view={view} onWrote={onWrote} />
      <MyFrames view={view} />
      {revealed && centred && (
        <div className="grid gap-2" data-testid="differ-in-centre">
          <p className={META}>{COMPARE_WORDS.inCentre}</p>
          <div><Button size="sm" variant="secondary" data-testid="differ-back-to-model" onClick={() => useCompare.getState().hide()}>{COMPARE_WORDS.back}</Button></div>
        </div>
      )}
      {revealed && !centred && (
        <>
          <div><button type="button" data-testid="differ-open-centre" onClick={() => useCompare.getState().show()}
            className={`${META} inline-flex min-h-[24px] items-center gap-1 hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}>{COMPARE_WORDS.open}<ArrowRight aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5 flex-none" /></button></div>
          <Differences sid={sid} view={view} onWrote={onWrote} />
          <MemberFrames view={view} />
        </>
      )}
      <DissentPanel sid={sid} view={view} onWrote={onWrote} />
    </section>
  )
}

/** The comparison's fixed chrome (UI words; every heading, status and step in the rows is core's). */
export const COMPARE_WORDS = {
  open: 'Compare views in the workspace',
  back: 'Back to the model',
  inCentre: 'Everyone’s views and where they differ are open in the main workspace.',
  control: 'Compare views',
} as const

/**
 * Core's differences after a reveal, in its three groups, each row with core's own next steps (./Row). Drawn in the Team dock and, side by side
 * with each member's view, in the main workspace (./CompareViewsStage.tsx): one component, one read (`useRevealedDifferences`), so the gate is the
 * same wherever it is drawn. Nothing before an authorised reveal.
 */
export function Differences({ sid, view, onWrote, wide = false, onFocusCard, onCommit }: { sid: string; view: View; onWrote: () => Promise<boolean>; wide?: boolean; onFocusCard?: () => void; onCommit?: () => void }): JSX.Element | null {
  const data = useRevealedDifferences(sid, view)
  const error = useDifferences((s) => (s.sid === sid ? s.error : null))
  const revealed = revealedForYou(view)
  const key = differencesKey(sid, view)
  if (!revealed) return null
  const shown = data !== null && !data.gated ? data : null
  const groups = shown === null ? [] : groupDifferences(shown)
  const rowsClass = wide ? 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]' : 'grid gap-4'
  return (
    <div className="grid gap-4" data-testid="differ-differences" data-differences-state={typeof shown?.state === 'string' ? shown.state : undefined}>
      <h3 className={H} data-testid="differ-heading">{shown?.heading ?? view.collab.heading}</h3>
      {error && shown === null && <p role="alert" className={ERR} data-testid="differ-error">{error}</p>}
      {shown !== null && <SimpleSummary sid={sid} view={view} />}
      {shown !== null && shown.differences.length === 0 && <p className={META} data-testid="differ-empty">{shown.empty}</p>}
      {/* Views in words can be compared in words, before or after a model is approved: an editable request for the person's own message box
          (./AskToCompare). It reads only the View's revealed views, so it stands whether or not core's read of figures has arrived. */}
      <AskToCompare view={view} at="differ" />
      {shown !== null && groups.map((g) => (
        <div key={g.id} className="grid gap-2" data-testid={`differ-group-${g.id}`}>
          <p className={LABEL} data-testid={`differ-group-${g.id}-heading`}>{g.heading}</p>
          <div className={rowsClass}>
            {g.rows.map((d) => <Row key={`${d.record}|${d.goal}`} sid={sid} view={view} data={shown} d={d} onFocusCard={onFocusCard} onCommit={onCommit}
              onWrote={async () => { await readDifferences(sid, key); return onWrote() }} />)}
          </div>
        </div>
      ))}
      {shown !== null && (() => { const g = emptyConsequence(shown); return g === null ? null : (
        <div className="grid gap-2" data-testid="differ-group-consequence">
          <p className={LABEL} data-testid="differ-group-consequence-heading">{g.heading}</p>
          <p className={META} data-testid="differ-group-consequence-empty">{NOTHING_CALCULATED}</p>
        </div>
      ) })()}
    </div>
  )
}

/** Each revealed member's whole view in words (core's `frame`), named. In the dock as a list; nothing before a reveal. */
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
const STEP_WORDS = { dissent: 'Keep as a disagreement', research: 'Agree to find out' } as const

/** One difference with core's own next steps. `onFocusCard`/`onCommit` run first where the row stands over the canvas (the main workspace), so
 *  "Show it on the canvas" returns to the model before it focuses the card, and Commit brings the Team tab's form into view. */
export function Row({ sid, view, data, d, onWrote, onFocusCard, onCommit }: { sid: string; view: View; data: DifferencesData; d: Difference; onWrote: () => Promise<boolean>; onFocusCard?: () => void; onCommit?: () => void }): JSX.Element {
  const h = data.headings
  const at = `differ-row-${d.record}${d.goal ? `-${d.goal}` : ''}`
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = new Set(d.steps.filter((s) => s.by_id === view.you_id).map((s) => s.step))
  const cards = d.cards ?? [d.record]
  const step = async (s: 'dissent' | 'research') => {
    setBusy(true); setError(null)
    try { await runWrite(`${sid}:difference:${d.record}:${s}`, { op: true }, { record: d.record, step: s }, () => stepDifference(sid, d.record, s)); await onWrote() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }
  const commit = () => {
    onCommit?.()
    putDraft<Record<string, unknown>>(`${sid}:commitment`, (prev) => ({ action: '', expect: '', reconsider: '', keeps: [], option: '', reviewOn: '', ...(prev ?? {}), owner: (prev?.['owner'] as string | undefined) || view.you_id, open: true }))
    requestAnimationFrame(() => document.querySelector('[data-testid="team-commitment-form"], [data-testid="team-commitments"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }
  const holder = (id: string) => d.sides.find((s) => s.holder_id === id)?.holder ?? ''
  return (
    <article className={CARD} data-testid={at} data-difference-status={d.status}>
      {cards.length > 0
        ? <button type="button" data-testid={`${at}-focus`} title="Show it on the canvas" onClick={() => { onFocusCard?.(); focusNodeById(cards[0]!) }} className={`${BODY} text-left text-text-header`}>
            {d.label}{d.goal_label ? <span className="text-text-light"> · {d.goal_label}</span> : null}</button>
        : <p className={`${BODY} text-text-header`}>{d.label}</p>}
      <ul className="m-0 grid list-none gap-1 p-0" data-testid={`${at}-sides`}>
        {d.sides.map((s) => (
          <li key={s.holder_id} className={`${BODY} flex items-start gap-1.5 break-words`} data-difference-side={s.holder_id} title={s.title}>
            <span aria-hidden="true" className={AVATAR}>{s.holder.slice(0, 1).toUpperCase()}</span>
            <span><span className="text-text-header">{s.holder}</span>: {s.figure ? s.figure : s.text}</span>
          </li>
        ))}
      </ul>
      <p className={`${BODY} break-words ${d.status === 'changes' ? 'font-medium text-text-header' : ''}`} data-testid={`${at}-status`}>{d.status_text}</p>
      {d.options.length > 0 && (
        <ul className="m-0 grid list-none gap-1 p-0" data-testid={`${at}-options`}>
          {d.options.map((o) => (
            <li key={o.option} className={META} data-difference-option={o.option}>
              <span className="text-text-header">{o.label}</span>{o.chances.map((c) => <span key={c.holder_id} data-difference-chance={c.holder_id}> · {holder(c.holder_id)} {c.text}</span>)}
            </li>
          ))}
        </ul>
      )}
      {d.settle.length > 0 && <ul className="m-0 grid list-disc gap-1 pl-3" data-testid={`${at}-settle`}>{d.settle.map((s, i) => <li key={i} className={`${BODY} break-words`} data-settle={s.kind}>{s.text}</li>)}</ul>}
      {d.steps.length > 0 && <ul className="m-0 grid list-none gap-1 p-0" data-testid={`${at}-steps`}>{d.steps.map((s) => <li key={s.id} className={`${BODY} break-words`} data-step={s.step}>{s.text}</li>)}</ul>}
      {/* Core's step route takes any difference this member can see now, calculated or not (qualitative framing rows included), so the two
          steps are offered on every drawn row; a step records what the team will do about the difference and changes no model. */}
      <div className="flex flex-wrap gap-2 pt-1" data-testid={`${at}-actions`}>
        <Button size="sm" variant="secondary" data-testid={`${at}-dissent`} disabled={busy || mine.has('dissent')} aria-pressed={mine.has('dissent')} onClick={() => void step('dissent')}>{STEP_WORDS.dissent}</Button>
        <Button size="sm" variant="secondary" data-testid={`${at}-research`} disabled={busy || mine.has('research')} aria-pressed={mine.has('research')} onClick={() => void step('research')}>{STEP_WORDS.research}</Button>
        {d.status !== 'pending' && <Button size="sm" data-testid={`${at}-commit`} disabled={busy} onClick={commit}>{h.commit}</Button>}
      </div>
      {error && <p role="alert" className={ERR} data-testid={`${at}-error`}>{error}</p>}
    </article>
  )
}
