/**
 * The lane's calls to olumi-core's own routes, on the origin that serves this page (core serves DGAI's build itself, src/server/ui.ts in
 * core), with the browser's private-link cookie. Core refuses a cross-site write itself. Nothing here holds identity (`../me.ts` does).
 *
 * Words the person typed go out exactly as typed (not trimmed, not capitalised, not ended with a full stop); core keeps them
 * as given. A blank field is the one thing refused here, because core refuses it too.
 */
export class TeamApiError extends Error {
  readonly status: number
  /**
   * A write whose outcome is not known: the connection dropped or the server failed after the request may have been processed. It may
   * have been saved. Never worded as "nothing was sent", and never settled by a later read: `writes.ts` sends the same request again with the same op id, or locks the write.
   */
  readonly uncertain: boolean
  constructor(status: number, message: string, uncertain = false) {
    super(message)
    this.name = 'TeamApiError'
    this.status = status
    this.uncertain = uncertain
  }
}

type Fetch = typeof fetch
let fetchImpl: Fetch | null = null
/** For specs only. */
export function setTeamFetch(f: Fetch | null): void { fetchImpl = f }

export const READ_FAILED = 'Olumi could not be read just now. Try again in a moment.'
/** A write whose answer never came back: it may have been saved. */
export const UNCERTAIN_WRITE = 'The connection dropped before Olumi answered, so this may have been saved.'
const WORDS: Readonly<Record<number, string>> = {
  401: 'Open your private link to continue. This browser is not signed in to Olumi, or your link has expired.',
  404: 'That scenario is not available to you. Open it from your own private link.',
  413: 'That is too long for Olumi to take. Shorten it and send it again.',
}

/** A retry-safe id for a write core can de-duplicate (8 to 64 letters, digits and hyphens). */
export function newOp(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return c?.randomUUID ? c.randomUUID() : `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** What the page says when the browser now holds another person's private link than the one this page was opened for. */
export const NOT_FOR_THIS_PAGE = 'This page was opened with a different private link from the one this browser holds now, so nothing is shown or saved here. Reload this page to continue as the person whose private link is open now.'

/** The member this page was opened for, once core has said (`../me.ts`); null before. */
let pagePerson: string | null = null
export function setPagePerson(id: string | null): void { pagePerson = id }

/**
 * A write is saved as whoever holds the browser's cookie NOW, and another tab may have opened someone else's private link since this
 * page was opened (review 00002 #1). So before every write core is asked whose link it is; a different person's is refused here, and
 * nothing is sent. With no person known yet, the first one core names is the page's.
 */
async function stillThisPerson(): Promise<void> {
  const now = await call<{ me?: { id?: unknown } | null }>('GET', '/api/me')
  const id = typeof now?.me?.id === 'string' ? now.me.id : null
  // The page's first answer failed (`me.ts`): this one is the page's person from now on, so a later switch is still caught (review 00003).
  if (pagePerson === null) { pagePerson = id; return }
  if (id !== pagePerson) throw new TeamApiError(409, NOT_FOR_THIS_PAGE)
}

export async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (method === 'POST') await stillThisPerson()
  let res: Response
  try {
    res = await (fetchImpl ?? fetch)(path, {
      method,
      // Same origin only: the browser then sends `Sec-Fetch-Site: same-origin`, the one value (with `none`) core accepts for a write.
      credentials: 'same-origin',
      mode: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // Not reaching Olumi at all is not the same as not being heard: a request that left may have been saved before the answer was lost.
    throw method === 'GET' ? new TeamApiError(0, READ_FAILED) : new TeamApiError(0, UNCERTAIN_WRITE, true)
  }
  let json: unknown = {}
  let readable = true
  try { json = await res.json() } catch { json = {}; readable = false }
  if (!res.ok) {
    const said = (json as { error?: unknown } | null)?.error
    // The person's own words from core (a 400/409 says what to change); a fixed sentence when core gave none or the server failed.
    const message = res.status >= 500 ? (typeof said === 'string' ? said : 'Olumi could not do that this time. Try again in a moment.')
      : typeof said === 'string' && said !== '' ? said : WORDS[res.status] ?? 'That did not go through. Nothing was saved.'
    // A server failure on a write may have come after the save.
    throw new TeamApiError(res.status, message, method === 'POST' && res.status >= 500)
  }
  // A read whose body did not arrive whole is a failed read, never an empty scenario. (A write that was answered 2xx was saved, whatever its body.)
  if (method === 'GET' && !readable) throw new TeamApiError(0, READ_FAILED)
  return json as T
}

const base = (sid: string) => `/api/scenarios/${encodeURIComponent(sid)}`

export interface EvidenceInput { readonly text: string; readonly source: string | null; readonly concerns: readonly string[]; readonly stance: 'supports' | 'challenges' | 'unclear' }
export interface CommitmentInput { readonly action: string; readonly owner: string; readonly expect: string; readonly reconsider: string; readonly keeps: readonly string[] }
export interface OutcomeInput { readonly happened: string; readonly versus: string; readonly reconsider_triggered: boolean; readonly note: string | null }

/** A colleague a member invited into the scenario (API v1.8), as core lists them; never their link. */
export interface Invite { readonly id: string; readonly name: string; readonly by: string; readonly made: string; readonly expires: string | null; readonly status: string; readonly revocable: boolean }

export const teamApi = {
  giveView: (sid: string, text: string) => call<{ contribution: number }>('POST', `${base(sid)}/views`, { text }),
  skipView: (sid: string) => call<{ contribution: number }>('POST', `${base(sid)}/views`, { skip: true }),
  reveal: (sid: string) => call<{ revealed: number[] }>('POST', `${base(sid)}/reveal`),
  /** One's own view shown to the team before the round's reveal (olumi-core, github-3c: `POST …/views/:id/reveal`; no AI call). */
  shareView: (sid: string, id: number) => call<{ revealed: number[] }>('POST', `${base(sid)}/views/${id}/reveal`),
  addEvidence: (sid: string, e: EvidenceInput, op: string) =>
    call<{ evidence: number }>('POST', `${base(sid)}/evidence`, { text: e.text, ...(e.source !== null ? { source: e.source } : {}), concerns: e.concerns, stance: e.stance, op }),
  /** Olumi considers shared evidence (API v1.12): one turn in the asker's name; core proposes a change where it warrants one, else says why not. */
  considerEvidence: (sid: string, evidence: number, op: string) =>
    call<{ proposal: number | null; discussion: boolean }>('POST', `${base(sid)}/evidence/${evidence}/consider`, { op }),
  addCommitment: (sid: string, c: CommitmentInput) => call<{ commitment: number }>('POST', `${base(sid)}/commitments`, { action: c.action, owner: c.owner, expect: c.expect, reconsider: c.reconsider, keeps: c.keeps }),
  /** A colleague's own private link (API v1.8): in this one answer and never again. */
  invite: (sid: string, name: string) => call<{ id: string; link: string }>('POST', `${base(sid)}/invites`, { name }),
  invites: (sid: string) => call<{ invites: Invite[] }>('GET', `${base(sid)}/invites`),
  revokeInvite: (sid: string, id: string) => call<{ revoked: unknown }>('POST', `${base(sid)}/invites/${encodeURIComponent(id)}/revoke`, {}),
  addOutcome: (sid: string, commitment: number, o: OutcomeInput, op: string) =>
    call<{ outcome: number }>('POST', `${base(sid)}/commitments/${commitment}/outcomes`, { happened: o.happened, versus: o.versus, reconsider_triggered: o.reconsider_triggered, ...(o.note !== null ? { note: o.note } : {}), op }),
}
