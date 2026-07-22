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
 * Merge the (already-normalised, plain-object) auth headers over whatever the
 * caller passed as `init.headers`. Returns a plain `Record<string, string>` so
 * every PLoT seam ends up with a predictable header shape.
 *
 * Only runs on the token-present branch — i.e. once the flip is happening — so a
 * `Headers`/tuple-array caller (none exist among the PLoT seams today; this arm
 * is defensive) being normalised to a record here never affects the fail-safe,
 * byte-identical, token-absent path below.
 */
function mergeAuthHeaders(
  base: HeadersInit | undefined,
  auth: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (base instanceof Headers) {
    base.forEach((value, key) => {
      out[key] = value
    })
  } else if (Array.isArray(base)) {
    for (const [key, value] of base) out[key] = value
  } else if (base) {
    Object.assign(out, base)
  }
  // Auth wins on collision — the flip's Bearer must not be shadowed by a stale
  // caller-supplied Authorization.
  Object.assign(out, auth)
  return out
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

  return fetch(input, { ...init, headers: mergeAuthHeaders(init?.headers, auth) })
}
