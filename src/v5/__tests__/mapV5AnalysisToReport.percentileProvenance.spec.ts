/**
 * ROADMAP 2.800 (a) — A PERCENTILE MUST NOT BE FILLED FROM A CONFIDENCE INTERVAL.
 *
 * `p10 = outcome?.p10 ?? ciLow` / `p90 = outcome?.p90 ?? ciHigh` put a
 * confidence-interval bound into a percentile's slot and rendered it under the
 * percentile's name, with no disclosure to the reader. A CI and a p10/p90 pair
 * are different quantities answering different questions: the interval is a
 * statement about an ESTIMATE's precision, the percentile pair a statement
 * about the OUTCOME's spread. Substituting one for the other misstates exactly
 * the thing this surface exists to communicate.
 *
 * ⚠ THE REPO ALREADY KNEW, AND ROUTED AROUND IT. `mapV5AnalysisToReport.ts`
 * keeps `percentiles_source` a SIBLING of `outcome` rather than a member,
 * reasoning that "a provenance flag sitting INSIDE that object would read as
 * certifying whichever numbers ended up in it". That is the correct diagnosis
 * with the wrong remedy: the honesty badge was moved away from the substitution
 * instead of the substitution being removed. This suite removes it.
 *
 * PRODUCER SEMANTICS, derived at the bytes rather than assumed (trap 13c — a
 * mutant kit proves sensitivity, never correctness, so the expectation has to
 * come from the producer):
 *   · PLoT `src/routes/v2/run.ts` builds each `option_comparison` entry by
 *     explicit field selection and carries NO `confidence_interval`; its own
 *     note at the builder reads "expected_outcome and confidence_interval (V1
 *     legacy) removed from V2 response. Use outcome.mean and [outcome.p10,
 *     outcome.p90] instead."
 *   · CEE carries no `option_comparison[].confidence_interval` either (its only
 *     occurrences of the name are counterfactual `{lower, upper}` objects in
 *     tests — a different field of a different shape).
 *   · Across every captured payload in `PHASE0-EVIDENCE-2026-07-28/`, the string
 *     `confidence_interval` appears in ZERO wire captures.
 * So this substitution is DEAD ON THE LIVE WIRE and ARMED: the contract still
 * permits the field (`EnrichmentOutcomeStatsSchema.confidence_interval` is an
 * optional tuple in `@talchain/schemas` 0.38.0), so a producer that re-adds it
 * would silently start shipping mislabelled percentiles. These tests are what
 * keeps it disarmed.
 */

import { describe, expect, it } from 'vitest'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'

const baseBlock = (overrides: Partial<AnalysisResultBlock> = {}): AnalysisResultBlock =>
  ({
    type: 'analysis_result',
    summary: 'Option A leads',
    leading_option_id: 'opt_a',
    ...overrides,
  }) as AnalysisResultBlock

type MappedOption = {
  expected?: number
  outcome?: { mean?: number | null; p10?: number | null; p50?: number | null; p90?: number | null }
}

function mapOption(entry: Record<string, unknown>, optionId = 'opt_a'): MappedOption {
  const block = baseBlock({
    win_probabilities: { [optionId]: 0.5 },
    enrichment: { option_comparison: [{ option_id: optionId, ...entry }] },
  } as Partial<AnalysisResultBlock>)

  const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
    option_probabilities?: Record<string, MappedOption>
  }
  const mapped = report.option_probabilities?.[optionId]
  if (mapped === undefined) throw new Error(`mapper produced no entry for option "${optionId}"`)
  return mapped
}

describe('mapV5AnalysisToReport — percentiles are the producer\'s or they are absent', () => {
  it('a confidence_interval does NOT fill an absent p10/p90', () => {
    const mapped = mapOption({ confidence_interval: [10, 20] })

    // Absent stays absent. Under the substitution these read 10 and 20 — a CI
    // bound wearing a percentile's name, with nothing on screen to say so.
    expect(mapped.outcome?.p10).toBeNull()
    expect(mapped.outcome?.p90).toBeNull()
  })

  it('POSITIVE CONTROL — real producer percentiles still flow through untouched', () => {
    // Without this, the pin above could pass on a mapper that dropped p10/p90
    // unconditionally: an absence assertion is vacuous until it has been shown
    // it can see a presence.
    const mapped = mapOption({
      outcome: { mean: 12.5, p10: 8, p50: 12, p90: 17 },
    })

    expect(mapped.outcome).toEqual({ mean: 12.5, p10: 8, p50: 12, p90: 17 })
  })

  it('a confidence_interval never OVERRIDES percentiles the producer did send', () => {
    // Discriminating pair partner: proves the fix removed the fallback rather
    // than inverting the precedence.
    const mapped = mapOption({
      outcome: { mean: 12.5, p10: 8, p50: 12, p90: 17 },
      confidence_interval: [10, 20],
    })

    expect(mapped.outcome?.p10).toBe(8)
    expect(mapped.outcome?.p90).toBe(17)
  })

  it('a partial outcome keeps the member the producer sent and nulls the one it did not', () => {
    // ISL's reachable degenerate shape 2 — `percentiles_source: 'unavailable'`
    // with `mean` present — must not be topped up from a CI.
    const mapped = mapOption({
      outcome: { mean: 12.5 },
      confidence_interval: [10, 20],
    })

    expect(mapped.outcome).toEqual({ mean: 12.5, p10: null, p50: null, p90: null })
  })
})
