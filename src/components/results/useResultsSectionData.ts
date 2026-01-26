/**
 * useResultsSectionData Hook
 *
 * Transforms V2RunResponse and canvas store data into section-specific data structures
 * for the redesigned Results Panel components.
 *
 * Implements "coaching over gates" philosophy:
 * - Dynamic normalisation for driver influence
 * - Semantic labels (rank-based top, threshold rest)
 * - Direction derived from edges with normalisation
 * - Confidence tier with full fallback chain
 * - Merged improvements with deduplication
 */

import { useMemo } from 'react'
import { safeArray } from '../../lib/array-utils'
import { useCanvasStore } from '../../canvas/store'
import { useShallow } from 'zustand/react/shallow'
import { findNodeMatches, type Driver } from '../../canvas/utils/driverMatching'
import type { Node } from '@xyflow/react'
import type {
  RecommendationSectionData,
  DriversSectionData,
  ConfidenceSectionData,
  ImprovementsSectionData,
  OptionResult,
  DriverItem,
  UncertaintyItem,
  ImprovementItem,
  DriverSemanticLabel,
  DriverDirection,
  ConfidenceTier,
  RawFactorSensitivity,
  UiFactorSensitivity,
  EdgeForDirection,
  CritiqueSeverity,
  FlipRiskCategory,
  WinnerDeterminedBy,
  RobustnessLevel,
  RobustnessLabel,
} from './types'

// =============================================================================
// Winner Selection Helper
// =============================================================================

export function determineWinnerSelection(
  options: OptionResult[],
  backendRecommendedId?: string | null
): { recommendedId: string | null; determinedBy: WinnerDeterminedBy } {
  if (options.length === 0) {
    return { recommendedId: null, determinedBy: 'unknown' }
  }

  if (backendRecommendedId) {
    const backendOption = options.find(opt => opt.id === backendRecommendedId)
    if (backendOption?.winProbability != null) {
      return { recommendedId: backendRecommendedId, determinedBy: 'win_probability' }
    }
    if (backendOption?.expected != null || backendOption?.p50 != null) {
      return { recommendedId: backendRecommendedId, determinedBy: 'expected_outcome' }
    }
    return { recommendedId: backendRecommendedId, determinedBy: 'unknown' }
  }

  const optionsWithWinProbability = options.filter(
    opt => typeof opt.winProbability === 'number'
  )
  const hasCompleteWinProbabilityCoverage =
    optionsWithWinProbability.length > 0 &&
    optionsWithWinProbability.length === options.length

  if (hasCompleteWinProbabilityCoverage) {
    const winnerByProb = [...optionsWithWinProbability]
      .sort((a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0))[0]
    return {
      recommendedId: winnerByProb?.id ?? null,
      determinedBy: 'win_probability',
    }
  }

  // Task 2.4: Deterministic tie-breaker when no backend recommendation
  // Priority: p50 (higher wins) > mean (higher wins) > option_id (alphabetical)
  const winnerByExpected = [...options]
    .sort((a, b) => {
      // 1. p50 (higher wins)
      const aP50 = a.outcome?.p50 ?? a.p50 ?? -Infinity
      const bP50 = b.outcome?.p50 ?? b.p50 ?? -Infinity
      if (aP50 !== bP50) return bP50 - aP50

      // 2. mean/expected (higher wins)
      const aMean = a.expected ?? a.outcome?.mean ?? a.goalProbability ?? -Infinity
      const bMean = b.expected ?? b.outcome?.mean ?? b.goalProbability ?? -Infinity
      if (aMean !== bMean) return bMean - aMean

      // 3. option_id (alphabetical)
      return a.id.localeCompare(b.id)
    })[0]

  return {
    recommendedId: winnerByExpected?.id ?? null,
    determinedBy: 'expected_outcome',
  }
}

// =============================================================================
// Factor Key Derivation (CRITICAL: Standardisation)
// =============================================================================

/**
 * Normalise label to a key format (lowercase, underscores)
 */
function normaliseLabel(label: string | undefined): string {
  return label?.toLowerCase().replace(/\s+/g, '_') ?? 'unknown'
}

/**
 * Normalise critique severity to typed value.
 * Handles both uppercase (BLOCKER) and lowercase (blocker) inputs.
 */
function normaliseSeverity(severity: string | undefined): CritiqueSeverity {
  const normalised = severity?.toLowerCase()
  if (normalised === 'blocker') return 'blocker'
  if (normalised === 'error') return 'error'
  if (normalised === 'info') return 'info'
  return 'warning' // Default
}

/**
 * Get canonical factor key from various ID fields.
 * Priority: factor_id > node_id > id > normalised(label)
 * Note: PLoT uses factor_id as the canonical field name.
 */
function getFactorKey(factor: RawFactorSensitivity | UiFactorSensitivity, index: number): string {
  if ('factorId' in factor && factor.factorId) return factor.factorId
  if ('factor_id' in factor && factor.factor_id) return factor.factor_id
  if ('node_id' in factor && factor.node_id) return factor.node_id
  if ('id' in factor && factor.id) return factor.id
  if (factor.label) return normaliseLabel(factor.label)
  // Fallback: generate unique key using index
  return `factor_${index}`
}

// =============================================================================
// Raw Elasticity Extraction (CRITICAL: Fallback Chain)
// =============================================================================

/**
 * Safely extract a numeric value if it's a finite number.
 */
function safeFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && isFinite(value) ? value : null
}

/**
 * Extract raw elasticity with fallback chain.
 *
 * ============================================================================
 * FACTOR INFLUENCE CONTRACT (M0)
 * ============================================================================
 *
 * Fallback priority for factor influence value:
 * 1. elasticity (if present and finite)
 * 2. sensitivity_score (if present, finite, AND not a placeholder zero)
 *    - EXCEPTION: Skip if sensitivity_score=0 but importance_score > 0 (P0 Fix)
 * 3. sensitivity (if present and finite)
 * 4. importance_score (if present and > 0)
 * 5. contribution (legacy, if present)
 * 6. 0 (default)
 *
 * CRITICAL: The responseMapper MUST preserve importance_score from ISL response.
 * If importance_score is dropped during mapping, factors will show 0% influence.
 *
 * See: responseMapper.ts pickFactorSensitivityForUi() for upstream contract.
 * Contract tests: src/test/integration/results-panel-contract.test.ts
 */
function getRawElasticity(factor: RawFactorSensitivity | UiFactorSensitivity): number {
  // Type-safe access to known fields
  const f = factor as Record<string, unknown>

  // Priority chain: prefer more specific fields first
  const elasticity = safeFiniteNumber(f.elasticity)
  if (elasticity !== null) return elasticity

  // P0 Fix: Check importance_score early to handle "0 blocks fallback" edge case
  // If sensitivity_score is 0 but importance_score > 0, prefer importance_score
  const importanceScore = safeFiniteNumber(f.importance_score)

  const sensitivityScore = safeFiniteNumber(f.sensitivity_score)
  // Skip sensitivity_score if it's 0 but importance_score has real data
  if (sensitivityScore !== null && (sensitivityScore !== 0 || importanceScore === null || importanceScore <= 0)) {
    return sensitivityScore
  }

  const sensitivity = safeFiniteNumber(f.sensitivity)
  if (sensitivity !== null) return sensitivity

  // importance_score only if > 0 (avoid placeholder zeros)
  if (importanceScore !== null && importanceScore > 0) return importanceScore

  // Legacy fallback
  const contribution = safeFiniteNumber(f.contribution)
  if (contribution !== null) return contribution

  return 0
}

function normalizeFactorSensitivity(raw: unknown, nodeLabelMap: Map<string, string>): UiFactorSensitivity {
  const typed = (raw ?? {}) as Record<string, any>
  const rawId = typed.factor_id ?? typed.node_id ?? typed.id
  const labelFromNodes = rawId ? nodeLabelMap.get(rawId) : undefined
  const label = typed.label ?? typed.node_label ?? labelFromNodes ?? rawId ?? 'Unknown factor'
  const elasticity =
    typeof typed.elasticity === 'number' ? typed.elasticity
      : typeof typed.sensitivity_score === 'number' ? typed.sensitivity_score
        : typeof typed.sensitivity === 'number' ? typed.sensitivity
          : typeof typed.importance_score === 'number' ? typed.importance_score
            : 0
  // Confidence in factor's influence (0-1) - separate from value_of_information
  const confidence = typeof typed.confidence === 'number'
    ? typed.confidence
    : null
  const direction = typed.direction
    ? (String(typed.direction).toLowerCase() === 'negative' ? 'negative' : 'positive')
    : elasticity >= 0 ? 'positive' : 'negative'

  // ISL influence_score (0-1) - structural causal influence
  const influenceScore = typeof typed.influence_score === 'number' ? typed.influence_score : undefined

  // ISL zero_reason - explains why sensitivity is zero for intervention factors
  const zeroReason = typed.zero_reason as UiFactorSensitivity['zeroReason']

  // ISL value_of_information (0-1) - whether gathering more data could change the decision
  // Support both snake_case (from PLoT) and camelCase (from UI-side transforms)
  const valueOfInformation = typeof typed.value_of_information === 'number'
    ? typed.value_of_information
    : typeof typed.valueOfInformation === 'number'
      ? typed.valueOfInformation
      : undefined

  // PLoT flip_risk_category - how this factor contributes to decision uncertainty
  // Support both snake_case (from PLoT) and camelCase (from UI-side transforms)
  const rawFlipRiskCategory = typed.flip_risk_category ?? typed.flipRiskCategory
  const flipRiskCategory: FlipRiskCategory | undefined =
    rawFlipRiskCategory === 'isolated' || rawFlipRiskCategory === 'correlated' || rawFlipRiskCategory === 'negligible'
      ? rawFlipRiskCategory
      : undefined

  return {
    factorId: rawId ?? label,
    label,
    elasticity,
    direction,
    confidence,
    importanceRank: typeof typed.importance_rank === 'number' ? typed.importance_rank : 0,
    influenceScore,
    zeroReason,
    valueOfInformation,
    flipRiskCategory,
  }
}

// =============================================================================
// Dynamic Normalisation (CRITICAL: Fix for arbitrary div-by-2)
// =============================================================================

/**
 * Compute dynamically normalised influence for all factors.
 * Returns map of factorKey -> normalisedInfluence (0-1)
 *
 * When real elasticity data exists: top factor = 100%, others proportional.
 * When NO real elasticity data (all ~0): returns all 0 - UI uses hasMagnitudeData
 * flag to show direction-only view instead.
 */
function computeNormalisedInfluences(
  factors: Array<{ key: string; rawElasticity: number }>
): Map<string, number> {
  const result = new Map<string, number>()

  if (factors.length === 0) {
    return result
  }

  // Extract absolute values
  const absoluteValues = factors.map(f => Math.abs(f.rawElasticity))
  const actualMax = Math.max(...absoluteValues)

  // If no meaningful elasticity data, set all to 0
  // The hasMagnitudeData flag will trigger direction-only display
  if (actualMax < 0.001) {
    factors.forEach(f => result.set(f.key, 0))
    return result
  }

  // Normalise each factor relative to the max (top = 100%, others proportional)
  factors.forEach(f => {
    const normalised = Math.min(1, Math.abs(f.rawElasticity) / actualMax)
    result.set(f.key, normalised)
  })

  return result
}

// =============================================================================
// Factor Rank Computation (CRITICAL: Single-Pass with Map)
// =============================================================================

/**
 * Compute ranks for all factors based on absolute elasticity.
 * Returns map of factorKey -> rank (1-indexed)
 */
function computeFactorRanks(
  factors: Array<{ key: string; rawElasticity: number; importanceRank?: number; label?: string }>
): Map<string, number> {
  // Sort by absolute elasticity descending with tie-breakers
  const sorted = [...factors].sort((a, b) => {
    const aVal = Math.abs(a.rawElasticity)
    const bVal = Math.abs(b.rawElasticity)

    // Primary: higher elasticity first
    if (bVal !== aVal) return bVal - aVal

    // Tie-breaker 1: importance_rank (lower = more important)
    const aRank = a.importanceRank ?? Infinity
    const bRank = b.importanceRank ?? Infinity
    if (aRank !== bRank) return aRank - bRank

    // Tie-breaker 2: label alphabetical
    return (a.label ?? '').localeCompare(b.label ?? '')
  })

  // Build rank map in single pass
  const rankMap = new Map<string, number>()
  sorted.forEach((factor, index) => {
    rankMap.set(factor.key, index + 1) // 1-indexed
  })

  return rankMap
}

// =============================================================================
// Outcome Normalisation (CRITICAL: No magnitude-based scaling)
// =============================================================================

function normalizeOutcomeValues(
  rawP10: number | null | undefined,
  rawExpected: number | null | undefined,
  rawP50: number | null | undefined,
  rawP90: number | null | undefined
): { p10: number | null; expected: number | null; p50: number | null; p90: number | null } {
  let p10 = rawP10 ?? null
  let expected = rawExpected ?? null
  let p50 = rawP50 ?? null
  let p90 = rawP90 ?? null

  const numericValues = [p10, expected, p50, p90].filter(
    (value): value is number => typeof value === 'number' && isFinite(value)
  )
  if (numericValues.length === 0) {
    return { p10: null, expected: null, p50: null, p90: null }
  }

  // Sanity check: ensure proper ordering for percentiles (p10 <= p50 <= p90)
  if (p10 !== null && p50 !== null && p90 !== null && (p10 > p50 || p50 > p90 || p10 > p90)) {
    if (import.meta.env.DEV) {
      console.warn('[Results] Percentile ordering violated - reordering:', { p10, p50, p90 })
    }
    const sorted = [p10, p50, p90].sort((a, b) => a - b)
    p10 = sorted[0]
    p50 = sorted[1]
    p90 = sorted[2]
  }

  return { p10, expected, p50, p90 }
}

// =============================================================================
// Direction Normalisation (CRITICAL)
// =============================================================================

/**
 * Normalise direction variants to canonical enum.
 */
function normaliseDirection(direction: string | undefined): DriverDirection | undefined {
  if (!direction) return undefined

  const normalised = String(direction).toLowerCase().trim()

  // Positive variants
  if (['positive', 'increases', '+', 'increase', 'up'].includes(normalised)) {
    return 'positive'
  }

  // Negative variants
  if (['negative', 'decreases', '-', 'decrease', 'down'].includes(normalised)) {
    return 'negative'
  }

  return undefined
}

/**
 * Get edge source key (handles 'source' or 'from' aliases)
 */
function getEdgeSourceKey(edge: EdgeForDirection): string | undefined {
  return edge.source ?? edge.from ?? undefined
}

/**
 * Get edge target key (handles 'target' or 'to' aliases)
 */
function getEdgeTargetKey(edge: EdgeForDirection): string | undefined {
  return edge.target ?? edge.to ?? undefined
}

/**
 * Derive factor direction from API response, with canvas edges as fallback.
 *
 * Priority (P0 Fix):
 *   1. API factor_sensitivity.direction — authoritative from analysis engine
 *   2. Canvas edge to goal — fallback when API direction unavailable
 *   3. Canvas edge to any outcome — secondary fallback
 *
 * This ensures the API's computed direction (which accounts for actual model
 * sensitivity analysis) takes precedence over static canvas edge metadata.
 */
function getFactorDirection(
  factorKey: string,
  edges: EdgeForDirection[],
  goalNodeId: string | undefined,
  outcomeNodeIds: string[],
  factorDirection?: string
): DriverDirection | undefined {
  // 1. API factor_sensitivity.direction (PRIMARY SOURCE)
  // The analysis engine computes direction based on sensitivity analysis,
  // which is more accurate than static canvas edge metadata.
  if (factorDirection) {
    return normaliseDirection(factorDirection)
  }

  // 2. Canvas edge to goal (FALLBACK when API direction unavailable)
  if (goalNodeId) {
    const goalEdge = edges.find(
      e => getEdgeSourceKey(e) === factorKey && getEdgeTargetKey(e) === goalNodeId
    )
    if (goalEdge) {
      return normaliseDirection(goalEdge.effect_direction ?? goalEdge.direction)
    }
  }

  // 3. Canvas edge to any outcome (deterministic: sort by target ID, take first)
  const outcomeEdges = edges
    .filter(e => getEdgeSourceKey(e) === factorKey && outcomeNodeIds.includes(getEdgeTargetKey(e) ?? ''))
    .sort((a, b) => (getEdgeTargetKey(a) ?? '').localeCompare(getEdgeTargetKey(b) ?? ''))

  if (outcomeEdges.length > 0) {
    return normaliseDirection(outcomeEdges[0].effect_direction ?? outcomeEdges[0].direction)
  }

  // 4. No direction available
  return undefined
}

// =============================================================================
// Semantic Label Assignment (CRITICAL: Rank-based for top, threshold for rest)
// =============================================================================

/**
 * Get semantic label for a driver.
 * Rank 1 always gets "biggest" (ensures uniqueness).
 * Ranks 2+ use threshold-based labels.
 */
function getSemanticLabel(rank: number, normalisedValue: number): DriverSemanticLabel {
  // Rank 1 always gets "Biggest factor"
  if (rank === 1) return 'biggest'

  // Ranks 2+ use threshold-based labels
  if (normalisedValue >= 0.50) return 'strong'
  if (normalisedValue >= 0.20) return 'moderate'
  return 'minor'
}

// =============================================================================
// Confidence Tier Derivation (CRITICAL: Full Fallback Chain)
// =============================================================================

/**
 * Map readiness level to confidence tier.
 */
function mapReadinessLevel(level: string): ConfidenceTier {
  const mapping: Record<string, ConfidenceTier> = {
    ready: 'strong',
    fair: 'fair',
    needs_work: 'needs_work',
    caution: 'fair',
    not_ready: 'needs_work',
  }
  return mapping[level.toLowerCase()] ?? 'unknown'
}

/**
 * Map confidence level to tier.
 */
function mapConfidenceLevel(level: string): ConfidenceTier {
  const normalised = String(level).toLowerCase().trim()
  const mapping: Record<string, ConfidenceTier> = {
    strong: 'strong',
    high: 'strong',
    fair: 'fair',
    medium: 'fair',
    needs_work: 'needs_work',
    low: 'needs_work',
  }
  return mapping[normalised] ?? 'unknown'
}

/**
 * Get confidence tier with full fallback chain.
 * Priority: Graph readiness level > readiness score > report confidence > graph quality score
 */
function getConfidenceTier(
  graphReadiness: { readiness_level?: string; readiness_score?: number } | undefined,
  report: { confidence?: { level?: string }; graph_quality?: { score?: number } } | undefined
): ConfidenceTier {
  // 1. Primary: Graph readiness readiness_level
  if (graphReadiness?.readiness_level) {
    return mapReadinessLevel(graphReadiness.readiness_level)
  }

  // 2. Fallback: Graph readiness readiness_score (0-100)
  if (typeof graphReadiness?.readiness_score === 'number') {
    if (graphReadiness.readiness_score >= 70) return 'strong'
    if (graphReadiness.readiness_score >= 40) return 'fair'
    return 'needs_work'
  }

  // 3. Fallback: report.confidence.level
  if (report?.confidence?.level) {
    return mapConfidenceLevel(report.confidence.level)
  }

  // 4. Last resort: report.graph_quality.score (0-100)
  if (typeof report?.graph_quality?.score === 'number') {
    if (report.graph_quality.score >= 70) return 'strong'
    if (report.graph_quality.score >= 40) return 'fair'
    return 'needs_work'
  }

  return 'unknown'
}

// =============================================================================
// Improvements Normalisation (CRITICAL: Merge and Dedupe)
// =============================================================================

interface RawBiasFinding {
  explanation?: string
  micro_intervention?: { steps?: string[] }
  estimated_minutes?: number
}

interface RawQualityFactor {
  factor?: string
  recommendation?: string
  potential_improvement?: string
}

interface RawImprovementGuidance {
  action?: string
  reason?: string
  priority?: number
}

/**
 * Normalise improvements from three sources with priority ordering.
 */
function normaliseImprovements(
  biasFindings: RawBiasFinding[] | undefined,
  qualityFactors: RawQualityFactor[] | undefined,
  improvementGuidance: RawImprovementGuidance[] | undefined
): ImprovementItem[] {
  const improvements: ImprovementItem[] = []

  // 1. Bias findings (highest priority)
  biasFindings?.forEach(b => {
    const action = b.micro_intervention?.steps?.[0] ?? b.explanation
    if (action) {
      improvements.push({
        action,
        reason: b.explanation ?? '',
        priority: 1,
        source: 'bias',
        effortMinutes: b.estimated_minutes,
      })
    }
  })

  // 2. Quality factors (medium priority)
  qualityFactors?.forEach(q => {
    if (q.recommendation) {
      improvements.push({
        action: q.recommendation,
        reason: q.factor ?? '',
        priority: 2,
        source: 'quality_factor',
        potentialImprovement: q.potential_improvement,
      })
    }
  })

  // 3. Improvement guidance (lower priority, unless explicit priority given)
  improvementGuidance?.forEach(g => {
    if (g.action) {
      improvements.push({
        action: g.action,
        reason: g.reason ?? '',
        priority: g.priority ?? 3,
        source: 'improvement_guidance',
      })
    }
  })

  // Dedupe by action (case-insensitive), keep highest priority
  const seen = new Map<string, ImprovementItem>()
  improvements.forEach(imp => {
    const key = imp.action?.toLowerCase()?.trim()
    if (!key) return
    if (!seen.has(key) || (seen.get(key)?.priority ?? Infinity) > imp.priority) {
      seen.set(key, imp)
    }
  })

  // Sort by priority ascending (lower = more important)
  return Array.from(seen.values()).sort((a, b) => a.priority - b.priority)
}

// =============================================================================
// Main Hook
// =============================================================================

export interface ResultsSectionDataReturn {
  recommendation: RecommendationSectionData
  drivers: DriversSectionData
  confidence: ConfidenceSectionData
  improvements: ImprovementsSectionData
  isLoading: boolean
  isError: boolean
  goalLabel: string
  goalNodeId?: string
}

export function useResultsSectionData(): ResultsSectionDataReturn {
  const {
    results,
    runMeta,
    nodes,
    edges,
    hasCompletedFirstRun,
    currentScenarioFraming,
  } = useCanvasStore(
    useShallow((s) => ({
      results: s.results,
      runMeta: s.runMeta,
      nodes: s.nodes,
      edges: s.edges,
      hasCompletedFirstRun: s.hasCompletedFirstRun,
      currentScenarioFraming: (s as any).currentScenarioFraming,
    }))
  )

  const report = results?.report
  const resultsStatus = results?.status

  const isLoading = resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'
  const isError = resultsStatus === 'error'

  // Find goal node for label and click-to-focus
  const goalNode = useMemo(
    () => nodes.find((n) => n.type === 'goal' || (n.data as any)?.kind === 'goal'),
    [nodes]
  )

  // Goal label fallback chain: framing > node label > default
  const goalLabel = useMemo(() => {
    if (currentScenarioFraming?.goal) return currentScenarioFraming.goal
    if (goalNode?.data && typeof (goalNode.data as any).label === 'string') {
      return (goalNode.data as any).label
    }
    return 'your goal'
  }, [currentScenarioFraming, goalNode])

  const goalNodeId = goalNode?.id

  // Extract outcome unit from goal node for proper formatting (Issue 5 fix)
  // The goal node's observed_state.unit tells us whether values are currency, percent, or count
  const { outcomeUnit, outcomeUnitSymbol } = useMemo(() => {
    const observedState = (goalNode?.data as any)?.observedState ?? (goalNode?.data as any)?.observed_state
    const rawUnit = observedState?.unit

    if (!rawUnit) return { outcomeUnit: undefined, outcomeUnitSymbol: undefined }

    const unitLower = String(rawUnit).toLowerCase()

    // Percentage variants
    if (unitLower === '%' || unitLower === 'percent' || unitLower === 'percentage') {
      return { outcomeUnit: 'percent' as const, outcomeUnitSymbol: undefined }
    }

    // Currency variants - detect symbol and normalize
    if (['$', '£', '€', 'usd', 'gbp', 'eur', 'dollar', 'pound', 'euro'].some(c => unitLower.includes(c))) {
      const symbol = String(rawUnit).match(/[$£€]/)?.[0] ?? '$'
      return { outcomeUnit: 'currency' as const, outcomeUnitSymbol: symbol }
    }

    // Default to count for numeric units (users, items, etc.)
    return { outcomeUnit: 'count' as const, outcomeUnitSymbol: undefined }
  }, [goalNode])

  const nodeLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    nodes.forEach((node) => {
      const label = (node.data as any)?.label
      if (typeof label === 'string' && label.trim().length > 0) {
        map.set(node.id, label)
      }
    })
    return map
  }, [nodes])

  // Get outcome node IDs for direction derivation
  const outcomeNodeIds = useMemo(
    () => nodes
      .filter(n => n.type === 'outcome' || (n.data as any)?.kind === 'outcome')
      .map(n => n.id),
    [nodes]
  )

  // ==========================================================================
  // Recommendation Section Data
  // ==========================================================================
  const recommendation = useMemo<RecommendationSectionData>(() => {
    if (!hasCompletedFirstRun || !report) {
      return {
        recommendedOption: null,
        allOptions: [],
        goalLabel,
        goalNodeId,
        isSingleOption: true,
        analysisStatus: 'computed',
      }
    }

    // Get option probabilities from report
    const optionProbs = (report as any).option_probabilities || {}
    const optionNodes = nodes.filter((n) => (n.data as any)?.kind === 'option')

    // Determine recommended option ID - prefer backend-provided, fall back to deterministic tie-breaker
    // Task 2.4: Primary is robustness.recommended_option_id
    const backendRecommendedId =
      (report as any)?.robustness?.recommended_option_id ??
      (report as any)?.recommendation?.option_id ??
      (report as any)?.recommendation?.selected_option ??
      (report as any)?.selected_option_id ??
      null

    // Build option results with percentile extraction
    const sharedBands = (report as any).run?.bands
    const unsortedOptions: OptionResult[] = optionNodes.map((node) => {
      const nodeId = node.id
      const prob = optionProbs[nodeId] || {}

      // Per-option bands take precedence over shared bands
      const optionBands = prob.bands ?? sharedBands ?? {}
      // Per-option outcome object (new structure with explicit expected)
      const optionOutcome = prob.outcome ?? {}

      // Extract expected value (mean) with fallback chain
      // Priority: expected_outcome (V2 field) > expected > outcome.mean > bands > goal_probability
      // P0 Fix: Add expected_outcome to catch unmapped V2 responses
      const rawExpected =
        prob.expected_outcome ?? prob.expected ?? optionOutcome.mean ?? optionBands.p50 ?? null

      // Extract percentiles (p10/p50/p90) — p50 is true median, NOT expected
      const rawP10 = optionOutcome.p10 ?? optionBands.p10 ?? null
      const rawP50 = optionOutcome.p50 ?? optionBands.p50 ?? rawExpected
      const rawP90 = optionOutcome.p90 ?? optionBands.p90 ?? null

      // Normalize all 4 values together with single scale decision
      // This prevents scale mismatches when expected and p50 have different magnitudes
      const norm = normalizeOutcomeValues(rawP10, rawExpected, rawP50, rawP90)

      const goalProbability = typeof prob.goal_probability === 'number'
        ? prob.goal_probability
        : null

      return {
        id: nodeId,
        label: (node.data as any)?.label || nodeId,
        // Explicit expected value (mean) — primary value for "Expected" display
        expected: norm.expected,
        // Full outcome distribution (mean = expected, for consistency)
        outcome: {
          mean: norm.expected,
          p10: norm.p10,
          p50: norm.p50,  // True median
          p90: norm.p90,
        },
        // Deprecated fields for backward compatibility
        p10: norm.p10,
        p50: norm.p50,
        p90: norm.p90,
        isRecommended: false, // Will be set immutably below
        winProbability: prob.win_probability,
        goalProbability,
      }
    })

    // Task 1.1: Winner selection logic - SINGLE SOURCE OF TRUTH
    // Determine winner selection method BEFORE sorting or selecting winner
    // This ensures label matches the actual selection criteria
    const { recommendedId, determinedBy } = determineWinnerSelection(
      unsortedOptions,
      backendRecommendedId
    )

    // Sort by expected value descending for display order (independent of winner selection)
    const sortedOptions = [...unsortedOptions].sort((a, b) => {
      const aValue = a.expected ?? a.goalProbability ?? -Infinity
      const bValue = b.expected ?? b.goalProbability ?? -Infinity
      return bValue - aValue
    })

    // Immutably mark recommended option (no mutation of existing objects)
    const allOptions: OptionResult[] = sortedOptions.map(option => ({
      ...option,
      isRecommended: option.id === recommendedId,
    }))

    const recommendedOption = allOptions.find((o) => o.isRecommended) || null

    // Extract recommendation stability from robustness (0-1 score)
    const robustness = (report as any)?.robustness
    const recommendationStability = typeof robustness?.recommendation_stability === 'number'
      ? robustness.recommendation_stability
      : typeof robustness?.recommendationStability === 'number'
        ? robustness.recommendationStability
        : undefined

    // Task 1.3: Extract win_probability from recommended option
    const winProbability = recommendedOption?.winProbability

    // Task 1.5: Extract robustness level and label
    // P0 Fix: PLoT doesn't return level/label - derive from recommendation_stability
    const rawRobustnessLevel = robustness?.level as string | undefined
    const rawRobustnessLabel = robustness?.label as string | undefined

    // Derive level from recommendation_stability if not explicitly provided
    function deriveRobustnessLevel(stability: number | undefined): RobustnessLevel | undefined {
      if (stability === undefined) return undefined
      if (stability >= 0.8) return 'high'
      if (stability >= 0.5) return 'medium'
      if (stability >= 0.3) return 'low'
      return 'very_low'
    }

    // Normalize robustness level - try explicit value first, then derive from stability
    const robustnessLevel: RobustnessLevel | undefined =
      rawRobustnessLevel === 'high' || rawRobustnessLevel === 'medium' ||
      rawRobustnessLevel === 'low' || rawRobustnessLevel === 'very_low'
        ? rawRobustnessLevel
        : deriveRobustnessLevel(recommendationStability)

    // Derive label from level if not explicitly provided
    function deriveLabelFromLevel(level: RobustnessLevel | undefined): RobustnessLabel | undefined {
      if (!level) return undefined
      if (level === 'high') return 'robust'
      if (level === 'medium') return 'moderate'
      return 'fragile' // low or very_low
    }

    // Normalize robustness label (fallback naming)
    const robustnessLabel: RobustnessLabel | undefined =
      rawRobustnessLabel === 'robust' || rawRobustnessLabel === 'moderate' ||
      rawRobustnessLabel === 'fragile'
        ? rawRobustnessLabel
        : deriveLabelFromLevel(robustnessLevel)

    // Task 1.7: Get goal text from framing
    const goalText = currentScenarioFraming?.goal || undefined

    return {
      recommendedOption,
      allOptions,
      goalLabel,
      goalNodeId,
      isSingleOption: allOptions.length <= 1,
      analysisStatus: 'computed',
      // Issue 5 fix: Pass through unit for proper outcome formatting
      outcomeUnit,
      outcomeUnitSymbol,
      recommendationStability,
      // Task 1.3: Win probability for display
      winProbability,
      // Task 1.4: How winner was determined
      determinedBy,
      // Task 1.5: Robustness level and label
      robustnessLevel,
      robustnessLabel,
      // Task 1.7: Goal text from framing
      goalText,
    }
  }, [hasCompletedFirstRun, report, nodes, goalLabel, goalNodeId, outcomeUnit, outcomeUnitSymbol, currentScenarioFraming])

  // ==========================================================================
  // Drivers Section Data (with dynamic normalisation)
  // ==========================================================================
  const drivers = useMemo<DriversSectionData>(() => {
    const driversStatus = (report as any)?.drivers_status || 'unavailable'

    // Collect raw factors from multiple sources
    const rawFactors: RawFactorSensitivity[] = []

    // Source 1: factor_sensitivity (PLoT v2)
    const factorSensitivity = (report as any)?.factor_sensitivity || []

    // P0 DIAGNOSTIC: Log raw factor_sensitivity data to verify field mapping
    // Fix 3: Guard window access for SSR, Fix 5: Gate behind debug toggle
    if (typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG && factorSensitivity.length > 0) {
      console.log('[useResultsSectionData] Raw factor_sensitivity from PLoT:', {
        count: factorSensitivity.length,
        sample: factorSensitivity[0],
        allFields: factorSensitivity.map((f: any) => ({
          node_id: f.node_id,
          label: f.label,
          sensitivity_score: f.sensitivity_score,
          elasticity: f.elasticity,
          value_of_information: f.value_of_information,
          confidence: f.confidence,
          direction: f.direction,
        })),
      })
    }

    factorSensitivity.forEach((f: any) => rawFactors.push(f))

    // Fix 2: Precompute keys in a Set for O(1) duplicate detection
    const seenKeys = new Set<string>()
    rawFactors.forEach((f, index) => seenKeys.add(getFactorKey(f, index)))

    // Source 2: drivers array (legacy)
    // Fix 2: Use getFactorKey for canonical de-dupe (not d.nodeId || d.id)
    const legacyDrivers = (report as any)?.drivers || []
    legacyDrivers.forEach((d: any, idx: number) => {
      const candidate: RawFactorSensitivity = {
        node_id: d.nodeId,
        id: d.id,
        label: d.label,
        sensitivity: d.contribution,
        direction: d.polarity === 'down' ? 'negative' : 'positive',
      }
      const key = getFactorKey(candidate, rawFactors.length + idx)
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        rawFactors.push(candidate)
      }
    })

    // Source 3: drivers_payload
    const driversPayload = (report as any)?.drivers_payload?.drivers || []
    driversPayload.forEach((pd: any, idx: number) => {
      const key = getFactorKey(pd, rawFactors.length + idx)
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        rawFactors.push(pd)
      }
    })

    // Source 4: sensitivity.factors (alternative path)
    const sensitivityFactors = (report as any)?.sensitivity?.factors || []
    sensitivityFactors.forEach((sf: any, idx: number) => {
      const key = getFactorKey(sf, rawFactors.length + idx)
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        rawFactors.push(sf)
      }
    })

    // Source 5: factors array (direct)
    const directFactors = (report as any)?.factors || []
    directFactors.forEach((df: any, idx: number) => {
      const key = getFactorKey(df, rawFactors.length + idx)
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        rawFactors.push(df)
      }
    })

    if (rawFactors.length === 0) {
      return {
        drivers: [],
        driversStatus: driversStatus === 'computed' ? 'unavailable' : driversStatus,
        topDrivers: [],
        totalCount: 0,
        hasMagnitudeData: false,
      }
    }

    const normalizedFactors = rawFactors.map(f => normalizeFactorSensitivity(f, nodeLabelMap))

    // Step 1: Extract keys and raw elasticities
    const factorsWithKeys = normalizedFactors.map((f, index) => ({
      raw: f,
      key: getFactorKey(f, index),
      rawElasticity: getRawElasticity(f),
      importanceRank: f.importanceRank,
      label: f.label,
    }))

    // Step 2: Compute dynamic normalisation
    const normalisedMap = computeNormalisedInfluences(factorsWithKeys)

    // Step 3: Compute ranks
    const rankMap = computeFactorRanks(factorsWithKeys)

    // Step 4: Derive edges for direction mapping
    const edgesForDirection: EdgeForDirection[] = edges.map(e => ({
      source: e.source,
      target: e.target,
      effect_direction: (e.data as any)?.effect_direction,
      direction: (e.data as any)?.direction,
    }))

    // Step 4b: Build fragile edges lookup for factor-to-goal edges
    // RULE: When a factor has multiple fragile edges, keep the one with highest switchProbability (most risky)
    // - Prefer defined values over undefined (undefined means "no data", not "zero risk")
    // - When both defined, keep the higher value (more risky edge dominates)
    const fragileEdgesRaw = safeArray((report as any)?.robustness?.fragile_edges)
    const fragileEdgesMap = new Map<string, { switchProbability?: number; alternativeWinnerLabel?: string }>()
    fragileEdgesRaw.forEach((fe: any) => {
      const fromId = fe.from_id ?? fe.fromId ?? fe.source
      if (fromId) {
        // Task 1.5: Metric consistency - use marginal_switch_probability as primary, fall back to switch_probability
        // This same pattern is used throughout: filtering (line 1232), counting (line 1242), display
        const newProb = typeof fe.marginal_switch_probability === 'number'
          ? fe.marginal_switch_probability
          : typeof fe.switch_probability === 'number'
            ? fe.switch_probability
            : undefined
        const existing = fragileEdgesMap.get(fromId)
        const existingProb = existing?.switchProbability

        // Decision logic: prefer defined values, then prefer higher values
        const shouldReplace = !existing || // No existing entry
          (existingProb === undefined && newProb !== undefined) || // New has value, existing doesn't
          (existingProb !== undefined && newProb !== undefined && newProb > existingProb) // Both defined, new is higher

        if (shouldReplace) {
          fragileEdgesMap.set(fromId, {
            switchProbability: newProb,
            alternativeWinnerLabel: fe.alternative_winner_label ?? fe.alternativeWinnerLabel ?? fe.alternativeWinner,
          })
        }
      }
    })

    // Step 5: Build driver items with all presentation fields
    // Keep all factors - even those with zero elasticity (they came from the model, show them)
    // Only filter out if we have many factors AND they have zero influence
    const hasAnyElasticity = factorsWithKeys.some(f => Math.abs(f.rawElasticity) > 0)
    // Get max raw elasticity to determine if we have meaningful magnitude data
    const maxRawElasticity = Math.max(...factorsWithKeys.map(f => Math.abs(f.rawElasticity)), 0)
    // Track if we should show magnitude data (full display with bars and semantic labels)
    // CRITICAL: Based on actual data values, NOT data provenance
    // Show full display ONLY when we have real elasticity values > 0.001
    // Otherwise show direction-only view (no misleading 100% bars)
    const hasMagnitudeData = maxRawElasticity > 0.001
    const driverItems: DriverItem[] = factorsWithKeys
      .filter(f => {
        // Always keep if we have few factors
        if (rawFactors.length <= 5) return true
        // Always keep if this factor has elasticity data
        if (Math.abs(f.rawElasticity) > 0) return true
        // If NO factors have elasticity data, keep all (fallback display)
        if (!hasAnyElasticity) return true
        // Otherwise filter out zero-influence factors
        return false
      })
      .map(f => {
        const rank = rankMap.get(f.key) ?? factorsWithKeys.length
        const normalisedInfluence = normalisedMap.get(f.key) ?? 0
        const direction = getFactorDirection(
          f.key,
          edgesForDirection,
          goalNodeId,
          outcomeNodeIds,
          f.raw.direction
        )
        const semanticLabel = getSemanticLabel(rank, normalisedInfluence)

        // Check if factor can be focused on canvas
        const driverForMatch: Driver = { kind: 'node', id: f.key, label: f.raw.label }
        const matches = findNodeMatches(driverForMatch, nodes as Node[])
        const canFocus = matches.length > 0
        const matchedNodeId = matches[0]?.targetId

        // Format label for display - prefer canvas node label, then raw label, then formatted key
        const matchedNode = matchedNodeId ? nodes.find(n => n.id === matchedNodeId) : null
        const canvasLabel = (matchedNode?.data as any)?.label
        const displayLabel = canvasLabel || f.raw.label ||
          f.key
            .replace(/^(fac_|out_|goal_|risk_|factor_)/, '')
            .replace(/_\d+$/, '') // Remove trailing numbers like _0, _1
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())

        // Get confidence: factor_sensitivity.confidence first, then edge beliefExists as fallback
        // PLoT returns confidence directly on factor_sensitivity array items
        const factorNodeId = matchedNodeId || f.key
        const factorConfidence = typeof f.raw.confidence === 'number'
          ? f.raw.confidence
          : undefined
        const edgeToGoal = goalNodeId
          ? edges.find(e => e.source === factorNodeId && e.target === goalNodeId)
          : undefined
        const edgeConfidence = (edgeToGoal?.data as any)?.beliefExists ?? undefined
        // Fix 3: Clamp confidence to [0,1] range
        const rawConfidence = factorConfidence ?? edgeConfidence
        const confidence = typeof rawConfidence === 'number'
          ? Math.max(0, Math.min(1, rawConfidence))
          : undefined

        // Get fragile edge info if this factor can flip decision
        const fragileInfo = fragileEdgesMap.get(factorNodeId) || fragileEdgesMap.get(f.key)
        const fragileEdgeInfo = fragileInfo ? {
          switchProbability: fragileInfo.switchProbability,
          alternativeWinnerLabel: fragileInfo.alternativeWinnerLabel,
        } : undefined

        return {
          factorKey: f.key,
          factorLabel: displayLabel,
          rawElasticity: f.rawElasticity,
          normalisedInfluence,
          // ISL influence_score (0-1) - use directly for Influence column
          influenceScore: f.raw.influenceScore,
          // ISL zero_reason - explains why sensitivity is zero
          zeroReason: f.raw.zeroReason,
          rank,
          direction,
          semanticLabel,
          canFocus,
          matchedNodeId: matchedNodeId !== f.key ? matchedNodeId : undefined,
          confidence,
          // ISL value_of_information (0-1) - whether investigation could change decision
          valueOfInformation: f.raw.valueOfInformation,
          fragileEdgeInfo,
          // PLoT flip_risk_category - how this factor contributes to decision uncertainty
          flipRiskCategory: f.raw.flipRiskCategory,
        }
      })
      .sort((a, b) => a.rank - b.rank) // Sort by rank

    // Top 3 drivers
    const topDrivers = driverItems.slice(0, 3)

    // Fix 1: Only set islError when we have NO driver items to show
    // If we have data, prefer showing it even if drivers_status indicates error
    const islErrorMessage = driverItems.length === 0 && (driversStatus === 'error' || driversStatus === 'unavailable')
      ? ((report as any)?.drivers_error ??
         (report as any)?.sensitivity?.error ??
         (report as any)?.isl_error ??
         (driversStatus === 'error' ? 'Factor sensitivity service unavailable' : undefined))
      : undefined

    return {
      drivers: driverItems,
      driversStatus: driverItems.length > 0 ? 'computed' : driversStatus,
      topDrivers,
      totalCount: driverItems.length,
      hasMagnitudeData,
      islError: islErrorMessage,
    }
  }, [report, nodes, edges, goalNodeId, outcomeNodeIds])

  // ==========================================================================
  // Confidence Section Data (with improvements merged)
  // ==========================================================================
  const confidence = useMemo<ConfidenceSectionData>(() => {
    // Get graph readiness from CEE review V1
    const ceeReviewV1 = (runMeta as any)?.ceeReviewV1
    const graphReadiness = ceeReviewV1?.readiness ? {
      readiness_level: ceeReviewV1.readiness.level,
      readiness_score: ceeReviewV1.readiness.score,
    } : undefined

    // Get confidence tier with full fallback chain
    const tier = getConfidenceTier(graphReadiness, report as any)

    // Derive quality score - only use actual computed values, never fabricate
    // When only tier is known, qualityScore remains null and UI shows tier label only
    let qualityScore: number | null = null
    if (typeof graphReadiness?.readiness_score === 'number') {
      qualityScore = graphReadiness.readiness_score
    } else if (typeof (report as any)?.graph_quality?.score === 'number') {
      qualityScore = (report as any).graph_quality.score
    }
    // Note: Do NOT fabricate scores from tier (80/50/20) - display tier label only when score is unavailable

    // Get tier display info
    const tierInfo = {
      tier,
      icon: tier === 'strong' ? '✓' : '⚠',
      label: tier === 'strong'
        ? 'Good foundation'
        : tier === 'fair'
          ? 'Partial picture'
          : tier === 'needs_work'
            ? 'Early sketch'
            : 'Unknown',
      description: tier === 'strong'
        ? 'Your model captures this decision well.'
        : tier === 'fair'
          ? 'Your model covers the basics. Address the items below.'
          : tier === 'needs_work'
            ? 'Add the missing elements below before relying on the recommendation.'
            : 'Unable to assess model quality.',
    }

    // Get warnings as uncertainties from critiques
    const critiques = (report as any)?.run?.critique || []
    const warnings = critiques.filter((c: any) => c.severity === 'WARNING')

    const uncertainties: UncertaintyItem[] = warnings.map((w: any) => ({
      code: w.code || 'UNKNOWN',
      message: w.message,
      suggestion: w.suggested_fix,
      affectedNodes: w.node_id ? [w.node_id] : undefined,
      // Map critique severity: BLOCKER/ERROR/WARNING/INFO → blocker/error/warning/info
      severity: normaliseSeverity(w.severity),
    }))

    // Add sensitive assumptions from robustness analysis (formerly "fragile edges")
    // Filter to only show high-risk fragile edges (switch_probability > 0.3)
    // P0 Fix: Use safeArray to handle truncated wrapper format
    const fragileEdgesRaw = safeArray((report as any)?.robustness?.fragile_edges)
    const firstFragileEdge = fragileEdgesRaw[0] as any
    if (import.meta.env.DEV && typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG) {
      console.log('[REPORT_SOURCE_DEBUG]', {
        hasReport: !!report,
        reportKeys: report ? Object.keys(report).slice(0, 10) : [],
        hasRobustness: !!(report as any)?.robustness,
        hasFragileEdges: !!(report as any)?.robustness?.fragile_edges,
        fragileEdgesLength: fragileEdgesRaw.length,
        hasDownstreamCalls: !!(report as any)?.downstream_calls,
        firstEdgeKeys: firstFragileEdge ? Object.keys(firstFragileEdge) : [],
        firstEdgeHasFromLabel: !!firstFragileEdge?.from_label,
      })
      console.log('[FRAGILE_EDGES_SOURCE]', {
        source: 'report.robustness.fragile_edges',
        count: fragileEdgesRaw.length,
        firstEdgeKeys: firstFragileEdge ? Object.keys(firstFragileEdge) : [],
        hasLabels: firstFragileEdge?.from_label !== undefined,
      })
    }

    // Dedupe fragile edges by unique key (edge_id + alternative_winner_id)
    const FRAGILE_EDGE_THRESHOLD = 0.3
    const dedupedFragileEdges = Array.from(
      new Map(
        fragileEdgesRaw.map((fe: any) => [
          `${fe.edge_id ?? fe.edgeId ?? ''}::${fe.alternative_winner_id ?? fe.alternativeWinnerId ?? ''}`,
          fe,
        ])
      ).values()
    )

    // Task 1.5: Filter to high-risk edges (switch_probability > threshold)
    // Metric consistency verified: same pattern used for filtering, counting, and display
    const highRiskFragileEdges = dedupedFragileEdges
      .filter((fe: any) => {
        // Use marginal_switch_probability when available, fall back to switch_probability
        // ISL marginal = P(alternative wins | only this edge weak) — more precise for single-edge risk
        const flipProb = fe.marginal_switch_probability ?? fe.switch_probability
        if (typeof flipProb === 'number') {
          return flipProb > FRAGILE_EDGE_THRESHOLD
        }
        // If no probability data, include by default (legacy data)
        return true
      })

    // Count how many were filtered out (had numeric probability <= threshold)
    const filteredFragileEdgesCount = dedupedFragileEdges.filter((fe: any) => {
      const flipProb = fe.marginal_switch_probability ?? fe.switch_probability
      return typeof flipProb === 'number' && flipProb <= FRAGILE_EDGE_THRESHOLD
    }).length

    // Sort by risk and take top 3
    const sensitiveAssumptions = highRiskFragileEdges
      .sort((a: any, b: any) => {
        const bProb = b.marginal_switch_probability ?? b.switch_probability ?? -Infinity
        const aProb = a.marginal_switch_probability ?? a.switch_probability ?? -Infinity
        return bProb - aProb
      })
      .slice(0, 3)
    const cleanId = (id: string | undefined) =>
      id?.replace(/^(fac_|out_|goal_|risk_|opt_)/, '').replace(/_/g, ' ')
    const nonEmptyLabel = (value: unknown) =>
      typeof value === 'string' && value.trim().length > 0 ? value : undefined
    const getNodeLabel = (id: string | undefined) => (id ? nodeLabelMap.get(id) : undefined)

    // P2 Fix: Build option label lookup from report.option_comparison
    // This provides an additional fallback when PLoT doesn't enrich alternative_winner_label
    // and the canvas node lookup fails
    const optionComparison = safeArray((report as any)?.option_comparison)
    const optionLabelMap = new Map<string, string>()
    optionComparison.forEach((opt: any) => {
      const optId = opt?.option_id
      const optLabel = opt?.option_label
      if (typeof optId === 'string' && typeof optLabel === 'string' && optLabel.trim()) {
        optionLabelMap.set(optId, optLabel)
      }
    })
    const getOptionLabel = (id: string | undefined) => (id ? optionLabelMap.get(id) : undefined)
    const parseEdgeId = (edgeId: string | undefined) => {
      if (!edgeId) return {}
      const parts = edgeId.split('::')
      if (parts.length === 2 && parts[0] && parts[1]) {
        return { fromId: parts[0], toId: parts[1] }
      }
      if (import.meta.env.DEV && typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG) {
        console.warn('[useResultsSectionData] Unrecognized fragile edge id format:', edgeId)
      }
      return {}
    }

    sensitiveAssumptions.forEach((fe: any) => {
      const edgeId = typeof fe === 'string' ? fe : fe.edge_id ?? fe.edgeId
      const parsed = parseEdgeId(edgeId)
      const fromId = (typeof fe === 'string' ? undefined : (fe.from_id ?? fe.fromId ?? fe.source)) ?? parsed.fromId
      const toId = (typeof fe === 'string' ? undefined : (fe.to_id ?? fe.toId ?? fe.target)) ?? parsed.toId

      const isEdgeObject = typeof fe === 'object' && fe !== null
      console.log('[UNCERTAINTY_DEBUG]', {
        rawEdge: fe,
        hasFromLabel: isEdgeObject && 'from_label' in fe,
        hasToLabel: isEdgeObject && 'to_label' in fe,
        hasAltLabel: isEdgeObject && 'alternative_winner_label' in fe,
        fromLabelValue: isEdgeObject ? fe.from_label : undefined,
        toLabelValue: isEdgeObject ? fe.to_label : undefined,
        altLabelValue: isEdgeObject ? fe.alternative_winner_label : undefined,
      })

      if (typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG) {
        console.log('[FragileEdge:RAW]', {
          edge_id: fe.edge_id ?? fe.edgeId ?? edgeId,
          from_label: fe.from_label,
          fromLabel: fe.fromLabel,
          to_label: fe.to_label,
          toLabel: fe.toLabel,
          alternative_winner_label: fe.alternative_winner_label,
          alternativeWinnerLabel: fe.alternativeWinnerLabel,
          from_id: fe.from_id ?? fe.fromId ?? parsed.fromId,
          to_id: fe.to_id ?? fe.toId ?? parsed.toId,
          alternative_winner_id: fe.alternative_winner_id ?? fe.alternativeWinnerId,
          fullObject: (() => {
            try {
              return JSON.stringify(fe).substring(0, 500)
            } catch {
              return '[unserializable]'
            }
          })(),
        })
      }

      // Schema v2.6: Use from_label/to_label with fallback to cleaned IDs
      const sourceName =
        nonEmptyLabel(fe.from_label) ??
        nonEmptyLabel(fe.fromLabel) ??
        getNodeLabel(fromId) ??
        cleanId(fromId) ??
        'this factor'
      const targetName =
        nonEmptyLabel(fe.to_label) ??
        nonEmptyLabel(fe.toLabel) ??
        getNodeLabel(toId) ??
        cleanId(toId) ??
        'the outcome'

      // Schema v2.6: Use alternative_winner_label directly
      // Fallback chain: PLoT enrichment → canvas node → report option_comparison → cleaned ID → default
      const altWinnerId = fe.alternative_winner_id ?? fe.alternativeWinnerId
      const alternativeWinnerLabel =
        nonEmptyLabel(fe.alternative_winner_label) ??
        nonEmptyLabel(fe.alternativeWinnerLabel) ??
        nonEmptyLabel(fe.alternativeWinner) ??
        getNodeLabel(altWinnerId) ??
        getOptionLabel(altWinnerId) ??
        cleanId(altWinnerId) ??
        'another option'

      if (typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG) {
        console.log('[FragileEdge:RESOLVED]', {
          fromLabel: sourceName,
          toLabel: targetName,
          alternativeLabel: alternativeWinnerLabel,
          usedFallback:
            sourceName === 'this factor' ||
            targetName === 'the outcome' ||
            alternativeWinnerLabel === 'another option',
        })
      }

      // Enhanced message format per spec
      const edgeLabel = fe.label || `${sourceName} → ${targetName}`
      const friendlyMessage = fe.description ||
        `If "${edgeLabel}" changes significantly, "${alternativeWinnerLabel}" could become the better choice`

      // P2 Fix: Derive severity from flip probability
      // Use marginal_switch_probability when available (more precise single-edge risk)
      // > 0.7 = very likely to flip = blocker; > 0.5 = likely = error; > 0.3 = possible = warning
      let severity: 'blocker' | 'error' | 'warning' = 'warning'
      const flipProbability = fe.marginal_switch_probability ?? fe.switch_probability
      if (typeof flipProbability === 'number') {
        if (flipProbability > 0.7) {
          severity = 'blocker'
        } else if (flipProbability > 0.5) {
          severity = 'error'
        }
      }

      uncertainties.push({
        code: 'SENSITIVE_ASSUMPTION',
        message: friendlyMessage,
        suggestion: 'Validate this assumption',
        affectedNodes: [fromId, toId].filter(Boolean),
        severity,
        threshold: fe.threshold ? {
          variable: fe.from_id ?? fe.fromId ?? fe.source,
          direction: normaliseDirection(fe.direction) ?? 'positive',
          value: fe.threshold,
          alternativeOption: alternativeWinnerLabel,
        } : undefined,
      })
    })

    // Get evidence coverage from multiple sources
    const rawEvidenceQuality = ceeReviewV1?.evidence_quality
      ?? (report as any)?.evidence_quality
      ?? null

    const evidenceCoverage = rawEvidenceQuality ? {
      backedByData: rawEvidenceQuality.backed_by_data ?? rawEvidenceQuality.strong ?? 0,
      needsValidation: rawEvidenceQuality.needs_validation ?? rawEvidenceQuality.weak ?? 0,
    } : undefined

    // Normalise improvements from multiple sources
    const biasFindings = (report as any)?.bias_findings || ceeReviewV1?.bias_findings || []
    const qualityFactors = (report as any)?.quality_factors || ceeReviewV1?.quality_factors || []
    const improvementGuidance = (report as any)?.improvement_guidance || ceeReviewV1?.improvement_guidance || []

    const improvements = normaliseImprovements(biasFindings, qualityFactors, improvementGuidance)

    // Wire status signals from report (not runMeta) for degraded banner
    // P2 Fix: These fields are set by responseMapper from V2 response
    const analysisStatus = (report as any)?.analysis_state === 'partial' ? 'partial' : 'computed'
    const driversStatus = (report as any)?.drivers_status ?? 'computed'
    // Check for robustness data: fragile_edges or robust_edges indicates computed
    // P0 Fix: Use safeArray to handle truncated wrapper format { __truncated: true, items: [...] }
    const robustness = (report as any)?.robustness
    const hasRobustnessData = robustness && (
      safeArray(robustness.fragile_edges).length > 0 ||
      safeArray(robustness.robust_edges).length > 0 ||
      robustness.ranking_stability !== undefined
    )
    const robustnessStatus = hasRobustnessData ? 'computed' : 'unavailable'

    // Build filtered disclosure when items were excluded
    // Task 2: Use scenario-tested language, avoid "flip risk"
    const filteredFragileEdges = filteredFragileEdgesCount > 0 ? {
      filteredCount: filteredFragileEdgesCount,
      threshold: FRAGILE_EDGE_THRESHOLD,
      description: `${filteredFragileEdgesCount} additional ${filteredFragileEdgesCount === 1 ? 'edge' : 'edges'} changed the best option in <${Math.round(FRAGILE_EDGE_THRESHOLD * 100)}% of scenarios tested`,
    } : undefined

    return {
      tier: tierInfo,
      qualityScore,
      uncertainties,
      topUncertainties: uncertainties.slice(0, 3),
      rankingStability: (report as any)?.robustness?.ranking_stability,
      evidenceCoverage,
      improvements,
      topImprovements: improvements.slice(0, 2),
      analysisStatus,
      driversStatus,
      robustnessStatus,
      filteredFragileEdges,
    }
  }, [report])

  // ==========================================================================
  // Improvements Section Data (Legacy - now merged into confidence)
  // ==========================================================================
  const improvements = useMemo<ImprovementsSectionData>(() => {
    return {
      improvements: confidence.improvements,
      count: confidence.improvements.length,
      hasHighPriority: confidence.improvements.some(i => i.priority === 1),
    }
  }, [confidence])

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading,
    isError,
    goalLabel,
    goalNodeId,
  }
}

export default useResultsSectionData

// =============================================================================
// Exported for testing
// =============================================================================

export {
  normaliseLabel,
  getFactorKey,
  getRawElasticity,
  computeNormalisedInfluences,
  computeFactorRanks,
  normalizeOutcomeValues,
  normaliseDirection,
  getFactorDirection,
  getSemanticLabel,
  mapReadinessLevel,
  mapConfidenceLevel,
  getConfidenceTier,
  normaliseImprovements,
}
