import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { teamApi, TeamApiError, type Invite } from './api'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWriteSending } from './writes'
import { BODY, CARD, ERR, FIELD, H, LABEL, META } from './ui'

/**
 * BRING A COLLEAGUE IN (core API v1.8, "joining by link"): any member makes a colleague their own private link, which signs them in as a
 * member of this scenario and opens it here (API v1.9: the link lands on this scenario's DGAI address while DGAI is served). Core gives
 * the link once, in its answer, and never again: it is shown here until the tab is left. The people this member invited are listed as core lists them, and the inviter may revoke a link.
 */
export function InvitePanel({ sid }: { sid: string }): JSX.Element {
  const [name, setName] = useState('')
  const [made, setMade] = useState<{ name: string; link: string } | null>(null)
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
      const r = await runWrite(`${sid}:invite`, { op: false }, null, () => teamApi.invite(sid, name))
      setMade({ name, link: new URL(r.link, window.location.origin).href })
      setName('')
      await list()
    } catch (e) { setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.') } finally { setBusy(false) }
  }
  const revoke = async (id: string) => {
    setError(null)
    try { await runWrite(`${sid}:revoke:${id}`, { op: false }, null, () => teamApi.revokeInvite(sid, id)); await list() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was changed.')
    }
  }

  return (
    <section data-testid="team-invite" aria-label="Bring a colleague in" className="grid gap-2">
      <h3 className={H}>Bring a colleague in</h3>
      {made !== null && (
        <div className={CARD} data-testid="team-invite-made">
          <p className={BODY}>{made.name}’s own private link. Send it to them yourself; Olumi shows it only now.</p>
          <input readOnly className={FIELD} value={made.link} data-testid="team-invite-link" onFocus={(e) => e.currentTarget.select()} aria-label={`${made.name}’s private link`} />
        </div>
      )}
      <div className={CARD}>
        <label htmlFor="team-invite-name" className={LABEL}>Their name</label>
        <input id="team-invite-name" data-testid="team-invite-name" className={FIELD} value={name} disabled={busy || sending || locked} autoComplete="off" onChange={(e) => setName(e.target.value)} />
        <div><Button size="sm" data-testid="team-invite-go" disabled={busy || sending || locked || name.trim() === ''} onClick={() => void invite()}>Make their link</Button></div>
        {locked ? <p role="alert" className={ERR} data-testid="team-invite-error">{MAY_HAVE_SAVED}</p> : error && <p role="alert" className={ERR} data-testid="team-invite-error">{error}</p>}
      </div>
      {invites.length > 0 && (
        <ul className="m-0 grid list-none gap-1 p-0" data-testid="team-invites">
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
