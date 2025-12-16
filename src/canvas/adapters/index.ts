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
  // Brief F Task 2: New ISL format transformation functions
  buildISLRobustnessRequest,
  transformNodesToISLGraph,
  transformEdgesToISLGraph,
  extractISLOptions,
  extractParameterUncertainties,
  extractUtility,
  // Brief F Task 5: Range format helper
  extractRange,
} from './islRequestAdapter'

export type {
  UIRobustnessRequest,
  UIEdgeContext,
  CEEEdgeContext,
  UIFormRequest,
  CEEFormRequest,
  UINode,
  UIEdge,
} from './islRequestAdapter'

// CEE Synthesis Adapter (Brief F Task 3C)
export {
  transformISLToCEESynthesis,
  createEmptySynthesisRequest,
} from './ceeSynthesisAdapter'

export type {
  CEESynthesisRequest,
  CEESensitivityItem,
  CEEVoiItem,
  CEETippingPoint,
  CEERobustnessItem,
} from './ceeSynthesisAdapter'

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
