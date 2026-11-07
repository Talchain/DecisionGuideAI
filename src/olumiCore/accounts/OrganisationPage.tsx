import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { typography } from '../../styles/typography'
import { TeamApiError } from '../team/api'
import { accountsApi, mine, whenOf, type Org, type OrgInvite, type Role } from './api'
import { BODY, CARD, ERR, FIELD, LINK, META, SELECT, SignedInFrame, useWho } from './Frame'

const ROLE_WORD: Record<Role, string> = { owner: 'Owner', member: 'Member' }
const STATUS_WORD: Record<OrgInvite['status'], string> = { live: 'waiting', used: 'used', ended: 'ended', expired: 'expired' }
const said = (e: unknown, otherwise: string) => (e instanceof TeamApiError ? e.message : otherwise)

/**
 * THE ORGANISATION (core `/api/org*`): its members and their roles. An owner also sees each member's email, makes one-use invitation
 * links (shown once: Olumi keeps only a hash, and sends no email), ends a waiting one, sets a role and removes a member, who is signed
 * out at once. A member sees who is in it.
 */
export default function OrganisationPage(): JSX.Element {
  const who = useWho()
  const [org, setOrg] = useState<Org | null>(null)
  const [invites, setInvites] = useState<readonly OrgInvite[]>([])
  const [made, setMade] = useState<string | null>(null)
  const [asking, setAsking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // The person this page was opened for: every read below must name them (`mine`), or it is dropped and said.
  const page = who.status === 'in' && who.account !== null ? who.me.id : null
  const read = useCallback(async () => {
    if (page === null) return
    try {
      const o = await accountsApi.org()
      mine(o, o?.you?.id, page)
      setOrg(o)
      if (o.you.role === 'owner') {
        const r = await accountsApi.invites()
        mine(r, r?.you_id, page)
        setInvites(r.invites ?? [])
      }
    } catch (e) { setError(said(e, 'Olumi could not be read just now. Try again in a moment.')) }
  }, [page])
  useEffect(() => { void read() }, [read])
  const act = async (f: () => Promise<unknown>) => {
    setBusy(true); setError(null)
    try { await f(); await read() } catch (e) { setError(said(e, 'That did not go through. Nothing was changed.')) } finally { setBusy(false) }
  }
  const owner = org?.you.role === 'owner'
  return (
    <SignedInFrame who={who} title={org ? org.org.name : 'Organisation'} testid="account-org">
      {(w) => !w.account ? (
        <p className={`${CARD} ${BODY}`} data-testid="org-no-account">
          Your private link is not part of an organisation. <Link to="/signup" className={LINK}>Add an email and password</Link> to start one and invite colleagues.
        </p>
      ) : (
        <>
          {error && <p role="alert" className={ERR} data-testid="org-error">{error}</p>}
          {org && (
            <section className={`${CARD} grid gap-3`} aria-label="Members">
              <h2 className={`${typography.h5} text-text-header m-0`}>Members</h2>
              <ul className="m-0 grid list-none gap-0 p-0" data-testid="org-members">
                {org.members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 border-t border-panel-border py-3 first:border-t-0" data-testid={`org-member-${m.id}`}>
                    <div className="grid min-w-[200px] flex-1 gap-0.5">
                      <span className={`${typography.label} text-text-header`}>{m.name}{m.id === org.you.id ? ' (you)' : ''}</span>
                      <span className={META}>{[m.email, m.joined && `joined ${whenOf(m.joined)}`].filter(Boolean).join(' · ')}</span>
                    </div>
                    {owner && m.id !== org.you.id ? (
                      <select aria-label={`${m.name}’s role`} className={SELECT} value={m.role} disabled={busy} data-testid={`org-role-${m.id}`}
                        onChange={(e) => void act(() => accountsApi.setRole(m.id, e.target.value as Role))}>
                        <option value="owner">Owner</option>
                        <option value="member">Member</option>
                      </select>
                    ) : <span className={`${typography.bodySmall} text-text-body`}>{ROLE_WORD[m.role]}</span>}
                    {owner && m.id !== org.you.id && (asking === m.id ? (
                      <span className="flex flex-wrap items-center gap-2" data-testid={`org-remove-ask-${m.id}`}>
                        <span className={BODY}>Remove {m.name}? They are signed out at once.</span>
                        <Button size="sm" variant="danger" disabled={busy} onClick={() => void act(async () => { await accountsApi.remove(m.id); setAsking(null) })} data-testid={`org-remove-yes-${m.id}`}>Remove</Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking(null)}>Keep</Button>
                      </span>
                    ) : <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAsking(m.id)} data-testid={`org-remove-${m.id}`}>Remove</Button>)}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {org && owner && (
            <section className={`${CARD} grid gap-3`} aria-label="Invite colleagues">
              <h2 className={`${typography.h5} text-text-header m-0`}>Invite a colleague</h2>
              <p className={BODY}>Each link works once, for 14 days. Olumi sends no email: you send the link yourself.</p>
              {made && (
                <div className="grid gap-1" data-testid="org-invite-made">
                  <label htmlFor="org-invite-link" className={META}>Their link, shown only now</label>
                  <input id="org-invite-link" readOnly className={FIELD} value={made} onFocus={(e) => e.currentTarget.select()} data-testid="org-invite-link" />
                </div>
              )}
              <div><Button disabled={busy} data-testid="org-invite-go" onClick={() => void act(async () => { const r = await accountsApi.invite(); setMade(new URL(r.link, window.location.origin).href) })}>Make an invitation link</Button></div>
              {invites.length > 0 && (
                <ul className="m-0 grid list-none gap-1 p-0" data-testid="org-invites">
                  {invites.slice().reverse().map((i) => (
                    <li key={i.id} className={`${META} flex flex-wrap items-center gap-2`} data-testid={`org-invite-${i.id}`}>
                      <span>Made {whenOf(i.made)} by {i.by} · {i.status === 'used' && i.joined ? `used by ${i.joined}` : STATUS_WORD[i.status]}{i.status === 'live' ? ` until ${whenOf(i.expires)}` : ''}</span>
                      {i.status === 'live' && <button type="button" className={LINK} disabled={busy} onClick={() => void act(() => accountsApi.endInvite(i.id))} data-testid={`org-invite-end-${i.id}`}>End</button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {org && !owner && <p className={META}>Only an owner of {org.org.name} can invite or remove people.</p>}
        </>
      )}
    </SignedInFrame>
  )
}
