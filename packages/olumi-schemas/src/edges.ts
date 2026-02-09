/**
 * Edge schemas for Olumi platform.
 *
 * Contract schemas use .passthrough() to preserve unknown fields across boundaries.
 */

import { z } from 'zod'

/**
 * Effect direction for edges.
 */
export const EffectDirectionSchema = z.enum(['positive', 'negative', 'unknown'])

export type EffectDirection = z.infer<typeof EffectDirectionSchema>

/**
 * Edge strength distribution.
 */
export const EdgeStrengthSchema = z.object({
  /** Mean strength value (signed, -1 to +1) */
  mean: z.number().min(-1).max(1),
  /** Standard deviation of strength (uncertainty) */
  std: z.number().positive(),
}).passthrough()

export type EdgeStrength = z.infer<typeof EdgeStrengthSchema>

/**
 * V3 Edge schema.
 *
 * This is the contract-boundary schema - uses .passthrough() to preserve
 * unknown fields across CEE → UI → PLoT boundaries.
 */
export const EdgeV3Schema = z.object({
  /** Source node ID */
  from: z.string(),
  /** Target node ID */
  to: z.string(),
  /** Edge strength distribution */
  strength: EdgeStrengthSchema,
  /** Probability that this edge exists (0-1) */
  exists_probability: z.number().min(0).max(1),
  /** Human-readable label (optional) */
  label: z.string().optional(),
  /** Effect direction (optional semantic hint) */
  effect_direction: EffectDirectionSchema.optional(),
}).passthrough()

export type EdgeV3 = z.infer<typeof EdgeV3Schema>

/**
 * Type guard for EdgeV3.
 */
export function isEdgeV3(value: unknown): value is EdgeV3 {
  return EdgeV3Schema.safeParse(value).success
}
