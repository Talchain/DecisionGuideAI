import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { TeamApiError } from '../team/api'
import { accountsApi, nav } from './api'
import { BODY, ERR, FIELD, GuestFrame, LABEL, LINK, META, useWho } from './Frame'

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
 * Create an account (core `POST /api/account/signup`): a name, an email and a password, and the organisation it starts. No email is
 * sent. Someone already signed in by a private link adds the email and password to that same person, keeping their scenarios.
 */
export default function SignUpPage(): JSX.Element {
  const who = useWho()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [org, setOrg] = useState('')
  const [fresh, setFresh] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Signed in by a private link: their name is the one Olumi already has, which they may change here.
  const linkName = who.status === 'in' && !who.account ? who.me.name : null
  useEffect(() => { if (linkName !== null) setName((n) => n || linkName) }, [linkName])
  if (who.status === 'in' && who.account) return <Navigate to="/" replace />
  const linked = who.status === 'in' && !who.account && !fresh ? who.me : null
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setSaid(null)
    try {
      await accountsApi.signUp({ name, email, password, ...(org.trim() ? { org } : {}), ...(linked ? { attach: true } : {}) })
      nav.landSignedIn()
    } catch (x) { setSaid(x instanceof TeamApiError ? x.message : 'That did not go through. Nothing was saved.'); setBusy(false) }
  }
  return (
    <GuestFrame testid="account-signup" title="Create your Olumi account" lead={linked
      ? <>You are signed in as <b>{linked.name}</b> with a private link. This adds an email and password to {linked.name}, keeping {linked.name}’s scenarios.</>
      : 'Olumi is a reasoning partner for your team’s hardest questions.'}>
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
      {linked && <p className={BODY}><button type="button" className={LINK} onClick={() => setFresh(true)}>Make a separate account instead</button></p>}
      <p className={META}>Already have an account? <Link to="/signin" className={LINK}>Sign in</Link></p>
    </GuestFrame>
  )
}
