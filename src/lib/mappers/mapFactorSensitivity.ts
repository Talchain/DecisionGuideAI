/**
 * Factor Sensitivity Mapper
 *
 * Maps raw factor_sensitivity data to typed MappedFactor objects.
 *
 * Key transforms:
 * - importance_score → rawInfluence (no scaling, direct value)
 * - confidence → confidence (from exists_probability, multiply by 100 if 0-1 scale)
 * - direction → normalised 'positive' | 'negative'
 *
 * Key contracts:
 * - Missing confidence → confidence: undefined (NOT 0)
 * - confidence: 0 → confidence: 0 (real zero preserved)
 * - value_of_information is preserved separately, NOT used for confidence
 * - All optional fields use undefined, not fallback values
 */

import type { DataSourcePath, MappedFactor, RawFactor } from './types'
import {
  asOptionalNumber,
  asOptionalString,
  normaliseDirection,
  normaliseLabel,
  firstDefined,
} from './utils'

// =============================================================================
// Factor ID Extraction
// =============================================================================

/**
 * Get canonical factor ID from various ID fields.
 * Priority: node_id > factor_id > id > normalised(label) > fallback index
 */
function getFactorId(factor: RawFactor, index: number): string {
  // Check all possible ID fields
  const nodeId = asOptionalString(factor.node_id)
  if (nodeId) return nodeId

  const factorId = asOptionalString(factor.factor_id)
  if (factorId) return factorId

  const id = asOptionalString(factor.id)
  if (id) return id

  // Fall back to normalised label
  const label = asOptionalString(factor.label)
  if (label) return normaliseLabel(label)

  // Last resort: generate unique key
  return `factor_${index}`
}

// =============================================================================
// Raw Influence Extraction
// =============================================================================

/**
 * Extract raw influence value with fallback chain.
 *
 * Priority:
 * 1. elasticity (if present and finite)
 * 2. sensitivity_score (if present and finite, AND not placeholder zero with real importance_score)
 * 3. sensitivity (if present and finite)
 * 4. importance_score (if present and > 0)
 * 5. 0 (fallback when all missing)
 *
 * CRITICAL: sensitivity_score=0 with importance_score > 0 is treated as placeholder.
 * This prevents the "0 blocks fallback" regression.
 *
 * TODO: Move to PLoT post-pilot — influence calculation should be PLoT's responsibility
 */
function getRawInfluence(factor: RawFactor): number {
  // 1. Prefer elasticity if available
  const elasticity = asOptionalNumber(factor.elasticity)
  if (elasticity !== undefined) return elasticity

  // 2. Check sensitivity_score with placeholder detection
  const sensitivityScore = asOptionalNumber(factor.sensitivity_score)
  const importanceScore = asOptionalNumber(factor.importance_score)

  // Skip sensitivity_score if it's 0 but importance_score has real data
  // This prevents placeholder zeros from blocking the fallback
  if (sensitivityScore !== undefined) {
    if (sensitivityScore !== 0 || importanceScore === undefined || importanceScore <= 0) {
      return sensitivityScore
    }
  }

  // 3. Check raw sensitivity
  const sensitivity = asOptionalNumber(factor.sensitivity)
  if (sensitivity !== undefined) return sensitivity

  // 4. Use importance_score if > 0
  if (importanceScore !== undefined && importanceScore > 0) {
    return importanceScore
  }

  // 5. Fallback to 0
  return 0
}

// =============================================================================
// Confidence Extraction
// =============================================================================

/**
 * Extract confidence from the confidence field only.
 *
 * Confidence = path certainty from exists_probability. VOI is a separate metric.
 *
 * Returns:
 * - number (0-100) when confidence is present
 * - undefined when missing
 *
 * CRITICAL:
 * - Missing confidence → undefined (NOT 0)
 * - confidence: 0 → 0 (real zero preserved)
 * - Do NOT use value_of_information here - VOI measures "how much would more info help",
 *   not "how confident are we in this path"
 */
function getConfidence(factor: RawFactor): number | undefined {
  const confidence = asOptionalNumber(factor.confidence)
  if (confidence !== undefined) {
    // Confidence may already be 0-100 or 0-1
    // If <= 1, assume it's 0-1 scale
    if (confidence <= 1) {
      return Math.round(confidence * 100)
    }
    return Math.round(confidence)
  }

  // No confidence data available
  return undefined
}

// =============================================================================
// Main Mapper Function
// =============================================================================

export interface MapFactorSensitivityOptions {
  sourcePath: DataSourcePath
}

/**
 * Map raw factor sensitivity array to typed MappedFactor array.
 *
 * Pure function: same input → same output.
 * No mutations of input objects.
 */
export function mapFactorSensitivity(
  factors: RawFactor[],
  options: MapFactorSensitivityOptions
): MappedFactor[] {
  return factors.map((factor, index): MappedFactor => {
    const factorId = getFactorId(factor, index)
    const label = asOptionalString(factor.label) ?? factorId
    const rawInfluence = getRawInfluence(factor)
    const direction = normaliseDirection(asOptionalString(factor.direction))
    const confidence = getConfidence(factor)
    const importanceRank = asOptionalNumber(factor.importance_rank) ?? 0
    const valueOfInformation = asOptionalNumber(factor.value_of_information)

    return {
      factorId,
      label,
      rawInfluence,
      direction,
      confidence,
      importanceRank,
      valueOfInformation,
    }
  })
}
