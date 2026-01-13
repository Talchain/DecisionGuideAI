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
  EdgeForDirection,
} from './types'

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
 * Get canonical factor key from various ID fields.
 * Priority: node_id > factor_id > id > normalised(label)
 */
function getFactorKey(factor: RawFactorSensitivity, index: number): string {
  if (factor.node_id) return factor.node_id
  if (factor.factor_id) return factor.factor_id
  if (factor.id) return factor.id
  if (factor.label) return normaliseLabel(factor.label)
  // Fallback: generate unique key using index
  return `factor_${index}`
}

// =============================================================================
// Raw Elasticity Extraction (CRITICAL: Fallback Chain)
// =============================================================================

/**
 * Extract raw elasticity with fallback chain.
 * Priority: elasticity > sensitivity_score > sensitivity > contribution > 0
 */
function getRawElasticity(factor: RawFactorSensitivity): number {
  if (typeof factor.elasticity === 'number' && isFinite(factor.elasticity)) {
    return factor.elasticity
  }
  if (typeof factor.sensitivity_score === 'number' && isFinite(factor.sensitivity_score)) {
    return factor.sensitivity_score
  }
  if (typeof factor.sensitivity === 'number' && isFinite(factor.sensitivity)) {
    return factor.sensitivity
  }
  // Fallback to contribution field (used by legacy drivers)
  if (typeof (factor as any).contribution === 'number' && isFinite((factor as any).contribution)) {
    return (factor as any).contribution
  }
  return 0
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
 * Derive factor direction from edges.
 * Priority: direct edge to goal > edge to any outcome > factor-level direction
 */
function getFactorDirection(
  factorKey: string,
  edges: EdgeForDirection[],
  goalNodeId: string | undefined,
  outcomeNodeIds: string[],
  factorDirection?: string
): DriverDirection | undefined {
  // 1. Direct edge to goal
  if (goalNodeId) {
    const goalEdge = edges.find(
      e => getEdgeSourceKey(e) === factorKey && getEdgeTargetKey(e) === goalNodeId
    )
    if (goalEdge) {
      return normaliseDirection(goalEdge.effect_direction ?? goalEdge.direction)
    }
  }

  // 2. Edge to any outcome (deterministic: sort by target ID, take first)
  const outcomeEdges = edges
    .filter(e => getEdgeSourceKey(e) === factorKey && outcomeNodeIds.includes(getEdgeTargetKey(e) ?? ''))
    .sort((a, b) => (getEdgeTargetKey(a) ?? '').localeCompare(getEdgeTargetKey(b) ?? ''))

  if (outcomeEdges.length > 0) {
    return normaliseDirection(outcomeEdges[0].effect_direction ?? outcomeEdges[0].direction)
  }

  // 3. Factor-level direction (if exists)
  if (factorDirection) {
    return normaliseDirection(factorDirection)
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

    // Helper to normalize percentage values to 0-1 range
    // CRITICAL: Must apply consistent normalization across ALL percentile values
    // to avoid impossible situations like p50 > p90
    const normalizePercentiles = (
      rawP10: number | undefined,
      rawP50: number | undefined,
      rawP90: number | undefined
    ): { p10: number; p50: number; p90: number } => {
      // Get actual values, defaulting to 0
      let p10 = rawP10 ?? 0
      let p50 = rawP50 ?? 0
      let p90 = rawP90 ?? 0

      // Determine scale: if ANY value is > 2, assume ALL are percentages (0-100)
      // This ensures consistent scaling even when values come from mixed sources
      const maxAbsValue = Math.max(Math.abs(p10), Math.abs(p50), Math.abs(p90))
      if (maxAbsValue > 2) {
        p10 = p10 / 100
        p50 = p50 / 100
        p90 = p90 / 100
      }

      // Sanity check: ensure proper ordering (p10 <= p50 <= p90)
      // If violated, the data is likely malformed - log warning and reorder
      if (p10 > p50 || p50 > p90 || p10 > p90) {
        if (import.meta.env.DEV) {
          console.warn('[Results] Percentile ordering violated - reordering:', { p10, p50, p90 })
        }
        const sorted = [p10, p50, p90].sort((a, b) => a - b)
        p10 = sorted[0]
        p50 = sorted[1]
        p90 = sorted[2]
      }

      return { p10, p50, p90 }
    }

    // Determine recommended option ID - prefer backend-provided, fall back to highest p50
    // Fix 4: Recommended badge must be tied to specific option identifier
    const backendRecommendedId =
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
      // Per-option results object (some APIs nest values here)
      const optionResults = prob.results ?? {}

      // Extract per-option p10/expected/p90 with comprehensive fallback chain:
      // Priority: mean > expected_outcome > expected_value > p50 > bands.* > goal_probability
      // IMPORTANT: mean (expected value) is distinct from p50 (median) - use mean for "Expected" display
      // bands.* should come BEFORE goal_probability to prefer option-specific data
      const rawP10 = optionResults.p10 ?? prob.p10 ?? optionBands.p10 ?? prob.goal_probability
      // For "expected", prioritise mean (average outcome) over p50 (median)
      // This fixes the 0% bug where mean=3.8% but p50=0%
      const rawExpected =
        optionResults.mean ?? optionResults.expected_outcome ??
        optionResults.expected_value ?? optionResults.p50 ??
        prob.mean ?? prob.expected_outcome ??
        prob.expected_value ?? prob.p50 ??
        optionBands.p50 ?? prob.goal_probability
      const rawP90 = optionResults.p90 ?? prob.p90 ?? optionBands.p90 ?? prob.goal_probability

      // Normalize all percentiles together for consistent scaling
      // Note: p50 variable name kept for interface compatibility, but now contains mean (expected value)
      const { p10, p50, p90 } = normalizePercentiles(rawP10, rawExpected, rawP90)

      return {
        id: nodeId,
        label: (node.data as any)?.label || nodeId,
        p10,
        p50,
        p90,
        isRecommended: false, // Will be set immutably below
        winProbability: prob.win_probability,
      }
    })

    // Sort by p50 descending for display order
    const sortedOptions = [...unsortedOptions].sort((a, b) => b.p50 - a.p50)

    // Determine which option ID should be recommended
    // Priority: backend-provided ID > highest p50 (first after sort)
    const recommendedId = backendRecommendedId
      ?? (sortedOptions.length > 0 ? sortedOptions[0].id : null)

    // Immutably mark recommended option (no mutation of existing objects)
    const allOptions: OptionResult[] = sortedOptions.map(option => ({
      ...option,
      isRecommended: option.id === recommendedId,
    }))

    const recommendedOption = allOptions.find((o) => o.isRecommended) || null

    return {
      recommendedOption,
      allOptions,
      goalLabel,
      goalNodeId,
      isSingleOption: allOptions.length <= 1,
      analysisStatus: 'computed',
    }
  }, [hasCompletedFirstRun, report, nodes, goalLabel, goalNodeId])

  // ==========================================================================
  // Drivers Section Data (with dynamic normalisation)
  // ==========================================================================
  const drivers = useMemo<DriversSectionData>(() => {
    const driversStatus = (report as any)?.drivers_status || 'unavailable'

    // Collect raw factors from multiple sources
    const rawFactors: RawFactorSensitivity[] = []

    // Source 1: factor_sensitivity (PLoT v2)
    const factorSensitivity = (report as any)?.factor_sensitivity || []
    factorSensitivity.forEach((f: any) => rawFactors.push(f))

    // Source 2: drivers array (legacy)
    const legacyDrivers = (report as any)?.drivers || []
    legacyDrivers.forEach((d: any) => {
      if (!rawFactors.some(f => getFactorKey(f, 0) === (d.nodeId || d.id))) {
        rawFactors.push({
          node_id: d.nodeId,
          id: d.id,
          label: d.label,
          sensitivity: d.contribution,
          direction: d.polarity === 'down' ? 'negative' : 'positive',
        })
      }
    })

    // Source 3: drivers_payload
    const driversPayload = (report as any)?.drivers_payload?.drivers || []
    driversPayload.forEach((pd: any) => {
      if (!rawFactors.some(f => getFactorKey(f, 0) === (pd.id || pd.node_id))) {
        rawFactors.push(pd)
      }
    })

    // Source 4: sensitivity.factors (alternative path)
    const sensitivityFactors = (report as any)?.sensitivity?.factors || []
    sensitivityFactors.forEach((sf: any) => {
      if (!rawFactors.some(f => getFactorKey(f, 0) === (sf.id || sf.node_id))) {
        rawFactors.push(sf)
      }
    })

    // Source 5: factors array (direct)
    const directFactors = (report as any)?.factors || []
    directFactors.forEach((df: any) => {
      if (!rawFactors.some(f => getFactorKey(f, 0) === (df.id || df.node_id))) {
        rawFactors.push(df)
      }
    })

    // Source 6: FALLBACK - Derive from canvas factor nodes if no data from report
    // This ensures we show SOMETHING when the model has factors but API didn't return sensitivity data
    // IMPORTANT: Track if we used canvas fallback - this means NO real magnitude data exists
    let usedCanvasFallback = false
    if (rawFactors.length === 0) {
      usedCanvasFallback = true
      const factorNodes = nodes.filter(n =>
        n.type === 'factor' ||
        (n.data as any)?.kind === 'factor' ||
        n.type === 'risk' ||
        (n.data as any)?.kind === 'risk'
      )

      factorNodes.forEach((node, index) => {
        rawFactors.push({
          node_id: node.id,
          label: (node.data as any)?.label || node.id,
          // Default elasticity for normalisation (but NOT real magnitude data)
          elasticity: 0.5,
        })
      })
    }

    if (rawFactors.length === 0) {
      return {
        drivers: [],
        driversStatus: driversStatus === 'computed' ? 'unavailable' : driversStatus,
        topDrivers: [],
        totalCount: 0,
        hasMagnitudeData: false,
      }
    }

    // Step 1: Extract keys and raw elasticities
    const factorsWithKeys = rawFactors.map((f, index) => ({
      raw: f,
      key: getFactorKey(f, index),
      rawElasticity: getRawElasticity(f),
      importanceRank: f.importance_rank,
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

        // Format label for display
        const displayLabel = f.raw.label ||
          f.key
            .replace(/^(fac_|out_|goal_|risk_)/, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())

        return {
          factorKey: f.key,
          factorLabel: displayLabel,
          rawElasticity: f.rawElasticity,
          normalisedInfluence,
          rank,
          direction,
          semanticLabel,
          canFocus,
          matchedNodeId: matchedNodeId !== f.key ? matchedNodeId : undefined,
        }
      })
      .sort((a, b) => a.rank - b.rank) // Sort by rank

    // Top 3 drivers
    const topDrivers = driverItems.slice(0, 3)

    return {
      drivers: driverItems,
      driversStatus: driverItems.length > 0 ? 'computed' : driversStatus,
      topDrivers,
      totalCount: driverItems.length,
      hasMagnitudeData,
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

    // Derive quality score
    let qualityScore: number | null = null
    if (typeof graphReadiness?.readiness_score === 'number') {
      qualityScore = graphReadiness.readiness_score
    } else if (typeof (report as any)?.graph_quality?.score === 'number') {
      qualityScore = (report as any).graph_quality.score
    } else if (tier === 'strong') {
      qualityScore = 80
    } else if (tier === 'fair') {
      qualityScore = 50
    } else if (tier === 'needs_work') {
      qualityScore = 20
    }

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
    }))

    // Add sensitive assumptions from robustness analysis (formerly "fragile edges")
    const sensitiveAssumptions = (report as any)?.robustness?.fragile_edges || []
    sensitiveAssumptions.forEach((fe: any) => {
      // Format user-friendly message without technical jargon
      const sourceName = fe.source?.replace(/^(fac_|out_|goal_|risk_)/, '').replace(/_/g, ' ') || 'this factor'
      const targetName = fe.target?.replace(/^(fac_|out_|goal_|risk_)/, '').replace(/_/g, ' ') || 'the outcome'
      const friendlyMessage = fe.description || `The relationship between "${sourceName}" and "${targetName}" may significantly affect results`

      uncertainties.push({
        code: 'SENSITIVE_ASSUMPTION',
        message: friendlyMessage,
        suggestion: 'Consider validating this assumption with additional data',
        affectedNodes: [fe.source, fe.target].filter(Boolean),
        threshold: fe.threshold ? {
          variable: fe.source,
          direction: normaliseDirection(fe.direction) ?? 'positive',
          value: fe.threshold,
          alternativeOption: fe.alternative_option,
        } : undefined,
      })
    })

    // Get evidence coverage from multiple sources
    const rawEvidenceQuality = ceeReviewV1?.evidence_quality
      ?? graphReadiness?.evidence_quality
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

    return {
      tier: tierInfo,
      qualityScore,
      uncertainties,
      topUncertainties: uncertainties.slice(0, 3),
      rankingStability: (report as any)?.robustness?.ranking_stability,
      evidenceCoverage,
      improvements,
      topImprovements: improvements.slice(0, 2),
      analysisStatus: (runMeta as any)?.analysisStatus,
      driversStatus: (runMeta as any)?.driversStatus,
      robustnessStatus: (runMeta as any)?.robustnessStatus,
    }
  }, [report, runMeta])

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
  normaliseDirection,
  getFactorDirection,
  getSemanticLabel,
  mapReadinessLevel,
  mapConfidenceLevel,
  getConfidenceTier,
  normaliseImprovements,
}
