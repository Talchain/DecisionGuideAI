/**
 * Functional Form Components
 *
 * Brief 11: Tiered functional form UX components
 *
 * Exports:
 * - AppliedFormsCallout: High-confidence auto-applied forms callout
 * - FormSuggestionBadge: Medium-confidence suggestion badge
 * - FormSelector: Expert mode form selector
 * - FormIndicatorBadge: Visual edge indicator
 * - FormOnboardingTooltip: First-time user onboarding
 * - MultiFormAnalysis: Sensitivity analysis panel
 */

// Components
export { AppliedFormsCallout } from './AppliedFormsCallout'
export { FormSuggestionBadge } from './FormSuggestionBadge'
export { FormSelector } from './FormSelector'
export { FormIndicatorBadge } from './FormIndicatorBadge'
export { FormOnboardingTooltip, useFormOnboarding } from './FormOnboardingTooltip'
export { MultiFormAnalysis } from './MultiFormAnalysis'

// Types
export type {
  EdgeFormRecommendation,
  AppliedFormsCalloutProps,
  FormSuggestionBadgeProps,
  FormSelectorProps,
  FormSensitivityResult,
  MultiFormAnalysisProps,
  FormOnboardingState,
  FormOnboardingTooltipProps,
  UseFormRecommendationsResult,
} from './types'
