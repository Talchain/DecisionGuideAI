/**
 * The Team flow's reveal step and its folds (overnight 18 Nov, lane wip/v12-tab-team); "Where you differ" is ../../olumiView/v12/views/WhereWeDiffer. Every word about the scenario is core's (`collab.waiting`, `collab.next`, the differences read); the rest is chrome.
 */
import { useState } from 'react'
import type { View } from '../../olumiView/client'
import { OkIcon } from '../../olumiView/look/icons'
import { FOLD_SUMMARY, FoldChevron } from '../../olumiView/look/FoldChevron'
import { teamApi, TeamApiError } from './api'
import { revealed, STEP_WORDS } from './flow'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWriteSending } from './writes'
import { BODY, ERR, FOLD, GO, META } from './ui'

/** Fixed chrome for the folds and the reveal. */
export const FLOW_WORDS = {
  reveal: 'Reveal everyone’s views',
  revealReady: 'Everyone has given their view.',
  revealAfter: 'Once everyone has given or skipped a view, any of you can reveal them all together.',
  views: (n: number) => `Everyone’s views in words · ${n}`,
  common: (n: number) => `Common ground · ${n}`,
  marked: (n: number) => `Marked on the canvas · ${n}`,
  dissent: (n: number) => `Disagreements kept · ${n}`,
} as const

/** Step 3: whom the round still waits for (core's words), and the reveal once core says it can be made (`can_reveal`). */
export function RevealStep({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element {
  const c = view.collab
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A reveal has no operation id in core: one whose answer was lost may have been saved, so it is not sent again (`writes.ts`).
  const locked = useWriteLocked(`${sid}:reveal`)
  const revealSending = useWriteSending(`${sid}:reveal`), viewSending = useWriteSending(`${sid}:view`)
  const sending = revealSending || viewSending
  const reveal = async () => {
    setBusy(true); setError(null)
    try { await runWrite(`${sid}:reveal`, { op: false }, null, () => teamApi.reveal(sid)); await onWrote() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }
  return (
    <div className="grid gap-2" data-testid="team-reveal">
      {c.waiting !== null && (
        <p className={`${BODY} flex items-center gap-1.5`} data-testid="team-waiting"><span className="flex-none text-text-light"><OkIcon id="state-waits" size={14} decorative /></span>{c.waiting}</p>
      )}
      {c.can_reveal && (
        <div className="grid justify-items-start gap-2" data-testid="team-nudge-reveal">
          <p className={BODY}>{FLOW_WORDS.revealReady}</p>
          <button type="button" className={GO} data-testid="team-reveal-go" disabled={busy || sending || locked} onClick={() => void reveal()}>{FLOW_WORDS.reveal}</button>
        </div>
      )}
      {!c.can_reveal && c.waiting === null && <p className={META} data-testid="team-reveal-state">{revealed(view) ? STEP_WORDS.revealDone : FLOW_WORDS.revealAfter}</p>}
      {locked ? <p role="alert" data-testid="team-nudges-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="team-nudges-error" className={ERR}>{error}</p>}
    </div>
  )
}

/** A fold: one line at rest (chrome with a count), the content on a press. Drawn only when it holds something. */
export function Fold({ at, summary, children }: { at: string; summary: string; children: JSX.Element | (JSX.Element | null)[] }): JSX.Element {
  return (
    <details data-testid={at} className="group">
      <summary className={`${FOLD_SUMMARY} ${FOLD}`} data-testid={`${at}-summary`}><FoldChevron />{summary}</summary>
      <div className="grid gap-3 pt-2">{children}</div>
    </details>
  )
}

