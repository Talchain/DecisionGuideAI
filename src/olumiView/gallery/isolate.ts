/**
 * THE VIEW GALLERY'S ISOLATION (DL 15:53Z, plan v3). The gallery draws a saved View through the real scenario page with no engine and no
 * AI. This module stands where the engine would: every request the page makes is answered from the one saved View, refused, or listed.
 * It imports nothing, so it can be in place before any other module of the app is loaded (./boot.ts).
 *
 *  - a read the saved View can answer (`/api/me`, the scenario's own View): answered from it;
 *  - any other read under `/api/`: 404, listed under `unanswered` (a saved View is one document; the page's other reads are not in it);
 *  - every write: refused in words, listed under `refused`. The status is 405: to the app a 5xx on a write means "may have been saved"
 *    and a 409 means "this step has gone stale" (it hides the step); 405 is read as a plain refusal and its words are shown;
 *  - anything else (another origin, another path, a socket, a beacon): refused and listed under `refused`;
 *  - whatever the page's own policy blocks (view-gallery.html: a script, frame or connection from elsewhere): listed under `refused`.
 * Not seen here: a `/bff/` request, which the app's own guard (src/olumiCore/bffGuard.ts) answers 404 before it reaches this module. It
 * still never leaves the page.
 */
export const GALLERY_MARK = 'olumi-view-gallery/1'
export const READ_ONLY = 'The gallery is read-only: nothing is sent or saved.'
export const NOT_SAVED_HERE = 'Not in this saved View.'

export type Held = { readonly method: string; readonly url: string; readonly why: 'write' | 'not in this saved View' | 'unexpected' | 'outside' }
export type GalleryState = { readonly mark: string; readonly fixture: string; readonly refused: Held[]; readonly unanswered: Held[] }
/** What the saved View can answer: the body for a read, or undefined where it holds none. */
export type Answer = (path: string) => unknown | undefined
export type Decision =
  | { readonly kind: 'answer'; readonly status: number; readonly body: unknown; readonly list?: 'refused' | 'unanswered'; readonly why?: Held['why'] }
  | { readonly kind: 'fail'; readonly why: Held['why'] }

/** Reads the app makes at boot that are not the engine's and need no answer: the build's own version file. */
const QUIET = new Set(['/version.json'])

/** The saved View's own answers: who the page is for, and the scenario's View (whatever the query asks to open). */
export function answerOf(view: { readonly id: string; readonly you?: unknown; readonly you_id?: unknown }): Answer {
  const me = typeof view.you_id === 'string' && typeof view.you === 'string' ? { id: view.you_id, name: view.you } : null
  return (path) => (path === '/api/me' ? { me } : path === `/api/scenarios/${view.id}/view` ? view : undefined)
}

/** One request, decided. Pure: the same rule for `fetch` and for the tests. */
export function decide(method: string, url: URL, origin: string, answer: Answer): Decision {
  if (url.origin !== origin) return { kind: 'fail', why: 'outside' }
  const read = method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD'
  if (!read) return { kind: 'answer', status: 405, body: { error: READ_ONLY }, list: 'refused', why: 'write' }
  if (QUIET.has(url.pathname)) return { kind: 'answer', status: 404, body: { error: NOT_SAVED_HERE } }
  if (!url.pathname.startsWith('/api/')) return { kind: 'answer', status: 404, body: { error: NOT_SAVED_HERE }, list: 'refused', why: 'unexpected' }
  const body = answer(url.pathname)
  return body === undefined
    ? { kind: 'answer', status: 404, body: { error: NOT_SAVED_HERE }, list: 'unanswered', why: 'not in this saved View' }
    : { kind: 'answer', status: 200, body }
}

type Win = Window & typeof globalThis & { __gallery?: GalleryState }

/** Puts the isolation in place on this page and returns the lists it keeps (also at `window.__gallery`, for the gallery's own list page). */
export function isolate(win: Win, fixture: string, answer: Answer): GalleryState {
  const state: GalleryState = { mark: GALLERY_MARK, fixture, refused: [], unanswered: [] }
  win.__gallery = state
  const origin = win.location.origin
  const hold = (list: 'refused' | 'unanswered', method: string, url: string, why: Held['why']) => { state[list].push({ method, url, why }) }
  win.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = typeof input === 'object' && 'url' in input ? input : null
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
    const url = new URL(request !== null ? request.url : String(input), win.location.href)
    const d = decide(method, url, origin, answer)
    const shown = url.origin === origin ? url.pathname + url.search : url.origin
    if (d.kind === 'fail') { hold('refused', method, shown, d.why); return Promise.reject(new TypeError('Refused by the view gallery.')) }
    if (d.list !== undefined && d.why !== undefined) hold(d.list, method, shown, d.why)
    return Promise.resolve(new Response(method === 'HEAD' ? null : JSON.stringify(d.body), { status: d.status, headers: { 'content-type': 'application/json' } }))
  }
  // Every other way out of the page is refused and listed: the app's scenario page uses none of them.
  const refuse = (what: string) => function Refused(this: unknown, url?: unknown): never {
    hold('refused', what, String(url ?? ''), 'unexpected')
    throw new Error('Refused by the view gallery.')
  }
  const w = win as unknown as Record<string, unknown>
  w.WebSocket = refuse('WebSocket'); w.EventSource = refuse('EventSource')
  win.XMLHttpRequest.prototype.open = function (method: string, url: string | URL): never {
    hold('refused', `XHR ${method}`, String(url), 'unexpected')
    throw new Error('Refused by the view gallery.')
  }
  win.navigator.sendBeacon = (url: string | URL) => { hold('refused', 'beacon', String(url), 'unexpected'); return false }
  win.addEventListener?.('securitypolicyviolation', (e: SecurityPolicyViolationEvent) => { hold('refused', `page policy ${e.effectiveDirective}`, e.blockedURI, 'outside') })
  return state
}
