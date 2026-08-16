import {
  CANONICAL_COMMITTED_RECEIPT_FIELD_CLASSIFICATION,
  CANONICAL_GRAPH_HASH_KEEP_LIST,
  CANONICAL_GRAPH_HASH_NESTED_PROJECTION,
  CanonicalCommittedGraphReceiptSchema,
  type CanonicalCommittedGraphReceipt,
} from '@talchain/schemas/boundary'

import type { CEEAnalysisReady } from '../../adapters/cee/types'
import { normaliseV5AnalysisReady } from '../../v5/applyV5State'
import { deepEqual } from '../domain/analyticalChange'
import { useCanvasStore } from '../store'

type Dict = Record<string, unknown>

export type CanonicalCommittedReceiptPreparation =
  | {
      ok: true
      analysisReady: CEEAnalysisReady
      receipt: CanonicalCommittedGraphReceipt
      /** CEE's canonical whole-status verdict; graph validity alone never opens Run. */
      runnable: boolean
    }
  | {
      ok: false
      reason:
        | 'canonical_committed_receipt_missing'
        | 'canonical_committed_receipt_invalid'
        | 'canonical_committed_receipt_readiness_mismatch'
    }

type CanonicalReadinessStatus =
  | 'ready'
  | 'needs_encoding'
  | 'needs_user_mapping'
  | 'needs_user_input'
  | 'blocked'

const CANONICAL_READINESS_STATUSES: ReadonlySet<string> = new Set([
  'ready',
  'needs_encoding',
  'needs_user_mapping',
  'needs_user_input',
  'blocked',
])

function record(value: unknown): Dict | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Dict
    : null
}

function hasOwn(value: Dict, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function canonicalReadinessStatus(value: unknown): CanonicalReadinessStatus | null {
  return typeof value === 'string' && CANONICAL_READINESS_STATUSES.has(value)
    ? value as CanonicalReadinessStatus
    : null
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}

/**
 * Canvas spellings derived from the schema-owned nested projection manifest.
 *
 * The small switches below translate wire spellings into the aliases the
 * existing ReactFlow mappers actually author. They are not a second science
 * vocabulary: adding/removing a manifest member changes the iteration input,
 * while an unmapped direct field keeps its wire name automatically.
 */
export function canonicalReceiptNodeCanvasFields(): readonly string[] {
  const contract = CANONICAL_GRAPH_HASH_NESTED_PROJECTION.node
  const direct = contract.fields
    .filter((field) => field !== 'id')
    .map(String)
  return unique([
    ...direct,
    'observedState',
    'observed_state',
    'prior',
    contract.interventions_field,
  ])
}

export function canonicalReceiptEdgeCanvasFields(): readonly string[] {
  const contract = CANONICAL_GRAPH_HASH_NESTED_PROJECTION.edge
  const aliases = contract.fields.slice(2).flatMap((field): string[] => {
    if (field === 'exists_probability') return [field, 'beliefExists']
    if (field === 'effect_direction') return [field, 'direction']
    return [field]
  })
  for (const field of contract.strength_fields) {
    if (field === 'mean') aliases.push('weight', 'strength_mean')
    else if (field === 'std') aliases.push('strengthStd', 'strength_std')
    else aliases.push(`strength_${String(field)}`)
  }
  return unique(aliases)
}

/**
 * The receipt's selected-goal attestation must describe the nodes it carries:
 * null means there are no goal nodes, while a selected id must name one of the
 * receipt's goal nodes. The schema deliberately validates structure only, so
 * keep this single semantic check beside the shared strict parser rather than
 * letting individual consumers invent weaker goal rules.
 */
export function canonicalCommittedReceiptHasCoherentGoalIdentity(
  receipt: CanonicalCommittedGraphReceipt,
): boolean {
  const goalNodeIds = new Set(
    receipt.nodes.flatMap((candidate) => {
      const node = record(candidate)
      return node?.kind === 'goal' && nonEmptyString(node.id) ? [node.id] : []
    }),
  )
  return receipt.goal_node_id === null
    ? goalNodeIds.size === 0
    : goalNodeIds.has(receipt.goal_node_id)
}

/** Strict response-boundary parse: no picking, defaults, or omission repair. */
export function parseCanonicalCommittedGraphReceipt(
  value: unknown,
): CanonicalCommittedGraphReceipt | null {
  const parsed = CanonicalCommittedGraphReceiptSchema.safeParse(value)
  return parsed.success && canonicalCommittedReceiptHasCoherentGoalIdentity(parsed.data)
    ? parsed.data
    : null
}

/**
 * Reconstruct the strict wire receipt from an authenticated persisted graph.
 * Counts are the only derived fields; all five hash carriers must be own keys.
 */
export function canonicalCommittedGraphReceiptFromGraph(
  value: unknown,
): CanonicalCommittedGraphReceipt | null {
  const graph = record(value)
  if (!graph) return null
  const carriers = CANONICAL_COMMITTED_RECEIPT_FIELD_CLASSIFICATION.hash_carrier
  if (carriers.some((field) => !hasOwn(graph, field))) return null
  const nodes = graph.nodes
  const edges = graph.edges
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return null
  return parseCanonicalCommittedGraphReceipt({
    nodes,
    edges,
    options: graph.options,
    goal_node_id: graph.goal_node_id,
    goal_constraints: graph.goal_constraints,
    node_count: nodes.length,
    edge_count: edges.length,
  })
}

function projectDefined(source: Dict, fields: readonly string[]): Dict {
  const out: Dict = {}
  for (const field of fields) {
    if (source[field] !== undefined) out[field] = source[field]
  }
  return out
}

function projectIntervention(value: unknown): Dict | undefined {
  const source = record(value)
  if (!source) return undefined
  const contract = CANONICAL_GRAPH_HASH_NESTED_PROJECTION.intervention
  const out = projectDefined(source, contract.fields)
  const targetMatch = record(source[contract.target_match_field])
  if (targetMatch) {
    const projected = projectDefined(targetMatch, contract.target_match_fields)
    if (Object.keys(projected).length > 0) {
      out[contract.target_match_field] = projected
    }
  }
  return out
}

function projectInterventionRecord(value: unknown): Dict | undefined {
  const source = record(value)
  if (!source) return undefined
  const out: Dict = {}
  for (const factorId of Object.keys(source)) {
    const projected = projectIntervention(source[factorId])
    if (projected !== undefined) out[factorId] = projected
  }
  return out
}

function projectOption(value: unknown, allowOptionIdAlias: boolean): Dict | null {
  const source = record(value)
  if (!source) return null
  const id = nonEmptyString(source.id)
    ? source.id
    : allowOptionIdAlias && nonEmptyString(source.option_id)
      ? source.option_id
      : null
  if (!id) return null

  const contract = CANONICAL_GRAPH_HASH_NESTED_PROJECTION.option
  const out: Dict = { id }
  for (const field of contract.fields.slice(1)) {
    if (source[field] !== undefined) out[field] = source[field]
  }
  const interventions = projectInterventionRecord(source[contract.interventions_field])
  if (interventions && Object.keys(interventions).length > 0) {
    out[contract.interventions_field] = interventions
  }
  const conditional = contract.conditional_field
  if (
    source[conditional.include_when.field] !== conditional.include_when.not_equals &&
    record(source[conditional.field]) !== null
  ) {
    out[conditional.field] = source[conditional.field]
  }
  return out
}

function projectOptions(
  value: unknown,
  allowOptionIdAlias: boolean,
): Dict[] | null {
  if (!Array.isArray(value)) return null
  const projected: Dict[] = []
  const ids = new Set<string>()
  for (const option of value) {
    const item = projectOption(option, allowOptionIdAlias)
    const id = item?.id
    if (!item || typeof id !== 'string' || ids.has(id)) return null
    ids.add(id)
    projected.push(item)
  }
  return projected.sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * #983's readiness wire deliberately compacts each intervention to its numeric
 * value, while the committed receipt retains the complete hash-bearing record
 * (`value_type`, `encoding_map`, and exact target identity included). Compare
 * only the projection that both canonical producers actually share here; the
 * full receipt projection is still proved independently against canvas/store.
 */
function readinessInterventionValue(value: unknown): number | null {
  const direct = finiteNumber(value)
  if (direct !== null) return direct
  const source = record(value)
  return source ? finiteNumber(source.value) : null
}

function projectReadinessInterventions(value: unknown): Dict | null {
  const source = record(value)
  if (!source) return null
  const out: Dict = {}
  for (const factorId of Object.keys(source)) {
    const projected = readinessInterventionValue(source[factorId])
    if (projected === null) return null
    out[factorId] = projected
  }
  return out
}

function projectReadinessComparableOption(
  value: unknown,
  allowOptionIdAlias: boolean,
): Dict | null {
  const source = record(value)
  if (!source) return null
  const id = nonEmptyString(source.id)
    ? source.id
    : allowOptionIdAlias && nonEmptyString(source.option_id)
      ? source.option_id
      : null
  if (!id || !nonEmptyString(source.status)) return null

  const interventions = projectReadinessInterventions(source.interventions)
  if (!interventions) return null
  const out: Dict = { id, status: source.status, interventions }
  if (source.is_baseline !== undefined) {
    if (typeof source.is_baseline !== 'boolean') return null
    out.is_baseline = source.is_baseline
  }
  if (source.status !== 'ready' && source.raw_interventions !== undefined) {
    const raw = record(source.raw_interventions)
    if (!raw) return null
    out.raw_interventions = raw
  }
  return out
}

function projectReadinessComparableOptions(
  value: unknown,
  allowOptionIdAlias: boolean,
): Dict[] | null {
  if (!Array.isArray(value)) return null
  const projected: Dict[] = []
  const ids = new Set<string>()
  for (const option of value) {
    const item = projectReadinessComparableOption(option, allowOptionIdAlias)
    const id = item?.id
    if (!item || typeof id !== 'string' || ids.has(id)) return null
    ids.add(id)
    projected.push(item)
  }
  return projected.sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

function optionCanPopulateRunStore(value: unknown): value is Dict {
  const option = record(value)
  if (!option || !nonEmptyString(option.id) || !nonEmptyString(option.label)) return false
  if (!nonEmptyString(option.status) || record(option.interventions) === null) return false
  if (
    option.is_baseline !== undefined &&
    option.is_baseline !== null &&
    typeof option.is_baseline !== 'boolean'
  ) return false
  if (
    option.raw_interventions !== undefined &&
    record(option.raw_interventions) === null
  ) return false
  return Object.values(option.interventions as Dict).every(
    (entry) => record(entry) !== null,
  )
}

function receiptOptionsCanPopulateRunStore(
  receipt: CanonicalCommittedGraphReceipt,
): boolean {
  if (!receipt.options.every(optionCanPopulateRunStore)) return false
  const ids = receipt.options.map((option) => (option as Dict).id as string)
  return new Set(ids).size === ids.length
}

function projectionFromReadiness(value: unknown): Dict | null {
  const readiness = record(value)
  if (!readiness) return null
  const options = projectOptions(readiness.options, true)
  if (!options) return null
  return {
    options,
    goal_node_id: nonEmptyString(readiness.goal_node_id)
      ? readiness.goal_node_id
      : null,
  }
}

function projectionFromReceipt(
  receipt: CanonicalCommittedGraphReceipt,
): Dict | null {
  const options = projectOptions(receipt.options, false)
  if (!options) return null
  return {
    options,
    goal_node_id: receipt.goal_node_id,
    goal_constraints: receipt.goal_constraints,
  }
}

/**
 * Current #983 behavior for a goal-less graph is deliberately non-runnable:
 * `analysis_ready` carries `status: blocked`, `goal_node_id: ''`, and no
 * options because semantic readiness cannot be projected without a goal. The
 * committed receipt still carries the graph's real options and explicit null
 * goal. That single, typed exception is transport normalization, not a second
 * readiness decision; every other receipt carrier must match exactly.
 */
function readinessMatchesCanonicalReceipt(
  readiness: Dict,
  receipt: CanonicalCommittedGraphReceipt,
): boolean {
  const status = canonicalReadinessStatus(readiness.status)
  const readinessOptions = projectReadinessComparableOptions(readiness.options, true)
  const receiptOptions = projectReadinessComparableOptions(receipt.options, false)
  if (!status || !readinessOptions || !receiptOptions) return false

  const goalMatches = receipt.goal_node_id === null
    ? status === 'blocked' && readiness.goal_node_id === ''
    : readiness.goal_node_id === receipt.goal_node_id
  const optionsMatch = deepEqual(readinessOptions, receiptOptions) ||
    (receipt.goal_node_id === null && status === 'blocked' && readinessOptions.length === 0)
  return goalMatches && optionsMatch
}

function analysisReadyForCanonicalStore(
  readiness: Dict,
  receipt: CanonicalCommittedGraphReceipt,
): CEEAnalysisReady | null {
  const status = canonicalReadinessStatus(readiness.status)
  if (!status || !receiptOptionsCanPopulateRunStore(receipt)) return null

  // One-way retirement of the provisional sidecar. It is never parsed or used
  // as authority, and cannot survive into the Run-bearing store if an older
  // producer happens to include it alongside a valid 0.43 receipt.
  const readinessForStore = { ...readiness }
  delete readinessForStore.canonical_graph_hash_analysis_state
  const canonical = {
    ...readinessForStore,
    status,
    options: receipt.options,
    // #983's public analysis_ready contract uses an empty string for NO_GOAL;
    // the receipt uses explicit null. Keep the typed readiness spelling here
    // and normalise it to null only in the carrier comparison above.
    goal_node_id: receipt.goal_node_id ?? '',
  }

  const normalised = normaliseV5AnalysisReady(canonical)
  if (normalised) return normalised
  if (status === 'ready') return null

  // The general V5 normaliser intentionally rejects empty options / empty goal
  // because it was written for runnable payloads. Canonical #983 readiness is
  // broader: a valid saved graph may truthfully be blocked. Preserve that
  // typed non-ready state while the edge transaction's Run barrier stays shut.
  const freshnessRaw = readiness.freshness
  const freshness =
    freshnessRaw === 'fresh' || freshnessRaw === 'stale' ||
    freshnessRaw === 'unknown' || freshnessRaw === 'none'
      ? freshnessRaw
      : 'unknown'
  return {
    ...canonical,
    freshness,
    freshness_reason: typeof readiness.freshness_reason === 'string'
      ? readiness.freshness_reason
      : undefined,
  } as CEEAnalysisReady
}

/** The sole Run interpretation of #983's canonical whole-status verdict. */
export function canonicalAnalysisReadyAllowsRun(value: unknown): boolean {
  const readiness = record(value)
  return readiness !== null &&
    readiness.status === 'ready' &&
    nonEmptyString(readiness.goal_node_id) &&
    Array.isArray(readiness.options) &&
    readiness.options.length > 0
}

/**
 * Bind readiness to the exact canonical receipt carried by `draft_graph`.
 *
 * The shared schema supplies all five required own-key carriers and the nested
 * projection vocabulary. Readiness remains CEE's sole whole-status authority;
 * this function only proves its Run-bearing options/goal match the receipt,
 * then normalises those exact receipt values into the existing store shape.
 */
export function prepareCanonicalAnalysisReadyFromReceipt(
  analysisReadyValue: unknown,
  receiptValue: unknown,
): CanonicalCommittedReceiptPreparation {
  const rawReceipt = record(receiptValue)
  if (!rawReceipt) {
    return { ok: false, reason: 'canonical_committed_receipt_missing' }
  }
  if (CANONICAL_GRAPH_HASH_KEEP_LIST.some((field) => !hasOwn(rawReceipt, field))) {
    return { ok: false, reason: 'canonical_committed_receipt_missing' }
  }
  const receipt = parseCanonicalCommittedGraphReceipt(receiptValue)
  if (!receipt) {
    return { ok: false, reason: 'canonical_committed_receipt_invalid' }
  }
  if (!receiptOptionsCanPopulateRunStore(receipt)) {
    return { ok: false, reason: 'canonical_committed_receipt_invalid' }
  }

  const analysisReady = record(analysisReadyValue)
  const receiptProjection = projectionFromReceipt(receipt)
  if (
    !analysisReady ||
    !receiptProjection ||
    !readinessMatchesCanonicalReceipt(analysisReady, receipt)
  ) {
    return { ok: false, reason: 'canonical_committed_receipt_readiness_mismatch' }
  }

  const normalised = analysisReadyForCanonicalStore(analysisReady, receipt)
  const normalisedProjection = projectionFromReadiness(normalised)
  if (
    !normalised ||
    !normalisedProjection ||
    !deepEqual(normalisedProjection.options, receiptProjection.options) ||
    normalisedProjection.goal_node_id !== receiptProjection.goal_node_id
  ) {
    return { ok: false, reason: 'canonical_committed_receipt_readiness_mismatch' }
  }
  return {
    ok: true,
    analysisReady: normalised,
    receipt,
    runnable: canonicalAnalysisReadyAllowsRun(normalised),
  }
}

/** Exact post-write proof for options, goal identity, and constraints. */
export function storedAnalysisStateMatchesCanonicalReceipt(
  receiptValue: unknown,
): boolean {
  const receipt = parseCanonicalCommittedGraphReceipt(receiptValue)
  if (!receipt) return false
  const expected = projectionFromReceipt(receipt)
  const actual = projectionFromReadiness(useCanvasStore.getState().ceeAnalysisReady)
  return expected !== null && actual !== null &&
    deepEqual(actual.options, expected.options) &&
    actual.goal_node_id === expected.goal_node_id &&
    deepEqual(
      useCanvasStore.getState().goalConstraints ?? [],
      expected.goal_constraints,
    )
}

/**
 * Reconcile Run-bearing state from a full authenticated persisted graph.
 * This is explicit recovery only; callers retain ownership of when recovery is
 * allowed. A legacy graph missing any carrier returns null without a write.
 */
export function reconcileStoredAnalysisStateFromCanonicalGraph(
  graphValue: unknown,
): CanonicalCommittedGraphReceipt | null {
  const receipt = canonicalCommittedGraphReceiptFromGraph(graphValue)
  const existing = useCanvasStore.getState().ceeAnalysisReady
  if (
    !receipt ||
    !existing ||
    !receiptOptionsCanPopulateRunStore(receipt)
  ) return null

  const normalised = analysisReadyForCanonicalStore(existing as unknown as Dict, receipt)
  if (!normalised) return null
  useCanvasStore.getState().setCeeAnalysisReady(normalised)
  return storedAnalysisStateMatchesCanonicalReceipt(receipt) ? receipt : null
}
