/**
 * modelVersions — the UI's client for CEE's scenario-addressed VERSIONS.
 *
 * Server contract: olumi-assistants-service `assist.v1.scenario-versions.ts`
 * (the Model Management wiring slice):
 *   POST /assist/v1/scenarios/{id}/versions          → model_versions_list.v1
 *   POST /assist/v1/scenarios/{id}/versions/save     → model_version_save.v1
 *   POST /assist/v1/scenarios/{id}/versions/restore  → model_version_restore.v1
 * reached from the browser as `/bff/cee/scenarios/{id}/versions[...]`.
 *
 * THE TRANSPORT RULES ARE scenarioGraph.ts's, INHERITED IN FULL — see that
 * file's header for why the base is a LITERAL same-origin constant and never
 * `VITE_CEE_BFF_BASE` (that var is dashboard-baked to an absolute PLoT URL;
 * resolving from it would leave the edge seam entirely and 404 on a service
 * that has never heard of versions — CLAUDE.md trap 18 in its live form).
 * Identity travels in the BODY (`user_id`), never a URL; the guest sentinel
 * is never sent as a user id.
 *
 * WHAT THIS CLIENT NEVER SENDS: a graph. A version is a snapshot of the
 * SERVER's shared model — save versions `scenarios.graph` server-side, and
 * restore copies the STORED version's graph server-side. The request schemas
 * have nowhere to put client bytes, and this client never tries.
 *
 * WRITES ARE NEVER AUTO-RETRIED. A restore is idempotent-converging
 * server-side (the RPC dedupes; the graph write re-runs), so retrying is
 * SAFE — but it is the USER's decision, surfaced through the typed
 * `incomplete` / `conflict` outcomes, never the transport's.
 */

import { logger } from '../../lib/logger'

/** The same-origin Netlify edge path. NOT `VITE_CEE_BFF_BASE` — see header. */
export const MODEL_VERSIONS_BASE = '/bff/cee'

/** The guest sentinel `AuthContext` mints; never a Supabase user id. */
const GUEST_USER_ID = 'guest'

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
  /** 'user_save' | 'commit' | 'pre_restore' | 'restore' — rendered, not branched on. */
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
  /** The version row was recorded but the working graph write failed.
   *  Retrying the same restore CONVERGES server-side. */
  | { status: 'incomplete' }
  | { status: 'notReadable' }
  | { status: 'disabled' }
  | { status: 'unavailable' }
  | { status: 'refused'; httpStatus: number }
  | { status: 'unusable' }

interface CommonOptions {
  /** Supabase user id. Omitted for guests. */
  userId?: string | null
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
  if (typeof userId === 'string' && userId.length > 0 && userId !== GUEST_USER_ID) {
    body.user_id = userId
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
      headers: { 'Content-Type': 'application/json' },
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
  | { status: 'unusable' }
  | null {
  if (outcome.kind === 'transportFailure') return { status: 'unusable' }
  if (outcome.kind === 'ok') return null
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

function parseSummary(raw: unknown): ServerModelVersion | null {
  if (raw === null || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = row.id
  const versionNumber = row.version_number
  const createdAt = row.created_at
  const hash = row.graph_identity_hash
  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof versionNumber !== 'number' || !Number.isInteger(versionNumber)) return null
  if (typeof createdAt !== 'string' || createdAt.length === 0) return null
  if (typeof hash !== 'string' || hash.length === 0) return null
  return {
    id,
    versionNumber,
    label: typeof row.label === 'string' && row.label.length > 0 ? row.label : null,
    provenance:
      typeof row.provenance === 'string' && row.provenance.length > 0 ? row.provenance : null,
    restoredFromVersionId:
      typeof row.restored_from_version_id === 'string' &&
      row.restored_from_version_id.length > 0
        ? row.restored_from_version_id
        : null,
    createdAt,
    graphIdentityHash: hash,
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
  if (b.schema !== 'model_versions_list.v1') {
    logger.warn('model_versions.unexpected_schema', { schema: String(b.schema) })
    return { status: 'unusable' }
  }
  if (!Array.isArray(b.versions)) return { status: 'unusable' }

  const versions: ServerModelVersion[] = []
  for (const raw of b.versions) {
    const parsed = parseSummary(raw)
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
    if (outcome.status === 401 && code === 'SIGN_IN_REQUIRED') return { status: 'signInRequired' }
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
    if (outcome.status === 401 && code === 'SIGN_IN_REQUIRED') return { status: 'signInRequired' }
    if (outcome.status === 409) return { status: 'conflict' }
    if (outcome.status === 404 && code === 'VERSION_NOT_FOUND') return { status: 'versionNotFound' }
    if (outcome.status === 503 && code === 'RESTORE_INCOMPLETE') return { status: 'incomplete' }
  }
  const refusal = sharedRefusal(outcome)
  if (refusal) return refusal
  const body = (outcome as { kind: 'ok'; body: unknown }).body

  if (body === null || typeof body !== 'object') return { status: 'unusable' }
  const b = body as Record<string, unknown>
  if (b.schema !== 'model_version_restore.v1') return { status: 'unusable' }
  if (b.restored !== true) return { status: 'unusable' }
  const version = parseWriteOutcome(b.version)
  if (version === null) return { status: 'unusable' }

  // The graph is what the reconcile applies. A restore claim WITHOUT the
  // graph must never be applied blind — refuse the shape instead.
  const graph = b.graph
  if (graph === null || typeof graph !== 'object') {
    logger.warn('model_versions.restore_without_graph_refused', { scenarioId })
    return { status: 'unusable' }
  }

  return {
    status: 'restored',
    graph,
    deduped: b.deduped === true,
    version,
    undoVersionId:
      typeof b.undo_version_id === 'string' && b.undo_version_id.length > 0
        ? b.undo_version_id
        : null,
    requestId: typeof b.request_id === 'string' ? b.request_id : null,
  }
}
