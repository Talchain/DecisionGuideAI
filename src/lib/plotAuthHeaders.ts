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
 * Env access mirrors the repo's `flagFactory.ts` pattern: read via a LITERAL
 * `import.meta.env` reference (spread). A `(import.meta as any).env` cast
 * strips Vite's env proxy (documented in flagFactory.ts) and would make the
 * value unreadable under test — so it is deliberately avoided here. The
 * `VITE_` naming convention mirrors the ISL/CEE adapters.
 */
export function plotAuthHeaders(): Record<string, string> {
  let env: Record<string, unknown> = {}
  try {
    env = { ...import.meta.env }
  } catch {
    // SSR/test environment where import.meta.env is unavailable.
  }
  const token = env.VITE_PLOT_BEARER
  return typeof token === 'string' && token.length > 0
    ? { Authorization: `Bearer ${token}` }
    : {}
}
