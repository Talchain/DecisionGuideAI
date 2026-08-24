/**
 * modelVersions — the UI's client for CEE's scenario-addressed VERSIONS.
 *
 * Server contract: olumi-assistants-service `assist.v1.scenario-versions.ts`
 * (the Model Management wiring slice):
 *   POST /assist/v1/scenarios/{id}/versions          → model_versions_list.v2
 *   POST /assist/v1/scenarios/{id}/versions/save     → model_version_save.v1
 *   POST /assist/v1/scenarios/{id}/versions/restore  → model_version_restore.v2
 *   POST /assist/v1/scenarios/{id}/versions/compare  → model_version_diff.v1
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
 * WRITES ARE NEVER AUTO-RETRIED. Restore is an atomic, mutation-id-bound
 * transaction: a receipt is the only success shape, stale CAS is explicit,
 * and reusing one mutation id for another target is refused. An uncertain
 * transport outcome therefore keeps the same mutation id for a user retry;
 * the transport never decides to repeat a write itself.
 */

import {
  AnalysisStateV1Schema,
  type AnalysisStateV1,
} from '@talchain/schemas/boundary'
import { logger } from '../../lib/logger'
import {
  ModelVersionMutationReceiptV1Schema,
  type ModelVersionMutationReceiptV1,
} from '../../v5/modelVersionMutationReceipt'

/** The same-origin Netlify edge path. NOT `VITE_CEE_BFF_BASE` — see header. */
export const MODEL_VERSIONS_BASE = '/bff/cee'

/** The guest sentinel `AuthContext` mints; never a Supabase user id. */
const GUEST_USER_ID = 'guest'

/** Per-attempt deadline — same bound and rationale as scenarioGraph.ts. */
const DEFAULT_TIMEOUT_MS = 8000

export function modelVersionsUrl(
  scenarioId: string,
  leaf?: 'save' | 'restore' | 'compare',
): string {
  const base = `${MODEL_VERSIONS_BASE}/scenarios/${encodeURIComponent(scenarioId)}/versions`
  return leaf === undefined ? base : `${base}/${leaf}`
}

export type ModelVersionActor =
  | { kind: 'known'; authoredBy: 'owner' | 'assistant' | string }
  | { kind: 'system' }
  | { kind: 'unknown' }

export type ModelVersionCreation =
  | {
      kind: 'initial' | 'committed_mutation' | 'unknown'
      mutationId: string | null
      sourceTurnId: string | null
    }
  | {
      kind: 'restore' | 'variant_creation' | 'variant_promotion'
      sourceVersionId: string
      mutationId: string | null
      sourceTurnId: string | null
    }

export type ModelVersionLineage =
  | { kind: 'known'; parentVersionId: string | null; rootVersionId: string }
  | { kind: 'unknown' }

/** One server-side version, as the UI consumes it. */
export interface ServerModelVersion {
  contractVersion: 'v1-compat' | 'v2'
  id: string
  scenarioId: string
  versionNumber: number
  label: string | null
  /** Legacy v1 creation mechanism only. Never actor/source metadata. */
  provenance: string | null
  restoredFromVersionId: string | null
  /** ISO timestamp from the server row. */
  createdAt: string
  /** Full canonical model identity. */
  graphIdentityHash: string
  analysisAffectingHash: string | null
  actor: ModelVersionActor
  creation: ModelVersionCreation
  lineage: ModelVersionLineage
}

export interface ServerVersionWriteOutcome {
  versionId: string
  versionNumber: number
  deduped: boolean
}

export type ModelVersionDiffEntityKind =
  | 'model'
  | 'node'
  | 'edge'
  | 'option'
  | 'constraint'

export type ModelVersionDiffChangeKind = 'added' | 'removed' | 'changed'

export interface ModelVersionDiffChange {
  entityKind: ModelVersionDiffEntityKind
  entityId: string | null
  label: string | null
  path: string
  changeKind: ModelVersionDiffChangeKind
  beforeDisplay: string | null
  afterDisplay: string | null
  summary: string
  whyItMatters: string
}

export const MODEL_VERSION_DIFF_CATEGORIES = [
  'structure',
  'relationships',
  'values_uncertainty',
  'evidence_provenance',
  'goals_constraints_options',
  'assumptions_claims',
  'presentation',
  'other_model_fields',
] as const

export type ModelVersionDiffCategory = (typeof MODEL_VERSION_DIFF_CATEGORIES)[number]
export type ModelVersionDiffCategories = Record<ModelVersionDiffCategory, ModelVersionDiffChange[]>

/**
 * UI projection of the planned ModelVersionDiffV1 contract. It contains only
 * deterministic server diff fields. The contract does not carry a trustworthy
 * person display identity, so the UI labels change authorship Unknown rather
 * than inferring it from provenance or the authenticated viewer.
 */
export interface ModelVersionDiffV1 {
  schema: 'model_version_diff.v1'
  scenarioId: string
  fromVersionId: string
  toVersionId: string
  relation: 'identical' | 'different'
  fromFullHash: string
  toFullHash: string
  analysisEquivalent: boolean
  categories: ModelVersionDiffCategories
  coverage: {
    knownUndetectable: string[]
    knownUninterpretedPaths: string[]
  }
}

export type ListModelVersionsResult =
  | {
      status: 'list'
      versions: ServerModelVersion[]
      contractVersion: 'v1-compat' | 'v2'
      nextCursor: string | null
      /** Exact server carrier. A paged head need not be present in this page. */
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
      /** Verbatim strict carrier; also the sole full-graph reconcile input. */
      receipt: ModelVersionMutationReceiptV1
      /** Null means the producer could not attest a new verdict. Retain the
       * existing state; never derive freshness from either hash. */
      analysisState: AnalysisStateV1 | null
      requestId: string
    }
  | { status: 'signInRequired' }
  | { status: 'conflict' }
  | { status: 'mutationIdReused' }
  | { status: 'versionNotFound' }
  | { status: 'notReadable' }
  | { status: 'disabled' }
  | { status: 'unavailable' }
  | { status: 'refused'; httpStatus: number }
  | { status: 'unusable' }

export type CompareModelVersionsResult =
  | { status: 'compared'; diff: ModelVersionDiffV1; requestId: string | null }
  | { status: 'signInRequired' }
  | { status: 'sameVersion' }
  | { status: 'versionNotFound' }
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
  mutationId: string
  /** Null when the list contract does not expose a licensed current head. */
  expectedGraphIdentityHash: string | null
  label?: string
}

export interface SaveOptions extends CommonOptions {
  label?: string
  expectedGraphIdentityHash?: string
}

export interface CompareOptions extends CommonOptions {
  fromVersionId: string
  toVersionId: string
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LOWER_SHA256_RE = /^[0-9a-f]{64}$/
const ISO_WITH_OFFSET_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function isLowerSha256(value: unknown): value is string {
  return typeof value === 'string' && LOWER_SHA256_RE.test(value)
}

function isIsoDateTimeWithOffset(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_WITH_OFFSET_RE.test(value) &&
    !Number.isNaN(new Date(value).getTime())
  )
}

function parseActorV2(raw: unknown): ModelVersionActor | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (row.kind === 'unknown' || row.kind === 'system') {
    return hasExactKeys(row, ['kind']) ? { kind: row.kind } : null
  }
  if (row.kind !== 'known' || !hasExactKeys(row, ['kind', 'authored_by'])) return null
  if (row.authored_by !== 'owner' && row.authored_by !== 'assistant' && !isUuid(row.authored_by)) {
    return null
  }
  return { kind: 'known', authoredBy: row.authored_by }
}

function parseCreationV2(raw: unknown): ModelVersionCreation | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const mutationId = row.mutation_id
  if (mutationId !== null && !isUuid(mutationId)) return null
  const sourceTurnId = row.source_turn_id
  if (sourceTurnId !== null && (typeof sourceTurnId !== 'string' || sourceTurnId.trim().length === 0)) {
    return null
  }
  if (row.kind === 'initial' || row.kind === 'committed_mutation' || row.kind === 'unknown') {
    if (!hasExactKeys(row, ['kind', 'mutation_id', 'source_turn_id'])) return null
    return { kind: row.kind, mutationId, sourceTurnId }
  }
  if (
    row.kind !== 'restore' &&
    row.kind !== 'variant_creation' &&
    row.kind !== 'variant_promotion'
  ) {
    return null
  }
  if (!hasExactKeys(row, ['kind', 'source_version_id', 'mutation_id', 'source_turn_id'])) return null
  if (!isUuid(row.source_version_id)) return null
  return {
    kind: row.kind,
    sourceVersionId: row.source_version_id,
    mutationId,
    sourceTurnId,
  }
}

function parseLineageV2(raw: unknown): ModelVersionLineage | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (row.kind === 'unknown') {
    return hasExactKeys(row, ['kind']) ? { kind: 'unknown' } : null
  }
  if (row.kind !== 'known' || !hasExactKeys(row, ['kind', 'parent_version_id', 'root_version_id'])) {
    return null
  }
  if (row.parent_version_id !== null && !isUuid(row.parent_version_id)) return null
  if (!isUuid(row.root_version_id)) return null
  return {
    kind: 'known',
    parentVersionId: row.parent_version_id,
    rootVersionId: row.root_version_id,
  }
}

function parseSummaryV2(raw: unknown, expectedScenarioId: string): ServerModelVersion | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (
    !hasExactKeys(row, [
      'version_id',
      'scenario_id',
      'sequence',
      'created_at',
      'label',
      'actor',
      'creation',
      'lineage',
      'full_hash',
      'analysis_affecting_hash',
    ])
  ) {
    return null
  }
  if (!isUuid(row.version_id) || row.scenario_id !== expectedScenarioId) return null
  if (typeof row.sequence !== 'number' || !Number.isInteger(row.sequence) || row.sequence < 1) {
    return null
  }
  if (!isIsoDateTimeWithOffset(row.created_at)) return null
  if (row.label !== null && typeof row.label !== 'string') return null
  if (!isLowerSha256(row.full_hash) || !isLowerSha256(row.analysis_affecting_hash)) return null
  const actor = parseActorV2(row.actor)
  const creation = parseCreationV2(row.creation)
  const lineage = parseLineageV2(row.lineage)
  if (actor === null || creation === null || lineage === null) return null
  return {
    contractVersion: 'v2',
    id: row.version_id,
    scenarioId: expectedScenarioId,
    versionNumber: row.sequence,
    label: row.label,
    provenance: null,
    restoredFromVersionId:
      creation.kind === 'restore' ? creation.sourceVersionId : null,
    createdAt: row.created_at,
    graphIdentityHash: row.full_hash,
    analysisAffectingHash: row.analysis_affecting_hash,
    actor,
    creation,
    lineage,
  }
}

/** Explicit temporary compatibility arm for the deployed list.v1 contract. */
function parseSummaryV1Compat(raw: unknown, expectedScenarioId: string): ServerModelVersion | null {
  if (raw === null || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = row.id
  const versionNumber = row.version_number
  const createdAt = row.created_at
  const hash = row.graph_identity_hash
  if (!isUuid(id) || row.scenario_id !== expectedScenarioId) return null
  if (typeof versionNumber !== 'number' || !Number.isInteger(versionNumber) || versionNumber < 1) {
    return null
  }
  if (!isIsoDateTimeWithOffset(createdAt)) return null
  if (!isLowerSha256(hash)) return null
  return {
    contractVersion: 'v1-compat',
    id,
    scenarioId: expectedScenarioId,
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
    analysisAffectingHash: null,
    actor: { kind: 'unknown' },
    creation: { kind: 'unknown', mutationId: null, sourceTurnId: null },
    lineage: { kind: 'unknown' },
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

const DIFF_ENTITY_KINDS: readonly ModelVersionDiffEntityKind[] = [
  'model',
  'node',
  'edge',
  'option',
  'constraint',
]
const DIFF_CHANGE_KINDS: readonly ModelVersionDiffChangeKind[] = ['added', 'removed', 'changed']

function hasExactKeys(row: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(row).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null
  return typeof value === 'string' ? value : undefined
}

function isRfc6901Pointer(value: string): boolean {
  if (!value.startsWith('/')) return false
  return value
    .slice(1)
    .split('/')
    .every((token) => !/~(?![01])/u.test(token))
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareDiffItems(left: ModelVersionDiffChange, right: ModelVersionDiffChange): number {
  return compareStrings(diffItemIdentity(left), diffItemIdentity(right))
}

function diffItemIdentity(change: ModelVersionDiffChange): string {
  return JSON.stringify([change.path, change.changeKind, change.entityKind, change.entityId])
}

function parseDiffChange(raw: unknown): ModelVersionDiffChange | null {
  if (raw === null || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (
    !hasExactKeys(row, [
      'path',
      'change_kind',
      'entity_kind',
      'entity_id',
      'label',
      'before_display',
      'after_display',
      'summary',
      'why_it_matters',
    ])
  ) {
    return null
  }
  if (!DIFF_ENTITY_KINDS.includes(row.entity_kind as ModelVersionDiffEntityKind)) return null
  if (!DIFF_CHANGE_KINDS.includes(row.change_kind as ModelVersionDiffChangeKind)) return null
  if (typeof row.path !== 'string' || !isRfc6901Pointer(row.path)) return null
  if (
    row.entity_id !== null &&
    (typeof row.entity_id !== 'string' || row.entity_id.length === 0)
  ) {
    return null
  }
  const label = nullableString(row.label)
  const beforeDisplay = nullableString(row.before_display)
  const afterDisplay = nullableString(row.after_display)
  if (label === undefined || beforeDisplay === undefined || afterDisplay === undefined) return null
  if (
    typeof row.summary !== 'string' ||
    row.summary.trim().length === 0 ||
    typeof row.why_it_matters !== 'string' ||
    row.why_it_matters.trim().length === 0
  ) {
    return null
  }
  return {
    entityKind: row.entity_kind as ModelVersionDiffEntityKind,
    entityId: row.entity_id as string | null,
    label,
    path: row.path,
    changeKind: row.change_kind as ModelVersionDiffChangeKind,
    beforeDisplay,
    afterDisplay,
    summary: row.summary,
    whyItMatters: row.why_it_matters,
  }
}

function parseSortedUniqueStrings(
  raw: unknown,
  itemIsValid: (value: string) => boolean,
): string[] | null {
  if (!Array.isArray(raw)) return null
  const parsed: string[] = []
  let previous: string | null = null
  for (const value of raw) {
    if (typeof value !== 'string' || value.trim().length === 0 || !itemIsValid(value)) return null
    if (previous !== null && compareStrings(previous, value) >= 0) return null
    parsed.push(value)
    previous = value
  }
  return parsed
}

function parseDiffCategories(raw: unknown): ModelVersionDiffCategories | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (
    Object.keys(row).length !== MODEL_VERSION_DIFF_CATEGORIES.length ||
    MODEL_VERSION_DIFF_CATEGORIES.some((category) => !Object.prototype.hasOwnProperty.call(row, category))
  ) {
    return null
  }
  const parsed = {} as ModelVersionDiffCategories
  for (const category of MODEL_VERSION_DIFF_CATEGORIES) {
    const rawItems = row[category]
    if (!Array.isArray(rawItems)) return null
    const items: ModelVersionDiffChange[] = []
    let previous: ModelVersionDiffChange | null = null
    for (const rawItem of rawItems) {
      const item = parseDiffChange(rawItem)
      if (item === null || (previous !== null && compareDiffItems(previous, item) >= 0)) return null
      items.push(item)
      previous = item
    }
    parsed[category] = items
  }
  return parsed
}

function parseModelVersionDiff(
  raw: unknown,
  expected: { scenarioId: string; fromVersionId: string; toVersionId: string },
): ModelVersionDiffV1 | null {
  if (raw === null || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (
    !hasExactKeys(row, [
      'schema',
      'scenario_id',
      'from_version_id',
      'to_version_id',
      'relation',
      'from_full_hash',
      'to_full_hash',
      'analysis_equivalent',
      'categories',
      'coverage',
      'request_id',
    ])
  ) {
    return null
  }
  if (row.schema !== 'model_version_diff.v1') return null
  if (
    row.scenario_id !== expected.scenarioId ||
    row.from_version_id !== expected.fromVersionId ||
    row.to_version_id !== expected.toVersionId
  ) {
    return null
  }
  if (row.relation !== 'identical' && row.relation !== 'different') return null
  if (!isLowerSha256(row.from_full_hash) || !isLowerSha256(row.to_full_hash)) return null
  if (typeof row.analysis_equivalent !== 'boolean') return null
  const categories = parseDiffCategories(row.categories)
  if (categories === null) return null
  if (row.coverage === null || typeof row.coverage !== 'object' || Array.isArray(row.coverage)) {
    return null
  }
  const coverage = row.coverage as Record<string, unknown>
  if (!hasExactKeys(coverage, ['known_undetectable', 'known_uninterpreted_paths'])) return null
  const knownUndetectable = parseSortedUniqueStrings(coverage.known_undetectable, () => true)
  const knownUninterpretedPaths = parseSortedUniqueStrings(
    coverage.known_uninterpreted_paths,
    isRfc6901Pointer,
  )
  if (knownUndetectable === null || knownUninterpretedPaths === null) return null
  if (
    row.request_id !== null &&
    (typeof row.request_id !== 'string' || row.request_id.trim().length === 0)
  ) {
    return null
  }
  const seenItems = new Set<string>()
  let itemCount = 0
  for (const category of MODEL_VERSION_DIFF_CATEGORIES) {
    for (const item of categories[category]) {
      const identity = diffItemIdentity(item)
      if (seenItems.has(identity)) return null
      seenItems.add(identity)
      itemCount += 1
    }
  }
  const otherModelPaths = categories.other_model_fields.map((item) => item.path)
  if (
    otherModelPaths.length !== knownUninterpretedPaths.length ||
    otherModelPaths.some((path, index) => path !== knownUninterpretedPaths[index])
  ) {
    return null
  }
  const interpretedPaths = new Set<string>()
  for (const category of MODEL_VERSION_DIFF_CATEGORIES) {
    if (category === 'other_model_fields') continue
    for (const item of categories[category]) interpretedPaths.add(item.path)
  }
  if (knownUninterpretedPaths.some((path) => interpretedPaths.has(path))) return null
  if (
    row.relation === 'identical' &&
    (row.analysis_equivalent !== true ||
      row.from_full_hash !== row.to_full_hash ||
      itemCount > 0)
  ) {
    return null
  }
  if (
    row.relation === 'different' &&
    itemCount === 0 &&
    knownUndetectable.length === 0 &&
    knownUninterpretedPaths.length === 0
  ) {
    return null
  }

  return {
    schema: 'model_version_diff.v1',
    scenarioId: expected.scenarioId,
    fromVersionId: expected.fromVersionId,
    toVersionId: expected.toVersionId,
    relation: row.relation,
    fromFullHash: row.from_full_hash,
    toFullHash: row.to_full_hash,
    analysisEquivalent: row.analysis_equivalent,
    categories,
    coverage: {
      knownUndetectable,
      knownUninterpretedPaths,
    },
  }
}

/** List the scenario's server-side versions. Never throws. */
export async function listModelVersions(
  scenarioId: string,
  opts: CommonOptions & { limit?: number; cursor?: string } = {},
): Promise<ListModelVersionsResult> {
  const payload = identityBody(opts.userId)
  if (typeof opts.limit === 'number') payload.limit = opts.limit
  if (typeof opts.cursor === 'string' && opts.cursor.length > 0) payload.cursor = opts.cursor

  const outcome = await postOnce(modelVersionsUrl(scenarioId), payload, opts)
  const refusal = sharedRefusal(outcome)
  if (refusal) return refusal
  const body = (outcome as { kind: 'ok'; body: unknown }).body

  if (body === null || typeof body !== 'object') return { status: 'unusable' }
  const b = body as Record<string, unknown>
  if (b.schema === 'model_versions_list.v2') {
    if (
      !hasExactKeys(b, [
        'schema',
        'scenario_id',
        'versions',
        'next_cursor',
        'current_version_id',
        'request_id',
      ])
    ) {
      return { status: 'unusable' }
    }
    if (b.scenario_id !== scenarioId || !isUuid(b.scenario_id) || !Array.isArray(b.versions)) {
      return { status: 'unusable' }
    }
    if (b.next_cursor !== null && (typeof b.next_cursor !== 'string' || b.next_cursor.length === 0)) {
      return { status: 'unusable' }
    }
    if (b.current_version_id !== null && !isUuid(b.current_version_id)) {
      return { status: 'unusable' }
    }
    if (
      b.request_id !== null &&
      (typeof b.request_id !== 'string' || b.request_id.trim().length === 0)
    ) {
      return { status: 'unusable' }
    }
    const versions: ServerModelVersion[] = []
    const seenIds = new Set<string>()
    let previousSequence = Number.POSITIVE_INFINITY
    for (const raw of b.versions) {
      const parsed = parseSummaryV2(raw, scenarioId)
      if (
        parsed === null ||
        seenIds.has(parsed.id) ||
        parsed.versionNumber >= previousSequence
      ) {
        logger.warn('model_versions.v2_order_or_row_refused', { scenarioId })
        return { status: 'unusable' }
      }
      versions.push(parsed)
      seenIds.add(parsed.id)
      previousSequence = parsed.versionNumber
    }
    // Null is licensed only for a scenario without a head. A non-empty page
    // proves versions exist, so accepting null there would erase head truth.
    if (
      b.current_version_id === null &&
      (versions.length > 0 || b.next_cursor !== null)
    ) {
      return { status: 'unusable' }
    }
    return {
      status: 'list',
      versions,
      contractVersion: 'v2',
      nextCursor: b.next_cursor,
      // Later pages can carry a head id not present on that page. Consumers
      // mark current only on exact identity and never infer it from ordering.
      currentVersionId: b.current_version_id,
      requestId: b.request_id,
    }
  }

  if (b.schema === 'model_versions_list.v1') {
    if (!Array.isArray(b.versions)) return { status: 'unusable' }
    const versions: ServerModelVersion[] = []
    const seenIds = new Set<string>()
    for (const raw of b.versions) {
      const parsed = parseSummaryV1Compat(raw, scenarioId)
      // Explicit temporary compatibility only. Actor, creation lineage and
      // analysis identity remain Unknown rather than reconstructed from v1.
      if (parsed === null || seenIds.has(parsed.id)) {
        logger.warn('model_versions.v1_compat_row_refused', { scenarioId })
        return { status: 'unusable' }
      }
      versions.push(parsed)
      seenIds.add(parsed.id)
    }
    const currentVersionId =
      typeof b.current_version_id === 'string' && b.current_version_id.length > 0
        ? b.current_version_id
        : null
    if (currentVersionId !== null && !seenIds.has(currentVersionId)) return { status: 'unusable' }
    return {
      status: 'list',
      versions,
      contractVersion: 'v1-compat',
      nextCursor: null,
      currentVersionId,
      requestId: typeof b.request_id === 'string' ? b.request_id : null,
    }
  }

  logger.warn('model_versions.unexpected_schema', { schema: String(b.schema) })
  return { status: 'unusable' }
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
  payload.mutation_id = opts.mutationId
  payload.expected_graph_identity_hash = opts.expectedGraphIdentityHash
  if (typeof opts.label === 'string' && opts.label.trim().length > 0) {
    payload.label = opts.label.trim().slice(0, 200)
  }

  const outcome = await postOnce(modelVersionsUrl(scenarioId, 'restore'), payload, opts)

  if (outcome.kind === 'http') {
    const code = detailsCode(outcome.body)
    if (outcome.status === 401 && code === 'SIGN_IN_REQUIRED') return { status: 'signInRequired' }
    if (outcome.status === 409 && code === 'VERSION_STALE') return { status: 'conflict' }
    if (outcome.status === 409 && code === 'MUTATION_ID_REUSED') {
      return { status: 'mutationIdReused' }
    }
    if (outcome.status === 404 && code === 'VERSION_NOT_FOUND') return { status: 'versionNotFound' }
  }
  const refusal = sharedRefusal(outcome)
  if (refusal) return refusal
  const body = (outcome as { kind: 'ok'; body: unknown }).body

  if (body === null || typeof body !== 'object') return { status: 'unusable' }
  const b = body as Record<string, unknown>
  if (
    !hasExactKeys(b, [
      'schema',
      'scenario_id',
      'restored',
      'receipt',
      'analysis_state',
      'request_id',
    ]) ||
    b.schema !== 'model_version_restore.v2' ||
    b.scenario_id !== scenarioId ||
    b.restored !== true ||
    typeof b.request_id !== 'string' ||
    b.request_id.trim().length === 0
  ) {
    return { status: 'unusable' }
  }
  const parsedReceipt = ModelVersionMutationReceiptV1Schema.safeParse(b.receipt)
  const parsedAnalysisState =
    b.analysis_state === null ? null : AnalysisStateV1Schema.safeParse(b.analysis_state)
  if (
    !parsedReceipt.success ||
    (parsedAnalysisState !== null && !parsedAnalysisState.success) ||
    parsedReceipt.data.scenario_id !== scenarioId ||
    parsedReceipt.data.mutation_id !== opts.mutationId ||
    parsedReceipt.data.creation.kind !== 'restore' ||
    parsedReceipt.data.creation.source_version_id !== opts.versionId
  ) {
    return { status: 'unusable' }
  }

  return {
    status: 'restored',
    receipt: parsedReceipt.data,
    analysisState: parsedAnalysisState === null ? null : parsedAnalysisState.data,
    requestId: b.request_id,
  }
}

/**
 * Compare two STORED authoritative versions. Never sends graph bytes and never
 * falls back to the browser-local checkpoint diff: an unavailable server diff
 * is unknown, not permission to compare a different object and call it shared.
 */
export async function compareModelVersions(
  scenarioId: string,
  opts: CompareOptions,
): Promise<CompareModelVersionsResult> {
  if (opts.fromVersionId === opts.toVersionId) return { status: 'sameVersion' }

  const payload = identityBody(opts.userId)
  payload.from_version_id = opts.fromVersionId
  payload.to_version_id = opts.toVersionId

  const outcome = await postOnce(modelVersionsUrl(scenarioId, 'compare'), payload, opts)
  if (outcome.kind === 'http') {
    const code = detailsCode(outcome.body)
    if (outcome.status === 401 && code === 'SIGN_IN_REQUIRED') return { status: 'signInRequired' }
    if (outcome.status === 404 && code === 'VERSION_NOT_FOUND') return { status: 'versionNotFound' }
  }
  const refusal = sharedRefusal(outcome)
  if (refusal) return refusal
  const body = (outcome as { kind: 'ok'; body: unknown }).body
  const diff = parseModelVersionDiff(body, {
    scenarioId,
    fromVersionId: opts.fromVersionId,
    toVersionId: opts.toVersionId,
  })
  if (diff === null) {
    logger.warn('model_versions.compare_unusable_response', { scenarioId })
    return { status: 'unusable' }
  }
  const row = body as Record<string, unknown>
  return {
    status: 'compared',
    diff,
    requestId: typeof row.request_id === 'string' ? row.request_id : null,
  }
}
