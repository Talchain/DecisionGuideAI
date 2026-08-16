import { CANONICAL_GRAPH_HASH_ANALYSIS_STATE_FIELDS } from '@talchain/schemas/boundary'

import type { CEEAnalysisReady } from '../../adapters/cee/types'
import { normaliseV5AnalysisReady } from '../../v5/applyV5State'
import { deepEqual } from '../domain/analyticalChange'
import { useCanvasStore } from '../store'

/**
 * Exact client pin for the analysis-affecting projection at serving CEE
 * `dfb5bd708c81a3c5e5a455a4f2e8b74897c2d3ca` / schemas 0.42.
 *
 * CEE owns the digest implementation. This object is not a second hash. It is
 * the receipt consumer's field-classification guard: the canonical editor may
 * release Run only after every field in CEE's hash preimage is representable
 * and reconciled locally. The source-file digest is checked by the focused
 * cross-repository contract test; changing CEE's projection requires an
 * explicit coordinated update here rather than a silently narrower receipt.
 */
export const SERVING_CEE_ANALYSIS_HASH_CONTRACT = {
  sourceCommit: 'dfb5bd708c81a3c5e5a455a4f2e8b74897c2d3ca',
  sourcePath: 'src/orchestrator-v5/context/graph-hash.ts',
  sourceSha256: 'eab9ddcb423d67509ec29a8e5d7809d674d01178ae4811a7c2c4f78da716540a',
  schemaVersion: '0.42',
  topLevelFields: ['options', 'goal_node_id', 'goal_constraints'],
  node: {
    scalarFields: [
      'kind',
      'category',
      'factor_type',
      'is_baseline',
      'goal_threshold',
      'goal_threshold_raw',
      'goal_threshold_cap',
      'intercept',
      'encoding_map',
    ],
    observedStateFields: ['value', 'baseline', 'cap'],
    priorFields: ['distribution', 'range_min', 'range_max'],
  },
  edge: {
    scalarFields: ['edge_type', 'exists_probability', 'effect_direction'],
    strengthFields: ['mean', 'std'],
  },
  option: {
    scalarFields: ['status', 'is_baseline'],
    conditionalFields: ['raw_interventions'],
  },
  intervention: {
    scalarFields: ['value', 'value_type', 'encoding_map'],
    targetMatchFields: ['node_id'],
  },
} as const

export type CanonicalAnalysisStateField =
  (typeof CANONICAL_GRAPH_HASH_ANALYSIS_STATE_FIELDS)[number]

// Compile-time membership plus runtime completeness is pinned in the contract
// test. Keeping these names derived from the contract object prevents the graph
// reconciler and receipt projector from carrying parallel nested field lists.
export const CEE_ANALYSIS_NODE_CLIENT_FIELDS = [
  'kind',
  'category',
  'factor_type',
  'is_baseline',
  'observedState',
  'goal_threshold',
  'goal_threshold_raw',
  'goal_threshold_cap',
  'intercept',
  'prior',
  'encoding_map',
  'interventions',
] as const

export const CEE_ANALYSIS_EDGE_CLIENT_FIELDS = [
  'weight',
  'direction',
  'strengthStd',
  'beliefExists',
  'exists_probability',
  'edge_type',
] as const

export const CANONICAL_ANALYSIS_STATE_ATTESTATION_FIELD =
  'canonical_graph_hash_analysis_state' as const
export const CANONICAL_ANALYSIS_STATE_PROJECTION_VERSION =
  'analysis-affecting.v1' as const

type Dict = Record<string, unknown>

export interface CanonicalAnalysisStateAttestation {
  projection_version: typeof CANONICAL_ANALYSIS_STATE_PROJECTION_VERSION
  options: Dict[]
  goal_node_id: string | null
  goal_constraints: unknown[]
}

export type CanonicalAnalysisReadyPreparation =
  | {
      ok: true
      analysisReady: CEEAnalysisReady
      attestation: CanonicalAnalysisStateAttestation
    }
  | {
      ok: false
      reason:
        | 'canonical_analysis_state_attestation_missing'
        | 'canonical_analysis_state_attestation_invalid'
        | 'canonical_analysis_state_receipt_mismatch'
        | 'canonical_analysis_state_not_runnable'
    }

function record(value: unknown): Dict | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Dict
    : null
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
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
  const out = projectDefined(
    source,
    SERVING_CEE_ANALYSIS_HASH_CONTRACT.intervention.scalarFields,
  )
  const targetMatch = record(source.target_match)
  if (targetMatch?.node_id !== undefined) {
    out.target_match = { node_id: targetMatch.node_id }
  }
  return out
}

function projectInterventions(value: unknown): Dict | undefined {
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

  const out: Dict = { id }
  for (const field of SERVING_CEE_ANALYSIS_HASH_CONTRACT.option.scalarFields) {
    if (source[field] !== undefined) out[field] = source[field]
  }
  const interventions = projectInterventions(source.interventions)
  if (interventions !== undefined && Object.keys(interventions).length > 0) {
    out.interventions = interventions
  }
  if (
    source.status !== 'ready' &&
    record(source.raw_interventions) !== null
  ) {
    out.raw_interventions = source.raw_interventions
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

function optionCanPopulateRunStore(value: unknown): value is Dict {
  const option = record(value)
  if (!option || !nonEmptyString(option.id) || !nonEmptyString(option.label)) return false
  if (!nonEmptyString(option.status) || record(option.interventions) === null) return false
  if (option.is_baseline !== undefined && typeof option.is_baseline !== 'boolean') return false
  if (option.raw_interventions !== undefined && record(option.raw_interventions) === null) return false
  return Object.values(option.interventions as Dict).every((entry) => record(entry) !== null)
}

/** Parse the explicit, normalised hash-preimage attestation on a receipt. */
export function parseCanonicalAnalysisStateAttestation(
  analysisReadyValue: unknown,
): CanonicalAnalysisStateAttestation | null {
  const analysisReady = record(analysisReadyValue)
  const raw = record(analysisReady?.[CANONICAL_ANALYSIS_STATE_ATTESTATION_FIELD])
  if (!raw || raw.projection_version !== CANONICAL_ANALYSIS_STATE_PROJECTION_VERSION) {
    return null
  }
  if (!Array.isArray(raw.options) || !raw.options.every(optionCanPopulateRunStore)) return null
  const ids = raw.options.map((option) => option.id as string)
  if (new Set(ids).size !== ids.length) return null
  if (raw.goal_node_id !== null && !nonEmptyString(raw.goal_node_id)) return null
  if (!Array.isArray(raw.goal_constraints)) return null
  return {
    projection_version: CANONICAL_ANALYSIS_STATE_PROJECTION_VERSION,
    options: raw.options as Dict[],
    goal_node_id: raw.goal_node_id as string | null,
    goal_constraints: raw.goal_constraints,
  }
}

/**
 * Build the same normalised top-level analysis-state projection directly from
 * a persisted scenario graph. This is used only by the authenticated recovery
 * read, whose `graph` value is the server row itself rather than a stripped
 * applied-edit wire graph.
 */
export function canonicalAnalysisStateAttestationFromGraph(
  graphValue: unknown,
): CanonicalAnalysisStateAttestation | null {
  const graph = record(graphValue)
  if (!graph) return null
  const options = Array.isArray(graph.options) ? graph.options : []
  if (!options.every(optionCanPopulateRunStore)) return null
  const ids = options.map((option) => (option as Dict).id as string)
  if (new Set(ids).size !== ids.length) return null
  const goalNodeId = typeof graph.goal_node_id === 'string'
    ? graph.goal_node_id
    : null
  return {
    projection_version: CANONICAL_ANALYSIS_STATE_PROJECTION_VERSION,
    options: options as Dict[],
    goal_node_id: goalNodeId,
    goal_constraints: Array.isArray(graph.goal_constraints)
      ? graph.goal_constraints
      : [],
  }
}

function projectionFromAttestation(
  attestation: CanonicalAnalysisStateAttestation,
): Dict | null {
  const options = projectOptions(attestation.options, false)
  if (!options) return null
  return {
    options,
    goal_node_id: attestation.goal_node_id,
    goal_constraints: attestation.goal_constraints,
  }
}

function projectionFromAnalysisReady(value: unknown): Dict | null {
  const analysisReady = record(value)
  if (!analysisReady) return null
  const options = projectOptions(analysisReady.options, true)
  if (!options) return null
  return {
    options,
    goal_node_id: typeof analysisReady.goal_node_id === 'string'
      ? analysisReady.goal_node_id
      : null,
  }
}

/**
 * Validate receipt readiness against the explicit CEE hash-preimage and return
 * the exact store value. Any normalisation that drops or fabricates a hashed
 * option field fails here before the canvas, readiness or freshness can move.
 */
export function prepareCanonicalAnalysisReadyFromReceipt(
  analysisReadyValue: unknown,
): CanonicalAnalysisReadyPreparation {
  const analysisReady = record(analysisReadyValue)
  if (!analysisReady || !(CANONICAL_ANALYSIS_STATE_ATTESTATION_FIELD in analysisReady)) {
    return { ok: false, reason: 'canonical_analysis_state_attestation_missing' }
  }
  const attestation = parseCanonicalAnalysisStateAttestation(analysisReady)
  if (!attestation) {
    return { ok: false, reason: 'canonical_analysis_state_attestation_invalid' }
  }
  if (attestation.goal_node_id === null || attestation.options.length === 0) {
    return { ok: false, reason: 'canonical_analysis_state_not_runnable' }
  }

  const attestedProjection = projectionFromAttestation(attestation)
  const readinessProjection = projectionFromAnalysisReady(analysisReady)
  if (
    !attestedProjection ||
    !readinessProjection ||
    !deepEqual(readinessProjection.options, attestedProjection.options) ||
    readinessProjection.goal_node_id !== attestedProjection.goal_node_id
  ) {
    return { ok: false, reason: 'canonical_analysis_state_receipt_mismatch' }
  }

  const normalised = normaliseV5AnalysisReady({
    ...analysisReady,
    options: attestation.options,
    goal_node_id: attestation.goal_node_id,
  })
  if (!normalised) {
    return { ok: false, reason: 'canonical_analysis_state_receipt_mismatch' }
  }
  const normalisedProjection = projectionFromAnalysisReady(normalised)
  if (
    !normalisedProjection ||
    !deepEqual(normalisedProjection.options, attestedProjection.options) ||
    normalisedProjection.goal_node_id !== attestedProjection.goal_node_id
  ) {
    return { ok: false, reason: 'canonical_analysis_state_receipt_mismatch' }
  }
  return { ok: true, analysisReady: normalised, attestation }
}

/** Exact post-write proof for the Run-authoritative store slice. */
export function storedAnalysisStateMatchesAttestation(
  attestation: CanonicalAnalysisStateAttestation,
): boolean {
  const expected = projectionFromAttestation(attestation)
  const actual = projectionFromAnalysisReady(useCanvasStore.getState().ceeAnalysisReady)
  return expected !== null && actual !== null &&
    deepEqual(actual.options, expected.options) &&
    actual.goal_node_id === expected.goal_node_id &&
    deepEqual(
      useCanvasStore.getState().goalConstraints ?? [],
      expected.goal_constraints,
    )
}

/**
 * Reconcile the hash-bearing Run inputs from a full authenticated server graph.
 * Overall readiness/freshness metadata is retained; this function never
 * invents a status. If no prior readiness exists, recovery remains blocked.
 */
export function reconcileStoredAnalysisStateFromCanonicalGraph(
  graphValue: unknown,
): boolean {
  const attestation = canonicalAnalysisStateAttestationFromGraph(graphValue)
  const existing = useCanvasStore.getState().ceeAnalysisReady
  if (!attestation || !existing || attestation.goal_node_id === null || attestation.options.length === 0) {
    return false
  }
  const normalised = normaliseV5AnalysisReady({
    ...existing,
    options: attestation.options,
    goal_node_id: attestation.goal_node_id,
  })
  if (!normalised) return false
  useCanvasStore.getState().setCeeAnalysisReady(normalised)
  return storedAnalysisStateMatchesAttestation(attestation)
}

export function canonicalAnalysisStateMatchesCanonicalGraph(graphValue: unknown): boolean {
  const attestation = canonicalAnalysisStateAttestationFromGraph(graphValue)
  return attestation !== null && storedAnalysisStateMatchesAttestation(attestation)
}

