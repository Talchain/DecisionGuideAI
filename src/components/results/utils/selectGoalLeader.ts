/**
 * selectGoalLeader — THE one rule for "which option leads on the GOAL view".
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * Two surfaces on the same screen make the same superlative claim about the
 * same quantity, and until ROADMAP 2.233 they answered DIFFERENT questions.
 *
 * `buildHeroModel` (UI-SEM-072) held the correct rule: crown the
 * goal-probability ARGMAX, honestly gated. `buildV7Headline` held no rule at
 * all — it took `recommendation.recommendedOption` (the COMPARATIVE leader),
 * checked only that THAT option had a finite goal probability, and printed
 * "{label} has the highest chance of hitting your goal: {v}". No rival was
 * ever consulted, so the superlative was unearned by construction. The audit
 * probe: A(win .70, goal .40, recommended) vs B(win .30, goal .80) produced
 * "Option A has the highest chance of hitting your goal: 40%" while the goal
 * block beside it ranked B first at 80%.
 *
 * The lesson the codebase keeps re-learning is that the second copy of a rule
 * is where the defect lives. So the rule moves HERE, both callers select
 * through it, and neither can drift. The gates below are `buildHeroModel`'s
 * own, transcribed with their reasons — this module is the owner now, and the
 * hero delegates to it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE GATES — a crown is WITHHELD (null, never a wrong crown) unless ALL hold
 * ─────────────────────────────────────────────────────────────────────────
 *  1. DESIGNATIONS ARE PERMITTED. On a run whose verdict withholds the leader
 *     claim, the crown is a DESIGNATION and goes (ROADMAP 1.267). Gated at
 *     SELECTION, not at each reader, so a new reader cannot be born
 *     un-gated — the hand-maintained-mirror failure this programme keeps
 *     paying for.
 *  2. A USER TARGET EXISTS (UI-SEM-071). Without `goalThreshold` PLoT/ISL
 *     synthesize an auto threshold and the selector still adopts
 *     `probability_of_joint_goal` — values describing a target the user never
 *     set. No user target, no goal claim.
 *  3. EVERY candidate carries its own FINITE goal value. A maximum taken over
 *     unmeasured rivals cannot honestly claim "highest".
 *  4. The maximum is UNIQUELY held. A tie at the top identifies no single
 *     best option; crowning either would be arbitrary.
 *  5. The maximum clears the shared sub-1% floor (UI-SEM-057). When nothing
 *     is meaningfully on track, no option is the one that is.
 *
 * ⚠ GATE 3 USES `Number.isFinite`, NOT `!= null` — a deliberate hardening
 * over the hero's original loop. `NaN != null` is true, and a NaN candidate
 * fell straight through the old completeness check while losing every `>`
 * comparison, so a run with one NaN row could still crown a rival and call it
 * complete. `isFiniteProbability` is the presence test the goal surfaces
 * already share (`goalAnchorCopy`), and it is the one used here.
 *
 * SELECTION ONLY. This module reads producer values and returns one of the
 * caller's own objects, or null. It never transforms a value, never formats
 * one, and never authors copy.
 */
import { isFiniteProbability } from './goalAnchorCopy'
import { SUB_ONE_PERCENT_FLOOR } from './displayFloors'

export interface GoalLeaderGates {
  /**
   * True when the run's verdict withholds leader designations
   * (`verdict != null && !verdict.hasLeadingOption`). Callers pass the
   * decision the hook already derived — they never re-derive one.
   */
  designationsWithheld: boolean
  /** True when the USER set a success target (`goalThreshold != null`). */
  hasUserTarget: boolean
}

/**
 * ═════════════════════════════════════════════════════════════════════════
 * TWO QUESTIONS, TWO PREDICATES — do not merge them again
 * ═════════════════════════════════════════════════════════════════════════
 * There are two different things a surface can ask about a run's goal field,
 * and for one revision of ROADMAP 2.233 this module conflated them under a
 * single `hasCompleteGoalField`. That was wrong, and the way it was wrong is
 * worth keeping on the record because the mistake is so easy to re-make:
 *
 *   1. **AVAILABILITY — "may I DISPLAY this?"**  → `hasAnyGoalValue` (`.some`)
 *      Showing a measured value is not a claim about the values that are
 *      missing. The hero renders an absent goal as `'—'`
 *      (`HERO_COPY.readout.missing`), which DISCLOSES the gap rather than
 *      hiding it. Requiring a complete field here buys no honesty and costs
 *      the user real data: on partial coverage the whole goal view vanished,
 *      including the options the producer HAD measured.
 *
 *   2. **ENTITLEMENT — "may I CLAIM a leader?"** → `hasCompleteGoalField`
 *      (`.every`, applied inside `selectGoalLeader`). A superlative ranges
 *      over the WHOLE field, so a maximum taken over unmeasured rivals cannot
 *      honestly claim "highest".
 *
 * The crown was ALREADY correctly withheld under both rules — which is the
 * proof that tightening availability bought no claim-safety at all. Keep the
 * partial-coverage case pinned in BOTH directions (lens VISIBLE, crown
 * ABSENT); that pair is what stops the two questions being re-conflated.
 */

/**
 * AVAILABILITY (display). True when a USER target exists and AT LEAST ONE
 * option carries a finite goal probability.
 *
 * Data is not a claim. Missing rows render as the honest missing-value glyph;
 * they are not silently dropped and they are not invented.
 */
export function hasAnyGoalValue<T>(
  candidates: readonly T[],
  getGoalValue: (candidate: T) => number | null | undefined,
  gates: Pick<GoalLeaderGates, 'hasUserTarget'>,
): boolean {
  // UI-SEM-071 — no USER target, no goal view, whatever values are present.
  // PLoT/ISL synthesize an auto threshold and the selector still adopts
  // `probability_of_joint_goal`, so value presence alone must never open this.
  if (!gates.hasUserTarget) return false
  return candidates.some((candidate) => isFiniteProbability(getGoalValue(candidate)))
}

/**
 * ENTITLEMENT (claim). True when a USER target exists and EVERY option carries
 * its own finite goal probability.
 *
 * This is gate 2+3 of `selectGoalLeader` — a superlative needs the whole
 * field. It is exported for ONE other caller, and that caller is not asking
 * the availability question either: `buildV7Lenses`' goal row builder types
 * `V7GoalLens.options[].goalProbability` as a NON-NULLABLE `number` and casts
 * with `as number`, and `V7LensGroup`'s `GoalRow` does arithmetic on it
 * (`probability < FLOOR`, `Math.round(probability * 100)`). Handing it a
 * missing value would render `NaN%` and a NaN-width bar — a placeholder
 * presented as a measurement, which is the very defect class this lane exists
 * to remove. So V7 asks the complete-field question because its own model
 * cannot yet express absence, NOT because availability requires completeness.
 * Teaching that model `number | null` and rendering `'—'` would let V7 move to
 * `hasAnyGoalValue` too; until then this is the honest gate for it.
 */
export function hasCompleteGoalField<T>(
  candidates: readonly T[],
  getGoalValue: (candidate: T) => number | null | undefined,
  gates: Pick<GoalLeaderGates, 'hasUserTarget'>,
): boolean {
  if (!gates.hasUserTarget) return false
  if (candidates.length === 0) return false
  return candidates.every((candidate) => isFiniteProbability(getGoalValue(candidate)))
}

/**
 * The unique, complete, floor-clearing goal-probability argmax — or null.
 *
 * @param candidates    the options/rows in any order; order does not affect
 *                      the result (a tie yields null either way).
 * @param getGoalValue  reads the goal probability off one candidate. Kept as
 *                      an accessor so the hero can pass its row VM and the
 *                      headline can pass an `OptionResult` without either
 *                      side building a parallel array — a second array is a
 *                      second thing to keep in sync.
 */
export function selectGoalLeader<T>(
  candidates: readonly T[],
  getGoalValue: (candidate: T) => number | null | undefined,
  gates: GoalLeaderGates,
): T | null {
  // Gate 1 — entitlement, before any value is read.
  if (gates.designationsWithheld) return null

  // Gates 2 and 3 — a user target and a COMPLETE goal field. This is the SAME
  // function the goal-lens availability check calls, so a surface cannot decide
  // the field is usable and then be handed a crown selected under a different
  // standard. They were two hand-written expressions in two files, and they had
  // already drifted (`.some` vs `.every`).
  if (!hasCompleteGoalField(candidates, getGoalValue, gates)) return null
  const values = candidates.map(getGoalValue)

  // Gates 4 and 5 — a unique maximum that clears the floor.
  let best: T | null = null
  let bestValue = -Infinity
  let tiedAtMax = false
  for (let i = 0; i < candidates.length; i += 1) {
    const value = values[i] as number
    if (value > bestValue) {
      bestValue = value
      best = candidates[i]
      tiedAtMax = false
    } else if (value === bestValue) {
      tiedAtMax = true
    }
  }

  if (best == null || tiedAtMax) return null
  if (bestValue < SUB_ONE_PERCENT_FLOOR) return null
  return best
}

/**
 * The goal-metric lead in percentage points, leader minus runner-up.
 *
 * ⚠ A GOAL HEADLINE MUST NOT CARRY A COMPARATIVE SUBLINE. `buildV7Headline`
 * printed "Leads by N points" — a `winProbability` gap — directly beneath the
 * goal-attainment headline, so the reader read a comparative gap as a goal
 * gap. Worse, once the headline crowns the GOAL leader, the comparative gap
 * is about a DIFFERENT OPTION entirely. Headline and subline now describe one
 * subject and one metric, and this is the function that keeps the metrics
 * paired with their claims.
 *
 * Returns null when there is no rival to difference against. Only ever called
 * with a `candidates` set that already passed `selectGoalLeader`, so every
 * value is finite — but the finiteness filter stays, because a guard that
 * depends on its caller's discipline is not a guard.
 */
export function goalLeadPoints<T>(
  candidates: readonly T[],
  getGoalValue: (candidate: T) => number | null | undefined,
  leader: T,
): number | null {
  const leaderValue = getGoalValue(leader)
  if (!isFiniteProbability(leaderValue)) return null

  let runnerUp = -Infinity
  for (const candidate of candidates) {
    if (candidate === leader) continue
    const value = getGoalValue(candidate)
    if (isFiniteProbability(value) && value > runnerUp) runnerUp = value
  }
  if (runnerUp === -Infinity) return null

  return Math.round((leaderValue - runnerUp) * 100)
}
