/**
 * @olumi/schemas
 *
 * Canonical TypeScript types and Zod runtime validators for the Olumi platform contract.
 *
 * This package provides:
 * - Type-safe schemas with Zod runtime validation
 * - Contract-boundary schemas use .passthrough() to preserve unknown fields
 * - Consistent naming conventions (snake_case for API, camelCase for UI)
 * - Documentation of intentional field drops at each boundary
 */

// Node schemas
export {
  ObservedStateSchema,
  PriorSchema,
  NodeKindSchema,
  NodeCategorySchema,
  NodeIdSchema,
  NodeIdLooseSchema,
  NodeV3Schema,
  NodeV3LooseSchema,
  isNodeV3,
  isCanonicalNodeId,
  normaliseNodeId,
  tryNormaliseNodeId,
} from './nodes.js'
export type {
  ObservedState,
  Prior,
  NodeKind,
  NodeCategory,
  NodeId,
  NodeIdLoose,
  NodeV3,
  NodeV3Loose,
  NormaliseResult,
} from './nodes.js'

// Edge schemas
export {
  EffectDirectionSchema,
  EdgeStrengthSchema,
  EdgeV3Schema,
  EdgeV3LenientSchema,
  isEdgeV3,
} from './edges.js'
export type {
  EffectDirection,
  EdgeStrength,
  EdgeV3,
  EdgeV3Lenient,
} from './edges.js'

// Option and intervention schemas
export {
  InterventionSourceSchema,
  TargetMatchTypeSchema,
  ConfidenceLevelSchema,
  ValueTypeSchema,
  TargetMatchSchema,
  RichInterventionSchema,
  OptionStatusSchema,
  OptionForAnalysisSchema,
  isOptionForAnalysis,
} from './options.js'
export type {
  InterventionSource,
  TargetMatchType,
  ConfidenceLevel,
  ValueType,
  TargetMatch,
  RichIntervention,
  OptionStatus,
  OptionForAnalysis,
} from './options.js'

// Analysis-ready schemas
export {
  AnalysisReadyStatusSchema,
  AnalysisReadyV3Schema,
  isAnalysisReadyV3,
  isFullyReady,
} from './analysis-ready.js'
export type {
  AnalysisReadyStatus,
  AnalysisReadyV3,
} from './analysis-ready.js'

// Response schemas
export {
  SensitivityDirectionSchema,
  FactorSensitivitySchema,
  FragileEdgeSchema,
  isFactorSensitivity,
  isFragileEdge,
} from './responses.js'
export type {
  SensitivityDirection,
  FactorSensitivity,
  FragileEdge,
} from './responses.js'

// Seed configuration
export {
  SeedSourceSchema,
  SeedConfigSchema,
  isSeedConfig,
} from './seed.js'
export type {
  SeedSource,
  SeedConfig,
} from './seed.js'

// Limits and constants
export {
  MAX_NODES,
  MAX_EDGES,
  MAX_OPTIONS,
  STD_FLOOR,
  STD_CEILING_RATIO,
  STD_CEILING_ABS,
  DEFAULT_STD,
  DEFAULT_EXISTS_PROBABILITY,
  STRENGTH_BOUNDS,
  DEFAULT_SEED,
  LIMITS,
} from './limits.js'

// Graph composite type
export type { GraphV3 } from './graph.js'

// CIL (Contract Integrity Layer) constants
export {
  CIL_WARNING_CODES,
  CIL_WARNING_SEVERITY,
  CIL_THRESHOLDS,
} from './cil.js'
export type {
  CilWarningCode,
  StrengthDefaultAppliedDetails,
  StrengthMeanDefaultDominantDetails,
} from './cil.js'

// Validation types
export type {
  ValidationWarning,
  ValidationBlocker,
  ValidationResult,
} from './validation.js'

// Error types
export type {
  CeeErrorCodeType,
  PlotCeeUpstreamEnvelope,
  PlotProxyTimeoutError,
} from './errors.js'

// Request chain types
export type {
  PlotRequestIdChain,
  DraftGraphTrace,
} from './request-chain.js'

// Readiness types
export type { ProductReadiness } from './readiness.js'

// Boundary documentation
export {
  CEE_TO_UI_DROPS,
  UI_TO_PLOT_DROPS,
  PLOT_TO_UI_DROPS,
} from './boundaries/index.js'
export type { FieldDropDoc } from './boundaries/index.js'
