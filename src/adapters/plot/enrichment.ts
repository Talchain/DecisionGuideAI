/**
 * PLoT Enrichment Types and Adapters
 *
 * Phase 1B: Routing Consolidation Implementation
 *
 * This module provides types and adapters for consuming ISL enrichment data
 * from PLoT responses instead of calling ISL directly. When VITE_USE_PLOT_ENRICHMENT
 * is enabled, the UI will extract robustness/sensitivity data from PLoT's response.
 *
 * PLoT calls ISL internally and returns enrichment data, eliminating the dual-pipeline
 * problem where PLoT and ISL could produce inconsistent results due to different RNGs.
 */

import type {
  RobustnessResult,
  RobustnessLabel,
  SensitiveParameter,
  ValueOfInformation,
  RobustnessBound,
  RankedOptionWithRobustness,
} from '../../canvas/components/RecommendationCard/types'
import type { ISLValidationResponse } from '../isl/types'
import { isPlotEnrichmentEnabled } from '../../flags'

// =============================================================================
// PLoT Enrichment Schema (actual response from PLoT backend)
// =============================================================================

/**
 * Causal validation data from PLoT enrichment
 * Maps to ISLValidationResponse with additional causal identifiability info
 */
export interface PLoTCausalValidation {
  /** Whether the causal effect is identifiable from the graph structure */
  identifiable: boolean
  /** Confidence in the identifiability assessment (0-1) */
  confidence?: number
  /** Valid adjustment sets for causal estimation */
  adjustment_sets?: string[][]
  /** Identified confounders that need adjustment */
  confounders?: string[]
  /** Instrumental variables that can be used */
  instruments?: string[]
  /** Validation warnings/suggestions */
  warnings?: string[]
}

/**
 * Edge sensitivity data from PLoT enrichment
 */
export interface PLoTEdgeSensitivity {
  /** Edge identifier */
  edge_id: string
  /** Source node */
  from: string
  /** Target node */
  to: string
  /** Overall sensitivity score (0-1, higher = more sensitive) */
  sensitivity_score: number
  /** Sensitivity to edge existence uncertainty */
  existence_sensitivity?: number
  /** Sensitivity to edge magnitude uncertainty */
  magnitude_sensitivity?: number
}

/**
 * Factor sensitivity data from PLoT enrichment (Phase 1 - deep mode only)
 * From ISL /robustness/analyze/v2 endpoint
 */
export interface PLoTFactorSensitivity {
  /** Factor node ID */
  factor_id: string
  /** Sensitivity score (0-1, higher = more sensitive) */
  sensitivity_score: number
  /** Direction of impact on outcome */
  direction: 'positive' | 'negative' | 'mixed'
}

/**
 * Sensitivity analysis data from PLoT enrichment
 * Contains robustness assessment, sensitive edges, and factor sensitivity
 */
export interface PLoTSensitivityAnalysis {
  /** Overall robustness label (derived from analysis) */
  overall_robustness?: 'robust' | 'moderate' | 'fragile' | number
  /** Per-edge sensitivity data (from ISL /causal/sensitivity/detailed) */
  edges: PLoTEdgeSensitivity[]
  /** Per-factor sensitivity data (from ISL /robustness/analyze/v2 - deep mode only) */
  factors?: PLoTFactorSensitivity[]
  /** Top driver node IDs */
  top_drivers?: string[]
  /** Edge IDs that are particularly fragile (can flip the decision) */
  fragile_edges?: string[]
  /** Edge IDs that are robust (stable relationships) */
  robust_edges?: string[]
}

/**
 * Metadata about the ISL enrichment call
 */
export interface PLoTEnrichmentMetadata {
  /** Whether ISL was called for this request */
  isl_enabled: boolean
  /** Detail level used (affects what enrichment is available) */
  detail_level: 'quick' | 'standard' | 'deep'
  /** ISL call latency in milliseconds */
  isl_latency_ms?: number
  /** Whether ISL returned degraded results (timeout/error) */
  isl_degraded?: boolean
  /** ISL endpoints that were called (for debugging) */
  isl_endpoints_called?: string[]
  /** Factor sensitivity availability status */
  factor_sensitivity_status?: 'available' | 'unavailable' | 'skipped'
  /** Number of factors with sensitivity data */
  factor_sensitivity_count?: number
}

/**
 * Full enrichment data from PLoT response
 */
export interface PLoTEnrichment {
  /** Causal validation results (standard/deep mode) */
  causal_validation?: PLoTCausalValidation
  /** Sensitivity analysis results (deep mode only) */
  sensitivity_analysis?: PLoTSensitivityAnalysis
  /** Metadata about the enrichment call */
  metadata: PLoTEnrichmentMetadata
}

/**
 * Extended PLoT response that includes enrichment data
 */
export interface PLoTResponseWithEnrichment {
  /** Standard PLoT result fields */
  result: {
    answer: string
    confidence: number
    explanation: string
    summary?: {
      conservative: number
      likely: number
      optimistic: number
      units?: string
    }
    response_hash?: string
    seed?: number
    option_probabilities?: Record<string, { goal_probability: number; confidence: number }>
  }
  execution_ms: number

  /**
   * ISL enrichment data (when PLoT calls ISL internally)
   * Availability depends on detail_level:
   * - quick: no enrichment (or minimal metadata only)
   * - standard: validation only
   * - deep: validation + sensitivity
   */
  enrichment?: PLoTEnrichment
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a PLoT response contains enrichment data
 */
export function hasEnrichment(
  response: PLoTResponseWithEnrichment | null | undefined
): response is PLoTResponseWithEnrichment & { enrichment: PLoTEnrichment } {
  if (response === null || response === undefined) return false
  if (typeof response.enrichment !== 'object' || response.enrichment === null) return false

  const enrichment = response.enrichment

  // Validate metadata exists and has required shape
  if (!('metadata' in enrichment)) return false
  if (typeof enrichment.metadata !== 'object' || enrichment.metadata === null) return false

  // Validate metadata has required fields
  const metadata = enrichment.metadata as Record<string, unknown>
  if (typeof metadata.isl_enabled !== 'boolean') return false
  if (!['quick', 'standard', 'deep'].includes(metadata.detail_level as string)) return false

  return true
}

/**
 * Check if enrichment contains sensitivity analysis data (edges)
 */
export function hasSensitivityAnalysis(
  enrichment: PLoTEnrichment | null | undefined
): enrichment is PLoTEnrichment & { sensitivity_analysis: PLoTSensitivityAnalysis } {
  return (
    enrichment !== null &&
    enrichment !== undefined &&
    enrichment.sensitivity_analysis !== null &&
    enrichment.sensitivity_analysis !== undefined &&
    Array.isArray(enrichment.sensitivity_analysis.edges)
  )
}

/**
 * Check if enrichment contains robustness edge data (fragile_edges/robust_edges)
 * These may exist even when edge sensitivity analysis is empty.
 */
export function hasRobustnessEdges(
  enrichment: PLoTEnrichment | null | undefined
): boolean {
  if (!enrichment?.sensitivity_analysis) return false
  const sa = enrichment.sensitivity_analysis
  return (
    (Array.isArray(sa.fragile_edges) && sa.fragile_edges.length > 0) ||
    (Array.isArray(sa.robust_edges) && sa.robust_edges.length > 0)
  )
}

/**
 * Check if enrichment contains factor sensitivity data (Phase 1)
 */
export function hasFactorSensitivity(
  enrichment: PLoTEnrichment | null | undefined
): boolean {
  return (
    hasSensitivityAnalysis(enrichment) &&
    Array.isArray(enrichment.sensitivity_analysis.factors) &&
    enrichment.sensitivity_analysis.factors.length > 0
  )
}

/**
 * Check if enrichment contains causal validation data
 */
export function hasCausalValidation(
  enrichment: PLoTEnrichment | null | undefined
): enrichment is PLoTEnrichment & { causal_validation: PLoTCausalValidation } {
  return (
    enrichment !== null &&
    enrichment !== undefined &&
    enrichment.causal_validation !== null &&
    enrichment.causal_validation !== undefined &&
    typeof enrichment.causal_validation.identifiable === 'boolean'
  )
}

/**
 * Check if ISL enrichment is degraded (timeout/error)
 */
export function isEnrichmentDegraded(
  enrichment: PLoTEnrichment | null | undefined
): boolean {
  return enrichment?.metadata?.isl_degraded === true
}

/**
 * Check if enrichment detail level supports sensitivity analysis
 */
export function supportsSensitivityAnalysis(
  enrichment: PLoTEnrichment | null | undefined
): boolean {
  return enrichment?.metadata?.detail_level === 'deep'
}

/**
 * Check if enrichment detail level supports validation
 */
export function supportsValidation(
  enrichment: PLoTEnrichment | null | undefined
): boolean {
  const level = enrichment?.metadata?.detail_level
  return level === 'standard' || level === 'deep'
}

// =============================================================================
// Adapter Functions: Sensitivity → Robustness
// =============================================================================

/**
 * Derive robustness label from overall robustness score
 */
function deriveRobustnessLabel(score: number | undefined): RobustnessLabel {
  if (score === undefined) return 'moderate'
  if (score >= 0.7) return 'robust'
  if (score >= 0.4) return 'moderate'
  return 'fragile'
}

/**
 * Adapt PLoT edge sensitivity to UI SensitiveParameter format
 */
function adaptEdgeToSensitiveParam(edge: PLoTEdgeSensitivity): SensitiveParameter {
  return {
    node_id: edge.from, // Use source node as the "parameter"
    label: `${edge.from} → ${edge.to}`,
    current_value: 0.5, // PLoT doesn't provide current value, use neutral default
    flip_threshold: edge.sensitivity_score > 0.7 ? 0.3 : 0.5, // Derive from sensitivity
    direction: 'increase', // Default direction
    sensitivity: edge.sensitivity_score,
    explanation: edge.magnitude_sensitivity !== undefined
      ? `Magnitude sensitivity: ${(edge.magnitude_sensitivity * 100).toFixed(0)}%`
      : undefined,
  }
}

/**
 * Adapt PLoT factor sensitivity to UI SensitiveParameter format
 *
 * Direction mapping:
 * - 'positive': Higher values increase outcome → 'increase'
 * - 'negative': Higher values decrease outcome → 'decrease'
 * - 'mixed': Non-monotonic relationship → defaults to 'increase' with explanatory note
 *
 * @internal Exported for testing
 */
export function adaptFactorToSensitiveParam(factor: PLoTFactorSensitivity): SensitiveParameter {
  // Map PLoT direction to UI direction (UI only supports increase/decrease)
  // For 'mixed' direction, we default to 'increase' but add context in explanation
  const uiDirection: 'increase' | 'decrease' =
    factor.direction === 'negative' ? 'decrease' : 'increase'

  // Build explanation based on direction type
  const explanation =
    factor.direction === 'mixed'
      ? 'Non-monotonic impact: effect varies with value'
      : `Impact direction: ${factor.direction}`

  return {
    node_id: factor.factor_id,
    label: factor.factor_id, // Will be enhanced with node labels in UI
    current_value: 0.5, // Placeholder - actual value from node
    flip_threshold: factor.sensitivity_score > 0.7 ? 0.3 : 0.5,
    direction: uiDirection,
    sensitivity: factor.sensitivity_score,
    explanation,
  }
}

/**
 * Extract robustness data from PLoT enrichment
 *
 * Returns null if:
 * - Feature flag is disabled
 * - Enrichment is not present or degraded
 * - Sensitivity data cannot be extracted
 *
 * When this returns null, callers should fall back to direct ISL calls.
 */
export function extractRobustnessFromEnrichment(
  response: PLoTResponseWithEnrichment | null | undefined
): RobustnessResult | null {
  // Check feature flag first
  if (!isPlotEnrichmentEnabled()) {
    return null
  }

  // Check if enrichment exists
  if (!hasEnrichment(response)) {
    if (import.meta.env.DEV) {
      console.log('[PLoT Enrichment] No enrichment in response')
    }
    return null
  }

  const enrichment = response.enrichment

  // P0-3: Debug logging for CEE v2 data flow verification
  if (import.meta.env.DEV) {
    console.log('[FactorSensitivity] enrichment:', {
      hasFactors: (enrichment?.sensitivity_analysis?.factors?.length ?? 0) > 0,
      factorCount: enrichment?.sensitivity_analysis?.factors?.length ?? 0,
      factorStatus: enrichment?.metadata?.factor_sensitivity_status,
      schemaVersion: (response as { schema_version?: string })?.schema_version,
      detailLevel: enrichment?.metadata?.detail_level,
    })
  }

  // Check for degraded state
  if (isEnrichmentDegraded(enrichment)) {
    if (import.meta.env.DEV) {
      console.warn('[PLoT Enrichment] ISL returned degraded results')
    }
    return null
  }

  // Check if sensitivity analysis OR robustness edges are available
  const hasEdgeSensitivity = hasSensitivityAnalysis(enrichment)
  const hasRobustness = hasRobustnessEdges(enrichment)

  if (!hasEdgeSensitivity && !hasRobustness) {
    if (import.meta.env.DEV) {
      console.log(
        '[PLoT Enrichment] No sensitivity_analysis or robustness edges (detail_level:',
        enrichment.metadata.detail_level,
        ')'
      )
    }
    return null
  }

  try {
    // Access sensitivity_analysis (may have empty edges but fragile_edges/robust_edges)
    const sensitivity = enrichment.sensitivity_analysis ?? { edges: [] }

    // Extract robustness edge counts (from V2 robustness data)
    const fragileEdges = Array.isArray(sensitivity.fragile_edges) ? sensitivity.fragile_edges : []
    const robustEdges = Array.isArray(sensitivity.robust_edges) ? sensitivity.robust_edges : []

    // Adapt edge sensitivities to UI format (top 5 most sensitive)
    const edges = Array.isArray(sensitivity.edges) ? sensitivity.edges : []
    const sortedEdges = [...edges].sort(
      (a, b) => b.sensitivity_score - a.sensitivity_score
    )
    const topEdgeParams = sortedEdges.slice(0, 5).map(adaptEdgeToSensitiveParam)

    // Adapt factor sensitivities to UI format (Phase 1 - deep mode)
    const factors = sensitivity.factors ?? []
    const sortedFactors = [...factors].sort(
      (a, b) => b.sensitivity_score - a.sensitivity_score
    )
    const topFactorParams = sortedFactors.slice(0, 5).map(adaptFactorToSensitiveParam)

    // Combine edge and factor sensitivities (factors first as more actionable)
    const allSensitiveParams = [...topFactorParams, ...topEdgeParams].slice(0, 8)

    // Derive robustness label from:
    // 1. String label if provided
    // 2. Numeric score if provided
    // 3. fragile/robust edge ratio as fallback
    let robustnessLabel: RobustnessLabel
    if (typeof sensitivity.overall_robustness === 'string') {
      robustnessLabel = sensitivity.overall_robustness as RobustnessLabel
    } else if (typeof sensitivity.overall_robustness === 'number') {
      robustnessLabel = deriveRobustnessLabel(sensitivity.overall_robustness)
    } else if (fragileEdges.length > 0 || robustEdges.length > 0) {
      // Derive from edge counts
      const totalEdges = fragileEdges.length + robustEdges.length
      const robustRatio = totalEdges > 0 ? robustEdges.length / totalEdges : 0.5
      if (robustRatio >= 0.7) robustnessLabel = 'robust'
      else if (robustRatio >= 0.3) robustnessLabel = 'moderate'
      else robustnessLabel = 'fragile'
    } else {
      robustnessLabel = 'moderate'
    }

    // Build robustness result with both edge and factor sensitivity
    const result: RobustnessResult = {
      option_rankings: [],
      recommendation: {
        option_id: '',
        confidence: 'medium',
        recommendation_status: 'uncertain',
      },
      sensitivity: allSensitiveParams,
      robustness_label: robustnessLabel,
      robustness_bounds: [],
      value_of_information: [], // VOI not included in Phase 1
      narrative: generateNarrativeFromSensitivity(
        { ...sensitivity, edges: edges, fragile_edges: fragileEdges },
        robustnessLabel
      ),
      // Include raw edge counts for UI display
      fragile_edge_count: fragileEdges.length,
      robust_edge_count: robustEdges.length,
    }

    if (import.meta.env.DEV) {
      console.log('[PLoT Enrichment] Extracted robustness from enrichment:', {
        edgeCount: edges.length,
        factorCount: factors.length,
        fragileEdgeCount: fragileEdges.length,
        robustEdgeCount: robustEdges.length,
        robustnessLabel,
        result,
      })
    }

    return result
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[PLoT Enrichment] Failed to extract robustness:', error)
    }
    return null
  }
}

/**
 * Generate a narrative from sensitivity data
 */
function generateNarrativeFromSensitivity(
  sensitivity: PLoTSensitivityAnalysis,
  label: RobustnessLabel
): string {
  const fragileEdgeCount = sensitivity.fragile_edges?.length ?? 0
  const factorCount = sensitivity.factors?.length ?? 0
  const topDrivers = sensitivity.top_drivers?.slice(0, 3).join(', ') ?? 'unknown factors'

  // Include factor info in narrative
  const factorInfo = factorCount > 0
    ? `${factorCount} factor${factorCount === 1 ? '' : 's'} analyzed for sensitivity. `
    : ''

  switch (label) {
    case 'robust':
      return `${factorInfo}The analysis is robust to parameter uncertainty. Key drivers are ${topDrivers}.`
    case 'moderate':
      return `${factorInfo}The analysis shows moderate sensitivity to some parameters. ${fragileEdgeCount > 0 ? `${fragileEdgeCount} edges are particularly sensitive.` : ''} Key drivers are ${topDrivers}.`
    case 'fragile':
      return `${factorInfo}The recommendation is sensitive to parameter values. ${fragileEdgeCount} edges could flip the outcome. Consider reducing uncertainty in ${topDrivers}.`
  }
}

// =============================================================================
// Adapter Functions: Causal Validation
// =============================================================================

/**
 * Extract validation data from PLoT enrichment
 */
export function extractValidationFromEnrichment(
  response: PLoTResponseWithEnrichment | null | undefined
): ISLValidationResponse | null {
  // Check feature flag first
  if (!isPlotEnrichmentEnabled()) {
    return null
  }

  // Check if enrichment exists
  if (!hasEnrichment(response)) {
    return null
  }

  const enrichment = response.enrichment

  // Check for degraded state
  if (isEnrichmentDegraded(enrichment)) {
    return null
  }

  // Check if causal validation is available
  if (!hasCausalValidation(enrichment)) {
    if (import.meta.env.DEV) {
      console.log(
        '[PLoT Enrichment] No causal_validation (detail_level:',
        enrichment.metadata.detail_level,
        ')'
      )
    }
    return null
  }

  try {
    const validation = enrichment.causal_validation

    // Transform to ISLValidationResponse format
    const suggestions = validation.warnings?.map((warning, idx) => ({
      id: `warning-${idx}`,
      type: 'logic_error' as const,
      severity: 'warning' as const,
      message: warning,
      affectedNodes: validation.confounders ?? [],
    })) ?? []

    // Add identifiability suggestion if not identifiable
    if (!validation.identifiable) {
      suggestions.unshift({
        id: 'identifiability',
        type: 'logic_error' as const,
        severity: 'error' as const,
        message: 'Causal effect is not identifiable from the current graph structure. Consider adding instrumental variables or adjusting for confounders.',
        affectedNodes: validation.confounders ?? [],
      })
    }

    const result: ISLValidationResponse = {
      valid: validation.identifiable,
      suggestions,
      graph_health: {
        completeness: validation.identifiable ? 0.8 : 0.5,
        connectivity: 1.0,
        logical_consistency: validation.confidence ?? 0.7,
      },
    }

    if (import.meta.env.DEV) {
      console.log('[PLoT Enrichment] Extracted validation from enrichment:', result)
    }

    return result
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[PLoT Enrichment] Failed to extract validation:', error)
    }
    return null
  }
}

// =============================================================================
// Strategy Pattern for Data Source Selection
// =============================================================================

/**
 * Options for selecting robustness data source
 */
export interface RobustnessDataSourceOptions {
  /** PLoT response that may contain enrichment */
  plotResponse?: PLoTResponseWithEnrichment | null

  /** Callback to fetch from ISL directly (used as fallback) */
  fetchFromISL: () => Promise<RobustnessResult | null>
}

/**
 * Get robustness data from the appropriate source
 *
 * Strategy:
 * 1. If VITE_USE_PLOT_ENRICHMENT is enabled and PLoT response contains enrichment,
 *    extract from PLoT response
 * 2. Otherwise, fall back to direct ISL call
 *
 * This allows gradual migration without breaking existing functionality.
 */
export async function getRobustnessData(
  options: RobustnessDataSourceOptions
): Promise<RobustnessResult | null> {
  const { plotResponse, fetchFromISL } = options

  // Try to extract from PLoT enrichment first (if flag enabled)
  const fromEnrichment = extractRobustnessFromEnrichment(plotResponse)
  if (fromEnrichment !== null) {
    if (import.meta.env.DEV) {
      console.log('[PLoT Enrichment] Using robustness data from PLoT enrichment')
    }
    return fromEnrichment
  }

  // Fall back to direct ISL call
  if (import.meta.env.DEV && isPlotEnrichmentEnabled()) {
    console.log('[PLoT Enrichment] Enrichment not available, falling back to ISL')
  }
  return fetchFromISL()
}

/**
 * Options for selecting validation data source
 */
export interface ValidationDataSourceOptions {
  /** PLoT response that may contain enrichment */
  plotResponse?: PLoTResponseWithEnrichment | null

  /** Callback to fetch from ISL directly (used as fallback) */
  fetchFromISL: () => Promise<ISLValidationResponse | null>
}

/**
 * Get validation data from the appropriate source
 */
export async function getValidationData(
  options: ValidationDataSourceOptions
): Promise<ISLValidationResponse | null> {
  const { plotResponse, fetchFromISL } = options

  // Try to extract from PLoT enrichment first (if flag enabled)
  const fromEnrichment = extractValidationFromEnrichment(plotResponse)
  if (fromEnrichment !== null) {
    if (import.meta.env.DEV) {
      console.log('[PLoT Enrichment] Using validation data from PLoT enrichment')
    }
    return fromEnrichment
  }

  // Fall back to direct ISL call
  if (import.meta.env.DEV && isPlotEnrichmentEnabled()) {
    console.log('[PLoT Enrichment] Validation not available, falling back to ISL')
  }
  return fetchFromISL()
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Log enrichment status for debugging
 *
 * Only logs in DEV mode.
 */
export function logEnrichmentStatus(
  response: PLoTResponseWithEnrichment | null | undefined
): void {
  if (!import.meta.env.DEV) return

  console.group('[PLoT Enrichment] Status')
  console.log('Flag enabled:', isPlotEnrichmentEnabled())
  console.log('Has enrichment:', hasEnrichment(response))

  if (hasEnrichment(response)) {
    const e = response.enrichment
    console.log('Detail level:', e.metadata.detail_level)
    console.log('ISL enabled:', e.metadata.isl_enabled)
    console.log('ISL degraded:', e.metadata.isl_degraded ?? false)
    console.log('ISL latency:', e.metadata.isl_latency_ms ?? 'N/A', 'ms')
    console.log('ISL endpoints called:', e.metadata.isl_endpoints_called ?? [])
    console.log('Has edge sensitivity:', hasSensitivityAnalysis(e))
    console.log('Has factor sensitivity:', hasFactorSensitivity(e))
    console.log('Factor sensitivity status:', e.metadata.factor_sensitivity_status ?? 'N/A')
    console.log('Factor count:', e.sensitivity_analysis?.factors?.length ?? 0)
    console.log('Has validation:', hasCausalValidation(e))
  }

  console.groupEnd()
}

/**
 * Get enrichment availability summary for UI display
 */
export function getEnrichmentAvailability(
  response: PLoTResponseWithEnrichment | null | undefined
): {
  available: boolean
  degraded: boolean
  detailLevel: 'quick' | 'standard' | 'deep' | null
  hasSensitivity: boolean
  hasFactorSensitivity: boolean
  hasValidation: boolean
  factorSensitivityStatus: 'available' | 'unavailable' | 'skipped' | null
  factorSensitivityCount: number
  islEndpointsCalled: string[]
} {
  if (!hasEnrichment(response)) {
    return {
      available: false,
      degraded: false,
      detailLevel: null,
      hasSensitivity: false,
      hasFactorSensitivity: false,
      hasValidation: false,
      factorSensitivityStatus: null,
      factorSensitivityCount: 0,
      islEndpointsCalled: [],
    }
  }

  const e = response.enrichment
  const hasFactors = hasFactorSensitivity(e)
  return {
    available: true,
    degraded: isEnrichmentDegraded(e),
    detailLevel: e.metadata.detail_level,
    hasSensitivity: hasSensitivityAnalysis(e),
    hasFactorSensitivity: hasFactors,
    hasValidation: hasCausalValidation(e),
    factorSensitivityStatus: e.metadata.factor_sensitivity_status ?? (hasFactors ? 'available' : null),
    factorSensitivityCount: e.metadata.factor_sensitivity_count ?? (e.sensitivity_analysis?.factors?.length ?? 0),
    islEndpointsCalled: e.metadata.isl_endpoints_called ?? [],
  }
}

// =============================================================================
// Legacy exports for backward compatibility
// =============================================================================

/** @deprecated Use PLoTEnrichment instead */
export type PLoTEnrichmentRaw = PLoTEnrichment

/** @deprecated Use RobustnessDataSourceOptions instead */
export type DataSourceOptions = RobustnessDataSourceOptions

// Legacy type guards (for tests)
export function hasRobustnessAnalysis(
  enrichment: PLoTEnrichment | null | undefined
): boolean {
  return hasSensitivityAnalysis(enrichment)
}

export function hasValidation(
  enrichment: PLoTEnrichment | null | undefined
): boolean {
  return hasCausalValidation(enrichment)
}

export function hasConformal(
  _enrichment: PLoTEnrichment | null | undefined
): boolean {
  // PLoT enrichment doesn't include conformal predictions
  // Those are only available via direct ISL calls
  return false
}
