/**
 * V2 Response Mapper (P0-UI Integration)
 *
 * Maps V2RunResponse to ReportV1 format so existing UI components
 * continue to work while backend uses /v2/run.
 *
 * This is a transitional layer — eventually the UI should consume
 * V2 response format natively.
 */

import type { V2RunResponse, V2OptionResult, V2Driver, V2Critique } from './types'
import type { ReportV1, CritiqueItemV1, ConfidenceLevel } from '../types'

/**
 * Map V2RunResponse to ReportV1 format.
 *
 * Handles:
 * - Option results → results + bands
 * - Drivers → drivers array
 * - Critiques → critique array
 * - Robustness → confidence
 */
export function mapV2ResponseToReportV1(
  v2Response: V2RunResponse,
  meta: { seed: number; elapsed_ms?: number }
): ReportV1 {
  // Extract the first/best option for headline results
  const primaryOption = v2Response.options[0]
  const outcome = primaryOption?.outcome

  // Map drivers to V1 format
  const drivers = (v2Response.drivers ?? []).map((d) => ({
    label: d.label,
    polarity: d.direction === 'positive' ? 'up' as const : 'down' as const,
    strength: mapContributionToStrength(d.contribution),
  }))

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

  // Map robustness to confidence level
  const confidenceLevel = mapRobustnessToConfidence(v2Response.robustness?.level)

  return {
    schema: 'report.v1',
    meta: {
      seed: meta.seed,
      response_id: v2Response.response_hash,
      elapsed_ms: meta.elapsed_ms ?? 0,
    },
    model_card: {
      response_hash: v2Response.response_hash,
      response_hash_algo: 'sha256',
      normalized: true,
    },
    results: {
      conservative: outcome?.p10 ?? 0,
      likely: outcome?.p50 ?? 0,
      optimistic: outcome?.p90 ?? 0,
    },
    confidence: {
      level: confidenceLevel,
      why: v2Response.robustness
        ? `Robustness: ${v2Response.robustness.level} (${Math.round(v2Response.robustness.confidence * 100)}%)`
        : 'Based on available data',
    },
    drivers,
    run: {
      critique,
      bands: outcome ? {
        p10: outcome.p10,
        p50: outcome.p50,
        p90: outcome.p90,
      } : undefined,
    },
    // Map all options for comparison view
    option_probabilities: v2Response.options.reduce(
      (acc, opt) => {
        acc[opt.id] = {
          goal_probability: opt.outcome?.p50 ?? 0,
          confidence: v2Response.robustness?.confidence ?? 0.5,
        }
        return acc
      },
      {} as Record<string, { goal_probability: number; confidence: number }>
    ),
    // Include V2-specific data for components that can use it
    warnings: v2Response.critiques
      .filter(c => c.severity === 'warning' || c.severity === 'info')
      .map(c => c.message),
  }
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
 * Map robustness level to confidence level.
 */
function mapRobustnessToConfidence(level?: 'high' | 'medium' | 'low'): ConfidenceLevel {
  switch (level) {
    case 'high':
      return 'high'
    case 'medium':
      return 'medium'
    case 'low':
      return 'low'
    default:
      return 'medium'
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
