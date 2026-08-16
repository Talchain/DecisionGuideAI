/**
 * PLoT V2 API Exports
 *
 * Re-exports request/response SHAPE helpers for the V2 analysis contract.
 * The direct `/v2/run` transport was retired in ROADMAP 2.1229 — see the
 * note at the foot of `adapter.ts`.
 */

// Types
export type {
  V2Node,
  V2Edge,
  V2Option,
  V2RunRequest,
  V2Outcome,
  V2OptionResult,
  V2OptionComparison,
  V2Critique,
  V2Driver,
  V2Robustness,
  V2RunResponse,
  V2RunError,
  V2RunResult,
} from './types'

// Type guards and constants
export {
  isBlockedResponse,
  isFailedAnalysis,
  isSuccessfulAnalysis,
  isSuccessResponse, // deprecated, use isSuccessfulAnalysis
  STD_FLOOR,
  DEFAULT_STD,
  DEFAULT_SEED,
  // Runtime validation guards
  validateV2RunResponse,
  validateV2RunResponseFull,
  validateV2RunError,
  isValidV2RunResponse,
  isValidV2RunError,
  sanitizeV2RunResponse,
} from './types'

export type { ValidationResult } from './types'

// Adapter functions
export {
  buildV2Request,
  buildV2RequestFromAnalysisReady,
  translateV2Response,
  extractOptionsFromNodes,
  reconcileOptionsWithCanvasNodes,
  reconcileOptionsWithCanvasNodesDetailed,
  uiOptionToV2Option,
  ceeOptionToUIOption,
  ceeOptionToV2Option,
  getOptionsFromAnalysisReady,
  transformNodeToV2,
  transformEdgeToV2,
  transformEdgeToV2Strict,
  validateEdgeData,
  validateAllEdges,
  validateOptionsHaveInterventions,
  flattenInterventions,
  clearStrengthCorrections,
  EdgeValidationError,
  InterventionValidationError,
} from './adapter'

export type { BuildV2RequestOptions } from './adapter'
