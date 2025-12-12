/**
 * Functional Form Types
 *
 * Brief 11: Types for tiered functional form UX
 */

import type {
  EdgeFunctionType,
  FormConfidence,
  FormProvenance,
} from '../../domain/edges'

/**
 * CEE form recommendation for a single edge
 * Brief 11.1: Confidence-driven UI behaviour
 */
export interface EdgeFormRecommendation {
  /** Edge ID */
  edge_id: string
  /** Source node label */
  source_label: string
  /** Target node label */
  target_label: string
  /** Current form applied */
  current_form: EdgeFunctionType
  /** CEE recommended form */
  recommended_form: EdgeFunctionType
  /** CEE's confidence in the recommendation */
  form_confidence: FormConfidence
  /** Plain language rationale for the recommendation */
  rationale: string
  /** Whether the form was auto-applied (high confidence only) */
  auto_applied: boolean
  /** Provenance source */
  provenance: 'cee'
}

/**
 * Props for AppliedFormsCallout component
 * Brief 11.2: High-confidence applied form callout
 */
export interface AppliedFormsCalloutProps {
  /** Edges where forms were auto-applied */
  appliedForms: EdgeFormRecommendation[]
  /** Callback when user confirms a form */
  onConfirm?: (edgeId: string) => void
  /** Callback when user wants to change a form */
  onChange?: (edgeId: string) => void
  /** Callback when callout is dismissed */
  onDismiss?: () => void
  /** Whether the callout is collapsible */
  collapsible?: boolean
  /** Default expanded state */
  defaultExpanded?: boolean
}

/**
 * Props for FormSuggestionBadge component
 * Brief 11.3: Medium-confidence suggestions
 */
export interface FormSuggestionBadgeProps {
  /** The form recommendation */
  recommendation: EdgeFormRecommendation
  /** Callback when suggestion is applied */
  onApply?: (edgeId: string, form: EdgeFunctionType) => void
  /** Callback when suggestion is dismissed */
  onDismiss?: (edgeId: string) => void
  /** Compact mode for inline display */
  compact?: boolean
}

/**
 * Props for FormSelector component
 * Brief 11.6: Expert mode manual form selection
 */
export interface FormSelectorProps {
  /** Currently selected form */
  value: EdgeFunctionType
  /** Callback when form is changed */
  onChange: (form: EdgeFunctionType) => void
  /** Whether to show as dropdown or radio buttons */
  variant?: 'dropdown' | 'radio'
  /** Disabled state */
  disabled?: boolean
  /** Optional label */
  label?: string
  /** Show descriptions */
  showDescriptions?: boolean
}

/**
 * Multi-form analysis result
 * Brief 11.7: Sensitivity to form assumptions
 */
export interface FormSensitivityResult {
  /** Edge ID */
  edge_id: string
  /** Source node label */
  source_label: string
  /** Target node label */
  target_label: string
  /** Form used in main analysis */
  form_used: EdgeFunctionType
  /** Alternative form tested */
  alternative_form: EdgeFunctionType
  /** Impact on outcome (percentage change) */
  impact_pct: number
  /** Whether this causes recommendation to flip */
  causes_flip: boolean
  /** Description of the impact */
  impact_description?: string
}

/**
 * Props for MultiFormAnalysis component
 * Brief 11.7: Test alternatives UI
 */
export interface MultiFormAnalysisProps {
  /** Sensitivity results */
  results: FormSensitivityResult[]
  /** Loading state */
  loading?: boolean
  /** Error message */
  error?: string | null
  /** Callback when user wants to apply an alternative */
  onApplyAlternative?: (edgeId: string, form: EdgeFunctionType) => void
  /** Callback to run analysis */
  onRunAnalysis?: () => void
}

/**
 * Onboarding state for functional form features
 * Brief 11.8: First-time user onboarding
 */
export interface FormOnboardingState {
  /** Whether the user has seen the onboarding */
  hasSeenOnboarding: boolean
  /** Timestamp of dismissal */
  dismissedAt?: number
}

/**
 * Props for FormOnboardingTooltip component
 */
export interface FormOnboardingTooltipProps {
  /** Callback when dismissed */
  onDismiss: () => void
  /** Whether to show the tooltip */
  show: boolean
}

/**
 * Hook result for useFormRecommendations
 */
export interface UseFormRecommendationsResult {
  /** All form recommendations */
  recommendations: EdgeFormRecommendation[]
  /** High-confidence auto-applied forms */
  appliedForms: EdgeFormRecommendation[]
  /** Medium-confidence suggestions */
  suggestions: EdgeFormRecommendation[]
  /** Loading state */
  loading: boolean
  /** Error message */
  error: string | null
  /** Refresh recommendations */
  refetch: () => Promise<void>
  /** Confirm a form recommendation */
  confirmForm: (edgeId: string) => void
  /** Change a form */
  changeForm: (edgeId: string, form: EdgeFunctionType) => void
  /** Dismiss a suggestion */
  dismissSuggestion: (edgeId: string) => void
}
