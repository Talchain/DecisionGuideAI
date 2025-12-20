/**
 * Discrimination Fallback Module
 *
 * Detects when outcome predictions are too close to call and
 * provides appropriate fallback messaging.
 *
 * Used by:
 * - OutputsDock to show fallback text when options don't discriminate
 * - RecommendationCard to adjust messaging
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Outcome prediction from analysis
 */
export interface OutcomePrediction {
  optionId: string
  optionLabel: string
  value: number       // Predicted outcome value
  confidence?: number // 0-1 confidence in prediction
}

/**
 * Discrimination analysis result
 */
export interface DiscriminationResult {
  /** Whether outcomes discriminate (differ by more than threshold) */
  discriminates: boolean

  /** Spread between highest and lowest outcome values */
  spread: number

  /** Fallback message to show when outcomes don't discriminate */
  fallbackMessage: string | null

  /** Suggested actions when outcomes are too close */
  suggestions: string[]

  /** Top option (if any clear winner) */
  topOption: OutcomePrediction | null

  /** All options sorted by value (descending) */
  sortedOptions: OutcomePrediction[]
}

/**
 * Configuration for discrimination detection
 */
export interface DiscriminationConfig {
  /** Minimum spread required to discriminate (percentage points) */
  minSpread: number

  /** Whether to consider confidence in discrimination */
  useConfidence: boolean

  /** Minimum confidence required (if useConfidence is true) */
  minConfidence: number
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default configuration
 */
export const DEFAULT_DISCRIMINATION_CONFIG: DiscriminationConfig = {
  minSpread: 5, // 5 percentage points
  useConfidence: false,
  minConfidence: 0.7,
}

/**
 * Fallback message template
 */
const FALLBACK_MESSAGE = 'Outcomes are too close to call; add more evidence or factors.'

/**
 * Suggested actions when outcomes don't discriminate
 */
const DEFAULT_SUGGESTIONS = [
  'Add more distinguishing factors between options',
  'Gather additional evidence for key drivers',
  'Review edge weights for accuracy',
]

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Calculate spread between highest and lowest values
 */
function calculateSpread(predictions: OutcomePrediction[]): number {
  if (predictions.length < 2) {
    return 0
  }

  const values = predictions.map(p => p.value)
  const max = Math.max(...values)
  const min = Math.min(...values)

  return max - min
}

/**
 * Sort predictions by value (descending)
 */
function sortByValue(predictions: OutcomePrediction[]): OutcomePrediction[] {
  return [...predictions].sort((a, b) => b.value - a.value)
}

/**
 * Check if predictions have sufficient confidence
 */
function hasAdequateConfidence(
  predictions: OutcomePrediction[],
  minConfidence: number
): boolean {
  return predictions.every(p =>
    p.confidence === undefined || p.confidence >= minConfidence
  )
}

/**
 * Generate contextual suggestions based on analysis
 */
function generateSuggestions(
  predictions: OutcomePrediction[],
  spread: number
): string[] {
  const suggestions: string[] = []

  // If spread is very small
  if (spread < 2) {
    suggestions.push('Options appear nearly identical - consider if they are truly distinct')
  }

  // Check for low confidence predictions
  const lowConfidence = predictions.filter(p =>
    p.confidence !== undefined && p.confidence < 0.5
  )
  if (lowConfidence.length > 0) {
    suggestions.push(
      `Increase confidence in: ${lowConfidence.map(p => p.optionLabel).join(', ')}`
    )
  }

  // Add default suggestions if we have room
  const remaining = DEFAULT_SUGGESTIONS.filter(s => !suggestions.includes(s))
  suggestions.push(...remaining.slice(0, 3 - suggestions.length))

  return suggestions.slice(0, 3)
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Analyze outcome predictions for discrimination
 *
 * @param predictions - Outcome predictions for each option
 * @param config - Optional configuration overrides
 * @returns Discrimination analysis result
 *
 * @example
 * const result = analyzeDiscrimination([
 *   { optionId: 'opt_1', optionLabel: 'Option A', value: 72 },
 *   { optionId: 'opt_2', optionLabel: 'Option B', value: 74 },
 * ])
 *
 * if (!result.discriminates) {
 *   showMessage(result.fallbackMessage)
 * }
 */
export function analyzeDiscrimination(
  predictions: OutcomePrediction[],
  config: Partial<DiscriminationConfig> = {}
): DiscriminationResult {
  const mergedConfig = { ...DEFAULT_DISCRIMINATION_CONFIG, ...config }

  // Handle edge cases
  if (predictions.length === 0) {
    return {
      discriminates: false,
      spread: 0,
      fallbackMessage: 'No predictions available',
      suggestions: ['Add options to your model to see predictions'],
      topOption: null,
      sortedOptions: [],
    }
  }

  if (predictions.length === 1) {
    return {
      discriminates: true,
      spread: 0,
      fallbackMessage: null,
      suggestions: [],
      topOption: predictions[0],
      sortedOptions: predictions,
    }
  }

  // Calculate spread
  const spread = calculateSpread(predictions)
  const sortedOptions = sortByValue(predictions)

  // Check discrimination
  const spreadsEnough = spread >= mergedConfig.minSpread

  // Optional confidence check
  const confidenceOk = !mergedConfig.useConfidence ||
    hasAdequateConfidence(predictions, mergedConfig.minConfidence)

  const discriminates = spreadsEnough && confidenceOk

  // Generate result
  if (discriminates) {
    return {
      discriminates: true,
      spread,
      fallbackMessage: null,
      suggestions: [],
      topOption: sortedOptions[0],
      sortedOptions,
    }
  }

  // Doesn't discriminate - return fallback
  return {
    discriminates: false,
    spread,
    fallbackMessage: FALLBACK_MESSAGE,
    suggestions: generateSuggestions(predictions, spread),
    topOption: null,
    sortedOptions,
  }
}

/**
 * Quick check if options discriminate
 */
export function optionsDiscriminate(
  predictions: OutcomePrediction[],
  minSpread: number = DEFAULT_DISCRIMINATION_CONFIG.minSpread
): boolean {
  return analyzeDiscrimination(predictions, { minSpread }).discriminates
}

/**
 * Get fallback message (or null if options discriminate)
 */
export function getDiscriminationFallback(
  predictions: OutcomePrediction[],
  config: Partial<DiscriminationConfig> = {}
): string | null {
  return analyzeDiscrimination(predictions, config).fallbackMessage
}

/**
 * Convert PLoT option_probabilities to OutcomePrediction array
 * Utility for adapting API response format
 */
export function fromOptionProbabilities(
  optionProbabilities: Record<string, { goal_probability: number; confidence?: number }> | undefined,
  optionLabels: Record<string, string> = {}
): OutcomePrediction[] {
  if (!optionProbabilities) {
    return []
  }

  return Object.entries(optionProbabilities).map(([id, data]) => ({
    optionId: id,
    optionLabel: optionLabels[id] || id,
    value: Math.round(data.goal_probability * 100),
    confidence: data.confidence,
  }))
}
