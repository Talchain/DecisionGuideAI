/**
 * isReviewedByUser — canonical "user has confirmed this factor" predicate.
 *
 * Extracted from usePreAnalysisData.ts so multiple counters (the
 * `reviewedFactorsCount` derivation in the hook and the
 * `buildPriorityProgress` helper used by `T1ContributionRow`) share a
 * single source of truth. Drift between counters is the trust-leak the
 * pre-analysis-power-v1 brief is fixing — duplicating this predicate
 * inline would reintroduce the same risk.
 *
 * `REVIEWED_SOURCES` is the union of every observed_state.source value
 * the broader app currently writes or recognises as user-owned. This
 * predicate was originally narrower (three values) but that conflicted
 * with neighbouring predicates and produced false negatives on the new
 * primary progress indicator. Sources included:
 *
 * - `user_confirmed`   — Pre-analysis "Confirm" handler in `PreAnalysisPanel`
 *                        and the OutputsDock "Set as Confirmed" Model-tab action.
 * - `user_assumption`  — Reserved for "mark as assumption" action; no UI
 *                        writes it yet but the predicate recognises it for
 *                        forward-compat parity with `buildContributionBreakdown`.
 * - `user_override`    — Inline value-edit handlers in `PreAnalysisPanel`
 *                        and OutputsDock's Model-tab "Edit Value" path.
 * - `user`             — Model-tab `FactorsSection` factor-value edits.
 *                        The "verified" bucket in `buildContributionBreakdown`
 *                        already accepts this value; the priority counter
 *                        must match or genuinely user-edited factors regress
 *                        to "unconfirmed".
 * - `user_edited`      — Recognised by the OutputsDock transition-bridge
 *                        as user-owned. No write site exists today but the
 *                        value is part of the recognised set and leaving it
 *                        out would mean any future writer creates a silent
 *                        false negative here.
 *
 * Resolution is field-level (not object-level): a node that carries
 * `observed_state` without a `source` field must NOT short-circuit the
 * fallback chain — the camelCase `observedState.source` and top-level
 * `data.source` still need a chance to resolve.
 *
 * Two surfaces are exported:
 * - `isReviewedSource(source)` — string-level membership check, useful
 *   when a caller has already resolved the source value.
 * - `isReviewedByUser(node)`   — node-level convenience that resolves
 *   the source via the field-level fallback chain and delegates to
 *   `isReviewedSource`. Use this when you only have a node in hand.
 */

import type { Node } from '@xyflow/react'

const REVIEWED_SOURCES = new Set<string>([
  'user_confirmed',
  'user_assumption',
  'user_override',
  'user',
  'user_edited',
])

/**
 * String-level "is this source value user-owned?" check. Single source
 * of truth for the REVIEWED_SOURCES contract.
 */
export function isReviewedSource(source: string | undefined | null): boolean {
  return source != null && REVIEWED_SOURCES.has(source)
}

export function isReviewedByUser(node: Node): boolean {
  const data = node.data as {
    observed_state?: { source?: string }
    observedState?: { source?: string }
    source?: string
  }
  // Field-level fallback chain: snake_case → camelCase → top-level. An
  // empty `observed_state: {}` at the snake-case key no longer hides a
  // valid camelCase or top-level source.
  const source =
    data?.observed_state?.source ?? data?.observedState?.source ?? data?.source
  return isReviewedSource(source)
}
