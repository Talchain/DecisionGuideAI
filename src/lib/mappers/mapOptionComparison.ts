/**
 * Option Comparison Mapper
 *
 * Maps raw option_comparison data to typed MappedOption objects.
 *
 * Key contracts:
 * - expected: arithmetic mean (primary display value)
 * - p10/p50/p90: percentiles (pessimistic/median/optimistic)
 * - winProbability: probability this option wins (0-1)
 * - All optional fields use undefined, not fallback values
 */

import type { DataSourcePath, MappedOption, MappedOptionOutcome, RawOption } from './types'
import {
  asOptionalBoolean,
  asOptionalNumber,
  asOptionalString,
  asObject,
  emptyToUndefined,
  firstDefined,
} from './utils'

// =============================================================================
// Option ID Extraction
// =============================================================================

/**
 * Get canonical option ID from various ID fields.
 * Priority: option_id > optionId > id > normalised(label) > fallback index
 */
function getOptionId(option: RawOption, index: number): string {
  const optionId = firstDefined(
    asOptionalString(option.option_id),
    asOptionalString(option.optionId),
    asOptionalString(option.id)
  )

  if (optionId) return optionId

  // Fall back to label-based ID
  const label = firstDefined(
    asOptionalString(option.label),
    asOptionalString(option.name)
  )

  if (label) {
    return label.toLowerCase().replace(/\s+/g, '_')
  }

  // Last resort
  return `option_${index}`
}

// =============================================================================
// Outcome Extraction
// =============================================================================

/**
 * Extract outcome distribution from option.
 *
 * Handles both nested outcome object and flat fields.
 * No scaling/transforms — values pass through directly.
 *
 * TODO: Move to PLoT post-pilot — outcome calculation should be PLoT's responsibility
 */
function getOutcome(option: RawOption): MappedOptionOutcome {
  // Check for nested outcome object
  const outcomeObj = asObject(option.outcome as unknown)

  if (outcomeObj) {
    // Prefer nested outcome fields
    return {
      expected: firstDefined(
        asOptionalNumber(outcomeObj.expected),
        asOptionalNumber(outcomeObj.mean)
      ),
      p10: asOptionalNumber(outcomeObj.p10),
      p50: asOptionalNumber(outcomeObj.p50),
      p90: asOptionalNumber(outcomeObj.p90),
    }
  }

  // Fall back to flat fields
  return {
    expected: firstDefined(
      asOptionalNumber(option.expected),
      asOptionalNumber(option.mean)
    ),
    p10: asOptionalNumber(option.p10),
    p50: asOptionalNumber(option.p50),
    p90: asOptionalNumber(option.p90),
  }
}

// =============================================================================
// Main Mapper Function
// =============================================================================

export interface MapOptionComparisonOptions {
  sourcePath: DataSourcePath
}

/**
 * Map a single raw option to typed MappedOption.
 */
function mapOption(option: RawOption, index: number): MappedOption {
  const optionId = getOptionId(option, index)

  const label = emptyToUndefined(
    firstDefined(
      asOptionalString(option.label),
      asOptionalString(option.name)
    )
  ) ?? optionId

  const outcome = getOutcome(option)

  const winProbability = firstDefined(
    asOptionalNumber(option.win_probability),
    asOptionalNumber(option.winProbability)
  )

  const goalProbability = firstDefined(
    asOptionalNumber(option.goal_probability),
    asOptionalNumber(option.goalProbability),
    asOptionalNumber(option.probability_of_goal)
  )

  const isRecommended = firstDefined(
    asOptionalBoolean(option.is_recommended),
    asOptionalBoolean(option.isRecommended)
  ) ?? false

  return {
    optionId,
    label,
    outcome,
    winProbability,
    goalProbability,
    isRecommended,
  }
}

/**
 * Map raw option comparison array to typed MappedOption array.
 *
 * Pure function: same input → same output.
 * No mutations of input objects.
 */
export function mapOptionComparison(
  options: RawOption[],
  _options: MapOptionComparisonOptions
): MappedOption[] {
  return options.map(mapOption)
}
