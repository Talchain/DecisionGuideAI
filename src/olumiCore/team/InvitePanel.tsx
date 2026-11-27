import { useCallback, useEffect, useState } from 'react'
import { OkIcon } from '../../olumiView/look/icons'
import { teamApi, TeamApiError, type Invite } from './api'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWriteSending } from './writes'
import { BODY, ERR, FIELD, GO, LABEL, META } from './ui'
import { useDraft } from './drafts'

/** The invite form's name, as a draft: the header's "Named in the brief but not matched" notice fills it with the first name core lists. */
export const inviteNameKey = (sid: string) => `${sid}:invite-name`
export const inviteOpenKey = (sid: string) => `${sid}:invite-open`

export type MadeInvite = { name: string; link: string }

/**
 * BRING A COLLEAGUE IN (core API v1.8, "joining by link"): any member makes a colleague their own private link, which signs them in as a
 * member of this scenario and opens it here (API v1.9: the link lands on this scenario's DGAI address while DGAI is served). Core gives
 * the link once. The parent holds it across menu closes until the tab is left. Core lists the people this member invited, and the inviter may revoke a link.
 */
export function InvitePanel({ sid, made, onMade }: { sid: string; made: MadeInvite | null; onMade: (invite: MadeInvite) => void }): JSX.Element {
  // A draft, so a name put here from elsewhere (the header's "not matched" notice, DL 9 Nov) is the form's when it opens.
  const [name, setName] = useDraft(inviteNameKey(sid), '')
  const [invites, setInvites] = useState<readonly Invite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // An invitation has no operation id in core: one whose answer was lost may have made a link, so it is locked, never sent again.
  const locked = useWriteLocked(`${sid}:invite`), sending = useWriteSending(`${sid}:invite`)
  const list = useCallback(() => teamApi.invites(sid).then((r) => setInvites(Array.isArray(r?.invites) ? r.invites : []), () => undefined), [sid])
  useEffect(() => { void list() }, [list])

  const invite = async () => {
    setBusy(true); setError(null)
    try {
      const r = await runWrite(`${sid}:invite`, { op: false, anyVersion: true }, null, () => teamApi.invite(sid, name))
      onMade({ name, link: new URL(r.link, window.location.origin).href })
      setName('')
      await list()
    } catch (e) { setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.') } finally { setBusy(false) }
  }
  const revoke = async (id: string) => {
    setError(null)
    try { await runWrite(`${sid}:revoke:${id}`, { op: false, anyVersion: true }, null, () => teamApi.revokeInvite(sid, id)); await list() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was changed.')
    }
  }

  return (
    <section data-testid="team-invite" aria-label="Bring a colleague in" className="space-y-4">
      {made !== null && (
        <div className="space-y-3 rounded-md border border-panel-border p-3" data-testid="team-invite-made">
          <p className={BODY}>{made.name}’s own private link. Send it to them yourself; Olumi shows it only now.</p>
          <input readOnly className={FIELD} value={made.link} data-testid="team-invite-link" onFocus={(e) => e.currentTarget.select()} aria-label={`${made.name}’s private link`} />
        </div>
      )}
      <div className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="team-invite-name" className={LABEL}>Their name</label>
          <input id="team-invite-name" data-testid="team-invite-name" className={FIELD} value={name} disabled={busy || sending || locked} autoComplete="off" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3"><button type="button" className={GO} data-testid="team-invite-go" disabled={busy || sending || locked || name.trim() === ''} onClick={() => void invite()}><OkIcon id="invite" size={14} decorative />Make their link</button>
          {/* Why it waits (DL ruling 9 Nov: a disabled button says why). */}
          {busy || sending || locked || name.trim() !== '' ? null : <span className={META} data-testid="team-invite-why">Type their name first</span>}</div>
        {locked ? <p role="alert" className={ERR} data-testid="team-invite-error">{MAY_HAVE_SAVED}</p> : error && <p role="alert" className={ERR} data-testid="team-invite-error">{error}</p>}
      </div>
      {invites.length > 0 && (
        <ul className="m-0 list-none space-y-3 p-0" data-testid="team-invites">
          {invites.map((i) => (
            <li key={i.id} data-testid={`team-invite-${i.id}`} className={`${META} flex items-center gap-2`}>
              <span>{i.name} · invited by {i.by} · {i.status}</span>
              {i.revocable && i.status === 'live' && <button type="button" className="cursor-pointer underline underline-offset-2" onClick={() => void revoke(i.id)} data-testid={`team-invite-revoke-${i.id}`}>Revoke</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
