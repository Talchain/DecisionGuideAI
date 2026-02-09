/**
 * Edge schemas for Olumi platform.
 *
 * Contract schemas use .passthrough() to preserve unknown fields across boundaries.
 */

import { z } from 'zod'

/**
 * Effect direction for edges.
 *
 * Note: UI currently only handles 'positive' and 'negative' explicitly.
 * 'unknown' is treated as missing and direction is inferred from sign.
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
 * V3 Edge schema (canonical contract - requires strength + exists_probability).
 *
 * This is the contract-boundary schema - uses .passthrough() to preserve
 * unknown fields across CEE → UI → PLoT boundaries.
 *
 * Note: This defines the target contract (v3.3) where CEE guarantees strength
 * and exists_probability. UI may apply display defaults for drafts, but the
 * canonical contract requires them.
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
 * Lenient V3 Edge schema for draft/partial edges (strength + exists_probability optional).
 *
 * Use this for UI draft states where edges may not have all fields yet.
 * The canonical EdgeV3Schema requires these fields.
 */
export const EdgeV3LenientSchema = EdgeV3Schema.partial({
  strength: true,
  exists_probability: true,
})

export type EdgeV3Lenient = z.infer<typeof EdgeV3LenientSchema>

/**
 * Type guard for EdgeV3.
 */
export function isEdgeV3(value: unknown): value is EdgeV3 {
  return EdgeV3Schema.safeParse(value).success
}
