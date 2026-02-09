/**
 * Analysis-ready payload schema.
 *
 * Represents a CEE response with fully resolved options ready for PLoT analysis.
 */

import { z } from 'zod'
import { OptionForAnalysisSchema } from './options.js'

/**
 * Analysis-ready status types.
 */
export const AnalysisReadyStatusSchema = z.enum([
  'ready',
  'needs_encoding',
  'needs_user_mapping',
])

export type AnalysisReadyStatus = z.infer<typeof AnalysisReadyStatusSchema>

/**
 * Analysis-ready payload (V3).
 *
 * This is the contract-boundary schema - uses .passthrough() to preserve
 * unknown fields from CEE that may be needed by UI or future versions.
 */
export const AnalysisReadyV3Schema = z.object({
  /** Overall readiness status */
  status: AnalysisReadyStatusSchema,
  /** Options with resolved interventions */
  options: z.array(OptionForAnalysisSchema),
  /** Goal node ID from CEE */
  goal_node_id: z.string().optional(),
  /** Suggested seed for reproducibility */
  suggested_seed: z.string().optional(),
  /** User-facing questions explaining issues when status is not 'ready' */
  user_questions: z.array(z.string()).optional(),
  /** Verification prompts for AI-estimated factors, keyed by factor node ID */
  verification_prompts: z.record(z.string()).optional(),
  /** Goal threshold pre-populated from CEE analysis (normalized) */
  goal_threshold: z.number().nullable().optional(),
  /** Raw (un-normalized) goal threshold value */
  goal_threshold_raw: z.number().nullable().optional(),
  /** Unit for goal threshold */
  goal_threshold_unit: z.string().nullable().optional(),
  /** Cap used to normalize the goal threshold */
  goal_threshold_cap: z.number().nullable().optional(),
  /** Low-confidence edges that need user review */
  low_confidence_edges: z.array(z.object({
    edge_id: z.string(),
    prompt: z.string(),
  })).optional(),
}).passthrough()

export type AnalysisReadyV3 = z.infer<typeof AnalysisReadyV3Schema>

/**
 * Type guard for AnalysisReadyV3.
 */
export function isAnalysisReadyV3(value: unknown): value is AnalysisReadyV3 {
  return AnalysisReadyV3Schema.safeParse(value).success
}

/**
 * Check if analysis is fully ready (status === 'ready' and has options).
 */
export function isFullyReady(analysisReady: AnalysisReadyV3): boolean {
  return analysisReady.status === 'ready' && analysisReady.options.length > 0
}
