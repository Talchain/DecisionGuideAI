/**
 * useNodeDisplayMetadata — the JOINT figure rides the SAME decision
 * (ROADMAP 2.296 item 5 / 2.282-C2).
 *
 * `GoalPanel` renders the joint-goal quantity as its own separately-labelled
 * claim ("Chance of hitting every target") beside the goal figure. Until this
 * lane it obtained BOTH by passing the WHOLE report into
 * `selectGoalProbability` — a selector that expects ONE option-probability
 * record — so on the real V5 mapper shape (values under
 * `report.option_probabilities[id]`) every read returned null and #556's
 * corrected copy never executed.
 *
 * The fix routes the panel through THIS hook — the established pointer-owner
 * for the goal surface family — which therefore has to publish
 * `jointGoalProbability`, forwarded VERBATIM from the same
 * `selectGoalProbability` decision that produced `achievementProbability`.
 * Forwarded, never re-read off the raw record: a second read would be the
 * two-choosers defect the selector exists to end.
 *
 * Same test discipline as `useNodeDisplayMetadata.goalBasis.spec.ts`: the
 * REAL hook over a mock store — nothing here re-derives the decision.
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

const { useNodeDisplayMetadata } = await import('../useNodeDisplayMetadata')
const { selectGoalProbability } = await import(
  '../../../components/results/utils/selectGoalProbability'
)

/** Witnessed substituted shape: joint present, goal absent, unconstrained. */
const SUBSTITUTED_OPTION = {
  probability_of_joint_goal: 0.0054,
  goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
}

/** Both quantities present — they are genuinely different numbers here. */
const REAL_GOAL_OPTION = {
  probability_of_goal: 0.55,
  probability_of_joint_goal: 0.0054,
}

function reportFor(option: Record<string, unknown>, withPointer = true) {
  return {
    option_probabilities: { opt_a: option },
    robustness: withPointer
      ? { recommended_option_id: 'opt_a', display_verdict: 'fragile' }
      : { display_verdict: 'fragile' },
  }
}

function setReport(report: unknown, status = 'complete') {
  store = create<MockCanvasState>(() => ({ results: { status, report } }))
}

function renderForGoal() {
  return renderHook(() => useNodeDisplayMetadata('goal_revenue', 'goal')).result.current
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNodeDisplayMetadata — jointGoalProbability (REAL hook)', () => {
  it('control: the fixtures drive the REAL selector where this suite claims (trap 13)', () => {
    expect(selectGoalProbability(SUBSTITUTED_OPTION).jointGoalProbability).toBe(0.0054)
    expect(selectGoalProbability(REAL_GOAL_OPTION).jointGoalProbability).toBe(0.0054)
    expect(selectGoalProbability(REAL_GOAL_OPTION).basis).toBe('goal_probability')
  })

  it('RED-first: forwards the joint figure beside a REAL goal probability', () => {
    setReport(reportFor(REAL_GOAL_OPTION))
    const md = renderForGoal()
    expect(md.achievementProbability).toBe(0.55)
    // The two quantities are genuinely different here, and BOTH are published.
    expect(md.jointGoalProbability).toBe(0.0054)
  })

  it('under substitution the joint figure IS the achievement figure — the selector identity survives the hop', () => {
    setReport(reportFor(SUBSTITUTED_OPTION))
    const md = renderForGoal()
    expect(md.achievementProbabilityBasis).toBe('joint_goal_substituted')
    expect(md.jointGoalProbability).toBe(0.0054)
    expect(md.jointGoalProbability).toBe(md.achievementProbability)
  })

  it('no pointer (the 2.275 gap) → no joint figure either — nothing is read outside the owner', () => {
    setReport(reportFor(REAL_GOAL_OPTION, /* withPointer */ false))
    const md = renderForGoal()
    expect(md.achievementProbability).toBeNull()
    expect(md.jointGoalProbability ?? null).toBeNull()
  })

  it('no report → null', () => {
    setReport(null, 'idle')
    const md = renderForGoal()
    expect(md.jointGoalProbability ?? null).toBeNull()
  })
})
