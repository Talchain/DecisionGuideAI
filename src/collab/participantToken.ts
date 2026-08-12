/**
 * COLLAB — participant token capture and hygiene (browser side).
 *
 * ── ⚠ WHY THE URL FRAGMENT IS NOT A HIDING PLACE IN THIS APP ──────────────
 * The usual advice — "put the bearer token in the fragment, it is never sent to
 * a server" — is WRONG HERE, and would have shipped a leak that this module's
 * own tests could not have caught, because the leak is outside this module.
 *
 * 1. This app uses a **HashRouter**, so the fragment IS the route. Anything in
 *    it is route state, read and re-read by the router.
 * 2. `src/main.tsx` captures `location.href` into `window.__SAFE_DEBUG__.logs`
 *    at `boot:start`, and persists that array to **localStorage** when
 *    `ENABLE_DEBUG_PERSISTENCE` is on. Other sinks read the same string
 *    (`lib/Build.ts`, `canvas/ErrorBoundary.tsx`, `lib/diagnostic-bundle.ts`,
 *    `pages/sandbox-guide/DiagnosticBanner.tsx`).
 * 3. That capture happens **at boot, before React mounts** — so any
 *    read-once-then-`replaceState` inside a page component runs far too late.
 *
 * ── THE RULE THIS MODULE IMPLEMENTS ───────────────────────────────────────
 * The token is stripped **in the boot path itself, before the first capture**.
 * `captureParticipantTokenFromUrl()` is the FIRST statement of `boot()`, ahead
 * of `log('boot:start', { href: location.href })`. By the time anything reads
 * `location.href`, the token is gone from it.
 *
 * Thereafter the token lives in a module-level variable and NOWHERE else:
 * • never `localStorage` or `sessionStorage` — this is a bearer capability, and
 *   a device that keeps it keeps it after the round closes;
 * • never a cookie — nothing here needs ambient authority;
 * • never a log line, never an error message, never a telemetry payload;
 * • never a query parameter on an outbound request — it travels as a header.
 *
 * The cost is deliberate and worth naming: a hard refresh loses the token and
 * the participant re-opens their link. That is the correct trade for a PoC —
 * persisting it would put a bearer capability on disk to save one click.
 */

/**
 * Accepted spellings, in both the real query string and the hash query.
 *
 * ⭐ THE SINGLE AUTHORITY. Exported because the packet page's link reader
 * (`CODE_IN_LINK` in `ParticipantPacketPage.tsx`) DERIVES its pattern from
 * this list rather than hand-copying it — a hand-copied twin drifted once
 * already (#669 review, N1): a name added here but not there would have
 * REFUSED valid participant links while every suite stayed green. Add a
 * spelling here and every consumer accepts it without another edit.
 */
export const TOKEN_PARAM_NAMES = ['ct', 'collab_token'] as const

/**
 * In-memory only. Module scope, not `window` — nothing enumerating globals
 * (a diagnostic bundle, an error reporter) can find it.
 */
let participantToken: string | null = null

function takeFromSearchString(search: string): { token: string | null; rest: string } {
  if (search === '' || search === '?') return { token: null, rest: '' }
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  let found: string | null = null
  for (const name of TOKEN_PARAM_NAMES) {
    const value = params.get(name)
    if (value !== null && value !== '') {
      found = value
      params.delete(name)
    }
  }
  const remaining = params.toString()
  return { token: found, rest: remaining === '' ? '' : `?${remaining}` }
}

/**
 * Read the participant token out of the URL and REMOVE it from the address bar,
 * synchronously, before anything can capture `location.href`.
 *
 * Handles both shapes, because a link is written by a person:
 *   https://host/?ct=TOKEN#/panel/<round_id>      (real query string)
 *   https://host/#/panel/<round_id>?ct=TOKEN      (hash query — HashRouter)
 *
 * Returns the token so the caller can act on it; callers should NOT log it.
 */
export function captureParticipantTokenFromUrl(): string | null {
  if (typeof window === 'undefined' || typeof location === 'undefined') return null

  try {
    const fromSearch = takeFromSearchString(location.search)

    // The hash may itself carry a query: "#/panel/abc?ct=TOKEN".
    const rawHash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
    const qIndex = rawHash.indexOf('?')
    const hashPath = qIndex === -1 ? rawHash : rawHash.slice(0, qIndex)
    const fromHash =
      qIndex === -1 ? { token: null, rest: '' } : takeFromSearchString(rawHash.slice(qIndex))

    const token = fromSearch.token ?? fromHash.token
    if (token === null) return null

    participantToken = token

    // Rewrite the address bar with the token removed. `replaceState` leaves no
    // history entry, so Back cannot restore a URL containing it.
    const cleanedHash = hashPath === '' ? '' : `#${hashPath}${fromHash.rest}`
    const cleanedUrl = `${location.pathname}${fromSearch.rest}${cleanedHash}`
    history.replaceState(history.state, '', cleanedUrl)

    return token
  } catch {
    // Never break boot over this. A failure here means the token stays in the
    // URL, so callers must treat capture as best-effort — but the page still
    // works, and the participant is not locked out.
    return null
  }
}

/** The captured token, or null. Read at request time; never persisted. */
export function getParticipantToken(): string | null {
  return participantToken
}

/** Test-only: reset module state between cases. */
export function __resetParticipantTokenForTests(): void {
  participantToken = null
}

/**
 * Set the token directly. For the packet page's manual-entry fallback (a
 * participant who copied a link that lost its query string) — NOT for restoring
 * from any store.
 */
export function setParticipantToken(token: string): void {
  participantToken = token.trim() === '' ? null : token.trim()
}

/**
 * Forget the held token so the participant can enter a different one.
 *
 * ⚠ THIS IS UI RECOVERY, NOT A CHANGE TO VERIFICATION. Nothing here decides
 * whether a code is valid — the server does, and it is unchanged. What this
 * closes is a DEAD END measured on deployed build `3a4e3df2`: the packet page
 * showed its code-entry form only while no token was held, so a participant who
 * mistyped their code held a rejected credential with nothing able to drop it.
 * Every retry re-sent the same bad token, and only a full page reload escaped —
 * which the page never suggested. A first-time panellist met a wall.
 *
 * It is also the correct hygiene move on a refusal: a bearer capability the
 * server has just declined has no reason to stay in memory.
 */
export function clearParticipantToken(): void {
  participantToken = null
}
