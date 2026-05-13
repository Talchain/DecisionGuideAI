/**
 * Debug Bundle Export Utility
 *
 * Exports all debug data as a comprehensive JSON bundle or individual files.
 * Creates a structured bundle containing all payloads and diagnostic info.
 *
 * v1.5: Comprehensive capture upgrade — always-on.
 */

import type {
  DebugData,
  BuildVersions,
  CeeTraceData,
  DiagnosticChecks,
  LlmRawData,
  ValidationIssue,
  ValidationSummary,
  OrchestratorStatus,
  V12_4Checks,
  RequestIdChain,
  FeatureFlagsAtRequest,
  ServiceTiming,
  SchemaVersions,
  SchemaVersionConsistencyStatus,
  SchemaVersionUnknownReason,
  CEEObservabilityData,
} from '../hooks/useDebugData'
import { getVersionInfo, getClientBuild } from '../../../lib/version-cache'
import { getBufferedLogs, type BufferedLog } from '../../../utils/debugLogBuffer'
import { DEBUG_LLM_RAW_MAX_CHARS } from '../../../utils/payloadRedaction'
import { getUserActions } from '../../../lib/debug-state'
import {
  derivePipelineStatus,
  type PipelineStatus,
  type RecoverableEnvelope,
} from '../../../lib/derivePipelineStatus'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'

// =============================================================================
// Feature Flag
// =============================================================================

/**
 * Check if Debug Bundle v2.0 is enabled.
 * Default: ON in development/staging, OFF in production.
 */
export function isDebugBundleV2Enabled(): boolean {
  try {
    const explicit = import.meta.env.VITE_DEBUG_BUNDLE_V2
    if (explicit !== undefined) {
      return explicit === 'true' || explicit === '1' || explicit === true
    }
    // Default: ON in dev/staging, OFF in production
    const env = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development'
    return env !== 'production'
  } catch {
    return false
  }
}

// =============================================================================
// Types
// =============================================================================

interface DiagnosticInfo {
  timestamp: string
  request_id: string | null
  environment: string
  client_version: string
  user_agent: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

/**
 * P0 V5 golden-path repair (Wave 5 wiring) + follow-up corrections.
 *
 * Adapter that synthesises a RequestTrace shape from the bundle data
 * and runs the scoped `derivePipelineStatus` derivation. Caller passes
 * the EXTRACTED `envelopeAnalysisReady` (from
 * `extractAnalysisReadyFromBlocks` / envelope root) explicitly so the
 * derivation sees what was actually on the response, not a stale read
 * from canvas store. Pre-fix this function read
 * `data.ceeAnalysisReady` which doesn't exist on `DebugData`, so a
 * captured envelope with `analysis_ready.status: 'failed'` could fall
 * through to `ui_render_success` — flagged by review.
 *
 * The "is this an analysis turn" signal is now derived from the
 * envelope (analysis_ready presence, recoverable rejection category,
 * or analysis-shaped payload) rather than `data.services.plot != null`.
 * The PLoT-presence heuristic misclassified non-analysis turns that
 * touched PLoT for evidence pre-fetch and CEE-only analysis paths.
 */
type AnalysisReadyShape =
  | { status?: unknown; freshness?: unknown; freshness_reason?: unknown }
  | null
  | undefined

interface BundleStatusInputs {
  data: DebugData
  envelopeAnalysisReady: AnalysisReadyShape
}

interface BundleStatusResult {
  status: PipelineStatus
  /**
   * Structured source field describing how the verdict was reached.
   * Replaces the original single-string source per follow-up review:
   * "every missing field has a clear reason".
   */
  source: {
    capture:
      | 'derived_from_trace'
      | 'derived_from_downstream'
      | 'cee_response_not_captured'
      | 'no_cee_call_recorded'
    is_analysis_turn: boolean
    is_analysis_turn_signal:
      | 'analysis_ready_present'
      | 'analysis_inputs_present'
      | 'recoverable_analysis_envelope'
      | 'no_analysis_signal'
    envelope_analysis_ready_status: string | null
    envelope_freshness: string | null
    envelope_freshness_reason: string | null
    /** Inputs that were null/undefined when the verdict was computed. */
    missing_inputs: ReadonlyArray<
      | 'cee_service_record'
      | 'cee_response_payload'
      | 'envelope_analysis_ready'
      | 'envelope_freshness'
    >
  }
}

/**
 * Third-round review (P0.3 + IMP.1): orchestrator flows nest CEE under
 * PLoT, surfacing payloads via `cee_downstream_request` /
 * `cee_downstream_response` rather than the direct `cee_request` /
 * `cee_response` fields. The bundle's other extraction paths already
 * use this fallback (see lines ~1223-1224 and ~1745-1746); the
 * pipeline-status derivation must too. Without this normalisation:
 *   - A downstream-only CEE call → `services.cee == null` (depending
 *     on bundle wiring) → emits `no_cee_call_recorded`, hiding the
 *     real CEE state.
 *   - A captured downstream response with a failing analysis_ready →
 *     could fall through to `ui_render_success` because the direct
 *     response is read first and is null.
 * Returns the EFFECTIVE payload triplet — direct first, downstream as
 * fallback.
 */
/**
 * Effective CEE service record. Synthesised from
 * `data.cee_downstream[0]` when the direct `data.services.cee` is
 * null but a downstream call was recorded — fixes the fourth-round
 * P0 #1 bug where downstream-only flows reported
 * proxy_or_network_failure because `services.cee` was null and
 * httpStatus came back null.
 */
type EffectiveCeeService = {
  status: number | null
  success: boolean
  duration_ms: number | null
  error?: string
} | null

function extractEffectiveCeePayloads(data: DebugData): {
  request: Record<string, unknown> | null
  response: Record<string, unknown> | null
  service: EffectiveCeeService
  source: 'direct' | 'downstream' | 'none'
} {
  const directReq = asRecord(data.payloads.cee_request)
  const directRes = asRecord(data.payloads.cee_response)
  const downstreamReq = asRecord(data.payloads.cee_downstream_request)
  const downstreamRes = asRecord(data.payloads.cee_downstream_response)
  const downstreamCall = data.cee_downstream?.[0] ?? null

  // Direct path takes precedence. Direct service record is read from
  // data.services.cee; downstream call data is ignored even if present.
  if (directReq != null || directRes != null) {
    const direct = data.services.cee
    return {
      request: directReq,
      response: directRes,
      service: direct
        ? {
            status: direct.status,
            success: direct.success,
            duration_ms: direct.duration_ms,
            ...(direct.error !== undefined ? { error: direct.error } : {}),
          }
        : null,
      source: 'direct',
    }
  }

  // Downstream path. The service record may be in data.services.cee
  // (CEE called via PLoT but tracked in services), OR it may live in
  // data.cee_downstream[0]. Synthesise from whichever is present —
  // pre-fix this returned `service: data.services.cee` which was null
  // for nested-orchestrator flows, breaking the verdict.
  if (downstreamReq != null || downstreamRes != null || downstreamCall != null) {
    let service: EffectiveCeeService = null
    if (data.services.cee) {
      const direct = data.services.cee
      service = {
        status: direct.status,
        success: direct.success,
        duration_ms: direct.duration_ms,
        ...(direct.error !== undefined ? { error: direct.error } : {}),
      }
    } else if (downstreamCall) {
      service = {
        status: downstreamCall.status_code,
        success: downstreamCall.success,
        duration_ms: downstreamCall.latency_ms,
        ...(downstreamCall.error !== undefined ? { error: downstreamCall.error } : {}),
      }
    }
    return {
      request: downstreamReq ?? asRecord(downstreamCall?.request),
      response: downstreamRes ?? asRecord(downstreamCall?.response),
      service,
      source: 'downstream',
    }
  }

  // No CEE evidence at all — direct path with services.cee value
  // covers the "service captured but no payload" case at the top of
  // the function.
  return {
    request: null,
    response: null,
    service: data.services.cee
      ? {
          status: data.services.cee.status,
          success: data.services.cee.success,
          duration_ms: data.services.cee.duration_ms,
          ...(data.services.cee.error !== undefined
            ? { error: data.services.cee.error }
            : {}),
        }
      : null,
    source: 'none',
  }
}

function deriveBundlePipelineStatusV2(inputs: BundleStatusInputs): BundleStatusResult {
  const { data, envelopeAnalysisReady } = inputs
  // Third-round review: read the EFFECTIVE CEE payloads (direct or
  // downstream). The original implementation read only direct, which
  // misclassified orchestrator flows where CEE is nested under PLoT.
  const effective = extractEffectiveCeePayloads(data)
  const cee = effective.service
  const completed = cee != null || effective.response != null
  const httpStatus = cee?.status ?? null
  const errorMsg = cee?.error

  // Recoverable-envelope detection. CEE returns `{ error: { code,
  // retryable, category? } }` on 4xx recoverable turns; the category
  // determines whether the error was analysis-related.
  const ceeResponse = effective.response as
    | {
        error?: { retryable?: boolean; category?: string | null }
        analysis_inputs?: unknown
      }
    | null
    | undefined
  const recoverableEnvelope: RecoverableEnvelope | undefined =
    ceeResponse?.error
      ? {
          retryable: ceeResponse.error.retryable,
          category: ceeResponse.error.category ?? null,
        }
      : undefined

  // Read analysis_ready from the EFFECTIVE response via the shared
  // helper. Direct path uses caller's pre-extracted value (already
  // root + block extraction). Downstream path goes through the same
  // root + block helper — pre-fix this read only `resp.analysis_ready`
  // and missed block-nested analysis_ready (e.g. graph_patch /
  // applied_graph). Fourth-round P0 #2 + IMP #2.
  const downstreamAR =
    envelopeAnalysisReady != null || effective.source !== 'downstream'
      ? null
      : readAnalysisReadyFromEnvelope(effective.response)
  const envelopeAR = (envelopeAnalysisReady ?? downstreamAR ?? null) as AnalysisReadyShape
  const ar = envelopeAR as
    | { status?: unknown; freshness?: unknown; freshness_reason?: unknown }
    | null
  const arStatus = typeof ar?.status === 'string' ? ar.status : null
  const arFreshness = typeof ar?.freshness === 'string' ? ar.freshness : null
  const arFreshnessReason =
    typeof ar?.freshness_reason === 'string' ? ar.freshness_reason : null
  const ceeAnalysisReady: CEEAnalysisReady | null = envelopeAR
    ? ({
        // Match the CEE adapter type; fields beyond what
        // derivePipelineStatus reads are filled with safe defaults.
        options: [],
        goal_node_id: '',
        ...(arStatus !== null
          ? { status: arStatus as CEEAnalysisReady['status'] }
          : {}),
        ...(arFreshness !== null
          ? { freshness: arFreshness as CEEAnalysisReady['freshness'] }
          : {}),
      } as CEEAnalysisReady)
    : null

  // Analysis-turn detection from the envelope, not from PLoT presence.
  // Order: explicit analysis_ready on response > analysis_inputs in
  // request body > recoverable analysis-error envelope. PLoT presence
  // alone is no longer used because non-analysis turns can touch PLoT
  // for evidence pre-fetch.
  let isAnalysisTurnSignal: BundleStatusResult['source']['is_analysis_turn_signal'] =
    'no_analysis_signal'
  let isAnalysisTurn = false
  if (envelopeAR != null) {
    isAnalysisTurnSignal = 'analysis_ready_present'
    isAnalysisTurn = true
  } else if (
    ceeResponse?.analysis_inputs != null ||
    (effective.request as { analysis_inputs?: unknown } | null)?.analysis_inputs != null
  ) {
    isAnalysisTurnSignal = 'analysis_inputs_present'
    isAnalysisTurn = true
  } else if (recoverableEnvelope?.category) {
    const ANALYSIS_CATS = new Set([
      'analysis_failed',
      'analysis_partial',
      'analysis_blocked',
      'plot_unavailable',
      'plot_timeout',
    ])
    if (ANALYSIS_CATS.has(recoverableEnvelope.category)) {
      isAnalysisTurnSignal = 'recoverable_analysis_envelope'
      isAnalysisTurn = true
    }
  }

  const status = derivePipelineStatus({
    trace: {
      status: httpStatus,
      completed,
      error: typeof errorMsg === 'string' ? errorMsg : undefined,
      responseHash: undefined,
      service: cee != null ? 'cee' : undefined,
      serviceBuild: undefined,
    },
    isAnalysisTurn,
    ceeAnalysisReady,
    recoverableEnvelope,
    payloadCaptureDisabled: completed && effective.response == null,
  })

  const missing: BundleStatusResult['source']['missing_inputs'] = (() => {
    const m: Array<BundleStatusResult['source']['missing_inputs'][number]> = []
    if (!cee && effective.source === 'none') m.push('cee_service_record')
    if (!effective.response) m.push('cee_response_payload')
    if (!envelopeAR) m.push('envelope_analysis_ready')
    if (arFreshness === null) m.push('envelope_freshness')
    return m
  })()

  // Third-round review: capture enum now distinguishes direct vs
  // downstream so support can tell which extraction path produced the
  // payload — critical for orchestrator flows where CEE is nested.
  const capture: BundleStatusResult['source']['capture'] =
    effective.source === 'direct'
      ? 'derived_from_trace'
      : effective.source === 'downstream'
        ? 'derived_from_downstream'
        : cee == null
          ? 'no_cee_call_recorded'
          : 'cee_response_not_captured'

  return {
    status,
    source: {
      capture,
      is_analysis_turn: isAnalysisTurn,
      is_analysis_turn_signal: isAnalysisTurnSignal,
      envelope_analysis_ready_status: arStatus,
      envelope_freshness: arFreshness,
      envelope_freshness_reason: arFreshnessReason,
      missing_inputs: missing,
    },
  }
}

function getPipelinePath(value: unknown): 'unified' | 'legacy' | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized.includes('unified')) return 'unified'
  if (normalized.includes('legacy')) return 'legacy'
  return null
}

function toWarningsList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).code === 'string') {
        return (item as Record<string, unknown>).code as string
      }
      return null
    })
    .filter((v): v is string => typeof v === 'string')
}

/**
 * Strip raw MC sample arrays from options to keep export size under control.
 * Everything else passes through verbatim.
 */
function stripOptionSamples(options: unknown): unknown {
  if (!Array.isArray(options)) return options
  return options.map((opt) => {
    if (!opt || typeof opt !== 'object') return opt
    const { samples, ...rest } = opt as Record<string, unknown>
    return rest
  })
}

function extractIslRawFields(islResponse: unknown) {
  const isl = asRecord(islResponse)
  if (!isl) {
    return {
      stability_thresholds: null,
      factor_sensitivity_3c_fields: [],
      confounding_sensitivity: null,
      edge_e_values: null,
      factor_evpi: null,
      conditional_winners: null,
      inference_warnings: null,
      auto_noise_applied: null,
      stability_penalty_factor: null,
      defaulted_root_node_ids: null,
      _full: null,
    }
  }

  // Capture the full ISL response, excluding options[].samples (raw MC arrays).
  // Cap top-level arrays at 100 items (consistent with redaction config) to control size.
  const full: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(isl)) {
    if (key === 'options') {
      const stripped = stripOptionSamples(value)
      full[key] = Array.isArray(stripped) ? stripped.slice(0, 100) : stripped
    } else if (Array.isArray(value)) {
      full[key] = value.slice(0, 100)
    } else {
      full[key] = value
    }
  }

  // Legacy fields (always present for backwards compat)
  const factorSensitivity = Array.isArray(isl.factor_sensitivity_3c_fields)
    ? isl.factor_sensitivity_3c_fields
    : []

  return {
    // Legacy named fields — preserved for existing consumers
    stability_thresholds: asRecord(isl.stability_thresholds),
    factor_sensitivity_3c_fields: factorSensitivity.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === 'object'
    ),
    confounding_sensitivity: asRecord(isl.confounding_sensitivity),

    // New fields — explicit extraction for diagnostic visibility
    edge_e_values: Array.isArray(isl.edge_e_values) ? isl.edge_e_values : null,
    factor_evpi: Array.isArray(isl.factor_evpi) ? isl.factor_evpi : null,
    conditional_winners: Array.isArray(isl.conditional_winners) ? isl.conditional_winners : null,
    inference_warnings: Array.isArray(isl.inference_warnings) ? isl.inference_warnings : null,
    auto_noise_applied: typeof isl.auto_noise_applied === 'boolean' ? isl.auto_noise_applied : null,
    stability_penalty_factor: typeof isl.stability_penalty_factor === 'number' ? isl.stability_penalty_factor : null,
    defaulted_root_node_ids: Array.isArray(isl.defaulted_root_node_ids) ? isl.defaulted_root_node_ids : null,

    // Full ISL response passthrough (minus options[].samples)
    _full: full,
  }
}

interface PlotEnrichment {
  factor_sensitivity: unknown[] | null
  range_derivation_sources: unknown | null
  conditional_probabilities: unknown[] | null
  m1_coaching: {
    evidence_gaps: unknown | null
    story_headlines: unknown | null
    readiness: unknown | null
    headline_type: unknown | null
  } | null
  edge_e_values: unknown[] | null
  near_tie: unknown | null
  flip_thresholds: unknown[] | null
  decision_brief: {
    headline: unknown | null
    top_drivers: unknown | null
    robustness: unknown | null
  } | null
}

/**
 * Extract PLoT enriched fields — the values the UI actually renders after PLoT
 * confidence merge, label enrichment, and robustness decoration.
 */
function extractPlotEnrichment(plotResponse: unknown): PlotEnrichment | null {
  const plot = asRecord(plotResponse)
  if (!plot) return null

  const meta = asRecord(plot._meta ?? plot.meta)
  const robustness = asRecord(plot.robustness)
  const m1Coaching = asRecord(plot.m1_coaching)
  const decisionBrief = asRecord(plot.decision_brief)

  return {
    factor_sensitivity: Array.isArray(plot.factor_sensitivity) ? plot.factor_sensitivity : null,
    range_derivation_sources: meta?.range_derivation_sources ?? null,
    conditional_probabilities: Array.isArray(plot.conditional_probabilities) ? plot.conditional_probabilities : null,
    m1_coaching: m1Coaching ? {
      evidence_gaps: m1Coaching.evidence_gaps ?? null,
      story_headlines: m1Coaching.story_headlines ?? null,
      readiness: m1Coaching.readiness ?? null,
      headline_type: m1Coaching.headline_type ?? null,
    } : null,
    edge_e_values: robustness && Array.isArray(robustness.edge_e_values) ? robustness.edge_e_values : null,
    near_tie: robustness?.near_tie ?? null,
    flip_thresholds: Array.isArray(robustness?.flip_thresholds) ? robustness.flip_thresholds : null,
    decision_brief: decisionBrief ? {
      headline: decisionBrief.headline ?? null,
      top_drivers: decisionBrief.top_drivers ?? null,
      robustness: decisionBrief.robustness ?? null,
    } : null,
  }
}

/**
 * Extract goal_constraints from graph_patch blocks in the envelope.
 * Falls back to searching blocks when not present at envelope root.
 */
function extractGoalConstraintsFromBlocks(envelope: Record<string, unknown> | null): unknown[] | null {
  if (!envelope) return null
  const blocks = Array.isArray(envelope.blocks) ? envelope.blocks : []
  for (const block of blocks) {
    const b = asRecord(block)
    if (!b) continue
    const data = asRecord(b.data)
    if (data && Array.isArray(data.goal_constraints) && data.goal_constraints.length > 0) {
      return data.goal_constraints as unknown[]
    }
  }
  return null
}

/**
 * Extract analysis_ready from graph_patch blocks in the envelope.
 * Falls back to searching blocks when not present at envelope root.
 *
 * CEE may place analysis_ready at:
 *   block.data.analysis_ready          (standard location)
 *   block.data.applied_graph.analysis_ready  (draft_graph responses)
 *
 * Both locations are checked so the debug bundle matches what adaptCEEBlock
 * reads in production (useConversation.ts, adaptCEEBlock).
 */
function extractAnalysisReadyFromBlocks(envelope: Record<string, unknown> | null): unknown | null {
  if (!envelope) return null
  const blocks = Array.isArray(envelope.blocks) ? envelope.blocks : []
  for (const block of blocks) {
    const b = asRecord(block)
    if (!b) continue
    const data = asRecord(b.data)
    if (!data) continue
    if (data.analysis_ready != null) {
      return data.analysis_ready
    }
    // Fallback: draft_graph responses nest analysis_ready inside applied_graph
    const appliedGraph = asRecord(data.applied_graph)
    if (appliedGraph && appliedGraph.analysis_ready != null) {
      return appliedGraph.analysis_ready
    }
  }
  return null
}

/**
 * Fourth-round review (P0 #2 + IMP #2): single helper combining
 * envelope-root and block-nested analysis_ready extraction. Both
 * direct CEE responses and downstream-CEE responses (orchestrator
 * flows) flow through this helper so the extraction cannot diverge.
 *
 * Returns null when no analysis_ready is present at root or in any
 * block — distinct from "envelope absent" which is the caller's
 * responsibility to handle.
 */
function readAnalysisReadyFromEnvelope(envelope: Record<string, unknown> | null): unknown | null {
  if (!envelope) return null
  if (envelope.analysis_ready != null) return envelope.analysis_ready
  return extractAnalysisReadyFromBlocks(envelope)
}

function extractCausalClaimsDiagnostic(ceeResponse: unknown): DebugBundle['pipeline']['causal_claims_diagnostic'] {
  const cee = asRecord(ceeResponse)
  const trace = asRecord(cee?.trace)
  const pipeline = asRecord(trace?.pipeline ?? cee?.pipeline)

  const hasCausalClaimsField =
    (pipeline && Object.prototype.hasOwnProperty.call(pipeline, 'causal_claims')) ||
    (cee && Object.prototype.hasOwnProperty.call(cee, 'causal_claims'))

  const rawClaims = (pipeline?.causal_claims ?? cee?.causal_claims) as unknown
  const validatedClaims = (pipeline?.validated_causal_claims ?? cee?.validated_causal_claims) as unknown
  const droppedClaims = (pipeline?.dropped_causal_claims ?? cee?.dropped_causal_claims) as unknown

  const rawCount = Array.isArray(rawClaims) ? rawClaims.length : 0
  const validatedCount = Array.isArray(validatedClaims)
    ? validatedClaims.length
    : (typeof pipeline?.causal_claims_validated_count === 'number'
        ? pipeline.causal_claims_validated_count
        : 0)
  const droppedCount = Array.isArray(droppedClaims)
    ? droppedClaims.length
    : Math.max(rawCount - validatedCount, 0)

  const warnings = [
    ...toWarningsList(cee?.validation_warnings),
    ...toWarningsList(trace?.validation_warnings),
    ...toWarningsList(pipeline?.validation_warnings),
  ].filter((code) => code.includes('CAUSAL_CLAIM'))

  return {
    llm_emitted: Boolean(hasCausalClaimsField),
    raw_count: rawCount,
    validated_count: validatedCount,
    dropped_count: droppedCount,
    warnings,
  }
}

function extractCeePipelineQuickFields(data: DebugData): {
  cee_pipeline_path: 'unified' | 'legacy' | null
  cee_strp_mutations_count: number | null
} {
  const repairSummary = asRecord(data.cee_observability?.repair_summary)
  const pathFromRepairSummary = getPipelinePath(
    repairSummary?.cee_pipeline_path ?? repairSummary?.pipeline_path
  )
  const pathFromProvenance = getPipelinePath(data.pipeline.cee_provenance?.pipeline_path)

  const strpFromRepairSummary =
    typeof repairSummary?.cee_strp_mutations_count === 'number'
      ? repairSummary.cee_strp_mutations_count
      : typeof repairSummary?.strp_mutations_count === 'number'
        ? repairSummary.strp_mutations_count
        : Array.isArray(repairSummary?.strp_mutations)
          ? repairSummary.strp_mutations.length
          : null

  const strpFromPipeline = Array.isArray((data.pipeline.strp as Record<string, unknown> | undefined)?.mutations)
    ? (((data.pipeline.strp as Record<string, unknown>).mutations as unknown[]).length)
    : null

  return {
    cee_pipeline_path: pathFromRepairSummary ?? pathFromProvenance,
    cee_strp_mutations_count: strpFromRepairSummary ?? strpFromPipeline,
  }
}

// =============================================================================
// V1.5 types — display_state, enriched full_graph, orchestrator context,
// user actions, panel state
// =============================================================================

/**
 * Where the captured win_probability came from in the response payload.
 *
 * Provenance labels are bundle-level paths: they describe where a consumer
 * reading the exported JSON would find the same datum. The exporter sources
 * the raw V2 wire shape from `state.rawV2Response` (canvas-store root), which
 * is faithfully captured into the bundle under `payloads.plot_response`. The
 * `results.report.option_probabilities` fallback is the V4/V5 mapper-
 * synthesised keyed map (`src/v5/mapV5AnalysisToReport.ts:557`,
 * `src/components/results/useResultsSectionData.ts:1042`) — distinct from the
 * raw wire response, so it carries a distinct label.
 *
 * If a new fallback path is added in resolveOption, add the corresponding
 * enum member here.
 */
export type WinProbabilitySource =
  | 'payloads.plot_response.option_comparison.win_probability'
  | 'payloads.plot_response.options.win_probability'
  | 'results.report.option_probabilities.win_probability'
  | 'unmatched'

/** How the captured rank was computed (analytical vs canvas fallback). */
export type RankSource = 'win_probability_desc' | 'canvas_order' | 'unranked'

/**
 * Where the captured influence / sensitivity value came from.
 *
 * As with WinProbabilitySource, provenance is bundle-level: the wire-level V2
 * factor_sensitivity array travels from `state.rawV2Response.factor_sensitivity`
 * (canvas-store root) into the bundle under `payloads.plot_response.factor_sensitivity`.
 * The previous `plot_enrichment.factor_sensitivity.*` labels were misleading —
 * `plot_enrichment` mirrors the same data at a different bundle key and was never
 * the read source; the dead `results.apiResponse.*` labels referenced a non-
 * existent canvas-store field and have been removed.
 */
export type FactorMetricSource =
  | 'payloads.plot_response.factor_sensitivity.influence_score'
  | 'payloads.plot_response.factor_sensitivity.sensitivity_score'
  | 'unmatched'

/** V1.5: Display state snapshot — what the UI actually rendered at export time */
export interface DisplayState {
  active_panel: string | null
  active_tab: string | null
  active_section: string | null
  canvas_node_count: number
  canvas_edge_count: number
  canvas_node_types: Record<string, number>
  rendered_options: Array<{
    id: string
    /** Option ID resolved from PLoT response option_comparison/options when available. */
    option_id: string | null
    label_displayed: string | null
    /**
     * Raw numeric win_probability mirroring `payloads.plot_response.option_comparison[*].win_probability`.
     * Capture-time passthrough — UI consumers apply their own formatting (e.g. `Math.round(x * 100)%`).
     */
    win_probability_displayed: number | null
    /** Provenance discriminator: which payload path supplied `win_probability_displayed`. */
    win_probability_source: WinProbabilitySource
    /**
     * Analytical rank computed from `win_probability` descending, matching the
     * sort order used by `OptionCards.tsx` (`OptionCards.tsx:506-513`) so the
     * bundle reflects what the user actually sees in the rendered list.
     * Deterministic tie-break: equal win_probability → secondary sort by option_id ascending.
     */
    rank_displayed: number | null
    /** How `rank_displayed` was computed: analytical sort, canvas fallback, or unranked. */
    rank_source: RankSource
  }> | null
  rendered_factors: Array<{
    id: string
    /** Factor ID resolved from PLoT factor_sensitivity when available. */
    factor_id: string | null
    label_displayed: string | null
    value_displayed: string | null
    /**
     * Raw numeric INFLUENCE (rank-based structural causal importance) — the value
     * the production factor card actually displays under the "Influence" column
     * (`DriversSection.tsx:805-810`). Sourced from `factor_sensitivity[*].influence_score`.
     */
    influence_displayed: number | null
    /** Provenance discriminator for `influence_displayed`. */
    influence_source: FactorMetricSource
    /**
     * Raw numeric SENSITIVITY (elasticity-based magnitude with direction sign) —
     * sourced from `factor_sensitivity[*].sensitivity_score`. Distinct concept
     * from influence; captured separately to preserve analytical fidelity even
     * though the production card does not visibly render this metric today.
     */
    sensitivity_displayed: number | null
    /** Provenance discriminator for `sensitivity_displayed`. */
    sensitivity_source: FactorMetricSource
  }> | null
  analysis_status_displayed: string | null
  hero_headline_displayed: string | null
  /**
   * Canonical analysis display state from `deriveAnalysisDisplayState`.
   * Distinct from `analysis_status_displayed` (which mirrors the raw
   * `results.status` enum) — this field captures the four-state UI
   * mapping the user actually sees: not_ready / ready_to_analyse /
   * complete / results_stale.
   * Backwards-compatible: added alongside the legacy fields so existing
   * bundle consumers keep working until they migrate.
   */
  analysis_display_state: 'not_ready' | 'ready_to_analyse' | 'complete' | 'results_stale' | null
  /** Headline matching what the pre-analysis hero banner displays. */
  analysis_display_headline: string | null
}

/** V1.5: Enriched full_graph node with all store fields */
export interface EnrichedGraphNode {
  id: string
  label: string
  type: string
  kind?: string
  description?: string
  observed_state?: Record<string, unknown> | null
  category?: string | null
  interventions?: unknown[] | null
  interventionKeys?: string[] | null
  // V3 factor fields
  display_value?: string | null
  intercept?: number | null
  encoding_map?: Record<string, unknown> | null
  // V3 option fields
  is_baseline?: boolean | null
  // V3 goal fields
  goal_threshold?: number | null
  goal_threshold_raw?: number | null
  goal_threshold_unit?: string | null
  goal_threshold_cap?: number | null
  data?: Record<string, unknown>
}

/** V1.5: Enriched full_graph edge with all store fields */
export interface EnrichedGraphEdge {
  id: string
  source: string
  target: string
  label?: string
  strength?: number
  strength_mean?: number
  strength_std?: number
  belief_exists?: number
  effect_direction?: string
  weight?: number
  direction?: string
  beliefStrength?: number
  // V3 edge metadata
  edge_type?: string
  provenance_source?: string
  exists_probability?: number
}

/** V1.5: Enriched full_graph with _meta */
export interface EnrichedFullGraph {
  _meta: {
    node_type_field: string
    enriched: true
  }
  factors: EnrichedGraphNode[]
  edges: EnrichedGraphEdge[]
  options: EnrichedGraphNode[]
}

/** V1.5: Orchestrator context */
export interface OrchestratorContext {
  turn_count: number
  current_turn_type: string | null
  last_turn_id: string | null
  active_coaching_signals: string[]
  last_response_blocks: Array<{
    block_type: string
    block_id: string | null
    state: string
  }> | null
  conversation_length: number
  zone1_prompt_id: string | null
  zone2_assembly_keys: string[] | null
  _unavailable_reason?: string
}

/** V1.5: User action entry */
export interface UserActionEntry {
  action: string
  timestamp: string
  detail?: Record<string, unknown>
}

/** V1.5: Panel state */
export interface PanelStateV1_5 {
  available: true
  source: 'export_time_snapshot'
  panels: Record<string, { visible: boolean; active_tab?: string }>
}

// =============================================================================
// Bundle type — supports both v1.4 and v1.5
// =============================================================================

interface DebugBundle {
  /** Bundle metadata */
  meta: {
    version: '1.5' | '2.0'
    created_at: string
    request_id: string | null
    client_build: string | null
    environment: string
    /** Redaction policy applied at capture time */
    redaction: {
      enabled: true
      max_string_length: number
      max_array_items: number
      max_depth: number
      never_truncate_keys?: string[]
      never_truncate_max_length?: number
    }
    /** Whether any arrays were truncated during capture */
    truncation_applied?: boolean
    /** Message when truncation occurred */
    truncation_message?: string
  }
  /** Diagnostic summary */
  diagnostic: DiagnosticInfo
  /** Service build versions */
  builds: BuildVersions
  /** All payloads */
  payloads: {
    cee_request: unknown
    cee_response: unknown
    plot_request: unknown
    plot_response: unknown
    isl_request: unknown
    isl_response: unknown
  }
  /** Service status summary */
  services: {
    cee: { status: number | null; duration_ms: number | null; success: boolean } | null
    plot: { status: number | null; duration_ms: number | null; success: boolean } | null
    isl: { status: number | null; duration_ms: number | null; success: boolean } | null
  }
  /** Pipeline summary */
  pipeline: {
    status: string
    /**
     * P0 V5 golden-path repair (Wave 5 wiring): scoped pipeline status
     * enum derived from the actual trace + freshness signals, replacing
     * the legacy `status` string for any consumer wanting an honest
     * verdict. Six states cover the complete failure surface; see
     * `derivePipelineStatus`.
     */
    v5_pipeline_status: PipelineStatus
    /**
     * Structured source field describing how the verdict was reached.
     * Replaces the original single-string source per third-round
     * review: "every missing field has a clear reason".
     */
    v5_pipeline_status_source: {
      capture:
        | 'derived_from_trace'
        | 'derived_from_downstream'
        | 'cee_response_not_captured'
        | 'no_cee_call_recorded'
      is_analysis_turn: boolean
      is_analysis_turn_signal:
        | 'analysis_ready_present'
        | 'analysis_inputs_present'
        | 'recoverable_analysis_envelope'
        | 'no_analysis_signal'
      envelope_analysis_ready_status: string | null
      envelope_freshness: string | null
      envelope_freshness_reason: string | null
      missing_inputs: ReadonlyArray<
        | 'cee_service_record'
        | 'cee_response_payload'
        | 'envelope_analysis_ready'
        | 'envelope_freshness'
      >
    }
    total_duration_ms: number | null
    llm_metadata: unknown
    llm_raw: LlmRawData | null
    cee_pipeline_path: 'unified' | 'legacy' | null
    cee_strp_mutations_count: number | null
    causal_claims_diagnostic: {
      llm_emitted: boolean
      raw_count: number
      validated_count: number
      dropped_count: number
      warnings: string[]
    }
    node_extraction: unknown
    connectivity: unknown
  }
  /** ISL diagnostic details */
  isl_diagnostic: {
    data_source: 'downstream_calls' | 'direct_capture' | 'plot_response_extraction' | 'none'
    downstream_calls_path_found: string | null
    downstream_calls_paths_checked: string[]
    plot_response_keys: string[]
    downstream_calls_content: unknown
    plot_build: string | null
    expected_plot_build_with_feature: string
    endpoint: string | null
    status_code: number | null
    duration_ms: number | null
    success: boolean | null
    error: string | null
    isl_raw_fields: {
      stability_thresholds: Record<string, unknown> | null
      factor_sensitivity_3c_fields: Array<Record<string, unknown>>
      confounding_sensitivity: Record<string, unknown> | null
      edge_e_values: unknown[] | null
      factor_evpi: unknown[] | null
      conditional_winners: unknown[] | null
      inference_warnings: unknown[] | null
      auto_noise_applied: boolean | null
      stability_penalty_factor: number | null
      defaulted_root_node_ids: unknown[] | null
      _full: Record<string, unknown> | null
    }
  }
  /** PLoT enriched fields — post-merge values the UI actually renders */
  plot_enrichment: PlotEnrichment | null
  /** Gate statuses */
  gates: Array<{ name: string; status: string; message?: string }>
  /** Graph validation issues (ISL critiques + UI-side checks) */
  validation: {
    summary: ValidationSummary & {
      cee_repairs?: number
      cee_retries?: number
    }
    issues: ValidationIssue[]
  }
  /** Captured console logs */
  console_logs: BufferedLog[]
  /** Diagnostic checks for troubleshooting */
  diagnostic_checks: DiagnosticChecks
  /** README content */
  readme: string
  /** Full graph data (when explicitly requested) */
  full_graph?: {
    _meta?: { node_type_field: string; enriched: true }
    factors: Array<Record<string, unknown>>
    edges: Array<Record<string, unknown>>
    options: Array<Record<string, unknown>>
  }
  /** CEE option interventions (ceeAnalysisReady.options) — real intervention data */
  cee_options?: Array<Record<string, unknown>> | null

  // Enhancement sections (Debug Panel V2.1)

  /** Orchestrator status from CEE pipeline */
  orchestrator?: OrchestratorStatus | OrchestratorContext | null

  /** V12.4 category field presence check for factors */
  v12_4_checks?: V12_4Checks | null

  /** Request ID chain for tracking ID propagation across services */
  request_id_chain?: RequestIdChain | null

  /** Feature flags at the time of request */
  feature_flags_at_request?: FeatureFlagsAtRequest | Record<string, boolean> | null

  /** Timestamps per service for timing analysis */
  timing?: ServiceTiming | null

  /** Schema version consistency check */
  schema_versions?: SchemaVersions | null

  /** CEE Observability data (sanitized - raw I/O stripped) */
  cee_observability?: Omit<CEEObservabilityData, 'llm_calls'> & {
    llm_calls: Array<Omit<CEEObservabilityData['llm_calls'][number], 'raw_prompt' | 'raw_response'>>
  } | null
  /** CEE routing + trace metadata including resolved LLM model/provider */
  cee_trace?: CeeTraceData | null
  export_summary_schema: {
    derivation: 'export_time_from_debugdata_only'
    runtime_capture_included: boolean
    note: string
  }
  session: {
    timestamp: string
    request_id: string | null
    build_info: {
      client_build: string | null
      client_version: string
      environment: string
    }
    feature_flags: Record<string, unknown> | null
    scenario_id: null
    current_route: null
    session_id: null
    session_started_at: null
    session_duration_ms: null
  }
  user_actions: UserActionEntry[] | []
  request_summary: Array<{
    request_id: string | null
    ui_generated_request_id: string | null
    plot_request_id: string | null
    isl_request_id: string | null
    cee_trace_id: string | null
    request_chain_present: boolean
  }>
  response_summary: Array<{
    service: 'cee' | 'plot' | 'isl'
    status: number | null
    duration_ms: number | null
    success: boolean | null
    error: string | null
    payload_present: boolean
  }>
  repair_and_filter_summary: Array<{
    source: string
    available: boolean
    repairs_applied: number | null
    repair_types: string[] | null
    retries: number | null
  }>
  render_summary: {
    available: boolean
    source: null
  }
  panel_state: {
    available: boolean
    source: null | 'export_time_snapshot'
    panels?: Record<string, { visible: boolean; active_tab?: string }>
  }
  cross_surface_events: []

  /** Display state snapshot — what the UI actually rendered at export time */
  display_state: DisplayState | null

  // =========================================================================
  // V2.0 sections — present only when VITE_DEBUG_BUNDLE_V2 is ON
  // =========================================================================

  /** CEE diagnostic trace: LLM call records. Null when trace absent or v2 disabled. */
  llm_calls?: unknown[] | null
  /** CEE diagnostic trace: prompt identity per task. */
  prompt_identity?: unknown[] | null
  /** CEE diagnostic trace: zone2 assembly metadata. */
  zone2_assembly?: unknown | null
  /** CEE diagnostic trace: tool policy configuration. */
  tool_policy?: unknown | null
  /** CEE diagnostic trace: provider resolution per task. */
  provider_resolution?: unknown[] | null
  /** CEE diagnostic trace: structured output configuration. */
  structured_output_config?: unknown | null
  /** CEE diagnostic trace: streaming metrics. */
  streaming_metrics?: unknown | null
  /** CEE diagnostic trace: fallback trace entries. */
  fallback_trace?: unknown[] | null
  /** Reason when all v2.0 sections are null (CEE hasn't deployed trace support). */
  _unavailable_reason?: string

  // =========================================================================
  // Envelope-level fields — extracted from cee_response (the orchestrator envelope)
  // =========================================================================

  /** CEE pipeline outcome from envelope._pipeline_outcome. Passthrough. */
  pipeline_outcome?: unknown | null
  /** Goal constraints from envelope.goal_constraints. Count + data. */
  goal_constraints?: { count: number; items: unknown[] } | null
  /** CEE analysis readiness from envelope.analysis_ready. */
  analysis_ready?: unknown | null
  /**
   * Fifth-round review (P1 #1 + IMP #1): which path produced the
   * envelope-derived fields above (pipeline_outcome / goal_constraints /
   * analysis_ready / causal_claims_diagnostic). Aligned with
   * pipeline.v5_pipeline_status_source.capture so consumers can tell
   * direct from downstream extraction at a glance.
   */
  effective_cee_response_source?: 'direct' | 'downstream' | 'none'
}

// =============================================================================
// Types for Graph Data Export
// =============================================================================

export interface FullGraphData {
  nodes: Array<{
    id: string
    data: Record<string, unknown> & {
      label?: string
      kind?: string
      type?: string
      description?: string
      observedState?: Record<string, unknown>
      category?: string
      interventions?: unknown[]
      interventionKeys?: string[]
      // V3 fields (may be present via ...rest spread or backfill)
      display_value?: string
      intercept?: number
      encoding_map?: Record<string, unknown>
      is_baseline?: boolean
      goal_threshold?: number
      goal_threshold_raw?: number
      goal_threshold_unit?: string
      goal_threshold_cap?: number
    }
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    label?: string
    data?: Record<string, unknown> & {
      strength?: number
      strength_mean?: number
      strength_std?: number
      confidence?: number
      belief_exists?: number
      beliefExists?: number
      beliefStrength?: number
      effect_direction?: string
      direction?: string
      weight?: number
      label?: string
      kind?: string
    }
  }>
}

export interface ExportOptions {
  /** Include full graph data (factors, edges, options) */
  includeFullGraph?: boolean
  /** Graph data from canvas store */
  graphData?: FullGraphData
  /** CEE option interventions (ceeAnalysisReady.options) — real intervention data */
  ceeOptions?: Array<Record<string, unknown>> | null
  /** V1.5: Display state captured at export time */
  displayState?: DisplayState | null
}

// =============================================================================
// Helpers
// =============================================================================

function getEnvironment(): string {
  return import.meta.env.VITE_APP_ENV || 'development'
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

function formatShortTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
}

function buildRequestSummaries(data: DebugData): DebugBundle['request_summary'] {
  return [{
    request_id: data.overall.request_id ?? null,
    ui_generated_request_id: data.request_id_chain?.ui_generated ?? null,
    plot_request_id: data.request_id_chain?.from_plot?.plot ?? null,
    isl_request_id: data.request_id_chain?.from_plot?.isl ?? null,
    cee_trace_id: data.request_id_chain?.draft_trace?.cee_trace ?? null,
    request_chain_present: Boolean(data.request_id_chain?.plot_chain_present || data.request_id_chain?.from_plot),
  }]
}

function buildResponseSummaries(data: DebugData): DebugBundle['response_summary'] {
  return ([
    ['cee', data.services.cee, data.payloads.cee_response],
    ['plot', data.services.plot, data.payloads.plot_response],
    ['isl', data.services.isl, data.payloads.isl_response],
  ] as const).map(([service, serviceData, payload]) => ({
    service,
    status: serviceData?.status ?? null,
    duration_ms: serviceData?.duration_ms ?? null,
    success: serviceData?.success ?? null,
    error: serviceData?.error ?? null,
    payload_present: payload != null,
  }))
}

function buildRepairSummaries(data: DebugData): DebugBundle['repair_and_filter_summary'] {
  const repairSummary = asRecord(data.cee_observability?.repair_summary)
  const validation = data.cee_observability?.validation ?? null

  return [{
    source: 'cee_observability.repair_summary',
    available: repairSummary !== null || validation !== null,
    repairs_applied: typeof repairSummary?.repairs_applied === 'number'
      ? repairSummary.repairs_applied
      : validation?.repairs_triggered
        ? validation.repair_types.length
        : null,
    repair_types: Array.isArray(repairSummary?.repair_types)
      ? repairSummary.repair_types.filter((item): item is string => typeof item === 'string')
      : validation?.repair_types ?? null,
    retries: validation
      ? (validation.retry_triggered ? validation.attempts - 1 : 0)
      : null,
  }]
}

function generateReadme(data: DebugData): string {
  const timestamp = formatTimestamp()
  const requestId = data.overall.request_id ?? 'unknown'
  const environment = getEnvironment()

  return `# Olumi Debug Bundle

Generated: ${timestamp}
Request ID: ${requestId}
Environment: ${environment}
Version: ${isDebugBundleV2Enabled() ? '2.0' : '1.5'}

## Contents

- diagnostic.json - System and request metadata
- cee_request.json - CEE draft-graph request payload
- cee_response.json - CEE draft-graph response payload
- plot_request.json - PLoT v2/run request payload
- plot_response.json - PLoT v2/run response payload
- isl_request.json - ISL robustness request payload (if available)
- isl_response.json - ISL robustness response payload (if available)

## Data Redaction Notice

Payloads are REDACTED at capture time:
- Long strings truncated to 1000 characters (except llm_raw text-like fields, capped at ${DEBUG_LLM_RAW_MAX_CHARS} chars)
- Arrays capped to 100 items
- Sensitive keys (password, token, secret, apiKey) masked
- Object depth limited to 8 levels

Despite redaction, payloads may still contain decision content
(factor names, option labels, goal descriptions).

## V1.5 Sections

- display_state — Snapshot of what the UI was rendering at export time
- user_actions — Ring buffer of recent user interactions (max 50)
- panel_state.panels — Visibility state of all panels
- full_graph (enriched) — Full node/edge data including observed_state, category, interventions
- orchestrator — Conversation orchestrator context (turn count, blocks, coaching signals)
- schema_versions — Schema versions used for CEE/PLoT requests/responses
- feature_flags_at_request — All VITE_ENABLE_/VITE_FEATURE_ flags at export time

## Usage

1. Share this bundle with the engineering team for debugging
2. Do NOT share publicly - contains decision content even after redaction
3. Request ID can be used to correlate with server logs

## Service Status

CEE: ${data.services.cee?.success ? 'OK' : data.services.cee?.error ? 'ERROR' : 'N/A'}
PLoT: ${data.services.plot?.success ? 'OK' : data.services.plot?.error ? 'ERROR' : 'N/A'}
ISL: ${data.services.isl?.success ? 'OK' : data.services.isl?.error ? 'ERROR' : 'N/A'}
`
}

function downloadFile(content: string, filename: string, type = 'application/json'): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Transform canvas graph data into enriched export format.
 * Captures the full node/edge data from the store for data-produced-vs-displayed comparison.
 */
function transformGraphDataEnriched(graphData: FullGraphData): EnrichedFullGraph {
  const factors: EnrichedGraphNode[] = []
  const options: EnrichedGraphNode[] = []

  for (const node of graphData.nodes) {
    const nodeKind = (node.data?.kind ?? node.data?.type ?? 'factor').toLowerCase()
    const entry: EnrichedGraphNode = {
      id: node.id,
      label: node.data?.label ?? '',
      type: nodeKind,
      kind: node.data?.kind ?? undefined,
      description: node.data?.description,
      observed_state: node.data?.observedState ?? null,
      category: node.data?.category ?? null,
      interventions: node.data?.interventions ?? null,
      interventionKeys: node.data?.interventionKeys ?? null,
      // V3 factor fields
      display_value: (node.data?.display_value as string | undefined)
        ?? ((node.data?.observedState as Record<string, unknown> | undefined)?.display_value as string | undefined)
        ?? null,
      intercept: typeof node.data?.intercept === 'number' ? node.data.intercept : null,
      encoding_map: (node.data?.encoding_map as Record<string, unknown> | undefined) ?? null,
      // V3 option fields
      is_baseline: (node.data?.is_baseline as boolean | undefined) ?? null,
      // V3 goal fields
      goal_threshold: (node.data?.goal_threshold as number | undefined)
        ?? (node.data?.success_threshold as number | undefined)
        ?? null,
      goal_threshold_raw: (node.data?.goal_threshold_raw as number | undefined) ?? null,
      goal_threshold_unit: (node.data?.goal_threshold_unit as string | undefined) ?? null,
      goal_threshold_cap: (node.data?.goal_threshold_cap as number | undefined) ?? null,
    }

    if (nodeKind === 'option') {
      options.push(entry)
    } else {
      factors.push(entry)
    }
  }

  const edges: EnrichedGraphEdge[] = graphData.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.data?.label ?? edge.label,
    strength: edge.data?.strength_mean ?? edge.data?.strength ?? edge.data?.confidence,
    strength_mean: edge.data?.weight ?? edge.data?.strength_mean,
    strength_std: edge.data?.strength_std ?? edge.data?.strengthStd,
    belief_exists: edge.data?.belief_exists ?? edge.data?.beliefExists,
    effect_direction: edge.data?.effect_direction ?? edge.data?.direction,
    // DEPRECATED: use strength_mean. Remove after 2026-05-15.
    weight: edge.data?.weight,
    direction: edge.data?.direction,
    beliefStrength: edge.data?.beliefStrength,
    // V3 edge metadata
    edge_type: edge.data?.edge_type,
    provenance_source: edge.data?.provenance_source,
    exists_probability: edge.data?.exists_probability ?? edge.data?.beliefExists,
  }))

  return {
    _meta: {
      node_type_field: 'type',
      enriched: true,
    },
    factors,
    edges,
    options,
  }
}

/**
 * Minimum array size threshold for reporting truncation in export metadata.
 * Only report truncation_applied when arrays had more items than this limit.
 */
const TRUNCATION_REPORT_THRESHOLD = 100

/**
 * Recursively check if any value was truncated with totalCount exceeding the threshold.
 * Only returns true when arrays actually had more than TRUNCATION_REPORT_THRESHOLD items.
 */
function detectTruncation(value: unknown, visited = new WeakSet<object>()): boolean {
  if (value === null || value === undefined) return false
  if (typeof value !== 'object') return false

  // Prevent circular reference loops
  if (visited.has(value as object)) return false
  visited.add(value as object)

  // Check for truncation marker with meaningful truncation (totalCount > threshold)
  const record = value as Record<string, unknown>
  if (record.__truncated === true && typeof record.totalCount === 'number') {
    // Only report truncation if the array actually exceeded the threshold
    if (record.totalCount > TRUNCATION_REPORT_THRESHOLD) {
      return true
    }
    // Array was truncated but at a smaller limit - don't propagate this truncation
    return false
  }

  // Recurse into arrays
  if (Array.isArray(value)) {
    return value.some((item) => detectTruncation(item, visited))
  }

  // Recurse into object values
  return Object.values(record).some((v) => detectTruncation(v, visited))
}

// =============================================================================
// V1.5: Collect feature flags snapshot
// =============================================================================

/**
 * Snapshot all VITE_ENABLE_ and VITE_FEATURE_ env vars at export time.
 * Returns a flat boolean map.
 */
function collectFeatureFlagsSnapshot(): Record<string, boolean> {
  const flags: Record<string, boolean> = {}
  try {
    const env = import.meta.env
    for (const key of Object.keys(env)) {
      if (key.startsWith('VITE_ENABLE_') || key.startsWith('VITE_FEATURE_')) {
        const val = env[key]
        flags[key] = val === '1' || val === 'true' || val === true
      }
    }
  } catch {
    // SSR or test environment
  }
  return flags
}

// =============================================================================
// V1.5: Collect schema versions from payloads
// =============================================================================

function collectSchemaVersions(data: DebugData): SchemaVersions {
  // Fall back to downstream CEE when direct payloads are null (orchestrator flow)
  const ceeReq = asRecord(data.payloads.cee_request) ?? asRecord(data.payloads.cee_downstream_request)
  const ceeRes = asRecord(data.payloads.cee_response) ?? asRecord(data.payloads.cee_downstream_response)
  const plotReq = asRecord(data.payloads.plot_request)
  const plotRes = asRecord(data.payloads.plot_response)
  const islReq = asRecord(data.payloads.isl_request)
  const islRes = asRecord(data.payloads.isl_response)

  const ceeRequestVersion = (ceeReq?.schema_version ?? ceeReq?._schema_version ?? ceeReq?.version) as string | null ?? null
  const ceeResponseVersion = (ceeRes?.schema_version ?? (asRecord(ceeRes?.trace)?.schema_version)) as string | null ?? null
  const plotRequestVersion = (plotReq?.schema_version ?? plotReq?._schema_version ?? plotReq?.version) as string | null ?? null
  const plotResponseVersion = (plotRes?.schema_version ?? (asRecord(plotRes?.meta)?.schema_version)) as string | null ?? null
  const islRequestVersion = (islReq?.schema_version ?? islReq?._schema_version ?? islReq?.version) as string | null ?? null
  const islResponseVersion = (islRes?.schema_version ?? (asRecord(islRes?.meta)?.schema_version)) as string | null ?? null

  // Tri-state consistency (audit follow-up D6). Honest about "unknown" when
  // any of the six fields is missing — previously this path returned
  // `consistent: true` on all-null inputs (a false positive).
  const allVersions: Array<string | null> = [
    ceeRequestVersion,
    ceeResponseVersion,
    plotRequestVersion,
    plotResponseVersion,
    islRequestVersion,
    islResponseVersion,
  ]
  const anyNull = allVersions.some((v) => v == null)
  const allPresent = !anyNull
  const allEqual = allPresent && new Set(allVersions).size === 1

  let consistencyStatus: SchemaVersionConsistencyStatus
  let consistent: boolean | null
  let unknownReason: SchemaVersionUnknownReason | undefined
  if (anyNull) {
    consistencyStatus = 'unknown'
    consistent = null
    unknownReason = 'missing_schema_versions'
  } else if (allEqual) {
    consistencyStatus = 'matched'
    consistent = true
  } else {
    consistencyStatus = 'mismatched'
    consistent = false
  }

  const result: SchemaVersions = {
    cee_request: ceeRequestVersion,
    cee_response: ceeResponseVersion,
    plot_request: plotRequestVersion,
    plot_response: plotResponseVersion,
    isl_request: islRequestVersion,
    isl_response: islResponseVersion,
    consistent,
    consistency_status: consistencyStatus,
  }
  if (unknownReason) result.unknown_reason = unknownReason
  return result
}

// =============================================================================
// V1.5: Collect user actions from debug-state ring buffer
// =============================================================================

function collectUserActions(): UserActionEntry[] {
  try {
    const actions = getUserActions()
    // Map from debug-state format to bundle format, cap at 50
    // Redact raw_message/display_text (user content) → replace with message_length
    return actions.slice(-50).map((a) => ({
      action: a.actionType,
      timestamp: a.timestamp,
      detail: redactUserActionDetail(a.payloadSummary),
    }))
  } catch {
    return []
  }
}

/** Strip user-authored text from action detail, preserving structural metadata */
function redactUserActionDetail(
  detail: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!detail) return detail
  const redacted = { ...detail }
  let hasRedaction = false
  for (const key of ['raw_message', 'display_text'] as const) {
    if (key in redacted) {
      const val = redacted[key]
      const len = typeof val === 'string' ? val.length : null
      delete redacted[key]
      if (!hasRedaction) {
        redacted.message_length = len
        hasRedaction = true
      }
    }
  }
  return redacted
}

// =============================================================================
// V1.5: Build orchestrator context from available stores
// =============================================================================

async function buildOrchestratorContext(): Promise<OrchestratorContext> {
  try {
    // Dynamic import to avoid circular deps
    const { useCanvasStore } = await import('../../../canvas/store')
    const state = useCanvasStore.getState()

    const runMeta = state.runMeta
    const ceeAnalysisReady = runMeta?.ceeAnalysisReady

    // Derive turn count from user actions (conversation messages are in React
    // state, not a Zustand store, so we approximate from the debug-state ring buffer)
    const actions = getUserActions()
    const chatActions = actions.filter((a) =>
      a.actionType === 'sent chat message' ||
      a.actionType === 'clicked chip' ||
      a.actionType === 'clicked retry' ||
      a.actionType === 'clicked run analysis'
    )
    const turnCount = chatActions.length
    const conversationLength = actions.length

    return {
      turn_count: turnCount,
      current_turn_type: ceeAnalysisReady ? 'explicit_generate' : null,
      last_turn_id: null,
      active_coaching_signals: [],
      last_response_blocks: null,
      conversation_length: conversationLength,
      zone1_prompt_id: null,
      zone2_assembly_keys: null,
      ...(turnCount === 0 && {
        _unavailable_reason: 'Turn count derived from user action ring buffer (may undercount if buffer wrapped).',
      }),
    }
  } catch {
    return {
      turn_count: 0,
      current_turn_type: null,
      last_turn_id: null,
      active_coaching_signals: [],
      last_response_blocks: null,
      conversation_length: 0,
      zone1_prompt_id: null,
      zone2_assembly_keys: null,
      _unavailable_reason: 'Canvas store not accessible from bundle assembly context.',
    }
  }
}

// =============================================================================
// V1.5: Build panel state from canvas store
// =============================================================================

async function buildPanelState(): Promise<PanelStateV1_5> {
  try {
    const { useCanvasStore } = await import('../../../canvas/store')
    const state = useCanvasStore.getState()

    return {
      available: true,
      source: 'export_time_snapshot',
      panels: {
        results: { visible: state.showResultsPanel ?? false },
        inspector: { visible: state.showInspectorPanel ?? false },
        chat: { visible: state.showDraftChat ?? false },
        templates: { visible: state.showTemplatesPanel ?? false },
        issues: { visible: state.showIssuesPanel ?? false },
      },
    }
  } catch {
    return {
      available: true,
      source: 'export_time_snapshot',
      panels: {},
    }
  }
}

// =============================================================================
// V1.5: Capture display state from canvas store at export time
// =============================================================================

/**
 * Statuses where the function will derive an analytical winner headline.
 * Production canvas-store writes `ResultsStatus === 'complete'`
 * (`src/canvas/store.ts:168, 2488`) on analysis completion. The legacy
 * `'success'` and `'computed'` values are kept to tolerate older fixtures
 * and externally constructed payloads. Hoisted to module scope so the Set
 * is allocated once (Codex round-2 review).
 */
const HEADLINE_OK_STATUSES: ReadonlySet<string> = new Set([
  'complete',
  'success',
  'computed',
])

/**
 * Derive the hero headline that HeroSection.tsx would display.
 * Mirrors the M1 headline logic: "{Winner} performs best" when analysis
 * succeeded with multiple options, or status-based fallbacks.
 *
 * `optionComparison` is the already-resolved wire-level option_comparison
 * array — sourced from `state.rawV2Response.option_comparison` at the
 * captureDisplayState call site. Passed in pre-resolved so this function
 * does not re-read the (non-existent) `results.apiResponse` field; see the
 * data-source comment block in `captureDisplayState` for the full rationale.
 *
 * Honest-missing contract (mirrors the D4/D5/D8 tri-state principle): only
 * entries with a numeric `win_probability` participate in the sort. If every
 * entry is missing `win_probability` (or the array is empty), the function
 * returns `null` rather than emitting a confident "{first label} performs
 * best" for a lexicographic accident. Per `V2OptionComparison.win_probability`
 * (`src/adapters/plot/v2/types.ts:161`) the field is optional, so partial /
 * malformed wire shapes are a real production possibility.
 *
 * Report-only fallback policy (Codex round-2 follow-up): `hero_headline_displayed`
 * is a legacy field (`exportBundle.displayState.spec.ts:4` — canonical
 * `analysis_display_*` fields supersede it). It deliberately does NOT mirror
 * the D5/D8 fallback chain into `results.report.option_probabilities` — the
 * mapped report carries win-probabilities keyed by node ID but not the
 * option_label needed for the headline string; resolving labels would
 * require a separate canvas-node lookup, expanding scope on a legacy
 * surface. Report-only loads therefore return `null` for the headline. The
 * canonical `analysis_display_headline` is the field consumers should rely
 * on for the headline contract going forward.
 */
function deriveHeroHeadline(
  results: Record<string, unknown> | null | undefined,
  optionCount: number,
  optionComparison: Array<Record<string, unknown>>,
): string | null {
  if (!results) return null
  const status = results.status as string | undefined
  if (status === undefined || !HEADLINE_OK_STATUSES.has(status)) {
    return status ? `Analysis ${status}` : null
  }
  if (optionCount === 0) return 'No options to evaluate'

  // Find winner from option_comparison (same source as HeroSection). Filter
  // to entries with a numeric `win_probability` BEFORE sorting so all-missing
  // arrays can't emit a fabricated headline via lexicographic tie-break.
  const comparison = optionComparison as
    Array<{ option_label?: string; win_probability?: number }>
  const ranked = comparison.filter(
    (o) => typeof o.win_probability === 'number' && Number.isFinite(o.win_probability),
  )
  if (ranked.length === 0) return null
  const sorted = [...ranked].sort(
    (a, b) => (b.win_probability as number) - (a.win_probability as number),
  )
  const winnerLabel = sorted[0]?.option_label
  if (winnerLabel) {
    if (optionCount === 1) return `${winnerLabel} is your only option`
    return `${winnerLabel} performs best`
  }
  return null
}

/**
 * Normalise a label for fuzzy matching between canvas nodes and PLoT
 * response entries. Case-insensitive, trims whitespace, collapses internal
 * whitespace. Intentionally simple — capture-time matching only.
 */
function normaliseLabel(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

interface FactorSensitivityEntry {
  factor_id?: unknown
  factor_label?: unknown
  factor?: unknown
  influence_score?: unknown
  sensitivity_score?: unknown
}

/**
 * Extract rendered factor state from canvas nodes for display_state, enriching
 * with influence and sensitivity values from PLoT `factor_sensitivity` when
 * available. Mirrors the production factor-card data flow
 * (`DriversSection.tsx:269` / `DriversSection.tsx:805-810`): the "Influence"
 * column displays `influence_score`; sensitivity is captured separately for
 * analytical fidelity even though it is not visibly rendered.
 */
function extractRenderedFactors(
  nodes: Array<{ id: string; data: unknown }>,
  factorSensitivity: FactorSensitivityEntry[],
  factorMetricSource: {
    influence: FactorMetricSource
    sensitivity: FactorMetricSource
  },
): DisplayState['rendered_factors'] {
  const factorNodes = nodes.filter((n) => {
    const d = n.data as Record<string, unknown> | undefined
    return d?.kind === 'factor' || d?.type === 'factor'
  })
  if (factorNodes.length === 0) return null

  const matchFactor = (
    nodeId: string,
    nodeLabel: unknown,
  ): FactorSensitivityEntry | undefined => {
    const norm = normaliseLabel(nodeLabel)
    return factorSensitivity.find((fs) => {
      if (typeof fs.factor_id === 'string' && fs.factor_id === nodeId) return true
      const fsLabel = normaliseLabel(fs.factor_label ?? fs.factor)
      return Boolean(norm) && norm === fsLabel
    })
  }

  return factorNodes.map((n) => {
    const d = n.data as Record<string, unknown>
    const obs = d?.observedState as Record<string, unknown> | undefined
    const value = obs?.value
    const unit = obs?.unit as string | undefined
    const valueStr = typeof value === 'number'
      ? (unit ? `${value} ${unit}` : String(value))
      : null
    const match = matchFactor(n.id, d?.label)
    const influenceVal = typeof match?.influence_score === 'number' ? match.influence_score : null
    const sensitivityVal = typeof match?.sensitivity_score === 'number' ? match.sensitivity_score : null
    const factorId = typeof match?.factor_id === 'string' ? match.factor_id : n.id ?? null
    return {
      id: n.id,
      factor_id: factorId,
      label_displayed: (d?.label as string) ?? null,
      value_displayed: valueStr,
      influence_displayed: influenceVal,
      influence_source: influenceVal !== null ? factorMetricSource.influence : 'unmatched',
      sensitivity_displayed: sensitivityVal,
      sensitivity_source: sensitivityVal !== null ? factorMetricSource.sensitivity : 'unmatched',
    }
  })
}

/**
 * Capture what the UI is currently rendering: node/edge counts, node type
 * breakdown, and panel visibility. Called at export time from the async path.
 */
export async function captureDisplayState(): Promise<DisplayState> {
  try {
    const { useCanvasStore } = await import('../../../canvas/store')
    const { deriveAnalysisDisplayState } = await import(
      '../../../canvas/utils/deriveAnalysisDisplayState'
    )
    const state = useCanvasStore.getState()

    const nodes = state.nodes ?? []
    const edges = state.edges ?? []

    // Count node types
    const nodeTypes: Record<string, number> = {}
    for (const node of nodes) {
      const kind = ((node.data as Record<string, unknown>)?.kind as string)
        ?? ((node.data as Record<string, unknown>)?.type as string)
        ?? 'unknown'
      nodeTypes[kind] = (nodeTypes[kind] ?? 0) + 1
    }

    // ─── Analytical data sources at capture time ───────────────────────────
    //
    // The raw V2 PLoT response is held at `state.rawV2Response` (canvas-store
    // root, populated by `resultsComplete` in `src/canvas/store.ts`). This is
    // the same wire shape that the bundle captures under
    // `payloads.plot_response`, so it carries:
    //   - option_comparison[*].win_probability
    //   - options[*].win_probability (legacy V2 alias)
    //   - factor_sensitivity[*].{influence_score, sensitivity_score}
    //
    // The mapper-synthesised `option_probabilities` keyed by canvas node ID
    // lives on `state.results.report.option_probabilities` — the same shape
    // `useResultsSectionData.ts:1042` reads when building
    // `recommendation.allOptions[*].winProbability` for the UI. This is the
    // fallback when `rawV2Response` is null (e.g. historical Supabase loads
    // — see `src/canvas/store.ts:2715, 2757`).
    //
    // The previous read path (`state.results.apiResponse`) referenced a
    // non-existent canvas-store field — `ResultsState` (canvas/store.ts:170)
    // declares only `report` and `enrichment`. Real production state always
    // produced empty lookup maps, so every option fell through to
    // `unmatched` and rank_source collapsed to `canvas_order` even when
    // analytical data was available end-to-end.
    const results = state.results as Record<string, unknown> | null | undefined
    const rawV2Response = (state as Record<string, unknown>).rawV2Response as
      Record<string, unknown> | null | undefined
    const report = (results?.report as Record<string, unknown> | null | undefined) ?? null

    const optionComparison = (rawV2Response?.option_comparison as
      Array<Record<string, unknown>> | undefined) ?? []
    const plotOptions = (rawV2Response?.options as
      Array<Record<string, unknown>> | undefined) ?? []
    // Tertiary fallback for win_probability only — keyed by canvas node ID
    // on the mapped report. V2RunResponse does NOT declare option_probabilities
    // at root (`src/adapters/plot/v2/types.ts:378-446`), so this is genuinely
    // a different bundle path than the wire arrays above and carries a
    // distinct provenance label.
    const optionProbabilities = (report?.option_probabilities as
      Record<string, Record<string, unknown> | undefined> | undefined) ?? {}
    // factor_sensitivity with `influence_score`/`sensitivity_score` lives
    // only on the raw wire shape. The V5 mapper narrows `report.factor_sensitivity`
    // to `{factor_id, factor_label, sensitivity, direction}` (no influence_score),
    // so a report-only fallback here would silently miss the metrics the
    // factor card actually displays. When `rawV2Response` is null, factor
    // metrics stay `unmatched` — honest tri-state.
    const factorSensitivity = (rawV2Response?.factor_sensitivity as
      FactorSensitivityEntry[] | undefined) ?? []

    const optionNodes = nodes.filter((n) => {
      const d = n.data as Record<string, unknown> | undefined
      return d?.kind === 'option' || d?.type === 'option'
    })

    interface ResolvedOption {
      node: { id: string; data: unknown }
      optionId: string | null
      label: string | null
      winProbability: number | null
      source: WinProbabilitySource
    }

    const resolveOption = (node: { id: string; data: unknown }): ResolvedOption => {
      const d = node.data as Record<string, unknown> | undefined
      const nodeLabel = (d?.label as string) ?? null
      const norm = normaliseLabel(nodeLabel)
      // 1) PLoT response option_comparison (primary)
      let match = optionComparison.find((o) => {
        if (typeof o?.option_id === 'string' && o.option_id === node.id) return true
        return Boolean(norm) && normaliseLabel(o?.option_label ?? o?.option) === norm
      })
      if (match && typeof match.win_probability === 'number') {
        return {
          node,
          optionId: typeof match.option_id === 'string' ? match.option_id : node.id,
          label: nodeLabel ?? (typeof match.option_label === 'string' ? match.option_label : null) ?? (typeof match.option === 'string' ? match.option : null),
          winProbability: match.win_probability,
          source: 'payloads.plot_response.option_comparison.win_probability',
        }
      }
      // 2) PLoT response options (fallback)
      match = plotOptions.find((o) => {
        if (typeof o?.option_id === 'string' && o.option_id === node.id) return true
        return Boolean(norm) && normaliseLabel(o?.option_label ?? o?.option) === norm
      })
      if (match && typeof match.win_probability === 'number') {
        return {
          node,
          optionId: typeof match.option_id === 'string' ? match.option_id : node.id,
          label: nodeLabel ?? (typeof match.option_label === 'string' ? match.option_label : null),
          winProbability: match.win_probability,
          source: 'payloads.plot_response.options.win_probability',
        }
      }
      // 3) `report.option_probabilities[node_id]` (tertiary fallback).
      // Mapper-synthesised keyed map — what `useResultsSectionData.ts:1042`
      // reads to build `recommendation.allOptions[*].winProbability` for the
      // UI. Distinct from the wire arrays above (V2RunResponse has no
      // option_probabilities at root) so this carries a distinct provenance
      // label — a consumer reading the exported bundle finds this datum at
      // `results.report.option_probabilities`, not at `payloads.plot_response`.
      const probEntry = optionProbabilities[node.id]
      if (probEntry && typeof probEntry.win_probability === 'number') {
        return {
          node,
          optionId: node.id ?? null,
          label: nodeLabel,
          winProbability: probEntry.win_probability,
          source: 'results.report.option_probabilities.win_probability',
        }
      }
      return { node, optionId: node.id ?? null, label: nodeLabel, winProbability: null, source: 'unmatched' }
    }

    const resolvedOptions = optionNodes.map(resolveOption)
    const allHaveWinProb = resolvedOptions.length > 0
      && resolvedOptions.every((r) => typeof r.winProbability === 'number')

    let rankByNodeId: Map<string, number>
    let rankSource: RankSource
    if (allHaveWinProb) {
      // Analytical rank, mirroring OptionCards.tsx:506-513 production sort.
      // Deterministic tie-break: equal win_probability → secondary sort by option_id asc.
      const sorted = [...resolvedOptions].sort((a, b) => {
        const delta = (b.winProbability ?? -Infinity) - (a.winProbability ?? -Infinity)
        if (delta !== 0) return delta
        const idA = a.optionId ?? a.node.id ?? ''
        const idB = b.optionId ?? b.node.id ?? ''
        return idA < idB ? -1 : idA > idB ? 1 : 0
      })
      rankByNodeId = new Map(sorted.map((r, i) => [r.node.id, i + 1]))
      rankSource = 'win_probability_desc'
    } else if (resolvedOptions.length > 0) {
      // Fallback: canvas iteration order. Loss-of-data is observable via rank_source.
      rankByNodeId = new Map(resolvedOptions.map((r, i) => [r.node.id, i + 1]))
      rankSource = 'canvas_order'
    } else {
      rankByNodeId = new Map()
      rankSource = 'unranked'
    }

    const renderedOptions = resolvedOptions.length > 0
      ? resolvedOptions.map((r) => ({
          id: r.node.id,
          option_id: r.optionId,
          label_displayed: r.label,
          win_probability_displayed: r.winProbability,
          win_probability_source: r.source,
          rank_displayed: rankByNodeId.get(r.node.id) ?? null,
          rank_source: rankSource,
        }))
      : null

    // Determine active panel
    const activePanel = state.showResultsPanel
      ? 'results'
      : state.showInspectorPanel
        ? 'inspector'
        : state.showDraftChat
          ? 'chat'
          : null

    // Analysis status from results store (hero headline is computed in UI components, not stored)
    const analysisStatus = results?.status as string | null ?? null

    // Canonical display state — matches what the user sees in the
    // pre-analysis banner / InputsDock empty-state. Reads the same
    // canvas-store primitives the UI hook reads (no defaults, no
    // mirrors): a stale `results.status === 'complete'` lingering in
    // the store while `report` is null produces 'ready_to_analyse',
    // not 'complete' — this is the bug pattern the helper enforces.
    const ceeStatus = (state as { ceeAnalysisReady?: { status?: string } | null })
      .ceeAnalysisReady?.status
    const hasReport = Boolean((results as { report?: unknown } | null | undefined)?.report)
    const graphEditedSinceLastRun = Boolean(
      (state as { graphEditedSinceLastRun?: boolean }).graphEditedSinceLastRun,
    )
    const displayView = deriveAnalysisDisplayState({
      ceeAnalysisReadyStatus: ceeStatus,
      hasReport,
      graphEditedSinceLastRun,
    })

    return {
      active_panel: activePanel,
      active_tab: null, // Tab state is local to components, not in store
      active_section: null,
      canvas_node_count: nodes.length,
      canvas_edge_count: edges.length,
      canvas_node_types: nodeTypes,
      rendered_options: renderedOptions,
      rendered_factors: extractRenderedFactors(nodes, factorSensitivity, {
        influence: 'payloads.plot_response.factor_sensitivity.influence_score',
        sensitivity: 'payloads.plot_response.factor_sensitivity.sensitivity_score',
      }),
      analysis_status_displayed: analysisStatus,
      hero_headline_displayed: deriveHeroHeadline(results, optionNodes.length, optionComparison),
      analysis_display_state: displayView.state,
      analysis_display_headline: displayView.headline,
    }
  } catch {
    return {
      active_panel: null,
      active_tab: null,
      active_section: null,
      canvas_node_count: 0,
      canvas_edge_count: 0,
      canvas_node_types: {},
      rendered_options: null,
      rendered_factors: null,
      analysis_status_displayed: null,
      hero_headline_displayed: null,
      analysis_display_state: null,
      analysis_display_headline: null,
    }
  }
}

// =============================================================================
// V1.5: Fix gate capture — read final state at export time
// =============================================================================

function buildGatesPostPipeline(data: DebugData): DebugBundle['gates'] {
  const gates = data.gates.map((g) => ({
    name: g.name,
    status: g.status,
    message: g.message,
  }))

  // Task 6: If pipeline succeeded but graph_readiness is 'fail', override to 'pass'
  // This corrects the timing issue where gates were captured pre-run
  const pipelineSucceeded = data.overall.status === 'success'
  if (pipelineSucceeded) {
    for (const gate of gates) {
      if (gate.name === 'graph_readiness' && gate.status === 'fail') {
        gate.status = 'pass'
        gate.message = (gate.message ?? '') + ' [corrected: pipeline succeeded]'
      }
    }
  }

  return gates
}

// =============================================================================
// V2.0 Helpers — Wire existing null sections from _diagnostic_trace
// =============================================================================

/**
 * Wire cee_trace fields from _diagnostic_trace.provider_resolution when
 * existing values are null. Does not fabricate — only fills from actual trace data.
 */
function wireCeeTrace(
  existing: CeeTraceData | null,
  diagnosticTrace: Record<string, unknown> | null,
): CeeTraceData | null {
  if (!existing && !diagnosticTrace) return null

  const base: CeeTraceData = existing ?? {
    degraded: false,
  }

  // Wire resolved_model and resolved_provider from provider_resolution
  // Find the orchestrator task entry (first entry, or task='orchestrator')
  if (diagnosticTrace?.provider_resolution && Array.isArray(diagnosticTrace.provider_resolution)) {
    const orchestratorEntry = diagnosticTrace.provider_resolution.find(
      (entry: unknown) => {
        const e = entry as Record<string, unknown> | undefined
        return e?.task === 'orchestrator'
      }
    ) ?? diagnosticTrace.provider_resolution[0]

    if (orchestratorEntry && typeof orchestratorEntry === 'object') {
      const entry = orchestratorEntry as Record<string, unknown>
      if (base.resolved_model == null && typeof entry.resolved_model === 'string') {
        base.resolved_model = entry.resolved_model
      }
      if (base.resolved_provider == null && typeof entry.resolved_provider === 'string') {
        base.resolved_provider = entry.resolved_provider
      }
    }
  }

  return base
}

/**
 * Extract cee_pipeline_path from _diagnostic_trace.provider_resolution[0].pipeline_path.
 * Returns null when trace data is absent or field not found.
 */
function extractPipelinePathFromTrace(
  diagnosticTrace: Record<string, unknown> | null,
): 'unified' | 'legacy' | null {
  if (!diagnosticTrace?.provider_resolution || !Array.isArray(diagnosticTrace.provider_resolution)) return null
  const first = diagnosticTrace.provider_resolution[0]
  if (!first || typeof first !== 'object') return null
  return getPipelinePath((first as Record<string, unknown>).pipeline_path)
}

/**
 * Wire pipeline.llm_metadata from _diagnostic_trace.llm_calls[0] when
 * existing pipeline.llm_metadata is null.
 */
function wirePipelineLlmMetadata(
  existing: unknown,
  diagnosticTrace: Record<string, unknown> | null,
): unknown {
  if (existing != null) return existing
  if (!diagnosticTrace?.llm_calls || !Array.isArray(diagnosticTrace.llm_calls)) return null

  const firstCall = diagnosticTrace.llm_calls[0]
  if (!firstCall || typeof firstCall !== 'object') return null

  // Passthrough the first LLM call record as llm_metadata
  return firstCall
}

// =============================================================================
// Export Functions
// =============================================================================

/**
 * Build a complete debug bundle from DebugData.
 * Produces v1.5 or v2.0 bundles depending on VITE_DEBUG_BUNDLE_V2 flag.
 */
export function buildDebugBundle(data: DebugData, options: ExportOptions = {}): DebugBundle {
  const timestamp = formatTimestamp()
  const versionInfo = getVersionInfo()
  const clientBuild = getClientBuild()
  const v2Enabled = isDebugBundleV2Enabled()
  const diagnosticTrace = v2Enabled ? (data.diagnostic_trace ?? null) : null
  const requestSummary = buildRequestSummaries(data)
  const responseSummary = buildResponseSummaries(data)
  const repairAndFilterSummary = buildRepairSummaries(data)

  // Transform graph data if requested (always enriched)
  let fullGraph: DebugBundle['full_graph'] | undefined
  if (options.includeFullGraph && options.graphData) {
    fullGraph = transformGraphDataEnriched(options.graphData)
  }

  // Capture ceeAnalysisReady.options — real intervention data that node.data.interventions misses
  const ceeOptions: DebugBundle['cee_options'] = options.ceeOptions ?? null

  // Detect if any payloads or full_graph were truncated during capture
  const payloadsTruncated = detectTruncation(data.payloads)
  const graphTruncated = fullGraph ? detectTruncation(fullGraph) : false
  const truncationApplied = payloadsTruncated || graphTruncated
  // Fifth-round review (P1 #1 + IMP #1): normalise an effective CEE
  // response once so envelope fields, pipeline-outcome, goal_constraints,
  // analysis_ready, and causal-claims diagnostic all read from the same
  // source. Pre-fix, payloads.cee_response in the OUTPUT bundle fell back
  // to downstream (line 1745-ish below) AND v5_pipeline_status read
  // downstream — but envelope/pipeline-outcome/goal-constraints/analysis_ready
  // continued to read direct only. Support bundles could show
  // payloads.cee_response.analysis_ready (downstream) while top-level
  // analysis_ready was null because envelopeRecord = direct only.
  // Normalising here closes the inconsistency for every envelope-derived
  // field with one definition. `effective_cee_response_source` is added
  // below so consumers can tell direct from downstream extraction.
  const effective = extractEffectiveCeePayloads(data)
  const effectiveCeeResponse = effective.response
  const pipelineQuickFields = extractCeePipelineQuickFields(data)
  const causalClaimsDiagnostic = extractCausalClaimsDiagnostic(effectiveCeeResponse)
  const islRawFields = extractIslRawFields(data.payloads.isl_response)
  const plotEnrichment = extractPlotEnrichment(data.payloads.plot_response)

  // Extract envelope-level fields from the EFFECTIVE response (direct
  // first, downstream fallback). Pre-fix these only saw direct response.
  const envelopeRecord = effectiveCeeResponse
  const envelopePipelineOutcome = envelopeRecord?._pipeline_outcome ?? null

  // goal_constraints: check envelope root first, then graph_patch block data
  const envelopeGcArray = Array.isArray(envelopeRecord?.goal_constraints)
    ? envelopeRecord!.goal_constraints as unknown[]
    : null
  const blockGcArray = !envelopeGcArray
    ? extractGoalConstraintsFromBlocks(envelopeRecord)
    : null
  const gcItems = envelopeGcArray ?? blockGcArray
  const envelopeGoalConstraints = gcItems
    ? { count: gcItems.length, items: gcItems }
    : null

  // analysis_ready: on envelope root, graph_patch block data, or
  // applied_graph block data. Use the shared helper consumed by the
  // pipeline-status derivation so extraction cannot diverge.
  const envelopeAnalysisReady = readAnalysisReadyFromEnvelope(envelopeRecord)

  // User actions from debug-state ring buffer
  const userActions = collectUserActions()

  // Feature flags snapshot
  const featureFlagsAtRequest = collectFeatureFlagsSnapshot()

  // Schema versions from payloads (fallback to data if already extracted)
  const schemaVersions = data.schema_versions ?? collectSchemaVersions(data)

  // Gate state with post-pipeline correction
  const gates = buildGatesPostPipeline(data)

  return {
    meta: {
      version: v2Enabled ? '2.0' : '1.5',
      created_at: timestamp,
      request_id: data.overall.request_id,
      client_build: clientBuild,
      environment: getEnvironment(),
      redaction: {
        enabled: true,
        max_string_length: 1000,
        max_array_items: 100,
        max_depth: 8,
        never_truncate_keys: ['text', 'output_preview', 'output', 'content'],
        never_truncate_max_length: DEBUG_LLM_RAW_MAX_CHARS,
      },
      ...(truncationApplied && {
        truncation_applied: true,
        truncation_message: 'Large graph — arrays capped at 100 items',
      }),
    },
    export_summary_schema: {
      derivation: 'export_time_from_debugdata_only',
      runtime_capture_included: true,
      note: 'V1.5: Includes runtime capture (user_actions, display_state). Enriched full_graph captures all store fields.',
    },
    diagnostic: {
      timestamp,
      request_id: data.overall.request_id,
      environment: getEnvironment(),
      client_version: versionInfo?.short ?? 'unknown',
      user_agent: navigator.userAgent,
    },
    builds: data.builds,
    payloads: {
      // Fall back to downstream CEE calls (extracted from PLoT response) when
      // CEE wasn't called directly (orchestrator flow nests CEE inside PLoT)
      cee_request: data.payloads.cee_request ?? data.payloads.cee_downstream_request ?? null,
      cee_response: data.payloads.cee_response ?? data.payloads.cee_downstream_response ?? null,
      plot_request: data.payloads.plot_request ?? null,
      plot_response: data.payloads.plot_response ?? null,
      isl_request: data.payloads.isl_request ?? null,
      isl_response: data.payloads.isl_response ?? null,
    },
    services: {
      cee: data.services.cee
        ? {
            status: data.services.cee.status,
            duration_ms: data.services.cee.duration_ms,
            success: data.services.cee.success,
          }
        : null,
      plot: data.services.plot
        ? {
            status: data.services.plot.status,
            duration_ms: data.services.plot.duration_ms,
            success: data.services.plot.success,
          }
        : null,
      isl: data.services.isl
        ? {
            status: data.services.isl.status,
            duration_ms: data.services.isl.duration_ms,
            success: data.services.isl.success,
          }
        : null,
    },
    pipeline: (() => {
      // P0 V5 golden-path repair (Wave 5 wiring) + follow-up: feed the
      // EXTRACTED envelope analysis_ready into the derivation. The
      // structured `v5_pipeline_status_source` replaces the original
      // single string per the "every missing field has a clear reason"
      // brief requirement.
      const v5 = deriveBundlePipelineStatusV2({ data, envelopeAnalysisReady })
      return {
        status: data.pipeline.status,
        v5_pipeline_status: v5.status,
        v5_pipeline_status_source: v5.source,
        total_duration_ms: data.pipeline.total_duration_ms ?? null,
        llm_metadata: wirePipelineLlmMetadata(data.pipeline.llm_metadata, diagnosticTrace),
        llm_raw: data.pipeline.llm_raw ?? null,
        cee_pipeline_path:
          pipelineQuickFields.cee_pipeline_path
          ?? extractPipelinePathFromTrace(diagnosticTrace),
        cee_strp_mutations_count: pipelineQuickFields.cee_strp_mutations_count,
        causal_claims_diagnostic: causalClaimsDiagnostic,
        node_extraction: data.pipeline.node_extraction ?? null,
        connectivity: data.pipeline.connectivity ?? null,
      }
    })(),
    isl_diagnostic: {
      data_source: data.diagnostics.isl_data_source,
      downstream_calls_path_found: data.diagnostics.downstream_calls_path_found,
      downstream_calls_paths_checked: data.diagnostics.downstream_calls_paths_checked,
      plot_response_keys: data.payloads.plot_response
        ? Object.keys(data.payloads.plot_response as Record<string, unknown>)
        : [],
      downstream_calls_content: (data.payloads.plot_response as Record<string, unknown>)?.downstream_calls ?? null,
      plot_build: data.builds.plot,
      expected_plot_build_with_feature: '463baf6+',
      endpoint: data.services.isl?.endpoint ?? null,
      status_code: data.services.isl?.status ?? null,
      duration_ms: data.services.isl?.duration_ms ?? null,
      success: data.services.isl?.success ?? null,
      error: data.services.isl?.error ?? null,
      isl_raw_fields: islRawFields,
    },
    plot_enrichment: plotEnrichment,
    gates,
    validation: {
      summary: {
        ...data.validation.summary,
        ...(data.cee_observability?.validation && {
          cee_repairs: data.cee_observability.validation.repairs_triggered
            ? data.cee_observability.validation.repair_types.length
            : 0,
          cee_retries: data.cee_observability.validation.retry_triggered
            ? data.cee_observability.validation.attempts - 1
            : 0,
        }),
      },
      issues: data.validation.issues,
    },
    console_logs: getBufferedLogs(),
    diagnostic_checks: data.diagnostics,
    readme: generateReadme(data),
    ...(fullGraph && { full_graph: fullGraph }),
    ...(ceeOptions && { cee_options: ceeOptions }),
    session: {
      timestamp,
      request_id: data.overall.request_id,
      build_info: {
        client_build: clientBuild,
        client_version: versionInfo?.short ?? 'unknown',
        environment: getEnvironment(),
      },
      feature_flags: (featureFlagsAtRequest as Record<string, unknown> | null) ?? null,
      scenario_id: null,
      current_route: null,
      session_id: null,
      session_started_at: null,
      session_duration_ms: null,
    },
    user_actions: userActions,
    request_summary: requestSummary,
    response_summary: responseSummary,
    repair_and_filter_summary: repairAndFilterSummary,
    render_summary: {
      available: false,
      source: null,
    },
    panel_state: {
      available: false,
      source: null,
    },
    cross_surface_events: [],

    // Enhancement sections (Debug Panel V2.1)
    orchestrator: data.orchestrator,
    v12_4_checks: data.v12_4_checks,
    request_id_chain: data.request_id_chain,
    feature_flags_at_request: featureFlagsAtRequest,
    timing: data.timing,
    schema_versions: schemaVersions,

    // CEE routing + trace metadata (resolved model/provider from _route_metadata)
    // Task 3: Wire resolved_model/resolved_provider from _diagnostic_trace when available
    cee_trace: wireCeeTrace(data.ceeTrace, diagnosticTrace),

    // CEE Observability (sanitized - raw I/O always stripped for security)
    cee_observability: data.cee_observability
      ? {
          llm_calls: data.cee_observability.llm_calls.map(
            ({ raw_prompt, raw_response, ...call }) => call
          ),
          validation: data.cee_observability.validation,
          orchestrator: data.cee_observability.orchestrator,
          totals: data.cee_observability.totals,
          graph_metrics: data.cee_observability.graph_metrics,
          graph_diffs: data.cee_observability.graph_diffs,
          request_id: data.cee_observability.request_id,
          raw_io_included: false, // Always false in exports for security
          repair_summary: data.cee_observability.repair_summary,
        }
      : null,

    // Display state (provided by caller at export time)
    display_state: options.displayState ?? null,

    // V2.0 sections — CEE diagnostic trace (passthrough, only when flag is ON)
    ...(v2Enabled ? {
      llm_calls: diagnosticTrace?.llm_calls ?? null,
      prompt_identity: diagnosticTrace?.prompt_identity ?? null,
      zone2_assembly: diagnosticTrace?.zone2_assembly ?? null,
      tool_policy: diagnosticTrace?.tool_policy ?? null,
      provider_resolution: diagnosticTrace?.provider_resolution ?? null,
      structured_output_config: diagnosticTrace?.structured_output_config ?? null,
      streaming_metrics: diagnosticTrace?.streaming_metrics ?? null,
      fallback_trace: diagnosticTrace?.fallback_trace ?? null,
      ...(!diagnosticTrace ? {
        _unavailable_reason: 'CEE diagnostic trace not present in response',
      } : {}),
    } : {}),

    // Envelope-level fields — extracted from the EFFECTIVE CEE
    // response (direct first, downstream fallback). The
    // effective_cee_response_source field tells consumers which path
    // produced these values so support cannot mistake "absent" for
    // "I read the wrong slot".
    pipeline_outcome: envelopePipelineOutcome,
    goal_constraints: envelopeGoalConstraints,
    analysis_ready: envelopeAnalysisReady,
    effective_cee_response_source: effective.source,
  }
}

/**
 * Build a complete debug bundle with async V1.5 sections.
 * Populates panel_state and orchestrator from stores (requires async import).
 * Use this from the export handler in DebugPanelV2.
 */
export async function buildDebugBundleAsync(data: DebugData, options: ExportOptions = {}): Promise<DebugBundle> {
  // Capture display state from store before building bundle
  if (!options.displayState) {
    try {
      options = { ...options, displayState: await captureDisplayState() }
    } catch {
      // Proceed without display state
    }
  }

  const bundle = buildDebugBundle(data, options)

  // Populate async sections: panel_state, orchestrator context
  try {
    const panelState = await buildPanelState()
    bundle.panel_state = panelState
  } catch {
    // Keep default
  }

  try {
    const orchContext = await buildOrchestratorContext()
    // Only override if the original orchestrator was null
    if (!bundle.orchestrator) {
      bundle.orchestrator = orchContext
    }
  } catch {
    // Keep default
  }

  // Fallback: if goal_constraints is still null (e.g. direct draft/SSE flow where
  // CEE response isn't captured by the payload trace store), read from canvas store.
  if (!bundle.goal_constraints) {
    try {
      const { useCanvasStore } = await import('../../../canvas/store')
      const storeConstraints = useCanvasStore.getState().goalConstraints
      if (Array.isArray(storeConstraints) && storeConstraints.length > 0) {
        bundle.goal_constraints = { count: storeConstraints.length, items: storeConstraints }
      }
    } catch {
      // Canvas store not accessible — keep null
    }
  }

  return bundle
}

/**
 * Export all debug data as a single JSON bundle file (async).
 * Captures display_state, panel_state, and orchestrator context from stores.
 *
 * Filename format: olumi-debug-{short_request_id}-{date}.json
 */
export async function exportDebugBundleAsync(data: DebugData, options: ExportOptions = {}): Promise<void> {
  const bundle = await buildDebugBundleAsync(data, options)
  const json = JSON.stringify(bundle, null, 2)

  const shortId = data.overall.request_id?.slice(0, 8) ?? 'unknown'
  const date = formatShortTimestamp().slice(0, 8) // YYYYMMDD
  const filename = `olumi-debug-${shortId}-${date}.json`

  downloadFile(json, filename)
}

/**
 * Export all debug data as a single JSON bundle file (sync).
 * Does not capture display_state or panel_state from stores — use
 * exportDebugBundleAsync for full capture.
 *
 * Filename format: olumi-debug-{short_request_id}-{date}.json
 */
export function exportDebugBundle(data: DebugData, options: ExportOptions = {}): void {
  const bundle = buildDebugBundle(data, options)
  const json = JSON.stringify(bundle, null, 2)

  const shortId = data.overall.request_id?.slice(0, 8) ?? 'unknown'
  const date = formatShortTimestamp().slice(0, 8) // YYYYMMDD
  const filename = `olumi-debug-${shortId}-${date}.json`

  downloadFile(json, filename)
}

/**
 * Export individual payload file
 */
export function exportPayloadFile(
  payload: unknown,
  payloadType: string,
  requestId: string | null
): void {
  const json = JSON.stringify(payload, null, 2)
  const shortId = requestId?.slice(0, 8) ?? 'unknown'
  const timestamp = formatShortTimestamp()
  const filename = `${payloadType}-${shortId}-${timestamp}.json`

  downloadFile(json, filename)
}

/**
 * Copy request ID to clipboard
 */
export async function copyRequestId(requestId: string | null): Promise<boolean> {
  if (!requestId) return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(requestId)
      return true
    }

    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = requestId
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}

export default exportDebugBundle
