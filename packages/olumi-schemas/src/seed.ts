/**
 * Seed configuration schema for reproducible analysis.
 */

import { z } from 'zod'

/**
 * Seed source types.
 */
export const SeedSourceSchema = z.enum([
  'user_provided',
  'client_generated',
  'server_generated',
])

export type SeedSource = z.infer<typeof SeedSourceSchema>

/**
 * Seed configuration.
 *
 * Used to ensure reproducibility across analysis runs.
 */
export const SeedConfigSchema = z.object({
  /** Seed value (string format for API compatibility) */
  seed: z.string(),
  /** Source of the seed value */
  seed_source: SeedSourceSchema,
}).passthrough()

export type SeedConfig = z.infer<typeof SeedConfigSchema>

/**
 * Type guard for SeedConfig.
 */
export function isSeedConfig(value: unknown): value is SeedConfig {
  return SeedConfigSchema.safeParse(value).success
}
