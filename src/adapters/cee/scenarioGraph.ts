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

import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { sanitiseUserId } from '../../lib/guestIdentity'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { logger } from '../../lib/logger'
import { buildTurnAuthHeaders } from '../../v5/turnAuthHeaders'
import { isSignInRequired } from './signInRefusal'
import { parseNotModelled, type NotModelledManifest } from './notModelled'

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

/**
 * Per-attempt deadline (review A3).
 *
 * ⚠ THIS IS A CORRECTNESS BOUND, NOT A UX NICETY. CEE staging cold-starts, and
 * an answer that arrives tens of seconds after boot describes a graph the user
 * has since edited on screen. Applying it then is not "late hydration", it is a
 * SILENT ROLLBACK of work done in the window — and the autosave would persist
 * the rolled-back state moments later, destroying the last copy. Bounding the
 * wait bounds that window.
 */
const DEFAULT_TIMEOUT_MS = 8000


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
      /**
       * ROADMAP 2.973 — what of the brief did NOT reach the model.
       *
       * `null` means CEE SENT NO MANIFEST (it predates the field, or the shape
       * failed to validate) — i.e. we know nothing. It does NOT mean nothing was
       * dropped, and no consumer may render it as such.
       */
      notModelled: NotModelledManifest | null
      identity: ScenarioGraphIdentity | null
      /** MEASURED by CEE on the returned bytes. `false` for every real graph today. */
      layoutPresent: boolean
      /**
       * ROADMAP 2.1271 — CEE's composed `AnalysisStateV1` verdict for this
       * scenario, PARSED, or `null`.
       *
       * ⚠ `null` IS NOT A STATE, and reading it as one is the whole hazard of
       * this field. It means CEE DID NOT ANSWER — the build predates the key, the
       * scenario has no graph, or the shape failed validation. A consumer must
       * leave whatever it already believed standing. In particular it must NOT be
       * read as evidence against an in-flight run the DRAFT TURN reported: the
       * two authorities answer different questions (a turn answers "did I start a
       * run?", a read answers "has a fact landed?"), and CEE keeps no in-flight
       * marker, so mid-run this leg can only ever say `never_run`. See
       * `canvas/hydrate/applyScenarioAnalysisRead.ts`, which is the ONLY
       * sanctioned consumer.
       */
      analysisState: AnalysisStateV1 | null
      /**
       * ROADMAP 2.1271 — the `analysis_result` block for the fact the verdict
       * selected, present ONLY on a `complete_current` verdict (CEE withholds it
       * on a stale one, because those numbers describe a graph the user has since
       * changed). `null` means no CURRENT result is being delivered — never "the
       * analysis is empty".
       *
       * Deliberately typed `unknown`: the block is handed to `mapV5AnalysisToReport`
       * — the SAME mapper the turn path uses — and a second local shape
       * declaration here would be a mirror of the block contract.
       */
      analysisResult: unknown
      requestId: string | null
    }
  /** 200, `graph_present:false` — the scenario exists and has no graph yet. Normal. */
  | { status: 'absent'; requestId: string | null }
  /** 404 — absent ∪ not-yours ∪ oracle-unresolvable. NEVER deletion. */
  | { status: 'notReadable' }
  /** 503 after every attempt — unknown, try again. NEVER an empty canvas. */
  | { status: 'unavailable' }
  /**
   * 401 and CEE says the token is the problem. Distinct from `refused`
   * BECAUSE THE RECOVERY IS DIFFERENT: signing in fixes this and retrying
   * cannot (CEE sets `retryable: false`). Collapsing the two is how a signed-in
   * user got a silent hydration failure and no prompt.
   */
  | { status: 'signInRequired' }
  /** 401 / 403 / 429 — a stable refusal; not retried. */
  | { status: 'refused'; httpStatus: number }
  /** Transport failure, unparseable body, or a shape that contradicts itself. */
  | { status: 'unusable' }

export interface FetchScenarioGraphOptions {
  /** Supabase user id. Omitted for guest/unowned scenarios. */
  userId?: string | null
  /**
   * Supabase access token. Sent as `Authorization: Bearer …` so CEE can DERIVE
   * identity from the verified `sub` instead of trusting the body. Null for
   * guests, who have no session — see the identity note in `fetchScenarioGraph`.
   */
  accessToken?: string | null
  signal?: AbortSignal
  /** Backoff between 503 retries. Tests pass 0. */
  retryDelayMs?: number
  /** Per-attempt deadline. See `DEFAULT_TIMEOUT_MS`. */
  timeoutMs?: number
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

/**
 * ROADMAP 2.1271 — parse CEE's verdict with the CONTRACT, never a local mirror.
 *
 * `AnalysisStateV1Schema` is `.strict()` at every level and its `run_state` is a
 * discriminated union, so an unknown kind or an extra key FAILS rather than
 * handing a consumer a shape it will read as authority — the same discipline
 * `applyV5State` applies on the turn path, using the same schema object.
 *
 * A parse failure returns `null`, i.e. "CEE did not answer". That is deliberately
 * the same value as absence here, and it is safe ONLY because the single consumer
 * treats `null` as "leave what you believed standing" rather than as a state.
 */
function readAnalysisState(raw: unknown): AnalysisStateV1 | null {
  if (raw === null || raw === undefined) return null
  const parsed = AnalysisStateV1Schema.safeParse(raw)
  if (parsed.success) return parsed.data
  logger.warn('scenario_graph.analysis_state_invalid_shape', {
    issueCount: parsed.error.issues.length,
  })
  return null
}

/**
 * The `analysis_result` block, gated on its own discriminator.
 *
 * Not validated further on purpose: `mapV5AnalysisToReport` is the block
 * contract's one consumer and restating its shape here would be a mirror of it
 * (trap 12). But the TYPE TAG is checked, so a future CEE key landing on this
 * name cannot be forwarded to a mapper written for a different block.
 */
function readAnalysisResultBlock(raw: unknown): unknown {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null
  const type = (raw as { type?: unknown }).type
  if (type !== 'analysis_result') {
    logger.warn('scenario_graph.analysis_result_unexpected_type', {
      receivedType: typeof type === 'string' ? type : typeof type,
    })
    return null
  }
  return raw
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
    notModelled: parseNotModelled(b.not_modelled),
    identity: readIdentityEnvelope(b.graph_identity_hash),
    layoutPresent: b.layout_present === true,
    // ROADMAP 2.1271 — PARSED, NOT TRUSTED, and by the SAME `.strict()`
    // discriminated-union schema `v5/applyV5State.ts` uses on the turn path. A
    // malformed verdict yields `null` ("CEE did not answer") rather than a shape
    // a consumer would read as authority. There is deliberately no local mirror
    // of the vocabulary here.
    analysisState: readAnalysisState(b.analysis_state),
    // Handed through opaque: the ONLY reader is `mapV5AnalysisToReport`, which
    // already owns the block contract. Presence is gated on the discriminator
    // being the one block type this leg may carry, so a future CEE key cannot
    // arrive here as an unlabelled object.
    analysisResult: readAnalysisResultBlock(b.analysis_result),
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

  // ── IDENTITY: the TOKEN is the authority; the body is the legacy fallback ──
  //
  // ⚠ AN EARLIER VERSION OF THIS COMMENT SAID `CEE_REQUIRE_USER_JWT` IS OFF ON
  //   STAGING. IT IS ON — measured at the deployed boot log (`require_user_jwt:
  //   true`) and on the wire (a JWT-shaped invalid Bearer answers 401
  //   `validator: "user_jwt"`, a branch only reachable with the flag on).
  //
  // What that changes: when we send a token, CEE verifies it and DERIVES
  // identity from the `sub`, ignoring any body `user_id`. When we send none,
  // CEE resolves `service_legacy` and the body `user_id` is the ONLY identity —
  // which is why this call kept working while the comment was wrong, and why
  // the body field is still sent here. It is not redundant yet: CEE's strip of
  // caller-asserted identity on these routes lands only after this half is
  // deployed and a signed-in user is witnessed resolving `verified`.
  //
  // Guests have no session, so both values are null, no auth header is emitted
  // and the request is byte-identical to before this change.
  const identityUserId = sanitiseUserId(opts.userId)

  const body: Record<string, unknown> = {}
  if (identityUserId !== null) {
    body.user_id = identityUserId
  }

  // ONE builder, shared with the turn path (`src/v5/turnAuthHeaders.ts`) — a
  // second way of turning a session into headers is how two answers to one
  // identity question get into a codebase.
  const authHeaders = buildTurnAuthHeaders({
    userId: identityUserId,
    accessToken: opts.accessToken ?? null,
  })

  const url = scenarioGraphUrl(scenarioId)

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // One deadline per attempt, chained to any caller signal so an unmount
    // still cancels immediately.
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const attemptController = new AbortController()
    const onCallerAbort = () => attemptController.abort()
    if (opts.signal) {
      if (opts.signal.aborted) return { status: 'unusable' }
      opts.signal.addEventListener('abort', onCallerAbort, { once: true })
    }
    const timer =
      timeoutMs > 0 ? setTimeout(() => attemptController.abort(), timeoutMs) : null

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body),
        signal: attemptController.signal,
      })
    } catch (err) {
      // Transport failure — offline, CORS, TLS, deadline, or caller abort.
      // Unknown, never absent.
      if ((err as Error)?.name === 'AbortError') {
        logger.warn('scenario_graph.aborted', {
          attempt,
          timedOut: !opts.signal?.aborted,
        })
        return { status: 'unusable' }
      }
      logger.warn('scenario_graph.transport_failure', {
        attempt,
        error: (err as Error)?.message ?? 'unknown',
      })
      return { status: 'unusable' }
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

    // CONSUMER NOTE 3: this is "not readable", not "deleted". The caller must
    // leave the canvas alone.
    if (response.status === 404) return { status: 'notReadable' }

    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429
    ) {
      // Checked BEFORE the generic arm: the body distinguishes "your token is
      // bad" from "you are not allowed", and only the first is recoverable by
      // the user. Reading the body is safe here — a refusal body is small and
      // the failure mode of an unparseable one is the generic refusal below.
      let body: unknown = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (isSignInRequired(response.status, body)) {
        logger.warn('scenario_graph.sign_in_required', { attempt })
        return { status: 'signInRequired' }
      }
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
