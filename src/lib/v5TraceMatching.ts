/**
 * Shared V5 CEE trace matching — single source of truth.
 *
 * Round-3 + Round-4 review (P1): centralised matching helpers so the
 * selector, fallback payload lookup, latest-turn lookup, failed-record
 * detection, and provenance classification cannot drift.
 *
 * Round-4 review (P1): the V5-endpoint matcher uses a PATH-BOUNDARY
 * check rather than a substring search. Pre-fix `endpoint.includes(
 * '/orchestrate/v2/turn')` would match `/orchestrate/v2/turning` —
 * a forward-compat path that doesn't yet exist but reads as a real
 * V5 turn under substring rules. Now only the exact segment
 * `/orchestrate/v2/turn` followed by `?` / `#` / `/` / EOS is matched.
 */

/**
 * Canonical V5 turn endpoint path segment. Matches both the Netlify
 * proxy (`/bff/orchestrate/v2/turn`) and the direct endpoint
 * (`${VITE_ORCHESTRATOR_BASE}/orchestrate/v2/turn`).
 */
export const V5_TURN_ENDPOINT_PATTERN = '/orchestrate/v2/turn'

/**
 * Path-boundary regex for the V5 turn endpoint pathname. Applied to
 * the URL's PATH ONLY — the query string and fragment are stripped
 * by `extractPathname` before this regex runs. The segment must be
 * followed by `/` (sub-path) or end-of-string. Rejects look-alikes
 * such as `/orchestrate/v2/turning` that would slip past a naive
 * `includes`.
 *
 * Round-5 review (P1): the regex previously also accepted `?` and
 * `#` as boundaries, but with pathname-only matching those
 * characters can no longer appear here — the URL parser already
 * stripped them. Keeping the regex narrow tightens the contract.
 */
const V5_TURN_ENDPOINT_PATHNAME_RE = /\/orchestrate\/v2\/turn(?:\/|$)/

/**
 * Extract the pathname from an endpoint string. Handles three shapes:
 *
 *   - Absolute URL: `https://cee/orchestrate/v2/turn?nonce=abc` →
 *     parses with `URL` and returns `pathname`.
 *   - Path-only with query/fragment: `/orchestrate/v2/turn?abc` →
 *     splits on the first `?` or `#`.
 *   - Plain path: `/orchestrate/v2/turn` → returns verbatim.
 *
 * Round-5 review (P1): pre-fix the V5 regex matched the whole
 * endpoint string, so a query value containing
 * `?next=/orchestrate/v2/turn` would have produced a false match
 * even when the actual path was `/legacy/turn`. By stripping
 * query+fragment FIRST, the regex only sees the real path.
 *
 * Returns `null` when nothing can be extracted (defensive — caller
 * treats null as a non-match).
 */
function extractPathname(endpoint: string): string | null {
  if (endpoint.length === 0) return null
  // Absolute URL — let URL handle parsing (handles `://`, ports,
  // credentials, etc.).
  if (
    endpoint.startsWith('http://') ||
    endpoint.startsWith('https://') ||
    endpoint.startsWith('//')
  ) {
    try {
      const u = new URL(
        endpoint.startsWith('//') ? `https:${endpoint}` : endpoint,
      )
      return u.pathname
    } catch {
      return null
    }
  }
  // Path-only — strip query string and fragment.
  const queryIdx = endpoint.indexOf('?')
  const fragmentIdx = endpoint.indexOf('#')
  const cut =
    queryIdx === -1
      ? fragmentIdx === -1
        ? endpoint.length
        : fragmentIdx
      : fragmentIdx === -1
        ? queryIdx
        : Math.min(queryIdx, fragmentIdx)
  return endpoint.slice(0, cut)
}

/**
 * Case-insensitive CEE service filter. Trace recorders should set
 * `service: 'CEE'` but historical entries / future renaming may use
 * `'cee'` or mixed case — match defensively.
 *
 * Single source of truth for "is this entry on the CEE service".
 * `findBestPayload`, `findLatestV5TurnEntry`, `detectFailedHttpRecord`,
 * the analysis-producing selector, and the provenance classifier
 * all consume this helper so case-sensitivity cannot drift.
 */
export function isCeeService(p: { service?: string }): boolean {
  return (
    typeof p.service === 'string' && p.service.toUpperCase() === 'CEE'
  )
}

/**
 * Case-insensitive service matcher for non-CEE services too.
 * Replaces the strict `p.service === service` check in
 * `findBestPayload`. PLoT/ISL/M2 traces may also drift on casing in
 * future trace recorders; one matcher catches them all.
 */
export function matchServiceCaseInsensitive(
  p: { service?: string },
  service: string,
): boolean {
  return (
    typeof p.service === 'string' &&
    p.service.toUpperCase() === service.toUpperCase()
  )
}

/**
 * V5 turn endpoint scope. Requires:
 *   - CEE service (case-insensitive — see `isCeeService`)
 *   - URL's PATHNAME (with query/fragment stripped) matches
 *     `/orchestrate/v2/turn` at a path boundary
 *
 * Rejects:
 *   - Missing/empty endpoint (defensive default — prefers honesty
 *     to optimism)
 *   - Non-CEE services even on the V5 path (defensive)
 *   - Look-alike paths like `/orchestrate/v2/turning` (round-4 P1)
 *   - Query-string content matching the V5 path, e.g.
 *     `/legacy?next=/orchestrate/v2/turn` (round-5 P1) — the regex
 *     now runs against the pathname only, so query values cannot
 *     impersonate the path.
 *
 * Returns true for canonical V5 paths:
 *   - `/bff/orchestrate/v2/turn`            — Netlify proxy
 *   - `https://cee/orchestrate/v2/turn`     — direct
 *   - `/orchestrate/v2/turn?nonce=abc`      — with query string
 *   - `/orchestrate/v2/turn#fragment`       — with fragment
 *   - `/orchestrate/v2/turn/legacy-sub`     — sub-path (defensive,
 *      accepted on the grounds that any sub-path under the turn
 *      endpoint is still operating in the V5 turn namespace).
 */
export function isV5TurnEndpoint(p: {
  service?: string
  endpoint?: string
}): boolean {
  if (!isCeeService(p)) return false
  if (typeof p.endpoint !== 'string' || p.endpoint.length === 0) {
    return false
  }
  const pathname = extractPathname(p.endpoint)
  if (pathname === null) return false
  return V5_TURN_ENDPOINT_PATHNAME_RE.test(pathname)
}
