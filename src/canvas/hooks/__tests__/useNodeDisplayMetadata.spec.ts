/**
 * useNodeDisplayMetadata — integration path tests
 *
 * These tests exercise the REAL hook (not mocked) with a real report structure
 * to prevent silent regressions in the data read path.
 *
 * Critical: OptionNode tests mock this hook, so a regression in the
 * option_probabilities read path would otherwise be invisible.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNodeDisplayMetadata } from '../useNodeDisplayMetadata'

// ---------------------------------------------------------------------------
// Store mock — returns whatever state we pass in
// ---------------------------------------------------------------------------
const makeReport = (overrides: Record<string, unknown> = {}) => ({
  schema: 'report.v1' as const,
  meta: { seed: 1, elapsed_ms: 100 },
  result: { mean: 0.7, p10: 0.5, p50: 0.7, p90: 0.9, critique: '' },
  bands: { p10: 0.5, p50: 0.7, p90: 0.9 },
  ...overrides,
})

let mockState = {
  results: { status: 'idle' as string, report: null as unknown },
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: typeof mockState) => unknown) => selector(mockState)),
}))

import { useCanvasStore } from '../../store'

beforeEach(() => {
  vi.clearAllMocks()
  mockState = { results: { status: 'idle', report: null } }
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(mockState as any))
})

// ---------------------------------------------------------------------------
// Win rate — G1 regression guard
// ---------------------------------------------------------------------------
describe('useNodeDisplayMetadata — win rate (G1 path)', () => {
  it('returns winRate=null when results status is not complete', () => {
    mockState = { results: { status: 'idle', report: null } }
    const { result } = renderHook(() => useNodeDisplayMetadata('option-1', 'option'))
    expect(result.current.winRate).toBeNull()
    expect(result.current.isResultsMode).toBe(false)
  })

  it('returns winRate=null when report has no option_probabilities', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({}),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('option-1', 'option'))
    expect(result.current.winRate).toBeNull()
    expect(result.current.isResultsMode).toBe(true)
  })

  it('reads win_probability from option_probabilities[nodeId]', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          option_probabilities: {
            'option-1': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.775 },
            'option-2': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.169 },
          },
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('option-1', 'option'))
    expect(result.current.winRate).toBeCloseTo(0.775)
    expect(result.current.isResultsMode).toBe(true)
  })

  it('returns winRate=null when nodeId not found in option_probabilities', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          option_probabilities: {
            'option-2': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.5 },
          },
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('option-1', 'option'))
    expect(result.current.winRate).toBeNull()
  })

  it('returns winRate=null when win_probability is absent for this option', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          option_probabilities: {
            'option-1': { goal_probability: 0.8, confidence: 0.5 },
          },
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('option-1', 'option'))
    expect(result.current.winRate).toBeNull()
  })

  it('returns correct winRate for second option in multi-option report', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          option_probabilities: {
            'option-1': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.775 },
            'option-2': { goal_probability: 0.3, confidence: 0.5, win_probability: 0.169 },
            'option-3': { goal_probability: 0.2, confidence: 0.5, win_probability: 0.033 },
            'option-4': { goal_probability: 0.1, confidence: 0.5, win_probability: 0.024 },
          },
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('option-2', 'option'))
    expect(result.current.winRate).toBeCloseTo(0.169)
  })
})

// ---------------------------------------------------------------------------
// Achievement probability — outcome/goal nodes
// ---------------------------------------------------------------------------
describe('useNodeDisplayMetadata — achievementProbability', () => {
  it('reads goal_probability for recommended option', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          robustness: { recommended_option_id: 'option-1', recommendation_stability: 0.8 },
          option_probabilities: {
            'option-1': { goal_probability: 0.73, confidence: 0.5 },
          },
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('outcome-1', 'outcome'))
    expect(result.current.achievementProbability).toBeCloseTo(0.73)
  })

  it('returns achievementProbability=null when no recommended_option_id', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          option_probabilities: {
            'option-1': { goal_probability: 0.73, confidence: 0.5 },
          },
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('goal-1', 'goal'))
    expect(result.current.achievementProbability).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// achievementProbabilityIsModelledBasis — goal_fit_basis caveat flag
// (ROADMAP 1.6b follow-up, claim-integrity). Mirrors OptionCards'
// goalFitIsModelledBasis gate: true ONLY when the displayed number is the
// joint-goal figure (hasConstraints && jointProb != null) AND the producer
// marked it scored_from === 'modelled_outcome_distribution'.
// ---------------------------------------------------------------------------
describe('useNodeDisplayMetadata — achievementProbabilityIsModelledBasis', () => {
  it('is true when the joint figure is shown and goal_fit_basis is modelled', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          robustness: { recommended_option_id: 'option-1' },
          option_probabilities: {
            'option-1': {
              goal_probability: 0.5,
              probability_of_joint_goal: 0.73,
              confidence: 0.5,
              constraint_analysis: { constraints: [{ id: 'c1' }] },
              goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
            },
          },
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('goal-1', 'goal'))
    expect(result.current.achievementProbability).toBeCloseTo(0.73)
    expect(result.current.achievementProbabilityIsModelledBasis).toBe(true)
  })

  it('is false (honest default) when goal_fit_basis is absent', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          robustness: { recommended_option_id: 'option-1' },
          option_probabilities: {
            'option-1': {
              goal_probability: 0.5,
              probability_of_joint_goal: 0.73,
              confidence: 0.5,
              constraint_analysis: { constraints: [{ id: 'c1' }] },
            },
          },
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('goal-1', 'goal'))
    expect(result.current.achievementProbability).toBeCloseTo(0.73)
    expect(result.current.achievementProbabilityIsModelledBasis).toBe(false)
  })

  it('is false when the displayed number is the unconstrained goal_probability, even if flagged', () => {
    // No constraints -> achievementProbability falls to goal_probability, NOT
    // the joint figure the caveat qualifies -- the flag must never leak onto
    // the unconstrained number even if goal_fit_basis happens to be present.
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          robustness: { recommended_option_id: 'option-1' },
          option_probabilities: {
            'option-1': {
              goal_probability: 0.5,
              probability_of_joint_goal: 0.73,
              confidence: 0.5,
              goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
            },
          },
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('goal-1', 'goal'))
    expect(result.current.achievementProbability).toBeCloseTo(0.5)
    expect(result.current.achievementProbabilityIsModelledBasis).toBe(false)
  })

  it('is false when scored_from is a different (non-modelled) value', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          robustness: { recommended_option_id: 'option-1' },
          option_probabilities: {
            'option-1': {
              goal_probability: 0.5,
              probability_of_joint_goal: 0.73,
              confidence: 0.5,
              constraint_analysis: { constraints: [{ id: 'c1' }] },
              goal_fit_basis: { scored_from: 'directly_elicited' },
            },
          },
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('goal-1', 'goal'))
    expect(result.current.achievementProbabilityIsModelledBasis).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Factor sensitivity rank — sanity path
// ---------------------------------------------------------------------------
describe('useNodeDisplayMetadata — factor sensitivityRank', () => {
  it('returns sensitivityRank=null outside results mode', () => {
    const { result } = renderHook(() => useNodeDisplayMetadata('factor-1', 'factor'))
    expect(result.current.sensitivityRank).toBeNull()
  })

  it('returns null when report has no factor_sensitivity', () => {
    mockState = {
      results: { status: 'complete', report: makeReport({}) },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('factor-1', 'factor'))
    expect(result.current.sensitivityRank).toBeNull()
  })

  it('ranks top factor as #1', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          factor_sensitivity: [
            { factor_id: 'factor-1', elasticity: 0.9 },
            { factor_id: 'factor-2', elasticity: 0.5 },
            { factor_id: 'factor-3', elasticity: 0.2 },
          ],
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('factor-1', 'factor'))
    expect(result.current.sensitivityRank).toBe(1)
  })

  it('returns null for factor ranked #4 or lower', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          factor_sensitivity: [
            { factor_id: 'factor-1', elasticity: 0.9 },
            { factor_id: 'factor-2', elasticity: 0.7 },
            { factor_id: 'factor-3', elasticity: 0.5 },
            { factor_id: 'factor-4', elasticity: 0.1 },
          ],
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('factor-4', 'factor'))
    expect(result.current.sensitivityRank).toBeNull()
  })
})
