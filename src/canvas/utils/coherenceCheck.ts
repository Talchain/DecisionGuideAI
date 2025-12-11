/**
 * Coherence Check Utilities
 *
 * Detects contradictions between recommendation headlines and outcome descriptions.
 * Task 1.6: Ensures UI doesn't display contradictory information.
 */

export interface CoherenceCheckResult {
  isCoherent: boolean
  /** Specific contradiction detected */
  contradiction?: {
    type: 'sentiment_mismatch' | 'direction_mismatch' | 'outcome_mismatch'
    description: string
    recommendationText: string
    outcomeText: string
  }
}

// Positive action keywords
const POSITIVE_ACTION_PATTERNS = [
  /proceed with/i,
  /recommend/i,
  /choose/i,
  /select/i,
  /go with/i,
  /implement/i,
  /adopt/i,
  /pursue/i,
  /invest in/i,
  /best option/i,
  /optimal/i,
  /favorable/i,
  /outperforms/i,
  /better than/i,
]

// Negative outcome keywords
const NEGATIVE_OUTCOME_PATTERNS = [
  /\bdecrease\b/i,
  /\bdecline\b/i,
  /\bworsen\b/i,
  /\blower\b/i,
  /\breduce[sd]?\b/i,
  /\bnegative\b/i,
  /\bfail[s]?\b/i,
  /\bloss\b/i,
  /\brisk[sy]?\b/i,
  /\bworse\b/i,
  /\bdrop\b/i,
  /\bunderperform/i,
  /\bunfavorable/i,
]

// Positive outcome keywords
const POSITIVE_OUTCOME_PATTERNS = [
  /\bincrease\b/i,
  /\bimprove\b/i,
  /\bgrow(th)?\b/i,
  /\bhigher\b/i,
  /\bgain\b/i,
  /\bpositive\b/i,
  /\bsuccess/i,
  /\bbetter\b/i,
  /\brise\b/i,
  /\bfavorable\b/i,
  /\boutperform/i,
]

/**
 * Check if text matches any patterns in the list
 */
function matchesPatterns(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text))
}

/**
 * Detect sentiment of text (positive, negative, neutral)
 */
function detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const hasPositive = matchesPatterns(text, POSITIVE_OUTCOME_PATTERNS)
  const hasNegative = matchesPatterns(text, NEGATIVE_OUTCOME_PATTERNS)

  if (hasPositive && !hasNegative) return 'positive'
  if (hasNegative && !hasPositive) return 'negative'
  if (hasPositive && hasNegative) return 'neutral' // Mixed signals
  return 'neutral'
}

/**
 * Check coherence between recommendation headline and outcome description
 *
 * Detects cases like:
 * - Headline says "Proceed with X" but outcome says "likely to decrease"
 * - Recommendation is positive but outcome sentiment is negative
 */
export function checkRecommendationCoherence(
  recommendationHeadline: string | null | undefined,
  outcomeDescription: string | null | undefined,
  outcomeValue?: number | null
): CoherenceCheckResult {
  // If either is missing, assume coherent (can't check)
  if (!recommendationHeadline || !outcomeDescription) {
    return { isCoherent: true }
  }

  const isPositiveRecommendation = matchesPatterns(recommendationHeadline, POSITIVE_ACTION_PATTERNS)
  const outcomeSentiment = detectSentiment(outcomeDescription)

  // Check for sentiment mismatch
  if (isPositiveRecommendation && outcomeSentiment === 'negative') {
    return {
      isCoherent: false,
      contradiction: {
        type: 'sentiment_mismatch',
        description: 'Recommendation suggests proceeding, but outcome indicates negative results',
        recommendationText: recommendationHeadline,
        outcomeText: outcomeDescription,
      },
    }
  }

  // Check for outcome value contradiction
  // If outcome value is very low (<25%) but recommendation is strongly positive
  if (
    outcomeValue !== null &&
    outcomeValue !== undefined &&
    outcomeValue < 25 &&
    isPositiveRecommendation &&
    !recommendationHeadline.toLowerCase().includes('risk') &&
    !recommendationHeadline.toLowerCase().includes('caution')
  ) {
    return {
      isCoherent: false,
      contradiction: {
        type: 'outcome_mismatch',
        description: `Recommendation is positive but success likelihood is only ${outcomeValue.toFixed(0)}%`,
        recommendationText: recommendationHeadline,
        outcomeText: outcomeDescription,
      },
    }
  }

  return { isCoherent: true }
}

/**
 * Generate a fallback message when contradiction is detected
 */
export function getCoherenceWarningMessage(result: CoherenceCheckResult): string {
  if (result.isCoherent) return ''

  switch (result.contradiction?.type) {
    case 'sentiment_mismatch':
      return 'Results require review — analysis produced unexpected combination of recommendation and outcome'
    case 'outcome_mismatch':
      return 'Results require review — recommendation confidence may not match outcome predictions'
    case 'direction_mismatch':
      return 'Results require review — recommendation direction conflicts with outcome trends'
    default:
      return 'Results require review — please verify analysis outputs'
  }
}
