/**
 * Response schemas for PLoT analysis results.
 *
 * Contract schemas use .passthrough() to preserve unknown fields.
 */

import { z } from 'zod'

/**
 * Effect direction for sensitivity analysis.
 */
export const SensitivityDirectionSchema = z.enum(['positive', 'negative'])

export type SensitivityDirection = z.infer<typeof SensitivityDirectionSchema>

/**
 * Factor sensitivity analysis result.
 */
export const FactorSensitivitySchema = z.object({
  /** Factor node ID */
  node_id: z.string(),
  /** Human-readable label */
  label: z.string(),
  /** Importance score (0-1, normalized) */
  importance_score: z.number().min(0).max(1),
  /** Sensitivity score (0-1, normalized) */
  sensitivity_score: z.number().min(0).max(1),
  /** Elasticity measure (% change in outcome / % change in factor) */
  elasticity: z.number(),
  /** Direction of influence */
  direction: SensitivityDirectionSchema,
  /** Importance ranking (1 = most important) */
  importance_rank: z.number().int().positive(),
  /** Confidence in this factor's influence (0-1) */
  confidence: z.number().min(0).max(1).optional(),
  /** Breakdown of confidence into structural and sampling components */
  confidence_components: z.object({
    structural_certainty: z.number(),
    sampling_stability: z.number().nullable(),
  }).optional(),
}).passthrough()

export type FactorSensitivity = z.infer<typeof FactorSensitivitySchema>

/**
 * Fragile edge analysis result.
 *
 * Identifies edges where small changes in strength could significantly
 * impact the outcome or recommendation.
 */
export const FragileEdgeSchema = z.object({
  /** Edge identifier (from->to) */
  edge_id: z.string(),
  /** Source node ID */
  from_id: z.string(),
  /** Target node ID */
  to_id: z.string(),
  /** Current strength value */
  current_strength: z.number(),
  /** Threshold beyond which impact is significant */
  threshold: z.number(),
  /** Impact on outcome if strength crosses threshold */
  impact_on_outcome: z.number(),
}).passthrough()

export type FragileEdge = z.infer<typeof FragileEdgeSchema>

/**
 * Type guards.
 */
export function isFactorSensitivity(value: unknown): value is FactorSensitivity {
  return FactorSensitivitySchema.safeParse(value).success
}

export function isFragileEdge(value: unknown): value is FragileEdge {
  return FragileEdgeSchema.safeParse(value).success
}
