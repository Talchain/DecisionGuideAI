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

// ---------------------------------------------------------------------------
// P0-2 (external review 2026-07-14): the factor badge must rank on the SAME
// basis as the Drivers panel under PARTIAL influence coverage — via the shared
// policy row (extractPolicyRow), which includes `sensitivity` (the V5 magnitude
// key). The prior inline map omitted `sensitivity`, so every row collapsed to 0
// and the badge fell back to alphabetical order.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Lane C4 (influence-scale disclosure): the hook must surface WHICH basis
// produced `influence` (the shared display model already resolves it) so the
// canvas "I: NN%" pill can disclose the set-relative scale exactly like the
// Drivers panel. Before C4 the provenance was resolved and then dropped.
// ---------------------------------------------------------------------------
describe('useNodeDisplayMetadata — influenceProvenance (lane C4)', () => {
  it('reports normalised_elasticity under partial influence_score coverage (fallback basis)', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          factor_sensitivity: [
            { factor_id: 'A', sensitivity: 0.2, influence_score: 0.9 },
            { factor_id: 'B', sensitivity: 0.8 },
          ],
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('B', 'factor'))
    expect(result.current.influenceProvenance).toBe('normalised_elasticity')
    // The fallback basis is set-relative: the top factor is 1.0 by construction.
    expect(result.current.influence).toBe(1)
  })

  it('reports influence_score when EVERY factor carries a finite producer score', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          factor_sensitivity: [
            { factor_id: 'A', sensitivity: 0.2, influence_score: 0.62 },
            { factor_id: 'B', sensitivity: 0.8, influence_score: 0.31 },
          ],
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('A', 'factor'))
    expect(result.current.influenceProvenance).toBe('influence_score')
    expect(result.current.influence).toBeCloseTo(0.62)
  })

  it('is null outside results mode and for nodes not in the analysis', () => {
    const { result: idle } = renderHook(() => useNodeDisplayMetadata('A', 'factor'))
    expect(idle.current.influenceProvenance).toBeNull()

    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          factor_sensitivity: [{ factor_id: 'A', elasticity: 0.9 }],
        }),
      },
    }
    const { result: missing } = renderHook(() => useNodeDisplayMetadata('not-there', 'factor'))
    expect(missing.current.influenceProvenance).toBeNull()
    expect(missing.current.influence).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// C4 fix 2 (adversarial review, verifier-reproduced): the hook must consume
// THE SAME row feed as the Drivers panel (selectDriverPolicyFeed — the
// five-source merge that KEEPS metric-less rows), or the coverage verdict
// forks per surface: the panel keeps a metric-less row (coverage incomplete →
// set-relative fallback for ALL rows) while the hook's old private feed
// dropped it via extractPolicyRow (coverage complete → absolute producer
// scale) — the pill said "absolute" while the panel said "relative, top
// always 100%" for the SAME report.
// ---------------------------------------------------------------------------
describe('useNodeDisplayMetadata — unified row feed (C4 fix 2)', () => {
  it('review fixture: a metric-less row flips coverage for the canvas exactly as it does for the panel', () => {
    // Row B carries only confidence — no id-less drop, no finite metric. The
    // panel keeps it (rawElasticity defaults to 0), so producer coverage is
    // INCOMPLETE and every row falls back to set-relative normalisation:
    // A displays 1.0 on 'normalised_elasticity', NOT 0.6 on 'influence_score'.
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          factor_sensitivity: [
            { factor_id: 'A', influence_score: 0.6, elasticity: 0.5 },
            { factor_id: 'B', confidence: 0.7 },
          ],
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('A', 'factor'))
    expect(result.current.influenceProvenance).toBe('normalised_elasticity')
    expect(result.current.influence).toBe(1)
  })

  it('review fixture: the metric-less row itself stays in the analysis set with a zero display value', () => {
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          factor_sensitivity: [
            { factor_id: 'A', influence_score: 0.6, elasticity: 0.5 },
            { factor_id: 'B', confidence: 0.7 },
          ],
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('B', 'factor'))
    expect(result.current.inSensitivityAnalysis).toBe(true)
    expect(result.current.confidence).toBeCloseTo(0.7)
    expect(result.current.influence).toBe(0)
    expect(result.current.influenceProvenance).toBe('normalised_elasticity')
  })

  it('drivers_payload-only report: the canvas sees the rows the panel renders (same verdict both surfaces)', () => {
    // No factor_sensitivity at all — the panel's merge picks the rows up from
    // report.drivers_payload.drivers; the hook's old private feed saw nothing.
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          drivers_payload: {
            drivers: [
              { node_id: 'X', elasticity: 0.7 },
              { node_id: 'Y', elasticity: 0.35 },
            ],
          },
        }),
      },
    }
    const { result } = renderHook(() => useNodeDisplayMetadata('X', 'factor'))
    expect(result.current.inSensitivityAnalysis).toBe(true)
    expect(result.current.sensitivityRank).toBe(1)
    expect(result.current.influence).toBe(1)
    expect(result.current.influenceProvenance).toBe('normalised_elasticity')
  })
})

describe('useNodeDisplayMetadata — partial influence coverage (P0-2)', () => {
  it('ranks by `sensitivity` magnitude, not alphabetically, when influence_score coverage is partial', () => {
    // A carries influence_score but a SMALL sensitivity; B carries only a LARGE
    // sensitivity. Partial coverage → policy uses normalised |magnitude| for all,
    // so B (0.8) outranks A (0.2). The V5 mapper writes magnitude as `sensitivity`.
    mockState = {
      results: {
        status: 'complete',
        report: makeReport({
          factor_sensitivity: [
            { factor_id: 'A', sensitivity: 0.2, influence_score: 0.9 },
            { factor_id: 'B', sensitivity: 0.8 },
          ],
        }),
      },
    }
    const { result: rB } = renderHook(() => useNodeDisplayMetadata('B', 'factor'))
    const { result: rA } = renderHook(() => useNodeDisplayMetadata('A', 'factor'))
    // RED before the fix: rawElasticity omitted `sensitivity` → both 0 →
    // alphabetical A #1 and B.influence === 0.
    expect(rB.current.sensitivityRank).toBe(1)
    expect(rA.current.sensitivityRank).toBe(2)
    expect(rB.current.influence ?? 0).toBeGreaterThan(rA.current.influence ?? 0)
  })
})
