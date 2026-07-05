/**
 * UI-SEM-058 — raw → normalised goal-threshold conversion at the PLoT
 * request boundary.
 *
 * store.goalThreshold is user units (raw); PLoT's goal_threshold contract is
 * normalised 0-1. The override must convert raw/cap, pass through values
 * already provably normalised, and OMIT anything unprovable so the request
 * builder's analysisReady.goal_threshold stands (fail-safe: a missing
 * threshold means no probability_of_goal, never a corrupt analysis).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { normaliseGoalThresholdForRequest, resolveGoalThresholdCap } from '../useV2Run'

describe('normaliseGoalThresholdForRequest (UI-SEM-058)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('converts raw user units against the CEE cap (20 / cap 25 → 0.8)', () => {
    expect(normaliseGoalThresholdForRequest(20, 25)).toBeCloseTo(0.8)
  })

  it('passes through a value already in [0,1] when no cap exists', () => {
    expect(normaliseGoalThresholdForRequest(0.5, undefined)).toBe(0.5)
    expect(normaliseGoalThresholdForRequest(0, undefined)).toBe(0)
    expect(normaliseGoalThresholdForRequest(1, undefined)).toBe(1)
  })

  it('omits (undefined) when no cap exists and the value cannot be normalised', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(normaliseGoalThresholdForRequest(20, undefined)).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('omits when raw/cap lands outside [0,1] (raw above the scale cap)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(normaliseGoalThresholdForRequest(30, 25)).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('omits for null/undefined/non-finite input and invalid caps', () => {
    expect(normaliseGoalThresholdForRequest(null, 25)).toBeUndefined()
    expect(normaliseGoalThresholdForRequest(undefined, 25)).toBeUndefined()
    expect(normaliseGoalThresholdForRequest(Number.NaN, 25)).toBeUndefined()
    // cap 0 / negative / NaN are ignored — value must then prove itself in [0,1]
    expect(normaliseGoalThresholdForRequest(0.6, 0)).toBe(0.6)
    expect(normaliseGoalThresholdForRequest(0.6, -5)).toBe(0.6)
    expect(normaliseGoalThresholdForRequest(0.6, Number.NaN)).toBe(0.6)
  })

  it('a threshold at the cap normalises to exactly 1 even across a float ULP', () => {
    // 0.1 + 0.2 = 0.30000000000000004; divided by cap 0.3 this lands one ULP
    // above 1 — a legitimate 100% target must not be dropped over the last
    // bit of a float.
    expect(normaliseGoalThresholdForRequest(0.1 + 0.2, 0.3)).toBe(1)
    expect(normaliseGoalThresholdForRequest(25, 25)).toBe(1)
  })
})

describe('resolveGoalThresholdCap (request boundary uses the display chain)', () => {
  const goalNode = (data: Record<string, unknown>) => [
    { id: 'goal_1', data: { label: 'Goal', ...data } },
    { id: 'opt_1', data: { label: 'Option' } },
  ]

  it('prefers analysis_ready.goal_threshold_cap', () => {
    expect(
      resolveGoalThresholdCap({ goal_threshold_cap: 25 }, goalNode({ goal_threshold_cap: 100 }), 'goal_1'),
    ).toBe(25)
  })

  it('falls back to goal node data: goal_threshold_cap, then threshold_cap, then scale_max', () => {
    expect(resolveGoalThresholdCap(null, goalNode({ goal_threshold_cap: 40 }), 'goal_1')).toBe(40)
    expect(resolveGoalThresholdCap(null, goalNode({ threshold_cap: 50 }), 'goal_1')).toBe(50)
    expect(resolveGoalThresholdCap(null, goalNode({ scale_max: 60 }), 'goal_1')).toBe(60)
  })

  it('returns undefined when no valid cap exists anywhere', () => {
    expect(resolveGoalThresholdCap(null, goalNode({}), 'goal_1')).toBeUndefined()
    expect(resolveGoalThresholdCap({ goal_threshold_cap: 0 }, goalNode({ scale_max: -1 }), 'goal_1')).toBeUndefined()
    expect(resolveGoalThresholdCap(null, goalNode({ goal_threshold_cap: 25 }), 'missing_node')).toBeUndefined()
  })
})
