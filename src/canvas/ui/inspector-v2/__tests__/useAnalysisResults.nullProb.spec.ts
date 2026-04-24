/**
 * Phase 2.3 — hasAnyRealProbability helper.
 *
 * Pure function under test — consumed by InsightsPanel, GoalNode, and
 * (indirectly via the journey store) renderTimeline. The BoundaryError
 * contract depends on this returning false for: (a) missing report,
 * (b) empty option_comparison, (c) option_comparison with all nulls.
 */
import { describe, expect, it } from 'vitest'
import { hasAnyRealProbability, type InspectorReport } from '../useAnalysisResults'

describe('hasAnyRealProbability', () => {
  it('returns false when report is null', () => {
    expect(hasAnyRealProbability(null)).toBe(false)
  })

  it('returns false when report is undefined', () => {
    expect(hasAnyRealProbability(undefined)).toBe(false)
  })

  it('returns false when option_comparison is absent and probability_of_goal is also absent', () => {
    expect(hasAnyRealProbability({} as InspectorReport)).toBe(false)
  })

  it('returns true when probability_of_goal is a finite number (no option_comparison)', () => {
    expect(hasAnyRealProbability({ probability_of_goal: 0.62 } as InspectorReport)).toBe(true)
  })

  it('returns false when probability_of_goal is NaN', () => {
    expect(hasAnyRealProbability({ probability_of_goal: NaN } as InspectorReport)).toBe(false)
  })

  it('returns true when at least one option has a finite win_probability', () => {
    const report: InspectorReport = {
      option_comparison: [
        { option_id: 'a', win_probability: 0.7 },
        { option_id: 'b' },
      ],
    }
    expect(hasAnyRealProbability(report)).toBe(true)
  })

  it('returns false when all options have null/missing win_probability (BoundaryError trace)', () => {
    const report: InspectorReport = {
      option_comparison: [
        { option_id: 'a' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { option_id: 'b', win_probability: null as any },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { option_id: 'c', win_probability: undefined as any },
      ],
    }
    expect(hasAnyRealProbability(report)).toBe(false)
  })

  it('returns false when option_comparison is an empty array and no root probability', () => {
    expect(hasAnyRealProbability({ option_comparison: [] })).toBe(false)
  })

  it('returns true when option_comparison is empty but probability_of_goal is finite (I-3 alignment)', () => {
    // Either source is sufficient proof of renderable probability. Empty
    // option_comparison must not veto a valid root probability.
    const report: InspectorReport = {
      option_comparison: [],
      probability_of_goal: 0.55,
    }
    expect(hasAnyRealProbability(report)).toBe(true)
  })

  it('treats finite zero as renderable (P1-2): win_probability=0 returns true', () => {
    const report: InspectorReport = {
      option_comparison: [{ option_id: 'a', win_probability: 0 }],
    }
    expect(hasAnyRealProbability(report)).toBe(true)
  })

  it('treats finite zero as renderable (P1-2): probability_of_goal=0 returns true', () => {
    const report: InspectorReport = { probability_of_goal: 0 }
    expect(hasAnyRealProbability(report)).toBe(true)
  })

  it('returns false for Infinity', () => {
    const report: InspectorReport = {
      option_comparison: [{ option_id: 'a', win_probability: Infinity }],
    }
    expect(hasAnyRealProbability(report)).toBe(false)
  })
})
