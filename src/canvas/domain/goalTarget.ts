/**
 * ⭐⭐ ONE OWNER FOR "WHAT IS THIS GOAL'S TARGET, AND WHOSE IS IT".
 *
 * ⚠ THIS EXISTS BECAUSE TWO SURFACES HAD ALREADY DIVERGED, AND THE DIVERGENCE
 * WAS VISIBLE TO THE USER. Witnessed on deployed `6e58c921`: the canvas goal
 * card rendered **"Target: 110%"** while the Reasoning panel's strip, six
 * inches to the right, rendered **"No target we can show"** — about the same
 * goal, on the same screen, at the same moment.
 *
 * The cause was two different sources under one idea:
 *   · `GoalNode` resolved the NODE's own fields — a user-set `success_threshold`
 *     first, then CEE's `goal_threshold_raw` — both in USER UNITS, with
 *     `goal_threshold_unit` beside them.
 *   · `SuccessTargetLine` read the canvas store's `goalThreshold`, which on that
 *     run carried the `normalised` tag and therefore could not be shown at all.
 *
 * Neither was wrong about its own field. The panel was simply asking a weaker
 * source. This module makes the NODE the answer to the question both surfaces
 * are actually asking, so a future divergence has to go through one function.
 *
 * ⚠ THE PRECEDENCE IS NOT A PREFERENCE — it is `computeSuccessState`'s, mirrored
 * deliberately, and `GoalNode`'s own comment records why: the badge once checked
 * `goal_threshold_raw` ONLY, a CEE-backfilled field a Hero-only commit never
 * populates, so the canvas kept saying "no target" after the user had set one.
 * A user-set value wins; the CEE-derived raw is the fallback.
 */

/** The shape both call sites read from. Deliberately structural, not a class. */
export interface GoalTargetSource {
  threshold_source?: unknown
  success_threshold?: unknown
  goal_threshold_raw?: unknown
  goal_threshold_unit?: unknown
}

export interface ResolvedGoalTarget {
  /** The figure, in the USER's units. Never a normalised 0-1. */
  raw: string | number
  /** The producer's unit string, when it sent one. */
  unit: string | undefined
  /**
   * Who put it there. `user` licenses "Set by you"; `brief` is CEE's own
   * backfill from what the user wrote.
   *
   * ⚠ THESE ARE NOT INTERCHANGEABLE ON SCREEN. A target the reader typed and a
   * target we lifted from their brief are different claims about authorship,
   * and this estate's whole provenance vocabulary exists to keep them apart.
   */
  source: 'user' | 'brief'
}

/**
 * The goal's target as the user's own units, or `null` when the node carries
 * none.
 *
 * ⚠ RETURNS `null` FOR AN EMPTY STRING, not just for absence — `goal_threshold_raw`
 * arrives as `string | number` and a blank string is not a target. `GoalNode`
 * already guarded this with `String(x).trim() !== ''`; the guard moves here so
 * both callers get it.
 */
export function resolveGoalTarget(
  data: GoalTargetSource | null | undefined,
): ResolvedGoalTarget | null {
  if (!data) return null
  const unit = typeof data.goal_threshold_unit === 'string' ? data.goal_threshold_unit : undefined

  const userSet =
    data.threshold_source === 'user' &&
    (typeof data.success_threshold === 'number' || typeof data.success_threshold === 'string')
      ? (data.success_threshold as string | number)
      : null
  if (userSet != null && String(userSet).trim() !== '') {
    return { raw: userSet, unit, source: 'user' }
  }

  const ceeRaw =
    typeof data.goal_threshold_raw === 'number' || typeof data.goal_threshold_raw === 'string'
      ? (data.goal_threshold_raw as string | number)
      : null
  if (ceeRaw != null && String(ceeRaw).trim() !== '') {
    return { raw: ceeRaw, unit, source: 'brief' }
  }

  return null
}
