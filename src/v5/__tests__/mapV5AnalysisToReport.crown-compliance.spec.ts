/**
 * Step 6 (UI leg) — the CROWN COMPLIANCE verdict reaches `report.robustness`.
 *
 * THE DEFECT. PLoT #338 (staging `e19ac506`) emits two additive members on
 * `robustness`, UNCONDITIONALLY, on every /v2/run:
 *   - `recommended_option_compliance`        (enum, six values)
 *   - `recommended_option_compliance_reason` (producer-owned prose, verbatim)
 * CEE forwards them intact — `robustness` is a member of
 * `P0B_SAFE_TRANSPORT_ENRICHMENT_KEEP` (compose.ts:723) and the projection
 * (compose.ts:1079) is a SHALLOW top-level keep plus a deep DENY-strip of
 * internal carriers only, so additive nested members ride through. They also
 * survive the withheld-crown projection, because
 * `keyDesignatesLeadingOption`'s pattern is anchored with a CLOSED suffix group
 * (`/^recommend(?:ed|ation)_option(?:_(?:id|label|name))?$/i`) that these two
 * names do not match.
 *
 * They then died HERE. `mapV5AnalysisToReport`'s `report.robustness` is an
 * explicit KEEP-LIST (see this function's own header) and neither member was on
 * it — the identical failure this file already records for `display_verdict`:
 * "ON-WIRE on Seam A ... but previously dropped here".
 *
 * PRODUCER PROVENANCE — derived at the PLoT bytes, never invented
 * (plot-lite-service @ staging `e19ac506`):
 *   - `src/routes/v2/run.ts:3608-3609` — the two assignments, unconditional.
 *   - `src/routes/v2/crown-eligibility.ts` — `CrownCompliance` is exactly
 *     `not_applicable | compliant | uncertain | unverified | not_assessed |
 *     no_eligible_option`, and `CROWN_COMPLIANCE_REASONS` is the single source
 *     of the prose the route emits verbatim.
 *   - `src/contracts/isl-to-ui.contract.ts:280-281` — the wire contract, whose
 *     consumer obligation is quoted in `crownCompliance.ts`.
 *
 * SCOPE, STATED HONESTLY:
 *   - The checked-in staging capture `v5-analysis-result.bundle-45c9b625.json`
 *     PREDATES PLoT #338 and carries NEITHER member (asserted below as the
 *     scope pin). Values are therefore SYNTHESISED from the producer's own
 *     enum + reason table above and OVERLAID on the real captured envelope —
 *     the same device the `conditional_winners` spec beside this one uses.
 *   - These are MAPPER tests. They prove the data reaches the report slot.
 *     They are NOT a render witness and NOT a wire witness.
 */
import { describe, expect, it } from 'vitest'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'

import bundleFixture from './fixtures/v5-analysis-result.bundle-45c9b625.json'

type WidenedReport = ReturnType<typeof mapV5AnalysisToReport> & Record<string, unknown>

/** Overlay onto the REAL captured envelope's `robustness`; never rebuild it. */
function blockWithRobustness(overlay: Record<string, unknown>): AnalysisResultBlock {
  const base = bundleFixture.block as unknown as Record<string, unknown>
  const baseEnrichment = base.enrichment as Record<string, unknown>
  const baseRobustness = baseEnrichment.robustness as Record<string, unknown>
  return {
    ...base,
    enrichment: {
      ...baseEnrichment,
      robustness: { ...baseRobustness, ...overlay },
    },
  } as unknown as AnalysisResultBlock
}

function mappedRobustness(overlay: Record<string, unknown>): Record<string, unknown> {
  const report = mapV5AnalysisToReport(blockWithRobustness(overlay)) as WidenedReport
  return (report.robustness ?? {}) as Record<string, unknown>
}

describe('mapV5AnalysisToReport — crown compliance fixture provenance', () => {
  it('POSITIVE CONTROL — the mapper genuinely reads this capture’s robustness slot', () => {
    // `recommended_option_id` is present in the capture and IS on the keep-list.
    // If this ever fails, the absence assertions below prove nothing about the
    // compliance members and only that the mapper ignored the fixture entirely
    // (doctrine trap 13 — an absence probe needs a positive control).
    const robustness = mappedRobustness({})
    expect(robustness.recommended_option_id, 'capture’s crown id reaches the report').toBe(
      'opt_hire',
    )
  })

  it('SCOPE PIN — the capture predates PLoT #338 and carries neither member', () => {
    const enrichment = (bundleFixture.block as unknown as Record<string, unknown>)
      .enrichment as Record<string, unknown>
    const robustness = enrichment.robustness as Record<string, unknown>
    expect('recommended_option_compliance' in robustness).toBe(false)
    expect('recommended_option_compliance_reason' in robustness).toBe(false)
  })
})

describe('mapV5AnalysisToReport — crown compliance reaches report.robustness', () => {
  it('carries the verdict and its producer reason VERBATIM', () => {
    const robustness = mappedRobustness({
      recommended_option_compliance: 'no_eligible_option',
      recommended_option_compliance_reason:
        'no option met the limits you set, so none is being recommended',
    })

    // Bound by EXACT enum value, never by a truthiness predicate another state
    // could satisfy.
    expect(robustness.recommended_option_compliance).toBe('no_eligible_option')
    expect(robustness.recommended_option_compliance_reason).toBe(
      'no option met the limits you set, so none is being recommended',
    )
  })

  it('OPPOSITE-DIRECTION TWIN — a compliant run still arrives as compliant', () => {
    const robustness = mappedRobustness({
      recommended_option_compliance: 'compliant',
      recommended_option_compliance_reason:
        'this option met every limit you set, in all the scenarios we tested',
    })

    expect(robustness.recommended_option_compliance).toBe('compliant')
    expect(robustness.recommended_option_compliance_reason).toBe(
      'this option met every limit you set, in all the scenarios we tested',
    )
  })

  it('carries EVERY producer enum value — no state is silently filtered', () => {
    // The mapper transports; it does not judge. A mapper that passed only the
    // states this lane happened to think interesting would hide a producer fact,
    // and the filtering that DOES happen belongs in the renderer.
    for (const value of [
      'not_applicable',
      'compliant',
      'uncertain',
      'unverified',
      'not_assessed',
      'no_eligible_option',
    ] as const) {
      const robustness = mappedRobustness({ recommended_option_compliance: value })
      expect(robustness.recommended_option_compliance, `enum ${value} transported`).toBe(value)
    }
  })

  it('ABSENCE IS PRESERVED — an older producer yields no key, never a default', () => {
    const robustness = mappedRobustness({})
    expect('recommended_option_compliance' in robustness).toBe(false)
    expect('recommended_option_compliance_reason' in robustness).toBe(false)
  })

  it('a non-string verdict is DROPPED rather than coerced', () => {
    const robustness = mappedRobustness({
      recommended_option_compliance: 42,
      recommended_option_compliance_reason: { text: 'nope' },
    })
    expect('recommended_option_compliance' in robustness).toBe(false)
    expect('recommended_option_compliance_reason' in robustness).toBe(false)
  })
})
