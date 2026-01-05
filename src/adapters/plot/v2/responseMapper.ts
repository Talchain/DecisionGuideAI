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

import type { V2RunResponse, V2OptionComparison, V2Driver, V2Critique, V2EdgeSensitivity } from './types'
import type { ReportV1, CritiqueItemV1, ConfidenceLevel } from '../types'

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

  // Use option_comparison (actual PLoT field name)
  const options = v2Response.option_comparison ?? []
  const primaryOption = options[0]

  // Extract confidence interval as results
  // confidence_interval is [low, high] tuple
  const [ciLow, ciHigh] = primaryOption?.confidence_interval ?? [0, 0]
  const ciMid = (ciLow + ciHigh) / 2

  // Map drivers to V1 format
  // PLoT returns edge_sensitivity instead of drivers - use it as fallback
  const drivers = mapDriversFromResponse(v2Response)

  // Map critiques to V1 format
  const critique: CritiqueItemV1[] = (v2Response.critiques ?? []).map((c) => ({
    code: c.code,
    severity: mapCritiqueSeverity(c.severity),
    message: c.message,
    suggested_fix: c.suggestion,
    node_id: c.affected_nodes?.[0],
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
    option_probabilities: options.reduce(
      (acc, opt) => {
        const [low, high] = opt.confidence_interval ?? [0, 0]
        acc[opt.option_id] = {
          goal_probability: (low + high) / 2,
          confidence: 0.5, // Default confidence
        }
        return acc
      },
      {} as Record<string, { goal_probability: number; confidence: number }>
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
 * Map drivers from V2 response.
 * Uses edge_sensitivity when drivers array is empty (PLoT's actual format).
 */
function mapDriversFromResponse(v2Response: V2RunResponse): ReportV1['drivers'] {
  // If drivers exist, use them (backward compatibility)
  if (v2Response.drivers && v2Response.drivers.length > 0) {
    return v2Response.drivers.map((d) => ({
      label: d.label,
      polarity: d.direction === 'positive' ? 'up' as const : 'down' as const,
      strength: mapContributionToStrength(d.contribution),
    }))
  }

  // PLoT returns edge_sensitivity instead of drivers
  // Map top edge sensitivities to driver format
  const edgeSensitivity = v2Response.edge_sensitivity ?? []
  if (edgeSensitivity.length === 0) {
    return []
  }

  // Sort by importance_rank and take top entries
  const sortedEdges = [...edgeSensitivity].sort((a, b) => a.importance_rank - b.importance_rank)

  return sortedEdges.slice(0, 5).map((edge) => ({
    label: edge.interpretation || formatEdgeLabel(edge),
    polarity: edge.elasticity >= 0 ? 'up' as const : 'down' as const,
    strength: mapElasticityToStrength(Math.abs(edge.elasticity)),
    // Include edge metadata for highlighting
    edgeId: edge.edge_id,
    contribution: normalizeElasticity(edge.elasticity),
  }))
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
 */
export function createEnrichmentFromV2Response(v2Response: V2RunResponse): {
  sensitivity_analysis: {
    edges: Array<{ edge_id: string; elasticity: number; importance_rank: number }>
    factors: Array<{ factor_id: string; elasticity: number; importance_rank: number }>
  }
  metadata: {
    factor_sensitivity_status: 'available' | 'unavailable' | 'skipped'
  }
} | null {
  const edgeSensitivity = v2Response.edge_sensitivity ?? []
  const factorSensitivity = v2Response.factor_sensitivity ?? []

  // If no sensitivity data at all, return null
  if (edgeSensitivity.length === 0 && factorSensitivity.length === 0) {
    return null
  }

  // Map to enrichment format
  return {
    sensitivity_analysis: {
      edges: edgeSensitivity.map((e) => ({
        edge_id: e.edge_id,
        elasticity: e.elasticity,
        importance_rank: e.importance_rank,
      })),
      factors: factorSensitivity.map((f) => ({
        factor_id: f.factor_id,
        elasticity: f.elasticity,
        importance_rank: f.importance_rank,
      })),
    },
    metadata: {
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
