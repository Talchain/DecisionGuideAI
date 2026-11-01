/**
 * The Team tab's calls to olumi-core, through the one-origin server's `/api` proxy (scripts/olumi-core/server.mjs). The page's
 * own side (lib/tab.js) stamps every `/api/` call with who the page was opened for, the server refuses a write when the browser's
 * private link has since changed, and core refuses a cross-site write itself. Nothing here holds identity.
 *
 * Words the person typed go out exactly as typed (not trimmed, not capitalised, not ended with a full stop); core keeps them
 * as given. A blank field is the one thing refused here, because core refuses it too.
 */
export class TeamApiError extends Error {
  readonly status: number
  /**
   * A write whose outcome is not known: the connection dropped or the server failed after the request may have been processed. It may
   * have been saved. Never worded as "nothing was sent"; the caller reads the scenario again to find out before it offers a second send.
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
export const UNCERTAIN_WRITE = 'The connection dropped before Olumi answered, so this may have been saved. Olumi is being asked what it holds.'
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

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await (fetchImpl ?? fetch)(path, {
      method,
      // Same origin only: the browser then sends `Sec-Fetch-Site: same-origin`, the one value (with `none`) the server and core accept for a write,
      // and the page's own side (lib/tab.js) stamps `x-olumi-person` on every `/api/` call, so a write can never be saved as somebody else.
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

export const teamApi = {
  read: <T>(sid: string) => call<T>('GET', base(sid)),
  giveView: (sid: string, text: string) => call<{ contribution: number }>('POST', `${base(sid)}/views`, { text }),
  skipView: (sid: string) => call<{ contribution: number }>('POST', `${base(sid)}/views`, { skip: true }),
  reveal: (sid: string) => call<{ revealed: number[] }>('POST', `${base(sid)}/reveal`),
  addEvidence: (sid: string, e: EvidenceInput, op: string) =>
    call<{ evidence: number }>('POST', `${base(sid)}/evidence`, { text: e.text, ...(e.source !== null ? { source: e.source } : {}), concerns: e.concerns, stance: e.stance, op }),
  addCommitment: (sid: string, c: CommitmentInput) => call<{ commitment: number }>('POST', `${base(sid)}/commitments`, { action: c.action, owner: c.owner, expect: c.expect, reconsider: c.reconsider, keeps: c.keeps }),
  addOutcome: (sid: string, commitment: number, o: OutcomeInput, op: string) =>
    call<{ outcome: number }>('POST', `${base(sid)}/commitments/${commitment}/outcomes`, { happened: o.happened, versus: o.versus, reconsider_triggered: o.reconsider_triggered, ...(o.note !== null ? { note: o.note } : {}), op }),
}
