/**
 * Quality Tiers Utility
 *
 * Shared quality tier logic for consistent reliability assessment
 * across components (TrustSignal, UnifiedStatusBadge, etc.)
 *
 * Tiers:
 * - Good (70+): Strong causal structure, reliable predictions
 * - Fair (40-70): Directional insights, not precise predictions
 * - Poor (0-40): Missing essential elements, unreliable results
 */

export type QualityTier = 'good' | 'fair' | 'poor'

/**
 * Determine quality tier from a 0-100 score
 */
export function getQualityTier(score: number): QualityTier {
  if (score >= 70) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
}

/**
 * Tier configuration with plain language messaging
 */
export interface TierConfig {
  /** Display label */
  label: string
  /** Main message explaining the tier */
  message: string
  /** Actionable guidance for the user */
  guidance: string
  /** Icon color class (Tailwind) */
  iconColor: string
  /** Background color class (Tailwind) */
  bgColor: string
  /** Border color class (Tailwind) */
  borderColor: string
  /** Text color class (Tailwind) */
  textColor: string
}

/**
 * Tier-specific configurations with plain language messages
 */
export const tierConfig: Record<QualityTier, TierConfig> = {
  good: {
    label: 'Good',
    message: 'Strong causal structure for reliable predictions',
    guidance: 'Your model captures the key relationships. Results can inform decisions.',
    iconColor: 'text-mint-600',
    bgColor: 'bg-mint-50',
    borderColor: 'border-mint-200',
    textColor: 'text-mint-700',
  },
  fair: {
    label: 'Fair',
    message: 'Sufficient for directional insights, not precise predictions',
    guidance: 'Good for understanding trends. Consider adding evidence for important decisions.',
    iconColor: 'text-banana-600',
    bgColor: 'bg-banana-50',
    borderColor: 'border-banana-200',
    textColor: 'text-banana-700',
  },
  poor: {
    label: 'Needs Work',
    message: 'Model missing essential elements. Results may be unreliable.',
    guidance: 'Add more factors and connections before relying on these results.',
    iconColor: 'text-carrot-600',
    bgColor: 'bg-carrot-50',
    borderColor: 'border-carrot-200',
    textColor: 'text-carrot-700',
  },
}

/**
 * Get the tier config for a given score
 */
export function getTierConfig(score: number): TierConfig {
  return tierConfig[getQualityTier(score)]
}

/**
 * Helper to normalize 0-1 values to 0-100 percentage
 * Backend sometimes returns values in 0-1 range
 */
export function normalizeToPercent(value: number | null | undefined): number | null {
  if (value == null) return null
  // If value is already > 1, assume it's already a percentage
  return value > 1 ? Math.round(value) : Math.round(value * 100)
}
