/**
 * ROADMAP 2.235 (cheap half) — the producer owns the driver order; the UI
 * renders it WITHOUT reordering.
 *
 * THE DEFECT (Codex audit B, B-01, at `900dbd6c`). PLoT holds the one
 * canonical order and states the authority rule in its own source: "ISL
 * measures · PLoT orders + attests · CEE permits + projects · UI renders
 * WITHOUT reordering" (`plot-lite-service/src/lib/driver-order.ts:1-14`). The
 * emitted `factor_sensitivity[]` order IS that ranking. On a mixed
 * graph/ISL result the graph-only and ISL-only rows carry INCOMMENSURABLE
 * quantities — `influence_score` / `sensitivity_score` / `elasticity` — and
 * PLoT appends the ISL-only rows without a global re-sort precisely because
 * they cannot be ranked against each other.
 *
 * `collectFactors` nevertheless finished with a global
 * `sort((a,b) => b.sensitivity - a.sensitivity)` plus an `a.factor_id
 * .localeCompare(b.factor_id)` tie-break, and `mapV5AnalysisToReport` crowns
 * the first five as Drivers. So the UI both DESTROYED the producer's
 * attested order and RANKED unlike quantities against one another.
 *
 * SCOPE, HONESTLY STATED. This pin covers the cheap half only: stop sorting,
 * preserve the incoming order. The full contract train — typing and
 * transporting `driver_order`, asserting `ranked_factor_ids` equals the
 * transported row IDs, and failing closed on an attestation mismatch — needs
 * schemas → CEE → UI and is rowed separately. Nothing here claims the
 * attestation is checked, because it is not.
 *
 * CLAIM TYPE: pure-mapper behaviour over a synthesised block. It proves the
 * mapper preserves what a conforming wire sends.
 */
import { describe, expect, it } from 'vitest'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'

type WidenedReport = ReturnType<typeof mapV5AnalysisToReport> & Record<string, unknown>
type ReportFactor = { factor_id: string; sensitivity: number }

function block(enrichment: Record<string, unknown>): AnalysisResultBlock {
  return {
    type: 'analysis_result',
    summary: 'A summary',
    leading_option_id: 'opt_a',
    win_probabilities: { opt_a: 0.6, opt_b: 0.4 },
    enrichment,
  } as unknown as AnalysisResultBlock
}

function idsOf(report: WidenedReport): string[] {
  return ((report.factor_sensitivity ?? []) as ReportFactor[]).map((f) => f.factor_id)
}

describe('mapV5AnalysisToReport — producer driver order survives (ROADMAP 2.235)', () => {
  it('AUDIT PROBE: a mixed_graph_isl payload keeps its emitted order — [A, B, C], never [C, A, B]', () => {
    // The audit's exact payload: two graph rows in producer order, then an
    // ISL-only row whose magnitude is on a DIFFERENT scale and therefore
    // cannot be ranked against them.
    const report = mapV5AnalysisToReport(
      block({
        species: 'mixed_graph_isl',
        factor_sensitivity: [
          { factor_id: 'A', factor_label: 'Graph A', sensitivity_score: 0.2 },
          { factor_id: 'B', factor_label: 'Graph B', sensitivity_score: 0.1 },
          { factor_id: 'C', factor_label: 'ISL only C', sensitivity_score: 0.9 },
        ],
      }),
    ) as WidenedReport

    expect(idsOf(report)).toEqual(['A', 'B', 'C'])
    expect(idsOf(report)).not.toEqual(['C', 'A', 'B'])
  })

  it('the crowned Drivers follow the same producer order', () => {
    const report = mapV5AnalysisToReport(
      block({
        species: 'mixed_graph_isl',
        factor_sensitivity: [
          { factor_id: 'A', factor_label: 'Graph A', sensitivity_score: 0.2 },
          { factor_id: 'B', factor_label: 'Graph B', sensitivity_score: 0.1 },
          { factor_id: 'C', factor_label: 'ISL only C', sensitivity_score: 0.9 },
        ],
      }),
    ) as WidenedReport

    expect(report.drivers.map((d) => d.nodeId)).toEqual(['A', 'B', 'C'])
    // The top driver is the producer's first row, not the biggest number.
    expect(report.drivers[0].label).toBe('Graph A')
  })

  it('SAME-SPECIES TIE: equal magnitudes are NOT re-ordered by ID', () => {
    // `z` before `a` on the wire. The old lexical tie-break inverted this.
    const report = mapV5AnalysisToReport(
      block({
        factor_sensitivity: [
          { factor_id: 'z_first', factor_label: 'Z', sensitivity_score: 0.5 },
          { factor_id: 'a_second', factor_label: 'A', sensitivity_score: 0.5 },
        ],
      }),
    ) as WidenedReport

    expect(idsOf(report)).toEqual(['z_first', 'a_second'])
  })

  it('a DESCENDING producer order is passed through unchanged (the fix is not an inversion)', () => {
    const report = mapV5AnalysisToReport(
      block({
        factor_sensitivity: [
          { factor_id: 'big', factor_label: 'Big', sensitivity_score: 0.9 },
          { factor_id: 'mid', factor_label: 'Mid', sensitivity_score: 0.5 },
          { factor_id: 'small', factor_label: 'Small', sensitivity_score: 0.1 },
        ],
      }),
    ) as WidenedReport

    expect(idsOf(report)).toEqual(['big', 'mid', 'small'])
  })

  it('DE-DUPE keeps the TOP-LEVEL position while still preferring the larger magnitude', () => {
    // A row present both top-level and per-result must not migrate to the end
    // of the list just because the per-result copy won on magnitude.
    const report = mapV5AnalysisToReport(
      block({
        factor_sensitivity: [
          { factor_id: 'A', factor_label: 'A', sensitivity_score: 0.2 },
          { factor_id: 'B', factor_label: 'B', sensitivity_score: 0.1 },
        ],
        results: [
          { factor_sensitivity: [{ factor_id: 'A', factor_label: 'A', sensitivity_score: 0.8 }] },
        ],
      }),
    ) as WidenedReport

    expect(idsOf(report)).toEqual(['A', 'B'])
    expect(((report.factor_sensitivity ?? []) as ReportFactor[])[0].sensitivity).toBe(0.8)
  })

  it('POSITIVE CONTROL — rows are still collected and magnitudes still carried (not an empty pass)', () => {
    const report = mapV5AnalysisToReport(
      block({
        factor_sensitivity: [
          { factor_id: 'A', factor_label: 'Graph A', sensitivity_score: 0.2 },
          { factor_id: 'B', factor_label: 'Graph B', sensitivity_score: 0.1 },
        ],
      }),
    ) as WidenedReport

    const factors = (report.factor_sensitivity ?? []) as ReportFactor[]
    expect(factors).toHaveLength(2)
    expect(factors[0].sensitivity).toBe(0.2)
    expect(factors[1].sensitivity).toBe(0.1)
  })
})
