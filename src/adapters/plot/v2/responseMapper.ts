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
 */

import type { V2RunResponse, V2OptionComparison, V2Driver, V2Critique, V2EdgeSensitivity, V2FactorSensitivity } from './types'
import type { ReportV1, CritiqueItemV1, ConfidenceLevel } from '../types'
import { recordDataShapeAnomaly } from '../../../lib/payload-trace-store'

// =============================================================================
// Defensive Detection: Empty "Computed" Results
// =============================================================================

/**
 * Anomaly type for tracking inconsistent backend responses.
 */
export interface ComputedButEmptyAnomaly {
  field: 'option_comparison' | 'robustness' | 'edge_sensitivity' | 'factor_sensitivity'
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

  // Check edge_sensitivity (drivers_status controls this)
  if (v2Response.drivers_status === 'computed') {
    const isEmpty = !v2Response.edge_sensitivity || v2Response.edge_sensitivity.length === 0
    if (isEmpty) {
      anomalies.push({
        field: 'edge_sensitivity',
        status: 'computed',
        message: 'Drivers status is "computed" but edge_sensitivity array is empty',
      })
    }
  }

  return anomalies
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
  const rawCI = primaryOption?.confidence_interval
  const ciLow = Array.isArray(rawCI) && typeof rawCI[0] === 'number' ? rawCI[0] : 0
  const ciHigh = Array.isArray(rawCI) && typeof rawCI[1] === 'number' ? rawCI[1] : 0
  const ciMid = (ciLow + ciHigh) / 2

  // Map drivers to V1 format
  // PLoT returns edge_sensitivity instead of drivers - use it as fallback
  const drivers = mapDriversFromResponse(v2Response)

  // Map critiques to V1 format with defensive handling
  const rawCritiques = v2Response.critiques
  const critique: CritiqueItemV1[] = (Array.isArray(rawCritiques) ? rawCritiques : [])
    .filter((c, i): c is V2Critique => {
      if (!c || typeof c !== 'object') {
        recordDataShapeAnomaly('responseMapper.critiques', `critiques[${i}]`, 'object', c)
        return false
      }
      return true
    })
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
        const optCI = opt.confidence_interval
        const low = Array.isArray(optCI) && typeof optCI[0] === 'number' ? optCI[0] : 0
        const high = Array.isArray(optCI) && typeof optCI[1] === 'number' ? optCI[1] : 0
        const ciMidpoint = (low + high) / 2

        acc[optionId] = {
          // Prefer actual probability_of_goal from V2 (when threshold was provided)
          // Fall back to CI midpoint (normalised) for display purposes
          goal_probability: safeNumber(opt.probability_of_goal) ?? ciMidpoint,
          confidence: 0.5, // Default confidence
          // Include win_probability when available (pairwise comparison)
          win_probability: safeNumber(opt.win_probability) ?? undefined,
        }
        return acc
      },
      {} as Record<string, { goal_probability: number; confidence: number; win_probability?: number }>
    ),
    // Include V2-specific data for components that can use it
    // Include both backend critiques and any computed-but-empty anomalies
    warnings: [
      ...v2Response.critiques
        .filter(c => c.severity === 'warning' || c.severity === 'info')
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
  const sortedFactors = [...validFactors].sort((a, b) => {
    const aRank = safeNumber(a.importance_rank)
    const bRank = safeNumber(b.importance_rank)
    if (aRank !== null && bRank !== null) {
      return aRank - bRank
    }
    // Fall back to absolute sensitivity/elasticity
    const aVal = Math.abs(safeNumber(a.elasticity) ?? safeNumber(a.sensitivity) ?? 0)
    const bVal = Math.abs(safeNumber(b.elasticity) ?? safeNumber(b.sensitivity) ?? 0)
    return bVal - aVal // Higher sensitivity first
  })

  return sortedFactors.slice(0, 5).map((factor) => {
    // Support both factor_id and node_id aliases with defensive access
    const factorId = safeString(factor.factor_id) ?? safeString(factor.node_id) ?? ''

    // Determine polarity from direction or sensitivity sign
    const direction = factor.direction
    const sensitivityVal = safeNumber(factor.sensitivity) ?? safeNumber(factor.elasticity) ?? 0
    const polarity = direction === 'negative'
      ? 'down' as const
      : direction === 'positive'
        ? 'up' as const
        : sensitivityVal >= 0
          ? 'up' as const
          : 'down' as const

    // Use elasticity if available, otherwise sensitivity
    const magnitude = Math.abs(safeNumber(factor.elasticity) ?? safeNumber(factor.sensitivity) ?? 0.5)

    return {
      label: formatNodeName(factorId),
      polarity,
      strength: mapElasticityToStrength(magnitude),
      // Include factor metadata for highlighting
      nodeId: factorId,
      contribution: normalizeElasticity(safeNumber(factor.elasticity) ?? safeNumber(factor.sensitivity) ?? 0.5),
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
 */
function normalizeElasticity(elasticity: number): number {
  // Clamp to reasonable range and normalize
  const absElasticity = Math.abs(elasticity)
  return Math.min(1, absElasticity / 2)
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
  const robustness = v2Response.robustness
  const fragileEdges = Array.isArray(robustness?.fragile_edges) ? robustness.fragile_edges : []
  const robustEdges = Array.isArray(robustness?.robust_edges) ? robustness.robust_edges : []
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
