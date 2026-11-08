import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, NavLink, useNavigate } from 'react-router-dom'
import { typography } from '../../styles/typography'
import { NOTICES } from '../notices'
import { signOutOfOlumi } from '../signout'
import { TeamApiError } from '../team/api'
import { accountsApi, type Account, type Person } from './api'

/**
 * The frames the PoC account pages share: a centred card for signing in, signing up and joining, and a page with the account
 * navigation (My scenarios, Organisation, Account, Sign out) for a signed-in person. Colours and type are the DS tokens only.
 */
export const FIELD = `w-full min-h-[40px] rounded-md border border-panel-border bg-panel px-3 py-2 ${typography.bodySmall} text-text-body placeholder:text-text-light focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50 disabled:opacity-50`
export const SELECT = `min-h-[36px] min-w-[120px] rounded-md border border-panel-border bg-panel px-2 py-1 ${typography.bodySmall} text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50 disabled:opacity-50`
export const LABEL = `${typography.label} text-text-header block mb-1`
export const META = `${typography.caption} text-text-light m-0`
export const BODY = `${typography.bodySmall} text-text-body m-0`
export const ERR = `${typography.bodySmall} text-danger m-0`
export const CARD = 'rounded-[14px] border border-panel-border bg-panel p-5'
export const LINK = 'text-info underline underline-offset-2 hover:no-underline'

export type Who = { status: 'loading' } | { status: 'out' } | { status: 'in'; me: Person; account: Account | null } | { status: 'error'; message: string }
/** Who this browser is signed in as, read from core (`GET /api/me`), with their account when they have one. */
export function useWho(): Who {
  const [who, setWho] = useState<Who>({ status: 'loading' })
  useEffect(() => {
    let live = true
    accountsApi.whoami().then(
      (r) => { if (live) setWho(r?.me ? { status: 'in', me: r.me, account: r.account ?? null } : { status: 'out' }) },
      (e) => { if (live) setWho({ status: 'error', message: e instanceof TeamApiError ? e.message : 'Olumi could not be read just now. Try again in a moment.' }) },
    )
    return () => { live = false }
  }, [])
  return who
}

export function Notices(): JSX.Element {
  return (
    <nav aria-label="Notices" className={`${typography.caption} flex justify-center gap-4 text-text-light`}>
      {NOTICES.map(({ label, href }) => <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">{label}</a>)}
    </nav>
  )
}

/** Signing in, signing up, joining: one card in the middle of the page. */
export function GuestFrame({ title, lead, children, testid }: { title: string; lead?: ReactNode; children: ReactNode; testid: string }): JSX.Element {
  return (
    <main data-testid={testid} className="min-h-screen bg-canvas flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-[420px] grid gap-6">
        <p className={`${typography.h5} text-text-header m-0 text-center`}>Olumi</p>
        <section className={`${CARD} grid gap-4`}>
          <div className="grid gap-1">
            <h1 className={`${typography.h4} text-text-header m-0`}>{title}</h1>
            {lead && <div className={BODY}>{lead}</div>}
          </div>
          {children}
        </section>
        <Notices />
      </div>
    </main>
  )
}

const tab = ({ isActive }: { isActive: boolean }) =>
  `${typography.label} rounded-full px-3 py-1.5 transition-colors ${isActive ? 'bg-panel text-text-header border border-panel-border' : 'text-text-body hover:text-text-header border border-transparent'}`

/** A signed-in page: the account navigation, then the page. Signed out, it goes to sign in. */
export function SignedInFrame({ who, title, action, children, testid }: { who: Who; title: string; action?: ReactNode; children: (w: Extract<Who, { status: 'in' }>) => ReactNode; testid: string }): JSX.Element {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState<string | null>(null)
  if (who.status === 'out') return <Navigate to="/signin" replace />
  const signOut = async () => {
    setLeaving(null)
    try { await signOutOfOlumi(); navigate('/signin', { replace: true }) } catch (e) { setLeaving(e instanceof TeamApiError ? e.message : 'That did not go through. You are still signed in.') }
  }
  return (
    <main data-testid={testid} className="min-h-screen bg-canvas">
      <header className="border-b border-panel-border bg-canvas">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center gap-3 px-6 py-3">
          <span className={`${typography.h5} text-text-header`}>Olumi</span>
          <nav aria-label="Account" className="flex flex-wrap gap-1">
            <NavLink to="/" end className={tab}>My scenarios</NavLink>
            <NavLink to="/organisation" className={tab}>Organisation</NavLink>
            <NavLink to="/account" className={tab}>Account</NavLink>
          </nav>
          <span className="flex-1" />
          {who.status === 'in' && <span className={`${typography.bodySmall} text-text-body`} data-testid="account-who">{who.me.name}</span>}
          <button type="button" onClick={() => void signOut()} className={`${typography.label} text-text-body underline underline-offset-2 hover:no-underline`} data-testid="account-signout">Sign out</button>
        </div>
      </header>
      <div className="mx-auto grid max-w-[960px] gap-5 px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={`${typography.h3} text-text-header m-0 flex-1`}>{title}</h1>
          {who.status === 'in' && action}
        </div>
        {leaving && <p role="alert" className={ERR}>{leaving}</p>}
        {who.status === 'loading' && <p className={BODY}>Loading…</p>}
        {who.status === 'error' && <p role="alert" className={ERR}>{who.message}</p>}
        {who.status === 'in' && children(who)}
      </div>
    </main>
  )
}
