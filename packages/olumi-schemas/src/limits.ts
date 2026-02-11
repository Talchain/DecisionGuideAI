/**
 * Platform limits and constraints.
 *
 * These are canonical limits enforced across all components.
 */

/**
 * Maximum number of nodes allowed in a decision graph.
 */
export const MAX_NODES = 50

/**
 * Maximum number of edges allowed in a decision graph.
 */
export const MAX_EDGES = 100

/**
 * Maximum number of options that can be compared.
 */
export const MAX_OPTIONS = 10

/**
 * Minimum standard deviation to avoid ISL validation errors.
 */
export const STD_FLOOR = 0.001

/**
 * Maximum standard deviation as a ratio of value.
 * ISL expects std << mean; this ratio ensures uncertainty stays proportional.
 */
export const STD_CEILING_RATIO = 0.5

/**
 * Absolute maximum standard deviation for extreme values.
 * Prevents unbounded std even for very large values.
 */
export const STD_CEILING_ABS = 10000

/**
 * Default standard deviation when not provided.
 */
export const DEFAULT_STD = 0.1

/**
 * Edge strength bounds (CEE-valid range).
 */
export const STRENGTH_BOUNDS = {
  min: -1.0,
  max: 1.0,
} as const

/**
 * Default seed value for reproducibility.
 */
export const DEFAULT_SEED = '42'

/**
 * Consolidated limits object for canvas validation.
 * Canvas uses LIMITS.MAX_NODES, LIMITS.MAX_EDGES etc. for warn-at-80%/block-at-100%.
 */
export const LIMITS = {
  MAX_NODES,
  MAX_EDGES,
  MAX_OPTIONS,
  STD_FLOOR,
  STD_CEILING_RATIO,
  STD_CEILING_ABS,
  DEFAULT_STD,
  STRENGTH_BOUNDS,
  DEFAULT_SEED,
} as const
