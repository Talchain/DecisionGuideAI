/**
 * Robustness Mapper
 *
 * Maps raw robustness data to typed MappedRobustness objects.
 *
 * Key contracts:
 * - switchProbability is FLIP probability — no inversion, direct value
 * - Full edge objects preserved (fromLabel, toLabel, alternativeWinnerLabel)
 * - Missing labels → undefined (not empty string)
 */

import type {
  BadgeColour,
  DataSourcePath,
  MappedFragileEdge,
  MappedRobustness,
  RawFragileEdge,
  RawRobustness,
  RobustnessLevel,
} from './types'
import { ROBUSTNESS_LEVEL_DISPLAY, type RobustnessDisplayConfig } from './constants'
import {
  asArray,
  asOptionalBoolean,
  asOptionalNumber,
  asOptionalString,
  emptyToUndefined,
  firstDefined,
  normaliseRobustnessLevel,
} from './utils'

// =============================================================================
// Fragile Edge Mapping
// =============================================================================

/**
 * Map a single raw fragile edge to typed MappedFragileEdge.
 *
 * Handles multiple field name aliases from different data sources.
 * switchProbability is preserved directly — no inversion.
 */
function mapFragileEdge(edge: RawFragileEdge): MappedFragileEdge {
  // Extract edge ID with fallbacks
  const edgeId = firstDefined(
    asOptionalString(edge.edge_id),
    asOptionalString(edge.edgeId)
  ) ?? ''

  // Extract source node ID
  const fromId = firstDefined(
    asOptionalString(edge.from_id),
    asOptionalString(edge.fromId),
    asOptionalString(edge.source)
  ) ?? ''

  // Extract target node ID
  const toId = firstDefined(
    asOptionalString(edge.to_id),
    asOptionalString(edge.toId),
    asOptionalString(edge.target)
  ) ?? ''

  // Extract labels (may be undefined)
  const fromLabel = emptyToUndefined(
    firstDefined(
      asOptionalString(edge.from_label),
      asOptionalString(edge.fromLabel)
    )
  )

  const toLabel = emptyToUndefined(
    firstDefined(
      asOptionalString(edge.to_label),
      asOptionalString(edge.toLabel)
    )
  )

  // Extract switch probability — direct value, NO inversion
  // ISL contract: switch_probability = P(alternative wins | edge weak)
  // Higher = more likely to flip
  const switchProbability = firstDefined(
    asOptionalNumber(edge.switch_probability),
    asOptionalNumber(edge.switchProbability)
  )

  // Extract alternative winner info
  const alternativeWinnerId = firstDefined(
    asOptionalString(edge.alternative_winner_id),
    asOptionalString(edge.alternativeWinnerId)
  )

  const alternativeWinnerLabel = emptyToUndefined(
    firstDefined(
      asOptionalString(edge.alternative_winner_label),
      asOptionalString(edge.alternativeWinnerLabel),
      asOptionalString(edge.alternativeWinner)
    )
  )

  return {
    edgeId,
    fromId,
    toId,
    fromLabel,
    toLabel,
    switchProbability,
    alternativeWinnerId,
    alternativeWinnerLabel,
  }
}

// =============================================================================
// Main Mapper Function
// =============================================================================

export interface MapRobustnessOptions {
  sourcePath: DataSourcePath
}

/**
 * Map raw robustness object to typed MappedRobustness.
 *
 * Pure function: same input → same output.
 * No mutations of input objects.
 *
 * Returns default empty structure if input is undefined.
 */
export function mapRobustness(
  robustness: RawRobustness | undefined,
  _options: MapRobustnessOptions
): MappedRobustness {
  // Handle missing robustness
  if (!robustness) {
    return {
      level: undefined,
      recommendationStability: undefined,
      rankingStability: undefined,
      isRobust: undefined,
      fragileEdges: [],
      robustEdges: [],
      recommendedOptionId: undefined,
      recommendedOptionLabel: undefined,
    }
  }

  // Extract level with normalisation
  const level = normaliseRobustnessLevel(
    asOptionalString(robustness.level)
  )

  // Extract stability scores
  const recommendationStability = firstDefined(
    asOptionalNumber(robustness.recommendation_stability),
    asOptionalNumber(robustness.recommendationStability)
  )

  const rankingStability = firstDefined(
    asOptionalNumber(robustness.ranking_stability),
    asOptionalNumber(robustness.rankingStability)
  )

  // Extract isRobust flag
  const isRobust = firstDefined(
    asOptionalBoolean(robustness.is_robust),
    asOptionalBoolean(robustness.isRobust)
  )

  // Map fragile edges
  const rawFragileEdges = asArray<RawFragileEdge>(
    robustness.fragile_edges ?? robustness.fragileEdges
  )
  const fragileEdges = rawFragileEdges.map(mapFragileEdge)

  // Extract robust edges (just IDs)
  const robustEdges = asArray<string>(
    robustness.robust_edges ?? robustness.robustEdges
  ).filter((id): id is string => typeof id === 'string')

  // Extract recommended option info
  const recommendedOptionId = firstDefined(
    asOptionalString(robustness.recommended_option_id),
    asOptionalString(robustness.recommendedOptionId)
  )

  const recommendedOptionLabel = emptyToUndefined(
    firstDefined(
      asOptionalString(robustness.recommended_option_label),
      asOptionalString(robustness.recommendedOptionLabel)
    )
  )

  return {
    level,
    recommendationStability,
    rankingStability,
    isRobust,
    fragileEdges,
    robustEdges,
    recommendedOptionId,
    recommendedOptionLabel,
  }
}

// =============================================================================
// Display Helper
// =============================================================================

/**
 * Get display configuration for a robustness level.
 *
 * CRITICAL: Badge MUST derive from robustness.level field, NOT from recommendation_stability.
 * Uses exhaustive switch for type safety — compile error if new levels added.
 *
 * @param level - The robustness level from API response
 * @returns Display config with label and colour
 */
export function getRobustnessDisplay(
  level: RobustnessLevel | null | undefined
): RobustnessDisplayConfig {
  // Handle missing level
  if (!level) {
    return { label: 'Unknown', colour: 'grey' as BadgeColour }
  }

  // Exhaustive switch — compile error if new cases not handled
  switch (level) {
    case 'high':
      return ROBUSTNESS_LEVEL_DISPLAY.high
    case 'moderate':
      return ROBUSTNESS_LEVEL_DISPLAY.moderate
    case 'low':
      return ROBUSTNESS_LEVEL_DISPLAY.low
    case 'very_low':
      return ROBUSTNESS_LEVEL_DISPLAY.very_low
    default: {
      // Exhaustive check — this should never execute if types are correct
      const _exhaustive: never = level
      console.error(`[CONTRACT_VIOLATION] Unknown robustness level: ${level}`)
      return { label: 'Unknown', colour: 'grey' as BadgeColour }
    }
  }
}
