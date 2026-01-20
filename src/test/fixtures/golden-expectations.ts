/**
 * Golden Expectations - Expected UI Display Values
 *
 * M0 Contract: Maps golden-run-response.json values to expected UI display.
 * Used by results-panel-contract.test.ts to verify correct data transformation.
 *
 * IMPORTANT: These expectations define the contract between ISL/PLoT responses
 * and UI display. Any changes here require corresponding updates to either
 * the data transformers or the UI components.
 */

// ============================================================================
// Recommendation Section Expectations
// ============================================================================

export const RECOMMENDATION_EXPECTATIONS = {
  /**
   * The recommended option based on win_probability comparison.
   * In golden fixture: opt_increase_with_release has win_probability: 0.68
   */
  recommendedOption: {
    id: 'opt_increase_with_release',
    label: 'Increase price with feature release',
    /** outcome.mean = 45.42, displayed without ×100 */
    expectedDisplay: '~45%',
    /** win_probability = 0.68, displayed as percentage */
    winProbabilityDisplay: '68%',
    /** probability_of_goal = 0.72 */
    goalProbabilityDisplay: '72%',
  },

  /**
   * Range display uses p10/p50/p90 from outcome distribution.
   * Golden fixture: p10=4.2, p50=46.8, p90=69.3
   */
  range: {
    p10Display: '4%',
    p50Display: '47%',
    p90Display: '69%',
  },

  /**
   * Alternative option for comparison.
   */
  alternativeOption: {
    id: 'opt_maintain_price',
    label: 'Maintain current price',
    expectedDisplay: '~19%',
    winProbabilityDisplay: '32%',
  },
}

// ============================================================================
// Drivers Section (Factor Influence) Expectations
// ============================================================================

/**
 * Factor influence display is based on importance_score normalization.
 *
 * CRITICAL CONTRACT:
 * - importance_score is the primary field for influence display
 * - Highest importance_score (1.0) → 100% influence
 * - Other factors scaled proportionally: influence = (importance_score / max) × 100%
 * - Zero importance_score → 0% influence
 *
 * The responseMapper MUST preserve importance_score in the output.
 */
export const DRIVERS_EXPECTATIONS = {
  /**
   * Factors ordered by importance_score (descending).
   * Golden fixture has 5 factors with importance_score: 1.0, 0.62, 0.39, 0.22, 0
   */
  factors: [
    {
      factor_id: 'fac_pro_price',
      label: 'Pro Plan Price',
      importance_score: 1.0,
      /** Normalized: 1.0 / 1.0 = 100% */
      expectedInfluence: '100%',
      direction: 'negative',
      confidence: 0.85,
      confidenceDisplay: '85%',
    },
    {
      factor_id: 'fac_perceived_value',
      label: 'Perceived Value',
      importance_score: 0.62,
      /** Normalized: 0.62 / 1.0 = 62% */
      expectedInfluence: '62%',
      direction: 'positive',
      confidence: 0.72,
      confidenceDisplay: '72%',
    },
    {
      factor_id: 'fac_bundle_release',
      label: 'Feature Bundle Release',
      importance_score: 0.39,
      /** Normalized: 0.39 / 1.0 = 39% */
      expectedInfluence: '39%',
      direction: 'positive',
      confidence: 0.68,
      confidenceDisplay: '68%',
    },
    {
      factor_id: 'fac_market_competition',
      label: 'Market Competition',
      importance_score: 0.22,
      /** Normalized: 0.22 / 1.0 = 22% */
      expectedInfluence: '22%',
      direction: 'negative',
      confidence: 0.55,
      confidenceDisplay: '55%',
    },
    {
      factor_id: 'factor_churn_rate_0',
      label: 'Churn Rate',
      importance_score: 0,
      /** Normalized: 0 / 1.0 = 0% */
      expectedInfluence: '0%',
      direction: 'negative',
      confidence: 0.40,
      confidenceDisplay: '40%',
    },
  ],

  /** Top 3 factors shown by default (expandable to show all) */
  topDriversCount: 3,
  totalDriversCount: 5,
}

// ============================================================================
// Uncertainties Section (Fragile Edges) Expectations
// ============================================================================

export const UNCERTAINTIES_EXPECTATIONS = {
  /**
   * Fragile edges become uncertainty cards.
   * Each card should have ONE action button (not duplicates).
   */
  fragileEdges: [
    {
      from_id: 'fac_pro_price',
      to_id: 'out_mrr',
      from_label: 'Pro Plan Price',
      to_label: 'Monthly Recurring Revenue',
      switch_probability: 0.35,
      /** Flip risk display: 100% - switch_probability */
      flipRiskDisplay: '65% chance this could flip',
      alternative_winner_label: 'Maintain current price',
      shouldShowCard: true,
      /** Single button per card - fixes duplicate button bug */
      buttonCount: 1,
    },
    {
      from_id: 'fac_market_competition',
      to_id: 'out_mrr',
      from_label: 'Market Competition',
      to_label: 'Monthly Recurring Revenue',
      switch_probability: 0.18,
      flipRiskDisplay: '82% chance this could flip',
      alternative_winner_label: 'Maintain current price',
      shouldShowCard: true,
      buttonCount: 1,
    },
  ],

  totalFragileEdges: 2,
  totalRobustEdges: 2,
}

// ============================================================================
// Warning Filtering Expectations
// ============================================================================

/**
 * Technical/internal warnings should be filtered from user-facing UI.
 *
 * CRITICAL CONTRACT:
 * - Messages containing "clamped" are internal ISL corrections
 * - Messages about "option nodes" or "normalization" are internal
 * - These should NOT appear in "What Needs Attention"
 */
export const FILTERING_EXPECTATIONS = {
  /** Total critiques in golden fixture */
  totalCritiques: 8,

  /** Critiques containing "clamped" - should be filtered */
  clampedMessageCount: 5,

  /** Critiques containing "normalization" - should be filtered */
  normalizationMessageCount: 1,

  /** User-facing warnings that SHOULD appear in UI */
  userFacingWarnings: [
    {
      code: 'LOW_EVIDENCE_COVERAGE',
      message: '43% of relationships lack supporting evidence',
      shouldShow: true,
    },
  ],

  /** Expected count in "What Needs Attention" after filtering */
  expectedVisibleWarnings: 1,

  /** Info-level critiques (not warnings) */
  infoCritiques: [
    {
      code: 'COMPETITION_NOT_MODELED',
      message: 'Competitor response not modeled',
      severity: 'info',
    },
  ],
}

// ============================================================================
// Data Flow Contract Summary
// ============================================================================

/**
 * Documents the data transformation contract at each layer.
 *
 * ISL/PLoT Response (golden-run-response.json)
 *     ↓
 * responseMapper.ts: pickFactorSensitivityForUi()
 *   - MUST include importance_score in hasRealData check
 *   - MUST preserve importance_score in output object
 *   - MUST add importance_score to sensitivity_score fallback chain
 *     ↓
 * useResultsSectionData.ts: getRawElasticity()
 *   - Reads: sensitivity_score → importance_score → elasticity → contribution
 *   - Returns numeric value for normalization
 *     ↓
 * useResultsSectionData.ts: computeNormalisedInfluences()
 *   - max = max(abs(rawElasticity))
 *   - normalized = abs(rawElasticity) / max
 *     ↓
 * DriversSection.tsx: ProgressBar
 *   - Displays normalized value as percentage bar
 */
export const CONTRACT_SUMMARY = {
  /**
   * Fields that MUST be preserved through responseMapper.
   */
  requiredFields: [
    'factor_id',
    'node_id',
    'label',
    'sensitivity_score',
    'importance_score', // P0 Fix: Was being dropped
    'direction',
    'confidence',
  ],

  /**
   * Fallback chain for getRawElasticity().
   */
  elasticityFallbackChain: [
    'elasticity',
    'sensitivity_score',
    'sensitivity',
    'importance_score', // P0 Fix: Must be present in mapped object
    'contribution',
  ],

  /**
   * Threshold for "real data" detection.
   */
  realDataThreshold: 0.001,
}
