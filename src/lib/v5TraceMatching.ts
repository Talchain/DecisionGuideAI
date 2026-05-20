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
 * Path-boundary regex for the V5 turn endpoint. The endpoint segment
 * must be FOLLOWED BY one of: `?` (query string), `#` (fragment),
 * `/` (sub-path), or end-of-string. Rejects look-alike paths such as
 * `/orchestrate/v2/turning` that would slip past a naive `includes`.
 *
 * The leading boundary (start-of-string or `/`) is implicit in the
 * constant — `/orchestrate/v2/turn` always starts with `/`.
 */
const V5_TURN_ENDPOINT_RE = /\/orchestrate\/v2\/turn(?:[?#/]|$)/

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
 *   - endpoint path contains `/orchestrate/v2/turn` AT a path
 *     boundary (next char is `?`, `#`, `/`, or end-of-string)
 *
 * Rejects:
 *   - Missing/empty endpoint (defensive default — prefers honesty
 *     to optimism)
 *   - Non-CEE services even on the V5 path (defensive)
 *   - Look-alike paths like `/orchestrate/v2/turning` (round-4 P1)
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
  return V5_TURN_ENDPOINT_RE.test(p.endpoint)
}
