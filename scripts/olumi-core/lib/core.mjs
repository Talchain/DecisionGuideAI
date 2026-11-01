/**
 * The olumi-core client, as ONE person: every call carries the cookie the browser itself sent, so this server holds no identity.
 * Failures are thrown as `CoreError` and turned into words for the person in one place (`errorTurn`), never swallowed.
 */
export class CoreError extends Error {
  constructor(status, message, { retryAfter = null, op = null } = {}) {
    super(message)
    this.name = 'CoreError'
    this.status = status
    this.retryAfter = retryAfter
    this.op = op
  }
}

const PAID = /^\/api\/(scenarios$|scenarios\/s_[0-9a-f]+\/(messages|edit|challenge)$)/

export function makeCore({ base, fetchImpl = fetch, paidTimeoutMs = 11 * 60_000, timeoutMs = 30_000 }) {
  /** `token` is the browser's own `olumi` cookie value (null: no identity, core answers 401). */
  return async function core(method, path, { token = null, body } = {}) {
    let res
    try {
      res = await fetchImpl(base + path, {
        method,
        headers: { ...(token ? { cookie: `olumi=${encodeURIComponent(token)}` } : {}), 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
        signal: AbortSignal.timeout(method === 'POST' && PAID.test(path) ? paidTimeoutMs : timeoutMs),
      })
    } catch (e) {
      throw new CoreError(0, 'olumi-core is not reachable', { op: String(e?.cause?.code ?? e?.name ?? 'fetch') })
    }
    const text = await res.text()
    let json = {}
    try { json = text ? JSON.parse(text) : {} } catch { json = {} }
    if (!res.ok) throw new CoreError(res.status, typeof json.error === 'string' ? json.error : `olumi-core answered ${res.status}`, { retryAfter: res.headers.get('retry-after') })
    return json
  }
}

/**
 * What the person is told, and what DGAI's failure path reads (`coreTurnErrorBody`): a code, words, whether sending the
 * same thing again is safe, and that nothing was saved (every olumi-core failure is all-or-nothing).
 * 401 sends them to their private link; 409 says what moved; 429 says when to come back; 5xx and an unreachable core are a
 * visible failure, never a silent wait.
 */
export function errorTurn(turnId, e) {
  const status = e instanceof CoreError ? e.status : 500
  const make = (code, message, retry_safe) => ({ turn_id: turnId ?? null, assistant_text: '', model: null, cards: [], notes: [], run: null, receipts: [], error: { code, message, retry_safe, nothing_saved: true } })
  if (status === 401 || status === 403) return make('unauthorised', 'Open your private link to continue. This browser is not signed in to Olumi, or your link has expired.', false)
  if (status === 404) return make('not_found', 'That scenario is not available to you. Open it from your own private link.', false)
  if (status === 409) return make('revision_conflict', `${e.message.charAt(0).toUpperCase()}${e.message.slice(1)}${/[.!?]$/.test(e.message) ? '' : '.'} Nothing was saved.`, true)
  if (status === 429) return make('rate_limited', e.message, true)
  if (status === 400) return make('bad_request', e.message, false)
  if (status === 413) return make('too_long', 'That is too long for Olumi to take in one go. Shorten it and send it again.', false)
  if (status === 0) return make('olumi_unreachable', 'Olumi cannot be reached right now. Nothing was saved. Try again in a moment.', true)
  return make('olumi_core_error', 'Olumi could not finish that this time, and nothing was saved. Please try again in a moment.', true)
}
