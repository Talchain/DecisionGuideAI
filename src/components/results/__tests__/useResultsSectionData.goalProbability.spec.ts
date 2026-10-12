import { licensedTestReportHeld } from '../../../canvas/runView/__tests__/helpers/licensedTestReport'
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
  const report = licensedTestReportHeld(mapV2ResponseToReportV1(v2Response, { seed: 42 }))
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

// #2747 re-scope 2 (DL-approved cut): the `goalFitIsSubstitutedJoint` / `goalFitWithheld` readers are deleted with the
// fields (the first was always false in C, the second never read by a surface). The goal figure itself is still read below.

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

  // 29 Sep 2026 (AIQ 5882498938): was "prefers the joint probability" — the joint figure is P(all limits hold), never the goal.
  it('reads the goal probability, never the joint, even when the option carries constraint_analysis constraints', () => {
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
    expect(probs.opt_a).not.toBe(0.2) // the discriminating contrast: never the joint figure
    expect(probs.opt_b).toBe(0.7)
  })
})

/**
 * ROADMAP 2.282 — the goal figure on the two payloads that discriminate.
 *
 * The possessive gate and its `goalFitIsSubstitutedJoint` flag were deleted in #2747 re-scope 2 (the flag was always
 * false once the UI-SEM-088 gate withheld the joint figure, and no surface read it). What remains pinned is the figure:
 * ON-substituted and OFF-constrained differ only in `constraint_analysis`. Both arms run with `mockTrust.suspect =
 * false`, because while the honesty gate is ON the selector never substitutes and every assertion here would pass by
 * testing nothing (trap 13) — the first test pins exactly that.
 */
describe('useResultsSectionData — the goal figure on substituted and constrained payloads (ROADMAP 2.282)', () => {
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

  it('control: with the UI-SEM-088 gate ON no joint figure is substituted (so the arms below are not vacuous)', () => {
    mockTrust.suspect = true
    setStoreWithMappedReport(makeV2Response(
      { probability_of_joint_goal: 0.0054 },
      { probability_of_joint_goal: 0.0018 },
    ))
    // …because nothing was substituted.
    expect(adaptedGoalProbabilities().opt_a).toBeNull()
  })

  it('L62 — WITHHELD: joint present, goal_probability absent, no constraint_analysis → no number', () => {
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
    // So nothing is substituted and the figure is withheld.
    // The number the user was shown is gone.
    expect(adaptedGoalProbabilities().opt_a).toBeNull()
  })

  // 29 Sep 2026 (AIQ 5882498938): constraints no longer license the joint figure — the discriminator is now `probability_of_goal`.
  it('CONSTRAINED: goal figure present → the goal number (never the joint); goal absent → withheld, constraints or not', () => {
    const constraintAnalysis = {
      constraints: [{ constraint_id: 'c1', node_id: 'n1', direction: 'max', threshold: 1 }],
      joint_probability: 0.2,
    }
    setStoreWithMappedReport(makeV2Response(
      { probability_of_goal: 0.4, probability_of_joint_goal: 0.2, constraint_analysis: constraintAnalysis },
      { probability_of_joint_goal: 0.2, constraint_analysis: constraintAnalysis },
    ))
    // One field apart (`probability_of_goal`), opposite outcomes.
    // opt_a: the goal figure fills the slot; the joint figure is not its number.
    expect(adaptedGoalProbabilities().opt_a).toBe(0.4)
    expect(adaptedGoalProbabilities().opt_a).not.toBe(0.2)
    // opt_b: the identical joint number AND its own constraints, but no goal figure → withheld.
    expect(adaptedGoalProbabilities().opt_b).toBeNull()
  })

  // #2747 re-scope 2: row deleted — "REAL goal probability → flag FALSE" (its only subject, the substituted flag, is deleted).
})
