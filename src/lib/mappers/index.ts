/**
 * Results Pipeline Mappers - Orchestrator
 *
 * Thin orchestrator that coordinates data source selection and domain mappers.
 * No business logic here — just routing and composition.
 *
 * Usage:
 * ```typescript
 * import { mapPloTResponse } from '@/lib/mappers'
 *
 * const result = mapPloTResponse(response)
 * // result.factors, result.robustness, result.options, result._meta
 * ```
 */

// Re-export types
export type {
  DataSourcePath,
  DataSourceResult,
  MappedFactor,
  MappedFragileEdge,
  MappedRobustness,
  MappedOption,
  MappedOptionOutcome,
  MappedPloTResponse,
  PipelineMetadata,
  FactorSensitivityResult,
  RobustnessResult,
  OptionComparisonResult,
  RawFactor,
  RawFragileEdge,
  RawRobustness,
  RawOption,
} from './types'

// Re-export utils
export {
  asOptionalNumber,
  asOptionalString,
  asOptionalBoolean,
  asArray,
  asObject,
  emptyToUndefined,
  firstDefined,
  normaliseDirection,
  normaliseRobustnessLevel,
  normaliseLabel,
  isDevMode,
  isDebugMode,
  debugLog,
} from './utils'

// Re-export domain mappers
export { mapFactorSensitivity } from './mapFactorSensitivity'
export { mapRobustness } from './mapRobustness'
export { mapOptionComparison } from './mapOptionComparison'

// Re-export source selection
export { selectDataSource } from './selectDataSource'
export type { SourceData } from './selectDataSource'

// =============================================================================
// Internal imports for orchestration
// =============================================================================

import type { MappedPloTResponse, PipelineMetadata } from './types'
import { selectDataSource } from './selectDataSource'
import { mapFactorSensitivity } from './mapFactorSensitivity'
import { mapRobustness } from './mapRobustness'
import { mapOptionComparison } from './mapOptionComparison'
import { asOptionalString, asObject } from './utils'

// =============================================================================
// Request ID Extraction
// =============================================================================

/**
 * Extract request_id from response metadata.
 */
function extractRequestId(response: unknown): string | undefined {
  const obj = asObject(response)
  if (!obj) return undefined

  // Check meta object
  const meta = asObject(obj.meta)
  if (meta) {
    const requestId = asOptionalString(meta.request_id)
    if (requestId) return requestId
  }

  // Check top-level
  return asOptionalString(obj.request_id)
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Map a raw PLoT response to the canonical mapped structure.
 *
 * This is the main entry point for the results pipeline.
 * Handles source selection, domain mapping, and metadata tracking.
 *
 * Pure function: same input → same output.
 * No side effects except debug logging in dev mode.
 *
 * @param response - Raw response from PLoT /v2/run endpoint
 * @returns Mapped response with factors, robustness, options, and metadata
 */
export function mapPloTResponse(response: unknown): MappedPloTResponse {
  // Step 1: Select data source
  const sourceResult = selectDataSource(response)
  const { source, data, fallbacksApplied } = sourceResult

  // Step 2: Map factor sensitivity
  const factors = mapFactorSensitivity(data.factorSensitivity, {
    sourcePath: source,
  })

  // Step 3: Map robustness
  const robustness = mapRobustness(data.robustness, {
    sourcePath: source,
  })

  // Step 4: Map option comparison
  const options = mapOptionComparison(data.optionComparison, {
    sourcePath: source,
  })

  // Step 5: Build metadata
  const requestId = extractRequestId(response)
  const _meta: PipelineMetadata = {
    sourcePath: source,
    fallbacksApplied,
    requestId,
  }

  return {
    factors,
    robustness,
    options,
    _meta,
  }
}
