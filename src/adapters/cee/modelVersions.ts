/**
 * modelVersions — the UI's client for CEE's scenario-addressed VERSIONS.
 *
 * Server contract: olumi-assistants-service `assist.v1.scenario-versions.ts`
 * (the Model Management wiring slice):
 *   POST /assist/v1/scenarios/{id}/versions          → model_versions_list.v2
 *   POST /assist/v1/scenarios/{id}/versions/save     → model_version_save.v1
 *   POST /assist/v1/scenarios/{id}/versions/restore  → model_version_restore.v2
 *
 * ⚠ LIST AND RESTORE ARE v2; SAVE IS STILL v1. That is not an inconsistency to
 * tidy — it is the server's actual posture, derived at CEE staging
 * `3c3d3d53` (== deployed `/healthz` build `3c3d3d5`),
 * `assist.v1.scenario-versions.ts:115-118`. Changing save would break the one
 * leg that works.
 *
 * THE v2 BUMP MOVED THE SHAPE, NOT ONLY THE LABEL. On restore, the top-level
 * `graph`, `version` and `undo_version_id` are GONE; they now live inside a
 * nested `receipt` (`model_version_mutation_receipt.v1`), and the version
 * ordinal is spelled `sequence` there, not `version_number`. On list, rows are
 * `version_id`/`sequence`/`full_hash` with structured `actor`/`creation`/
 * `lineage`, not `id`/`version_number`/`graph_identity_hash`/`provenance`.
 *
 * v2-ONLY, DELIBERATELY — NOT a compatibility path. A whole-repo sweep of CEE
 * at that SHA finds ZERO `model_versions_list.v1` / `model_version_restore.v1`
 * literals (contrast controls in the same sweep: 7 v2 literals, 2
 * `model_version_save.v1`), and the route does no content negotiation — it
 * sends one hardcoded discriminator per response. There is no live v1 producer
 * for these two calls, so accepting v1 would be a branch with nothing to serve
 * it, and this file would carry a compatibility path with no deletion
 * condition. If a v1 producer is ever demonstrated, that is the moment to add
 * one — with its deletion condition written beside it.
 * reached from the browser as `/bff/cee/scenarios/{id}/versions[...]`.
 *
 * THE TRANSPORT RULES ARE scenarioGraph.ts's, INHERITED IN FULL — see that
 * file's header for why the base is a LITERAL same-origin constant and never
 * `VITE_CEE_BFF_BASE` (that var is dashboard-baked to an absolute PLoT URL;
 * resolving from it would leave the edge seam entirely and 404 on a service
 * that has never heard of versions — CLAUDE.md trap 18 in its live form).
 * Identity travels as a VERIFIED TOKEN (`Authorization: Bearer …`), with the
 * body `user_id` retained as the legacy fallback until CEE strips it. Never a
 * URL; the guest sentinel is never sent as a user id, in either channel.
 *
 * WHAT THIS CLIENT NEVER SENDS: a graph. A version is a snapshot of the
 * SERVER's shared model — save versions `scenarios.graph` server-side, and
 * restore copies the STORED version's graph server-side. The request schemas
 * have nowhere to put client bytes, and this client never tries.
 *
 * WRITES ARE NEVER AUTO-RETRIED. Retrying a partial restore is SAFE (no
 * data loss either way) but it is the USER's decision, surfaced through the
 * typed `incomplete` / `conflict` outcomes, never the transport's — and the
 * mechanism matters (measured, review of #744): a retry with the SAME
 * expected head hash answers 409 (the server's own pre-restore machinery
 * already moved the head), so a bare transport retry would spin on
 * conflicts. A retry AFTER re-reading the list (fresh head hash) completes
 * the restore, at the cost of two more appended version rows per attempt.
 * The section refreshes the list on `incomplete`/`conflict` for exactly
 * this reason.
 */

import { logger } from '../../lib/logger'
import { sanitiseUserId } from '../../lib/guestIdentity'
import { isSignInRequired } from './signInRefusal'
import { buildTurnAuthHeaders } from '../../v5/turnAuthHeaders'

/** The same-origin Netlify edge path. NOT `VITE_CEE_BFF_BASE` — see header. */
export const MODEL_VERSIONS_BASE = '/bff/cee'


/** Per-attempt deadline — same bound and rationale as scenarioGraph.ts. */
const DEFAULT_TIMEOUT_MS = 8000

export function modelVersionsUrl(
  scenarioId: string,
  leaf?: 'save' | 'restore',
): string {
  const base = `${MODEL_VERSIONS_BASE}/scenarios/${encodeURIComponent(scenarioId)}/versions`
  return leaf === undefined ? base : `${base}/${leaf}`
}

/** One server-side version, as the UI consumes it. */
export interface ServerModelVersion {
  id: string
  versionNumber: number
  label: string | null
  /**
   * v2 `creation.kind`: 'initial' | 'committed_mutation' | 'restore' |
   * 'variant_creation' | 'variant_promotion' | 'unknown' — rendered, not
   * branched on.
   *
   * ⚠ THE VOCABULARY CHANGED WITH v2. v1 spelled this
   * 'user_save' | 'commit' | 'pre_restore' | 'restore' as a flat string; v2
   * has no such field and models creation as a discriminated union. These are
   * two different vocabularies answering two different questions, so this
   * carries `creation.kind` VERBATIM rather than inventing a translation back
   * to the retired v1 words. Safe to do because a sweep of `src` (excluding
   * tests) finds NO consumer of this field or of `restoredFromVersionId`
   * outside this adapter — nothing renders or branches on either today. Any
   * future renderer must be written against the v2 words above.
   */
  provenance: string | null
  restoredFromVersionId: string | null
  /** ISO timestamp from the server row. */
  createdAt: string
  /** CEE's opaque identity token for this version — the CAS expectation. */
  graphIdentityHash: string
}

export interface ServerVersionWriteOutcome {
  versionId: string
  versionNumber: number
  deduped: boolean
}

export type ListModelVersionsResult =
  | {
      status: 'list'
      versions: ServerModelVersion[]
      currentVersionId: string | null
      requestId: string | null
    }
  /** 404 — absent ∪ not-yours ∪ oracle-unresolvable. NEVER deletion. */
  | { status: 'notReadable' }
  /**
   * 401 sign-in refusal. LIST had no such branch before: a guest listing was
   * an empty list, so the only 401 reachable here was one the UI could not
   * produce. Sending a token makes an expired one reachable on every call.
   */
  | { status: 'signInRequired' }
  /** 503 VERSIONS_DISABLED — versioning is off on this service. */
  | { status: 'disabled' }
  /** 503 (plain) — unknown, try again. */
  | { status: 'unavailable' }
  | { status: 'refused'; httpStatus: number }
  | { status: 'unusable' }

export type SaveModelVersionResult =
  | { status: 'saved'; version: ServerVersionWriteOutcome }
  | { status: 'signInRequired' }
  | { status: 'conflict' }
  | { status: 'nothingToSave' }
  | { status: 'notReadable' }
  | { status: 'disabled' }
  | { status: 'unavailable' }
  | { status: 'refused'; httpStatus: number }
  | { status: 'unusable' }

export type RestoreModelVersionResult =
  | {
      status: 'restored'
      /** The restored graph EXACTLY as the server persisted it — the input to
       *  the receipt-class reconcile. Always an object on this arm. */
      graph: unknown
      deduped: boolean
      version: ServerVersionWriteOutcome
      /** The pre-restore snapshot — restore THIS to undo. Null when the
       *  server had nothing to snapshot. */
      undoVersionId: string | null
      requestId: string | null
    }
  | { status: 'signInRequired' }
  | { status: 'conflict' }
  | { status: 'versionNotFound' }
  /** The version row was recorded but the working graph write failed. A
   *  retry completes it ONLY with a re-read head hash (a same-hash retry
   *  409s; a refreshed retry appends two more version rows and lands the
   *  graph — no data loss either way). See the header. */
  | { status: 'incomplete' }
  | { status: 'notReadable' }
  | { status: 'disabled' }
  | { status: 'unavailable' }
  | { status: 'refused'; httpStatus: number }
  | { status: 'unusable' }

interface CommonOptions {
  /** Supabase user id. Omitted for guests. */
  userId?: string | null
  /**
   * Supabase access token. Sent as `Authorization: Bearer …` so CEE derives
   * identity from the verified `sub` instead of trusting the body. Null for
   * guests, who have no session.
   */
  accessToken?: string | null
  signal?: AbortSignal
  timeoutMs?: number
}

export interface RestoreOptions extends CommonOptions {
  versionId: string
  /** The head identity hash the user was shown — the CAS expectation. */
  expectedGraphIdentityHash?: string
  label?: string
}

export interface SaveOptions extends CommonOptions {
  label?: string
  expectedGraphIdentityHash?: string
}

function identityBody(userId: string | null | undefined): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const id = sanitiseUserId(userId)
  if (id !== null) {
    body.user_id = id
  }
  return body
}

function detailsCode(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return null
  const details = (body as Record<string, unknown>).details
  if (details === null || typeof details !== 'object') return null
  const code = (details as Record<string, unknown>).code
  return typeof code === 'string' ? code : null
}

type PostOutcome =
  | { kind: 'ok'; body: unknown }
  | { kind: 'http'; status: number; body: unknown }
  | { kind: 'transportFailure' }

/** One POST, one deadline, no retries. Every failure is a typed outcome. */
async function postOnce(
  url: string,
  payload: Record<string, unknown>,
  opts: CommonOptions,
): Promise<PostOutcome> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const onCallerAbort = () => controller.abort()
  if (opts.signal) {
    if (opts.signal.aborted) return { kind: 'transportFailure' }
    opts.signal.addEventListener('abort', onCallerAbort, { once: true })
  }
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Shared builder — see `src/v5/turnAuthHeaders.ts`. Guests: both values
        // null, no header emitted, byte-identical to before.
        ...buildTurnAuthHeaders({
          userId: sanitiseUserId(opts.userId),
          accessToken: opts.accessToken ?? null,
        }),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    logger.warn('model_versions.transport_failure', {
      error: (err as Error)?.message ?? 'unknown',
    })
    return { kind: 'transportFailure' }
  } finally {
    if (timer !== null) clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onCallerAbort)
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (response.ok) return { kind: 'ok', body }
  return { kind: 'http', status: response.status, body }
}

/** The refusal statuses shared by all three calls. Returns null for 200s. */
function sharedRefusal(
  outcome: PostOutcome,
):
  | { status: 'notReadable' }
  | { status: 'disabled' }
  | { status: 'unavailable' }
  | { status: 'refused'; httpStatus: number }
  | { status: 'signInRequired' }
  | { status: 'unusable' }
  | null {
  if (outcome.kind === 'transportFailure') return { status: 'unusable' }
  if (outcome.kind === 'ok') return null
  // BEFORE the status switch: a sign-in refusal is a 401, and the generic 401
  // arm below would otherwise swallow it into `refused` — which the callers
  // render as "try again", on a response CEE marks `retryable: false`.
  if (isSignInRequired(outcome.status, outcome.body)) return { status: 'signInRequired' }
  const code = detailsCode(outcome.body)
  switch (outcome.status) {
    case 404:
      return { status: 'notReadable' }
    case 503:
      return code === 'VERSIONS_DISABLED' ? { status: 'disabled' } : { status: 'unavailable' }
    case 401:
    case 403:
    case 429:
      return { status: 'refused', httpStatus: outcome.status }
    default:
      return { status: 'unusable' }
  }
}

/**
 * One `model_versions_list.v2` row → `ServerModelVersion`.
 *
 * Field mapping derived from CEE `history-v2.ts` (the wire schema) and
 * `assist.v1.scenario-versions.ts:169-241` (`summaryV2()`, the row→wire map):
 *   version_id → id · sequence → versionNumber · full_hash → graphIdentityHash
 *   creation.kind → provenance · creation.source_version_id →
 *   restoredFromVersionId (absent on the `initial`/`committed_mutation`/
 *   `unknown` arms of the union, which is why it is read defensively).
 * Returns null on anything that does not match, so the caller can fail CLOSED.
 */
function parseSummaryV2(raw: unknown): ServerModelVersion | null {
  if (raw === null || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = row.version_id
  const versionNumber = row.sequence
  const createdAt = row.created_at
  const hash = row.full_hash
  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof versionNumber !== 'number' || !Number.isInteger(versionNumber)) return null
  if (typeof createdAt !== 'string' || createdAt.length === 0) return null
  if (typeof hash !== 'string' || hash.length === 0) return null

  const creation =
    row.creation !== null && typeof row.creation === 'object'
      ? (row.creation as Record<string, unknown>)
      : null
  const creationKind = typeof creation?.kind === 'string' ? creation.kind : null
  const sourceVersionId =
    typeof creation?.source_version_id === 'string' &&
    (creation.source_version_id as string).length > 0
      ? (creation.source_version_id as string)
      : null

  return {
    id,
    versionNumber,
    label: typeof row.label === 'string' && row.label.length > 0 ? row.label : null,
    provenance: creationKind !== null && creationKind.length > 0 ? creationKind : null,
    restoredFromVersionId: sourceVersionId,
    createdAt,
    graphIdentityHash: hash,
  }
}

/**
 * `receipt` → `ServerVersionWriteOutcome`, for RESTORE v2 only.
 *
 * DELIBERATELY NOT `parseWriteOutcome`. That function answers "what did the
 * v1 SAVE envelope's `version` block say?" (`version_number`); this one
 * answers "what does the v2 restore RECEIPT say?" (`sequence`). Two questions,
 * two readers — collapsing them into one would be the same
 * similar-names/different-questions defect this codebase has paid for before.
 *
 * `deduped` is FALSE by construction: the v2 restore wire has no replay
 * signal. CEE computes `replayed` and only LOGS it
 * (`assist.v1.scenario-versions.ts`, restore handler); the response schema is
 * `.strict()` and CEE's own route test pins the exact top-level key set
 * ["analysis_state","receipt","request_id","restored","scenario_id","schema"].
 * Reporting `false` is the honest read of a signal that is not on the wire —
 * it is never used to CLAIM a replay happened, only to withhold the claim that
 * one did. The caller (ServerVersionsSection) then falls through to its
 * `changedNothing` branch, which says the server restored and invites a reload
 * rather than asserting nothing changed. Vaguer, still true, fails safe.
 */
function parseReceiptWriteOutcome(raw: unknown): ServerVersionWriteOutcome | null {
  if (raw === null || typeof raw !== 'object') return null
  const receipt = raw as Record<string, unknown>
  if (typeof receipt.version_id !== 'string' || receipt.version_id.length === 0) return null
  if (typeof receipt.sequence !== 'number' || !Number.isInteger(receipt.sequence)) return null
  return {
    versionId: receipt.version_id,
    versionNumber: receipt.sequence,
    deduped: false,
  }
}

function parseWriteOutcome(raw: unknown): ServerVersionWriteOutcome | null {
  if (raw === null || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.version_id !== 'string' || typeof row.version_number !== 'number') return null
  return {
    versionId: row.version_id,
    versionNumber: row.version_number,
    deduped: row.deduped === true,
  }
}

/** List the scenario's server-side versions. Never throws. */
export async function listModelVersions(
  scenarioId: string,
  opts: CommonOptions & { limit?: number } = {},
): Promise<ListModelVersionsResult> {
  const payload = identityBody(opts.userId)
  if (typeof opts.limit === 'number') payload.limit = opts.limit

  const outcome = await postOnce(modelVersionsUrl(scenarioId), payload, opts)
  const refusal = sharedRefusal(outcome)
  if (refusal) return refusal
  const body = (outcome as { kind: 'ok'; body: unknown }).body

  if (body === null || typeof body !== 'object') return { status: 'unusable' }
  const b = body as Record<string, unknown>
  if (b.schema !== 'model_versions_list.v2') {
    logger.warn('model_versions.unexpected_schema', { schema: String(b.schema) })
    return { status: 'unusable' }
  }
  if (!Array.isArray(b.versions)) return { status: 'unusable' }

  const versions: ServerModelVersion[] = []
  for (const raw of b.versions) {
    const parsed = parseSummaryV2(raw)
    // Fail CLOSED on a malformed row: a silently shortened history would
    // misrepresent what exists to be restored.
    if (parsed === null) {
      logger.warn('model_versions.malformed_row_refused', { scenarioId })
      return { status: 'unusable' }
    }
    versions.push(parsed)
  }

  return {
    status: 'list',
    versions,
    currentVersionId:
      typeof b.current_version_id === 'string' && b.current_version_id.length > 0
        ? b.current_version_id
        : null,
    requestId: typeof b.request_id === 'string' ? b.request_id : null,
  }
}

/** Save the SERVER's current graph as a named version. Never throws. */
export async function saveModelVersion(
  scenarioId: string,
  opts: SaveOptions = {},
): Promise<SaveModelVersionResult> {
  const payload = identityBody(opts.userId)
  if (typeof opts.label === 'string' && opts.label.trim().length > 0) {
    payload.label = opts.label.trim().slice(0, 200)
  }
  if (opts.expectedGraphIdentityHash !== undefined) {
    payload.expected_graph_identity_hash = opts.expectedGraphIdentityHash
  }

  const outcome = await postOnce(modelVersionsUrl(scenarioId, 'save'), payload, opts)

  if (outcome.kind === 'http') {
    const code = detailsCode(outcome.body)
    if (outcome.status === 409) return { status: 'conflict' }
    if (outcome.status === 422 && code === 'NOTHING_TO_SAVE') return { status: 'nothingToSave' }
  }
  const refusal = sharedRefusal(outcome)
  if (refusal) return refusal
  const body = (outcome as { kind: 'ok'; body: unknown }).body

  if (body === null || typeof body !== 'object') return { status: 'unusable' }
  const b = body as Record<string, unknown>
  if (b.schema !== 'model_version_save.v1') return { status: 'unusable' }
  const version = parseWriteOutcome(b.version)
  if (version === null) return { status: 'unusable' }
  return { status: 'saved', version }
}

/** Restore a stored version into the scenario's working graph. Never throws. */
export async function restoreModelVersion(
  scenarioId: string,
  opts: RestoreOptions,
): Promise<RestoreModelVersionResult> {
  const payload = identityBody(opts.userId)
  payload.version_id = opts.versionId
  if (opts.expectedGraphIdentityHash !== undefined) {
    payload.expected_graph_identity_hash = opts.expectedGraphIdentityHash
  }
  if (typeof opts.label === 'string' && opts.label.trim().length > 0) {
    payload.label = opts.label.trim().slice(0, 200)
  }

  const outcome = await postOnce(modelVersionsUrl(scenarioId, 'restore'), payload, opts)

  if (outcome.kind === 'http') {
    const code = detailsCode(outcome.body)
    if (outcome.status === 409) return { status: 'conflict' }
    if (outcome.status === 404 && code === 'VERSION_NOT_FOUND') return { status: 'versionNotFound' }
    if (outcome.status === 503 && code === 'RESTORE_INCOMPLETE') return { status: 'incomplete' }
  }
  const refusal = sharedRefusal(outcome)
  if (refusal) return refusal
  const body = (outcome as { kind: 'ok'; body: unknown }).body

  if (body === null || typeof body !== 'object') return { status: 'unusable' }
  const b = body as Record<string, unknown>
  if (b.schema !== 'model_version_restore.v2') return { status: 'unusable' }
  if (b.restored !== true) return { status: 'unusable' }

  // v2 nests the mutation outcome in `receipt`. Everything the caller applies
  // is read from THERE — never from the top level, which no longer carries it.
  const receipt =
    b.receipt !== null && typeof b.receipt === 'object'
      ? (b.receipt as Record<string, unknown>)
      : null
  if (receipt === null) {
    logger.warn('model_versions.restore_without_receipt_refused', { scenarioId })
    return { status: 'unusable' }
  }
  const version = parseReceiptWriteOutcome(receipt)
  if (version === null) return { status: 'unusable' }

  // The graph is what the reconcile applies. A restore claim WITHOUT the
  // graph must never be applied blind — refuse the shape instead.
  const graph = receipt.graph
  if (graph === null || typeof graph !== 'object') {
    logger.warn('model_versions.restore_without_graph_refused', { scenarioId })
    return { status: 'unusable' }
  }

  return {
    status: 'restored',
    graph,
    // See `parseReceiptWriteOutcome`: v2 carries no replay signal on the wire.
    deduped: false,
    version,
    undoVersionId:
      typeof receipt.undo_version_id === 'string' && receipt.undo_version_id.length > 0
        ? receipt.undo_version_id
        : null,
    requestId: typeof b.request_id === 'string' ? b.request_id : null,
  }
}
