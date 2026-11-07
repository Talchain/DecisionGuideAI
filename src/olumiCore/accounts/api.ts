/**
 * PoC accounts on the olumi-core lane (core `src/app/accounts.ts`; routes `/api/account/*` and `/api/org/*`): sign up, sign in, the
 * organisation, the account page and My scenarios. Every call goes through the lane's one `call` (same origin, the browser's cookie,
 * core's own words on a refusal). A password sign-in sets the same `olumi` cookie a private link sets, so after one the page loads
 * afresh at home (`nav.landSignedIn`), and everything on it is read as the person now signed in.
 */
import { call } from '../team/api'

export type Role = 'owner' | 'member'
export interface Person { readonly id: string; readonly name: string }
export interface Account { readonly email: string; readonly org: { readonly id: string; readonly name: string; readonly role: Role } }
/** One scenario this person can open, as core lists it: `open` is its address, `version` the saved model's number (null: none yet). */
export interface MyScenario {
  readonly id: string; readonly title: string; readonly label: string; readonly open: string; readonly version: number | null
  readonly last_activity: string; readonly your_last: string | null; readonly members: readonly Person[]
}
export interface OrgMember { readonly id: string; readonly name: string; readonly role: Role; readonly joined: string; readonly email?: string }
export interface Org { readonly org: { readonly id: string; readonly name: string }; readonly you: { readonly id: string; readonly role: Role }; readonly members: readonly OrgMember[] }
export interface OrgInvite { readonly id: string; readonly by: string; readonly made: string; readonly expires: string; readonly status: 'live' | 'used' | 'ended' | 'expired'; readonly joined: string | null }
export interface SignedIn { readonly me: Person; readonly account: Account }

export const accountsApi = {
  whoami: () => call<{ me: Person | null; account?: Account | null }>('GET', '/api/me'),
  signIn: (email: string, password: string) => call<SignedIn>('POST', '/api/account/signin', { email, password }),
  /** `attach`: add the email and password to the person this browser's private link signed in, keeping their scenarios. */
  signUp: (b: { name: string; email: string; password: string; org?: string; attach?: boolean }) => call<SignedIn>('POST', '/api/account/signup', b),
  joinPreview: (token: string) => call<{ org: { name: string }; by: string; expires: string }>('GET', `/api/org/join/${encodeURIComponent(token)}`),
  join: (b: { token: string; name: string; email: string; password: string; attach?: boolean }) => call<SignedIn>('POST', '/api/org/join', b),
  scenarios: () => call<{ scenarios: MyScenario[] }>('GET', '/api/account/scenarios'),
  org: () => call<Org>('GET', '/api/org'),
  invites: () => call<{ invites: OrgInvite[] }>('GET', '/api/org/invites'),
  invite: () => call<{ id: string; link: string; expires: string }>('POST', '/api/org/invites', {}),
  endInvite: (id: string) => call<{ ended: string }>('POST', `/api/org/invites/${encodeURIComponent(id)}/end`, {}),
  remove: (id: string) => call<{ removed: string }>('POST', `/api/org/members/${encodeURIComponent(id)}/remove`, {}),
  setRole: (id: string, role: Role) => call<{ id: string; role: Role }>('POST', `/api/org/members/${encodeURIComponent(id)}/role`, { role }),
  rename: (name: string) => call<{ name: string }>('POST', '/api/account/name', { name }),
  changePassword: (current: string, next: string) => call<{ changed: true; signed_out_elsewhere: number }>('POST', '/api/account/password', { current, next }),
}

/** After a sign-in, sign-up or join: a full load of home (no fragment, so the browser loads the page again), read as the new person. */
export const nav = { landSignedIn: (): void => { window.location.assign('/') } }

/** A time as a person reads it here: "7 Nov, 14:02". */
export function whenOf(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
