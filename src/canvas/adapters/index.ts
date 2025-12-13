/**
 * Canvas Adapters Index
 *
 * Brief 12: Centralized exports for all canvas service adapters
 */

// ISL Robustness Adapter
export {
  adaptISLRobustnessResponse,
  generateFallbackRobustness,
  deriveConfidenceFromSpread,
  inferRobustnessLabel,
} from './islRobustnessAdapter'

export type { ISLRobustnessResponse } from './islRobustnessAdapter'

// ISL Request Adapter
export {
  adaptRobustnessRequest,
  adaptFormRequest,
  buildRobustnessRequest,
  buildFormRequest,
} from './islRequestAdapter'

export type {
  UIRobustnessRequest,
  ISLRobustnessRequest,
  UIEdgeContext,
  CEEEdgeContext,
  UIFormRequest,
  CEEFormRequest,
} from './islRequestAdapter'

// CEE Form Adapter
export {
  adaptCEEFormResponse,
  normalizeFormType,
  mapConfidenceLevel,
  filterChangedForms,
  partitionByConfidence,
  generateFallbackFormRecommendation,
  batchEdges,
  processBatchesWithRateLimit,
  fetchFormRecommendationsWithRateLimit,
  RATE_LIMIT_CONFIG,
} from './ceeFormAdapter'

export type { CEEFormRecommendationResponse } from './ceeFormAdapter'

// Preference Adapter (NOT IMPLEMENTED - documentation only)
export {
  isPreferenceAdapterAvailable,
  getPreferenceIntegrationStatus,
  // Stub functions that throw - available for testing expected failures
  adaptPreferencesToUtility,
  deriveWeightsFromComparisons,
  mapRiskTolerance,
} from './preferenceAdapter'

export type {
  CEEPreferenceOutput,
  PairwiseComparison,
  ObjectiveWeight,
  RiskTolerance,
  LexicographicConstraint,
  ISLUtilitySpec,
  ObjectiveUtility,
  UtilityConstraint,
  RiskModel,
} from './preferenceAdapter'

// Backend Kinds Adapter (existing)
export { toBackendKind, fromBackendKind } from './backendKinds'
