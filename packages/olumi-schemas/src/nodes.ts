/**
 * Node schemas for Olumi platform.
 *
 * Contract schemas use .passthrough() to preserve unknown fields across boundaries.
 */

import { z } from 'zod'

/**
 * Observed state for factor nodes.
 * Represents the current measured/known value of a factor.
 *
 * Note: value is unconstrained at schema level to accept diverse units/scales.
 * ISL normalizes to [0,1] internally; UI may have different expectations.
 */
export const ObservedStateSchema = z.object({
  /** Value (unconstrained - normalization applied by downstream services) */
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
 * Canonical node ID format (ISL V2 constraint).
 * CEE guarantees generated IDs match this pattern.
 */
export const NodeIdSchema = z.string().regex(/^[a-z][a-z0-9_:-]*$/)

/**
 * Loose node ID format (accepts any non-empty string).
 * Use for user-authored IDs that need normalization.
 */
export const NodeIdLooseSchema = z.string().min(1)

export type NodeId = z.infer<typeof NodeIdSchema>
export type NodeIdLoose = z.infer<typeof NodeIdLooseSchema>

/**
 * Type guard for canonical node IDs.
 */
export function isCanonicalNodeId(value: unknown): value is NodeId {
  return NodeIdSchema.safeParse(value).success
}

/**
 * Normalizes a node ID to ISL V2 format.
 * Converts to lowercase, replaces invalid chars with underscore.
 */
export function normaliseNodeId(id: string): NodeId {
  const normalized = id
    .toLowerCase()
    .replace(/[^a-z0-9_:-]/g, '_')
    .replace(/^[^a-z]+/, '') // Remove leading non-letters

  if (!normalized || !isCanonicalNodeId(normalized)) {
    throw new Error(`Cannot normalize ID "${id}" to canonical format`)
  }

  return normalized
}

/**
 * V3 Node schema (canonical contract - requires ISL-compliant IDs).
 *
 * This is the contract-boundary schema - uses .passthrough() to preserve
 * unknown fields across CEE → UI → PLoT boundaries.
 *
 * Note: ID must match ISL V2 format. CEE guarantees this for generated IDs.
 * Use NodeV3LooseSchema for user-authored IDs that need normalization.
 */
export const NodeV3Schema = z.object({
  /** Node identifier (ISL V2 format: ^[a-z][a-z0-9_:-]*$) */
  id: NodeIdSchema,
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
 * Loose V3 Node schema (accepts non-canonical IDs).
 * Use for user-authored graphs that need ID normalization.
 */
export const NodeV3LooseSchema = NodeV3Schema.extend({
  id: NodeIdLooseSchema,
})

export type NodeV3Loose = z.infer<typeof NodeV3LooseSchema>

/**
 * Type guard for NodeV3.
 */
export function isNodeV3(value: unknown): value is NodeV3 {
  return NodeV3Schema.safeParse(value).success
}
