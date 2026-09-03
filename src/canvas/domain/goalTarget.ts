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

/**
 * ⭐⭐ TWO QUESTIONS THAT WORE ONE NAME: *does a target EXIST* and *what NUMBER
 * is it*. They are not the same question and they cannot share a predicate.
 *
 * ⚠ THIS IS NOT A NEW SPLIT. It is the one CEE-panel lane #1151 settled the
 * same night, after five rounds of tightening and widening a single coercion
 * each moved the harm rather than closing it: too permissive silences true
 * coaching (`Number('')` is `0`, a fabricated target that reads as a real one),
 * too strict denies `'200k'`, `'£11M'`, `'11%'` and `'≥ £1,000'` — real targets
 * a person stated, which no `number | null` can hold. A false positive that
 * DROPS a constraint and one that INVENTS one are opposite harms and cannot
 * share one window.
 *
 * ⚠⚠ #1151 CARRIES ITS OWN INLINE `stated` / `finite` COPIES INSIDE
 * `useResultsSectionData.ts`, WHICH THAT PR OWNS AND THIS ONE MUST NOT TOUCH.
 * These two exports are the SAME PREDICATES, derived deliberately to the same
 * semantics rather than invented in parallel. **Whichever of the two merges
 * second must collapse the inline memos onto these functions** — two
 * implementations of one rule is exactly the hand-maintained mirror that
 * produced the divergence they both exist to close.
 */

/**
 * EXISTENCE — *has anyone STATED a target?* Deliberately NOT numeric.
 *
 * A blank, whitespace, `null`, `undefined` and a non-finite number are not
 * targets. Everything else a human could have meant is. `NaN` and `±Infinity`
 * are excluded on purpose: nobody states them, and admitting them is how a
 * literal "NaN" reaches a screen.
 */
export function isStatedTargetValue(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim() !== ''
  return false
}

/**
 * THE NUMBER — *what value may a numeric consumer use?* Strict on purpose.
 *
 * `null` means "NO NUMBER", never "no target" — the conflation that caused all
 * of this. A consumer doing arithmetic (the PLoT request boundary normalises
 * this scalar) must never receive a coerced `0` for a blank, `16` for `'0x10'`,
 * `1` for `true`, or a bare `NaN` for `'11%'`.
 *
 * The accepted grammar is what a stated decimal looks like: optionally signed,
 * optionally scientific. `Number()` alone is not that grammar — it accepts hex,
 * blanks, whitespace, `[]`, `false` and the words `Infinity`/`NaN`.
 */
export function statedTargetNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * THE STATED TARGET, AS THE CARD RESOLVES IT — the value or `null`.
 *
 * ⚠ THIS IS `GoalNode`'s OWN CHAIN, MOVED HERE RATHER THAN RE-DERIVED. The card
 * resolved it inline: a user-set `success_threshold` wins (and only when
 * `threshold_source === 'user'` attests it), otherwise CEE's backfilled
 * `goal_threshold_raw`, with `isStatedTargetValue` deciding EXISTENCE at both
 * steps. Two copies of that chain is the hand-maintained mirror this module
 * exists to abolish, so `GoalNode` now calls this and holds none of its own.
 *
 * Differs from `resolveGoalTarget` in one respect that matters: this answers
 * EXISTENCE with `isStatedTargetValue`, so a `NaN` or an `Infinity` sitting in
 * `success_threshold` is NOT a stated target. `resolveGoalTarget` admits any
 * `typeof number` because its job is to carry provenance for a value that has
 * already been judged to exist.
 */
export function statedGoalTargetRaw(
  data: GoalTargetSource | null | undefined,
): string | number | null {
  if (!data) return null
  const userThreshold = data.threshold_source === 'user' ? data.success_threshold : undefined
  const chosen = isStatedTargetValue(userThreshold) ? userThreshold : data.goal_threshold_raw
  return isStatedTargetValue(chosen) ? (chosen as string | number) : null
}

/**
 * ⭐⭐⭐ THE ADMISSION: *CAN THIS PERSON ADD A SUCCESS TARGET RIGHT NOW?*
 *
 * ⚠⚠ THIS EXISTS BECAUSE A CHIP PROMISED A ROUTE INTO A DEAD END. The goal
 * card's chip fires on the NODE (`statedGoalTargetRaw` above) and says
 * "Target not captured — add one". The inspector's `GoalPanel` decided whether
 * to render `GoalThresholdEditor` from the STORE SCALAR `goalThreshold`, which
 * `setCeeAnalysisReady` writes WITHOUT EVER TOUCHING THE NODE (store.ts) —
 * the node's target fields are written by OTHER paths entirely —
 * `backfillGoalThresholdOntoGoalNode` (CEE's raw, only when the payload carries
 * that key), `useInspectorMutations.setThreshold`, and
 * `setGoalThresholdAndUpdateNode` (the editor's own commit, which writes
 * `success_threshold` + `threshold_source: 'user'`). None of them is
 * `setCeeAnalysisReady`, which is the whole point: no write orders these two
 * scalars, so they diverge.
 *
 * So on a payload carrying `goal_threshold` and no raw, the two disagreed and
 * the user was told to add a target, then told one already existed
 * ("Success means reaching ≥ 0.8"), with nothing to press. `store.ts` records
 * that exact state having shipped.
 *
 * ── WHY THIS IS NOT "ALIGN THE TWO DEFAULTS" (CLAUDE.md trap 21) ───────────
 * The two authorities answer DIFFERENT questions and both answers are correct:
 *   the node scalar   "has a target been CAPTURED onto this goal?"
 *   the store scalar  "does the run pipeline hold a NUMBER for this goal?"
 * Making them agree would couple two things that were never the same question.
 * What the USER is asking is a third thing — *may I add one?* — and that is the
 * question this function is named for. Both consumers read THIS, so the chip's
 * promise and the editor's presence cannot drift:
 *
 *   `GoalNode`  renders the chip  iff `canCaptureGoalTarget(node.data)`
 *   `GoalPanel` renders the editor if `canCaptureGoalTarget(node.data)`
 *
 * The second is an `if`, not an `iff`, and deliberately: the panel ALSO keeps
 * rendering the editor when it has no number to display at all, which is the
 * pre-existing "From your brief" pre-population branch. The admission is a
 * SUFFICIENT condition, never overridden — so *admission yes ⟹ editor present*
 * holds by construction, which is exactly what makes the chip's promise honest.
 *
 * ⚠ IT TAKES THE NODE AND NOTHING ELSE, ON PURPOSE. Handing it the store
 * scalar would put the card back on the weaker source this module's header
 * exists to move it off, and would make the card's own chip depend on state the
 * card cannot see.
 */
export function canCaptureGoalTarget(data: GoalTargetSource | null | undefined): boolean {
  return statedGoalTargetRaw(data) == null
}
