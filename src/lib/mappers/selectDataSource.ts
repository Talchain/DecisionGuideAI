/**
 * Data Source Selection for Results Pipeline
 *
 * Deterministic precedence logic for selecting the best data source.
 * Returns the source path and any fallbacks applied.
 *
 * Priority:
 * 1. downstream_calls.isl — IF response exists AND factor_sensitivity has real data
 * 2. enrichment — IF exists AND factor_sensitivity has real data
 * 3. top_level — IF factor_sensitivity exists at response root
 * 4. none — log warning, return empty with fallbacksApplied
 */

import type {
  DataSourcePath,
  DataSourceResult,
  RawFactor,
  RawRobustness,
  RawOption,
} from './types'
import { asArray, asObject, asOptionalNumber, debugLog } from './utils'

// =============================================================================
// Source Data Interface
// =============================================================================

export interface SourceData {
  factorSensitivity: RawFactor[]
  robustness: RawRobustness | undefined
  optionComparison: RawOption[]
}

// =============================================================================
// Validity Guards
// =============================================================================

/**
 * Check if a factor has real data (not just placeholders).
 * Real data means at least one numeric field with meaningful value.
 */
function hasRealFactorData(factor: unknown): boolean {
  if (typeof factor !== 'object' || factor === null) return false

  const f = factor as Record<string, unknown>

  // Check numeric fields - any non-zero finite value counts as real data
  // Use Math.abs to handle negative values (direction is stored separately)
  const checkField = (value: unknown): boolean => {
    return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) > 0.001
  }

  return (
    checkField(f.sensitivity_score) ||
    checkField(f.sensitivity) ||
    checkField(f.elasticity) ||
    checkField(f.importance_score)
  )
}

/**
 * Check if a factor array has real data.
 */
function hasRealFactorsData(factors: unknown[]): boolean {
  return factors.some(hasRealFactorData)
}

/**
 * Check if robustness object is valid.
 */
function hasValidRobustness(robustness: unknown): robustness is RawRobustness {
  if (typeof robustness !== 'object' || robustness === null) return false

  const r = robustness as Record<string, unknown>

  // Must have fragile_edges array (even if empty)
  const fragileEdges = r.fragile_edges ?? r.fragileEdges
  return Array.isArray(fragileEdges)
}

// =============================================================================
// Source Extraction Functions
// =============================================================================

/**
 * Extract factors from downstream_calls.isl path.
 */
function extractDownstreamFactors(response: unknown): RawFactor[] {
  const obj = asObject(response)
  if (!obj) return []

  const downstreamCalls = asObject(obj.downstream_calls)
  if (!downstreamCalls) return []

  const isl = asObject(downstreamCalls.isl)
  if (!isl) return []

  const islResponse = asObject(isl.response)
  if (!islResponse) return []

  return asArray<RawFactor>(islResponse.factor_sensitivity)
}

/**
 * Extract robustness from downstream_calls.isl path.
 */
function extractDownstreamRobustness(response: unknown): RawRobustness | undefined {
  const obj = asObject(response)
  if (!obj) return undefined

  const downstreamCalls = asObject(obj.downstream_calls)
  if (!downstreamCalls) return undefined

  const isl = asObject(downstreamCalls.isl)
  if (!isl) return undefined

  const islResponse = asObject(isl.response)
  if (!islResponse) return undefined

  const robustness = asObject(islResponse.robustness)
  return robustness as RawRobustness | undefined
}

/**
 * Extract factors from enrichment path.
 */
function extractEnrichmentFactors(response: unknown): RawFactor[] {
  const obj = asObject(response)
  if (!obj) return []

  const enrichment = asObject(obj.enrichment)
  if (!enrichment) return []

  const sensitivityAnalysis = asObject(enrichment.sensitivity_analysis)
  if (!sensitivityAnalysis) return []

  return asArray<RawFactor>(sensitivityAnalysis.factors)
}

/**
 * Extract robustness from enrichment path.
 */
function extractEnrichmentRobustness(response: unknown): RawRobustness | undefined {
  const obj = asObject(response)
  if (!obj) return undefined

  const enrichment = asObject(obj.enrichment)
  if (!enrichment) return undefined

  const robustness = asObject(enrichment.robustness)
  return robustness as RawRobustness | undefined
}

/**
 * Extract factors from top-level response.
 */
function extractTopLevelFactors(response: unknown): RawFactor[] {
  const obj = asObject(response)
  if (!obj) return []

  return asArray<RawFactor>(obj.factor_sensitivity)
}

/**
 * Extract robustness from top-level response.
 */
function extractTopLevelRobustness(response: unknown): RawRobustness | undefined {
  const obj = asObject(response)
  if (!obj) return undefined

  const robustness = asObject(obj.robustness)
  return robustness as RawRobustness | undefined
}

/**
 * Extract options from option_comparison (always top-level).
 */
function extractOptionComparison(response: unknown): RawOption[] {
  const obj = asObject(response)
  if (!obj) return []

  // Try option_comparison first, then options
  const options = asArray<RawOption>(obj.option_comparison)
  if (options.length > 0) return options

  return asArray<RawOption>(obj.options)
}

// =============================================================================
// Main Selection Function
// =============================================================================

/**
 * Select the best data source for factor sensitivity and robustness.
 *
 * Priority:
 * 1. downstream_calls.isl — IF factor_sensitivity has real data AND robustness exists
 * 2. enrichment — IF factor_sensitivity has real data
 * 3. top_level — IF factor_sensitivity exists
 * 4. none — return empty with fallbacksApplied
 */
export function selectDataSource(response: unknown): DataSourceResult<SourceData> {
  const fallbacksApplied: string[] = []

  // Always extract option_comparison from top-level (it's not nested)
  const optionComparison = extractOptionComparison(response)

  // Path 1: downstream_calls.isl
  const downstreamFactors = extractDownstreamFactors(response)
  const downstreamRobustness = extractDownstreamRobustness(response)

  if (downstreamFactors.length > 0 && hasRealFactorsData(downstreamFactors)) {
    debugLog('selectDataSource', {
      path: 'downstream_calls.isl',
      factorCount: downstreamFactors.length,
      hasRobustness: !!downstreamRobustness,
    })

    // Use downstream robustness if available, otherwise fall back to top-level
    let robustness = downstreamRobustness
    if (!hasValidRobustness(robustness)) {
      robustness = extractTopLevelRobustness(response)
      if (hasValidRobustness(robustness)) {
        fallbacksApplied.push('ROBUSTNESS_FROM_TOP_LEVEL')
      }
    }

    return {
      source: 'downstream_calls.isl',
      data: {
        factorSensitivity: downstreamFactors,
        robustness: robustness as RawRobustness | undefined,
        optionComparison,
      },
      fallbacksApplied,
    }
  }

  // Path 2: enrichment
  const enrichmentFactors = extractEnrichmentFactors(response)
  const enrichmentRobustness = extractEnrichmentRobustness(response)

  if (enrichmentFactors.length > 0 && hasRealFactorsData(enrichmentFactors)) {
    debugLog('selectDataSource', {
      path: 'enrichment',
      factorCount: enrichmentFactors.length,
      hasRobustness: !!enrichmentRobustness,
    })

    fallbacksApplied.push('NO_DOWNSTREAM_ISL')

    // Use enrichment robustness if available, otherwise fall back to top-level
    let robustness = enrichmentRobustness
    if (!hasValidRobustness(robustness)) {
      robustness = extractTopLevelRobustness(response)
      if (hasValidRobustness(robustness)) {
        fallbacksApplied.push('ROBUSTNESS_FROM_TOP_LEVEL')
      }
    }

    return {
      source: 'enrichment',
      data: {
        factorSensitivity: enrichmentFactors,
        robustness: robustness as RawRobustness | undefined,
        optionComparison,
      },
      fallbacksApplied,
    }
  }

  // Path 3: top_level
  const topLevelFactors = extractTopLevelFactors(response)
  const topLevelRobustness = extractTopLevelRobustness(response)

  if (topLevelFactors.length > 0) {
    debugLog('selectDataSource', {
      path: 'top_level',
      factorCount: topLevelFactors.length,
      hasRobustness: !!topLevelRobustness,
    })

    fallbacksApplied.push('NO_DOWNSTREAM_ISL')
    fallbacksApplied.push('NO_ENRICHMENT')

    // Check if top-level has real data
    if (!hasRealFactorsData(topLevelFactors)) {
      fallbacksApplied.push('NO_REAL_FACTOR_DATA')
    }

    return {
      source: 'top_level',
      data: {
        factorSensitivity: topLevelFactors,
        robustness: topLevelRobustness as RawRobustness | undefined,
        optionComparison,
      },
      fallbacksApplied,
    }
  }

  // Path 4: none - no valid data source found
  debugLog('selectDataSource', {
    path: 'none',
    warning: 'No factor sensitivity data found in any path',
  })

  if (import.meta.env?.DEV) {
    console.warn('[selectDataSource] No factor sensitivity data found in response')
  }

  fallbacksApplied.push('NO_FACTOR_SENSITIVITY')

  return {
    source: 'none',
    data: {
      factorSensitivity: [],
      robustness: extractTopLevelRobustness(response) as RawRobustness | undefined,
      optionComparison,
    },
    fallbacksApplied,
  }
}
