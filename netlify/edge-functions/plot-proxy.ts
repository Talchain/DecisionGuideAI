/**
 * PLoT (plot-lite-service) Proxy Edge Function — the credential boundary.
 *
 * WHAT THIS REPLACES, AND WHY A REDIRECT COULD NOT DO IT
 * ------------------------------------------------------
 * `/bff/engine/*` was a plain 200-rewrite (`public/_redirects`, mirrored by a dead
 * twin in `netlify.toml`). A rewrite cannot inject a request header, so PLoT's auth
 * flip was survived by shipping the Bearer to the BROWSER instead —
 * `VITE_PLOT_BEARER`, read by `src/lib/plotAuthHeaders.ts`, inlined by Vite as a
 * bare literal into a public asset:
 *
 *     function c(){const c="<64-char secret>";return{Authorization:`Bearer ${c}`}}
 *
 * That is a live server-to-server credential readable by anyone who loads the site.
 * This function is the boundary that lets it be deleted: the browser now calls the
 * same-origin `/bff/engine/*` path with NO credential of its own, and the token is
 * attached here, server-side, where a bundle reader cannot reach it.
 *
 * ENVIRONMENT
 * -----------
 * - `PLOT_AUTH_TOKEN` — PLoT's bearer. Set in the Netlify dashboard (Site
 *   configuration → Environment variables), NOT in any file in this repo, and
 *   deliberately NOT `VITE_`-prefixed: a `VITE_` prefix is a publication
 *   instruction to Vite, which is exactly how the original exposure happened.
 *
 * INERT UNTIL PROVISIONED, AND LOUD ABOUT IT. With no `PLOT_AUTH_TOKEN` set this
 * function forwards the request unauthenticated; PLoT answers 401 with an explicit
 * `X-Plot-Proxy-Credential: absent` response header and a warning in the function
 * log. It never invents, defaults, or embeds a credential value.
 *
 * SECURITY
 * --------
 * - Headers are built from scratch against an explicit forward allow-list. An
 *   inbound `Authorization` is NEVER forwarded: the browser has no business
 *   supplying one here, and forwarding it would let a caller override the injected
 *   service credential.
 * - Explicit CORS origin allow-list, mirroring `isl-proxy.ts`. Same-origin browser
 *   calls send no `Origin`, so a missing origin is allowed; a PRESENT but unknown
 *   origin is rejected.
 */

import type { Config, Context } from '@netlify/edge-functions'

const PLOT_TARGET = 'https://plot-lite-service-staging.onrender.com'

/** Path prefixes this function serves, longest first so `/bff/engine` wins over `/engine`. */
const MOUNTS = ['/bff/engine', '/engine']

// SECURITY: CORS allow-list (never a wildcard). Mirrors isl-proxy.ts.
const ALLOWED_ORIGINS = [
  'https://decisionguide.ai',
  'https://decision-guide-ai.netlify.app',
  'https://staging--olumi.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const NETLIFY_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+--olumi\.netlify\.app$/

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return NETLIFY_PREVIEW_PATTERN.test(origin)
}

/**
 * CORS headers, or null to REJECT.
 *
 * A same-origin fetch sends no `Origin` header at all, and every seam this function
 * serves is same-origin by construction — so `null` origin is the NORMAL case and
 * must be allowed (returning `{}`, i.e. no CORS headers, which same-origin does not
 * need). Only a PRESENT-but-unrecognised origin is a rejection.
 *
 * ⚠ This note used to read "isl-proxy rejects a missing origin because its
 * callers are cross-origin", offered as the deliberate contrast with the
 * behaviour here. That stopped being true on 2026-09-05: `isl-proxy.ts:160`
 * was repaired to `origin !== null && !isOriginAllowed(origin)` for the same
 * reason that governs here — a browser omits `Origin` on same-origin GET/HEAD,
 * so rejecting a missing one 403s the app's own health check. The contrast is
 * gone and the two functions now agree. `orchestrator-proxy.ts:127-130` is the
 * one that still rejects a missing origin.
 */
function getCorsHeaders(requestOrigin: string | null): Record<string, string> | null {
  if (requestOrigin === null) return {}
  if (!isOriginAllowed(requestOrigin)) return null
  return {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, x-correlation-id, x-request-id, x-idempotency-key, Accept',
    Vary: 'Origin, Access-Control-Request-Headers',
  }
}

/**
 * Request headers forwarded upstream. An explicit allow-list, built from scratch.
 *
 * `authorization` is DELIBERATELY ABSENT and must stay absent — see the header note.
 */
const ALLOWED_FORWARD_HEADERS = [
  'content-type',
  'accept',
  'accept-encoding',
  'cache-control',
  'x-correlation-id',
  'x-request-id',
  'x-idempotency-key',
  'last-event-id', // SSE resume for /v1/stream
]

/** Strip whichever mount prefix this request arrived on. */
export function targetPathFor(pathname: string): string {
  for (const mount of MOUNTS) {
    if (pathname === mount) return ''
    if (pathname.startsWith(`${mount}/`)) return pathname.slice(mount.length)
  }
  return pathname
}

/**
 * SECURITY (disposition item 13) — EXPLICIT UPSTREAM PATH ALLOWLIST.
 *
 * ⚠ THIS FUNCTION SHIPPED WITHOUT ONE, AND IT WAS THE ONLY PROXY OF FIVE THAT DID.
 * `cee-proxy`, `orchestrator-proxy`, `collab-proxy` and `isl-proxy` all bound their
 * seam to the routes the UI actually calls and 404 everything else; this one
 * forwarded ANY path under `/bff/engine/*` with the injected bearer attached. That
 * makes every browser an authenticated caller across PLoT's entire surface — the
 * same blast-radius shape the bearer removal exists to close, moved from the bundle
 * to the edge rather than eliminated.
 *
 * Matched against the target (mount prefix already stripped, query EXCLUDED) BEFORE
 * `PLOT_AUTH_TOKEN` is read, so a rejected request never touches the credential.
 *
 * DERIVED from the UI's browser→PLoT call sites at staging tip `828ff369` — every
 * `plotFetch(` first argument in `src/` plus the CEE client's draft seam. The
 * derivation is re-run against the source on every CI pass by
 * `tests/ci-guards/plot-proxy-path-allowlist-derived.spec.ts`, which fails BOTH ways:
 * a new call site that nothing allows, and an allowlist entry no call site needs.
 * A hand-maintained copy of this list would drift silently and read as green.
 *
 * ⚠ ANCHORED LITERALS, NOT SUBTREE WILDCARDS — the mistake `isl-proxy.ts:81-89`
 * records making and having to undo. A `/^\/v1\/.+$/` here would re-admit the whole
 * surface this list exists to narrow, and an off-list test would still pass by
 * picking a shape the wildcard happens to miss. Dynamic segments are `[^/]+`, which
 * cannot cross a path boundary.
 */
const ALLOWED_TARGETS: readonly RegExp[] = [
  // --- Utility (non-analysis). These are the exceptions the cutover retains. ---
  /^\/health$/,
  /^\/v1\/health$/,
  /^\/v1\/limits$/,
  /^\/v1\/templates$/,
  /^\/v1\/templates\/[^/]+\/graph$/,
  /^\/v1\/pre-analysis-sensitivity$/,

  // --- Analysis routes still reachable from the browser. TWO remain, each
  // because a LIVE call site still demands it. This list shrank from twelve by
  // DELETING CALLERS, never by hand-trimming: an entry removed while its caller
  // lives fails `ALLOWLIST ⊇ DERIVED` and 404s users at our own edge.
  //
  // ⚠ THE PREVIOUS VERSION OF THIS COMMENT WAS REFUTED BY IMPORT-CHAIN
  // DERIVATION AND IS CORRECTED HERE. It named `TemplatesPanel`,
  // `ConversationPanel`, `DraftChat` and `AIClarifierChat` as live blockers.
  // Retired this pass, with the break point that proves each was reachable or
  // not:
  //
  //   /version              — RETIRED. It rode inside `runSync`; both are gone
  //                           with `getCapabilities`/`hasCapability`
  //                           (`v1/http.ts`), which had zero production callers
  //                           between them once `/v1/run` went.
  //   /v1/run               — RETIRED. `TemplatesPanel`'s "▶ Run Analysis" leg,
  //                           `useTemplatesRun`, `httpV1Adapter.run` and
  //                           `autoDetectAdapter.run` are deleted. Template
  //                           LOADING is untouched — `/v1/templates` and
  //                           `/v1/templates/:id/graph` stay, and that
  //                           distinction is the whole point.
  //   /v1/stream            — RETIRED. It was ENV-GATED DEAD, not live: the
  //                           default `auto` adapter has no `stream` member, so
  //                           the sync leg always won; only
  //                           `VITE_PLOT_ADAPTER === 'httpv1'` reached it.
  //   /v1/analysis/pareto   — RETIRED. TEST-ONLY: `ParetoChart` had ZERO
  //                           production importers (contrast control:
  //                           `TornadoChart` = 5).
  //
  // STILL HERE, and exactly why:
  //
  //   /v2/run               — RETIRED (ROADMAP 2.1229). `useV2Run`, the adapter's
  //                           HTTP section, and the flag-off branches in
  //                           `OutputsDock` / `ConversationPanel` are all
  //                           deleted, so there is no browser→PLoT run call
  //                           left to allow. The entry is removed here, and the
  //                           derived guard now derives SEVEN routes.
  //
  //                           The capability question this entry used to park
  //                           was re-derived and does not block the retirement:
  //                           `startedAt` is ALREADY stamped canonically by
  //                           `resultsAnalysing` (store.ts), and `results.seed`
  //                           cannot exist on the canonical path at all — the
  //                           V5 contract carries no seed field, and stamping
  //                           one is a provenance lie the receipts layer
  //                           already fails closed on
  //                           (`mapV5AnalysisToReport.ts`). Run history and the
  //                           Supabase analysis write were ALREADY dark on the
  //                           deployed canonical path, and are owned by rows
  //                           2.99 / 2.1231 as PRODUCER-side work. See the PR
  //                           body for the full derivation.
  //   /v1/cee/draft-graph   — ⚠ THE "LIVE PRODUCT PATH" CLAIM ABOVE WAS FALSE.
  //                           Derived: `AIClarifierChat` is DEAD BY GATE
  //                           (`setShowAIClarifier(true)` has zero production
  //                           call sites; contrast control:
  //                           `setShowDraftChat(true)` = 3). `DraftChat` is DARK
  //                           BY POSTURE (`ReactFlowGraph` renders it only under
  //                           `!isAiPanelV2Enabled()`, and `aiPanelV2` is on).
  //                           The legacy `PreAnalysisPanel` retry chain is dark
  //                           the same way (`preAnalysisV3` is on). So the entry
  //                           survives only because `useCEEDraft` →
  //                           `CEEClient.draftModel()` still EXISTS as a caller,
  //                           not because a user can reach it. Deleting that
  //                           chain also deletes `DraftChat` (~1,500 lines) and
  //                           its openers; rowed for its own lane.
  /^\/v1\/cee\/draft-graph$/,
]

function isAllowedTarget(targetPath: string): boolean {
  return ALLOWED_TARGETS.some((re) => re.test(targetPath))
}

/**
 * Reject encoded traversal (`%2e` / `%2f` / `%5c`, case-insensitive) and any literal
 * `..` segment, before the allowlist runs.
 *
 * ⚠ SCOPED TO THE PATHNAME, NEVER THE WHOLE URL — the correction `isl-proxy.ts`
 * carries. Scanning `request.url` also scans the QUERY, so an on-list route would
 * 404 whenever a parameter happened to carry an encoded slash, which
 * `encodeURIComponent` emits for any value containing one. The query cannot change
 * the upstream route, so excluding it is both correct and strictly safer.
 *
 * This is independently load-bearing: the dynamic segments above are deliberately
 * permissive (`[^/]+`) so real run ids and template ids never false-404, and an
 * encoded slash would otherwise smuggle a path boundary through one of them.
 */
function isTraversal(rawPathname: string, targetPath: string): boolean {
  if (/%2e|%2f|%5c/i.test(rawPathname)) return true
  return targetPath.split('/').some((segment) => segment === '..')
}

export default async function handler(request: Request, _context: Context) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (corsHeaders === null) {
    console.warn('[PLoT Proxy] Rejected request from unknown origin:', origin)
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const url = new URL(request.url)
  const targetPath = targetPathFor(url.pathname)

  // ── THE BOUND, BEFORE THE CREDENTIAL ───────────────────────────────────────
  // Ordered deliberately: traversal first (it can disguise an off-list path as an
  // on-list one through a permissive dynamic segment), then the allowlist, and
  // both before `PLOT_AUTH_TOKEN` is read below. A rejected request never reaches
  // the credential, and 404 — not 403 — because the shape of the answer should not
  // tell a prober which paths exist.
  if (isTraversal(url.pathname, targetPath) || !isAllowedTarget(targetPath)) {
    console.warn('[PLoT Proxy] Rejected off-allowlist target:', targetPath)
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const targetUrl = `${PLOT_TARGET}${targetPath}${url.search}`

  const headers = new Headers()
  for (const name of ALLOWED_FORWARD_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  // ── THE INJECTION ──────────────────────────────────────────────────────────
  const token = Deno.env.get('PLOT_AUTH_TOKEN')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  } else {
    console.warn(
      '[PLoT Proxy] PLOT_AUTH_TOKEN is not set — forwarding UNAUTHENTICATED. ' +
        'Auth-gated PLoT routes will answer 401 until it is provisioned in the Netlify dashboard.',
    )
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      // @ts-ignore - duplex is required for streaming request bodies
      duplex: 'half',
    })

    const responseHeaders = new Headers(response.headers)
    for (const [key, value] of Object.entries(corsHeaders)) responseHeaders.set(key, value)
    // Make the provisioning state observable without exposing anything.
    responseHeaders.set('X-Plot-Proxy-Credential', token ? 'injected' : 'absent')

    // `response.body` is passed straight through, so an SSE stream (/v1/stream)
    // keeps streaming rather than being buffered here.
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[PLoT Proxy] Error:', error)
    return new Response(
      JSON.stringify({ error: 'PLoT service unavailable', message: (error as Error).message }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
}

export const config: Config = {
  path: ['/bff/engine/*', '/engine/*'],
}
