/**
 * Option and intervention schemas for Olumi platform.
 *
 * Contract schemas use .passthrough() to preserve unknown fields across boundaries.
 */

import { z } from 'zod'

/**
 * Intervention source types.
 */
export const InterventionSourceSchema = z.enum([
  'brief_extraction',
  'user_specified',
  'cee_hypothesis',
])

export type InterventionSource = z.infer<typeof InterventionSourceSchema>

/**
 * Target match types for intervention mapping.
 */
export const TargetMatchTypeSchema = z.enum([
  'exact_id',
  'exact_label',
  'semantic',
])

export type TargetMatchType = z.infer<typeof TargetMatchTypeSchema>

/**
 * Confidence levels.
 */
export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low'])

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>

/**
 * Value types for interventions.
 */
export const ValueTypeSchema = z.enum(['numeric', 'categorical', 'boolean'])

export type ValueType = z.infer<typeof ValueTypeSchema>

/**
 * Target match metadata for interventions.
 */
export const TargetMatchSchema = z.object({
  /** Matched node ID */
  node_id: z.string(),
  /** Type of match performed */
  match_type: TargetMatchTypeSchema,
  /** Confidence in the match */
  confidence: ConfidenceLevelSchema,
}).passthrough()

export type TargetMatch = z.infer<typeof TargetMatchSchema>

/**
 * Rich intervention format (V3).
 *
 * Contains metadata about intervention value, source, and mapping.
 */
export const RichInterventionSchema = z.object({
  /** Intervention value (normalized) */
  value: z.number(),
  /** Source of the intervention */
  source: InterventionSourceSchema.optional(),
  /** Target match metadata */
  target_match: TargetMatchSchema.optional(),
  /** Confidence in the value */
  value_confidence: ConfidenceLevelSchema.optional(),
  /** Reasoning for this intervention */
  reasoning: z.string().optional(),
  /** Raw (un-normalized) value */
  raw_value: z.union([z.number(), z.string(), z.boolean()]).optional(),
  /** Type of the raw value */
  value_type: ValueTypeSchema.optional(),
  /** Encoding map for categorical values */
  encoding_map: z.record(z.number()).optional(),
}).passthrough()

export type RichIntervention = z.infer<typeof RichInterventionSchema>

/**
 * Option status types.
 */
export const OptionStatusSchema = z.enum([
  'ready',
  'needs_user_mapping',
  'needs_encoding',
])

export type OptionStatus = z.infer<typeof OptionStatusSchema>

/**
 * Option for analysis (V3 format).
 *
 * This is the contract-boundary schema - uses .passthrough() to preserve
 * unknown fields across CEE → UI → PLoT boundaries.
 */
export const OptionForAnalysisSchema = z.object({
  /** Option identifier */
  id: z.string(),
  /** Human-readable label */
  label: z.string(),
  /** Human-readable description */
  description: z.string().optional(),
  /** Readiness status */
  status: OptionStatusSchema,
  /** Interventions (normalized values) keyed by node ID */
  interventions: z.record(z.number()),
  /** Raw interventions (pre-encoding) keyed by node ID */
  raw_interventions: z.record(z.union([z.number(), z.string(), z.boolean()])).optional(),
}).passthrough()

export type OptionForAnalysis = z.infer<typeof OptionForAnalysisSchema>

/**
 * Type guard for OptionForAnalysis.
 */
export function isOptionForAnalysis(value: unknown): value is OptionForAnalysis {
  return OptionForAnalysisSchema.safeParse(value).success
}
