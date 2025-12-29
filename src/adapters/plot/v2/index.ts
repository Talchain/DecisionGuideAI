/**
 * PLoT V2 API Exports
 *
 * Re-exports types and adapter functions for /v2/run endpoint.
 */

// Types
export type {
  V2Node,
  V2Edge,
  V2Option,
  V2RunRequest,
  V2Outcome,
  V2OptionResult,
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
} from './types'

// Adapter functions
export {
  buildV2Request,
  buildV2RequestFromAnalysisReady,
  translateV2Response,
  runV2,
  executeV2Run,
  executeV2RunWithAnalysisReady,
  extractOptionsFromNodes,
  uiOptionToV2Option,
  ceeOptionToUIOption,
  ceeOptionToV2Option,
  getOptionsFromAnalysisReady,
  transformNodeToV2,
  transformEdgeToV2,
  transformEdgeToV2Strict,
  validateEdgeData,
  validateAllEdges,
  EdgeValidationError,
} from './adapter'

export type { V2AdapterConfig, BuildV2RequestOptions } from './adapter'
