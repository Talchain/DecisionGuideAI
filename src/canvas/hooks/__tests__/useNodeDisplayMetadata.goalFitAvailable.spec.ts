/**
 * ROADMAP 2.275 — the CONTAINER/POINTER gap behind the witnessed goal-node
 * contradiction, pinned by EXECUTING THE REAL HOOK.
 *
 * ⚠ WHY THIS FILE WAS REWRITTEN (adversarial review of #555, trap 11 + trap 12).
 * Its first version asserted against `anyOptionCarriesGoalFit` — a LOCAL
 * REIMPLEMENTATION of the hook's predicate written inside the test. That is a
 * hand-maintained mirror of the logic, not the logic: the reviewer hard-coded
 * `goalFitAvailable = false` inside `useNodeDisplayMetadata` and all 1,243
 * tests stayed GREEN, because this file never imported the hook and
 * `GoalNode.spec.tsx` mocks it. The fix was provably untested.
 * These tests now call `renderHook(() => useNodeDisplayMetadata(...))`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────
 * `selectGoalProbability` was already the single chooser and both surfaces
 * called it. The defect survived that unification because the CANVAS never
 * reached the chooser: the hook reads
 * `option_probabilities[recommendedOptionId]`, and the live V5 payload
 * (witness-2267 `f-turn-2.json`, `r4-turn-2.json`) carries
 *   · `robustness.recommended_option_id` — ABSENT (key not present at all)
 *   · `leading_option_id`                — null
 * while every option carries a real `probability_of_joint_goal` plus
 * `goal_fit_basis.scored_from`.
 *
 * So the `if (recommendedOptionId)` gate never opened, `achievementProbability`
 * stayed null, and the goal node denied a figure the same report held 4 times.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { create, type StoreApi, type UseBoundStore } from 'zustand'

interface MockCanvasState {
  results: { status: string; report: unknown }
}

let store: UseBoundStore<StoreApi<MockCanvasState>>

vi.mock('../../store', () => ({
  get useCanvasStore() {
    return store
  },
}))

// Imported AFTER the store mock is registered.
const { useNodeDisplayMetadata } = await import('../useNodeDisplayMetadata')

/**
 * The witnessed report shape, verbatim from witness-2267 `f-turn-2.json`
 * `enrichment.option_comparison[]` — mapped into the `option_probabilities`
 * map the way `mapV5AnalysisToReport` builds it (keyed by option_id).
 *
 * Note what is DELIBERATELY absent, because that absence IS the defect:
 * `robustness.recommended_option_id`.
 */
const WITNESSED_REPORT = {
  option_probabilities: {
    opt_bristol: {
      probability_of_joint_goal: 0.0002,
      goal_fit_basis: { scored_from: 'modelled_outcome_distribution', node_ids: ['goal_capacity'] },
    },
    opt_leeds: {
      probability_of_joint_goal: 0,
      goal_fit_basis: { scored_from: 'modelled_outcome_distribution', node_ids: ['goal_capacity'] },
    },
    opt_phased: {
      probability_of_joint_goal: 0.0004,
      goal_fit_basis: { scored_from: 'modelled_outcome_distribution', node_ids: ['goal_capacity'] },
    },
    opt_status_quo: {
      probability_of_joint_goal: 0,
      goal_fit_basis: { scored_from: 'modelled_outcome_distribution', node_ids: ['goal_capacity'] },
    },
  },
  // No `recommended_option_id` — exactly as the live payload arrives.
  robustness: { display_verdict: 'fragile' },
}

function setReport(report: unknown, status = 'complete') {
  store = create<MockCanvasState>(() => ({ results: { status, report } }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNodeDisplayMetadata — goalFitAvailable (REAL hook)', () => {
  /**
   * ⭐ AMENDED BY L62 (2026-08-04) — AND THE FLIP IS THE USER-VISIBLE WIN.
   *
   * ROADMAP 2.275 added `goalFitAvailable` because the canvas goal node denied
   * a probability while the Goal-fit sub-tab rendered "< 1%" four times from
   * the same report. The flag made the node point the user AT those per-option
   * figures ("see Goal fit for each option's chance").
   *
   * L60 then established what those figures were: P(level-or-count threshold
   * >= change-frame sample), structurally ~0 for every option. So the flag was
   * directing users to a fabrication. `selectGoalProbability` now withholds
   * them, this scan finds nothing admissible, and the node states the simpler
   * truth instead. 2.275's contradiction is resolved in the honest direction —
   * both surfaces deny, rather than both affirming a fiction.
   *
   * The flag itself is NOT retired: the positive control below proves it still
   * fires for a run carrying real per-option goal figures, which is the case
   * 2.275 was actually built for.
   */
  it('L62: is FALSE on the witnessed payload — the per-option figures it used to advertise are withheld', () => {
    setReport(WITNESSED_REPORT)
    const { result } = renderHook(() => useNodeDisplayMetadata('goal_capacity', 'goal'))

    expect(result.current.achievementProbability).toBeNull()
    expect(result.current.goalFitAvailable).toBe(false)
  })

  it('⭐ L62 POSITIVE CONTROL: still TRUE when the run carries REAL per-option goal probabilities and no option is designated', () => {
    // This is 2.275's actual case, and without it the amendment above would be
    // indistinguishable from deleting the feature (trap 13). Same report
    // shape, same missing pointer — only the producer channel differs.
    setReport({
      ...WITNESSED_REPORT,
      option_probabilities: {
        opt_bristol: { probability_of_goal: 0.31 },
        opt_leeds: { probability_of_goal: 0.12 },
      },
    })
    const { result } = renderHook(() => useNodeDisplayMetadata('goal_capacity', 'goal'))

    expect(result.current.achievementProbability).toBeNull()
    expect(result.current.goalFitAvailable).toBe(true)
  })

  it('is FALSE when the run carries no admissible goal figure for any option', () => {
    setReport({
      option_probabilities: {
        opt_a: { win_probability: 0.5 },
        opt_b: { win_probability: 0.5 },
      },
      robustness: {},
    })
    const { result } = renderHook(() => useNodeDisplayMetadata('goal_capacity', 'goal'))

    expect(result.current.achievementProbability).toBeNull()
    expect(result.current.goalFitAvailable).toBe(false)
  })

  it('a hard zero still counts as a figure the run produced', () => {
    // witness §11c: run 4 returned exactly 0 for all four options. Zero is a
    // result, not an absence — denying it would be the same defect inverted.
    //
    // ⭐ L62 changed the CHANNEL, not the principle. The fixture was
    // `probability_of_joint_goal: 0`, which is now withheld — so the test
    // would have passed by asserting the withhold rather than the zero-is-a-
    // result rule it exists for. It uses the honest goal channel instead, and
    // the rule is pinned exactly as before: an EXACT ZERO is a measurement.
    setReport({
      option_probabilities: { opt_a: { probability_of_goal: 0 } },
      robustness: {},
    })
    const { result } = renderHook(() => useNodeDisplayMetadata('goal_capacity', 'goal'))

    expect(result.current.goalFitAvailable).toBe(true)
  })

  it('is FALSE for a non-goal node even when the figures exist', () => {
    setReport(WITNESSED_REPORT)
    const { result } = renderHook(() => useNodeDisplayMetadata('fac_capex', 'factor'))
    expect(result.current.goalFitAvailable).toBe(false)
  })

  it('is FALSE outside results mode', () => {
    setReport(WITNESSED_REPORT, 'idle')
    const { result } = renderHook(() => useNodeDisplayMetadata('goal_capacity', 'goal'))
    expect(result.current.isResultsMode).toBe(false)
    expect(result.current.goalFitAvailable).toBe(false)
  })

  it('is FALSE once an option IS designated — the node reads its number instead', () => {
    // Positive control for the other direction: with a designation the hook
    // reaches selectGoalProbability, gets a number, and goalFitAvailable is
    // not needed. This is what keeps the two branches mutually exclusive.
    // ⭐ L62: the designated option needs an HONEST figure for this control to
    // test what it claims. With the witnessed (joint-only) payload the hook
    // now reaches the selector and correctly gets NOTHING, so both branches
    // would be false and the mutual exclusivity would hold vacuously.
    setReport({
      ...WITNESSED_REPORT,
      option_probabilities: {
        ...WITNESSED_REPORT.option_probabilities,
        opt_bristol: {
          probability_of_goal: 0.0002,
          constraint_analysis: { constraints: [{ id: 'c1' }] },
          probability_of_joint_goal: 0.0002,
          goal_fit_basis: {
            scored_from: 'modelled_outcome_distribution',
            node_ids: ['goal_capacity'],
          },
        },
      },
      robustness: { recommended_option_id: 'opt_bristol' },
    })
    const { result } = renderHook(() => useNodeDisplayMetadata('goal_capacity', 'goal'))

    expect(result.current.achievementProbability).toBe(0.0002)
    expect(result.current.achievementProbabilityIsModelledBasis).toBe(true)
    expect(result.current.goalFitAvailable).toBe(false)
  })
})
