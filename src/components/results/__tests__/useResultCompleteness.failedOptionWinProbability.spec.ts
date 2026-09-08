/**
 * A FAILED option's fabricated `win_probability: 0` must not satisfy the
 * "at least one option carries a win probability" test — because satisfying it
 * SUPPRESSES the honest `win_probability_missing` disclosure.
 *
 * ## The defect
 *
 * `deriveResultCompleteness`'s Field-2 check asked only
 * `typeof optionProbs[id]?.win_probability === 'number'`. ISL emits
 * `status: 'failed'` exactly when `n_valid === 0` — ZERO finite Monte Carlo
 * samples, so there is no distribution and no share — and PLoT forwards a
 * `win_probability: 0` beside it. **Zero is a number.** So on a run where the
 * only "win probability" present is that fabrication, `anyWin` was true and the
 * hook reported the field PRESENT, silencing the one surface whose entire job
 * is to say the field is missing.
 *
 * This is the same non-measurement that `deriveDecisionVerdict` admits into its
 * comparable set, with the OPPOSITE harm: there a fabricated 0 INVENTS a leader
 * claim, here it SILENCES a true disclosure. Same field, same producer token,
 * two directions.
 *
 * ## Why the gate is the producer's TOKEN, never falsiness
 *
 * A `win > 0` test would be a second, worse classification: it would admit a
 * failed option carrying any non-zero fabricated value, and would wrongly drop
 * a GENUINE measured zero — an option ISL computed at n=10,000 and found never
 * wins. Those two are indistinguishable by value and distinguishable only by
 * `status`. `optionComputationProducedResult` is quoted rather than respelled,
 * so the hook cannot classify an option differently from the service that
 * produced it (CLAUDE.md trap 21).
 *
 * `'partial'` stays IN (samples exist — ISL emits a full outcome block; it is a
 * disclosure, not a failure). ABSENT status stays IN (the legacy V1 shape).
 * Only `'failed'` is excluded.
 *
 * ## Binding
 *
 * Every assertion binds to its option BY ID. A spec that found an option by
 * `win_probability === 0` could pass on the wrong object — the genuine measured
 * zero and the fabricated one carry the identical value, which is the whole
 * point of this spec.
 */

import { describe, it, expect } from 'vitest'

import { deriveResultCompleteness } from '../useResultCompleteness'
import type { ResultCompletenessInputs } from '../useResultCompleteness'
import type { ReportV1 } from '../../../adapters/plot/types'

/**
 * An option-probabilities entry as the MAPPERS ACTUALLY WRITE IT.
 *
 * `ReportV1['option_probabilities']` is typed with `OptionProbability`, which
 * carries no `status` — but both writers emit one
 * (`mapV5AnalysisToReport.ts:1167` on the V5 canonical path,
 * `responseMapper.ts:722` on the V2/hydrate path), and the READER type
 * (`results/types.ts`'s `ResultsOptionProbability`) declares it. The cast
 * mirrors the widening the hook itself performs, so these fixtures are the real
 * runtime shape rather than a convenient invention.
 */
type ProbEntry = {
  goal_probability: number
  confidence: number
  win_probability?: number
  status?: 'computed' | 'partial' | 'failed'
}

function reportWith(probs: Record<string, ProbEntry>): ReportV1 {
  return {
    schema: 'report.v1',
    meta: { seed: 42, response_id: 'r1', elapsed_ms: 100 },
    model_card: {
      response_hash: 'hash',
      response_hash_algo: 'sha256',
      normalized: true,
    },
    results: { conservative: 0.3, likely: 0.5, optimistic: 0.7 },
    confidence: { level: 'high', why: 'strong evidence' },
    option_probabilities: probs as never,
  } as unknown as ReportV1
}

function completenessFor(probs: Record<string, ProbEntry>) {
  const inputs: ResultCompletenessInputs = {
    resultsStatus: 'complete',
    report: reportWith(probs),
    ceeReviewV1: null,
    decisionReview030: null,
    drivers: null,
  } as unknown as ResultCompletenessInputs
  return deriveResultCompleteness(inputs)
}

/** Did the hook disclose that win probability is missing? */
function disclosedMissingWin(probs: Record<string, ProbEntry>): boolean {
  const c = completenessFor(probs)
  return (
    c.missing.includes('win_probability') &&
    c.reasons.includes('win_probability_missing')
  )
}

describe('deriveResultCompleteness — a failed option cannot satisfy the win-probability check', () => {
  // ── RED at pristine: the fabrication silences the disclosure ──────────────

  it('discloses win_probability missing when the ONLY option carrying one is status:failed', () => {
    // `opt_failed` is the sole bearer of a `win_probability`, and it is a
    // fabrication: ISL scored zero valid samples for it.
    const disclosed = disclosedMissingWin({
      opt_failed: {
        goal_probability: 0,
        confidence: 0,
        win_probability: 0,
        status: 'failed',
      },
    })
    expect(disclosed).toBe(true)
  })

  it('discloses win_probability missing when a failed option sits beside an option with none at all', () => {
    // Neither option contributes a measurement: one has no win probability,
    // the other has only a fabricated one.
    const disclosed = disclosedMissingWin({
      opt_failed: {
        goal_probability: 0,
        confidence: 0,
        win_probability: 0,
        status: 'failed',
      },
      opt_no_win: { goal_probability: 0.4, confidence: 0.5 },
    })
    expect(disclosed).toBe(true)
  })

  it('discloses win_probability missing when EVERY option present is status:failed', () => {
    const disclosed = disclosedMissingWin({
      opt_failed_a: {
        goal_probability: 0,
        confidence: 0,
        win_probability: 0,
        status: 'failed',
      },
      opt_failed_b: {
        goal_probability: 0,
        confidence: 0,
        win_probability: 0,
        status: 'failed',
      },
    })
    expect(disclosed).toBe(true)
  })

  // ── The discriminating twin: same VALUE, different TOKEN ──────────────────
  //
  // These two runs are byte-identical on `win_probability`. Only `status`
  // differs. If the gate were written on falsiness (`win > 0`) instead of the
  // producer's token, BOTH would be treated the same and one of these two
  // assertions would fail. This pair is what proves the gate reads the token.

  it('a GENUINE measured zero (status:computed) counts as a present win probability', () => {
    // ISL computed this option at full sample count and found it never wins.
    // That is a measurement, and the field is NOT missing.
    const disclosed = disclosedMissingWin({
      opt_measured_zero: {
        goal_probability: 0.1,
        confidence: 0.9,
        win_probability: 0,
        status: 'computed',
      },
    })
    expect(disclosed).toBe(false)
  })

  it('the fabricated zero and the measured zero carry the SAME value and get OPPOSITE verdicts', () => {
    // The precondition is pinned in-test: if these two ever stop carrying the
    // identical win_probability, this test would be comparing two different
    // things and its agreement would mean nothing.
    const fabricated: ProbEntry = {
      goal_probability: 0,
      confidence: 0,
      win_probability: 0,
      status: 'failed',
    }
    const measured: ProbEntry = {
      goal_probability: 0.1,
      confidence: 0.9,
      win_probability: 0,
      status: 'computed',
    }
    expect(fabricated.win_probability).toBe(measured.win_probability)

    expect(disclosedMissingWin({ opt_fabricated: fabricated })).toBe(true)
    expect(disclosedMissingWin({ opt_measured: measured })).toBe(false)
  })

  // ── Over-suppression controls: the fix must not buy its RED by saying less ─
  //
  // A `status !== 'computed'` gate would satisfy every assertion above while
  // discarding results ISL honestly produced. These four must pass BEFORE the
  // fix and AFTER it.

  it('two genuinely computed options still report the win probability PRESENT', () => {
    const disclosed = disclosedMissingWin({
      opt_a: {
        goal_probability: 0.6,
        confidence: 0.8,
        win_probability: 0.62,
        status: 'computed',
      },
      opt_b: {
        goal_probability: 0.3,
        confidence: 0.7,
        win_probability: 0.38,
        status: 'computed',
      },
    })
    expect(disclosed).toBe(false)
  })

  it("status:'partial' is a DISCLOSURE, not a failure — its win probability counts", () => {
    // 0 < n_valid/n_total < 0.8. The samples EXIST and ISL emits a full
    // outcome block. Discarding it would suppress a real result.
    const disclosed = disclosedMissingWin({
      opt_partial: {
        goal_probability: 0.5,
        confidence: 0.4,
        win_probability: 0.55,
        status: 'partial',
      },
    })
    expect(disclosed).toBe(false)
  })

  it('an ABSENT status is the legacy V1 shape and stays on the ordinary path', () => {
    // ISL's V1 `OptionResult` has no status field at all. Absent must never be
    // read as failed — that would invent a failure the producer never declared.
    const disclosed = disclosedMissingWin({
      opt_legacy: {
        goal_probability: 0.5,
        confidence: 0.6,
        win_probability: 0.51,
      },
    })
    expect(disclosed).toBe(false)
  })

  it('one computed option beside one failed option still reports the field PRESENT', () => {
    // The computed option is a real measurement. The failed one contributes
    // nothing, but it must not DESTROY its neighbour's contribution either —
    // the fix withholds a fabrication, it does not suppress a measurement.
    const disclosed = disclosedMissingWin({
      opt_computed: {
        goal_probability: 0.7,
        confidence: 0.8,
        win_probability: 0.71,
        status: 'computed',
      },
      opt_failed: {
        goal_probability: 0,
        confidence: 0,
        win_probability: 0,
        status: 'failed',
      },
    })
    expect(disclosed).toBe(false)
  })
})
