/**
 * assembleAnalysisInputsSummary — builds an AnalysisInputsSummary from a V2RunResponse.
 *
 * The UI is the sole production assembler. Only allow-listed fields are extracted.
 * Returns null if required fields are missing — never fabricates data.
 *
 * Size gate: serialised output must be ≤ 2048 bytes. Arrays are truncated
 * progressively if the payload exceeds the budget.
 */

import type { V2RunResponse, V2OptionComparison, V2Driver, V2RobustnessActual } from '../../adapters/plot/v2/types'
import type { AnalysisInputsSummary } from '../../types/analysis-inputs-summary'
import { ANALYSIS_INPUTS_CONTRACT_VERSION } from '../../types/analysis-inputs-summary'

const MAX_SERIALISED_BYTES = 2048
const MAX_TOP_DRIVERS = 3
const MAX_CONSTRAINTS = 5

/**
 * Assemble a structured analysis summary from a V2RunResponse.
 * Returns null if required fields are missing or assembly fails validation.
 */
export function assembleAnalysisInputsSummary(
  report: V2RunResponse,
): AnalysisInputsSummary | null {
  // Guard: option comparison must be computed with at least one option
  if (report.option_comparison_status !== 'computed') return null
  if (!Array.isArray(report.option_comparison) || report.option_comparison.length === 0) return null

  // Guard: robustness is a required field
  if (report.robustness_status !== 'computed' || !report.robustness) return null

  // Find recommendation: option with highest win_probability
  const recommendation = findRecommendation(report.option_comparison)
  if (!recommendation) return null

  // Map options — allowlist only
  const options = report.option_comparison.map(oc => ({
    id: oc.option_id,
    label: oc.option_label,
    win_probability: oc.win_probability ?? 0,
  }))

  // Top drivers — capped at MAX_TOP_DRIVERS
  const topDrivers = buildTopDrivers(report.drivers, MAX_TOP_DRIVERS)

  // Sensitivity concentration: ratio of top driver contribution to sum of all
  const sensitivityConcentration = computeSensitivityConcentration(report.drivers)

  // Confidence band — read from decision_quality if available.
  // If decision_quality provides a level, map it; otherwise derive from data availability.
  // (Derivation: computed robustness + drivers → 'medium'; otherwise 'low')
  const confidenceBand = deriveConfidenceBand(report)

  // Robustness
  const robustness = buildRobustness(report.robustness)

  // Constraints status — from first option's constraint_analysis
  const constraintsStatus = buildConstraintsStatus(report.option_comparison, MAX_CONSTRAINTS)

  // Run metadata — actual response fields only, no fabrication
  const runMetadata = {
    seed: report.meta?.seed_used ?? null,
    quality_mode: report.meta?.detail_level ?? null,
    timestamp: (report as Record<string, unknown>).completed_at as string | null ?? null,
  }

  let result: AnalysisInputsSummary = {
    contract_version: ANALYSIS_INPUTS_CONTRACT_VERSION,
    recommendation,
    options,
    top_drivers: topDrivers,
    sensitivity_concentration: sensitivityConcentration,
    confidence_band: confidenceBand,
    robustness,
    constraints_status: constraintsStatus,
    run_metadata: runMetadata,
  }

  // Size gate: progressively truncate if over budget
  result = enforceByteLimit(result)
  if (!result) return null

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function findRecommendation(
  comparisons: V2OptionComparison[],
): AnalysisInputsSummary['recommendation'] | null {
  let best: V2OptionComparison | null = null
  for (const oc of comparisons) {
    if (!best || (oc.win_probability ?? 0) > (best.win_probability ?? 0)) {
      best = oc
    }
  }
  if (!best) return null
  return {
    option_id: best.option_id,
    option_label: best.option_label,
    win_probability: best.win_probability ?? 0,
  }
}

function buildTopDrivers(
  drivers: V2Driver[] | undefined,
  max: number,
): AnalysisInputsSummary['top_drivers'] {
  if (!drivers || drivers.length === 0) return []
  return drivers.slice(0, max).map(d => ({
    factor_id: d.node_id,
    factor_label: d.label,
    elasticity: d.contribution,
  }))
}

function computeSensitivityConcentration(drivers: V2Driver[] | undefined): number {
  if (!drivers || drivers.length === 0) return 0
  const total = drivers.reduce((sum, d) => sum + Math.abs(d.contribution), 0)
  if (total === 0) return 0
  const topContribution = Math.abs(drivers[0].contribution)
  return Math.round((topContribution / total) * 1000) / 1000 // 3 decimal places
}

function deriveConfidenceBand(report: V2RunResponse): AnalysisInputsSummary['confidence_band'] {
  // Prefer CEE-provided decision quality level when available
  const dq = report.decision_quality
  if (dq && typeof dq === 'object' && 'overall' in dq) {
    const overall = (dq as Record<string, unknown>).overall
    if (typeof overall === 'string') {
      if (overall === 'strong' || overall === 'high') return 'high'
      if (overall === 'adequate' || overall === 'medium' || overall === 'moderate') return 'medium'
      return 'low'
    }
  }
  // Fallback: computed robustness + drivers available → medium; else low
  if (report.robustness_status === 'computed' && report.drivers_status === 'computed') {
    return 'medium'
  }
  return 'low'
}

function buildRobustness(
  robustness: V2RobustnessActual,
): AnalysisInputsSummary['robustness'] {
  const stability = robustness.recommendation_stability ?? robustness.ranking_stability ?? 0
  let level: 'robust' | 'moderate' | 'fragile'
  if (stability >= 0.7) level = 'robust'
  else if (stability >= 0.4) level = 'moderate'
  else level = 'fragile'
  return { level, recommendation_stability: stability }
}

function buildConstraintsStatus(
  comparisons: V2OptionComparison[],
  max: number,
): AnalysisInputsSummary['constraints_status'] {
  // Extract from first option's constraint_analysis if available
  const firstWithConstraints = comparisons.find(oc => oc.constraint_analysis)
  if (!firstWithConstraints?.constraint_analysis) return []

  const ca = firstWithConstraints.constraint_analysis
  const constraints = Array.isArray(ca.constraints) ? ca.constraints : []
  return constraints.slice(0, max).map(c => ({
    label: c.label ?? 'unknown',
    satisfied: c.prob_satisfied >= 0.5,
    ...(c.prob_satisfied != null ? { probability: c.prob_satisfied } : {}),
  }))
}

function enforceByteLimit(result: AnalysisInputsSummary): AnalysisInputsSummary | null {
  let current = result

  // Round 1: already under limit?
  if (measureBytes(current) <= MAX_SERIALISED_BYTES) return current

  // Round 2: truncate top_drivers to 2
  current = { ...current, top_drivers: current.top_drivers.slice(0, 2) }
  if (measureBytes(current) <= MAX_SERIALISED_BYTES) return current

  // Round 3: truncate top_drivers to 1
  current = { ...current, top_drivers: current.top_drivers.slice(0, 1) }
  if (measureBytes(current) <= MAX_SERIALISED_BYTES) return current

  // Round 4: empty top_drivers and constraints_status
  current = { ...current, top_drivers: [], constraints_status: [] }
  if (measureBytes(current) <= MAX_SERIALISED_BYTES) return current

  // Round 5: still too big — cannot assemble a valid summary
  if (import.meta.env.DEV) {
    console.warn('[assembleAnalysisInputsSummary] Payload exceeds 2KB after all truncation:', measureBytes(current))
  }
  return null
}

function measureBytes(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length
}
