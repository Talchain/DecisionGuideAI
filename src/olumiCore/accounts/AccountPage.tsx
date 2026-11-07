import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { typography } from '../../styles/typography'
import { useMe } from '../me'
import { TeamApiError } from '../team/api'
import { accountsApi } from './api'
import { BODY, CARD, ERR, FIELD, LABEL, LINK, META, SignedInFrame, useWho } from './Frame'

const said = (e: unknown, otherwise: string) => (e instanceof TeamApiError ? e.message : otherwise)

/** THE ACCOUNT PAGE (core `/api/account*`): the person's name, their email and organisation, and a new password. */
export default function AccountPage(): JSX.Element {
  const who = useWho()
  const [name, setName] = useState('')
  const [named, setNamed] = useState<string | null>(null)
  const [nameSaid, setNameSaid] = useState<string | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [pwSaid, setPwSaid] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const known = who.status === 'in' ? who.me.name : null
  useEffect(() => { if (known !== null) setName((n) => n || known) }, [known])
  const rename = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setNameSaid(null)
    try {
      const r = await accountsApi.rename(name)
      setNamed(r.name)
      const me = useMe.getState().me
      if (me) useMe.setState({ me: { ...me, name: r.name } })
    } catch (x) { setNameSaid(said(x, 'That did not go through. Nothing was saved.')) } finally { setBusy(false) }
  }
  const change = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setPwSaid(null)
    try {
      const r = await accountsApi.changePassword(current, next)
      setCurrent(''); setNext('')
      const elsewhere = r.signed_out_elsewhere
      setPwSaid({ ok: true, text: `Password changed.${elsewhere > 0 ? ` Signed out of ${elsewhere === 1 ? 'one other browser' : `${elsewhere} other browsers`}.` : ''}` })
    } catch (x) { setPwSaid({ ok: false, text: said(x, 'That did not go through. Your password is unchanged.') }) } finally { setBusy(false) }
  }
  return (
    <SignedInFrame who={who} title="Your account" testid="account-page">
      {(w) => !w.account ? (
        <p className={`${CARD} ${BODY}`} data-testid="account-no-account">
          You are signed in as <b>{w.me.name}</b> with a private link. <Link to="/signup" className={LINK}>Add an email and password</Link> to sign in from any browser.
        </p>
      ) : (
        <>
          <form className={`${CARD} grid gap-3`} onSubmit={(e) => void rename(e)} aria-label="Your name">
            <h2 className={`${typography.h5} text-text-header m-0`}>Your name</h2>
            <div>
              <label htmlFor="account-name" className={LABEL}>Name, as your colleagues see it</label>
              <input id="account-name" autoComplete="name" className={FIELD} value={name} onChange={(e) => { setName(e.target.value); setNamed(null) }} disabled={busy} data-testid="account-name" />
            </div>
            {nameSaid && <p role="alert" className={ERR}>{nameSaid}</p>}
            {named && <p role="status" className={META} data-testid="account-name-saved">Saved. Your colleagues now see {named}.</p>}
            <div><Button type="submit" disabled={busy || name.trim() === '' || name.trim() === (named ?? w.me.name)} data-testid="account-name-go">Save name</Button></div>
          </form>
          <section className={`${CARD} grid gap-1`} aria-label="Sign-in">
            <h2 className={`${typography.h5} text-text-header m-0`}>Sign-in</h2>
            <p className={BODY}>Email: <span data-testid="account-email">{w.account.email}</span></p>
            <p className={BODY}>Organisation: <Link to="/organisation" className={LINK}>{w.account.org.name}</Link> ({w.account.org.role === 'owner' ? 'owner' : 'member'})</p>
          </section>
          <form className={`${CARD} grid gap-3`} onSubmit={(e) => void change(e)} aria-label="Change password">
            <h2 className={`${typography.h5} text-text-header m-0`}>Change password</h2>
            <div>
              <label htmlFor="account-current" className={LABEL}>Current password</label>
              <input id="account-current" type="password" autoComplete="current-password" className={FIELD} value={current} onChange={(e) => setCurrent(e.target.value)} disabled={busy} />
            </div>
            <div>
              <label htmlFor="account-next" className={LABEL}>New password</label>
              <input id="account-next" type="password" autoComplete="new-password" className={FIELD} value={next} onChange={(e) => setNext(e.target.value)} disabled={busy} />
              <p className={`${META} mt-1`}>At least 8 characters. Your other browsers are signed out; this one stays signed in.</p>
            </div>
            {pwSaid && <p role={pwSaid.ok ? 'status' : 'alert'} className={pwSaid.ok ? META : ERR} data-testid="account-password-said">{pwSaid.text}</p>}
            <div><Button type="submit" disabled={busy || current === '' || next === ''} data-testid="account-password-go">Change password</Button></div>
          </form>
        </>
      )}
    </SignedInFrame>
  )
}
