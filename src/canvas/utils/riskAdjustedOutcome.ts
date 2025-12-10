/**
 * Risk-Adjusted Outcome Calculations
 *
 * Computes risk-adjusted outcome values based on user's risk profile.
 * Risk tolerance affects how outcomes are weighted and presented.
 */

import type { RiskProfile, RiskProfilePreset } from '../../adapters/plot/types'

export interface OutcomeBands {
  p10: number  // Conservative / worst case
  p50: number  // Most likely
  p90: number  // Optimistic / best case
}

export interface RiskAdjustedOutcome {
  /** Risk-weighted outcome value */
  adjustedValue: number
  /** Label for the adjusted value */
  label: string
  /** Description of what this value represents */
  description: string
  /** Planning range (low-high) based on risk profile */
  planningRange: { low: number; high: number }
  /** Planning range label */
  planningLabel: string
  /** Recommended action based on risk profile */
  recommendation: string
}

/**
 * Default weights for risk profiles
 * These determine how p10/p50/p90 are combined
 */
const RISK_WEIGHTS: Record<RiskProfilePreset, { p10: number; p50: number; p90: number }> = {
  risk_averse: { p10: 0.5, p50: 0.4, p90: 0.1 },    // Heavy weight on conservative
  neutral: { p10: 0.2, p50: 0.6, p90: 0.2 },        // Balanced
  risk_seeking: { p10: 0.1, p50: 0.4, p90: 0.5 },   // Heavy weight on optimistic
}

/**
 * Compute risk-adjusted outcome from bands and profile
 */
export function computeRiskAdjustedOutcome(
  bands: OutcomeBands,
  profile: RiskProfile | null
): RiskAdjustedOutcome {
  // Default to neutral if no profile
  const preset = profile?.profile || 'neutral'
  const weights = RISK_WEIGHTS[preset]

  // Compute weighted value
  const adjustedValue =
    bands.p10 * weights.p10 +
    bands.p50 * weights.p50 +
    bands.p90 * weights.p90

  // Generate profile-specific labels and ranges
  switch (preset) {
    case 'risk_averse':
      return {
        adjustedValue,
        label: 'Risk-Adjusted Expectation',
        description: 'Weighted towards conservative outcomes',
        planningRange: { low: bands.p10, high: bands.p50 },
        planningLabel: 'Plan for range',
        recommendation: 'Consider the downside scenarios when planning',
      }

    case 'risk_seeking':
      return {
        adjustedValue,
        label: 'Risk-Adjusted Expectation',
        description: 'Weighted towards optimistic outcomes',
        planningRange: { low: bands.p50, high: bands.p90 },
        planningLabel: 'Target range',
        recommendation: 'Focus on capturing the upside potential',
      }

    case 'neutral':
    default:
      return {
        adjustedValue,
        label: 'Expected Outcome',
        description: 'Balanced expectation across scenarios',
        planningRange: {
          low: bands.p10 + (bands.p50 - bands.p10) * 0.5,  // ~p30
          high: bands.p90 - (bands.p90 - bands.p50) * 0.5, // ~p70
        },
        planningLabel: 'Likely range',
        recommendation: 'Plan for a balanced range of outcomes',
      }
  }
}

/**
 * Get the key takeaway message based on risk profile
 */
export function getRiskAdjustedMessage(
  bands: OutcomeBands,
  profile: RiskProfile | null,
  goalDirection: 'maximize' | 'minimize' = 'maximize'
): string {
  const preset = profile?.profile || 'neutral'
  const outcome = computeRiskAdjustedOutcome(bands, profile)

  // Format as percentage (assuming 0-1 probability scale)
  const formatPct = (v: number) => `${Math.round(v * 100)}%`

  switch (preset) {
    case 'risk_averse': {
      const worstCase = formatPct(bands.p10)
      return goalDirection === 'maximize'
        ? `Prepare for as low as ${worstCase} and plan accordingly`
        : `Costs could reach ${formatPct(bands.p90)} in worst case`
    }

    case 'risk_seeking': {
      const bestCase = formatPct(bands.p90)
      return goalDirection === 'maximize'
        ? `You could achieve up to ${bestCase} in favourable conditions`
        : `Best case: costs could be as low as ${formatPct(bands.p10)}`
    }

    case 'neutral':
    default: {
      const expected = formatPct(bands.p50)
      return goalDirection === 'maximize'
        ? `Most likely outcome is ${expected}`
        : `Expected costs are around ${expected}`
    }
  }
}

/**
 * Get emphasis percentile based on risk profile
 * Returns which band to highlight visually
 */
export function getEmphasisBand(
  profile: RiskProfile | null
): 'p10' | 'p50' | 'p90' {
  const preset = profile?.profile || 'neutral'

  switch (preset) {
    case 'risk_averse':
      return 'p10'
    case 'risk_seeking':
      return 'p90'
    case 'neutral':
    default:
      return 'p50'
  }
}
