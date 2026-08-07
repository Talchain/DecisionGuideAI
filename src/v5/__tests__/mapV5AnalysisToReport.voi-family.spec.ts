/**
 * V7-C slice 1 transport pin (ROADMAP 2.141) — the VOI FAMILY reaches the store.
 *
 * schemas 0.30.0 adds four keys to `CEE_UI_ENRICHMENT_KEEP_LIST` and CEE #754
 * mirrors them onto `P0B_SAFE_TRANSPORT_ENRICHMENT_KEEP`, so
 * `factor_evppi` / `decision_evpi` / `p_win_sensitivity` / `correlation_model`
 * now arrive on `blocks[0].enrichment` at the browser (live-probed 30 Jul, row
 * 2.141). Until this mapper read them they died here — one hop before the store.
 *
 * FOUR KEYS, NOT THREE. The design's §6 slice table listed three; its own §6
 * CORRECTION raises it to four, because `correlation_model` is the
 * DISCRIMINATOR for an absent `p_win_sensitivity` (ISL suppresses
 * `p_win_sensitivity` under active correlation and names it in
 * `correlation_model.suppressed_attributions`). Transporting the question and
 * leaving the answer behind is the failure this pin exists to prevent.
 *
 * Only `factor_evppi` is DISPLAYED in slice 1. The other three are transported
 * and unread — deliberately, so the display half needs no second cross-repo
 * train. Transport is claim-inert; the claim cage is the reader
 * (`components/results/voi/voiRanking.ts`).
 *
 * CLAIM TYPE: pure-mapper behaviour over a synthesised block. It proves the
 * mapper carries what a conforming wire sends; it is NOT a live-wire claim.
 */
import { describe, expect, it } from 'vitest'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'

type WidenedReport = ReturnType<typeof mapV5AnalysisToReport> & Record<string, unknown>

/** ISL row shape, wire order = `evppi` DESCENDING, one below-resolution row. */
const FACTOR_EVPPI = [
  {
    factor_id: 'n_market',
    evppi: 0.91,
    evppi_raw: 0.913_2,
    baseline_max_expected_utility: 12.5,
    conditional_max_expected_utility: 13.41,
    units: 'outcome',
    method: 'regression_evppi_v1',
    regression_degree: 2,
    n_samples: 4000,
    clamped_low: false,
    clamped_high: false,
    noise_floor: 0.01,
    status: 'resolved',
    correlation_active: false,
  },
  {
    factor_id: 'n_reg',
    evppi: 0.12,
    units: 'outcome',
    method: 'regression_evppi_v1',
    noise_floor: 0.01,
    status: 'resolved',
    clamped_high: true,
  },
  {
    factor_id: 'n_hiring',
    evppi: 0.004,
    units: 'outcome',
    method: 'regression_evppi_v1',
    noise_floor: 0.01,
    status: 'below_resolution',
  },
]

const CORRELATION_MODEL = {
  active: true,
  suppressed_attributions: ['p_win_sensitivity'],
}

function block(enrichment: Record<string, unknown> | undefined): AnalysisResultBlock {
  return {
    type: 'analysis_result',
    summary: 'A summary',
    leading_option_id: 'opt_a',
    win_probabilities: { opt_a: 0.6, opt_b: 0.4 },
    ...(enrichment !== undefined ? { enrichment } : {}),
  } as unknown as AnalysisResultBlock
}

function mapped(enrichment: Record<string, unknown> | undefined): WidenedReport {
  return mapV5AnalysisToReport(block(enrichment)) as WidenedReport
}

describe('mapV5AnalysisToReport — VOI family transport (V7-C slice 1)', () => {
  it('carries all FOUR VOI keys verbatim off block.enrichment', () => {
    const report = mapped({
      factor_evppi: FACTOR_EVPPI,
      decision_evpi: 1.75,
      p_win_sensitivity: [{ factor_id: 'n_market', delta_pp: 3.2 }],
      correlation_model: CORRELATION_MODEL,
    })

    // Verbatim — same values AND the same reference-equal row order.
    expect(report.factor_evppi).toEqual(FACTOR_EVPPI)
    expect(report.decision_evpi).toBe(1.75)
    expect(report.p_win_sensitivity).toEqual([{ factor_id: 'n_market', delta_pp: 3.2 }])
    expect(report.correlation_model).toEqual(CORRELATION_MODEL)
  })

  it('preserves PRODUCER ROW ORDER exactly (never re-sorted at transport)', () => {
    const report = mapped({ factor_evppi: FACTOR_EVPPI })
    expect((report.factor_evppi as Array<{ factor_id: string }>).map(r => r.factor_id)).toEqual([
      'n_market',
      'n_reg',
      'n_hiring',
    ])
  })

  it('preserves every audit leg and status on the row (the reader decides what to use)', () => {
    const report = mapped({ factor_evppi: FACTOR_EVPPI })
    const first = (report.factor_evppi as Array<Record<string, unknown>>)[0]
    for (const key of [
      'evppi_raw',
      'baseline_max_expected_utility',
      'conditional_max_expected_utility',
      'units',
      'method',
      'regression_degree',
      'n_samples',
      'clamped_low',
      'clamped_high',
      'noise_floor',
      'status',
      'correlation_active',
    ]) {
      expect(first, `row must carry ${key}`).toHaveProperty(key)
    }
  })

  it('ABSENCE-PRESERVING: omits each key when the producer omitted it', () => {
    const report = mapped({ factor_sensitivity: [] })
    expect(report).not.toHaveProperty('factor_evppi')
    expect(report).not.toHaveProperty('decision_evpi')
    expect(report).not.toHaveProperty('p_win_sensitivity')
    expect(report).not.toHaveProperty('correlation_model')
  })

  it('ABSENCE-PRESERVING: no enrichment at all → no VOI keys, no fabricated empties', () => {
    const report = mapped(undefined)
    expect(report).not.toHaveProperty('factor_evppi')
    expect(report).not.toHaveProperty('decision_evpi')
  })

  it('a producer-sent empty array is carried as [] — an honest "no rows"', () => {
    // [] is the producer saying "no factor survived", which the reader turns
    // into the honest gate. Coercing it to absent would lose nothing today but
    // would make the two states indistinguishable at the seam.
    const report = mapped({ factor_evppi: [] })
    expect(report.factor_evppi).toEqual([])
  })

  it('a producer-sent null factor_evppi is NOT carried as a fabricated array', () => {
    const report = mapped({ factor_evppi: null })
    expect(report.factor_evppi).toBeUndefined()
  })

  it('decision_evpi of exactly 0 is carried (0 is a value, not an absence)', () => {
    const report = mapped({ decision_evpi: 0 })
    expect(report.decision_evpi).toBe(0)
  })

  it('a non-finite decision_evpi is dropped rather than carried as NaN', () => {
    const report = mapped({ decision_evpi: Number.NaN })
    expect(report).not.toHaveProperty('decision_evpi')
  })

  it('a malformed factor_evppi (not an array) is dropped, not carried opaquely', () => {
    const report = mapped({ factor_evppi: { factor_id: 'n_market' } })
    expect(report).not.toHaveProperty('factor_evppi')
  })

  it('POSITIVE CONTROL: the harness sees the pre-existing keep-list keys too', () => {
    // Trap 13 — without this, "absence-preserving" above could be passing
    // because the mapper reads no enrichment at all in this fixture shape.
    const report = mapped({
      confidence_tier: 'strong',
      inference_warnings: [{ code: 'FACTOR_EVPPI_PARTIAL', severity: 'warning' }],
      factor_evppi: FACTOR_EVPPI,
    })
    expect(report.confidence_tier).toBe('strong')
    expect(report.inference_warnings).toEqual([
      { code: 'FACTOR_EVPPI_PARTIAL', severity: 'warning' },
    ])
    expect(report.factor_evppi).toEqual(FACTOR_EVPPI)
  })

  it('the VOI keys participate in the block hash, so a VOI-only delta re-hydrates', () => {
    const withVoi = mapped({ factor_sensitivity: [], factor_evppi: FACTOR_EVPPI })
    const withoutVoi = mapped({ factor_sensitivity: [] })
    expect(withVoi.model_card.response_hash).not.toBe(withoutVoi.model_card.response_hash)
  })
})
