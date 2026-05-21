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
import type { PayloadInspectionReason } from '../../../lib/payload-trace-store'
// Round-5 review (P1): use the shared V5 endpoint helper for the
// service-metadata classification too, so the bundle can't
// reintroduce substring false positives (e.g. `/turning` or
// query-string `?next=/orchestrate/v2/turn`).
// PR #156 round-2 (reviewer IMP #3): same pathname-only matchers
// for the PLoT V1/V2 endpoints so the bundle's evidence-source
// classifier can't be fooled by `/v1/running` etc.
import {
  isV5TurnEndpoint,
  isV1PlotEngineEndpoint,
  isV1PlotStreamEndpoint,
  isV2PlotEndpoint,
} from '../../../lib/v5TraceMatching'
// Round-6 review (maintainability): import shared selection-diagnostic
// union types so the DebugBundle interface mirrors DebugData without
// re-declaring the same enum in two places.
import type {
  SelectionReason,
  HashMatchStatus,
} from '../../../lib/analysisProducingCeeTurn'
import {
  derivePipelineStatus,
  type PipelineStatus,
  type RecoverableEnvelope,
} from '../../../lib/derivePipelineStatus'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'
import {
  classifyV5CanonicalAnalysisDiagnostic,
  type V5CanonicalAnalysisDiagnostic,
  type V5CeeCapture,
} from '../../../lib/v5CanonicalAnalysisDiagnostics'
import {
  extractScenarioIdFromFullGraph,
  extractScenarioIdFromLatestV5Payload,
  extractScenarioIdFromUrl,
  reconcileScenarioId,
  type ScenarioIdReconciliation,
  type ScenarioIdSource,
} from '../../../lib/scenarioIdReconciliation'
import {
  classifyV5CapturePipelineStatus,
  detectFailedHttpRecord,
  enforceCanonicalPinRule,
  findCanonicalV5TraceForBundle,
  findLatestV5TurnEntry,
  hasResponseBody,
  type CapturePipelineStatus,
} from '../../../lib/v5CapturePipelineStatus'
import {
  assembleV5CanonicalTurnDiagnostics,
  attachAnalysisFactDetails,
  determineCaptureTier,
  extractFactorSensitivityCountFromPlotResponse,
  extractOptionCountFromPlotResponse,
  type LatestV5TurnSource,
  type V5CanonicalTurnDiagnostics,
} from '../../../lib/v5CanonicalTurnDiagnostics'
import {
  diagnoseV5CanonicalAnalysis,
  isV5CanonicalAnalysisEnabled,
} from '../../../flags'
import {
  buildDebugBundleEventFields,
  emitDebugBundleEvent,
} from '../../../lib/debugBundleLogger'
import {
  buildDebugRedactionManifest,
  type DebugRedactionManifest,
} from '../../../lib/debugRedactionManifest'
import {
  runScientificValidation,
  type ScientificValidation,
} from '../../../lib/scientificValidation'
import {
  ADDITIVE_EXTENSIONS_KEY,
  ORIGINAL_TOP_LEVEL_KEYS_KEY,
  PHASE3_SIDECAR_BLOCKS_KEY,
  PHASE3_TOLERATED_BLOCK_TYPES,
  V5_PARSE_ERROR_KIND,
  type ParseFailureKind,
} from '../../../v5/responseParser'
import { factorDisplayText } from '../../../utils/formatFactorDisplayValue'

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
  /**
   * V5 canonical-analysis diagnostic (v5-canonical-analysis brief PR 1).
   * Surfaces analysis_state_source / analysis_fact_status /
   * debug_capture_status alongside the captured V5 CEE turn so
   * consumers can distinguish "no CEE call made" from
   * "CEE call made and failed". Reuses derivePipelineStatus for the
   * underlying decision tree.
   */
  v5_canonical_analysis?: V5CanonicalAnalysisDiagnostic

  /**
   * Scenario-ID reconciliation snapshot. Populated by
   * buildDebugBundleAsync. Mirrors `session.scenario_id` /
   * `session.scenario_id_source` but additionally records the full
   * candidate map and any disagreement between sources. Absent on the
   * sync export path.
   */
  scenario_id_reconciliation?: ScenarioIdReconciliation

  /**
   * Honest capture-pipeline status. Sits ALONGSIDE the legacy
   * `pipeline.v5_pipeline_status` (untouched) and replaces the
   * overused `proxy_or_network_failure` label with a coherent reading
   * that distinguishes missing capture / hydrated-only results /
   * actual network failure. Populated by buildDebugBundleAsync.
   */
  capture_pipeline_status?: CapturePipelineStatus

  /**
   * Richer V5 canonical turn diagnostics. Composes (does not replace)
   * the legacy `v5_canonical_analysis` block. Surfaces analysis-fact
   * detail, parse outcome, results metrics, scenario-ID reconciliation,
   * and coherence issues — all in one place so reviewers can answer
   * the brief's eleven goal questions from a single section.
   * Populated by buildDebugBundleAsync.
   */
  v5_canonical_turn_diagnostics?: V5CanonicalTurnDiagnostics

  /**
   * Redaction manifest — surfaces every path under `payloads.*` that
   * was redacted (sensitive_key / max_depth / array_capped / size_limit
   * / circular_reference) and lists the declarative
   * `preserved_analytical_paths` policy. Always emitted by
   * buildDebugBundleAsync.
   */
  debug_redaction_manifest?: DebugRedactionManifest

  /**
   * Scientific validation section — seven validators covering PR
   * #166–#170 surfaces (evidence-gap intervention exclusion, confidence
   * provenance, user-std propagation, EVPI honesty, flip_thresholds_status,
   * auto_noise agreement, response shape).
   *
   * Every validator emits `status` + `claim_strength`
   * (observed/derived/inferred/unavailable). `inferred` never pairs
   * with `pass`. Overall_status is `insufficient_raw_evidence` when
   * fewer than three validators reach derived/observed evidence —
   * intentional honesty, NOT a bug.
   */
  scientific_validation?: ScientificValidation

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
    /**
     * Reconciled scenario ID. Populated by buildDebugBundleAsync via
     * `reconcileScenarioId` (preference: store > v5_fact > payload > url
     * > full_graph). Sync export path keeps this null — only the async
     * export resolves the canvas store and payload trace.
     */
    scenario_id: string | null
    /** Which source the reconciled scenario_id came from. 'none' when no
     *  candidate had a value (also the sync-path default). */
    scenario_id_source: ScenarioIdSource
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

  /**
   * PR #152 — Live payload-capture diagnostic.
   *
   * Surfaces the resolved state of the `payload-trace-store` env gate
   * so reviewers see at a glance WHY `payloads.cee_request` /
   * `cee_response` are populated or null on any given bundle. Previously
   * a missing/empty `VITE_APP_ENV` silently disabled capture in
   * production-like builds with no in-bundle explanation.
   *
   * The gate is closed-by-default — capture is enabled ONLY when one of:
   *   - Vite dev mode (`import.meta.env.DEV === true`)
   *   - `VITE_APP_ENV === 'development'`
   *   - `VITE_APP_ENV === 'staging'`
   *   - `VITE_ENABLE_PAYLOAD_INSPECTION === 'true'` (explicit override)
   * Otherwise capture is disabled and `reason` carries one of the
   * documented `missing_app_env_capture_disabled` / `empty_*` /
   * `production_*` / `unknown_*` codes.
   *
   * Round-2 review hardening: now ALWAYS emitted. When the bundle
   * assembler can't even reach the trace-store module (dynamic-import
   * failure, missing test mock, SSR), the field still appears with
   * `enabled: false` and `reason: 'inspection_status_unavailable'`
   * so reviewers never face a silently-missing diagnostic.
   *
   * Reason field is typed as the exported `PayloadInspectionReason`
   * enum so unsupported codes fail at compile time.
   */
  payload_inspection_status: {
    enabled: boolean
    resolved_app_env: string
    reason: PayloadInspectionReason
  }

  /**
   * Round-2 review (P1 + IMP): live CEE capture selector detail.
   *
   * Records WHAT disagreed when `capture_response_hash_mismatch_with_results`
   * fires (selected_response_hash + results_hash_at_selection) and
   * WHY this turn was selected (selection_diagnostics) — surfacing
   * the ranking decision without exporting raw payload content.
   *
   * Round-3 review (P1): NON-OPTIONAL. The sync export path emits a
   * `sync_not_evaluated` block (all counts = 0, selected_reason =
   * 'sync_not_evaluated') so consumers never need absence-based logic.
   * The async path overwrites with real selector output. Same
   * always-emit semantics as `payload_inspection_status`.
   */
  cee_capture_selection: {
    /** Captured response_hash for the selected entry, or null. */
    selected_response_hash: string | null
    /**
     * Where in the response body the hash was read from. One of
     * `ResponseHashSource` from `analysisProducingCeeTurn.ts`.
     */
    selected_response_hash_source: string | null
    /** Trace-store id of the selected entry. */
    selected_trace_id: string | null
    /** Canvas store's results.hash at the time the selector ran. */
    results_hash_at_selection: string | null
    /**
     * Hash-evidence summary. Drives the
     * `capture_response_hash_mismatch_with_results` coherence issue
     * (fires only on `'mismatched'`). Round-6 review: re-uses the
     * shared `HashMatchStatus` type from `analysisProducingCeeTurn.ts`
     * plus the sync-path `'sync_not_evaluated'` extension.
     */
    hash_match_status: HashMatchStatus | 'sync_not_evaluated'
    /**
     * Dominant ranking signal for the chosen candidate. Round-6
     * review: re-uses the shared `SelectionReason` type plus the
     * sync-path `'sync_not_evaluated'` extension.
     */
    selected_reason: SelectionReason | 'sync_not_evaluated'
    /** CEE entries across any endpoint (visible scope). */
    cee_candidate_count: number
    /** CEE entries on the `/orchestrate/v2/turn` V5 endpoint. */
    v5_endpoint_candidate_count: number
    /** V5-endpoint entries that were analysis-producing. */
    analysis_producing_candidate_count: number
    /** Whether the primary selector path returned a candidate. */
    selected_via_primary_path: boolean
    /**
     * Round-3 review (P1): provenance of `bundle.payloads.cee_*`.
     * Surfaces here AND on the cee_capture_selection diagnostic so
     * reviewers see in one place WHICH selector path produced the
     * payload — and downstream `determineCaptureTier` reads the same
     * value to gate `bundle_payloads` tier promotion.
     */
    provenance:
      | 'analysis_producing_v5_turn'
      | 'fallback_v5_turn'
      | 'fallback_legacy_cee'
      | 'none'
      | 'sync_not_evaluated'

    /**
     * Records what happened with the canonical trace pin:
     *
     *   - `pinned` — selector's id matched a valid V5 trace; the
     *     trace's metadata IS used for `v5_cee_capture`.
     *   - `fallback_latest` — no pin supplied, `findLatestV5TurnEntry`
     *     surfaced a trace; its metadata IS used.
     *   - `invalid_pin_rejected` — pin matched a non-V5 entry; the
     *     bundle REJECTS the fallback so the selected body is NOT
     *     paired with unrelated metadata. (Round-6 blocking rule.)
     *   - `pin_not_found_rejected` — pin id didn't match any entry
     *     (e.g. ring-buffer eviction); the bundle REJECTS the
     *     fallback for the same honesty reason.
     *   - `none` — no canonical trace anywhere.
     *   - `sync_not_evaluated` — sync export path; selector didn't run.
     *
     * Round-7 review: pre-fix these used the `*_fell_back` suffix,
     * which implied the fallback metadata WAS used. The round-6
     * blocking rule REJECTS the fallback in those cases, so the
     * labels now use `*_rejected` to match the enforced behaviour.
     * The boolean `canonical_trace_used` (below) makes the rejection
     * unambiguous at a glance.
     */
    canonical_trace_source:
      | 'pinned'
      | 'fallback_latest'
      | 'invalid_pin_rejected'
      | 'pin_not_found_rejected'
      | 'none'
      | 'sync_not_evaluated'

    /**
     * Round-7 review (IMP): explicit boolean for grep-ability.
     * `true` when `v5_cee_capture` metadata WAS sourced from a real
     * V5 trace entry; `false` when the bundle either had no trace
     * OR rejected the fallback per the round-6 blocking rule.
     * Always equivalent to
     * `canonical_trace_source ∈ {'pinned', 'fallback_latest'}`.
     */
    canonical_trace_used: boolean
  }

  /**
   * Round-4 review (IMP): canonical CEE trace id used by BOTH the
   * payload body (`bundle.payloads.cee_response`) AND the legacy
   * `v5_cee_capture` metadata. Pre-fix the two views could describe
   * different turns when a newer non-analysis V5 turn existed.
   *
   * - Set to the analysis-producing selector's chosen trace id when
   *   the selector pinned a turn.
   * - Set to the fallback trace id when `findBestPayload` produced
   *   one and the selector returned undefined.
   * - Null when no trace was selected (sync export, no captures,
   *   or hydrated-only).
   *
   * Whenever non-null, `v5_canonical_turn_diagnostics.latest_v5_turn.request_id`
   * MUST match the request_id of the trace entry whose id equals this
   * field — the regression test in `exportBundle.liveCeeCapture.spec.ts`
   * asserts this invariant directly.
   */
  selected_cee_trace_id: string | null

  /**
   * Round-8 (follow-up to PR #153): top-level evidence-source signal
   * distinct from `capture_pipeline_status` (which is CEE-centric).
   * Tells reviewers in one field what kind of live evidence backs this
   * bundle:
   *
   *   - `live_v5_cee_turn`          — V5 CEE turn captured (chat / chip)
   *   - `live_plot_v1_engine_turn`  — Run-analysis fired PLoT v1 sync;
   *                                   no CEE turn (legitimate flow)
   *   - `live_plot_v1_stream_turn`  — Run-analysis fired PLoT v1 SSE
   *                                   streaming; body is the COMPLETE
   *                                   event payload when present
   *   - `live_plot_v2_capture`      — V4 V2 PLoT path captured
   *   - `hydrated_report`           — reload / saved state, no live trace
   *   - `none`                      — no analysis evidence at all
   *
   * PR #156 round-2 (reviewer IMP #1): derived from the SELECTED
   * trace's endpoint via shared pathname-only helpers — NOT from
   * aggregate candidate counts. This avoids "stale V1 candidate
   * exists but selector picked V2" mislabelling.
   *
   * Honesty contract: when this is one of the `live_plot_v1_*`
   * codes, the absence of `cee_request`/`cee_response` is EXPECTED
   * (Run-analysis bypasses CEE) and the bundle does NOT label it
   * as failure.
   */
  analysis_evidence_source:
    | 'live_v5_cee_turn'
    | 'live_plot_v1_engine_turn'
    | 'live_plot_v1_stream_turn'
    | 'live_plot_v2_capture'
    | 'hydrated_report'
    | 'none'

  /**
   * Round-8 diagnostic: trace-store summary at export time. Helps
   * reviewers distinguish "store was empty" from "store had entries
   * but none qualified as the selected service". No raw payload
   * bodies — counts only.
   */
  payload_trace_store_summary: {
    /** Total entries in the trace-store snapshot. */
    total_entries: number
    /**
     * Entries grouped by `service` field (case-insensitive). Includes
     * a `'unknown'` bucket for entries whose `service` wasn't set
     * (e.g. legacy paths that recorded response-only without endpoint).
     */
    entries_by_service: Record<string, number>
    /** Age in milliseconds of the OLDEST entry, or null if empty. */
    oldest_entry_age_ms: number | null
  }

  /**
   * Round-8 diagnostic: PLoT-side selection detail. Mirrors
   * `cee_capture_selection` for the PLoT v1 engine and V2 paths.
   *
   * PR #156 round-3 (reviewer IMP #2): extended with selected
   * endpoint / status / completed / body-present / tier / source
   * so reviewers don't have to cross-reference raw trace entries
   * to understand WHY a particular evidence label was chosen.
   */
  plot_capture_selection: {
    /** PLoT entries on `/bff/engine/v1/run` or `/v1/stream`. */
    plot_candidate_count_v1_engine: number
    /** PLoT entries on `/v2/run` (V4 path). */
    plot_candidate_count_v2: number
    /** Trace-store id of the entry whose body sits in `payloads.plot_response`. */
    selected_plot_trace_id: string | null
    /** Endpoint of the selected trace, or null when no selection. */
    selected_plot_trace_endpoint: string | null
    /** HTTP status of the selected trace, or null. */
    selected_plot_trace_status: number | null
    /** True when the selected trace's `completed` flag is true. */
    selected_plot_trace_completed: boolean
    /**
     * PR #156 round-4 (reviewer IMP): true when the selected trace
     * completed AND status is 2xx. The hook computes this; the
     * bundle exposes it so reviewers can grep one field instead of
     * inferring from `_status` + `_completed`.
     */
    selected_plot_trace_completed_2xx: boolean
    /**
     * True when `response.body` is a non-empty object. False for
     * request-only entries, body:null streams, and empty bodies.
     */
    selected_plot_trace_response_body_present: boolean
    /**
     * Which selector tier picked the trace:
     *   - `v1_engine` — `/bff/engine/v1/run`
     *   - `v1_stream` — `/bff/engine/v1/stream` (SSE)
     *   - `v2_run`    — `/v2/run`
     *   - `other`     — fallback path, no analysis-class match
     *   - `none`      — no PLoT trace in the store
     */
    selected_plot_trace_tier:
      | 'v1_engine'
      | 'v1_stream'
      | 'v2_run'
      | 'other'
      | 'none'
    /**
     * True when the selected trace is `live evidence` — i.e. it
     * matched an analysis-class tier, completed with 2xx, and has
     * a usable response body. Drives the gate on
     * `analysis_evidence_source = live_*`. False means the bundle
     * falls through to `hydrated_report` / `none` even though a
     * PLoT entry exists.
     */
    selected_plot_trace_is_usable_live_evidence: boolean
  }
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
 * entries with a numeric, finite `win_probability` participate in the sort.
 * If every entry is missing `win_probability` (or the array is empty), the
 * function returns `null` rather than emitting a confident "{first label}
 * performs best" — which would otherwise be the first option_comparison
 * entry preserved by the stable sort, not an analytical winner. Per
 * `V2OptionComparison.win_probability` (`src/adapters/plot/v2/types.ts:161`)
 * the field is optional, so partial / malformed wire shapes are a real
 * production possibility.
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
    // Display-only formatting: route through the canonical shared entry point
    // (factorDisplayText) so the bundle's value_displayed string matches what
    // FactorNode and the inspector panels render. After the V5 fix, the
    // canonical formatFactorDisplayValue gives fresh observed_state.raw_value
    // priority over a (potentially stale) CEE display_value — see comment in
    // formatFactorDisplayValue.ts. This eliminates the pre-fix '0.26 £' bug
    // (naive `${value} ${unit}` concat) and the stale-display divergence
    // between debug bundle and live UI. Pure: no graph / report / payload /
    // store mutation.
    const valueStr = factorDisplayText(d)
    const match = matchFactor(n.id, d?.label)
    // Finite-number guard mirrors the resolveOption check for consistency
    // (Codex round-3 follow-up). JSON cannot carry NaN/Infinity from the
    // wire, but any future producer surfacing non-finite values should
    // collapse to `unmatched` honestly rather than display a confident
    // numeric.
    const influenceVal = typeof match?.influence_score === 'number' && Number.isFinite(match.influence_score) ? match.influence_score : null
    const sensitivityVal = typeof match?.sensitivity_score === 'number' && Number.isFinite(match.sensitivity_score) ? match.sensitivity_score : null
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

    // Honest-missing finite-number check shared across the three win_probability
    // resolution tiers (Codex round-3 follow-up): the rest of the export already
    // applies this principle for the hero headline. JSON from the wire cannot
    // carry NaN/Infinity, but the mapper-synthesised tertiary fallback
    // (`report.option_probabilities`) traverses local math and could
    // theoretically surface a non-finite value; treating those as "unmatched"
    // is consistent with the D4/D5/D8 tri-state contract and removes the
    // internal-consistency nit Codex flagged.
    const isFiniteWinProb = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v)
    const resolveOption = (node: { id: string; data: unknown }): ResolvedOption => {
      const d = node.data as Record<string, unknown> | undefined
      const nodeLabel = (d?.label as string) ?? null
      const norm = normaliseLabel(nodeLabel)
      // 1) PLoT response option_comparison (primary)
      let match = optionComparison.find((o) => {
        if (typeof o?.option_id === 'string' && o.option_id === node.id) return true
        return Boolean(norm) && normaliseLabel(o?.option_label ?? o?.option) === norm
      })
      if (match && isFiniteWinProb(match.win_probability)) {
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
      if (match && isFiniteWinProb(match.win_probability)) {
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
      if (probEntry && isFiniteWinProb(probEntry.win_probability)) {
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
    // `allHaveWinProb` now mirrors the finite-number guard above so the
    // rank-source decision is consistent: any non-finite slipping through
    // would have been resolved as null/unmatched anyway, but this keeps the
    // intent explicit.
    const allHaveWinProb = resolvedOptions.length > 0
      && resolvedOptions.every((r) => isFiniteWinProb(r.winProbability))

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
 * Round-7 review (IMP): map the helper's internal source code (which
 * describes what `findCanonicalV5TraceForBundle` DID — including
 * falling back to `findLatestV5TurnEntry` when the pin was invalid)
 * to the bundle's user-facing label (which describes what the bundle
 * DID with the result — REJECTING the fallback under the round-6
 * blocking rule).
 *
 * Helper says `invalid_pin_fell_back` (the function fell back).
 * Bundle says `invalid_pin_rejected` (the bundle rejected that
 * fallback). The two labels describe the same event from different
 * vantage points; the bundle's label is what reviewers see.
 *
 * Also returns the `used` boolean for explicit grep-ability.
 */
function mapCanonicalSourceToBundle(
  source:
    | 'pinned'
    | 'fallback_latest'
    | 'invalid_pin_fell_back'
    | 'pin_not_found_fell_back'
    | 'none',
): {
  source:
    | 'pinned'
    | 'fallback_latest'
    | 'invalid_pin_rejected'
    | 'pin_not_found_rejected'
    | 'none'
  used: boolean
} {
  switch (source) {
    case 'invalid_pin_fell_back':
      return { source: 'invalid_pin_rejected', used: false }
    case 'pin_not_found_fell_back':
      return { source: 'pin_not_found_rejected', used: false }
    case 'pinned':
      return { source: 'pinned', used: true }
    case 'fallback_latest':
      return { source: 'fallback_latest', used: true }
    case 'none':
      return { source: 'none', used: false }
  }
}

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
      // Sync path cannot reach the canvas store / payload trace store.
      // URL is available synchronously; full_graph is reachable but the
      // current `transformGraphDataEnriched` does NOT propagate
      // scenarioId into `_meta` (documented in
      // `extractScenarioIdFromFullGraph`), so that candidate is
      // effectively always null today. Async export overwrites these
      // via the full reconcileScenarioId run. This partial
      // reconciliation prevents the legacy hardcoded null when a user
      // is on /scenarios/<id> and exports synchronously.
      ...(() => {
        const partial = reconcileScenarioId({
          storeScenarioId: null,
          v5FactScenarioId: null,
          payloadScenarioId: null,
          urlScenarioId:
            typeof window !== 'undefined' && window.location
              ? extractScenarioIdFromUrl(window.location.href)
              : null,
          fullGraphScenarioId: extractScenarioIdFromFullGraph(fullGraph),
        })
        return {
          scenario_id: partial.selected_scenario_id,
          scenario_id_source: partial.selected_source,
        }
      })(),
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

    // PR #152 — Live capture diagnostic, ALWAYS emitted.
    // Sync path defaults to `inspection_status_unavailable` so the
    // field is present and typed even though the sync path cannot
    // dynamic-import the trace store. The async path (`buildDebugBundleAsync`)
    // overrides this with the real evaluated status. Reviewers running
    // a sync export still see the diagnostic shape; only the value
    // changes between the two code paths.
    payload_inspection_status: {
      enabled: false,
      resolved_app_env: '',
      reason: 'inspection_status_unavailable',
    },

    // Round-3 review (P1) — `cee_capture_selection` is NON-OPTIONAL.
    // Sync path emits a `sync_not_evaluated` block (the selector
    // consumes canvas-store state and the trace store, which the
    // sync path cannot reach). Async path overwrites with real
    // selector output. Reviewers never need absence-based logic.
    cee_capture_selection: {
      selected_response_hash: null,
      selected_response_hash_source: null,
      selected_trace_id: null,
      results_hash_at_selection: null,
      hash_match_status: 'sync_not_evaluated',
      selected_reason: 'sync_not_evaluated',
      cee_candidate_count: 0,
      v5_endpoint_candidate_count: 0,
      analysis_producing_candidate_count: 0,
      selected_via_primary_path: false,
      provenance: 'sync_not_evaluated',
      canonical_trace_source: 'sync_not_evaluated',
      // Round-7 review (IMP): boolean defaults to false on the sync
      // path. Async path overwrites when canonical pin or fallback
      // surfaced a real trace.
      canonical_trace_used: false,
    },

    // Round-4 review (IMP): selected_cee_trace_id — null on the sync
    // path (no selector run). Async path overwrites when the
    // selector returned a trace id.
    selected_cee_trace_id: null,

    // Round-8 (follow-up to PR #153): sync-path defaults. Async path
    // overwrites with real values from useDebugData + trace store.
    analysis_evidence_source: 'none',
    payload_trace_store_summary: {
      total_entries: 0,
      entries_by_service: {},
      oldest_entry_age_ms: null,
    },
    plot_capture_selection: {
      plot_candidate_count_v1_engine: 0,
      plot_candidate_count_v2: 0,
      selected_plot_trace_id: null,
      // PR #156 round-3 (reviewer IMP #2): sync-path defaults for
      // the extended diagnostic fields. Async path overwrites.
      selected_plot_trace_endpoint: null,
      selected_plot_trace_status: null,
      selected_plot_trace_completed: false,
      selected_plot_trace_completed_2xx: false,
      selected_plot_trace_response_body_present: false,
      selected_plot_trace_tier: 'none',
      selected_plot_trace_is_usable_live_evidence: false,
    },
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

  // Round-4 review (P0): centralized provenance decision. Compute the
  // `bundlePayloadsAreV5Confirmed` boolean ONCE at the bundle entry
  // point and reuse it at every `determineCaptureTier` call site
  // below. Pre-fix the legacy `v5_cee_capture` path and the snapshot
  // assembler each computed their own default — undefined provenance
  // could promote bundle_payloads at one site and not at the other,
  // producing internally-inconsistent bundles. Single computation =
  // no drift.
  //
  // Defaults to V5-confirmed when `cee_capture_provenance` is
  // undefined so non-migrated callers (test fixtures pre-dating PR
  // #152) preserve prior behaviour. The block only TIGHTENS when
  // `useDebugData` explicitly emits `fallback_legacy_cee` or `none`.
  const bundlePayloadsAreV5Confirmed =
    data.cee_capture_provenance === undefined ||
    data.cee_capture_provenance === 'analysis_producing_v5_turn' ||
    data.cee_capture_provenance === 'fallback_v5_turn'

  // PR #152 — Surface the resolved payload-trace-store env-gate state.
  // Closed-by-default; the bundle now self-explains why
  // `payloads.cee_request` / `cee_response` are present or null. The
  // import is dynamic so unit tests that mock the trace-store module
  // pick up the same state without static-import order pitfalls.
  //
  // Round-2 review hardening: the sync `buildDebugBundle` path already
  // seeded `payload_inspection_status` with
  // `reason: 'inspection_status_unavailable'`. If the dynamic import
  // succeeds we OVERWRITE that with the real state; if it fails we
  // KEEP the unavailable default so the field is never silently
  // absent. The field exists specifically to explain missing capture
  // — it must never itself go missing.
  try {
    const traceModule = await import('../../../lib/payload-trace-store')
    if (typeof traceModule.getPayloadInspectionStatus === 'function') {
      const status = traceModule.getPayloadInspectionStatus()
      bundle.payload_inspection_status = {
        enabled: status.enabled,
        resolved_app_env: status.resolvedAppEnv,
        reason: status.reason,
      }
    }
    // If the export is missing (e.g. partial test mock that stubs only
    // usePayloadTraceStore), retain the sync-path default of
    // `inspection_status_unavailable` instead of silently faking
    // success.
  } catch {
    // Dynamic import failed entirely (jsdom edge case, broken bundle).
    // Retain the sync-path default — reviewers see
    // `inspection_status_unavailable` instead of a missing field.
  }

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

  // v5-canonical-analysis brief PR 1: emit the additive diagnostic block.
  // Pulls from canvas store + the already-assembled bundle so we don't
  // re-read payload-trace-store directly here.
  try {
    const { readAnalysisStateSourceFromStore } = await import(
      '../../../canvas/hooks/useAnalysisStateSource'
    )
    const sourceResult = readAnalysisStateSourceFromStore()
    const { useCanvasStore } = await import('../../../canvas/store')
    const storeState = useCanvasStore.getState()
    const fact = storeState.v5AnalysisFact

    // Hoist trace lookup BEFORE parse-field derivation so the parse
    // diagnostics can fall back to trace.response.body when
    // bundle.payloads.cee_response is null (round-5 P0.1).
    //
    // Round-4 review (P0): PIN the canonical trace to the selector's
    // chosen `selected_cee_trace_id` so v5_cee_capture metadata
    // (request_id/endpoint/status/parse_ok) and bundle.payloads.cee_*
    // describe the SAME turn. Pre-fix `findLatestV5TurnEntry` could
    // return a newer non-analysis turn while the selector body was
    // an older run_analysis turn — metadata vs body disagreed.
    const v5TraceStorePre = await import('../../../lib/payload-trace-store')
    const v5TraceStatePre = v5TraceStorePre.usePayloadTraceStore.getState()
    const canonicalPre = findCanonicalV5TraceForBundle(
      v5TraceStatePre.payloads,
      data.cee_capture_selected_trace_id ?? null,
    )
    // Round-6 BLOCKING-fix rule: enforced via the shared pure helper
    // so this view and the snapshot view below cannot disagree on
    // when to surface a fallback trace as live metadata.
    const { trace: latestV5TracePre } = enforceCanonicalPinRule(canonicalPre)
    const traceResponseBody =
      latestV5TracePre?.response?.body !== undefined
        ? latestV5TracePre.response.body
        : null

    const ceeRequest = bundle.payloads.cee_request
    const ceeResponse = bundle.payloads.cee_response
    // EFFECTIVE response body for parse-field derivation. Prefer the
    // bundle-payloads object (already-redacted and normalised); fall
    // back to the trace-store body when the bundle path didn't
    // propagate the response. Either source feeds `ceeResponseObject`
    // and every downstream parse signal (parse_ok, parse_error,
    // response_top_level_keys, Phase 3 counts, unknown_block_types).
    const effectiveResponseBody = ceeResponse ?? traceResponseBody
    const ceeResponseObject =
      effectiveResponseBody &&
      typeof effectiveResponseBody === 'object' &&
      !Array.isArray(effectiveResponseBody)
        ? (effectiveResponseBody as Record<string, unknown>)
        : null
    // Distinct from `responsePresent` (HTTP completion): true only when
    // an actual parseable body object was captured.
    const responseBodyPresent = ceeResponseObject !== null

    // The captured body may be either:
    //   (a) a successful OlumiResponse (object), or
    //   (b) a `parse_error` envelope from responseParser: `{ kind:
    //       'parse_error', reason, raw?, parse_failure_kind?, ... }`. In (b)
    //       the original 200 JSON sits at `raw`.
    // We classify here so the bundle reflects both cases honestly.
    const ceeIsParseErrorEnvelope =
      ceeResponseObject !== null && ceeResponseObject.kind === V5_PARSE_ERROR_KIND
    const ceeRawResponseObject: Record<string, unknown> | null =
      ceeIsParseErrorEnvelope &&
      ceeResponseObject !== null &&
      typeof ceeResponseObject.raw === 'object' &&
      ceeResponseObject.raw !== null &&
      !Array.isArray(ceeResponseObject.raw)
        ? (ceeResponseObject.raw as Record<string, unknown>)
        : ceeIsParseErrorEnvelope
          ? null
          : ceeResponseObject

    // analysis_result detection runs against the RAW response when present
    // so a parse_error doesn't hide the upstream Phase 3-tolerated payload.
    const responseBlocks = ceeRawResponseObject?.blocks
    const ceeResponseHasAnalysisResult = Array.isArray(responseBlocks)
      ? responseBlocks.some(
          (b) =>
            b !== null &&
            typeof b === 'object' &&
            !Array.isArray(b) &&
            (b as Record<string, unknown>).type === 'analysis_result',
        )
      : false

    // Enumerate Phase 3 blocks landing inside `blocks[]` (whitelisted set
    // only). Read from the parsed response's sidecar first; if the parser
    // failed before stashing the sidecar, fall back to scanning the raw
    // blocks array.
    const phase3FromSidecar = (() => {
      if (ceeResponseObject === null || ceeIsParseErrorEnvelope) return null
      const sidecar = (ceeResponseObject as Record<string | symbol, unknown>)[
        ADDITIVE_EXTENSIONS_KEY as unknown as string
      ]
      if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) return null
      const fromBlocksArray = (sidecar as Record<string, unknown>)[
        PHASE3_SIDECAR_BLOCKS_KEY
      ]
      return Array.isArray(fromBlocksArray) ? fromBlocksArray : null
    })()
    const phase3FromRaw = phase3FromSidecar === null && Array.isArray(responseBlocks)
      ? responseBlocks.filter(
          (b) =>
            b !== null &&
            typeof b === 'object' &&
            !Array.isArray(b) &&
            typeof (b as Record<string, unknown>).type === 'string' &&
            (PHASE3_TOLERATED_BLOCK_TYPES as ReadonlySet<string>).has(
              (b as Record<string, unknown>).type as string,
            ),
        )
      : null
    const phase3Source = phase3FromSidecar ?? phase3FromRaw ?? []
    const phase3BlockTypes = Array.from(
      new Set(
        phase3Source
          .map((b) =>
            b !== null && typeof b === 'object' && !Array.isArray(b)
              ? ((b as Record<string, unknown>).type as string)
              : null,
          )
          .filter((t): t is string => typeof t === 'string'),
      ),
    ).sort()

    // ceeService is no longer the gate — payload-trace evidence
    // (cee_request / cee_response) is sufficient to emit a capture object,
    // and parse failures must populate the diagnostic even when the
    // services slice is empty.
    const ceeService = data.services.cee ?? null
    const requestPresent = ceeRequest !== null && ceeRequest !== undefined
    const responsePresent = ceeResponse !== null && ceeResponse !== undefined
    // (parseOk is now derived from the canonical-source tier below
    // — see `parseOkLegacy` near the V5CeeCapture assembly.)

    const parseError = ceeIsParseErrorEnvelope
      ? (() => {
          const reason =
            typeof ceeResponseObject?.reason === 'string'
              ? (ceeResponseObject.reason as string)
              : 'parse_error'
          return reason.length > 500 ? `${reason.slice(0, 500)}…` : reason
        })()
      : null
    const parseFailureKind: ParseFailureKind | null = ceeIsParseErrorEnvelope
      ? (typeof ceeResponseObject?.parse_failure_kind === 'string'
          ? (ceeResponseObject.parse_failure_kind as ParseFailureKind)
          : 'schema_mismatch')
      : null
    const unknownBlockTypes = ceeIsParseErrorEnvelope &&
      Array.isArray(ceeResponseObject?.unknown_block_types)
      ? (ceeResponseObject!.unknown_block_types as unknown[]).filter(
          (t): t is string => typeof t === 'string',
        )
      : null

    // response_top_level_keys — must reflect the ORIGINAL CEE root shape,
    // not the parsed clone (which has `__additive__` promoted as an
    // enumerable key and is missing the demoted top-level Phase 3 extras
    // like analysis_freshness / has_run_analysis_fact / freshness_reason).
    //
    // Source precedence:
    //   1. Parse-error envelope → keys of `envelope.raw` (verbatim original).
    //   2. Success path with sidecar carrying ORIGINAL_TOP_LEVEL_KEYS_KEY
    //      metadata (parser writes this whenever any sidecar is emitted).
    //   3. Fallback: keys of the captured body (parsed clone). Honest only
    //      when no sidecar is present — i.e. CEE emitted no top-level
    //      additives AND no Phase 3 blocks AND the parsed shape equals
    //      the wire shape.
    const successSidecar: Record<string, unknown> | null =
      ceeResponseObject !== null && !ceeIsParseErrorEnvelope
        ? (() => {
            const sc = (ceeResponseObject as Record<string | symbol, unknown>)[
              ADDITIVE_EXTENSIONS_KEY as unknown as string
            ]
            return sc && typeof sc === 'object' && !Array.isArray(sc)
              ? (sc as Record<string, unknown>)
              : null
          })()
        : null
    const originalKeysFromSidecar = successSidecar
      ? (successSidecar[ORIGINAL_TOP_LEVEL_KEYS_KEY] as unknown)
      : null
    const responseTopLevelKeys: string[] | null = ceeIsParseErrorEnvelope
      ? ceeRawResponseObject !== null
        ? Object.keys(ceeRawResponseObject).sort()
        : null
      : Array.isArray(originalKeysFromSidecar)
        ? (originalKeysFromSidecar as unknown[]).filter(
            (k): k is string => typeof k === 'string',
          )
        : ceeResponseObject !== null
          ? Object.keys(ceeResponseObject).sort()
          : null

    // raw_response_present — true iff the bundle carries the VERBATIM
    // pre-validation JSON body. The parser preserves it on the parse_error
    // path via `envelope.raw`. On success the trace stores a parsed clone
    // (validated, blocks pruned, sidecar promoted to an enumerable key) —
    // not the literal wire JSON — so this is honestly false. Reviewers
    // wanting to reconstruct the original use `response_top_level_keys`
    // (now sourced from sidecar metadata) plus the phase3 sidecar.
    const rawResponsePresent = ceeIsParseErrorEnvelope && ceeRawResponseObject !== null

    // `has_additive_extensions` is documented as TOP-LEVEL additive
    // extensions only — the kind of unknown keys CEE emits at the
    // response root ahead of a schema bump. The sidecar may also carry
    // diagnostic metadata (Phase 3 blocks lifted out of `blocks[]`,
    // original top-level key list); those are NOT top-level additive
    // fields and must not flip this flag. Compute from the sidecar's
    // remaining keys after excluding the metadata slots.
    const hasAdditiveExtensions = (() => {
      if (successSidecar === null) return false
      for (const k of Object.keys(successSidecar)) {
        if (k === PHASE3_SIDECAR_BLOCKS_KEY) continue
        if (k === ORIGINAL_TOP_LEVEL_KEYS_KEY) continue
        return true
      }
      return false
    })()

    // Re-use the trace lookup from above (hoisted before parse
    // derivation). `latestV5TraceTyped` carries the typed view used by
    // the capture assembly.
    const latestV5TraceTyped = latestV5TracePre as
      | {
          id?: string
          endpoint?: string
          status?: number
          duration?: number
          completed?: boolean
          request?: { body?: unknown } | undefined
          response?: { body?: unknown } | undefined
        }
      | null

    // V5-endpoint failure signal for the narrowed service_metadata
    // tier (round-5 P1.4): only failure evidence activates the tier;
    // successful service records with no payloads fall through to
    // `store` or `none` so missingness is visible.
    //
    // Round-5 review (P1): use the shared `isV5TurnEndpoint` helper
    // here too, so service-metadata classification can't reintroduce
    // `/turning` / query-string false positives. The helper requires
    // service='CEE' (case-insensitive), so we construct a probe
    // object from the service-metadata fields.
    const serviceMetadataV5FailurePresent =
      ceeService !== null &&
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint:
          typeof ceeService.endpoint === 'string'
            ? ceeService.endpoint
            : undefined,
      }) &&
      (ceeService.success === false ||
        (typeof ceeService.status === 'number' &&
          (ceeService.status >= 500 || ceeService.status === 0)))

    // Single canonical source for capture assembly. Once a tier is
    // selected, ALL related fields derive from that same source to
    // avoid mixed-provenance bundles. The helper is shared with the
    // second try block (turn diagnostics) so the two views never
    // disagree about where the capture data came from.
    const captureTier: LatestV5TurnSource = determineCaptureTier({
      traceEntryPresent: latestV5TraceTyped !== null,
      bundlePayloadsCeeRequestPresent: requestPresent,
      bundlePayloadsCeeResponsePresent: responsePresent,
      serviceMetadataV5FailurePresent,
      // First try block doesn't read `factPresentForScenario` here.
      // 'store' tier is meaningless for V5CeeCapture assembly (the
      // capture object requires evidence); only the snapshot uses
      // 'store' when capture is absent but a fact exists.
      factPresentForScenario: false,
      // Round-4 review (P0): centralized provenance — uses the
      // single `bundlePayloadsAreV5Confirmed` computed at the top
      // of `buildDebugBundleAsync` so this call site and the
      // snapshot call site below CANNOT disagree.
      bundlePayloadsAreV5Confirmed,
    })

    // Derive request_present / response_present from the SAME tier as
    // the rest of the capture metadata. Trace-tier reads from the
    // trace entry; bundle-payloads tier reads from bundle.payloads;
    // service-metadata + none tiers have no body evidence.
    const tierRequestPresent =
      captureTier === 'payload_trace'
        ? latestV5TraceTyped?.request !== undefined
        : captureTier === 'bundle_payloads'
          ? requestPresent
          : false
    const tierResponsePresent =
      captureTier === 'payload_trace'
        ? latestV5TraceTyped?.response !== undefined ||
          latestV5TraceTyped?.completed === true ||
          typeof latestV5TraceTyped?.status === 'number'
        : captureTier === 'bundle_payloads'
          ? responsePresent
          : false

    // parse_ok semantics: only meaningful when a parseable response
    // BODY was captured. Round-5 P0.3 lesson: a 500 status with no
    // body previously inherited `parseOkLegacy = true` because
    // `tierResponsePresent` was true (status set) and
    // `ceeIsParseErrorEnvelope` was false (no body to misclassify).
    // Gate the legacy boolean on `responseBodyPresent` so status-only
    // / failure-without-body trace entries report `false` honestly.
    // The new snapshot still overlays `null` in this case (it never
    // claims "parsed and failed" without evidence) but the legacy
    // field must also be honest for backward-compat consumers.
    const parseOkLegacy = responseBodyPresent && !ceeIsParseErrorEnvelope

    const v5Capture: V5CeeCapture | null =
      captureTier === 'none'
        ? null
        : {
            // Prefer the actual trace entry id when available; fall back
            // to the session-level request_id (the legacy behaviour).
            request_id: latestV5TraceTyped?.id ?? data.overall.request_id,
            scenario_id: storeState.currentScenarioId,
            turn_id: fact?.analysisHash ?? null,
            // Real endpoint from the trace entry > service-metadata
            // endpoint > null. Required for log correlation.
            endpoint:
              latestV5TraceTyped?.endpoint ?? ceeService?.endpoint ?? null,
            status: latestV5TraceTyped?.status ?? ceeService?.status ?? null,
            duration_ms:
              latestV5TraceTyped?.duration ?? ceeService?.duration_ms ?? null,
            request_present: tierRequestPresent,
            response_present: tierResponsePresent,
            parse_ok: parseOkLegacy,
            parse_error: parseError,
            response_top_level_keys: responseTopLevelKeys,
            raw_response_present: rawResponsePresent,
            parse_failure_kind: parseFailureKind,
            unknown_block_types: unknownBlockTypes,
            has_additive_extensions: hasAdditiveExtensions,
            phase3_blocks_tolerated_count: phase3Source.length,
            phase3_block_types: phase3BlockTypes,
            // Legacy `source: 'proxy_v5_turn'` literal kept for
            // backward-compat with existing consumers. The richer
            // provenance enum lives on the new
            // `v5_canonical_turn_diagnostics.latest_v5_turn.source`
            // field per the brief.
            source: 'proxy_v5_turn',
          }

    const plotRequestCaptured = bundle.payloads.plot_request !== null

    bundle.v5_canonical_analysis = classifyV5CanonicalAnalysisDiagnostic({
      canonicalFlagOn: isV5CanonicalAnalysisEnabled(),
      analysisStateSource: sourceResult.source,
      factPresentForScenario: sourceResult.factPresentForScenario,
      ceeResponseHasAnalysisResult,
      v5Capture,
      hasResultsReport: sourceResult.hasResultsReport,
      plotRequestCaptured,
    })
  } catch {
    // Diagnostic is additive — never fail the bundle on classification
    // errors. The absence of v5_canonical_analysis itself is a signal.
  }

  // Scenario-ID reconciliation + capture pipeline status + canonical
  // turn diagnostics. All three live in one try block because they
  // share inputs (canvas store + payload-trace). Each section is
  // additive — failure to assemble one does not block the rest.
  try {
    const { useCanvasStore } = await import('../../../canvas/store')
    const { usePayloadTraceStore } = await import('../../../lib/payload-trace-store')
    const { readAnalysisStateSourceFromStore } = await import(
      '../../../canvas/hooks/useAnalysisStateSource'
    )
    const storeState = useCanvasStore.getState()
    const traceState = usePayloadTraceStore.getState()
    const fact = storeState.v5AnalysisFact
    const sourceResult = readAnalysisStateSourceFromStore()

    // --- Scenario ID reconciliation (P0.1) ---
    const reconciliation = reconcileScenarioId({
      storeScenarioId: storeState.currentScenarioId ?? null,
      v5FactScenarioId: fact?.scenarioId ?? null,
      payloadScenarioId: extractScenarioIdFromLatestV5Payload(traceState.payloads),
      urlScenarioId:
        typeof window !== 'undefined' && window.location
          ? extractScenarioIdFromUrl(window.location.href)
          : null,
      fullGraphScenarioId: extractScenarioIdFromFullGraph(bundle.full_graph),
    })
    bundle.session.scenario_id = reconciliation.selected_scenario_id
    bundle.session.scenario_id_source = reconciliation.selected_source
    bundle.scenario_id_reconciliation = reconciliation

    // --- Capture pipeline status (P0.2) + Turn diagnostics (P0.3) ---
    // ALWAYS emit, even when the legacy v5_canonical_analysis block was not
    // assembled (e.g. classifier bailed). When legacy is absent we fall back
    // to a SYNTHESISED diagnostic that DERIVES real signals from the canvas
    // store rather than defaulting everything to "unknown". This keeps the
    // `analysis_fact_present_but_cee_capture_missing` contradiction fire-able
    // even when the legacy classifier itself failed mid-export.
    const legacyFromClassifier = bundle.v5_canonical_analysis !== undefined
    const legacy: V5CanonicalAnalysisDiagnostic =
      bundle.v5_canonical_analysis ?? {
        v5_cee_capture: null,
        analysis_state_source: sourceResult.source,
        // Derive from real store signals, not 'unknown_not_checked'.
        // The canvas store already tells us whether a fact attaches to
        // the current scenario; that fact-presence drives the headline
        // contradiction issue and must not be lost.
        analysis_fact_status: sourceResult.factPresentForScenario
          ? 'present'
          : 'missing',
        debug_capture_status: 'cee_capture_missing',
        canonical_flag_on: isV5CanonicalAnalysisEnabled(),
      }

    const failedHttp = detectFailedHttpRecord(traceState.payloads)
    const rawV2Present = storeState.results?.rawV2Response != null

    // Service-metadata-only failure: V5 endpoint reports failure in
    // data.services.cee but the payload-trace has no entry for it.
    // Reviewers need to distinguish this from `hydrated_only`.
    //
    // Round-5 review (P1): use shared `isV5TurnEndpoint` here so the
    // service-metadata classification can't reintroduce `/turning` /
    // query-string false positives.
    const ceeService = data.services.cee ?? null
    const ceeServiceEndpoint =
      typeof ceeService?.endpoint === 'string' ? ceeService.endpoint : ''
    const ceeServiceIsV5 = isV5TurnEndpoint({
      service: 'CEE',
      endpoint: ceeServiceEndpoint,
    })
    const ceeServiceFailed =
      ceeService !== null &&
      (ceeService.success === false ||
        (typeof ceeService.status === 'number' &&
          (ceeService.status >= 500 || ceeService.status === 0)))
    const serviceMetadataV5Failure =
      ceeServiceIsV5 && ceeServiceFailed && !failedHttp.present

    // Round-4 review (P0) + Round-5 review (P1) + Round-6 BLOCKING:
    // PIN the snapshot trace to the selector-chosen id so
    // `latest_v5_turn.*` describes the SAME turn whose body sits in
    // `bundle.payloads.cee_response`. Round-5 P1: validate the pin.
    // Round-6 BLOCKING: when the pin fails validation OR isn't
    // found, FORCE the trace to null instead of falling back to a
    // different turn. That kept the body-vs-metadata divergence
    // alive on the silent-fallback path.
    const canonical = findCanonicalV5TraceForBundle(
      traceState.payloads,
      data.cee_capture_selected_trace_id ?? null,
    )
    // Round-6 BLOCKING-fix rule: enforced via the shared pure helper
    // so the legacy classifier (first try block) and the snapshot
    // (this try block) cannot disagree.
    const { trace: latestV5Trace, invalidSelectedTraceId } =
      enforceCanonicalPinRule(canonical)
    const v5TraceEntryPresent = latestV5Trace !== null

    // Mirror the body-presence detection from the first try block —
    // either bundle.payloads.cee_response is an object OR the trace
    // entry carries a response body. Drives parse provenance in the
    // snapshot.
    const snapshotResponseBodyPresent =
      (bundle.payloads.cee_response !== null &&
        typeof bundle.payloads.cee_response === 'object' &&
        !Array.isArray(bundle.payloads.cee_response)) ||
      (latestV5Trace !== null && hasResponseBody(latestV5Trace))

    // Re-compute the canonical capture tier in this try block too —
    // the first try block (legacy assembly) might have bailed, but
    // this block must still pick a tier consistent with the rest of
    // the bundle. Inputs are deterministic from traceState + bundle
    // payloads + data.services + canvas store; the helper guarantees
    // we never disagree.
    const snapshotCaptureTier = determineCaptureTier({
      traceEntryPresent: v5TraceEntryPresent,
      bundlePayloadsCeeRequestPresent: bundle.payloads.cee_request !== null,
      bundlePayloadsCeeResponsePresent: bundle.payloads.cee_response !== null,
      // Round-5 P1.4: service_metadata tier only fires on V5 failure
      // evidence — successful service records fall through.
      serviceMetadataV5FailurePresent: serviceMetadataV5Failure,
      factPresentForScenario: sourceResult.factPresentForScenario,
      // Round-4 review (P0): centralized provenance — both call sites
      // now share the SAME `bundlePayloadsAreV5Confirmed` computed at
      // the top of `buildDebugBundleAsync`, so the legacy v5_cee_capture
      // path and the snapshot's `latest_v5_turn.source` cannot disagree.
      bundlePayloadsAreV5Confirmed,
    })

    // PR #156 round-2 (reviewer IMP #1 + IMP #4): classify the
    // SELECTED PLoT trace's endpoint ONCE here so both the
    // `classifyV5CapturePipelineStatus` call below and the
    // `analysis_evidence_source` rollup further down read the same
    // value. Pre-fix the rollup classified `selectedIsV1Run` AFTER
    // the classifier needed it.
    const selectedPlotProbe = {
      service: 'PLoT',
      endpoint: data.selected_plot_trace_endpoint ?? undefined,
    }
    const selectedIsV1Run = isV1PlotEngineEndpoint(selectedPlotProbe)
    const selectedIsV1Stream = isV1PlotStreamEndpoint(selectedPlotProbe)
    const selectedIsV2 = isV2PlotEndpoint(selectedPlotProbe)

    const capturePipeline = classifyV5CapturePipelineStatus({
      v5Capture: legacy.v5_cee_capture
        ? {
            request_present: legacy.v5_cee_capture.request_present,
            response_present: legacy.v5_cee_capture.response_present,
            parse_ok: legacy.v5_cee_capture.parse_ok,
            raw_response_present: legacy.v5_cee_capture.raw_response_present,
          }
        : null,
      hasResultsReport: sourceResult.hasResultsReport,
      rawV2ResponsePresent: rawV2Present,
      failedHttpRecord: failedHttp,
      serviceMetadataV5Failure,
      analysisStateSource: legacy.analysis_state_source,
      effectiveCeeResponseSource: bundle.effective_cee_response_source ?? null,
      analysisFactPresent: legacy.analysis_fact_status === 'present',
      scenarioIdConflictCount: reconciliation.conflicts.length,
      legacyPipelineStatus: bundle.pipeline.v5_pipeline_status ?? null,
      // PR #152 — surface live-capture hash disagreement so the bundle
      // emits `capture_response_hash_mismatch_with_results` when the
      // selected analysis-producing turn's response_hash disagrees
      // with canvas store.results.hash. Falsy when not observed.
      ceeCaptureResponseHashMismatch:
        data.cee_capture_response_hash_mismatch === true,
      // Round-5 review (P1): the canonical V5 trace pin failed
      // validation (non-V5 entry or no matching id). Emit
      // `invalid_selected_trace_id` so reviewers see the discrepancy.
      invalidSelectedTraceId,
      // Round-8 (follow-up to PR #153) + PR #156 round-2 (reviewer
      // IMP #4) + round-3 (reviewer BLOCKING #1): explanatory
      // diagnostic for the Run-analysis flow. The explanatory issue
      // fires only when the selected PLoT V1 trace constitutes
      // USABLE LIVE EVIDENCE (selector tier matched, completed-2xx,
      // body present) AND no CEE turn fired. Request-only / failed /
      // empty-stream traces don't fire it; those surface via the
      // existing failure-detection paths instead.
      plotV1CapturePresentWithoutCee:
        (selectedIsV1Run || selectedIsV1Stream) &&
        data.selected_plot_trace_is_usable_live_evidence === true &&
        legacy.v5_cee_capture === null,
    })
    bundle.capture_pipeline_status = capturePipeline.capture_pipeline_status

    // Round-7 review (IMP): map the helper's internal source code
    // (which describes what `findCanonicalV5TraceForBundle` DID) to
    // the bundle's user-facing label (which describes what the
    // bundle DID after the round-6 blocking-rule enforcement). The
    // `used` boolean carries the same signal explicitly.
    const canonicalForBundle = mapCanonicalSourceToBundle(canonical.source)

    // Round-2 review (P1 + IMP) + Round-3 (P1) + Round-4 (IMP):
    // surface hash-mismatch detail + selection diagnostics +
    // provenance on the bundle. The sync-path default carries
    // `sync_not_evaluated` codes; we overwrite them progressively
    // as data fields are available, so consumers never face a
    // missing block.
    if (data.cee_capture_selection_diagnostics !== undefined) {
      bundle.cee_capture_selection = {
        selected_response_hash:
          data.cee_capture_selected_response_hash ?? null,
        selected_response_hash_source:
          data.cee_capture_selected_response_hash_source ?? null,
        selected_trace_id: data.cee_capture_selected_trace_id ?? null,
        results_hash_at_selection: storeState.results?.hash ?? null,
        // Round-5 review (P1): no cast — the DebugData boundary now
        // types these fields as explicit unions, so any drift fails
        // at compile time. The bundle's union is a strict superset
        // (it also includes `sync_not_evaluated` for the sync-path
        // default) so the assignment is type-safe.
        hash_match_status:
          data.cee_capture_selection_diagnostics.hash_match_status,
        selected_reason:
          data.cee_capture_selection_diagnostics.selected_reason,
        cee_candidate_count:
          data.cee_capture_selection_diagnostics.cee_candidate_count,
        v5_endpoint_candidate_count:
          data.cee_capture_selection_diagnostics.v5_endpoint_candidate_count,
        analysis_producing_candidate_count:
          data.cee_capture_selection_diagnostics
            .analysis_producing_candidate_count,
        selected_via_primary_path:
          data.cee_capture_selection_diagnostics.selected_via_primary_path,
        // Round-3 review (P1): provenance lives on the selection
        // block so reviewers see in one place WHICH path produced
        // the cee payload (analysis-producing V5, fallback V5, legacy
        // CEE, or none).
        provenance: data.cee_capture_provenance ?? 'none',
        // Round-6 (IMP) + Round-7 (IMP): record the canonical-trace-pin
        // outcome — with the round-7 user-facing label so reviewers
        // don't read `*_fell_back` and think the fallback metadata
        // was used.
        canonical_trace_source: canonicalForBundle.source,
        canonical_trace_used: canonicalForBundle.used,
      }
    } else if (
      data.cee_capture_provenance !== undefined ||
      data.cee_capture_selected_trace_id !== undefined
    ) {
      // Round-4 review (IMP): partial update — when the caller has
      // provenance OR a selected trace id but NOT full selector
      // diagnostics, mirror what's known into the selection block.
      // Remaining fields keep the `sync_not_evaluated` markers so
      // consumers see the partial nature honestly.
      bundle.cee_capture_selection = {
        ...bundle.cee_capture_selection,
        ...(data.cee_capture_selected_trace_id !== undefined
          ? { selected_trace_id: data.cee_capture_selected_trace_id }
          : {}),
        ...(data.cee_capture_provenance !== undefined
          ? { provenance: data.cee_capture_provenance }
          : {}),
        // Round-7 (IMP): canonical_trace_source mapped to the bundle's
        // user-facing label; `canonical_trace_used` mirrors it.
        canonical_trace_source: canonicalForBundle.source,
        canonical_trace_used: canonicalForBundle.used,
      }
    } else {
      // No selection data supplied at all — but the canonical pin
      // logic still ran, so reflect its source on the
      // already-defaulted block. (Round-6 IMP.)
      bundle.cee_capture_selection = {
        ...bundle.cee_capture_selection,
        canonical_trace_source: canonicalForBundle.source,
        canonical_trace_used: canonicalForBundle.used,
      }
    }

    // Round-6 review (IMP cleanup): the top-level `selected_cee_trace_id`
    // and `cee_capture_selection.selected_trace_id` were being written
    // in two separate places — the reviewer flagged this as "assigned
    // twice". Derive the top-level field from the selection block now
    // it's fully populated, so the two views can never diverge.
    bundle.selected_cee_trace_id =
      bundle.cee_capture_selection.selected_trace_id

    // Round-8 (follow-up to PR #153): PLoT-side selection block,
    // payload-trace-store summary, and the aggregate
    // `analysis_evidence_source`. Pull values from DebugData (computed
    // in useDebugData from the same `tracedPayloads` snapshot).
    bundle.plot_capture_selection = {
      plot_candidate_count_v1_engine:
        data.plot_candidate_count_v1_engine ?? 0,
      plot_candidate_count_v2: data.plot_candidate_count_v2 ?? 0,
      selected_plot_trace_id: data.selected_plot_trace_id ?? null,
      // PR #156 round-3 (reviewer IMP #2): extended diagnostic
      // fields so reviewers see the selection's full provenance
      // without cross-referencing raw entries.
      selected_plot_trace_endpoint:
        data.selected_plot_trace_endpoint ?? null,
      selected_plot_trace_status: data.selected_plot_trace_status ?? null,
      selected_plot_trace_completed:
        data.selected_plot_trace_completed ?? false,
      selected_plot_trace_completed_2xx:
        data.selected_plot_trace_completed_2xx ?? false,
      selected_plot_trace_response_body_present:
        data.selected_plot_trace_response_body_present ?? false,
      selected_plot_trace_tier:
        (data.selected_plot_trace_tier as
          | 'v1_engine'
          | 'v1_stream'
          | 'v2_run'
          | 'other'
          | null) ?? 'none',
      selected_plot_trace_is_usable_live_evidence:
        data.selected_plot_trace_is_usable_live_evidence ?? false,
    }
    if (data.payload_trace_store_summary !== undefined) {
      bundle.payload_trace_store_summary = data.payload_trace_store_summary
    }

    // `analysis_evidence_source` rollup. Priority:
    //   1. live V5 CEE turn (chat / chip) — `cee_capture_provenance`
    //      points at a V5 turn AND the bundle has a CEE response body.
    //   2. live PLoT V1 engine turn — Run-analysis sync flow.
    //   3. live PLoT V1 stream turn — Run-analysis streaming flow.
    //   4. live PLoT V2 capture — V4 direct V2 path.
    //   5. hydrated_report — no live trace, canvas store has results.
    //   6. none — nothing.
    //
    // PR #156 round-2 (reviewer IMP #1): derive the PLoT branches
    // from the SELECTED trace's endpoint — NOT aggregate counts.
    //
    // PR #156 round-3 (reviewer BLOCKING #1): the SELECTED PLoT
    // trace must ALSO be completed with 2xx AND have a usable
    // response body before the bundle reports `live_plot_*`. A
    // request-only / failed / empty-stream trace falls through to
    // `hydrated_report` (or `none`). `selected_plot_trace_is_usable_live_evidence`
    // captures all three conditions in one boolean from
    // `findAnalysisProducingPlotTurn`.
    const ceeBodyPresent =
      bundle.payloads.cee_response !== null &&
      typeof bundle.payloads.cee_response === 'object'
    const ceeProvenanceIsV5 =
      data.cee_capture_provenance === 'analysis_producing_v5_turn' ||
      data.cee_capture_provenance === 'fallback_v5_turn'
    const hydratedResultsPresent =
      sourceResult.hasResultsReport || storeState.results != null

    // `selectedIsV1Run` / `selectedIsV1Stream` / `selectedIsV2` are
    // already classified above (hoisted before the classifier call
    // so both consumers share the same value).
    //
    // The PLoT branches now ALSO require the selector's
    // `selected_plot_trace_is_usable_live_evidence` boolean to be
    // true. Endpoint shape alone is insufficient (round-3 BLOCKING
    // #1).
    const plotEvidenceIsUsable =
      data.selected_plot_trace_is_usable_live_evidence === true

    if (ceeBodyPresent && ceeProvenanceIsV5) {
      bundle.analysis_evidence_source = 'live_v5_cee_turn'
    } else if (selectedIsV1Run && plotEvidenceIsUsable) {
      bundle.analysis_evidence_source = 'live_plot_v1_engine_turn'
    } else if (selectedIsV1Stream && plotEvidenceIsUsable) {
      bundle.analysis_evidence_source = 'live_plot_v1_stream_turn'
    } else if (selectedIsV2 && plotEvidenceIsUsable) {
      bundle.analysis_evidence_source = 'live_plot_v2_capture'
    } else if (hydratedResultsPresent) {
      bundle.analysis_evidence_source = 'hydrated_report'
    } else {
      bundle.analysis_evidence_source = 'none'
    }

    // graph_hash_at_generation: read-through. The v5AnalysisFact slice
    // may not carry this field on every code path; emit null when
    // absent rather than fabricating from elsewhere.
    const graphHash =
      fact && typeof (fact as Record<string, unknown>).graphHashAtGeneration === 'string'
        ? ((fact as Record<string, unknown>).graphHashAtGeneration as string)
        : null

    // Flag diagnostic — guard against environments without
    // localStorage (e.g. SSR / jsdom edge cases).
    const flagDiagnostic = (() => {
      try {
        return diagnoseV5CanonicalAnalysis()
      } catch {
        return null
      }
    })()

    const optionCount = extractOptionCountFromPlotResponse(bundle.payloads.plot_response)
    const factorSensitivityCount = extractFactorSensitivityCountFromPlotResponse(
      bundle.payloads.plot_response,
    )

    // Rendered counts from bundle.display_state when present. Counts
    // are honest (length of the rendered arrays) and `null` when the
    // display state itself is absent — never fabricated.
    const displayState = bundle.display_state as
      | { rendered_options?: unknown; rendered_factors?: unknown }
      | null
    const renderedOptionCount =
      displayState && Array.isArray(displayState.rendered_options)
        ? displayState.rendered_options.length
        : null
    const renderedFactorCount =
      displayState && Array.isArray(displayState.rendered_factors)
        ? displayState.rendered_factors.length
        : null

    const base = assembleV5CanonicalTurnDiagnostics({
      legacyDiagnostic: legacy,
      legacyDiagnosticFromClassifier: legacyFromClassifier,
      flagDiagnostic,
      analysisStateSource: legacy.analysis_state_source,
      hasResultsReport: sourceResult.hasResultsReport,
      effectiveCeeResponseSource: bundle.effective_cee_response_source ?? null,
      graphHashAtGeneration: graphHash,
      optionCount,
      factorSensitivityCount,
      captureTier: snapshotCaptureTier,
      responseBodyPresent: snapshotResponseBodyPresent,
      renderedOptionCount,
      renderedFactorCount,
      capturePipeline,
      scenarioIdReconciliation: reconciliation,
    })

    bundle.v5_canonical_turn_diagnostics = attachAnalysisFactDetails(
      base,
      fact
        ? {
            hasRunAnalysisFact: fact.hasRunAnalysisFact,
            freshness: fact.freshness,
          }
        : null,
    )

    // --- Scientific validation (P1) ---
    // Always runs (even when capture_pipeline_status is missing) — the
    // orchestrator falls back to `source: unavailable` honestly.
    bundle.scientific_validation = runScientificValidation({
      plotRequest: bundle.payloads.plot_request,
      plotResponse: bundle.payloads.plot_response,
      ceeRequest: bundle.payloads.cee_request,
      ceeResponse: bundle.payloads.cee_response,
      islRequest: bundle.payloads.isl_request,
      islResponse: bundle.payloads.isl_response,
      resultsReport: storeState.results?.report ?? null,
      ceeAnalysisReady: storeState.ceeAnalysisReady ?? null,
      capturePipelineStatus: bundle.capture_pipeline_status ?? null,
      // PR #156 round-4 (reviewer P0): thread the usability flag so
      // `classifySource` can't overclaim `live_raw_payloads` from a
      // failed/non-usable selected PLoT trace whose error body
      // happens to carry an indicative key.
      selectedPlotTraceIsUsableLiveEvidence:
        data.selected_plot_trace_is_usable_live_evidence === true,
    })
  } catch {
    // All four sections are additive — keep partial state on failure.
    // Absence of the top-level fields IS the signal.
  }

  // --- Redaction manifest (P0.5) ---
  // Always emit, even when prior sections bailed — the manifest is the
  // safety surface for "what did we suppress and why" and must remain
  // available regardless of upstream assembly outcomes.
  try {
    bundle.debug_redaction_manifest = buildDebugRedactionManifest(bundle, [
      {
        path: 'v5_canonical_analysis',
        present: bundle.v5_canonical_analysis !== undefined,
        reason_if_omitted: 'legacy_classifier_bailed_or_disabled',
      },
      {
        path: 'capture_pipeline_status',
        present: bundle.capture_pipeline_status !== undefined,
        reason_if_omitted: 'capture_pipeline_classifier_bailed_or_legacy_missing',
      },
      {
        path: 'v5_canonical_turn_diagnostics',
        present: bundle.v5_canonical_turn_diagnostics !== undefined,
        reason_if_omitted: 'turn_diagnostics_assembler_bailed_or_legacy_missing',
      },
      {
        path: 'scenario_id_reconciliation',
        present: bundle.scenario_id_reconciliation !== undefined,
        reason_if_omitted: 'reconciliation_bailed',
      },
      {
        path: 'scientific_validation',
        present: bundle.scientific_validation !== undefined,
        reason_if_omitted: 'validators_bailed',
      },
    ])
  } catch {
    // Manifest is purely descriptive — never block export on its
    // absence. Reviewers should treat a missing manifest as a signal
    // that the manifest assembler itself errored.
  }

  return bundle
}

/**
 * Generate an opaque export identifier for render-log correlation.
 * Distinct from request_id so support can grep for "this export" in the
 * absence of a per-turn request id (e.g. on hydrated bundles).
 */
function makeExportId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `exp-${crypto.randomUUID()}`
    }
  } catch {
    // fall through
  }
  return `exp-${Date.now().toString(16)}-${Math.floor(Math.random() * 1e9).toString(16)}`
}

/**
 * Export all debug data as a single JSON bundle file (async).
 * Captures display_state, panel_state, and orchestrator context from stores.
 *
 * Emits four structured render-log events for diagnostic observability
 * (see debugBundleLogger.ts):
 *   1. dgai.debug_bundle.export_started — at entry
 *   2. dgai.debug_bundle.capture_status — after capture-pipeline assembly
 *   3. dgai.debug_bundle.scientific_validation_summary — after validators
 *   4. dgai.debug_bundle.export_completed — just before download
 *
 * Filename format: olumi-debug-{short_request_id}-{date}.json
 */
export async function exportDebugBundleAsync(data: DebugData, options: ExportOptions = {}): Promise<void> {
  const exportId = makeExportId()
  emitDebugBundleEvent(
    'dgai.debug_bundle.export_started',
    buildDebugBundleEventFields({ export_id: exportId }),
  )

  const bundle = await buildDebugBundleAsync(data, options)

  // Structural fields drawn from the assembled bundle — no raw payloads.
  const turn = bundle.v5_canonical_turn_diagnostics
  emitDebugBundleEvent(
    'dgai.debug_bundle.capture_status',
    buildDebugBundleEventFields({
      export_id: exportId,
      scenario_id_source: bundle.session.scenario_id_source ?? null,
      capture_pipeline_status: bundle.capture_pipeline_status ?? null,
      coherence_state: turn?.coherence.state ?? null,
      coherence_issue_count: turn ? turn.coherence.issues.length : null,
      canonical_flag_on: turn?.canonical_flag_on ?? null,
      has_v5_capture: turn ? turn.latest_v5_turn.request_present : null,
      parse_ok: turn?.parse.parse_ok ?? null,
      has_results: turn?.results.present ?? null,
    }),
  )

  // Scientific validation summary — counts derived from the validator map.
  const sv = bundle.scientific_validation ?? null
  const validatorEntries = sv ? Object.values(sv.validators) : []
  const availableCount = validatorEntries.filter(
    (v) => v.claim_strength === 'observed' || v.claim_strength === 'derived',
  ).length
  const unavailableCount = validatorEntries.filter(
    (v) => v.claim_strength === 'unavailable',
  ).length
  emitDebugBundleEvent(
    'dgai.debug_bundle.scientific_validation_summary',
    buildDebugBundleEventFields({
      export_id: exportId,
      scientific_validation_available_count: sv ? availableCount : null,
      scientific_validation_unavailable_count: sv ? unavailableCount : null,
    }),
  )

  const json = JSON.stringify(bundle, null, 2)
  const shortId = data.overall.request_id?.slice(0, 8) ?? 'unknown'
  const date = formatShortTimestamp().slice(0, 8) // YYYYMMDD
  const filename = `olumi-debug-${shortId}-${date}.json`

  // Count omitted sections — these are top-level keys that ended up
  // `undefined` or unassembled on this export (e.g. v5_canonical_turn_diagnostics
  // bailed). Treat null as present; undefined as omitted.
  const omittedCount = (() => {
    const optionalKeys: Array<keyof typeof bundle> = [
      'v5_canonical_analysis',
      'capture_pipeline_status',
      'v5_canonical_turn_diagnostics',
      'scenario_id_reconciliation',
      'scientific_validation',
      'debug_redaction_manifest',
    ]
    return optionalKeys.reduce(
      (n, k) => (bundle[k] === undefined ? n + 1 : n),
      0,
    )
  })()

  emitDebugBundleEvent(
    'dgai.debug_bundle.export_completed',
    buildDebugBundleEventFields({
      export_id: exportId,
      bundle_size_bytes: json.length,
      omitted_sections_count: omittedCount,
    }),
  )

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
