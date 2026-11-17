import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { TeamApiError } from '../team/api'
import { accountsApi, nav } from './api'
import { ERR, FIELD, GuestFrame, LABEL, LINK, META, useWho } from './Frame'

/** The fields both sign-up and joining ask for. */
export function PersonFields({ name, setName, email, setEmail, password, setPassword, busy, id }: {
  name: string; setName: (v: string) => void; email: string; setEmail: (v: string) => void; password: string; setPassword: (v: string) => void; busy: boolean; id: string
}): JSX.Element {
  return (
    <>
      <div>
        <label htmlFor={`${id}-name`} className={LABEL}>Your name</label>
        <input id={`${id}-name`} autoComplete="name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      </div>
      <div>
        <label htmlFor={`${id}-email`} className={LABEL}>Email</label>
        <input id={`${id}-email`} type="email" autoComplete="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
      </div>
      <div>
        <label htmlFor={`${id}-password`} className={LABEL}>Password</label>
        <input id={`${id}-password`} type="password" autoComplete="new-password" aria-describedby={`${id}-password-hint`} className={FIELD} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
        <p id={`${id}-password-hint`} className={`${META} mt-1`}>At least 8 characters.</p>
      </div>
    </>
  )
}

/**
 * Add an email and password (core `POST /api/account/signup`). Core refuses an open sign-up with a 403 (accounts start from an invitation),
 * so the form is drawn ONLY for someone a private link signed in: it adds the email and password to that same person, keeping their
 * scenarios, and starts the organisation they own. Anyone else is told how accounts start, without a form that could only be refused.
 * Core's `/api/me` carries no "sign-up needs an invitation" flag, so that sentence is page chrome (same meaning as core's refusal).
 */
export default function SignUpPage(): JSX.Element {
  const who = useWho()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [org, setOrg] = useState('')
  const [said, setSaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Signed in by a private link: their name is the one Olumi already has, which they may change here.
  const linked = who.status === 'in' && !who.account ? who.me : null
  const linkName = linked ? linked.name : null
  useEffect(() => { if (linkName !== null) setName((n) => n || linkName) }, [linkName])
  if (who.status === 'in' && who.account) return <Navigate to="/" replace />
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setSaid(null)
    try {
      await accountsApi.signUp({ name, email, password, ...(org.trim() ? { org } : {}), attach: true })
      nav.landSignedIn()
    } catch (x) { setSaid(x instanceof TeamApiError ? x.message : 'That did not go through. Nothing was saved.'); setBusy(false) }
  }
  if (!linked) {
    return (
      <GuestFrame testid="account-signup-invitation" title="Olumi accounts start from an invitation"
        lead={who.status === 'loading' ? 'Loading…' : who.status === 'error' ? who.message : 'Open the link you were given, then add an email and password.'}>
        <p className={META}>Already have an account? <Link to="/signin" className={LINK}>Sign in</Link></p>
      </GuestFrame>
    )
  }
  return (
    <GuestFrame testid="account-signup" title="Create your Olumi account"
      lead={<>You are signed in as <b>{linked.name}</b> with a private link. This adds an email and password to {linked.name}, keeping {linked.name}’s scenarios.</>}>
      <form className="grid gap-4" onSubmit={(e) => void submit(e)} noValidate>
        <PersonFields id="signup" name={name} setName={setName} email={email} setEmail={setEmail} password={password} setPassword={setPassword} busy={busy} />
        <div>
          <label htmlFor="signup-org" className={LABEL}>Organisation</label>
          <input id="signup-org" autoComplete="organization" className={FIELD} placeholder={name.trim() ? `${name.trim()}’s organisation` : 'Your team or company'} value={org} onChange={(e) => setOrg(e.target.value)} disabled={busy} />
          <p className={`${META} mt-1`}>You own it, and can invite colleagues to it.</p>
        </div>
        {said && <p role="alert" className={ERR} data-testid="account-signup-error">{said}</p>}
        <Button type="submit" disabled={busy || name.trim() === '' || email.trim() === '' || password === ''} data-testid="account-signup-go">{busy ? 'Creating…' : 'Create account'}</Button>
      </form>
      <p className={META}>Already have an account? <Link to="/signin" className={LINK}>Sign in</Link></p>
    </GuestFrame>
  )
}
