/**
 * plotAuthHeaders — optional, env-injected Bearer for the browser's
 * PLoT-direct calls (the /v1/cee/* family: graph-readiness, bias-check,
 * sensitivity-coach, draft-graph).
 *
 * Returns `{ Authorization: 'Bearer <token>' }` when `VITE_PLOT_BEARER` is a
 * non-empty string, and `{}` otherwise.
 *
 * FAIL-SAFE: an absent/empty token reproduces today's behaviour EXACTLY — no
 * Authorization header is attached — so nothing breaks before the token is
 * provisioned. This is the precondition for PLoT's auth flip (zero silent
 * breakage): the header only appears once the env var is set.
 *
 * The token is DELIBERATELY bundle-visible: this is option (a) of a ratified
 * POC choice (a staging-scoped, rotatable Bearer shipped in the client
 * bundle). Option (b) — a same-origin proxy that keeps the secret
 * server-side, mirroring the ISL BFF (`netlify/edge-functions/isl-proxy.ts`)
 * — is a recorded production-hardening row and is intentionally NOT built
 * here.
 *
 * ⚠ ENV ACCESS MUST STAY A NAMED, LITERAL READ — `import.meta.env?.VITE_PLOT_BEARER`.
 *
 * This function previously read `{ ...import.meta.env }`. Vite cannot statically
 * narrow a spread (or any other bare `import.meta.env` reference), so it inlined
 * the ENTIRE env object at this site — every `VITE_*` variable the deploy defines,
 * with its value, whether or not this file reads it. A credential-free bundle
 * measurement on 2026-07-28 proved the mechanism: a variable referenced NOWHERE in
 * `src/` was still baked in, because exposure was driven by what the deploy SET,
 * not by what the code READ.
 *
 * A named read is narrowed to the single value below, so this chunk now carries
 * exactly one env value instead of all of them.
 *
 * `?.` (optional chaining) is used rather than a bare `import.meta.env.VITE_…` so
 * an SSR/test environment without `import.meta.env` yields `undefined` instead of
 * throwing — the try/catch it replaces.
 *
 * ⚠ AND A NAMED READ IS NOT SUFFICIENT ON ITS OWN — this was measured, after an
 * earlier version of this very comment claimed it was. Vite has a specific define
 * for `import.meta.env.VITE_X` ONLY for variables that are SET at build time. A
 * read of an UNSET variable falls back to substituting the WHOLE env object, and
 * one such read poisons its entire chunk — with `.` or `?.` alike. So the narrowing
 * here is only half the fix; the other half is the derived `define` block in
 * `vite.config.ts` that pins every read-but-unset variable to `undefined`.
 * See `scripts/derive-vite-env-reads.mjs`.
 *
 * Do NOT use a `(import.meta as any).env` cast — it strips Vite's env proxy
 * (documented in flagFactory.ts) and makes the value unreadable under test.
 *
 * Regression pin: `scripts/ci/assert-bundle-env-allowlist.mjs` reds if a built
 * bundle carries a `VITE_*` key outside the declared allow-list, so a
 * reintroduced spread fails loud rather than silently re-inlining everything.
 */
export function plotAuthHeaders(): Record<string, string> {
  const token = import.meta.env?.VITE_PLOT_BEARER
  return typeof token === 'string' && token.length > 0
    ? { Authorization: `Bearer ${token}` }
    : {}
}
