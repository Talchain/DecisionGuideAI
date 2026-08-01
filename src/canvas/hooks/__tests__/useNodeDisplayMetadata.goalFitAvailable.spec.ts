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
  it('is TRUE on the witnessed payload, where no option is designated', () => {
    setReport(WITNESSED_REPORT)
    const { result } = renderHook(() => useNodeDisplayMetadata('goal_capacity', 'goal'))

    // The pointer the hook needs is genuinely absent, so no node-level number…
    expect(result.current.achievementProbability).toBeNull()
    // …but the run DID produce per-option goal figures, and the hook says so.
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
    setReport({
      option_probabilities: { opt_a: { probability_of_joint_goal: 0 } },
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
    setReport({
      ...WITNESSED_REPORT,
      robustness: { recommended_option_id: 'opt_bristol' },
    })
    const { result } = renderHook(() => useNodeDisplayMetadata('goal_capacity', 'goal'))

    expect(result.current.achievementProbability).toBe(0.0002)
    expect(result.current.achievementProbabilityIsModelledBasis).toBe(true)
    expect(result.current.goalFitAvailable).toBe(false)
  })
})
