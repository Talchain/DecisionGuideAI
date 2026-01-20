/**
 * V2 Response Mapper (P0-UI Integration)
 *
 * Maps V2RunResponse to ReportV1 format so existing UI components
 * continue to work while backend uses /v2/run.
 *
 * This is a transitional layer — eventually the UI should consume
 * V2 response format natively.
 *
 * Note: PLoT returns `option_comparison` (not `options`), and robustness
 * uses `fragile_edges`/`robust_edges` structure.
 *
 * ============================================================================
 * RESULTS PANEL DATA CONTRACT (M0)
 * ============================================================================
 *
 * ISL/PLoT provides factor_sensitivity with these fields:
 * - importance_score: 0-1 normalised importance (PRIMARY - use this)
 * - sensitivity_score: raw sensitivity value (fallback)
 * - elasticity: elasticity measure (fallback)
 *
 * This mapper MUST preserve importance_score for downstream consumers.
 * The pickFactorSensitivityForUi() function:
 * 1. Checks hasRealData including importance_score > 0.001
 * 2. Maps sensitivity_score from: sensitivity_score ?? elasticity ?? importance_score
 * 3. Preserves importance_score in output for getRawElasticity() fallback
 *
 * Contract tests: src/test/integration/results-panel-contract.test.ts
 * Golden fixture: src/test/fixtures/golden-run-response.json
 * Expected values: src/test/fixtures/golden-expectations.ts
 */

import type { V2RunResponse, V2OptionComparison, V2Driver, V2Critique, V2EdgeSensitivity, V2FactorSensitivity } from './types'
import type { ReportV1, CritiqueItemV1, ConfidenceLevel } from '../types'
import type { DriversPayload, DriverItem } from '../../driversAdapter'
import { recordDataShapeAnomaly } from '../../../lib/payload-trace-store'
import { safeArray, safeArrayWithMeta } from '../../../lib/array-utils'
import type {
  CeeDecisionReviewPayloadV1,
  CeeTrace,
  ReviewBlock,
  ReviewBlockItem,
  ReadinessLevel,
  ReadinessFactor,
} from '../../../types/cee'

// =============================================================================
// Defensive Detection: Empty "Computed" Results
// =============================================================================

/**
 * Anomaly type for tracking inconsistent backend responses.
 */
export interface ComputedButEmptyAnomaly {
  field: 'option_comparison' | 'robustness' | 'factor_sensitivity'
  status: string
  message: string
}

/**
 * Detect when backend claims "computed" but results are empty/missing.
 * This is a backend bug, but UI should handle it gracefully.
 */
export function detectComputedButEmpty(v2Response: V2RunResponse): ComputedButEmptyAnomaly[] {
  const anomalies: ComputedButEmptyAnomaly[] = []

  // Check option_comparison
  if (v2Response.option_comparison_status === 'computed') {
    const isEmpty = !v2Response.option_comparison || v2Response.option_comparison.length === 0
    if (isEmpty) {
      anomalies.push({
        field: 'option_comparison',
        status: 'computed',
        message: 'Option comparison status is "computed" but results array is empty',
      })
    }
  }

  // Check robustness
  if (v2Response.robustness_status === 'computed') {
    const robustness = v2Response.robustness
    const isEmpty = !robustness ||
      ((robustness.fragile_edges?.length ?? 0) === 0 && (robustness.robust_edges?.length ?? 0) === 0)
    if (isEmpty) {
      anomalies.push({
        field: 'robustness',
        status: 'computed',
        message: 'Robustness status is "computed" but no fragile/robust edges returned',
      })
    }
  }

  // Check drivers (factor_sensitivity only - edge_sensitivity is not in V2 response)
  // When drivers_status === 'unavailable', no critique is fired (trust PLoT's status)
  if (v2Response.drivers_status === 'computed') {
    const hasFactorSensitivity = v2Response.factor_sensitivity && v2Response.factor_sensitivity.length > 0
    if (!hasFactorSensitivity) {
      anomalies.push({
        field: 'factor_sensitivity',
        status: 'computed',
        message: 'Drivers status is "computed" but factor_sensitivity array is empty',
      })
    }
  }

  return anomalies
}

/**
 * Check if a warning message is an internal implementation detail
 * that shouldn't be shown to users.
 *
 * Filters out:
 * - Option node filtering messages (e.g., "Node 'opt_x' has kind='option'. Option nodes are filtered...")
 * - Normalization warnings that are handled internally
 */
function isInternalImplementationWarning(message: string): boolean {
  if (!message) return false
  const lowerMessage = message.toLowerCase()

  // Filter out option node filtering messages
  if (lowerMessage.includes('option nodes are filtered') ||
      lowerMessage.includes("has kind='option'") ||
      lowerMessage.includes('kind=option')) {
    return true
  }

  // Filter out normalization warnings
  if (lowerMessage.includes('normalization') || lowerMessage.includes('normalisation')) {
    return true
  }

  // Filter out clamping warnings (internal ISL constraint enforcement)
  if (lowerMessage.includes('clamped')) {
    return true
  }

  return false
}

// =============================================================================
// Type-Safe Runtime Data Extraction
// =============================================================================

/**
 * Runtime extension fields that may exist on V2RunResponse but aren't in the static type.
 * Using explicit interface + runtime checks instead of `as any` for type safety.
 */
interface V2ResponseRuntimeExtensions {
  downstream_calls?: {
    isl?: {
      response?: {
        factor_sensitivity?: unknown[]
      }
    }
  }
  enrichment?: {
    sensitivity_analysis?: {
      factors?: unknown[]
    }
  }
}

/**
 * Safely extract downstream ISL factor sensitivity data with runtime type checking.
 */
function extractDownstreamFactors(v2Response: V2RunResponse): unknown[] | null {
  const extended = v2Response as V2RunResponse & V2ResponseRuntimeExtensions
  const factors = extended.downstream_calls?.isl?.response?.factor_sensitivity
  return Array.isArray(factors) ? factors : null
}

/**
 * Safely extract enrichment factor sensitivity data with runtime type checking.
 */
function extractEnrichmentFactors(v2Response: V2RunResponse): unknown[] | null {
  const extended = v2Response as V2RunResponse & V2ResponseRuntimeExtensions
  const factors = extended.enrichment?.sensitivity_analysis?.factors
  return Array.isArray(factors) ? factors : null
}

/**
 * Type guard for factor-like objects in runtime data.
 */
function isFactorLike(f: unknown): f is Record<string, unknown> {
  return typeof f === 'object' && f !== null
}

// =============================================================================
// Factor Sensitivity Selection
// =============================================================================

/** Return type for pickFactorSensitivityForUi with diagnostic path */
export interface FactorSensitivityResult {
  factors: V2FactorSensitivity[]
  _source_path: 'downstream_calls.isl' | 'enrichment' | 'top_level'
}

/**
 * Pick the best source for factor sensitivity data.
 *
 * Priority (P0 Fix: Added downstream_calls path where real ISL data lives):
 * 1. downstream_calls.isl.response.factor_sensitivity (direct ISL response - has real data)
 * 2. enrichment.sensitivity_analysis.factors (from ISL deep mode - has real sensitivity_score)
 * 3. v2Response.factor_sensitivity (top-level - may only have importance_score placeholders)
 *
 * The ISL response nested in downstream_calls has the real sensitivity data with
 * sensitivity_score, confidence, and label fields. The top-level factor_sensitivity
 * may only have importance_score=0 placeholders.
 *
 * Returns factors array with _source_path diagnostic for debugging.
 */
export function pickFactorSensitivityForUi(v2Response: V2RunResponse): FactorSensitivityResult {
  // P0 Fix: Check downstream_calls.isl.response first (where real ISL data lives)
  const islFactors = extractDownstreamFactors(v2Response)

  if (islFactors && islFactors.length > 0) {
    // Check if ISL factors have real sensitivity data
    // P0 Fix: Include importance_score in check (PLoT may only provide this field)
    // Use Math.abs() to handle potential negative values (direction stored separately)
    // VOI Fix: Include raw sensitivity field in check
    const hasRealData = islFactors.some((f) => {
      if (!isFactorLike(f)) return false
      return (typeof f.sensitivity_score === 'number' && Math.abs(f.sensitivity_score) > 0.001) ||
        (typeof f.sensitivity === 'number' && Math.abs(f.sensitivity) > 0.001) ||
        (typeof f.elasticity === 'number' && Math.abs(f.elasticity) > 0.001) ||
        (typeof f.importance_score === 'number' && Math.abs(f.importance_score) > 0.001)
    })

    if (hasRealData) {
      if (import.meta.env.DEV) {
        console.log('[pickFactorSensitivityForUi] Using downstream_calls.isl.response.factor_sensitivity:', {
          count: islFactors.length,
          sample: islFactors[0],
        })
      }

      // Contract: Must include all V2FactorSensitivity fields
      const factors = islFactors.filter(isFactorLike).map((f): V2FactorSensitivity => ({
        factor_id: (f.factor_id as string) ?? (f.node_id as string),
        node_id: (f.node_id as string) ?? (f.factor_id as string),
        label: f.label as string | undefined,
        sensitivity: f.sensitivity as number | undefined,
        // P0 Fix: Add importance_score to fallback chain
        sensitivity_score: (f.sensitivity_score as number) ?? (f.elasticity as number) ?? (f.importance_score as number),
        // P0 Fix: Pass through importance_score for downstream consumers (getRawElasticity)
        importance_score: f.importance_score as number | undefined,
        direction: f.direction === 'negative' ? 'negative' : 'positive',
        elasticity: f.elasticity as number | undefined,
        importance_rank: f.importance_rank as number | undefined,
        confidence: f.confidence as number | undefined,
        // VOI Fix: Pass through value_of_information for driver confidence display
        value_of_information: f.value_of_information as number | undefined,
      }))
      return { factors, _source_path: 'downstream_calls.isl' }
    }
  }

  // Check for enrichment path (from ISL deep mode)
  const enrichmentFactors = extractEnrichmentFactors(v2Response)

  if (enrichmentFactors && enrichmentFactors.length > 0) {
    // Check if enrichment factors have real sensitivity data (not just placeholders)
    // P0 Fix: Include importance_score in check (PLoT may only provide this field)
    // Use Math.abs() to handle potential negative values (direction stored separately)
    // VOI Fix: Include raw sensitivity field in check
    const hasRealData = enrichmentFactors.some((f) => {
      if (!isFactorLike(f)) return false
      return (typeof f.sensitivity_score === 'number' && Math.abs(f.sensitivity_score) > 0.001) ||
        (typeof f.sensitivity === 'number' && Math.abs(f.sensitivity) > 0.001) ||
        (typeof f.elasticity === 'number' && Math.abs(f.elasticity) > 0.001) ||
        (typeof f.importance_score === 'number' && Math.abs(f.importance_score) > 0.001)
    })

    if (hasRealData) {
      // Convert enrichment format to V2FactorSensitivity
      if (import.meta.env.DEV) {
        console.log('[pickFactorSensitivityForUi] Using enrichment factors:', {
          count: enrichmentFactors.length,
          sample: enrichmentFactors[0],
        })
      }

      // Contract: Must include all V2FactorSensitivity fields
      const factors = enrichmentFactors.filter(isFactorLike).map((f): V2FactorSensitivity => ({
        factor_id: f.factor_id as string,
        node_id: f.factor_id as string,  // Alias for compatibility
        label: f.label as string | undefined,
        sensitivity: f.sensitivity as number | undefined,
        // P0 Fix: Add importance_score to fallback chain
        sensitivity_score: (f.sensitivity_score as number) ?? (f.elasticity as number) ?? (f.importance_score as number),
        // P0 Fix: Pass through importance_score for downstream consumers (getRawElasticity)
        importance_score: f.importance_score as number | undefined,
        direction: f.direction === 'negative' ? 'negative' : 'positive',
        elasticity: f.elasticity as number | undefined,
        importance_rank: f.importance_rank as number | undefined,
        confidence: f.confidence as number | undefined,
        // VOI Fix: Pass through value_of_information for driver confidence display
        value_of_information: f.value_of_information as number | undefined,
      }))
      return { factors, _source_path: 'enrichment' }
    }
  }

  // Fall back to top-level factor_sensitivity
  const topLevel = v2Response.factor_sensitivity
  if (import.meta.env.DEV && Array.isArray(topLevel) && topLevel.length > 0) {
    console.log('[pickFactorSensitivityForUi] Using top-level factor_sensitivity:', {
      count: topLevel.length,
      sample: topLevel[0],
    })
  }

  const factors = Array.isArray(topLevel) ? topLevel : []
  return { factors, _source_path: 'top_level' }
}

/**
 * Map V2RunResponse to ReportV1 format.
 *
 * Handles:
 * - Option comparison → results + option_probabilities
 * - Drivers → drivers array
 * - Critiques → critique array
 * - Robustness → confidence (derived from fragile_edges count)
 *
 * DEFENSIVE: Handles unexpected shapes gracefully with anomaly recording.
 */
export function mapV2ResponseToReportV1(
  v2Response: V2RunResponse,
  meta: { seed: number; elapsed_ms?: number }
): ReportV1 {
  // P0 DIAGNOSTIC: Log input to identify crash source
  if (import.meta.env.DEV) {
    console.log('[responseMapper] === DIAGNOSTIC ===')
    console.log('[responseMapper] Input keys:', Object.keys(v2Response || {}))
    console.log('[responseMapper] option_comparison:', v2Response?.option_comparison)
    console.log('[responseMapper] edge_sensitivity count:', v2Response?.edge_sensitivity?.length ?? 0)
    console.log('[responseMapper] robustness:', v2Response?.robustness)
    console.log('[responseMapper] critiques count:', v2Response?.critiques?.length)
    console.log('[responseMapper] === END DIAGNOSTIC ===')
  }

  // Defensive: ensure option_comparison is an array
  const rawOptionComparison = v2Response.option_comparison
  if (rawOptionComparison !== undefined && !Array.isArray(rawOptionComparison)) {
    recordDataShapeAnomaly(
      'responseMapper.mapV2ResponseToReportV1',
      'option_comparison',
      'array',
      rawOptionComparison
    )
  }

  // Use option_comparison (actual PLoT field name) with defensive filtering
  const options = (Array.isArray(rawOptionComparison) ? rawOptionComparison : [])
    .filter((opt, i): opt is V2OptionComparison => {
      if (!opt || typeof opt !== 'object') {
        recordDataShapeAnomaly('responseMapper.mapV2ResponseToReportV1', `option_comparison[${i}]`, 'object', opt)
        return false
      }
      return true
    })

  const primaryOption = options[0]

  // Extract confidence interval as results with defensive access
  // confidence_interval is [low, high] tuple
  // P2 Fix: Use null instead of 0 when CI data is not available to avoid fabricating values
  const rawCI = primaryOption?.confidence_interval
  const hasValidCI = Array.isArray(rawCI) &&
    typeof rawCI[0] === 'number' &&
    typeof rawCI[1] === 'number'
  const ciLow = hasValidCI ? rawCI[0] : null
  const ciHigh = hasValidCI ? rawCI[1] : null
  const ciMid = hasValidCI ? (rawCI[0] + rawCI[1]) / 2 : null

  // Map drivers to V1 format
  // PLoT returns edge_sensitivity instead of drivers - use it as fallback
  const drivers = mapDriversFromResponse(v2Response)

  // P0 Fix: Create drivers_payload for gating logic
  // Without this, key factors shows "unavailable" even when factor_sensitivity has data
  const drivers_payload = createDriversPayloadFromV2(v2Response)

  // Map critiques to V1 format with defensive handling
  // Filter out internal implementation warnings (clamping, normalization, option filtering)
  const rawCritiques = v2Response.critiques
  const critique: CritiqueItemV1[] = (Array.isArray(rawCritiques) ? rawCritiques : [])
    .filter((c, i): c is V2Critique => {
      if (!c || typeof c !== 'object') {
        recordDataShapeAnomaly('responseMapper.critiques', `critiques[${i}]`, 'object', c)
        return false
      }
      return true
    })
    .filter((c) => !isInternalImplementationWarning(safeString(c.message) ?? ''))
    .map((c) => ({
      code: safeString(c.code) ?? 'UNKNOWN',
      severity: mapCritiqueSeverity(c.severity),
      message: safeString(c.message) ?? '',
      suggested_fix: safeString(c.suggestion) ?? undefined,
      node_id: Array.isArray(c.affected_nodes) ? safeString(c.affected_nodes[0]) ?? undefined : undefined,
      auto_fixable: false,
      source: 'isl' as const,
    }))

  // Detect computed-but-empty anomalies and add synthetic warnings
  const anomalies = detectComputedButEmpty(v2Response)
  if (anomalies.length > 0) {
    if (import.meta.env.DEV) {
      console.warn('[responseMapper] Detected computed-but-empty anomalies:', anomalies)
    }
    // Add synthetic critiques for each anomaly
    for (const anomaly of anomalies) {
      critique.push({
        code: 'EMPTY_COMPUTED_RESULTS',
        severity: 'WARNING',
        message: `${anomaly.message}. This may indicate a backend issue.`,
        auto_fixable: false,
        source: 'ui' as const,
      })
    }
  }

  // Derive confidence level from robustness (fragile_edges count)
  const confidenceLevel = deriveConfidenceFromRobustness(v2Response.robustness)

  // Get elapsed time from meta if available
  const elapsedMs = meta.elapsed_ms ?? v2Response.meta?.latency_ms ?? 0

  return {
    schema: 'report.v1',
    meta: {
      seed: meta.seed,
      response_id: v2Response.response_hash,
      elapsed_ms: elapsedMs,
    },
    model_card: {
      response_hash: v2Response.response_hash,
      response_hash_algo: 'sha256',
      normalized: true,
    },
    results: {
      conservative: ciLow,
      likely: ciMid,
      optimistic: ciHigh,
    },
    confidence: {
      level: confidenceLevel,
      why: v2Response.robustness
        ? `${v2Response.robustness.fragile_edges?.length ?? 0} fragile edges, ${v2Response.robustness.robust_edges?.length ?? 0} robust edges`
        : 'Based on available data',
    },
    drivers,
    // Pass through drivers_status for contextual empty state messages
    drivers_status: v2Response.drivers_status,
    // P0 Fix: Include drivers_payload for gating logic
    drivers_payload,
    // P0 Fix: Pass through factor_sensitivity for useResultsSectionData influence bars
    // Without this, UI reads empty array and displays 0% influence for all factors
    // P0 Fix: Use pickFactorSensitivityForUi to select the best data source
    // Enrichment path (from ISL deep mode) has real sensitivity_score values
    // Top-level factor_sensitivity may only have importance_score placeholders
    factor_sensitivity: pickFactorSensitivityForUi(v2Response).factors,
    // P0 Fix: Pass through robustness object for UI display (fragile/robust edges).
    // P2 Fix: Use safeArrayWithMeta() to preserve truncation metadata for UI display
    robustness: v2Response.robustness ? (() => {
      const fragile = safeArrayWithMeta(v2Response.robustness!.fragile_edges)
      const robust = safeArrayWithMeta(v2Response.robustness!.robust_edges)
      return {
        fragile_edges: fragile.items,
        robust_edges: robust.items,
        ranking_stability: v2Response.robustness!.ranking_stability,
        // P2 Fix: Include truncation metadata so UI can display "50 of 500 edges"
        _truncation: {
          fragile_truncated: fragile.truncated,
          fragile_total: fragile.totalCount,
          robust_truncated: robust.truncated,
          robust_total: robust.totalCount,
        },
      }
    })() : undefined,
    // P0 Fix: Pass through robustness_status for gating logic
    robustness_status: v2Response.robustness_status,
    run: {
      critique,
      bands: {
        p10: ciLow,
        p50: ciMid,
        p90: ciHigh,
      },
    },
    // Map all options for comparison view
    // Use actual probability_of_goal/win_probability from V2 when available
    // DEFENSIVE: Safe access to nested properties
    option_probabilities: options.reduce(
      (acc, opt) => {
        // Defensive: ensure option_id is a string
        const optionId = safeString(opt.option_id)
        if (!optionId) {
          recordDataShapeAnomaly('responseMapper.option_probabilities', 'option_id', 'string', opt.option_id, { opt })
          return acc
        }

        // Defensive confidence_interval access
        // P2 Fix: Use null instead of 0 when CI data is not available
        const optCI = opt.confidence_interval
        const hasCI = Array.isArray(optCI) &&
          typeof optCI[0] === 'number' &&
          typeof optCI[1] === 'number'
        const low = hasCI ? optCI[0] : null
        const high = hasCI ? optCI[1] : null
        const ciMidpoint = hasCI ? (optCI[0] + optCI[1]) / 2 : null

        // Extract outcome distribution with explicit expected value
        // expected = mean (arithmetic average) — use for "Expected" display
        // p50 = median (50th percentile) — kept separate, NOT the same as expected
        const outcome = opt.outcome
        const rawExpectedOutcome = safeNumber(opt.expected_outcome)
        const rawMean = safeNumber(outcome?.mean)

        // Explicit expected value: mean > expected_outcome > CI midpoint (null if none available)
        const expected = rawMean ?? rawExpectedOutcome ?? ciMidpoint

        // Percentiles from outcome, falling back to CI bounds (null if none available)
        const p10 = safeNumber(outcome?.p10) ?? low
        const p50 = safeNumber(outcome?.p50) ?? null  // True median only, no fallback to mean
        const p90 = safeNumber(outcome?.p90) ?? high

        acc[optionId] = {
          // Prefer actual probability_of_goal from V2 (when threshold was provided)
          // Fall back to CI midpoint (null if no CI data)
          goal_probability: safeNumber(opt.probability_of_goal) ?? ciMidpoint,
          confidence: 0.5, // Default confidence
          // Include win_probability when available (pairwise comparison)
          win_probability: safeNumber(opt.win_probability) ?? undefined,
          // Explicit expected value (mean) — primary value for "Expected" display
          expected,
          // Full outcome distribution for Results Panel display
          // expected is mean (average), p50 is median — semantically distinct
          outcome: {
            mean: rawMean,
            p10,
            p50,
            p90,
          },
        }
        return acc
      },
      {} as Record<string, {
        goal_probability: number
        confidence: number
        win_probability?: number
        expected?: number
        outcome?: {
          mean?: number | null
          p10?: number | null
          p50?: number | null
          p90?: number | null
        }
      }>
    ),
    // Include V2-specific data for components that can use it
    // Include both backend critiques and any computed-but-empty anomalies
    // Filter out internal implementation details (option node filtering, normalization)
    warnings: [
      ...v2Response.critiques
        .filter(c => c.severity === 'warning' || c.severity === 'info')
        .filter(c => !isInternalImplementationWarning(c.message))
        .map(c => c.message),
      ...anomalies.map(a => `${a.message}. This may indicate a backend issue.`),
    ],
    // Include anomaly flags for gate logic
    _computedButEmptyAnomalies: anomalies.length > 0 ? anomalies : undefined,
  }
}

/**
 * Derive confidence level from robustness structure.
 * Uses fragile_edges count as proxy for confidence.
 */
function deriveConfidenceFromRobustness(robustness?: { fragile_edges?: string[]; robust_edges?: string[] }): ConfidenceLevel {
  if (!robustness) return 'medium'

  const fragileCount = robustness.fragile_edges?.length ?? 0
  const robustCount = robustness.robust_edges?.length ?? 0
  const totalEdges = fragileCount + robustCount

  if (totalEdges === 0) return 'medium'

  const robustRatio = robustCount / totalEdges
  if (robustRatio >= 0.7) return 'high'
  if (robustRatio >= 0.3) return 'medium'
  return 'low'
}

/**
 * Map contribution (0-1) to strength category.
 */
function mapContributionToStrength(contribution: number): 'low' | 'medium' | 'high' {
  if (contribution >= 0.7) return 'high'
  if (contribution >= 0.3) return 'medium'
  return 'low'
}

/**
 * Map V2 critique severity to V1 format.
 */
function mapCritiqueSeverity(severity: 'blocker' | 'warning' | 'info'): 'BLOCKER' | 'WARNING' | 'INFO' {
  switch (severity) {
    case 'blocker':
      return 'BLOCKER'
    case 'warning':
      return 'WARNING'
    case 'info':
      return 'INFO'
    default:
      return 'INFO'
  }
}

/**
 * P0 Fix: Create drivers_payload from V2 response for gating logic.
 *
 * The DriversSignal component uses drivers_payload to determine whether to show
 * key factors. Without this, factor_sensitivity data exists but UI shows "unavailable".
 *
 * Creates a synthetic drivers_payload when:
 * - factor_sensitivity has data (drivers_status may be 'computed' or 'unavailable')
 * - OR v2Response.drivers has data
 */
function createDriversPayloadFromV2(v2Response: V2RunResponse): DriversPayload | undefined {
  // P0 Fix: Use pickFactorSensitivityForUi to get best data source (enrichment or top-level)
  const { factors: factorSensitivity, _source_path } = pickFactorSensitivityForUi(v2Response)
  const hasFactorSensitivity = factorSensitivity.length > 0

  // Debug: Log which source was selected
  if (import.meta.env.DEV && hasFactorSensitivity) {
    console.log('[createDriversPayloadFromV2] Factor sensitivity source:', _source_path)
  }

  // Check if we have drivers data (backward compatibility)
  const hasDrivers = Array.isArray(v2Response.drivers) &&
    v2Response.drivers.length > 0

  // If neither, return undefined (will show unavailable state)
  if (!hasFactorSensitivity && !hasDrivers) {
    // Return a minimal payload indicating unavailable state
    if (v2Response.drivers_status === 'unavailable' || v2Response.drivers_status === 'skipped') {
      return {
        status: 'cannot_compute',
        status_reason: 'Key factors analysis not available for this model',
        informative: false,
        drivers: [],
      }
    }
    return undefined
  }

  // Map factor_sensitivity to DriverItem format for the payload
  const driverItems: DriverItem[] = []

  if (hasFactorSensitivity) {
    for (const factor of factorSensitivity) {
      if (!factor || typeof factor !== 'object') continue

      const factorId = safeString(factor.factor_id) ?? safeString(factor.node_id) ?? ''
      if (!factorId) continue

      // P0 Fix: Also check importance_score (PLoT v2 may use this field)
      const sensitivityValue = safeNumber(factor.sensitivity_score) ??
        safeNumber(factor.elasticity) ??
        safeNumber(factor.sensitivity) ??
        safeNumber(factor.importance_score) ??
        undefined

      driverItems.push({
        id: factorId,
        kind: 'node',
        label: formatNodeName(factorId),
        sensitivity_score: sensitivityValue,
      })
    }
  } else if (hasDrivers) {
    // Fallback to drivers array (backward compatibility)
    for (const driver of v2Response.drivers!) {
      if (!driver || typeof driver !== 'object') continue

      const driverLabel = safeString(driver.label) ?? ''
      driverItems.push({
        id: driverLabel.replace(/\s+/g, '_').toLowerCase(),
        kind: 'node',
        label: driverLabel,
        sensitivity_score: safeNumber(driver.contribution) ?? undefined,
      })
    }
  }

  // P0 Fix: Return informative=true when we have actual driver data
  // This allows the gating logic to show key factors
  return {
    status: 'ok',
    informative: driverItems.length > 0,
    drivers: driverItems.slice(0, 5), // Limit to top 5
  }
}

/**
 * Map drivers from V2 response for "Key factors" section.
 *
 * Phase 1 Refinement: Uses ONLY factor_sensitivity for "Key factors" section.
 * Edge sensitivity will be used in a separate visualization (Phase 2).
 * This ensures clean separation and user-friendly factor labels.
 *
 * DEFENSIVE: Handles unexpected shapes gracefully with anomaly recording.
 */
function mapDriversFromResponse(v2Response: V2RunResponse): ReportV1['drivers'] {
  // If drivers exist, use them (backward compatibility)
  if (v2Response.drivers && Array.isArray(v2Response.drivers) && v2Response.drivers.length > 0) {
    return v2Response.drivers
      .filter((d): d is V2Driver => {
        // Defensive: validate driver shape
        if (!d || typeof d !== 'object') {
          recordDataShapeAnomaly('responseMapper.mapDrivers', 'driver', 'object', d)
          return false
        }
        return true
      })
      .map((d) => ({
        label: typeof d.label === 'string' ? d.label : String(d.label ?? ''),
        polarity: d.direction === 'positive' ? 'up' as const : 'down' as const,
        strength: mapContributionToStrength(typeof d.contribution === 'number' ? d.contribution : 0.5),
      }))
  }

  // Phase 1: Key factors uses ONLY factor_sensitivity
  // Do NOT fall back to edge_sensitivity (deferred to Phase 2)
  const rawFactorSensitivity = v2Response.factor_sensitivity

  // Defensive: ensure factor_sensitivity is an array
  if (!Array.isArray(rawFactorSensitivity)) {
    if (rawFactorSensitivity !== undefined && rawFactorSensitivity !== null) {
      recordDataShapeAnomaly(
        'responseMapper.mapDrivers',
        'factor_sensitivity',
        'array',
        rawFactorSensitivity
      )
    }
    return []
  }

  if (rawFactorSensitivity.length === 0) {
    return []
  }

  // Filter and validate each factor
  const validFactors = rawFactorSensitivity.filter((f, index): f is V2FactorSensitivity => {
    if (!f || typeof f !== 'object') {
      recordDataShapeAnomaly(
        'responseMapper.mapDrivers',
        `factor_sensitivity[${index}]`,
        'object',
        f
      )
      return false
    }
    return true
  })

  // Sort by importance_rank if available, otherwise by absolute sensitivity
  // Tie-breaker: factor_id for deterministic ordering when values are equal
  const sortedFactors = [...validFactors].sort((a, b) => {
    const aRank = safeNumber(a.importance_rank)
    const bRank = safeNumber(b.importance_rank)
    if (aRank !== null && bRank !== null) {
      return aRank - bRank
    }
    // Fall back to absolute sensitivity/elasticity (P0 Fix: include sensitivity_score and importance_score)
    const aVal = Math.abs(safeNumber(a.sensitivity_score) ?? safeNumber(a.elasticity) ?? safeNumber(a.sensitivity) ?? safeNumber(a.importance_score) ?? 0)
    const bVal = Math.abs(safeNumber(b.sensitivity_score) ?? safeNumber(b.elasticity) ?? safeNumber(b.sensitivity) ?? safeNumber(b.importance_score) ?? 0)
    if (bVal !== aVal) {
      return bVal - aVal // Higher sensitivity first
    }
    // Tie-breaker: sort by factor_id for deterministic ordering
    const aId = safeString(a.factor_id) ?? safeString(a.node_id) ?? ''
    const bId = safeString(b.factor_id) ?? safeString(b.node_id) ?? ''
    return aId.localeCompare(bId)
  })

  return sortedFactors.slice(0, 5).map((factor) => {
    // Support both factor_id and node_id aliases with defensive access
    const factorId = safeString(factor.factor_id) ?? safeString(factor.node_id) ?? ''

    // Determine polarity from direction or sensitivity sign
    // P0 Fix: Also check importance_score (PLoT v2 may use this field)
    const direction = factor.direction
    const sensitivityVal = safeNumber(factor.sensitivity_score) ?? safeNumber(factor.sensitivity) ?? safeNumber(factor.elasticity) ?? safeNumber(factor.importance_score) ?? 0
    const polarity = direction === 'negative'
      ? 'down' as const
      : direction === 'positive'
        ? 'up' as const
        : sensitivityVal >= 0
          ? 'up' as const
          : 'down' as const

    // Use elasticity if available, otherwise sensitivity
    // Priority: sensitivity_score (PLoT v2) > elasticity > sensitivity > importance_score > null
    // P0 Fix: Added importance_score since PLoT may use it instead of elasticity
    // IMPORTANT: null means "data not available" - UI must NOT display a fabricated percentage
    const rawValue = safeNumber(factor.sensitivity_score) ?? safeNumber(factor.elasticity) ?? safeNumber(factor.sensitivity) ?? safeNumber(factor.importance_score)
    const magnitude = rawValue !== null ? Math.abs(rawValue) : null

    return {
      label: formatNodeName(factorId),
      polarity,
      // P1 Fix: Don't fabricate 'medium' when sensitivity data is missing
      // When magnitude is null, strength should be undefined to indicate missing data
      strength: magnitude !== null ? mapElasticityToStrength(magnitude) : undefined,
      // Include factor metadata for highlighting
      nodeId: factorId,
      // contribution is null when sensitivity data is missing - UI should show "—" not a percentage
      contribution: magnitude !== null ? normalizeElasticity(magnitude) : undefined,
    }
  })
}

/**
 * Safe number extraction - returns null if not a valid number.
 */
function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value
  }
  return null
}

/**
 * Safe string extraction - returns null if not a string.
 */
function safeString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }
  return null
}

/**
 * Format edge ID as a readable label (fallback when interpretation is missing).
 */
function formatEdgeLabel(edge: V2EdgeSensitivity): string {
  // edge_id format: "from_node::to_node" or similar
  const parts = edge.edge_id.split('::')
  if (parts.length === 2) {
    return `${formatNodeName(parts[0])} → ${formatNodeName(parts[1])}`
  }
  return edge.edge_id.replace(/::/g, ' → ').replace(/_/g, ' ')
}

/**
 * Format node name for display.
 */
function formatNodeName(nodeId: string): string {
  // Remove common prefixes and format
  return nodeId
    .replace(/^(fac_|out_|goal_|risk_)/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Map elasticity to strength category.
 * Elasticity > 1 means high impact, < 0.5 means low impact.
 */
function mapElasticityToStrength(elasticity: number): 'low' | 'medium' | 'high' {
  if (elasticity >= 1.0) return 'high'
  if (elasticity >= 0.5) return 'medium'
  return 'low'
}

/**
 * Normalize elasticity to 0-1 contribution scale.
 * Note: ISL already normalises elasticity by /2 at computation time (robustness_analyzer_v2.py:841)
 * so we only clamp here, not divide again.
 */
function normalizeElasticity(elasticity: number): number {
  // Clamp to reasonable range (ISL pre-normalises, no /2 needed)
  const absElasticity = Math.abs(elasticity)
  return Math.min(1, absElasticity)
}

/**
 * Create enrichment object from V2 response.
 * Maps edge_sensitivity/factor_sensitivity to the format expected by
 * useRobustness hook and gate-state.
 *
 * Also includes fragile_edges/robust_edges from V2 robustness for display.
 *
 * DEFENSIVE: Handles unexpected shapes gracefully with anomaly recording.
 */
export function createEnrichmentFromV2Response(v2Response: V2RunResponse): {
  sensitivity_analysis: {
    edges: Array<{ edge_id: string; elasticity: number; importance_rank: number }>
    factors: Array<{ factor_id: string; elasticity: number; importance_rank: number }>
    /** Fragile edges from V2 robustness (edge IDs that can flip the decision) */
    fragile_edges?: string[]
    /** Robust edges from V2 robustness (stable relationships) */
    robust_edges?: string[]
    /** Derived overall robustness from edge counts */
    overall_robustness?: 'robust' | 'moderate' | 'fragile'
  }
  metadata: {
    /** P0 Fix: Required by hasEnrichment() type guard */
    isl_enabled: boolean
    /** P0 Fix: Required by hasEnrichment() type guard */
    detail_level: 'quick' | 'standard' | 'deep'
    factor_sensitivity_status: 'available' | 'unavailable' | 'skipped'
  }
} | null {
  // Defensive array extraction
  const rawEdgeSensitivity = v2Response.edge_sensitivity
  const rawFactorSensitivity = v2Response.factor_sensitivity

  const edgeSensitivity = Array.isArray(rawEdgeSensitivity) ? rawEdgeSensitivity : []
  const factorSensitivity = Array.isArray(rawFactorSensitivity) ? rawFactorSensitivity : []

  // DEV: Log raw factor_sensitivity fields to debug "Impact data not available"
  if (import.meta.env.DEV && factorSensitivity.length > 0) {
    console.log('[createEnrichmentFromV2Response] Raw factor_sensitivity sample:', {
      count: factorSensitivity.length,
      sampleKeys: factorSensitivity[0] ? Object.keys(factorSensitivity[0]) : [],
      sample: factorSensitivity[0],
    })
  }

  // Log anomalies for non-array values
  if (rawEdgeSensitivity !== undefined && !Array.isArray(rawEdgeSensitivity)) {
    recordDataShapeAnomaly(
      'responseMapper.createEnrichment',
      'edge_sensitivity',
      'array',
      rawEdgeSensitivity
    )
  }
  if (rawFactorSensitivity !== undefined && !Array.isArray(rawFactorSensitivity)) {
    recordDataShapeAnomaly(
      'responseMapper.createEnrichment',
      'factor_sensitivity',
      'array',
      rawFactorSensitivity
    )
  }

  // Extract V2 robustness data (fragile_edges/robust_edges)
  // P0 Fix: Use safeArray to handle truncated wrapper format { __truncated: true, items: [...] }
  const robustness = v2Response.robustness
  const fragileEdges = safeArray(robustness?.fragile_edges)
  const robustEdges = safeArray(robustness?.robust_edges)
  const hasRobustnessData = fragileEdges.length > 0 || robustEdges.length > 0

  // Derive overall robustness from edge counts
  const deriveOverallRobustness = (): 'robust' | 'moderate' | 'fragile' | undefined => {
    if (!hasRobustnessData) return undefined
    const totalEdges = fragileEdges.length + robustEdges.length
    if (totalEdges === 0) return undefined
    const robustRatio = robustEdges.length / totalEdges
    if (robustRatio >= 0.7) return 'robust'
    if (robustRatio >= 0.3) return 'moderate'
    return 'fragile'
  }

  // Return null only if no sensitivity AND no robustness data
  if (edgeSensitivity.length === 0 && factorSensitivity.length === 0 && !hasRobustnessData) {
    return null
  }

  // Map to enrichment format with defensive field access
  // P0 Fix: Include required metadata fields (isl_enabled, detail_level) so
  // this passes hasEnrichment() type guard in extractRobustnessFromEnrichment()
  return {
    sensitivity_analysis: {
      edges: edgeSensitivity
        .filter((e, i): e is V2EdgeSensitivity => {
          if (!e || typeof e !== 'object') {
            recordDataShapeAnomaly('responseMapper.createEnrichment', `edge_sensitivity[${i}]`, 'object', e)
            return false
          }
          const edgeId = safeString(e.edge_id)
          const from = safeString(e.from)
          const to = safeString(e.to)
          if (!edgeId || edgeId === '::' || !from || !to) {
            recordDataShapeAnomaly('responseMapper.createEnrichment', `edge_sensitivity[${i}]`, 'valid edge', e)
            return false
          }
          return true
        })
        .map((e) => ({
          edge_id: safeString(e.edge_id) ?? '',
          elasticity: safeNumber(e.elasticity) ?? 0,
          importance_rank: safeNumber(e.importance_rank) ?? 999,
        })),
      factors: factorSensitivity
        .filter((f, i): f is V2FactorSensitivity => {
          if (!f || typeof f !== 'object') {
            recordDataShapeAnomaly('responseMapper.createEnrichment', `factor_sensitivity[${i}]`, 'object', f)
            return false
          }
          return true
        })
        .map((f) => ({
          factor_id: safeString(f.factor_id) ?? safeString(f.node_id) ?? '',
          elasticity: safeNumber(f.elasticity) ?? safeNumber(f.sensitivity) ?? 0,
          importance_rank: safeNumber(f.importance_rank) ?? 999,
        })),
      // Include V2 robustness data
      fragile_edges: hasRobustnessData ? fragileEdges.filter((e): e is string => typeof e === 'string') : undefined,
      robust_edges: hasRobustnessData ? robustEdges.filter((e): e is string => typeof e === 'string') : undefined,
      overall_robustness: deriveOverallRobustness(),
    },
    metadata: {
      // P0 Fix: Required fields for hasEnrichment() type guard
      isl_enabled: true,
      detail_level: 'deep' as const,
      factor_sensitivity_status: factorSensitivity.length > 0 ? 'available' : 'unavailable',
    },
  }
}

/**
 * Create error report for blocked/failed responses.
 */
export function createErrorReport(
  statusReason: string,
  critiques: V2Critique[],
  meta: { seed: number }
): ReportV1 {
  return {
    schema: 'report.v1',
    meta: {
      seed: meta.seed,
      response_id: 'error',
      elapsed_ms: 0,
    },
    model_card: {
      response_hash: 'error',
      response_hash_algo: 'sha256',
      normalized: true,
    },
    results: {
      conservative: 0,
      likely: 0,
      optimistic: 0,
    },
    confidence: {
      level: 'low',
      why: statusReason,
    },
    drivers: [],
    run: {
      critique: critiques.map((c) => ({
        code: c.code,
        severity: mapCritiqueSeverity(c.severity),
        message: c.message,
        suggested_fix: c.suggestion,
        node_id: c.affected_nodes?.[0],
        auto_fixable: false,
        source: 'isl' as const,
      })),
    },
  }
}

// =============================================================================
// CEE V1 Synthesis from V2 Response
// =============================================================================

/**
 * Synthesize CeeDecisionReviewPayloadV1 from V2 response.
 *
 * Since V2 endpoint doesn't include CEE data, we create a synthetic
 * decision review from the analysis results (drivers, robustness, critiques).
 * This allows the Decision Review panel to display useful content.
 *
 * The synthesized review includes:
 * - Readiness: Derived from robustness status and critique severity
 * - Recommendation block: From option comparison results
 * - Drivers block: From factor_sensitivity data
 * - Risks block: From critiques with blocker/warning severity
 * - Next steps block: From critique suggestions
 */
export function synthesizeCeeReviewFromV2(
  v2Response: V2RunResponse
): CeeDecisionReviewPayloadV1 | null {
  // Don't synthesize if analysis failed
  if (v2Response.analysis_status !== 'computed' && v2Response.analysis_status !== 'partial') {
    return null
  }

  // Derive readiness from analysis results
  const readiness = deriveReadinessFromV2(v2Response)

  // Build review blocks from V2 data
  const blocks: ReviewBlock[] = []

  // 1. Recommendation block from option comparison
  const recommendationBlock = buildRecommendationBlock(v2Response)
  if (recommendationBlock) {
    blocks.push(recommendationBlock)
  }

  // 2. Drivers block from factor_sensitivity
  const driversBlock = buildDriversBlock(v2Response)
  if (driversBlock) {
    blocks.push(driversBlock)
  }

  // 3. Risks block from critiques
  const risksBlock = buildRisksBlock(v2Response)
  if (risksBlock) {
    blocks.push(risksBlock)
  }

  // 4. Next steps block from critique suggestions
  const nextStepsBlock = buildNextStepsBlock(v2Response)
  if (nextStepsBlock) {
    blocks.push(nextStepsBlock)
  }

  return {
    intent: 'selection',
    analysis_state: v2Response.analysis_status === 'partial' ? 'partial' : 'ran',
    readiness,
    blocks,
    // Mark as synthesized for debugging
    _synthesized_from_v2: true,
  }
}

/**
 * Derive readiness status from V2 response.
 */
function deriveReadinessFromV2(v2Response: V2RunResponse): {
  level: ReadinessLevel
  headline: string
  factors: ReadinessFactor[]
} {
  const factors: ReadinessFactor[] = []

  // Factor 1: Option comparison status
  if (v2Response.option_comparison_status === 'computed') {
    factors.push({ label: 'Options analyzed', status: 'ok' })
  } else if (v2Response.option_comparison_status === 'unavailable') {
    factors.push({ label: 'Options analyzed', status: 'warning' })
  } else {
    factors.push({ label: 'Options analyzed', status: 'blocking' })
  }

  // Factor 2: Robustness status
  if (v2Response.robustness_status === 'computed') {
    const robustness = v2Response.robustness
    const fragileCount = robustness?.fragile_edges?.length ?? 0
    const robustCount = robustness?.robust_edges?.length ?? 0
    const totalEdges = fragileCount + robustCount

    if (totalEdges > 0) {
      const fragileRatio = fragileCount / totalEdges
      if (fragileRatio > 0.5) {
        factors.push({ label: 'Model robustness', status: 'warning' })
      } else {
        factors.push({ label: 'Model robustness', status: 'ok' })
      }
    } else {
      factors.push({ label: 'Model robustness', status: 'ok' })
    }
  } else {
    factors.push({ label: 'Model robustness', status: 'warning' })
  }

  // Factor 3: Critique severity
  const blockers = v2Response.critiques?.filter(c => c.severity === 'blocker') ?? []
  const warnings = v2Response.critiques?.filter(c => c.severity === 'warning') ?? []

  if (blockers.length > 0) {
    factors.push({ label: 'Model quality', status: 'blocking' })
  } else if (warnings.length > 0) {
    factors.push({ label: 'Model quality', status: 'warning' })
  } else {
    factors.push({ label: 'Model quality', status: 'ok' })
  }

  // Determine overall level
  const hasBlocking = factors.some(f => f.status === 'blocking')
  const hasWarning = factors.some(f => f.status === 'warning')

  let level: ReadinessLevel
  let headline: string

  if (hasBlocking) {
    level = 'not_ready'
    headline = 'Model needs attention before relying on results'
  } else if (hasWarning) {
    level = 'caution'
    headline = 'Results provide directional guidance'
  } else {
    level = 'ready'
    headline = 'Analysis is reliable for decision-making'
  }

  return { level, headline, factors }
}

/**
 * Build recommendation block from option comparison.
 */
function buildRecommendationBlock(v2Response: V2RunResponse): ReviewBlock | null {
  const options = v2Response.option_comparison
  if (!options || options.length === 0) {
    return {
      id: 'recommendation',
      status: 'cannot_compute',
      status_reason: 'No options to compare',
      source: 'engine',
      summary: 'Unable to determine recommendation',
      priority: 1,
    }
  }

  // Find the best option (highest win_probability or probability_of_goal)
  const sortedOptions = [...options].sort((a, b) => {
    const aScore = a.win_probability ?? a.probability_of_goal ?? 0
    const bScore = b.win_probability ?? b.probability_of_goal ?? 0
    return bScore - aScore
  })

  const bestOption = sortedOptions[0]
  const winProb = bestOption.win_probability ?? bestOption.probability_of_goal

  let summary: string
  if (winProb !== undefined && winProb > 0.6) {
    summary = `"${bestOption.option_label}" shows the strongest expected outcome`
  } else if (options.length === 1) {
    summary = `Analysis complete for "${bestOption.option_label}"`
  } else {
    summary = 'Options are closely matched — consider other factors'
  }

  return {
    id: 'recommendation',
    status: 'ok',
    source: 'engine',
    summary,
    priority: 1,
    items: sortedOptions.slice(0, 3).map((opt, i) => ({
      id: opt.option_id,
      label: opt.option_label,
      description: opt.win_probability !== undefined
        ? `${Math.round(opt.win_probability * 100)}% likely to outperform others`
        : `Confidence interval: ${opt.confidence_interval[0].toFixed(2)} – ${opt.confidence_interval[1].toFixed(2)}`,
    })),
  }
}

/**
 * Build drivers block from factor_sensitivity.
 */
function buildDriversBlock(v2Response: V2RunResponse): ReviewBlock | null {
  const factors = v2Response.factor_sensitivity
  if (!factors || factors.length === 0) {
    // Check if drivers exist instead
    if (v2Response.drivers && v2Response.drivers.length > 0) {
      return {
        id: 'drivers',
        status: 'ok',
        source: 'engine',
        summary: 'Key factors influencing the outcome',
        priority: 2,
        items: v2Response.drivers.slice(0, 5).map(d => ({
          id: d.node_id,
          label: d.label,
          description: `${d.direction === 'positive' ? '↑' : '↓'} ${Math.round(d.contribution * 100)}% contribution`,
        })),
      }
    }

    return {
      id: 'drivers',
      status: v2Response.drivers_status === 'unavailable' ? 'not_applicable' : 'cannot_compute',
      status_reason: 'Factor sensitivity analysis not available',
      source: 'engine',
      summary: 'Key factors could not be determined',
      priority: 2,
    }
  }

  // Sort by importance_rank or elasticity
  const sorted = [...factors].sort((a, b) => {
    if (a.importance_rank !== undefined && b.importance_rank !== undefined) {
      return a.importance_rank - b.importance_rank
    }
    const aElast = Math.abs(a.elasticity ?? a.sensitivity ?? 0)
    const bElast = Math.abs(b.elasticity ?? b.sensitivity ?? 0)
    return bElast - aElast
  })

  // DEV: Log factor fields to debug "Impact data not available" issue
  if (import.meta.env.DEV && sorted.length > 0) {
    console.log('[buildDriversBlock] Factor sensitivity fields:', {
      factorCount: sorted.length,
      sampleFactor: sorted[0],
      sampleFields: {
        has_sensitivity_score: sorted[0].sensitivity_score !== undefined,
        has_elasticity: sorted[0].elasticity !== undefined,
        has_sensitivity: sorted[0].sensitivity !== undefined,
        sensitivity_score: sorted[0].sensitivity_score,
        elasticity: sorted[0].elasticity,
        sensitivity: sorted[0].sensitivity,
      },
    })
  }

  return {
    id: 'drivers',
    status: 'ok',
    source: 'engine',
    summary: 'Key factors influencing the outcome',
    priority: 2,
    items: sorted.slice(0, 5).map(f => {
      const factorId = f.factor_id ?? f.node_id ?? ''
      // Priority: sensitivity_score (PLoT v2 normalized) > elasticity > sensitivity > null
      // IMPORTANT: null means "data not available" - must NOT fabricate a percentage
      const elasticity = f.sensitivity_score ?? f.elasticity ?? f.sensitivity ?? null
      const direction = f.direction ?? (elasticity !== null && elasticity >= 0 ? 'positive' : 'negative')

      // Build description: show "—" when impact data is missing (never fabricate values)
      let description: string
      if (elasticity === null) {
        description = 'Impact data not available'
      } else {
        const normalizedPct = Math.round(normalizeElasticity(Math.abs(elasticity)) * 100)
        const displayPct = normalizedPct === 0 && elasticity !== 0 ? '<1' : String(normalizedPct)
        description = `${direction === 'positive' ? '↑' : '↓'} ${displayPct}% impact`
      }

      return {
        id: factorId,
        label: formatNodeName(factorId),
        description,
        severity: elasticity !== null
          ? (Math.abs(elasticity) >= 1 ? 'high' : Math.abs(elasticity) >= 0.5 ? 'medium' : 'low')
          : 'low',
      }
    }),
  }
}

/**
 * Build risks block from critiques.
 */
function buildRisksBlock(v2Response: V2RunResponse): ReviewBlock | null {
  const critiques = v2Response.critiques?.filter(
    c => c.severity === 'blocker' || c.severity === 'warning'
  ) ?? []

  if (critiques.length === 0) {
    return {
      id: 'risks',
      status: 'ok',
      source: 'validator',
      summary: 'No significant risks identified',
      priority: 2,
    }
  }

  return {
    id: 'risks',
    status: 'ok',
    source: 'validator',
    summary: `${critiques.length} potential issue${critiques.length > 1 ? 's' : ''} identified`,
    priority: 2,
    severity: critiques.some(c => c.severity === 'blocker') ? 'high' : 'medium',
    items: critiques.slice(0, 5).map(c => ({
      id: c.code,
      label: c.message,
      description: c.suggestion,
      severity: c.severity === 'blocker' ? 'high' : 'medium',
    })),
  }
}

/**
 * Build next steps block from critique suggestions.
 */
function buildNextStepsBlock(v2Response: V2RunResponse): ReviewBlock | null {
  // Extract actionable suggestions from critiques
  const suggestions = v2Response.critiques
    ?.filter(c => c.suggestion)
    .map(c => ({
      id: c.code,
      label: c.suggestion!,
      description: `Addresses: ${c.message}`,
    })) ?? []

  // Add generic next steps based on analysis state
  const genericSteps: ReviewBlockItem[] = []

  if (v2Response.robustness_status === 'computed') {
    const fragileCount = v2Response.robustness?.fragile_edges?.length ?? 0
    if (fragileCount > 0) {
      genericSteps.push({
        id: 'review-fragile',
        label: 'Review fragile relationships in your model',
        description: `${fragileCount} edge${fragileCount > 1 ? 's' : ''} could significantly change results if assumptions shift`,
      })
    }
  }

  if (v2Response.drivers_status === 'unavailable') {
    genericSteps.push({
      id: 'add-factors',
      label: 'Add more causal factors to improve analysis',
      description: 'Key drivers could not be computed — model may need more structure',
    })
  }

  const allItems = [...suggestions.slice(0, 3), ...genericSteps.slice(0, 2)]

  if (allItems.length === 0) {
    return {
      id: 'next_steps',
      status: 'ok',
      source: 'hybrid',
      summary: 'Analysis complete — ready for decision',
      priority: 3,
    }
  }

  return {
    id: 'next_steps',
    status: 'ok',
    source: 'hybrid',
    summary: 'Suggested improvements',
    priority: 3,
    items: allItems,
  }
}

/**
 * Synthesize CeeTrace from V2 response.
 *
 * Creates a trace object for the V2 run to maintain compatibility
 * with existing UI components that expect trace data.
 *
 * P1 Fix: Extract cee_trace from V2 response when available.
 * The /v2/run endpoint includes CEE trace data when CEE is called.
 */
export function synthesizeCeeTraceFromV2(
  v2Response: V2RunResponse,
  requestId: string,
  latencyMs: number
): CeeTrace {
  // Extract CEE trace data from V2 response if available
  const ceeTrace = v2Response.cee_trace

  return {
    plot_request_id: requestId,
    // Use CEE trace request_id if available (both sent and returned are the same in V2 response)
    cee_sent_request_id: ceeTrace?.request_id ?? null,
    cee_returned_request_id: ceeTrace?.request_id ?? null,
    // Prefer CEE-specific latency, fall back to total run latency
    latency_ms: ceeTrace?.latency_ms ?? latencyMs,
    model: null,
    // Mark degraded if CEE trace indicates degradation
    id_mismatch: ceeTrace?.degraded ?? false,
    // Mark as V2 synthesized for debugging
    _synthesized_from_v2: true,
    source: 'v2_synthesis',
  }
}
