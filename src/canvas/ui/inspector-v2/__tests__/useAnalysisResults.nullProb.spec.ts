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

  it('returns true when option_comparison is empty but probability_of_goal is finite', () => {
    // Empty option_comparison is "no option-level analysis attempted"; a
    // finite root probability counts as a goal-level success signal.
    const report: InspectorReport = {
      option_comparison: [],
      probability_of_goal: 0.55,
    }
    expect(hasAnyRealProbability(report)).toBe(true)
  })

  it('returns FALSE when option_comparison is non-empty-but-all-null, even with finite probability_of_goal (P1-2)', () => {
    // Strict-render: a present-but-unrenderable options array is an
    // engine-returned failure state. Even if probability_of_goal is a
    // valid goal-level number, the per-option nulls veto success copy.
    // The engine tried to compute per-option and failed; root does not
    // rescue that.
    const report: InspectorReport = {
      option_comparison: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { option_id: 'a', win_probability: null as any },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { option_id: 'b', win_probability: null as any },
      ],
      probability_of_goal: 0.73,
    }
    expect(hasAnyRealProbability(report)).toBe(false)
  })

  it('returns true when one option is finite and another is null + finite root', () => {
    // Partial success still renders — at least one option has a value.
    const report: InspectorReport = {
      option_comparison: [
        { option_id: 'a', win_probability: 0.6 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { option_id: 'b', win_probability: null as any },
      ],
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
