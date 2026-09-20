/**
 * A FINISHED RUN MUST NOT ABORT THE FETCH FOR ITS OWN RESULT.
 *
 * ⛔⛔ WITNESSED, bundle `84c8e210`, scenario `26b908ee`, 19 Sep 2026:
 *
 *     armed_at    18:56:15.594
 *     computed_at 18:56:16.932   ← the run finished
 *     settled_at  18:56:58.194   outcome = "aborted"
 *
 * `runKey` is `null` unless `run_state.kind === 'running'` and it was an effect
 * dependency, so the moment a turn carried the COMPLETED verdict the effect
 * re-ran and its cleanup aborted the schedule. **The schedule was killed by the
 * event it existed to wait for.**
 *
 * ⭐ AND THE TIMING IS WHY IT MATTERS RATHER THAN BEING TIDY. The verdict and
 * the result travel separately — #1768 exists precisely because a
 * `complete_current` arrives with `resultsHydrated: false` — so the window
 * between "the run finished" and "the result is readable" is exactly when this
 * schedule earns its keep. It was being closed at the START of that window.
 *
 * ⚠ TWO ABORTS ARE CORRECT AND ARE ASSERTED BELOW, which is why the rule is a
 * latch and not "never abort": a genuinely NEW run replaces it, and a scenario
 * switch drops it. Without those two arms this file would license abandoning
 * the user's current question for a stale one.
 */
import { describe, it, expect } from 'vitest'

import { resolveArmKey } from '../useProvisionalAnalysisDelivery'

const SC = 'scenario-26b908ee'
const RUN_A = `${SC}:2026-09-19T18:56:14.645Z`
const RUN_B = `${SC}:2026-09-19T19:10:00.000Z`

const EMPTY = { runKey: null, scenarioId: null }

describe('THE CONTROL — arming still happens at all', () => {
  /**
   * ⭐⭐ Without this, every "the latch holds" assertion below could pass on a
   * rule that never arms in the first place (CLAUDE.md trap 13).
   */
  it('a running run arms the schedule', () => {
    expect(resolveArmKey(EMPTY, SC, RUN_A)).toEqual({ scenarioId: SC, runKey: RUN_A })
  })

  /**
   * ⚠ MY OWN EXPECTATION WAS WRONG HERE FIRST, and the correction is the
   * clearer statement of the rule: arriving at a scenario for the first time IS
   * a scenario change (`null -> SC`), so the latch is seated for that scenario
   * with nothing armed. The old expectation asserted the scenario was not
   * recorded either, which would have made the very first completed verdict
   * look like a scenario switch and drop a latch that had just been set.
   */
  it('with no run asserted, the scenario is seated and nothing is armed', () => {
    expect(resolveArmKey(EMPTY, SC, null)).toEqual({ runKey: null, scenarioId: SC })
  })
})

describe('THE DEFECT — the run finishing must not drop the latch', () => {
  /**
   * ⛔ THE ARM THAT REPRODUCES PAUL'S ABORT. Before the fix the effect key went
   * to null here, the effect re-ran, and the cleanup aborted a schedule that
   * was 1.3 seconds into a 130-second budget.
   */
  it('a completed verdict leaves the schedule armed for the run it is fetching', () => {
    const armed = resolveArmKey(EMPTY, SC, RUN_A)
    // The turn arrives carrying `complete_current`, so the wire stops saying
    // 'running' and `runKey` is null.
    const after = resolveArmKey(armed, SC, null)
    expect(after.runKey, 'the run finishing is not the run being abandoned').toBe(RUN_A)
  })

  it('and it stays armed across any number of non-running turns', () => {
    let state = resolveArmKey(EMPTY, SC, RUN_A)
    for (let i = 0; i < 5; i++) state = resolveArmKey(state, SC, null)
    expect(state.runKey).toBe(RUN_A)
  })
})

describe('THE TWO ABORTS THAT ARE CORRECT — kept, and pinned', () => {
  /**
   * ⚠ A NEW run replaces the latch. `started_at` changing IS a new run, and
   * continuing to fetch the previous one would deliver an answer to a question
   * the reader has moved on from.
   */
  it('a different running run replaces the latch', () => {
    const armed = resolveArmKey(EMPTY, SC, RUN_A)
    expect(resolveArmKey(armed, SC, RUN_B).runKey).toBe(RUN_B)
  })

  /**
   * ⚠ A SCENARIO SWITCH drops it. Delivering a result onto a model the reader
   * is no longer looking at is the divergence harm the applier's own guards
   * exist to prevent — this rule must not reintroduce it one level up.
   */
  it('a scenario switch drops the latch entirely', () => {
    const armed = resolveArmKey(EMPTY, SC, RUN_A)
    const switched = resolveArmKey(armed, 'scenario-other', null)
    expect(switched.runKey).toBeNull()
    expect(switched.scenarioId).toBe('scenario-other')
  })

  /** And a switch that lands on a running run arms for THAT one immediately. */
  it('a switch onto a running run arms for the new scenario', () => {
    const armed = resolveArmKey(EMPTY, SC, RUN_A)
    const other = 'scenario-other'
    const key = `${other}:2026-09-19T20:00:00.000Z`
    expect(resolveArmKey(armed, other, key)).toEqual({ scenarioId: other, runKey: key })
  })
})
