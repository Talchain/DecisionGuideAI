import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { TeamApiError } from '../team/api'
import { accountsApi, nav } from './api'
import { ERR, FIELD, GuestFrame, LABEL, LINK, META } from './Frame'

/** Sign in with an email and password (core `POST /api/account/signin`). Core's refusal is shown in its own words. */
export default function SignInPage(): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [said, setSaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setSaid(null)
    try { await accountsApi.signIn(email, password); nav.landSignedIn() } catch (x) {
      setSaid(x instanceof TeamApiError ? x.message : 'That did not go through. Try again in a moment.')
      setBusy(false)
    }
  }
  return (
    <GuestFrame testid="account-signin" title="Sign in to Olumi">
      <form className="grid gap-4" onSubmit={(e) => void submit(e)} noValidate>
        <div>
          <label htmlFor="signin-email" className={LABEL}>Email</label>
          <input id="signin-email" type="email" autoComplete="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
        </div>
        <div>
          <label htmlFor="signin-password" className={LABEL}>Password</label>
          <input id="signin-password" type="password" autoComplete="current-password" className={FIELD} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
        </div>
        {said && <p role="alert" className={ERR} data-testid="account-signin-error">{said}</p>}
        <Button type="submit" disabled={busy || email.trim() === '' || password === ''} data-testid="account-signin-go">{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <p className={META}>New to Olumi? <Link to="/signup" className={LINK}>Create an account</Link></p>
      <p className={META}>Have a private link from a colleague? Open it and you are in.</p>
    </GuestFrame>
  )
}
