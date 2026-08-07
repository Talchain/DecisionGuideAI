/**
 * assembleAnalysisInputsSummary — builds an AnalysisInputsSummary from a V2RunResponse.
 *
 * The UI is the sole production assembler. Only allow-listed fields are extracted.
 * Returns null if required fields are missing — never fabricates data.
 *
 * Size gate: serialised output must be ≤ 2048 bytes. Arrays are truncated
 * progressively if the payload exceeds the budget.
 */

import type { V2RunResponse, V2OptionComparison, V2FactorSensitivity, V2RobustnessActual } from '../../adapters/plot/v2/types'
import type { AnalysisInputsSummary } from '../../types/analysis-inputs-summary'
import { ANALYSIS_INPUTS_CONTRACT_VERSION } from '../../types/analysis-inputs-summary'
import { normaliseFactorFields } from '../../lib/mappers/mapFactorSensitivity'

const MAX_SERIALISED_BYTES = 2048
const MAX_TOP_DRIVERS = 3
const MAX_CONSTRAINTS = 5

/**
 * Assemble a structured analysis summary from a V2RunResponse.
 *
 * Returns null (never fabricates) when:
 *   - option_comparison_status is not 'computed', or no options are present
 *   - no option has a win_probability (cannot determine recommendation)
 *   - robustness_status is not 'computed', robustness is absent, or neither
 *     recommendation_stability nor ranking_stability is present
 *   - serialised output exceeds 2048 bytes after full progressive truncation
 */
export function assembleAnalysisInputsSummary(
  report: V2RunResponse,
): AnalysisInputsSummary | null {
  // Guard: option comparison must be computed with at least one option
  if (report.option_comparison_status !== 'computed') return null
  if (!Array.isArray(report.option_comparison) || report.option_comparison.length === 0) return null

  // Robustness: optional — when PLoT doesn't compute robustness (e.g. simple models),
  // we still assemble the summary so CEE gets analysis context for post-analysis conversation.
  const hasRobustness = report.robustness_status === 'computed' && !!report.robustness

  // Filter to options with an actual win_probability once — shared by both
  // recommendation selection and options list. Never fabricate 0.
  const comparisonsWithProb = report.option_comparison.filter(oc => oc.win_probability != null)
  if (comparisonsWithProb.length === 0) return null

  // Find recommendation: option with highest win_probability
  const recommendation = findRecommendation(comparisonsWithProb)
  if (!recommendation) return null

  // Map options — allowlist only. Same pre-filtered array as recommendation so
  // recommendation.option_id is guaranteed to appear in options[].
  const options = comparisonsWithProb.map(oc => ({
    id: oc.option_id,
    label: oc.option_label,
    win_probability: oc.win_probability as number,
  }))

  // Top drivers — capped at MAX_TOP_DRIVERS. ROADMAP 1.30b: the V2 wire
  // never populates the legacy `drivers[]` field (verified against the
  // captured staging fixture — `drivers: null` while `factor_sensitivity[]`
  // carries real data); `factor_sensitivity` is the field
  // useResultsSectionData.ts already treats as the authoritative PLoT v2
  // driver source.
  const topDrivers = buildTopDrivers(report.factor_sensitivity, MAX_TOP_DRIVERS)

  // Sensitivity concentration: ratio of top driver magnitude to sum of all
  const sensitivityConcentration = computeSensitivityConcentration(report.factor_sensitivity)

  // Confidence band — read from decision_quality if available.
  // If decision_quality provides a level, map it; otherwise derive from data availability.
  // (Derivation: computed robustness + drivers → 'medium'; otherwise 'low')
  const confidenceBand = deriveConfidenceBand(report)

  // Robustness — null when not computed or neither stability field is present
  const robustness = hasRobustness ? buildRobustness(report.robustness) : null

  // Constraints status — from first option's constraint_analysis
  const constraintsStatus = buildConstraintsStatus(report.option_comparison, MAX_CONSTRAINTS)

  // Run metadata — actual response fields only, no fabrication. ROADMAP
  // 1.30b: the V2 wire has no top-level `completed_at` — the real field is
  // nested at `meta.computed_at` (confirmed against the captured staging
  // fixture's `plot_response.meta.computed_at`; now typed on V2Meta).
  const runMetadata = {
    seed: report.meta?.seed_used ?? null,
    quality_mode: report.meta?.detail_level ?? null,
    timestamp: report.meta?.computed_at ?? null,
  }

  let result: AnalysisInputsSummary = {
    contract_version: ANALYSIS_INPUTS_CONTRACT_VERSION,
    recommendation,
    options,
    top_drivers: topDrivers,
    sensitivity_concentration: sensitivityConcentration,
    confidence_band: confidenceBand,
    ...(robustness ? { robustness } : {}),
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
  // Caller guarantees comparisons is pre-filtered to options with win_probability != null.
  if (comparisons.length === 0) return null
  let best = comparisons[0]
  for (const oc of comparisons.slice(1)) {
    if ((oc.win_probability as number) > (best.win_probability as number)) {
      best = oc
    }
  }
  return {
    option_id: best.option_id,
    option_label: best.option_label,
    win_probability: best.win_probability as number,
  }
}

/** Magnitude precedence mirrors normalizeFactorSensitivity (useResultsSectionData.ts):
 *  elasticity > sensitivity_score > sensitivity > importance_score > 0. */
function factorMagnitude(fs: V2FactorSensitivity): number {
  if (typeof fs.elasticity === 'number') return fs.elasticity
  if (typeof fs.sensitivity_score === 'number') return fs.sensitivity_score
  if (typeof fs.sensitivity === 'number') return fs.sensitivity
  if (typeof fs.importance_score === 'number') return fs.importance_score
  return 0
}

function buildTopDrivers(
  factorSensitivity: V2FactorSensitivity[] | undefined,
  max: number,
): AnalysisInputsSummary['top_drivers'] {
  if (!factorSensitivity || factorSensitivity.length === 0) return []
  return factorSensitivity
    .map(fs => {
      const { node_id, label } = normaliseFactorFields(fs as unknown as Record<string, unknown>)
      return { factor_id: node_id ?? '', factor_label: label ?? '', elasticity: factorMagnitude(fs) }
    })
    .filter(d => d.factor_id !== '')
    .sort((a, b) => Math.abs(b.elasticity) - Math.abs(a.elasticity))
    .slice(0, max)
}

function computeSensitivityConcentration(factorSensitivity: V2FactorSensitivity[] | undefined): number {
  if (!factorSensitivity || factorSensitivity.length === 0) return 0
  const magnitudes = factorSensitivity.map(fs => Math.abs(factorMagnitude(fs)))
  const total = magnitudes.reduce((sum, m) => sum + m, 0)
  if (total === 0) return 0
  const topMagnitude = Math.max(...magnitudes)
  return Math.round((topMagnitude / total) * 1000) / 1000 // 3 decimal places
}

function deriveConfidenceBand(report: V2RunResponse): AnalysisInputsSummary['confidence_band'] {
  // Prefer CEE-provided decision quality level when available. ROADMAP
  // 1.30b: the real field is `decision_quality.level` (DecisionQualityV3 in
  // types/cee.ts: 'ready' | 'caution' | 'not_ready') — the prior read
  // checked a non-existent `.overall`, so this branch never fired on any
  // real response.
  const dq = report.decision_quality
  if (dq && typeof dq === 'object' && 'level' in dq) {
    const level = (dq as Record<string, unknown>).level
    if (level === 'ready') return 'high'
    if (level === 'caution') return 'medium'
    if (level === 'not_ready') return 'low'
  }
  // Fallback: computed robustness + drivers available → medium; else low
  if (report.robustness_status === 'computed' && report.drivers_status === 'computed') {
    return 'medium'
  }
  return 'low'
}

function buildRobustness(
  robustness: V2RobustnessActual,
): AnalysisInputsSummary['robustness'] | null {
  // recommendation_stability is preferred; ranking_stability is a legitimate alias.
  // If neither is present, return null rather than fabricating 0.
  const stability = robustness.recommendation_stability ?? robustness.ranking_stability
  if (stability == null) return null
  // Science UX Architecture v2 §4.2 thresholds
  let level: 'robust' | 'moderate' | 'fragile'
  if (stability >= 0.85) level = 'robust'
  else if (stability >= 0.70) level = 'moderate'
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
  return constraints
    .filter(c => c.label != null && c.label !== '')
    .slice(0, max)
    .map(c => ({
      label: c.label,
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
