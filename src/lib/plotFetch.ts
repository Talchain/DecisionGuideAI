/**
 * plotFetch — the ONE seam through which every browser→PLoT request flows.
 *
 * WHY THIS EXISTS. PLoT's staging auth flip turns the plain Netlify pass-through
 * `/bff/engine/*` (netlify.toml: `/bff/engine/*` → plot-lite-service-staging,
 * no header injection) from open to Bearer-gated. Any browser `fetch` that hits
 * a PLoT base WITHOUT the token would start returning 401 the moment the flip
 * lands. PR #428 attached the Bearer to the two CEE-family seams
 * (readinessStore's graph-readiness call and the CEE client's `fetchWithBase`),
 * but ~a-dozen OTHER PLoT-direct seams — the analysis-run path (useV2Run →
 * v2/adapter), every recommendation/analysis hook, the V1 engine client, the
 * sensitivity ranker, the SafeMode health probe — still sent no header. Nine
 * of those would have flipped red.
 *
 * Rather than a global monkey-patch of `window.fetch` (invisible, order- and
 * test-hostile, and it would touch Supabase / CEE-assist / ISL / static-asset
 * fetches it has no business touching), this is ONE explicit, greppable wrapper
 * that every PLoT-direct caller routes through. It merges `plotAuthHeaders()`
 * (from PR #428) into the outgoing request's headers and is otherwise a
 * pass-through. The header is applied REGARDLESS of which PLoT base the caller
 * used — callers pass their own fully-formed URLs; this wrapper never inspects
 * or rewrites them.
 *
 * FAIL-SAFE (the precondition for a zero-breakage flip). `plotAuthHeaders()`
 * returns `{}` until `VITE_PLOT_BEARER` is provisioned. When it is empty this
 * function forwards `(input, init)` to the global `fetch` UNTOUCHED — same
 * references, same header object, no clone — so today's behaviour is
 * byte-for-byte identical everywhere it is installed, and the absence pins stay
 * green. The header only materialises once the env var is set.
 *
 * The signature mirrors `fetch`, so migrating a seam is a mechanical
 * `fetch(` → `plotFetch(` rename plus this import; no call-site restructuring.
 *
 * A repo guard (tests/ci-guards/plot-fetch-all-seams.spec.ts) fails CI if a bare
 * `fetch(` to a PLoT base is introduced outside this wrapper — the tenth-seam
 * preventer.
 */
import { plotAuthHeaders } from './plotAuthHeaders'

/**
 * Fold an ordered list of header sources into ONE plain `Record<string,string>`,
 * later sources winning on collision. `Headers`/tuple-array/record inputs are all
 * normalised, so every PLoT seam ends up with a predictable header shape.
 *
 * Ordered lowest→highest precedence: a Request object's OWN headers (F5), then
 * the caller's `init.headers`, then the injected auth. Auth is last so the flip's
 * Bearer is never shadowed by a stale caller-supplied Authorization.
 *
 * Only runs on the token-present branch — i.e. once the flip is happening — so
 * normalising a `Headers`/tuple-array caller to a record here never affects the
 * fail-safe, byte-identical, token-absent path below.
 */
function mergeHeaders(...sources: (HeadersInit | undefined)[]): Record<string, string> {
  const out: Record<string, string> = {}
  // HTTP header names are case-INSENSITIVE. Dedupe on the lowercased name so a
  // later source (init, then auth) cleanly REPLACES an earlier one regardless of
  // casing — critical because a Request object's `.headers` lowercases its keys,
  // so a stale lowercase `authorization` must not survive alongside the injected
  // capitalised `Authorization` (which `fetch` would otherwise COMBINE, shadowing
  // the flip's Bearer). The last writer's own casing is preserved in the output.
  const keyByLower = new Map<string, string>()
  const set = (key: string, value: string) => {
    const lower = key.toLowerCase()
    const prior = keyByLower.get(lower)
    if (prior !== undefined && prior !== key) delete out[prior]
    out[key] = value
    keyByLower.set(lower, key)
  }
  for (const src of sources) {
    if (!src) continue
    if (Array.isArray(src)) {
      for (const [key, value] of src) set(key, value)
    } else if (typeof (src as Headers).forEach === 'function') {
      // A Headers or Headers-LIKE object. Feature-detected via `forEach` rather
      // than `instanceof Headers`: a Request object's own `.headers` is not an
      // instance of the global Headers in every runtime (jsdom notably), yet it
      // exposes the same `forEach(value, key)` contract.
      ;(src as Headers).forEach((value, key) => set(key, value))
    } else {
      for (const [key, value] of Object.entries(src)) set(key, value as string)
    }
  }
  return out
}

/** The absolute-or-relative URL string a `fetch` input resolves from. */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  // A Request object — its `url` is already an absolute, resolved URL.
  return input.url
}

/**
 * The origins the PLoT Bearer is allowed to ride to: this app's own origin
 * (relative paths and any same-origin absolute URL — the `/bff/engine/*` Netlify
 * pass-through and the local dev proxy) plus whatever absolute PLoT base the
 * deployment configured.
 */
function allowedPlotOrigins(): Set<string> {
  const origins = new Set<string>()
  if (typeof location !== 'undefined' && location.origin && location.origin !== 'null') {
    origins.add(location.origin)
  }
  let env: Record<string, unknown> = {}
  try {
    env = { ...import.meta.env }
  } catch {
    // SSR/test env where import.meta.env is unavailable.
  }
  // The three env tokens the PLoT-direct seams derive their base from. Only
  // ABSOLUTE bases contribute an origin; the relative default ('/bff/engine') is
  // same-origin and is already covered by location.origin above.
  for (const key of ['VITE_PLOT_PROXY_BASE', 'VITE_BFF_BASE', 'VITE_PLOT_ENGINE_URL']) {
    const val = env[key]
    if (typeof val === 'string' && /^https?:\/\//i.test(val)) {
      try {
        origins.add(new URL(val).origin)
      } catch {
        // Malformed base — ignore; it simply won't be allow-listed.
      }
    }
  }
  return origins
}

/** The canonical PLoT deployment host family (plot-lite-service[-env].onrender.com). */
const PLOT_HOST = /^plot-lite-service(?:-[a-z0-9]+)*\.onrender\.com$/i

/**
 * F5 (a): REJECT before the Bearer is attached if the request's resolved origin
 * is neither same-origin, the configured PLoT base, nor the canonical PLoT host.
 * The Bearer must never ride to a foreign origin. Runs ONLY on the token-present
 * branch, so the fail-safe (token-absent) path stays byte-for-byte a bare fetch.
 */
function assertPlotOrigin(input: RequestInfo | URL): void {
  const raw = urlOf(input)
  const base = typeof location !== 'undefined' ? location.href : undefined
  let origin: string
  try {
    origin = new URL(raw, base).origin
  } catch {
    // Unresolvable (a relative URL with no base to resolve against). A relative
    // URL is inherently same-origin and cannot carry the Bearer cross-origin.
    return
  }
  if (allowedPlotOrigins().has(origin)) return
  try {
    if (PLOT_HOST.test(new URL(origin).hostname)) return
  } catch {
    // fall through to reject
  }
  throw new Error(
    `plotFetch: refusing to attach the PLoT Bearer to a non-PLoT origin (${origin}). ` +
      `The Bearer may ride only to same-origin or the configured PLoT base.`,
  )
}

/**
 * `fetch`, with the optional env-injected PLoT Bearer merged in. Drop-in for the
 * global `fetch` on any browser→PLoT call.
 */
export function plotFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const auth = plotAuthHeaders()

  // FAIL-SAFE: no token → forward untouched, byte-for-byte identical to a bare
  // `fetch`. This is the token-absent path that reproduces today's behaviour.
  if (Object.keys(auth).length === 0) {
    return fetch(input, init)
  }

  // The Bearer is about to ride. Guard the origin FIRST (F5 a) — throw before it
  // is attached if the destination is foreign.
  assertPlotOrigin(input)

  // F5 (b): when the input is a Request object, its OWN headers must survive the
  // merge. Passing `{ ...init, headers }` to `fetch(request, …)` REPLACES the
  // Request's headers with `headers`, so fold the Request's headers in first.
  const requestHeaders =
    typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined

  return fetch(input, { ...init, headers: mergeHeaders(requestHeaders, init?.headers, auth) })
}
