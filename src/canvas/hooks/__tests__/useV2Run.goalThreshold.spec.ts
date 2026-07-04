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
import { normaliseGoalThresholdForRequest } from '../useV2Run'

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
})
