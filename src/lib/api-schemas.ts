/**
 * Minimal Zod schemas for API response validation
 *
 * These schemas validate only the fields the UI critically depends on.
 * They use passthrough() to allow extra fields from the API.
 * On validation failure, a warning is logged but execution continues.
 */

import { z } from 'zod'
import { logger } from './logger'

// =============================================================================
// CEE Draft Response Schema (minimal - only critical UI fields)
// =============================================================================

const CEENodeMinimal = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string(),
}).passthrough()

const CEEEdgeMinimal = z.object({
  from: z.string(),
  to: z.string(),
}).passthrough()

/**
 * Minimal CEE draft response schema
 * Validates only fields that would crash the UI if missing
 */
export const CEEDraftResponseSchema = z.object({
  quality_overall: z.number().optional(),
  nodes: z.array(CEENodeMinimal).optional(),
  edges: z.array(CEEEdgeMinimal).optional(),
  // Allow nested graph structure (CEE sometimes returns this)
  graph: z.object({
    nodes: z.array(CEENodeMinimal).optional(),
    edges: z.array(CEEEdgeMinimal).optional(),
  }).passthrough().optional(),
}).passthrough()

// =============================================================================
// CEE Belief Elicitation Response Schema (ROADMAP 2.364)
// =============================================================================

/**
 * Mirror of CEE's `CEEElicitBeliefResponseV1Schema`
 * (`olumi-assistants-service/src/schemas/ceeResponses.ts`, read at `staging`
 * 2026-08-03). `passthrough()` on both sides, so a field CEE adds is carried,
 * not dropped — and the bounds are copied EXACTLY (`suggested_value` and each
 * option `value` are `z.number().min(0).max(1)`), because a probability outside
 * [0,1] is the one shape the UI must never render or commit.
 *
 * This schema is OBSERVATIONAL (warn-parse, the `CEEDraftResponseSchema`
 * pattern). The HARD refusal on an out-of-range `suggested_value` lives in
 * `CEEClient.elicitBelief`, because a warning that is only logged would still
 * let a poisoned number reach the commit path.
 */
export const CEEElicitBeliefResponseSchema = z.object({
  suggested_value: z.number().min(0).max(1),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
  needs_clarification: z.boolean(),
  clarifying_question: z.string().optional(),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.number().min(0).max(1),
      })
    )
    .optional(),
  provenance: z.literal('cee'),
}).passthrough()

// =============================================================================
// PLoT V1 Run Response Schema (minimal - only critical UI fields)
// =============================================================================

const V1RunResultMinimal = z.object({
  answer: z.string(),
  confidence: z.number(),
  explanation: z.string().optional(),
}).passthrough()

/**
 * Minimal V1 sync run response schema
 * Validates only fields that would crash the UI if missing
 */
export const V1SyncRunResponseSchema = z.object({
  result: V1RunResultMinimal,
  execution_ms: z.number(),
}).passthrough()

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Warn if API response doesn't match expected schema.
 * Logs warning on failure but does NOT throw or modify data.
 * Intent: observational validation for early detection, not enforcement.
 *
 * @param schema - Zod schema to validate against
 * @param data - Raw API response data
 * @param context - Context string for logging (e.g., 'CEE draft', 'PLoT run')
 */
export function warnOnInvalidApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): void {
  const result = schema.safeParse(data)

  if (!result.success) {
    // Log structured warning with validation details
    logger.warn(`[API Validation] ${context} response has unexpected shape`, {
      errors: result.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        expected: e.code,
      })),
      // Include sample of data keys for debugging (not full payload for security)
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : typeof data,
    })
  }

  // No return - validation is observational only
}
