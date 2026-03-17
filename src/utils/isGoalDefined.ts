/**
 * Shared utility to check whether a goal threshold or goal constraints are defined.
 * Used by coaching cards and pre-run overlay for consistency.
 *
 * B.I.5/B.I.8: Goal is defined if EITHER goalThreshold is set OR goalConstraints has entries.
 * Adapter line 1197-1200 applies XOR logic (constraints take precedence over threshold).
 */

import type { CEEGoalConstraint } from '../adapters/cee/types'

export function isGoalDefined(
  goalThreshold: number | null | undefined,
  goalConstraints: CEEGoalConstraint[] | null | undefined,
): boolean {
  if (goalThreshold != null) return true
  if (Array.isArray(goalConstraints) && goalConstraints.length > 0) return true
  return false
}
