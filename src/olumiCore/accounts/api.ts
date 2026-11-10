/**
 * PoC accounts on the olumi-core lane (core `src/app/accounts.ts`; routes `/api/account/*` and `/api/org/*`): sign up, sign in, the
 * organisation, the account page and My scenarios. Every call goes through the lane's one `call` (same origin, the browser's cookie,
 * core's own words on a refusal). A password sign-in sets the same `olumi` cookie a private link sets, so after one the page loads
 * afresh at home (`nav.landSignedIn`), and everything on it is read as the person now signed in.
 */
import { call, TeamApiError } from '../team/api'

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
  /** `archived`: the ones this person put away (core 2026-11-10; absent from an older core, read as none). */
  scenarios: () => call<{ you_id?: string; scenarios: MyScenario[]; archived?: MyScenario[] }>('GET', '/api/account/scenarios'),
  /** Put a scenario away in this person's list, or bring it back. Theirs only: everyone else on it still sees it. */
  archive: (id: string, archived: boolean) => call<{ id: string; archived: boolean }>('POST', `/api/account/scenarios/${encodeURIComponent(id)}/archive`, { archived }),
  org: () => call<Org>('GET', '/api/org'),
  invites: () => call<{ you_id?: string; invites: OrgInvite[] }>('GET', '/api/org/invites'),
  invite: () => call<{ id: string; link: string; expires: string }>('POST', '/api/org/invites', {}),
  endInvite: (id: string) => call<{ ended: string }>('POST', `/api/org/invites/${encodeURIComponent(id)}/end`, {}),
  remove: (id: string) => call<{ removed: string }>('POST', `/api/org/members/${encodeURIComponent(id)}/remove`, {}),
  setRole: (id: string, role: Role) => call<{ id: string; role: Role }>('POST', `/api/org/members/${encodeURIComponent(id)}/role`, { role }),
  rename: (name: string) => call<{ name: string }>('POST', '/api/account/name', { name }),
  changePassword: (current: string, next: string) => call<{ changed: true; signed_out_elsewhere: number }>('POST', '/api/account/password', { current, next }),
}

/** Said when a read names someone other than the person this page was opened for (another tab signed this browser in as them). */
export const SWITCHED = 'This browser is now signed in as someone else, so nothing of theirs is shown here. Reload this page to continue as the person signed in now.'
/**
 * A read is shown only when it names the person this page was opened for: core's `you_id` on a list, `you.id` on the organisation. An
 * answer for anyone else, or one that names no one, is dropped and said, never shown (Codex integrated review, 7 Nov: a read accepted
 * without checking page identity after a cookie switch; the View's `isForThisPage` is the same rule).
 */
export function mine<T>(read: T, named: unknown, page: string): T {
  if (typeof named !== 'string' || named !== page) throw new TeamApiError(409, SWITCHED)
  return read
}

/** After a sign-in, sign-up or join: a full load of home (no fragment, so the browser loads the page again), read as the new person. */
export const nav = { landSignedIn: (): void => { window.location.assign('/') } }

/** A time as a person reads it here: "7 Nov, 14:02". */
export function whenOf(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
