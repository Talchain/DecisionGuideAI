/**
 * ROADMAP 2.467 — the client half of the `register_graph` seam.
 *
 * Sibling of `scenarioGraph.ts` (the READ). Same edge path, same identity-in-
 * the-body convention, same never-throws discriminated result.
 *
 * ⚠ THE BASE IS A LITERAL, AND THAT IS LOAD-BEARING. `VITE_CEE_BFF_BASE` is
 *   unset in this tree but IS set in the Netlify dashboard to a PLoT origin,
 *   and Vite inlines `import.meta.env` at BUILD time — so the house-style
 *   `import.meta.env.VITE_CEE_BFF_BASE || '/bff/cee'` resolves to PLoT in the
 *   deployed bundle, and PLoT serves no CEE scenario routes. The deployed
 *   chunks carried zero `/bff/cee` literals when that was last crawled. A
 *   source-text test pins the literal and the builder's use of it, because a
 *   constant nothing reads is the same defect wearing a different hat.
 *
 * ⚠ A REGISTRATION IS NOT IDEMPOTENT-BY-RETRY IN THE WAY A READ IS. Retrying a
 *   503 is safe (nothing was written), but a 409 means the server graph moved
 *   under us and MUST NOT be retried — re-sending would be exactly the silent
 *   clobber CEE's CAS refused. It is surfaced as its own status so the caller
 *   keeps the honest "cannot confirm" posture rather than looping.
 */

import { logger } from '../../lib/logger'

/**
 * The same-origin Netlify edge path. NOT `VITE_CEE_BFF_BASE` — see the header.
 * Deliberately a literal.
 */
export const SCENARIO_GRAPH_REGISTER_BASE = '/bff/cee'

/** `POST` — scenario in the path, graph and identity in the body. */
export function scenarioGraphRegisterUrl(scenarioId: string): string {
  return `${SCENARIO_GRAPH_REGISTER_BASE}/scenarios/${encodeURIComponent(scenarioId)}/graph/register`
}

/** Total attempts on a retryable (503) answer: the first plus two retries. */
const MAX_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY_MS = 400

/**
 * Per-attempt deadline. CEE staging cold-starts; a registration that lands
 * long after the user has moved on describes a graph they may already have
 * changed. Bounding the wait bounds that window.
 */
const DEFAULT_TIMEOUT_MS = 10000

/** The guest sentinel `AuthContext` mints; never a Supabase user id. */
const GUEST_USER_ID = 'guest'

export interface RegisteredGraphIdentity {
  /** CEE's opaque `identity.v1` token, VERBATIM. Compare CEE-to-CEE only. */
  readonly value: string
  readonly projectionVersion: string
}

export type RegisterScenarioGraphResult =
  /** 200 — `scenarios.graph` now holds this graph. THE acknowledgement. */
  | {
      status: 'registered'
      identity: RegisteredGraphIdentity | null
      nodeCount: number
      edgeCount: number
      requestId: string | null
    }
  /** 422 — CEE refused these bytes. Actionable, and never retried. */
  | { status: 'rejected'; code: string; message: string; nodeIds: readonly string[] }
  /** 409 — the server graph moved. NEVER retried; nothing was written. */
  | { status: 'conflict' }
  /** 404 — absent ∪ not-yours ∪ oracle-unresolvable. */
  | { status: 'notRegistrable' }
  /** 503 after every attempt, or a transport failure. Unknown; try later. */
  | { status: 'unavailable' }
  /** 401 / 403 / 429 — a stable refusal; not retried. */
  | { status: 'refused'; httpStatus: number }

export interface RegisterScenarioGraphOptions {
  readonly userId?: string | null
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
  readonly retryDelayMs?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readIdentityEnvelope(raw: unknown): RegisteredGraphIdentity | null {
  if (raw === null || typeof raw !== 'object') return null
  const env = raw as Record<string, unknown>
  const value = env.value
  const projectionVersion = env.projection_version
  if (typeof value !== 'string' || value.length === 0) return null
  if (typeof projectionVersion !== 'string' || projectionVersion.length === 0) return null
  return { value, projectionVersion }
}

/**
 * Register a whole graph as the scenario's server-side model.
 *
 * Never throws: every failure mode is a discriminated status, because the one
 * outcome this must not produce is a caller that cannot tell "the server has my
 * graph" from "I could not tell". A caller that cannot tell must keep holding.
 */
export async function registerScenarioGraph(
  scenarioId: string,
  graph: unknown,
  opts: RegisterScenarioGraphOptions = {},
): Promise<RegisterScenarioGraphResult> {
  const retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS

  // Identity travels in the BODY: with `CEE_REQUIRE_USER_JWT` off, CEE's
  // ownership pre-flight reads `user_id` from the request extensions, and it
  // must be a UUID — the guest sentinel is not one and is never sent as one.
  const body: Record<string, unknown> = { graph }
  if (
    typeof opts.userId === 'string' &&
    opts.userId.length > 0 &&
    opts.userId !== GUEST_USER_ID
  ) {
    body.user_id = opts.userId
  }

  const url = scenarioGraphRegisterUrl(scenarioId)
  const payload = JSON.stringify(body)

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const attemptController = new AbortController()
    const onCallerAbort = () => attemptController.abort()
    if (opts.signal) {
      if (opts.signal.aborted) return { status: 'unavailable' }
      opts.signal.addEventListener('abort', onCallerAbort, { once: true })
    }
    const timer = timeoutMs > 0 ? setTimeout(() => attemptController.abort(), timeoutMs) : null

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: attemptController.signal,
      })
    } catch (err) {
      logger.warn('scenario_graph_register.transport_failure', {
        attempt,
        error: (err as Error)?.message ?? 'unknown',
      })
      return { status: 'unavailable' }
    } finally {
      if (timer !== null) clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onCallerAbort)
    }

    if (response.status === 503) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(retryDelayMs)
        continue
      }
      return { status: 'unavailable' }
    }

    // NEVER retried: the server graph moved, and re-sending would be the
    // silent clobber CEE's CAS just refused.
    if (response.status === 409) return { status: 'conflict' }

    if (response.status === 404) return { status: 'notRegistrable' }

    if (response.status === 401 || response.status === 403 || response.status === 429) {
      return { status: 'refused', httpStatus: response.status }
    }

    if (response.status === 422 || response.status === 400) {
      let code = 'GRAPH_REJECTED'
      let message = 'This model could not be saved to the server.'
      let nodeIds: readonly string[] = []
      try {
        const b = (await response.json()) as Record<string, unknown>
        const details = (b.details ?? {}) as Record<string, unknown>
        if (typeof details.code === 'string') code = details.code
        if (typeof b.message === 'string') message = b.message
        if (Array.isArray(details.node_ids)) {
          nodeIds = details.node_ids.filter((v): v is string => typeof v === 'string')
        }
      } catch {
        /* a refusal we cannot parse is still a refusal — never a success */
      }
      logger.warn('scenario_graph_register.rejected', { code, nodeCount: nodeIds.length })
      return { status: 'rejected', code, message, nodeIds }
    }

    if (!response.ok) return { status: 'unavailable' }

    let parsed: Record<string, unknown>
    try {
      parsed = (await response.json()) as Record<string, unknown>
    } catch {
      // A 200 we cannot read is NOT an acknowledgement. Fail to "unknown" so
      // the caller keeps holding rather than releasing on a body it never saw.
      return { status: 'unavailable' }
    }

    // The discriminator is required. A 200 from something that is not this
    // route (an SPA fallback, a proxy interstitial) must never read as an ack.
    if (parsed.schema !== 'scenario_graph_registration.v1' || parsed.registered !== true) {
      logger.warn('scenario_graph_register.unrecognised_envelope', {
        schema: typeof parsed.schema === 'string' ? parsed.schema : 'absent',
      })
      return { status: 'unavailable' }
    }

    return {
      status: 'registered',
      identity: readIdentityEnvelope(parsed.graph_identity_hash),
      nodeCount: typeof parsed.node_count === 'number' ? parsed.node_count : 0,
      edgeCount: typeof parsed.edge_count === 'number' ? parsed.edge_count : 0,
      requestId: typeof parsed.request_id === 'string' ? parsed.request_id : null,
    }
  }

  return { status: 'unavailable' }
}
