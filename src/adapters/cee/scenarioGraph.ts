/**
 * scenarioGraph — the UI's client for CEE's scenario-addressed graph read.
 *
 * ROADMAP 2.312 piece 3. Server contract frozen in olumi-assistants-service
 * PR #804 (merged `ecdc4cf`): `POST /assist/v1/scenarios/{id}/graph` →
 * `scenario_graph.v1`, reached from the browser as `/bff/cee/scenarios/{id}/graph`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ WHY THIS FILE DOES NOT USE `VITE_CEE_BFF_BASE` — READ BEFORE "TIDYING"
 * ─────────────────────────────────────────────────────────────────────────────
 * Every other CEE caller in this repo resolves its base as
 * `import.meta.env.VITE_CEE_BFF_BASE || '/bff/cee'`. That looks like the
 * house style, and copying it here would send this call to the WRONG SERVICE.
 *
 * `VITE_CEE_BFF_BASE` is not set anywhere in this tree, so it reads as the
 * same-origin `/bff/cee` locally — but it IS set in the Netlify dashboard, to
 * the absolute PLoT URL `https://plot-lite-service-staging.onrender.com/v1/cee`,
 * and Vite INLINES it at build time. The deployed bundle therefore contains
 * ZERO `/bff/cee` literals and four absolute PLoT bases (established by a
 * recursive crawl of the deployed JS chunks, 4 Aug 2026; the same posture is
 * recorded at `src/canvas/stores/readinessStore.ts` for the readiness path,
 * which genuinely is a PLoT-served endpoint).
 *
 * PLoT does not serve `scenario_graph.v1`. A hydrate call resolved from that
 * var would leave the same-origin edge seam entirely, hit PLoT, and 404 — and
 * a 404 on this route means "not readable", so the failure would be
 * indistinguishable from a legitimate refusal and the canvas would silently
 * never hydrate. This is CLAUDE.md trap 18 in its live form: the env posture
 * is NOT derivable from this repo.
 *
 * So the base is a DEDICATED same-origin constant. `/bff/cee/*` is owned by
 * `netlify/edge-functions/cee-proxy.ts`, which rewrites the prefix to
 * `/assist/v1` and injects `X-Olumi-Assist-Key` server-side; `vite.config.ts`
 * proxies the same prefix the same way in dev. Both hops are already in the
 * tree, so the resolved URL shape is pinned by spec rather than assumed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR BINDING CONSUMER NOTES (from the merged PR body)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. `graph_identity_hash` is an ENVELOPE OBJECT — read `.value`. A consumer
 *    that treats the field itself as the hash compares objects and gets a
 *    permanent false "changed".
 * 2. The token is OPAQUE and CEE-ISSUED. Store it, compare CEE-to-CEE, gate on
 *    `.projection_version`, and NEVER recompute it locally — the normalisation
 *    and strip list are CEE's, are versioned so they can move, and have no
 *    client-side counterpart.
 * 3. `404` means NOT READABLE (absent ∪ not-yours ∪ oracle-unresolvable). It is
 *    NOT authoritative deletion and must never discard the local canvas.
 *    `503` means retry.
 * 4. No `updated_at`/`version` by ruling — the hash token is the staleness
 *    anchor and a "last synced" display is out of scope.
 *
 * ⚠ THE RESPONSE CARRIES NO LAYOUT. `scenarios.graph` holds no canvas
 * geometry, and `layout_present` is MEASURED on the returned bytes rather than
 * promised — it is `false` for every real graph today. Positions are merged
 * locally; see `canvas/utils/mergeServerGraph.ts`.
 */

import { logger } from '../../lib/logger'

/**
 * The same-origin Netlify edge path. NOT `VITE_CEE_BFF_BASE` — see the header.
 * Deliberately a literal: an env-resolved base is exactly the defect above.
 */
export const SCENARIO_GRAPH_BASE = '/bff/cee'

/** `POST` — the scenario is addressed in the path, identity travels in the body. */
export function scenarioGraphUrl(scenarioId: string): string {
  return `${SCENARIO_GRAPH_BASE}/scenarios/${encodeURIComponent(scenarioId)}/graph`
}

/** Total attempts on a retryable (503) answer: the first plus two retries. */
const MAX_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY_MS = 400

/** The guest sentinel `AuthContext` mints; never a Supabase user id. */
const GUEST_USER_ID = 'guest'

/**
 * CEE's `identity.v1` envelope, reduced to the two fields a consumer may act on.
 * `value` is opaque; `projectionVersion` is the gate that makes a comparison
 * meaningful. Nothing here is ever computed on this side.
 */
export interface ScenarioGraphIdentity {
  /** CEE's token, VERBATIM. Compare CEE-to-CEE only. */
  readonly value: string
  /** `graph_identity_hash.projection_version` — never compare across values. */
  readonly projectionVersion: string
}

export type ScenarioGraphResult =
  /** 200 with a graph. `graph` is `scenarios.graph` verbatim; it carries no layout. */
  | {
      status: 'graph'
      graph: unknown
      briefText: string | null
      identity: ScenarioGraphIdentity | null
      /** MEASURED by CEE on the returned bytes. `false` for every real graph today. */
      layoutPresent: boolean
      requestId: string | null
    }
  /** 200, `graph_present:false` — the scenario exists and has no graph yet. Normal. */
  | { status: 'absent'; requestId: string | null }
  /** 404 — absent ∪ not-yours ∪ oracle-unresolvable. NEVER deletion. */
  | { status: 'notReadable' }
  /** 503 after every attempt — unknown, try again. NEVER an empty canvas. */
  | { status: 'unavailable' }
  /** 401 / 403 / 429 — a stable refusal; not retried. */
  | { status: 'refused'; httpStatus: number }
  /** Transport failure, unparseable body, or a shape that contradicts itself. */
  | { status: 'unusable' }

export interface FetchScenarioGraphOptions {
  /** Supabase user id. Omitted for guest/unowned scenarios. */
  userId?: string | null
  signal?: AbortSignal
  /** Backoff between 503 retries. Tests pass 0. */
  retryDelayMs?: number
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * CONSUMER NOTE 1. Accepts ONLY the envelope object and reads `.value` from it.
 *
 * A bare string is REFUSED rather than adopted: if CEE ever regressed to
 * emitting a naked hash, silently accepting it would make this consumer agree
 * with a shape the contract does not define, and the `projection_version` gate
 * — the thing that makes a comparison meaningful at all — would be gone with
 * no signal. Null is the honest answer, and a null token never suppresses a
 * merge downstream.
 */
function readIdentityEnvelope(raw: unknown): ScenarioGraphIdentity | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object') {
    logger.warn('scenario_graph.identity_not_an_envelope', {
      receivedType: typeof raw,
    })
    return null
  }
  const env = raw as Record<string, unknown>
  const value = env.value
  const projectionVersion = env.projection_version
  if (typeof value !== 'string' || value.length === 0) return null
  if (typeof projectionVersion !== 'string' || projectionVersion.length === 0) {
    return null
  }
  return { value, projectionVersion }
}

function parseOk(body: unknown): ScenarioGraphResult {
  if (body === null || typeof body !== 'object') return { status: 'unusable' }
  const b = body as Record<string, unknown>

  // The discriminator is a literal in the contract. A different one means the
  // route moved under us; adopting it would be guessing at a shape.
  if (b.schema !== 'scenario_graph.v1') {
    logger.warn('scenario_graph.unexpected_schema', { schema: String(b.schema) })
    return { status: 'unusable' }
  }

  const requestId = typeof b.request_id === 'string' ? b.request_id : null

  // `graph_present` is explicit precisely so presence is never inferred from a
  // falsy check. It is the authority — but it must AGREE with the bytes.
  const graphPresent = b.graph_present === true
  const graph = b.graph
  const graphIsObject = graph !== null && typeof graph === 'object'

  if (!graphPresent) {
    // Fail closed on disagreement in either direction: a body claiming no graph
    // while carrying one is not a shape we can act on.
    if (graphIsObject) {
      logger.warn('scenario_graph.presence_disagreement', { graphPresent: false })
      return { status: 'unusable' }
    }
    return { status: 'absent', requestId }
  }

  if (!graphIsObject) {
    logger.warn('scenario_graph.presence_disagreement', { graphPresent: true })
    return { status: 'unusable' }
  }

  return {
    status: 'graph',
    graph,
    briefText: typeof b.brief_text === 'string' ? b.brief_text : null,
    identity: readIdentityEnvelope(b.graph_identity_hash),
    layoutPresent: b.layout_present === true,
    requestId,
  }
}

/**
 * Read the scenario's server-side graph.
 *
 * Never throws: every failure mode is a discriminated status, because the one
 * outcome this must not produce is a caller that cannot tell "no graph" from
 * "could not read". A 503 is retried; a 404 and the auth/rate refusals are
 * stable answers and are not.
 */
export async function fetchScenarioGraph(
  scenarioId: string,
  opts: FetchScenarioGraphOptions = {},
): Promise<ScenarioGraphResult> {
  const retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS

  // Identity travels in the BODY: with `CEE_REQUIRE_USER_JWT` off (staging),
  // CEE's ownership pre-flight reads `user_id` from the request extensions.
  // The guest sentinel is not a Supabase id and must never be sent as one.
  const body: Record<string, unknown> = {}
  if (
    typeof opts.userId === 'string' &&
    opts.userId.length > 0 &&
    opts.userId !== GUEST_USER_ID
  ) {
    body.user_id = opts.userId
  }

  const url = scenarioGraphUrl(scenarioId)

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: opts.signal,
      })
    } catch (err) {
      // Transport failure — offline, CORS, TLS, abort. Unknown, never absent.
      if ((err as Error)?.name === 'AbortError') return { status: 'unusable' }
      logger.warn('scenario_graph.transport_failure', {
        attempt,
        error: (err as Error)?.message ?? 'unknown',
      })
      return { status: 'unusable' }
    }

    if (response.status === 503) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(retryDelayMs)
        continue
      }
      return { status: 'unavailable' }
    }

    // CONSUMER NOTE 3: this is "not readable", not "deleted". The caller must
    // leave the canvas alone.
    if (response.status === 404) return { status: 'notReadable' }

    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429
    ) {
      return { status: 'refused', httpStatus: response.status }
    }

    if (!response.ok) {
      logger.warn('scenario_graph.unexpected_status', { status: response.status })
      return { status: 'unusable' }
    }

    try {
      return parseOk(await response.json())
    } catch {
      return { status: 'unusable' }
    }
  }

  /* c8 ignore next -- unreachable: the loop returns on every terminal status */
  return { status: 'unavailable' }
}
