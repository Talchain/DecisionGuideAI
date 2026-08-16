/**
 * ROADMAP 2.177 (UI leg) — `conditional_winners` reaches the report.
 *
 * THE DEFECT. `mapV5AnalysisToReport` read `conditional_winners` from the
 * NESTED slot only (`enrichment.robustness.conditional_winners`), while PLoT
 * emits it at the TOP LEVEL of the enrichment envelope. This is the P0-F6
 * `edge_e_values` defect one field over, in the same function, fixed here with
 * the same precedence.
 *
 * PRODUCER PROVENANCE — derived at the PLoT bytes, never invented
 * (plot-lite-service @ staging `a5345a5e`):
 *   - `src/routes/v2/run.ts:3881` — `conditional_winners: conditionalWinners ?? []`,
 *     built as an immediate top-level sibling of `edge_e_values` (:3879) in the
 *     same RunResponseV3 object literal. ALWAYS emitted: `[]` means "computed,
 *     none", never "not computed" (`transformConditionalWinners`, :676-680).
 *   - `src/types/engine-v3.ts:2040` — `ConditionalWinner`:
 *       factor_id, factor_label, split_value (REQUIRED number — ROADMAP 1.277
 *       drops any entry lacking it), split_unit?, low_bucket, high_bucket,
 *       winner_flips, _normalised?
 *   - `src/types/engine-v3.ts:2062` — `ConditionalBucket`:
 *       winner_id, winner_label, runner_up_id?, runner_up_label?,
 *       win_probability, mean_outcome?
 *   - `src/contracts/isl-to-ui.contract.ts:296-299` — `conditional_winners` is
 *     an always-emit contract key, enriched with `factor_label` and per-bucket
 *     `winner_label`.
 * Every row below is built to THAT shape. No field here is invented.
 *
 * WIRE LOCATION, MEASURED (not assumed): 773/773 live persisted run facts carry
 * `conditional_winners` at the enrichment ROOT and 0/773 nested — the same
 * census that drove #540 / 2.177 for `inference_warnings` and `edge_e_values`
 * (`src/canvas/stores/persistedRunSnapshotFactory.ts:24`).
 *
 * WHY IT WAS USER-VISIBLE. Both downstream readers already ask for the
 * TOP-LEVEL report slot FIRST and fall back to the nested one:
 *   - `src/components/results/useResultsSectionData.ts:3388`
 *   - `src/canvas/components/ModelTabBody.tsx:285`
 * The mapper never minted `report.conditional_winners`, so their first arm was
 * dead by construction, and their second arm read a slot the producer does not
 * fill. `ConditionalWinnerCards` — mounted on the live `hero-arm-triage-actions`
 * surface via `TriageActionCardsBody.tsx:726` and on `ConfidenceSection.tsx:962`
 * — is gated on `length > 0` and therefore never rendered.
 *
 * SCOPE, STATED HONESTLY (this spec's own limits):
 *   - The checked-in staging capture `v5-analysis-result.bundle-45c9b625.json`
 *     carries NO `conditional_winners` in either slot (verified: top-level
 *     ABSENT, `robustness.conditional_winners` ABSENT). Rows are therefore
 *     SYNTHESISED from PLoT's typed shape above and OVERLAID on the real
 *     captured envelope — the same honest device the CEE→UI contract test uses
 *     for the VOI family, for the same reason.
 *   - The capture DOES carry 6 real top-level `edge_e_values` entries. That is
 *     this fixture's POSITIVE CONTROL: it proves the base envelope is a genuine
 *     enrichment payload the mapper reads, so the ABSENCE case below is a fact
 *     about `conditional_winners` and not about a fixture the mapper ignored.
 *   - These are MAPPER tests. They prove the data reaches the report slots the
 *     renderers read. They are NOT a render witness and NOT a wire witness.
 *   - ⚠ TRANSPORT IS NOT FIXED BY THIS PR. CEE's
 *     `P0B_SAFE_TRANSPORT_ENRICHMENT_KEEP` (compose.ts) does not carry
 *     `conditional_winners`, so on the live V5 path the key is stripped one hop
 *     before the browser. This leg makes the UI correct and ready; the field
 *     stays DARK to a real user until the CEE keep-list lands.
 */
import { describe, expect, it } from 'vitest'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'

import bundleFixture from './fixtures/v5-analysis-result.bundle-45c9b625.json'

type WidenedReport = ReturnType<typeof mapV5AnalysisToReport> & Record<string, unknown>

interface ConditionalBucketRow {
  winner_id: string
  winner_label: string
  runner_up_id?: string
  runner_up_label?: string
  win_probability: number
  mean_outcome?: number
}

interface ConditionalWinnerRow {
  factor_id: string
  factor_label: string
  split_value: number
  split_unit?: string
  low_bucket: ConditionalBucketRow
  high_bucket: ConditionalBucketRow
  winner_flips: boolean
  _normalised?: boolean
}

/**
 * Two DISTINCT rows. Two, not one, so every assertion below can bind to its
 * object by `factor_id` IDENTITY rather than by a value predicate the other row
 * could also satisfy — and so a mutation that returns "some row" instead of
 * "this row" is observable.
 */
const CW_AD_SPEND: ConditionalWinnerRow = {
  factor_id: 'fac_ad_spend',
  factor_label: 'Ad spend',
  split_value: 42000,
  split_unit: 'GBP',
  low_bucket: {
    winner_id: 'opt_inhouse',
    winner_label: 'Build in-house',
    runner_up_id: 'opt_agency',
    runner_up_label: 'Hire agency',
    win_probability: 0.61,
    mean_outcome: 118000,
  },
  high_bucket: {
    winner_id: 'opt_agency',
    winner_label: 'Hire agency',
    runner_up_id: 'opt_inhouse',
    runner_up_label: 'Build in-house',
    win_probability: 0.58,
    mean_outcome: 131000,
  },
  winner_flips: true,
}

const CW_FOUNDER_TIME: ConditionalWinnerRow = {
  factor_id: 'fac_founder_time',
  factor_label: 'Founder time',
  split_value: 12,
  split_unit: 'hours/week',
  low_bucket: {
    winner_id: 'opt_agency',
    winner_label: 'Hire agency',
    win_probability: 0.54,
  },
  high_bucket: {
    winner_id: 'opt_agency',
    winner_label: 'Hire agency',
    win_probability: 0.72,
  },
  // A NON-flipping row. PLoT emits these; the mapper must transport them
  // verbatim and leave the filtering to the renderer, which drops same-winner
  // entries itself (ConditionalWinnerCards.tsx). A mapper that silently
  // dropped them would hide a real producer fact.
  winner_flips: false,
}

/** Overlay onto the REAL captured envelope; never rebuild it. */
function blockWith(enrichmentOverlay: Record<string, unknown>): AnalysisResultBlock {
  const base = bundleFixture.block as unknown as Record<string, unknown>
  const baseEnrichment = base.enrichment as Record<string, unknown>
  return {
    ...base,
    enrichment: { ...baseEnrichment, ...enrichmentOverlay },
  } as unknown as AnalysisResultBlock
}

function mapWith(enrichmentOverlay: Record<string, unknown>): WidenedReport {
  return mapV5AnalysisToReport(blockWith(enrichmentOverlay)) as WidenedReport
}

function topLevelRows(report: WidenedReport): ConditionalWinnerRow[] {
  return report.conditional_winners as ConditionalWinnerRow[]
}

function nestedRows(report: WidenedReport): ConditionalWinnerRow[] {
  return (report.robustness as Record<string, unknown>).conditional_winners as ConditionalWinnerRow[]
}

/** Bind by IDENTITY — never by a value predicate the sibling row could satisfy. */
function rowById(rows: ConditionalWinnerRow[], id: string): ConditionalWinnerRow {
  const row = rows?.find((r) => r.factor_id === id)
  expect(row, `conditional winner ${id} present`).toBeDefined()
  return row as ConditionalWinnerRow
}

describe('mapV5AnalysisToReport — conditional_winners fixture provenance', () => {
  it('POSITIVE CONTROL — the base capture is a real enrichment envelope the mapper reads', () => {
    // 6 genuine top-level edge_e_values in the capture. If this ever fails, the
    // ABSENCE test below proves nothing (doctrine trap 13), so it is asserted
    // here rather than assumed.
    const report = mapWith({})
    const edges = (report.edge_e_values ?? []) as unknown[]
    expect(edges.length, 'capture carries real top-level edge_e_values').toBe(6)
  })

  it('SCOPE PIN — the capture itself carries no conditional_winners in either slot', () => {
    const enrichment = (bundleFixture.block as unknown as Record<string, unknown>)
      .enrichment as Record<string, unknown>
    expect(Array.isArray(enrichment.conditional_winners)).toBe(false)
    const nested = enrichment.robustness as Record<string, unknown> | undefined
    expect(Array.isArray(nested?.conditional_winners)).toBe(false)
  })
})

describe('mapV5AnalysisToReport — conditional_winners root-wins dual read (ROADMAP 2.177)', () => {
  it('TOP-LEVEL rows reach BOTH report slots — the live PLoT wire location', () => {
    const report = mapWith({ conditional_winners: [CW_AD_SPEND, CW_FOUNDER_TIME] })

    // The slot both downstream readers try FIRST, and which nothing populated
    // before this fix.
    expect(Array.isArray(topLevelRows(report))).toBe(true)
    expect(topLevelRows(report)).toHaveLength(2)
    // The slot the legacy consumers fall back to.
    expect(Array.isArray(nestedRows(report))).toBe(true)
    expect(nestedRows(report)).toHaveLength(2)
  })

  it('carries the identified row VERBATIM — split, units, buckets, flip flag', () => {
    const report = mapWith({ conditional_winners: [CW_AD_SPEND, CW_FOUNDER_TIME] })
    const row = rowById(topLevelRows(report), 'fac_ad_spend')

    expect(row.factor_label).toBe('Ad spend')
    expect(row.split_value).toBe(42000)
    expect(row.split_unit).toBe('GBP')
    expect(row.winner_flips).toBe(true)
    expect(row.low_bucket.winner_id).toBe('opt_inhouse')
    expect(row.low_bucket.winner_label).toBe('Build in-house')
    expect(row.low_bucket.win_probability).toBe(0.61)
    expect(row.low_bucket.mean_outcome).toBe(118000)
    expect(row.high_bucket.winner_id).toBe('opt_agency')
    expect(row.high_bucket.winner_label).toBe('Hire agency')
    expect(row.high_bucket.win_probability).toBe(0.58)
    // Nested slot carries the same row, bound by the same identity.
    expect(rowById(nestedRows(report), 'fac_ad_spend')).toEqual(row)
  })

  it('IDENTITY BINDING — the sibling row keeps its own values, not the first row\'s', () => {
    // Guards against an assertion that would pass on "whichever row came back".
    const report = mapWith({ conditional_winners: [CW_AD_SPEND, CW_FOUNDER_TIME] })
    const founder = rowById(topLevelRows(report), 'fac_founder_time')

    expect(founder.split_value).toBe(12)
    expect(founder.split_unit).toBe('hours/week')
    expect(founder.factor_label).toBe('Founder time')
    // And it is genuinely a DIFFERENT object from its sibling.
    expect(founder.split_value).not.toBe(CW_AD_SPEND.split_value)
  })

  it('a NON-flipping row survives the mapper — filtering is the renderer\'s job', () => {
    const report = mapWith({ conditional_winners: [CW_FOUNDER_TIME] })
    const row = rowById(topLevelRows(report), 'fac_founder_time')
    expect(row.winner_flips).toBe(false)
    expect(row.low_bucket.winner_label).toBe(row.high_bucket.winner_label)
    // No fabricated optional fields on a row the producer sent without them.
    expect('runner_up_id' in row.low_bucket).toBe(false)
    expect('mean_outcome' in row.high_bucket).toBe(false)
  })

  it('LEGACY CONTROL — nested-only rows still reach both slots (the fallback arm is not dead)', () => {
    const baseEnrichment = (bundleFixture.block as unknown as Record<string, unknown>)
      .enrichment as Record<string, unknown>
    const report = mapWith({
      robustness: {
        ...(baseEnrichment.robustness as Record<string, unknown>),
        conditional_winners: [CW_AD_SPEND],
      },
    })
    expect(rowById(topLevelRows(report), 'fac_ad_spend').split_value).toBe(42000)
    expect(rowById(nestedRows(report), 'fac_ad_spend').split_value).toBe(42000)
  })

  it('PRECEDENCE — an empty top-level array does not mask a populated legacy copy', () => {
    // PLoT ALWAYS emits the key (`?? []`), so a computed-empty top level must
    // not suppress a populated nested copy. Same rule as edge_e_values.
    const baseEnrichment = (bundleFixture.block as unknown as Record<string, unknown>)
      .enrichment as Record<string, unknown>
    const report = mapWith({
      conditional_winners: [],
      robustness: {
        ...(baseEnrichment.robustness as Record<string, unknown>),
        conditional_winners: [CW_FOUNDER_TIME],
      },
    })
    expect(rowById(topLevelRows(report), 'fac_founder_time').split_value).toBe(12)
    expect(rowById(nestedRows(report), 'fac_founder_time').split_value).toBe(12)
  })

  it('TOP-LEVEL WINS over a differing legacy copy', () => {
    const baseEnrichment = (bundleFixture.block as unknown as Record<string, unknown>)
      .enrichment as Record<string, unknown>
    const report = mapWith({
      conditional_winners: [CW_AD_SPEND],
      robustness: {
        ...(baseEnrichment.robustness as Record<string, unknown>),
        conditional_winners: [CW_FOUNDER_TIME],
      },
    })
    expect(topLevelRows(report)).toHaveLength(1)
    expect(rowById(topLevelRows(report), 'fac_ad_spend').split_value).toBe(42000)
    expect(topLevelRows(report).find((r) => r.factor_id === 'fac_founder_time')).toBeUndefined()
  })

  it('ABSENT — neither slot is fabricated when the producer sent nothing', () => {
    // Fail closed. No `[]`, no synthesised row: the renderers gate on
    // `length > 0`, so a fabricated empty is not merely untidy, it is a claim
    // the producer never made.
    const report = mapWith({})
    expect('conditional_winners' in report).toBe(false)
    const robustness = report.robustness as Record<string, unknown>
    expect('conditional_winners' in robustness).toBe(false)
  })

  it('ABSENT — a top-level empty array with no legacy copy stays omitted', () => {
    const report = mapWith({ conditional_winners: [] })
    expect('conditional_winners' in report).toBe(false)
    expect('conditional_winners' in (report.robustness as Record<string, unknown>)).toBe(false)
  })

  it('malformed (non-array) values are ignored, never coerced', () => {
    const report = mapWith({ conditional_winners: { rows: [CW_AD_SPEND] } })
    expect('conditional_winners' in report).toBe(false)
  })
})
