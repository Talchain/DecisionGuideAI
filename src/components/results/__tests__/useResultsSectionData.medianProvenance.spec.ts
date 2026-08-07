/**
 * ROADMAP 2.800a — THE HOOK LAYER'S MEDIAN SUBSTITUTION.
 *
 * `useResultsSectionData` built each option's percentile family as
 *
 *     rawP50 = optionOutcome.p50 ?? optionBands.p50 ?? rawExpected
 *
 * where `rawExpected` is the MEAN. So a producer that sent no median got one
 * invented from a different statistic, one hop BEFORE either render site — and
 * the two render sites then did the same substitution again on top of it.
 * Removing it at the render sites alone would have left this one live for every
 * other consumer of `OptionResult.outcome.p50`.
 *
 * ⚠ WHY THIS FILE EXISTS AT ALL — it is the answer to a SURVIVING MUTANT, not a
 * belt-and-braces extra. The first mutant kit for this row reverted this exact
 * expression and the whole suite stayed GREEN (104/104): every other spec feeds
 * `OptionResult` objects straight to the components, so nothing executed the
 * hook's own percentile assembly. A survivor is a claim either way and has to be
 * settled by a discriminating fixture rather than asserted equivalent (trap 13c);
 * this is that fixture.
 *
 * DRIVEN THROUGH THE LIVE MAPPER. The report is built by the real
 * `mapV5AnalysisToReport` from a V5 `analysis_result` block, so the input shape
 * is the producer's rather than this lane's model of it — and `run.bands` is
 * left genuinely empty (its members derive from `confidence_interval`, which the
 * V2 producer no longer emits and this block does not carry), so the
 * `optionBands.p50` step cannot mask the behaviour under test.
 *
 * ORACLE — `OptionOutcome`'s own declaration, not this lane's reading:
 *   "mean (expected) and p50 (median) are semantically different for skewed
 *    distributions."
 * The fixture makes them far apart and on opposite sides of the range, so a
 * substitution cannot coincidentally satisfy the assertion.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'

const OPTION_NODES = [
  { id: 'opt_no_median', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'No median' } },
  { id: 'opt_with_median', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'With median' } },
]

/**
 * A V5 analysis block whose first option carries a MEAN and a full p10/p90 range
 * but NO p50, and whose second option carries a real median as the in-tree
 * positive control.
 *
 * ⚠ THIS SHAPE IS CONSTRUCTED TO ISOLATE THE EXPRESSION UNDER TEST, AND IS NOT
 * CLAIMED TO BE ONE ISL EMITS. ISL populates p10/p50/p90 as a FAMILY — either
 * all three from the sample set (`percentiles_source: 'samples'`) or none
 * (`'unavailable'`) — so "p10 and p90 but no p50" is not in the producer's
 * output domain, and saying otherwise would be exactly the fixture-outside-the-
 * producer's-domain error this estate keeps paying for.
 *
 * What IS reachable, and what this pin is actually about: `p50` absent at all.
 * The removed `?? rawExpected` fired on that alone, and `OptionResult.outcome
 * .p50` has consumers far beyond the range bar's dot — `getExpectedValue` (whose
 * value `goalAnchorCopy` labels "Most likely outcome"), `selectLensOption`,
 * `useResultCompleteness`, and the p50 sort in this very hook. The mean did not
 * merely misplace a glyph; it travelled into copy, selection and ordering. The
 * p10/p90 here just keep the fixture a realistic comparison row.
 */
const BLOCK = {
  type: 'analysis_result',
  summary: 'Comparison',
  leading_option_id: 'opt_no_median',
  win_probabilities: { opt_no_median: 0.6, opt_with_median: 0.4 },
  enrichment: {
    option_comparison: [
      {
        option_id: 'opt_no_median',
        option_label: 'No median',
        win_probability: 0.6,
        // mean sits at the TOP of the range: if it were substituted into the
        // median's slot the difference is unmissable, and no ordering rule could
        // launder it into looking like a median.
        outcome: { mean: 90, p10: 10, p90: 100 },
      },
      {
        option_id: 'opt_with_median',
        option_label: 'With median',
        win_probability: 0.4,
        outcome: { mean: 70, p10: 20, p50: 50, p90: 80 },
      },
    ],
  },
} as unknown as AnalysisResultBlock

function seedStore(): void {
  const report = mapV5AnalysisToReport(BLOCK)
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report },
    runMeta: {},
    nodes: OPTION_NODES,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as never)
}

/** `option id → outcome`, read from a real hook render. Bound by identity. */
function outcomesById(): Record<string, { mean: number | null; p10: number | null; p50: number | null; p90: number | null }> {
  const { result } = renderHook(() => useResultsSectionData())
  const out: Record<string, { mean: number | null; p10: number | null; p50: number | null; p90: number | null }> = {}
  for (const o of result.current.recommendation?.allOptions ?? []) {
    out[o.id] = o.outcome as never
  }
  return out
}

beforeEach(() => {
  seedStore()
})

describe('useResultsSectionData — a missing median is never filled with the mean (2.800a)', () => {
  it('leaves p50 null for the option whose producer sent no median', () => {
    const byId = outcomesById()

    // Precondition PINNED in-test: if the fixture ever stops reproducing the
    // state under test, this reds here rather than degrading into a test of
    // nothing (trap 13b — a guard whose discrimination depends on a fixture
    // that nothing pins).
    expect(byId.opt_no_median, 'the fixture must produce this option').toBeDefined()
    expect(byId.opt_no_median.mean, 'the fixture must carry a MEAN to substitute').toBe(90)

    // Under `?? rawExpected` this read 90 — the mean, sitting where the median
    // belongs, at the top of its own range.
    expect(byId.opt_no_median.p50).toBeNull()
    // ...and the range it belongs to is untouched.
    expect(byId.opt_no_median.p10).toBe(10)
    expect(byId.opt_no_median.p90).toBe(100)
  })

  it('POSITIVE CONTROL — the sibling that DID get a median keeps it', () => {
    // Same hook render, same store: proves the assertion above is a fact about
    // that option and not about a harness that returns null for everything.
    const byId = outcomesById()

    expect(byId.opt_with_median.p50).toBe(50)
    expect(byId.opt_with_median.mean).toBe(70)
  })

  it('the bands fallback is genuinely empty, so it cannot be masking the result', () => {
    // `optionBands.p50` sits between the producer's p50 and the removed mean
    // fallback. If it were populated it would satisfy the pin above for the
    // wrong reason — the same self-agreeing-guard failure this row is about.
    const report = mapV5AnalysisToReport(BLOCK) as { run?: { bands?: { p50?: number | null } } }
    expect(report.run?.bands?.p50 ?? null).toBeNull()
  })
})
