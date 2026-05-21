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
 * V5 turn under substring rules.
 *
 * Round-5 review (P1): the regex now runs against the URL's
 * PATHNAME ONLY — query string and fragment are stripped first via
 * `extractPathname` so paths like `/legacy?next=/orchestrate/v2/turn`
 * cannot impersonate the V5 endpoint. The only accepted boundary
 * is `/` (sub-path) or end-of-string. `?` and `#` cannot appear in
 * the pathname (they're already stripped) — the comment on the
 * regex constant has been tightened accordingly.
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
 * Path-boundary regex for the V5 CEE proxy turn endpoint pathname
 * (`/proxy/v5/turn`). Applied to the URL's PATH ONLY (post
 * `extractPathname` stripping). Same path-boundary contract as
 * `V5_TURN_ENDPOINT_PATHNAME_RE` — followed by `/` or end-of-string,
 * so look-alikes like `/proxy/v5/turning` cannot impersonate the
 * endpoint.
 *
 * The staging Netlify dashboard inlines
 * `VITE_V5_ENDPOINT="https://cee-staging.onrender.com/proxy/v5/turn"`,
 * so `callV5Turn` (`src/v5/v5Adapter.ts`) records traces with that
 * pathname. This regex lets `isV5TurnEndpoint` recognise those
 * traces alongside the canonical `/orchestrate/v2/turn` variant.
 *
 * Mirrors `PROXY_V5_TURN_RE` in `src/lib/contract-validators.ts`
 * (the classifier-side boundary check) so the two layers cannot
 * drift on what counts as a V5 turn.
 */
const V5_TURN_PROXY_PATHNAME_RE = /\/proxy\/v5\/turn(?:\/|$)/

/**
 * Canonical V5 CEE proxy turn endpoint path segment (string form).
 * Mirrors `V5_TURN_ENDPOINT_PATTERN`'s role for the canonical path
 * — provided as a sibling constant for any consumer that wants the
 * literal pathname rather than the regex.
 */
export const V5_TURN_PROXY_ENDPOINT_PATTERN = '/proxy/v5/turn'

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
export function extractPathname(endpoint: string): string | null {
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
 *   - URL's PATHNAME (with query/fragment stripped) matches EITHER:
 *     - `/orchestrate/v2/turn` — canonical V5 turn endpoint
 *     - `/proxy/v5/turn`       — staging proxy variant (set via
 *                                 `VITE_V5_ENDPOINT` in the Netlify
 *                                 dashboard); see `PROXY_V5_TURN_RE`
 *                                 in `contract-validators.ts` for the
 *                                 mirrored classifier-side gate.
 *   - Match is at a path boundary (`/` sub-path or end-of-string)
 *
 * Rejects:
 *   - Missing/empty endpoint (defensive default — prefers honesty
 *     to optimism)
 *   - Non-CEE services even on the V5 path (defensive)
 *   - Look-alike paths like `/orchestrate/v2/turning`,
 *     `/proxy/v5/turning` (round-4 P1 — path boundary)
 *   - Query-string content matching the V5 path, e.g.
 *     `/legacy?next=/orchestrate/v2/turn` (round-5 P1) — the regex
 *     runs against the pathname only, so query values cannot
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
 *
 * And for the V5 proxy variant:
 *   - `https://cee-staging.onrender.com/proxy/v5/turn` — staging
 *   - `/proxy/v5/turn?nonce=abc`            — with query string
 *   - `/proxy/v5/turn#fragment`             — with fragment
 *   - `/proxy/v5/turn/legacy-sub`           — sub-path (same
 *      defensive rationale as canonical sub-paths above)
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
  return (
    V5_TURN_ENDPOINT_PATHNAME_RE.test(pathname) ||
    V5_TURN_PROXY_PATHNAME_RE.test(pathname)
  )
}

/**
 * Discriminator: is this V5 trace specifically on the staging
 * proxy variant (`/proxy/v5/turn`) rather than the canonical
 * `/orchestrate/v2/turn`?
 *
 * Returns true ONLY when the trace passes `isV5TurnEndpoint`'s
 * CEE-service + pathname-only check AND the pathname matches
 * the proxy regex. Used by the bundle assembler to choose between
 * `analysis_evidence_source = 'live_v5_cee_proxy_turn'` (proxy) and
 * `'live_v5_cee_turn'` (canonical) — labels are informational only;
 * the honesty contract for `scientific_validation.source` is
 * governed separately by the indicative-keys gate in
 * `src/lib/scientificValidation/index.ts` (PR #156 round-4 P0).
 *
 * Rejects:
 *   - Non-CEE service (defensive)
 *   - Missing/empty endpoint (defensive)
 *   - Canonical `/orchestrate/v2/turn` path (use `isV5TurnEndpoint`
 *     to detect either variant; this helper is the proxy-specific
 *     discriminator)
 *   - Look-alike `/proxy/v5/turning` (path-boundary regex)
 */
export function isV5TurnProxyEndpoint(p: {
  service?: string
  endpoint?: string
}): boolean {
  if (!isCeeService(p)) return false
  if (typeof p.endpoint !== 'string' || p.endpoint.length === 0) {
    return false
  }
  const pathname = extractPathname(p.endpoint)
  if (pathname === null) return false
  return V5_TURN_PROXY_PATHNAME_RE.test(pathname)
}

// =============================================================================
// PR #156 follow-up — PLoT V1 engine endpoint matching
// =============================================================================
//
// Reviewer flagged that `useDebugData` was using substring `includes`
// checks (`endpoint.includes('/v1/run')`) for PLoT V1 endpoint
// classification. Same false-positive class the V5 path-boundary fix
// (PR #153 round-4) closed. These helpers extend the pathname-only
// approach to the PLoT V1 endpoints.

/** Canonical V1 PLoT sync run pathname. Matches `/bff/engine/v1/run`. */
const V1_PLOT_RUN_PATHNAME_RE = /\/v1\/run(?:\/|$)/

/** Canonical V1 PLoT streaming pathname. Matches `/bff/engine/v1/stream`. */
const V1_PLOT_STREAM_PATHNAME_RE = /\/v1\/stream(?:\/|$)/

/**
 * Case-insensitive PLoT service filter — mirrors `isCeeService`.
 */
export function isPlotService(p: { service?: string }): boolean {
  return (
    typeof p.service === 'string' && p.service.toUpperCase() === 'PLOT'
  )
}

/**
 * V1 PLoT sync run endpoint matcher. Requires PLoT service + pathname
 * `/v1/run` at a path boundary (next char is `/` or end-of-string).
 * Rejects:
 *   - `/v1/running`     — word-boundary false positive
 *   - `/v1/run-old`     — hyphen-suffix false positive
 *   - `/legacy?next=/v1/run` — query-string false positive (pathname-only)
 */
export function isV1PlotEngineEndpoint(p: {
  service?: string
  endpoint?: string
}): boolean {
  if (!isPlotService(p)) return false
  if (typeof p.endpoint !== 'string' || p.endpoint.length === 0) {
    return false
  }
  const pathname = extractPathname(p.endpoint)
  if (pathname === null) return false
  return V1_PLOT_RUN_PATHNAME_RE.test(pathname)
}

/**
 * V1 PLoT streaming endpoint matcher. Same boundary semantics as
 * `isV1PlotEngineEndpoint` but for `/v1/stream`.
 */
export function isV1PlotStreamEndpoint(p: {
  service?: string
  endpoint?: string
}): boolean {
  if (!isPlotService(p)) return false
  if (typeof p.endpoint !== 'string' || p.endpoint.length === 0) {
    return false
  }
  const pathname = extractPathname(p.endpoint)
  if (pathname === null) return false
  return V1_PLOT_STREAM_PATHNAME_RE.test(pathname)
}

/**
 * Either V1 sync or V1 streaming endpoint. Convenience for the
 * `useDebugData` counter and the bundle's evidence-source classifier.
 */
export function isV1PlotEndpoint(p: {
  service?: string
  endpoint?: string
}): boolean {
  return isV1PlotEngineEndpoint(p) || isV1PlotStreamEndpoint(p)
}

/**
 * V2 PLoT endpoint matcher. PLoT service + pathname `/v2/run` at a
 * path boundary. Existing V4 path (`executeV2RunWithAnalysisReady`)
 * — already records via the trace store.
 */
const V2_PLOT_RUN_PATHNAME_RE = /\/v2\/run(?:\/|$)/

export function isV2PlotEndpoint(p: {
  service?: string
  endpoint?: string
}): boolean {
  if (!isPlotService(p)) return false
  if (typeof p.endpoint !== 'string' || p.endpoint.length === 0) {
    return false
  }
  const pathname = extractPathname(p.endpoint)
  if (pathname === null) return false
  return V2_PLOT_RUN_PATHNAME_RE.test(pathname)
}
