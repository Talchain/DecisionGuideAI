/**
 * plotFetch — the ONE seam through which every browser→PLoT request flows.
 *
 * ⚠ IT CARRIES NO CREDENTIAL, AND THAT IS THE POINT. Read the next paragraph before
 * adding a header here.
 *
 * WHAT THIS USED TO DO, AND WHY IT STOPPED
 * ----------------------------------------
 * This wrapper merged `plotAuthHeaders()` — `Authorization: Bearer ${VITE_PLOT_BEARER}`
 * — into every PLoT-direct request, so that PLoT's staging auth flip would not 401
 * the ~22 browser seams that call it. It worked, at a price that was invisible in
 * source: Vite replaces `import.meta.env.VITE_X` with the LITERAL at build time, so
 * the emitted chunk was
 *
 *     function c(){const c="<64-char secret>";return{Authorization:`Bearer ${c}`}}
 *
 * — a live, shared server-to-server credential (PLoT's `PLOT_AUTH_TOKEN`, also used
 * by CEE) published in a public asset that any visitor could fetch. The variable
 * NAME was compiled away, so every name-based check reported a confident all-clear
 * while the value sat there in plain text.
 *
 * The credential now lives server-side in `netlify/edge-functions/plot-proxy.ts`,
 * which injects it on the same-origin `/bff/engine/*` path, and only for the
 * enumerated routes the UI actually calls. The browser holds nothing.
 *
 * The two absolute-base escape hatches (`VITE_CEE_DRAFT_BASE`,
 * `VITE_PLOT_ENGINE_URL`) are RETIRED — the reads are deleted, not normalised.
 * Normalising them bounded only the values they were measured to hold, because
 * `plotSameOrigin` passes non-PLoT hosts through by design. An authenticated
 * CROSS-ORIGIN browser call is, by construction, a published credential — there is
 * no version of that which is safe, and no env var may choose it.
 *
 * ⚠ DO NOT REINTRODUCE A CREDENTIAL HERE. Not behind a flag, not "temporarily", not
 * read from a differently-named variable. If a PLoT route needs auth, it needs the
 * edge function — that is what the edge function is for.
 * `scripts/ci/assert-no-bundle-credentials.mjs` scans the EMITTED BUNDLE for
 * credential-shaped literals and fails the build, so a reintroduction reds CI
 * whether or not the variable name survives minification. Do not try to satisfy it
 * by renaming anything; it does not look at names.
 *
 * WHY THE WRAPPER REMAINS
 * -----------------------
 * It is now a pass-through, and it is deliberately still here:
 *   · `tests/ci-guards/plot-fetch-all-seams.spec.ts` fails CI if a bare `fetch(` to a
 *     PLoT base appears outside this wrapper — the "eleventh seam" preventer. That
 *     guard needs a wrapper to route through.
 *   · It keeps ONE greppable chokepoint for every browser→PLoT call, which is what
 *     made this credential removable in a single edit rather than twenty-two.
 * Deleting it would scatter the seam again and retire the guard that protects it.
 */

/**
 * `fetch`, for browser→PLoT calls.
 *
 * A pass-through: same references, same header object, no clone — byte-for-byte a
 * bare `fetch`. Authentication happens server-side at the `/bff/engine/*` edge
 * function; nothing is attached here.
 */
export function plotFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init)
}
