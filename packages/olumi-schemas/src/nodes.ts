/**
 * Node schemas for Olumi platform.
 *
 * Contract schemas use .passthrough() to preserve unknown fields across boundaries.
 */

import { z } from 'zod'

/**
 * Observed state for factor nodes.
 * Represents the current measured/known value of a factor.
 */
export const ObservedStateSchema = z.object({
  /** Normalized value (0-1 range for ISL) */
  value: z.number(),
  /** Standard deviation of the value (uncertainty) */
  std: z.number().optional(),
  /** Baseline value for comparison */
  baseline: z.number().optional(),
  /** Unit of measurement (e.g., "USD", "count", "%") */
  unit: z.string().optional(),
  /** Source of the observation (e.g., "user_specified", "brief_extraction") */
  source: z.string().optional(),
  /** Raw (un-normalized) value before encoding */
  raw_value: z.number().optional(),
  /** Cap value used for normalization */
  cap: z.number().optional(),
  /** Extraction type from CEE (e.g., "brief_extraction") */
  extractionType: z.string().optional(),
  /** Factor type from CEE (e.g., "numeric", "categorical") */
  factor_type: z.string().optional(),
  /** List of uncertainty drivers affecting this factor */
  uncertainty_drivers: z.array(z.string()).optional(),
}).passthrough()

export type ObservedState = z.infer<typeof ObservedStateSchema>

/**
 * Prior distribution for external/unobserved factors.
 */
export const PriorSchema = z.object({
  /** Distribution type (e.g., "normal", "uniform") */
  distribution: z.string(),
  /** Minimum value of the range */
  range_min: z.number(),
  /** Maximum value of the range */
  range_max: z.number(),
}).passthrough()

export type Prior = z.infer<typeof PriorSchema>

/**
 * Node types supported by the platform.
 */
export const NodeKindSchema = z.enum([
  'goal',
  'factor',
  'outcome',
  'decision',
  'risk',
  'action',
  'option',
  'constraint',
])

export type NodeKind = z.infer<typeof NodeKindSchema>

/**
 * Node category for controllability classification.
 */
export const NodeCategorySchema = z.enum([
  'controllable',
  'observable',
  'external',
])

export type NodeCategory = z.infer<typeof NodeCategorySchema>

/**
 * V3 Node schema.
 *
 * This is the contract-boundary schema - uses .passthrough() to preserve
 * unknown fields across CEE → UI → PLoT boundaries.
 */
export const NodeV3Schema = z.object({
  /** Node identifier (ISL V2 constraint: ^[a-z][a-z0-9_:-]*$) */
  id: z.string().regex(/^[a-z][a-z0-9_:-]*$/),
  /** Node type/kind */
  kind: NodeKindSchema,
  /** Human-readable label */
  label: z.string(),
  /** Node category for controllability display */
  category: NodeCategorySchema.optional(),
  /** Observed state for factor nodes */
  observed_state: ObservedStateSchema.optional(),
  /** Prior distribution for external factors */
  prior: PriorSchema.optional(),
  /** Goal threshold (normalized 0-1) */
  goal_threshold: z.number().optional(),
  /** Raw (un-normalized) goal threshold value */
  goal_threshold_raw: z.number().optional(),
  /** Unit for goal threshold */
  goal_threshold_unit: z.string().optional(),
  /** Cap used to normalize the goal threshold */
  goal_threshold_cap: z.number().optional(),
  /** Intercept value for linear models */
  intercept: z.number().default(0.0),
  /** Human-readable description */
  description: z.string().optional(),
}).passthrough()

export type NodeV3 = z.infer<typeof NodeV3Schema>

/**
 * Type guard for NodeV3.
 */
export function isNodeV3(value: unknown): value is NodeV3 {
  return NodeV3Schema.safeParse(value).success
}
