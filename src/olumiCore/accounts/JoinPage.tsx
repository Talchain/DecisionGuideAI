import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { TeamApiError } from '../team/api'
import { accountsApi, nav } from './api'
import { BODY, ERR, GuestFrame, LINK, META, useWho } from './Frame'
import { PersonFields } from './SignUpPage'

/**
 * Joining an organisation by an owner's one-use link (core `GET /api/org/join/:token`, then `POST /api/org/join`). Someone already signed
 * in by a private link (a scenario's Share link) joins as that SAME person (`attach`): the email and password go on them, and they keep
 * their scenarios. Signed out, joining makes a new person.
 */
export default function JoinPage(): JSX.Element {
  // "Try again" starts the identity read afresh: a new attempt is a new mount of the form.
  const [attempt, setAttempt] = useState(0)
  return <JoinForm key={attempt} retry={() => setAttempt((n) => n + 1)} />
}

function JoinForm({ retry }: { retry: () => void }): JSX.Element {
  const token = useParams().token ?? ''
  const [about, setAbout] = useState<{ org: { name: string }; by: string } | null>(null)
  const [gone, setGone] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [said, setSaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const who = useWho()
  // Identity must be KNOWN before anything is sent. Three explicit paths once it is:
  //  - signed in by a scenario's private link (no account yet): join as that same person (`attach`);
  //  - signed out: join makes a new person;
  //  - already has an account: join as before, no `attach`.
  const known = who.status === 'in' || who.status === 'out'
  const linked = who.status === 'in' && !who.account ? who.me : null
  const linkName = linked?.name ?? null
  useEffect(() => { if (linkName !== null) setName((n) => n || linkName) }, [linkName])
  useEffect(() => {
    let live = true
    accountsApi.joinPreview(token).then((r) => { if (live) setAbout(r) }, (e) => { if (live) setGone(e instanceof TeamApiError ? e.message : 'Olumi could not be read just now. Try again in a moment.') })
    return () => { live = false }
  }, [token])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!known) return
    setBusy(true); setSaid(null)
    try { await accountsApi.join({ token, name, email, password, ...(linked ? { attach: true } : {}) }); nav.landSignedIn() } catch (x) {
      setSaid(x instanceof TeamApiError ? x.message : 'That did not go through. Nothing was saved.'); setBusy(false)
    }
  }
  if (gone !== null) return (
    <GuestFrame testid="account-join" title="This invitation no longer works">
      <p className={BODY} role="alert">{gone}</p>
      <p className={META}>Already have an account? <Link to="/signin" className={LINK}>Sign in</Link></p>
    </GuestFrame>
  )
  return (
    <GuestFrame testid="account-join" title={about ? `Join ${about.org.name} on Olumi` : 'Join on Olumi'} lead={about ? `${about.by} invited you. You will be a member of ${about.org.name}.` : 'Reading the invitation…'}>
      {about && (
        <form className="grid gap-4" onSubmit={(e) => void submit(e)} noValidate>
          {linked && <p className={BODY} data-testid="account-join-same-person">You are signed in as {linked.name}. Joining adds an email and password to you, and you keep your scenarios.</p>}
          <PersonFields id="join" name={name} setName={setName} email={email} setEmail={setEmail} password={password} setPassword={setPassword} busy={busy} />
          {who.status === 'loading' && <p className={BODY} role="status" data-testid="account-join-checking">Checking who is signed in…</p>}
          {who.status === 'error' && (
            <div className="grid gap-2" data-testid="account-join-who-error">
              <p className={ERR} role="alert">Olumi could not check who is signed in just now, so nothing has been sent. Try again in a moment.</p>
              <div><Button type="button" onClick={retry} data-testid="account-join-who-retry">Try again</Button></div>
            </div>
          )}
          {said && <p role="alert" className={ERR} data-testid="account-join-error">{said}</p>}
          <Button type="submit" disabled={busy || !known || name.trim() === '' || email.trim() === '' || password === ''} data-testid="account-join-go">{busy ? 'Joining…' : `Join ${about.org.name}`}</Button>
        </form>
      )}
    </GuestFrame>
  )
}
