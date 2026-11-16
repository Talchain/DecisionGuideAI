import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import type { View } from '../../client'
import { focusNodeById } from '../../../canvas/utils/focusHelpers'
import { TeamApiError } from '../../../olumiCore/team/api'
import { putDraft } from '../../../olumiCore/team/drafts'
import { readDifferences, stepDifference, differencesKey, useDifferences, type Difference, type Differences } from '../../../olumiCore/team/differences'
import { runWrite } from '../../../olumiCore/team/writes'
import { NudgesPanel } from '../../../olumiCore/team/NudgesPanel'
import { ViewsPanel } from '../../../olumiCore/team/ViewsPanel'
import { DissentPanel } from '../../../olumiCore/team/DissentPanel'
import { AVATAR, BODY, CARD, ERR, H, META } from '../../../olumiCore/team/ui'
import { emptyConsequence, groupDifferences, NOTHING_CALCULATED, revealedForYou } from './differGroups'
import { SimpleSummary, useRevealedDifferences } from './SimpleSummary'
import { FrameEntry, MyFrames } from './FrameEntry'
import { FrameLines } from './FrameLines'
import { frameIsEmpty, frameOf } from './frame'

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
  const data = useRevealedDifferences(sid, view)
  const error = useDifferences((s) => (s.sid === sid ? s.error : null))
  const revealed = revealedForYou(view)
  const key = differencesKey(sid, view)
  // The member's own entry (private view, whole view in words, nudges, dissent) is always here, whatever the differences are doing: loading,
  // failed or gated never takes it away. Only the differences themselves wait for core's read.
  const shown = revealed && data !== null && !data.gated ? data : null
  const groups = shown === null ? [] : groupDifferences(shown)
  const framed = revealed ? view.collab.shared.filter((v) => !frameIsEmpty(frameOf(v))) : []
  return (
    <section data-testid={revealed ? 'differ-after' : 'differ-before'} aria-label={shown?.heading ?? view.collab.heading} className="grid gap-4">
      <NudgesPanel sid={sid} view={view} onWrote={onWrote} />
      <ViewsPanel sid={sid} view={view} onWrote={onWrote} />
      <FrameEntry sid={sid} view={view} onWrote={onWrote} defaultOpen={!revealed && view.collab.mine.length === 0} />
      <MyFrames view={view} />
      {revealed && (
        <div className="grid gap-2" data-testid="differ-differences">
          <h3 className={H} data-testid="differ-heading">{shown?.heading ?? view.collab.heading}</h3>
          {revealed && error && shown === null && <p role="alert" className={ERR} data-testid="differ-error">{error}</p>}
          {shown !== null && <SimpleSummary sid={sid} view={view} />}
          {shown !== null && shown.differences.length === 0 && <p className={META} data-testid="differ-empty">{shown.empty}</p>}
          {shown !== null && groups.map((g) => (
            <div key={g.id} className="grid gap-2" data-testid={`differ-group-${g.id}`}>
              <p className={`${META} text-text-header`} data-testid={`differ-group-${g.id}-heading`}>{g.heading}</p>
              {g.rows.map((d) => <Row key={`${d.record}|${d.goal}`} sid={sid} view={view} data={shown} d={d}
                onWrote={async () => { await readDifferences(sid, key); return onWrote() }} />)}
            </div>
          ))}
          {shown !== null && (() => { const g = emptyConsequence(shown); return g === null ? null : (
            <div className="grid gap-2" data-testid="differ-group-consequence">
              <p className={`${META} text-text-header`} data-testid="differ-group-consequence-heading">{g.heading}</p>
              <p className={META} data-testid="differ-group-consequence-empty">{NOTHING_CALCULATED}</p>
            </div>
          ) })()}
        </div>
      )}
      {framed.length > 0 && (
        <div className="grid gap-2" data-testid="differ-frames">
          {framed.map((v) => (
            <div key={v.id} className="grid gap-1" data-testid={`differ-frame-${v.id}`}>
              <p className={`${BODY} text-text-header`}>{v.by}</p>
              <FrameLines at={`differ-frame-${v.id}`} v={v} />
            </div>
          ))}
        </div>
      )}
      <DissentPanel sid={sid} view={view} onWrote={onWrote} />
    </section>
  )
}

/** The two steps' fixed labels (Sprint-Resolve board). */
const STEP_WORDS = { dissent: 'Keep as a disagreement', research: 'Agree to find out' } as const

function Row({ sid, view, data, d, onWrote }: { sid: string; view: View; data: Differences; d: Difference; onWrote: () => Promise<boolean> }): JSX.Element {
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
    putDraft<Record<string, unknown>>(`${sid}:commitment`, (prev) => ({ action: '', expect: '', reconsider: '', keeps: [], option: '', reviewOn: '', ...(prev ?? {}), owner: (prev?.['owner'] as string | undefined) || view.you_id, open: true }))
    requestAnimationFrame(() => document.querySelector('[data-testid="team-commitment-form"], [data-testid="team-commitments"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }
  const holder = (id: string) => d.sides.find((s) => s.holder_id === id)?.holder ?? ''
  return (
    <article className={CARD} data-testid={at} data-difference-status={d.status}>
      {cards.length > 0
        ? <button type="button" data-testid={`${at}-focus`} title="Show it on the canvas" onClick={() => focusNodeById(cards[0]!)} className={`${BODY} text-left text-text-header`}>
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
        <ul className="m-0 grid list-none gap-0.5 p-0" data-testid={`${at}-options`}>
          {d.options.map((o) => (
            <li key={o.option} className={META} data-difference-option={o.option}>
              <span className="text-text-header">{o.label}</span>{o.chances.map((c) => <span key={c.holder_id} data-difference-chance={c.holder_id}> · {holder(c.holder_id)} {c.text}</span>)}
            </li>
          ))}
        </ul>
      )}
      {d.settle.length > 0 && <ul className="m-0 grid list-disc gap-1 pl-4" data-testid={`${at}-settle`}>{d.settle.map((s, i) => <li key={i} className={`${BODY} break-words`} data-settle={s.kind}>{s.text}</li>)}</ul>}
      {d.steps.length > 0 && <ul className="m-0 grid list-none gap-1 p-0" data-testid={`${at}-steps`}>{d.steps.map((s) => <li key={s.id} className={`${BODY} break-words`} data-step={s.step}>{s.text}</li>)}</ul>}
      {/* Core's step route takes any difference this member can see now, calculated or not (qualitative framing rows included), so the two
          steps are offered on every drawn row; a step records what the team will do about the difference and changes no model. */}
      <div className="flex flex-wrap gap-2" data-testid={`${at}-actions`}>
        <Button size="sm" variant="secondary" data-testid={`${at}-dissent`} disabled={busy || mine.has('dissent')} aria-pressed={mine.has('dissent')} onClick={() => void step('dissent')}>{STEP_WORDS.dissent}</Button>
        <Button size="sm" variant="secondary" data-testid={`${at}-research`} disabled={busy || mine.has('research')} aria-pressed={mine.has('research')} onClick={() => void step('research')}>{STEP_WORDS.research}</Button>
        {d.status !== 'pending' && <Button size="sm" data-testid={`${at}-commit`} disabled={busy} onClick={commit}>{h.commit}</Button>}
      </div>
      {error && <p role="alert" className={ERR} data-testid={`${at}-error`}>{error}</p>}
    </article>
  )
}
