/**
 * isAiSource — canonical "factor source is AI-inferred" predicate.
 *
 * Extracted from `usePreAnalysisData.ts` (where it previously lived as two
 * functionally-identical inline predicates `isAiInferred` and
 * `isAiSource`) so the AI-source contract is single-sourced. Mirrors the
 * `isReviewedByUser` / `isReviewedSource` extraction pattern.
 *
 * `AI_SOURCES` is the set of `observed_state.source` values that mean the
 * factor was inferred by an AI process (CEE inference, generic AI, the
 * `ai_estimate` provenance tag, etc.). User-owned sources are handled by
 * `isReviewedSource` in `./isReviewedByUser.ts`; the two sets are
 * disjoint by construction.
 *
 * Two surfaces are exported:
 * - `isAiSource(source)`        — string-level membership check.
 * - `isAiSourceFromNode(node)`  — node-level convenience that resolves the
 *   source via the field-level fallback chain
 *   (`observed_state?.source ?? observedState?.source ?? data.source`),
 *   matching the same fallback rule used elsewhere in the pre-analysis
 *   surface. The legacy object-level chain
 *   (`(observed_state ?? observedState)?.source`) silently shadowed a
 *   valid camelCase / top-level source when `observed_state: {}` was
 *   present, producing false negatives.
 */

import type { Node } from '@xyflow/react'

const AI_SOURCES = new Set<string>([
  'ai',
  'cee_inference',
  'inferred',
  'engine',
  'ai_estimate',
])

/** String-level "is this source AI-inferred?" check. */
export function isAiSource(source: string | undefined | null): boolean {
  return source != null && AI_SOURCES.has(source)
}

/** Node-level convenience: resolves the source via field-level fallback. */
export function isAiSourceFromNode(node: Node): boolean {
  const data = node.data as {
    observed_state?: { source?: string }
    observedState?: { source?: string }
    source?: string
  }
  // Field-level fallback chain (matches isReviewedByUser). An empty
  // `observed_state: {}` does NOT short-circuit the camelCase / top-level
  // fallbacks.
  const source =
    data?.observed_state?.source ?? data?.observedState?.source ?? data?.source
  return isAiSource(source)
}
