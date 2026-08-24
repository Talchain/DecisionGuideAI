/**
 * Constraint satisfaction honesty — the `satisfied` fabrication.
 *
 * At 4984ea4 `buildConstraintsStatus` emitted:
 *
 *   satisfied: c.prob_satisfied >= 0.5,
 *   ...(c.prob_satisfied != null ? { probability: c.prob_satisfied } : {}),
 *
 * Two defects in adjacent lines:
 *
 *  (1) UNKNOWN RENDERED AS A DEFINITE BREACH. `null >= 0.5` and
 *      `undefined >= 0.5` are both `false`, so a constraint the science never
 *      evaluated was reported to the model as NOT SATISFIED. The second line
 *      guards `probability` against null; the first is unguarded — so the
 *      unevaluated case shipped as a BARER, more absolute breach claim than a
 *      real one (`{satisfied:false}` with no probability at all, versus
 *      `{satisfied:false, probability:0.02}` for a genuine miss). The guard did
 *      not mitigate the fabrication, it concealed it.
 *
 *  (2) A PROBABILITY COLLAPSED TO A BINARY AT A THRESHOLD THIS ESTATE DOES NOT
 *      USE ANYWHERE ELSE. 0.49 and 0.51 are near-identical coin flips that
 *      received opposite confident verdicts. Meanwhile `src/types/constraints.ts`
 *      already bands this exact field (`prob_satisfied`) at 0.40/0.70 —
 *      CONSTRAINT_CONFIDENCE_THRESHOLDS, UI-SEM-010 — and the results panel
 *      renders the middle band as "uncertain". So the model was told
 *      `satisfied: false` for a constraint the user's own screen showed as
 *      uncertain-blue. Producer and screen disagreed inside one product.
 *
 * This payload is not display-only: it is `compact_summary` inside
 * `analysis_state` on every CEE turn request (useConversation.ts:3371), so it
 * reaches the model as context and can produce coaching about a breach that
 * was never computed.
 *
 * Fix: reuse the existing banding rather than mint a fourth threshold, and let
 * "not evaluated" be its own state instead of collapsing into `false`.
 */

import { describe, it, expect } from 'vitest'
import { assembleAnalysisInputsSummary } from '../assembleAnalysisInputsSummary'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'
import type { ConstraintItem } from '../../../types/constraints'

/**
 * A complete ConstraintItem. `prob` is deliberately widened: the V2 wire admits
 * null/absent `prob_satisfied` (which is precisely why the shipped code guarded
 * `probability` against it) even though the local interface declares `number`.
 */
function constraint(node_id: string, label: string, prob: number): ConstraintItem {
  return {
    node_id,
    operator: '>=',
    threshold: 100,
    label,
    prob_satisfied: prob,
    failure_margin_median: 0,
    near_miss_fraction: 0,
    binding: false,
  }
}

/** A constraint whose `prob_satisfied` KEY IS ABSENT, as an uncomputed wire row is. */
function constraintWithNoProbKey(node_id: string, label: string): ConstraintItem {
  const c = constraint(node_id, label, 0)
  delete (c as Partial<ConstraintItem>).prob_satisfied
  return c
}

function reportWith(constraints: ConstraintItem[]): V2RunResponse {
  return {
    option_comparison_status: 'computed',
    robustness_status: 'not_computed',
    option_comparison: [
      {
        option_id: 'opt-a',
        option_label: 'Option A',
        win_probability: 0.7,
        constraint_analysis: { constraints, joint_probability: 0.5 },
      },
    ],
  } as unknown as V2RunResponse
}

/** Bind by IDENTITY — exact label — never by a value predicate another row could satisfy. */
function byLabel(result: ReturnType<typeof assembleAnalysisInputsSummary>, label: string) {
  const row = result?.constraints_status.find(c => c.label === label)
  if (!row) throw new Error(`no constraint row with label "${label}"`)
  return row as Record<string, unknown>
}

describe('buildConstraintsStatus — unknown must stay unknown', () => {
  it('a constraint with prob_satisfied null is NOT reported as a breach', () => {
    const row = byLabel(
      assembleAnalysisInputsSummary(
        reportWith([constraint('c-null', 'Never evaluated null', null as unknown as number)]),
      ),
      'Never evaluated null',
    )
    expect(row.satisfied).toBeUndefined()
    expect(row.status).toBe('unevaluated')
  })

  it('a constraint whose prob_satisfied key is absent is NOT reported as a breach', () => {
    const row = byLabel(
      assembleAnalysisInputsSummary(reportWith([constraintWithNoProbKey('c-abs', 'Never evaluated absent')])),
      'Never evaluated absent',
    )
    expect(row.satisfied).toBeUndefined()
    expect(row.status).toBe('unevaluated')
  })

  it('a non-finite prob_satisfied is NOT reported as a breach and emits no NaN probability', () => {
    const row = byLabel(
      assembleAnalysisInputsSummary(reportWith([constraint('c-nan', 'Not a number', Number.NaN)])),
      'Not a number',
    )
    expect(row.satisfied).toBeUndefined()
    expect(row.status).toBe('unevaluated')
    expect(row).not.toHaveProperty('probability')
  })

  it('an unevaluated constraint is distinguishable from a genuine breach in the emitted payload', () => {
    const result = assembleAnalysisInputsSummary(
      reportWith([
        constraint('c-null', 'Unevaluated', null as unknown as number),
        constraint('c-miss', 'Genuine breach', 0.02),
      ]),
    )
    const unevaluated = byLabel(result, 'Unevaluated')
    const breach = byLabel(result, 'Genuine breach')
    // At 4984ea4 BOTH serialised to satisfied:false — indistinguishable to the model.
    expect(unevaluated.status).not.toBe(breach.status)
  })
})

describe('buildConstraintsStatus — near-threshold must not read as a confident verdict', () => {
  it('0.49 and 0.51 both read uncertain rather than opposite confident verdicts', () => {
    const result = assembleAnalysisInputsSummary(
      reportWith([
        constraint('c-lo', 'Coin flip low', 0.49),
        constraint('c-hi', 'Coin flip high', 0.51),
      ]),
    )
    const lo = byLabel(result, 'Coin flip low')
    const hi = byLabel(result, 'Coin flip high')
    expect(lo.status).toBe('uncertain')
    expect(hi.status).toBe('uncertain')
    expect(lo.satisfied).toBeUndefined()
    expect(hi.satisfied).toBeUndefined()
    // The pair must not receive opposite verdicts across a 0.02 gap.
    expect(lo.status).toBe(hi.status)
  })

  it('0.65 reads uncertain, matching the band the results panel already shows the user', () => {
    // The shipped contract fixture carries exactly this case asserted as
    // satisfied:true, while SuccessTargetRow renders 0.65 as uncertain-blue.
    const row = byLabel(
      assembleAnalysisInputsSummary(reportWith([constraint('c-65', 'Time to productivity', 0.65)])),
      'Time to productivity',
    )
    expect(row.status).toBe('uncertain')
  })
})

describe('OPPOSITE-DIRECTION TWINS — the fix must not soften a real breach or a real pass', () => {
  it('a genuinely satisfied constraint still reads met', () => {
    const row = byLabel(
      assembleAnalysisInputsSummary(reportWith([constraint('c-ok', 'Comfortably met', 0.95)])),
      'Comfortably met',
    )
    expect(row.status).toBe('likely_met')
    expect(row.probability).toBe(0.95)
  })

  it('a genuinely breaching constraint still reads missed', () => {
    const row = byLabel(
      assembleAnalysisInputsSummary(reportWith([constraint('c-bad', 'Clearly breached', 0.02)])),
      'Clearly breached',
    )
    expect(row.status).toBe('likely_missed')
    expect(row.probability).toBe(0.02)
  })

  it('an exact 0 probability is a measured breach, NOT an absence', () => {
    const row = byLabel(
      assembleAnalysisInputsSummary(reportWith([constraint('c-zero', 'Zero probability', 0)])),
      'Zero probability',
    )
    expect(row.status).toBe('likely_missed')
    expect(row.probability).toBe(0)
  })

  it('band boundaries are the estate thresholds (0.70 met, 0.40 uncertain), not a minted 0.5', () => {
    const result = assembleAnalysisInputsSummary(
      reportWith([
        constraint('c-70', 'Exactly seventy', 0.70),
        constraint('c-40', 'Exactly forty', 0.40),
        constraint('c-39', 'Just under forty', 0.39),
      ]),
    )
    expect(byLabel(result, 'Exactly seventy').status).toBe('likely_met')
    expect(byLabel(result, 'Exactly forty').status).toBe('uncertain')
    expect(byLabel(result, 'Just under forty').status).toBe('likely_missed')
  })

  it('a mixed set keeps every row bound to its own identity', () => {
    const result = assembleAnalysisInputsSummary(
      reportWith([
        constraint('c-a', 'Alpha met', 0.9),
        constraint('c-b', 'Bravo unevaluated', null as unknown as number),
        constraint('c-c', 'Charlie missed', 0.1),
        constraint('c-d', 'Delta uncertain', 0.5),
      ]),
    )
    expect(byLabel(result, 'Alpha met').status).toBe('likely_met')
    expect(byLabel(result, 'Bravo unevaluated').status).toBe('unevaluated')
    expect(byLabel(result, 'Charlie missed').status).toBe('likely_missed')
    expect(byLabel(result, 'Delta uncertain').status).toBe('uncertain')
  })
})
