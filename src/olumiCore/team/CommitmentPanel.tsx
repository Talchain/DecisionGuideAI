import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { teamApi, TeamApiError } from './api'
import { useDraft } from './drafts'
import { OutcomePanel } from './OutcomePanel'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWriteSending } from './writes'
import { BODY, CARD, ERR, FIELD, H, LABEL, META } from './ui'

interface CommitmentDraft { open: boolean; action: string; owner: string; expect: string; reconsider: string; keeps: string[] }
const EMPTY: CommitmentDraft = { open: false, action: '', owner: '', expect: '', reconsider: '', keeps: [] }

/**
 * THE COMMITMENT (spec §8 step 6) and its later review (step 7). The action, its owner from the team (`collab.owners`), what the team
 * expects and what would make it reconsider, all in the team's own words: Olumi writes none of them. A commitment may keep open the
 * dissent the approved model records (`collab.dissent`), so a disagreement is carried forward, not settled by the commitment. Each saved
 * commitment carries its outcome reviews.
 */
export function CommitmentPanel({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element {
  const c = view.collab
  const [d, setD, dropDraft] = useDraft<CommitmentDraft>(`${sid}:commitment`, { ...EMPTY, owner: view.you_id })
  const { open, action, owner, expect, reconsider } = d
  // Only dissent the approved model still records: a kept id core no longer holds is dropped, never sent.
  const keeps = (d.keeps ?? []).filter((id) => c.dissent.some((x) => x.id === id))
  const labelOf = (id: string) => view.collab.records.find((r) => r.id === id)?.label ?? null
  const put = (p: Partial<CommitmentDraft>) => setD((x) => ({ ...x, ...p }))
  const [mine, setBusy] = useState(false)
  const sending = useWriteSending(`${sid}:commitment`)
  const busy = mine || sending
  const [error, setError] = useState<string | null>(null)
  // A commitment has no operation id in core: one whose answer was lost may have been saved, so it is locked, not sent again (`writes.ts`).
  const locked = useWriteLocked(`${sid}:commitment`)
  const ready = [action, expect, reconsider].every((t) => t.trim() !== '') && c.owners.some((o) => o.id === owner)

  const save = async () => {
    if (!ready || locked) return
    setBusy(true); setError(null)
    try {
      await runWrite(`${sid}:commitment`, { op: false }, null, () => teamApi.addCommitment(sid, { action, owner, expect, reconsider, keeps }))
      dropDraft()
      await onWrote()
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }

  return (
    <section data-testid="team-commitments" aria-label="Commitments" className="grid gap-2">
      <h3 className={H}>Commitments</h3>
      <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-commitment-list">
        {c.commitments.map((k) => (
          <li key={k.id} data-testid={`team-commitment-${k.id}`} className={CARD}>
            <p className={`${BODY} whitespace-pre-wrap break-words text-text-header`} data-testid={`team-commitment-action-${k.id}`}>{k.action}</p>
            <p className={META}>owner {k.owner} · set by {k.by}</p>
            <dl className="m-0 grid gap-1">
              <div><dt className={META}>What we expect</dt><dd className={`${BODY} m-0 whitespace-pre-wrap break-words`} data-testid={`team-commitment-expect-${k.id}`}>{k.expect}</dd></div>
              <div><dt className={META}>What would make us reconsider</dt><dd className={`${BODY} m-0 whitespace-pre-wrap break-words`}>{k.reconsider}</dd></div>
            </dl>
            {k.keeps.map(labelOf).some((l) => l !== null) && <p className={META} data-testid={`team-commitment-keeps-${k.id}`}>Keeps open: {k.keeps.map(labelOf).filter((l): l is string => l !== null).join('; ')}</p>}
            <OutcomePanel sid={sid} commitment={k} onWrote={onWrote} />
          </li>
        ))}
      </ul>

      {view.version === null ? (
        <p className={META} data-testid="team-commitment-unapproved">A commitment is made against an approved model. Approve the model in the chat first.</p>
      ) : !open ? (
        <div><Button size="sm" variant="secondary" data-testid="team-commitment-open" onClick={() => put({ open: true })}>Record the next action</Button></div>
      ) : (
        <div className={CARD} data-testid="team-commitment-form">
          <label htmlFor="team-c-action" className={LABEL}>The next action</label>
          <textarea id="team-c-action" data-testid="team-c-action" className={`${FIELD} min-h-[56px]`} value={action} disabled={busy} onChange={(e) => put({ action: e.target.value })} />
          <label htmlFor="team-c-owner" className={LABEL}>Who owns it</label>
          <select id="team-c-owner" data-testid="team-c-owner" className={FIELD} value={owner} disabled={busy} onChange={(e) => put({ owner: e.target.value })}>
            <option value="" disabled>Choose…</option>
            {c.owners.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <label htmlFor="team-c-expect" className={LABEL}>What we expect to see</label>
          <textarea id="team-c-expect" data-testid="team-c-expect" className={`${FIELD} min-h-[56px]`} value={expect} disabled={busy} onChange={(e) => put({ expect: e.target.value })} />
          <label htmlFor="team-c-reconsider" className={LABEL}>What would make us reconsider</label>
          <textarea id="team-c-reconsider" data-testid="team-c-reconsider" className={`${FIELD} min-h-[56px]`} value={reconsider} disabled={busy} onChange={(e) => put({ reconsider: e.target.value })} />
          {c.dissent.length > 0 && (
            <fieldset className="m-0 grid gap-1 border-0 p-0" data-testid="team-c-keeps">
              <legend className={LABEL}>Disagreement this keeps open (optional)</legend>
              {c.dissent.map((x) => (
                <label key={x.id} className={`${BODY} flex min-h-[28px] cursor-pointer items-start gap-2`}>
                  <input type="checkbox" className="mt-1" data-testid={`team-c-keep-${x.id}`} checked={keeps.includes(x.id)} disabled={busy}
                    onChange={(e) => put({ keeps: e.target.checked ? [...keeps, x.id] : keeps.filter((id) => id !== x.id) })} />
                  <span className="break-words">{x.holder}: {x.position}</span>
                </label>
              ))}
            </fieldset>
          )}
          {locked ? <p role="alert" data-testid="team-commitment-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="team-commitment-error" className={ERR}>{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" data-testid="team-commitment-save" disabled={!ready || busy || locked} onClick={() => void save()}>Record it</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => put({ open: false })}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  )
}
