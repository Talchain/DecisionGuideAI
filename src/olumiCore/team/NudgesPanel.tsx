import { useState } from 'react'
import { ClipboardCheck, Eye, Hourglass } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { teamApi, TeamApiError } from './api'
import { openOutcome } from './OutcomePanel'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWriteSending } from './writes'
import { BODY, CARD, ERR, META } from './ui'

/**
 * WHAT THE TEAM LOOP WAITS ON, at the top of the Team tab: whom the round of views still waits for (core's `collab.waiting`, its words),
 * the reveal once everyone has given (`collab.can_reveal`), and each next action with no outcome yet (a commitment whose `outcomes` is
 * empty: its action and owner as core holds them). All of it read from the View; nothing is worked out here. Drawn only when one applies.
 */
export function NudgesPanel({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element | null {
  const c = view.collab
  const open = c.commitments.filter((k) => k.outcomes.length === 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A reveal has no operation id in core: one whose answer was lost may have been saved, so it is not sent again (`writes.ts`).
  const locked = useWriteLocked(`${sid}:reveal`)
  const revealSending = useWriteSending(`${sid}:reveal`), viewSending = useWriteSending(`${sid}:view`)
  const sending = revealSending || viewSending
  if (c.waiting === null && !c.can_reveal && open.length === 0) return null

  const reveal = async () => {
    setBusy(true); setError(null)
    try { await runWrite(`${sid}:reveal`, { op: false }, null, () => teamApi.reveal(sid)); await onWrote() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }
  const record = (id: number) => {
    openOutcome(sid, id)
    // The form opens under its commitment, further down the tab: bring it into view.
    requestAnimationFrame(() => document.querySelector(`[data-testid="team-outcome-form-${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  return (
    <section data-testid="team-nudges" aria-label="What the team is waiting on" className={`${CARD} grid gap-2`}>
      {c.waiting !== null && (
        <p className={`${BODY} flex items-center gap-1.5`} data-testid="team-waiting"><Hourglass aria-hidden="true" className="h-3.5 w-3.5 flex-none text-text-light" />{c.waiting}</p>
      )}
      {c.can_reveal && (
        <div className="flex flex-wrap items-center gap-2" data-testid="team-nudge-reveal">
          <span className={BODY}>Everyone has given their view.</span>
          <Button size="sm" data-testid="team-reveal-go" disabled={busy || sending || locked} onClick={() => void reveal()}>
            <span className="inline-flex items-center gap-1.5"><Eye aria-hidden="true" className="h-3.5 w-3.5" />Reveal everyone’s views</span>
          </Button>
        </div>
      )}
      {open.map((k) => (
        <div key={k.id} className="flex flex-wrap items-center gap-2" data-testid={`team-nudge-outcome-${k.id}`}>
          <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5 flex-none text-text-light" />
          <span className={`${BODY} min-w-0 flex-1 break-words`}>{k.action} <span className={META}>· {k.owner} · no outcome yet</span></span>
          <Button size="sm" variant="secondary" onClick={() => record(k.id)}>Record what happened</Button>
        </div>
      ))}
      {locked ? <p role="alert" data-testid="team-nudges-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="team-nudges-error" className={ERR}>{error}</p>}
    </section>
  )
}
