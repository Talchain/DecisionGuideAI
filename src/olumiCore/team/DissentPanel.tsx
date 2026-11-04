import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { teamApi, TeamApiError } from './api'
import { useDraft } from './drafts'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWriteSending } from './writes'
import { BODY, CARD, ERR, FIELD, H, LABEL, META } from './ui'

type Dissent = View['collab']['dissent'][number]
interface DissentDraft { rewording: boolean; words: string; tell: string }

/**
 * THE TEAM'S DISAGREEMENTS (board 15b; R2b, core's olumi.view/3 at d1fe5e2). Each dissent the approved model records, in its holder's words,
 * and whether its holder has confirmed them. Only the holder (core's `holder_id`, never a name) confirms their words as they stand or
 * rewords them, with what would tell them they are wrong; core keeps both verbatim and shows the newest. Dissent stays the holder's, so
 * the team's alignment is earned rather than manufactured.
 */
export function DissentPanel({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element | null {
  if (view.collab.dissent.length === 0) return null
  return (
    <section data-testid="team-dissent" aria-label="Disagreements" className="grid gap-2">
      <h3 className={H}>Disagreements</h3>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {view.collab.dissent.map((d) => <DissentRow key={d.id} sid={sid} d={d} you={view.you_id} onWrote={onWrote} />)}
      </ul>
    </section>
  )
}

/** A dissent as the team reads it: its holder's confirmed words where they confirmed them, else the words the model records (R2 review P1-4). */
export const dissentWords = (d: Dissent): string => d.confirmed?.words ?? d.position

function DissentRow({ sid, d, you, onWrote }: { sid: string; d: Dissent; you: string; onWrote: () => Promise<boolean> }): JSX.Element {
  // Core's R2b fields (olumi.view/3 at d1fe5e2): the member the holder names, and the holder's confirmed words.
  const confirmed = d.confirmed
  const holder = d.holder_id
  const mine = holder !== null && holder === you
  const shown = dissentWords(d)
  const key = `${sid}:dissent:${d.id}`
  const [draft, setDraft, dropDraft] = useDraft<DissentDraft>(key, { rewording: false, words: shown, tell: confirmed?.tell ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A confirmation has no operation id in core: one whose answer was lost may have been saved, so it is locked, not sent again (`writes.ts`).
  const locked = useWriteLocked(key)
  const sending = useWriteSending(key)
  const words = draft.rewording ? draft.words : shown
  const ready = words.trim() !== '' && !busy && !sending && !locked

  const confirm = async () => {
    if (!ready) return
    setBusy(true); setError(null)
    const tell = draft.tell.trim() === '' ? null : draft.tell
    try {
      await runWrite(key, { op: false }, null, () => teamApi.confirmDissent(sid, d.id, words, tell))
      dropDraft()
      await onWrote()
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }

  return (
    <li data-testid={`team-dissent-${d.id}`} className={CARD}>
      <p className={`${BODY} whitespace-pre-wrap break-words`}><span className="text-text-header">{d.holder}</span>: {shown}</p>
      <p className={META} data-testid={`team-dissent-state-${d.id}`}>
        {confirmed !== null ? `Confirmed by ${d.holder}` : holder === null ? 'Not yet confirmed. No member is named as its holder, so no one can confirm it.' : `Not yet confirmed by ${d.holder}. Only ${d.holder} can confirm it.`}
      </p>
      {confirmed?.tell != null && <p className={`${META} whitespace-pre-wrap break-words`} data-testid={`team-dissent-tell-${d.id}`}>What would tell them they are wrong: {confirmed.tell}</p>}
      {mine && (
        <div className="grid gap-2" data-testid={`team-dissent-form-${d.id}`}>
          {draft.rewording && (<>
            <label htmlFor={`team-dissent-words-${d.id}`} className={LABEL}>Your words</label>
            <textarea id={`team-dissent-words-${d.id}`} data-testid={`team-dissent-words-${d.id}`} className={`${FIELD} min-h-[56px]`} value={draft.words} disabled={busy}
              onChange={(e) => setDraft((p) => ({ ...p, words: e.target.value }))} />
          </>)}
          <label htmlFor={`team-dissent-tell-input-${d.id}`} className={LABEL}>What would tell you that you are wrong? (optional)</label>
          <textarea id={`team-dissent-tell-input-${d.id}`} data-testid={`team-dissent-tell-input-${d.id}`} className={`${FIELD} min-h-[48px]`} value={draft.tell} disabled={busy}
            onChange={(e) => setDraft((p) => ({ ...p, tell: e.target.value }))} />
          {locked ? <p role="alert" data-testid={`team-dissent-error-${d.id}`} className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid={`team-dissent-error-${d.id}`} className={ERR}>{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" data-testid={`team-dissent-confirm-${d.id}`} disabled={!ready} onClick={() => void confirm()}>Confirm my words</Button>
            {!draft.rewording && (
              <Button size="sm" variant="secondary" data-testid={`team-dissent-reword-${d.id}`} disabled={busy} onClick={() => setDraft((p) => ({ ...p, rewording: true, words: shown }))}>Reword</Button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
