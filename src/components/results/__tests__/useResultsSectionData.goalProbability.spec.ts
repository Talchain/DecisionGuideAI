/**
 * useResultsSectionData — goalProbability collapse (T6 P0-3 + staging fix),
 * as seen THROUGH the UI-SEM-088 constraint honesty gate.
 *
 * The full producer precedence (joint when constrained → goal_probability →
 * joint as auto-derived fallback) is exercised in the POSITIVE-CONTROL block,
 * which flips the trust constants false. While the gates are ON the two seams
 * they guard (the V2 responseMapper's constraint_analysis passthrough +
 * selectGoalProbability) collapse every option to the unconstrained
 * goal_probability and never surface a constraint-derived joint figure.
 *
 * Post-split (UI-SEM-088): the two seams now carry independent constants
 * (PLOT_JOINT_HEADLINE_SUSPECT for selectGoalProbability, seam 1;
 * PLOT_PER_OPTION_CONSTRAINTS_SUSPECT for the responseMapper, seam 2). This
 * end-to-end suite drives BOTH together, so the single `suspect` toggle maps to
 * both getters — modelling the both-gated and both-restored extremes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

// Both guarded seams resolve to this one module. A single mutable getter drives
// BOTH split constants in lockstep so the suite can pin the both-gated and
// both-restored extremes of the end-to-end flow.
const mockTrust = vi.hoisted(() => ({ suspect: true }))
vi.mock('../../../adapters/plot/constraintTrust', () => ({
  get PLOT_JOINT_HEADLINE_SUSPECT() {
    return mockTrust.suspect
  },
  get PLOT_PER_OPTION_CONSTRAINTS_SUSPECT() {
    return mockTrust.suspect
  },
}))

type ComparisonEntry = Record<string, unknown>

function makeV2Response(optionA: ComparisonEntry, optionB: ComparisonEntry): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      {
        option_id: 'opt_a',
        option_label: 'Option A',
        win_probability: 0.6,
        outcome: { mean: 0.02, std: 0.1, p10: -0.1, p50: 0.02, p90: 0.15, n_samples: 1000, n_valid_samples: 1000, validity_ratio: 1 },
        ...optionA,
      },
      {
        option_id: 'opt_b',
        option_label: 'Option B',
        win_probability: 0.4,
        outcome: { mean: -0.01, std: 0.1, p10: -0.12, p50: -0.01, p90: 0.1, n_samples: 1000, n_valid_samples: 1000, validity_ratio: 1 },
        ...optionB,
      },
    ],
    critiques: [],
    drivers: [],
    edge_sensitivity: [],
    factor_sensitivity: [],
    robustness: { fragile_edges: [], robust_edges: [] },
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
  } as unknown as V2RunResponse
}

const OPTION_NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option A' } },
  { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option B' } },
]

function setStoreWithMappedReport(v2Response: V2RunResponse): void {
  const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report } as any,
    runMeta: {} as any,
    nodes: OPTION_NODES as any,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as any)
}

function adaptedGoalProbabilities(): Record<string, number | null | undefined> {
  const { result } = renderHook(() => useResultsSectionData())
  const out: Record<string, number | null | undefined> = {}
  for (const o of result.current.recommendation?.allOptions ?? []) {
    out[o.id] = o.goalProbability
  }
  return out
}

/**
 * ROADMAP 2.282 — the same hook render, reading the OTHER field the adapter
 * publishes for each option.
 *
 * Every assertion above reads `goalProbability` and none reads
 * `goalFitIsSubstitutedJoint`, so `useResultsSectionData.ts:1593` — the SOLE
 * production expression that decides whether OptionCards may use possessive
 * goal framing — was never executed by any spec on a substituted or a
 * constrained payload. The surface tests pin the render given the flag; this
 * pins the flag itself, through the real hook and the real adapter.
 */
function adaptedSubstitutedFlags(): Record<string, boolean | undefined> {
  const { result } = renderHook(() => useResultsSectionData())
  const out: Record<string, boolean | undefined> = {}
  for (const o of result.current.recommendation?.allOptions ?? []) {
    out[o.id] = o.goalFitIsSubstitutedJoint
  }
  return out
}

/**
 * ⭐ L62 — the field that now carries the state 2.282's flag used to.
 * `goalFitIsSubstitutedJoint` meant "the number shown is a substituted joint
 * figure"; there is no such number any more, so it is false everywhere and
 * `goalFitWithheld` says what happened instead. Both are read here, by the
 * same hook render, so a test cannot assert one while the other quietly
 * disagrees.
 */
function adaptedWithheldFlags(): Record<string, boolean | undefined> {
  const { result } = renderHook(() => useResultsSectionData())
  const out: Record<string, boolean | undefined> = {}
  for (const o of result.current.recommendation?.allOptions ?? []) {
    out[o.id] = o.goalFitWithheld
  }
  return out
}

describe('useResultsSectionData — goalProbability collapse — gate ON (default)', () => {
  beforeEach(() => {
    mockTrust.suspect = true
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
    } as any)
  })

  it('suppresses the auto-derived joint figure (no goal_probability, no constraint_analysis) → null', () => {
    // Staging shape: ISL auto-derived the goal threshold as a constraint —
    // joint present (zero!), unconstrained and constraint_analysis absent.
    // The joint arrives with no client-visible constraint marker, so while
    // suspect we cannot trust it and fall back to the (absent) unconstrained.
    setStoreWithMappedReport(makeV2Response(
      { probability_of_joint_goal: 0 },
      { probability_of_joint_goal: 0 },
    ))
    const probs = adaptedGoalProbabilities()
    expect(probs.opt_a).toBeNull()
    expect(probs.opt_b).toBeNull()
  })

  it('prefers unconstrained goal_probability when no constraint_analysis exists', () => {
    setStoreWithMappedReport(makeV2Response(
      { probability_of_goal: 0.4, probability_of_joint_goal: 0.2 },
      { probability_of_goal: 0.7 },
    ))
    const probs = adaptedGoalProbabilities()
    expect(probs.opt_a).toBe(0.4)
    expect(probs.opt_b).toBe(0.7)
  })

  it('NEVER substitutes the joint figure for a constrained option → unconstrained goal_probability', () => {
    setStoreWithMappedReport(makeV2Response(
      {
        probability_of_goal: 0.4,
        probability_of_joint_goal: 0.2,
        constraint_analysis: {
          constraints: [{ constraint_id: 'c1', node_id: 'n1', direction: 'max', threshold: 1 }],
          joint_probability: 0.2,
        },
      },
      { probability_of_goal: 0.7 },
    ))
    const probs = adaptedGoalProbabilities()
    expect(probs.opt_a).toBe(0.4)
    expect(probs.opt_b).toBe(0.7)
  })

  it('stays null when the producer sent no goal answer at all', () => {
    setStoreWithMappedReport(makeV2Response({}, {}))
    const probs = adaptedGoalProbabilities()
    expect(probs.opt_a).toBeNull()
    expect(probs.opt_b).toBeNull()
  })
})

describe('useResultsSectionData — goalProbability collapse — POSITIVE CONTROL: gate OFF', () => {
  beforeEach(() => {
    mockTrust.suspect = false
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
    } as any)
  })

  /**
   * ⭐ SUPERSEDED BY L62 — kept inverted, so restoring the fallback REDs here
   * as well as at the selector. This is the hook-level twin of
   * `selectGoalProbability.spec.ts`'s "does NOT fall back" test: the pair is
   * what proves the withhold survives the hop into `OptionResult` rather than
   * being re-derived on the way.
   */
  it('L62: does NOT fall back to probability_of_joint_goal when goal_probability and constraint_analysis are absent', () => {
    setStoreWithMappedReport(makeV2Response(
      { probability_of_joint_goal: 0 },
      { probability_of_joint_goal: 0 },
    ))
    const probs = adaptedGoalProbabilities()
    expect(probs.opt_a).toBeNull()
    expect(probs.opt_b).toBeNull()
  })

  it('prefers unconstrained goal_probability when no constraint_analysis exists', () => {
    setStoreWithMappedReport(makeV2Response(
      { probability_of_goal: 0.4, probability_of_joint_goal: 0.2 },
      { probability_of_goal: 0.7 },
    ))
    const probs = adaptedGoalProbabilities()
    expect(probs.opt_a).toBe(0.4)
    expect(probs.opt_b).toBe(0.7)
  })

  it('prefers the joint probability when the option carries constraint_analysis constraints', () => {
    setStoreWithMappedReport(makeV2Response(
      {
        probability_of_goal: 0.4,
        probability_of_joint_goal: 0.2,
        constraint_analysis: {
          constraints: [{ constraint_id: 'c1', node_id: 'n1', direction: 'max', threshold: 1 }],
          joint_probability: 0.2,
        },
      },
      { probability_of_goal: 0.7 },
    ))
    const probs = adaptedGoalProbabilities()
    expect(probs.opt_a).toBe(0.2)
    expect(probs.opt_b).toBe(0.7)
  })
})

/**
 * ROADMAP 2.282 — THE POSSESSIVE GATE'S SOURCE EXPRESSION.
 *
 * `useResultsSectionData.ts:1593` is:
 *
 *   goalFitIsSubstitutedJoint: goalDecision.basis === 'joint_goal_substituted'
 *
 * It is the ONLY production expression that sets the flag OptionCards gates
 * its goal copy on, and before this block no spec executed it on either of
 * the two bases that discriminate. The surface specs
 * (`substitutedJointGate.optionCards.spec.tsx`) necessarily REBUILD this
 * expression in their fixture factory to construct an `OptionResult`, so they
 * would keep passing if `:1593` were widened or inverted — the textual-mirror
 * failure mode #555 hit in this repo the same day (CLAUDE.md trap 11: test
 * the real thing, not a restatement of its predicate).
 *
 * The gate must be ON-substituted and OFF-constrained, and NOTHING else
 * distinguishes those two payloads but `constraint_analysis`. Both arms run
 * with `mockTrust.suspect = false`, because while the UI-SEM-088 honesty gate
 * is ON the selector never substitutes at all and every assertion here would
 * pass by testing nothing (trap 13) — the first test pins exactly that.
 */
describe('useResultsSectionData — goalFitIsSubstitutedJoint (ROADMAP 2.282, the gate OptionCards reads)', () => {
  beforeEach(() => {
    mockTrust.suspect = false
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
    } as any)
  })

  it('control: with the UI-SEM-088 gate ON no option is ever flagged substituted (so the arms below are not vacuous)', () => {
    mockTrust.suspect = true
    setStoreWithMappedReport(makeV2Response(
      { probability_of_joint_goal: 0.0054 },
      { probability_of_joint_goal: 0.0018 },
    ))
    const flags = adaptedSubstitutedFlags()
    expect(flags.opt_a).toBe(false)
    expect(flags.opt_b).toBe(false)
    // …and the reason is that nothing was substituted, not that the flag lies.
    expect(adaptedGoalProbabilities().opt_a).toBeNull()
  })

  it('L62 — WITHHELD: joint present, goal_probability absent, no constraint_analysis → no number, withheld flag TRUE', () => {
    // The witnessed staging shape (2026-08-01): ISL refused
    // `probability_of_goal` because `goal_threshold_frame` was never
    // stamped, and the auto-materialised constraint's joint figure stands in.
    setStoreWithMappedReport(makeV2Response(
      { probability_of_joint_goal: 0.0054 },
      { probability_of_joint_goal: 0.0018 },
    ))
    // ⭐ L62. ROADMAP 2.282 pinned `goalFitIsSubstitutedJoint: true` with the
    // value still published — "the withhold is on the framing only". The
    // framing was never the problem: L60 showed the VALUE is
    // P(level-or-count threshold >= change-frame sample), a structural zero.
    // So the substituted flag is now false (nothing is substituted) and the
    // withheld flag carries the state.
    const flags = adaptedSubstitutedFlags()
    expect(flags.opt_a).toBe(false)
    expect(flags.opt_b).toBe(false)
    expect(adaptedWithheldFlags().opt_a).toBe(true)
    expect(adaptedWithheldFlags().opt_b).toBe(true)
    // The number the user was shown is gone.
    expect(adaptedGoalProbabilities().opt_a).toBeNull()
  })

  it('CONSTRAINED: the same joint figure WITH constraint_analysis → flag FALSE (possessive earned)', () => {
    setStoreWithMappedReport(makeV2Response(
      {
        probability_of_joint_goal: 0.2,
        constraint_analysis: {
          constraints: [{ constraint_id: 'c1', node_id: 'n1', direction: 'max', threshold: 1 }],
          joint_probability: 0.2,
        },
      },
      { probability_of_joint_goal: 0.2 },
    ))
    // ⭐ L62: the DISCRIMINATION this test exists for is unchanged and is what
    // proves the gate is not a blanket ban on joint figures — one payload
    // shape apart, opposite outcomes. Only the name of opt_b's state moved.
    const flags = adaptedSubstitutedFlags()
    // opt_a carries its own constraints → 'joint_goal_constrained' → the
    // possessive is EARNED and the number is still shown.
    expect(flags.opt_a).toBe(false)
    expect(adaptedGoalProbabilities().opt_a).toBe(0.2)
    expect(adaptedWithheldFlags().opt_a).toBe(false)
    // opt_b has the identical joint number and NO constraints → withheld.
    expect(flags.opt_b).toBe(false)
    expect(adaptedWithheldFlags().opt_b).toBe(true)
    expect(adaptedGoalProbabilities().opt_b).toBeNull()
  })

  it('REAL goal probability → flag FALSE', () => {
    setStoreWithMappedReport(makeV2Response(
      { probability_of_goal: 0.55, probability_of_joint_goal: 0.0054 },
      { probability_of_goal: 0.7 },
    ))
    const flags = adaptedSubstitutedFlags()
    expect(flags.opt_a).toBe(false)
    expect(flags.opt_b).toBe(false)
  })
})
