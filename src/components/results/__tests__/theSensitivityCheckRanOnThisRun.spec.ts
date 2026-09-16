/**
 * The completeness banner said "the sensitivity check" was not included, one
 * line above a populated sensitivity section, on a run carrying six measured
 * factors.
 *
 * ## The defect, at the bytes
 *
 * `mapV5AnalysisToReport:910` projects the producer's `factor_sensitivity`
 * rows into `ReportV1.drivers`, and **renames the magnitude on the way past**:
 *
 * ```ts
 * const drivers = factors.slice(0, 5).map((f) => ({
 *   label: f.factor_label, polarity: …, strength: …,
 *   contribution: f.sensitivity,   // ← the magnitude, under a THIRD name
 *   nodeId: f.factor_id,
 * }))
 * ```
 *
 * `deriveResultCompleteness`'s Field 4 asked whether any driver carries
 * `sensitivity_score`, `elasticity` or `importance_score` — three names the V5
 * mapper never writes. `ReportV1.drivers` does not even DECLARE them
 * (`adapters/plot/types.ts:65-75`), so the predicate is unsatisfiable on this
 * path by construction, and the banner reported an absence on every V5 run that
 * had sensitivity data.
 *
 * Ground truth, Paul's run `1dd2133d` (16 Sep): six `factor_sensitivity` rows,
 * each carrying `sensitivity_score` AND `elasticity`, and **no `drivers` array
 * anywhere on the wire** — `drivers`, `drivers_payload` and `drivers_status`
 * occur zero times in the whole debug export. So every driver the panel had was
 * built by that projection, and none of them could satisfy the check.
 *
 * ## Two questions under one name (CLAUDE.md trap 21)
 *
 * The banner asks *"was the sensitivity check included in this run?"*. The
 * predicate asked *"do the DRIVERS carry sensitivity fields?"*. Those differ the
 * moment anything projects between them — which is exactly what happened.
 *
 * The fix asks the question of the authority that answers it. The mapper has ONE
 * owner of "did this run carry sensitivity magnitudes": `normaliseFactorEntry`,
 * which DROPS any entry with no usable magnitude (`:274-276`) and writes the
 * survivors to `report.factor_sensitivity`. So a non-empty `factor_sensitivity`
 * IS the producer's statement, by construction — no alias list to keep in sync,
 * which is the mirror that produced this defect (trap 12).
 *
 * ## Why the corpus is the real wire, and the mapper is not respelled
 *
 * These rows are lifted verbatim from the debug export, and the report is built
 * by calling `mapV5AnalysisToReport` itself. A hand-written `ReportV1` fixture
 * would encode MY model of the projection rather than the projection — and the
 * defect under test IS the projection. A fixture you wrote yourself is not
 * evidence about the wire.
 */

import { describe, it, expect } from 'vitest'

import { deriveResultCompleteness } from '../useResultCompleteness'
import type { ResultCompletenessInputs } from '../useResultCompleteness'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { ReportV1 } from '../../../adapters/plot/types'

/**
 * Three of the six rows from run `1dd2133d`, verbatim in the fields that
 * matter. Real values, real names, real producer.
 */
const REAL_FACTOR_SENSITIVITY = [
  {
    factor_id: '17456e58',
    factor_label: 'Team Leadership Coverage',
    influence_score: 0.8,
    influence_rank: 2,
    sensitivity_score: 0.5,
    elasticity: 0.8,
    direction: 'positive',
    importance_rank: 1,
    value_of_information: 0,
    confidence: 0.608,
  },
  {
    factor_id: '26f82e8c',
    factor_label: 'Delivery Capacity',
    influence_score: 0.4,
    influence_rank: 4,
    sensitivity_score: 0.25,
    elasticity: 0.4,
    direction: 'positive',
    importance_rank: 2,
    value_of_information: 0,
    confidence: 0.608,
  },
  {
    factor_id: 'f91ee77c',
    factor_label: 'Hiring Speed in Current Market',
    influence_score: 0.4,
    influence_rank: 5,
    sensitivity_score: 0.25,
    elasticity: 0.4,
    direction: 'positive',
    importance_rank: 3,
    value_of_information: 0,
    confidence: 0.5,
  },
] as const

function reportFromEnrichment(enrichment: Record<string, unknown>): ReportV1 {
  return mapV5AnalysisToReport({
    type: 'analysis_result',
    summary: 'a summary',
    enrichment,
  } as never)
}

function completenessOf(report: ReportV1) {
  return deriveResultCompleteness({
    resultsStatus: 'complete',
    report,
    ceeReviewV1: null,
    decisionReview030: null,
    drivers: null,
  } as unknown as ResultCompletenessInputs)
}

describe('deriveResultCompleteness — the sensitivity check ran on this run', () => {
  // ── RED at pristine ───────────────────────────────────────────────────────

  it('does not report sensitivity missing when the producer supplied measured factors', () => {
    const report = reportFromEnrichment({
      factor_sensitivity: REAL_FACTOR_SENSITIVITY as unknown as unknown[],
    })
    const c = completenessOf(report)
    expect(c.missing).not.toContain('sensitivity')
    expect(c.reasons).not.toContain('sensitivity_missing')
  })

  it('pins its own precondition: the mapper DID project those factors into drivers, and renamed the magnitude', () => {
    // Without this, the assertion above could pass because the mapper produced
    // nothing at all — a guard agreeing with itself (trap 13b). The rename is
    // the defect's mechanism, so it is asserted, not assumed.
    const report = reportFromEnrichment({
      factor_sensitivity: REAL_FACTOR_SENSITIVITY as unknown as unknown[],
    })
    expect(report.drivers).toHaveLength(3)
    const first = report.drivers[0] as Record<string, unknown>
    expect(typeof first.contribution).toBe('number')
    expect(first.sensitivity_score).toBeUndefined()
    expect(first.elasticity).toBeUndefined()
    expect(first.importance_score).toBeUndefined()
  })

  it('binds by identity: the surviving rows are the producer’s factors, not any three objects', () => {
    const report = reportFromEnrichment({
      factor_sensitivity: REAL_FACTOR_SENSITIVITY as unknown as unknown[],
    })
    const widened = report as ReportV1 & { factor_sensitivity?: Array<{ factor_id: string }> }
    expect(widened.factor_sensitivity?.map((f) => f.factor_id)).toEqual([
      '17456e58',
      '26f82e8c',
      'f91ee77c',
    ])
  })

  // ── The absence must stay sayable ────────────────────────────────────────

  it('still reports sensitivity missing when drivers arrived but carry NO magnitude anywhere', () => {
    // The disclosure this hook exists for. A driver list with no sensitivity
    // value behind it is the case the original predicate was written for, and
    // the fix must not swallow it.
    const report = {
      schema: 'report.v1',
      meta: { seed: 1, response_id: 'r', elapsed_ms: 1 },
      model_card: { response_hash: 'h', response_hash_algo: 'sha256', normalized: true },
      results: { conservative: 0.3, likely: 0.5, optimistic: 0.7 },
      confidence: { level: 'high', why: 'y' },
      drivers: [{ label: 'A factor', polarity: 'neutral', strength: 'low' }],
    } as unknown as ReportV1
    const c = completenessOf(report)
    expect(c.missing).toContain('sensitivity')
    expect(c.reasons).toContain('sensitivity_missing')
  })

  it('accepts the magnitude under the name the projection gives it, when that is the only carrier', () => {
    // The V4-mapper path: a `drivers` list with `contribution` and no
    // `factor_sensitivity` beside it. `contribution` is named as a sensitivity
    // magnitude by the estate's own fallback chain
    // (`test/fixtures/golden-expectations.ts:230`), so a run carrying only that
    // has had its sensitivity computed and must not be reported as missing.
    const report = {
      schema: 'report.v1',
      meta: { seed: 1, response_id: 'r', elapsed_ms: 1 },
      model_card: { response_hash: 'h', response_hash_algo: 'sha256', normalized: true },
      results: { conservative: 0.3, likely: 0.5, optimistic: 0.7 },
      confidence: { level: 'high', why: 'y' },
      drivers: [
        { label: 'Team Leadership Coverage', polarity: 'up', strength: 'high', contribution: 0.5 },
      ],
    } as unknown as ReportV1
    const c = completenessOf(report)
    expect(c.missing).not.toContain('sensitivity')
  })

  it('reads the producer’s rows when the V2 projection strips the magnitude from every driver', () => {
    // ⭐ THE SHAPE THAT NEEDS THE PRODUCER-SIDE READ, AND IT IS THE REAL MAPPER
    // THAT PRODUCES IT — not a fixture written to suit the fix.
    //
    // `responseMapper.mapDriversFromResponse:988-1002` takes the LEGACY branch
    // whenever `v2Response.drivers` is non-empty, and that branch emits exactly
    // `{label, polarity, strength}`. No `contribution`, no `nodeId`, none of the
    // three sensitivity names. So on this shape EVERY driver-side name fails,
    // under every alias, while `factor_sensitivity` sits beside it fully
    // populated. Without the producer-side read the banner claims the
    // sensitivity check did not run.
    const report = mapV2ResponseToReportV1(
      {
        drivers: [{ label: 'Team Leadership Coverage', direction: 'positive', contribution: 0.5 }],
        factor_sensitivity: REAL_FACTOR_SENSITIVITY as unknown as unknown[],
        option_comparison: [],
        critiques: [],
      } as never,
      { seed: null },
    )

    // Pin the precondition in-test: the projection really did strip it, so a
    // pass below is the code's doing and not the fixture's failure (trap 13b).
    expect(report.drivers.length).toBeGreaterThan(0)
    for (const d of report.drivers as ReadonlyArray<Record<string, unknown>>) {
      expect(d.contribution).toBeUndefined()
      expect(d.sensitivity_score).toBeUndefined()
      expect(d.elasticity).toBeUndefined()
      expect(d.importance_score).toBeUndefined()
      expect(d.sensitivity).toBeUndefined()
    }
    const widened = report as ReportV1 & { factor_sensitivity?: unknown[] }
    expect(widened.factor_sensitivity?.length).toBeGreaterThan(0)

    const c = completenessOf(report)
    expect(c.missing).not.toContain('sensitivity')
    expect(c.reasons).not.toContain('sensitivity_missing')
  })

  // ── THE CONTRAST THE INDEPENDENT REVIEW EXECUTED (CX182) ─────────────────
  //
  // My first cut asked only whether `factor_sensitivity` was NON-EMPTY, on the
  // strength of `normaliseFactorEntry` dropping magnitude-less rows. That
  // invariant is the V5 MAPPER'S ALONE; the same field also arrives from the V2
  // path and from an untyped passthrough. So an identity-only row suppressed a
  // TRUE missing-sensitivity disclosure — the same false-absence defect this
  // fix removes, with the sign flipped (trap 22b).

  it('still discloses missing sensitivity when the rows carry identity and no magnitude', () => {
    const report = {
      schema: 'report.v1',
      meta: { seed: 1, response_id: 'r', elapsed_ms: 1 },
      model_card: { response_hash: 'h', response_hash_algo: 'sha256', normalized: true },
      results: { conservative: 0.3, likely: 0.5, optimistic: 0.7 },
      confidence: { level: 'high', why: 'y' },
      drivers: [{ label: 'A factor', polarity: 'neutral', strength: 'low' }],
      factor_sensitivity: [
        { factor_id: '17456e58', factor_label: 'Team Leadership Coverage' },
        { factor_id: '26f82e8c', factor_label: 'Delivery Capacity', sensitivity_score: null },
        { factor_id: 'f91ee77c', factor_label: 'Hiring Speed', elasticity: 'high' },
      ],
    } as unknown as ReportV1
    const c = completenessOf(report)
    expect(c.missing).toContain('sensitivity')
    expect(c.reasons).toContain('sensitivity_missing')
  })

  it('retains a genuine measured zero, which is a producer statement and not an absence', () => {
    // The opposite harm, and it must not be traded for the one above.
    // `Number.isFinite(0)` is true; a factor the producer measured at zero
    // sensitivity has been assessed.
    const report = {
      schema: 'report.v1',
      meta: { seed: 1, response_id: 'r', elapsed_ms: 1 },
      model_card: { response_hash: 'h', response_hash_algo: 'sha256', normalized: true },
      results: { conservative: 0.3, likely: 0.5, optimistic: 0.7 },
      confidence: { level: 'high', why: 'y' },
      drivers: [{ label: 'A factor', polarity: 'neutral', strength: 'low' }],
      factor_sensitivity: [{ factor_id: '17456e58', sensitivity_score: 0 }],
    } as unknown as ReportV1
    const c = completenessOf(report)
    expect(c.missing).not.toContain('sensitivity')
  })

  it('leaves the top-drivers disclosure exactly where it was when nothing ranked', () => {
    const report = reportFromEnrichment({})
    const c = completenessOf(report)
    expect(c.missing).toContain('top_drivers')
  })
})
