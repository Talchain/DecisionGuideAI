/**
 * P0 F5/F6 (A3-filed, A1-verified) — the two top user-visible data losses on
 * the live V5 conversational path. Both are UI-side; PLoT's wire is correct
 * (A3 → ORCHESTRATOR, 19 Jul 2026; positive control = the checked-in staging
 * bundle fixture used here).
 *
 * F5 — value-of-information / EVPI stripped: `normaliseFactorEntry` narrowed
 * `enrichment.factor_sensitivity[]` to a closed `NormalisedFactor` that never
 * read `value_of_information` / `evpi_percentage_points` / `evpi_method` /
 * `evpi_status`, so every EVPI field was DELETED before the store. The V4
 * mapper preserves them (`responseMapper.ts:281,336`) and the Model tab renders
 * them (`ModelTabBody.tsx:209-217` builds the EVPI map from
 * `evpi_percentage_points` ?? `value_of_information * 100`); the V5 path went
 * dark. These tests lock the additive passthrough — verbatim, never scaled,
 * never defaulted.
 *
 * F6 — edge E-values read from the wrong nested location: PLoT emits
 * `edge_e_values` at the TOP LEVEL of enrichment (`enrichment.edge_e_values`);
 * the legacy nested copy (`enrichment.robustness.edge_e_values`) is no longer
 * populated on the live V5 wire. Every UI consumer reads
 * `report.robustness.edge_e_values` (`useAnalysisResults.ts:54`,
 * `ModelTabBody.tsx:238`, `useResultsSectionData.ts:2491/2958`,
 * `analysisSnapshotFactory.ts:115`), so E-values rendered empty despite real
 * data on the wire. These tests lock: `report.robustness.edge_e_values` is
 * sourced from the real top-level wire location, falls back to the legacy
 * nested copy, and fails closed when both are genuinely absent.
 *
 * REAL WIRE PROVENANCE — every nesting below is pinned to the checked-in
 * capture `fixtures/v5-analysis-result.bundle-45c9b625.json`
 * (debug bundle olumi-debug-45c9b625-20260707, payloads.cee_response.blocks[0]):
 *   - factor VoI/EVPI at  block.enrichment.factor_sensitivity[].value_of_information
 *                          block.enrichment.factor_sensitivity[].evpi_percentage_points
 *   - edge E-values at     block.enrichment.edge_e_values   (TOP LEVEL, 6 entries)
 *   - block.enrichment.robustness carries NO edge_e_values.
 */
import { describe, expect, it } from 'vitest'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'

import bundleFixture from './fixtures/v5-analysis-result.bundle-45c9b625.json'

type WidenedReport = ReturnType<typeof mapV5AnalysisToReport> & Record<string, unknown>

interface FactorRow {
  factor_id: string
  factor_label: string
  sensitivity: number
  direction: 'positive' | 'negative'
  value_of_information?: number
  evpi_percentage_points?: number
  evpi_method?: string
  evpi_status?: string
}

function mapBundleBlock(): WidenedReport {
  const block = bundleFixture.block as unknown as AnalysisResultBlock
  return mapV5AnalysisToReport(block) as WidenedReport
}

function factorById(report: WidenedReport, id: string): FactorRow {
  const rows = report.factor_sensitivity as FactorRow[]
  const row = rows.find((f) => f.factor_id === id)
  expect(row, `factor ${id} present in widened.factor_sensitivity`).toBeDefined()
  return row as FactorRow
}

describe('mapV5AnalysisToReport — value-of-information / EVPI passthrough (P0 F5)', () => {
  it('carries per-factor value_of_information verbatim onto factor_sensitivity rows (real staging bundle)', () => {
    const report = mapBundleBlock()
    // Every factor in the captured bundle carries value_of_information (0 here —
    // a below-resolution capture). The defect DELETED the field entirely; the
    // fix must preserve it, including a real 0 (0 is data, not absence).
    for (const id of [
      'fac_marketing_expertise',
      'fac_market_receptivity',
      'fac_founder_time',
      'fac_manager_cost',
      'fac_ad_spend',
    ]) {
      const row = factorById(report, id)
      expect('value_of_information' in row, `${id} keeps value_of_information`).toBe(true)
      expect(row.value_of_information).toBe(0)
    }
  })

  it('carries evpi_percentage_points where the producer sent it, omits it where absent (no defaults)', () => {
    const report = mapBundleBlock()
    // Present (0) on these two entries in the capture.
    expect(factorById(report, 'fac_market_receptivity').evpi_percentage_points).toBe(0)
    expect(factorById(report, 'fac_founder_time').evpi_percentage_points).toBe(0)
    expect(factorById(report, 'fac_market_receptivity').evpi_method).toBe('heuristic')
    expect(factorById(report, 'fac_founder_time').evpi_method).toBe('heuristic')
    // Absent on these — must NOT be fabricated to 0 (fail closed).
    for (const id of ['fac_marketing_expertise', 'fac_manager_cost', 'fac_ad_spend']) {
      expect('evpi_percentage_points' in factorById(report, id), `${id} has no fabricated evpi_percentage_points`).toBe(false)
    }
  })

  it('passes a non-zero value_of_information / evpi through verbatim — never scaled', () => {
    const block = {
      type: 'analysis_result',
      summary: 'non-zero VoI',
      leading_option_id: null,
      win_probabilities: { opt_a: 0.6 },
      enrichment: {
        factor_sensitivity: [
          {
            factor_id: 'fac_x',
            factor_label: 'X',
            sensitivity_score: 0.4,
            direction: 'positive',
            value_of_information: 0.72,
            evpi_percentage_points: 21,
            evpi_method: 'heuristic',
            evpi_status: 'above_resolution',
          },
        ],
      },
    } as unknown as AnalysisResultBlock
    const report = mapV5AnalysisToReport(block) as WidenedReport
    const row = (report.factor_sensitivity as FactorRow[])[0]
    expect(row.value_of_information).toBe(0.72) // NOT 72
    expect(row.evpi_percentage_points).toBe(21)
    expect(row.evpi_method).toBe('heuristic')
    expect(row.evpi_status).toBe('above_resolution')
  })

  it('omits every EVPI field when the producer omits them (no defaults, no derivation)', () => {
    const block = {
      type: 'analysis_result',
      summary: 'legacy shape without EVPI fields',
      leading_option_id: null,
      win_probabilities: { opt_a: 0.6 },
      enrichment: {
        factor_sensitivity: [
          { factor_id: 'fac_x', factor_label: 'X', sensitivity_score: 0.4, direction: 'positive' },
        ],
      },
    } as unknown as AnalysisResultBlock
    const report = mapV5AnalysisToReport(block) as WidenedReport
    const row = (report.factor_sensitivity as FactorRow[])[0]
    expect('value_of_information' in row).toBe(false)
    expect('evpi_percentage_points' in row).toBe(false)
    expect('evpi_method' in row).toBe(false)
    expect('evpi_status' in row).toBe(false)
  })
})

describe('mapV5AnalysisToReport — edge E-values from the real top-level wire location (P0 F6)', () => {
  it('populates report.robustness.edge_e_values from the TOP-LEVEL enrichment.edge_e_values (real staging bundle)', () => {
    const report = mapBundleBlock()
    const robustness = report.robustness as { edge_e_values?: unknown[] } | undefined
    expect(robustness, 'report.robustness present for the bundle').toBeDefined()
    // The live wire carries edge_e_values at the top level; robustness carries
    // none. Consumers read report.robustness.edge_e_values, so it must be
    // sourced from the real (top-level) location — byte-for-byte.
    const wireTopLevel = (bundleFixture.block as { enrichment: { edge_e_values: unknown[] } })
      .enrichment.edge_e_values
    expect(robustness!.edge_e_values).toEqual(wireTopLevel)
    expect(robustness!.edge_e_values).toHaveLength(6)
    // Spot-check the non-unit E-value survives (would be lost if read empty).
    const rows = robustness!.edge_e_values as Array<{ edge_id: string; e_value: number }>
    const founderDistraction = rows.find(
      (r) => r.edge_id === 'fac_marketing_expertise::risk_founder_distraction',
    )
    expect(founderDistraction?.e_value).toBe(2.2528)
  })

  it('falls back to the legacy nested robustness.edge_e_values when no top-level array is present', () => {
    const block = {
      type: 'analysis_result',
      summary: 'legacy nested edge_e_values',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 0.7 },
      enrichment: {
        robustness: {
          is_robust: true,
          level: 'high',
          edge_e_values: [{ edge_id: 'e_legacy', e_value: 0.4 }],
        },
      },
    } as unknown as AnalysisResultBlock
    const report = mapV5AnalysisToReport(block) as WidenedReport
    const robustness = report.robustness as { edge_e_values?: unknown[] } | undefined
    expect(robustness!.edge_e_values).toEqual([{ edge_id: 'e_legacy', e_value: 0.4 }])
  })

  it('prefers the top-level wire location over any stale nested copy', () => {
    const block = {
      type: 'analysis_result',
      summary: 'top-level wins',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 0.7 },
      enrichment: {
        edge_e_values: [{ edge_id: 'e_top', e_value: 0.9 }],
        robustness: {
          is_robust: true,
          level: 'high',
          edge_e_values: [{ edge_id: 'e_stale', e_value: 0.1 }],
        },
      },
    } as unknown as AnalysisResultBlock
    const report = mapV5AnalysisToReport(block) as WidenedReport
    const robustness = report.robustness as { edge_e_values?: unknown[] } | undefined
    expect(robustness!.edge_e_values).toEqual([{ edge_id: 'e_top', e_value: 0.9 }])
  })

  it('fails closed — no edge_e_values key when neither location carries data', () => {
    const block = {
      type: 'analysis_result',
      summary: 'no edges',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 0.7 },
      enrichment: {
        robustness: { is_robust: true, level: 'high' },
      },
    } as unknown as AnalysisResultBlock
    const report = mapV5AnalysisToReport(block) as WidenedReport
    const robustness = report.robustness as Record<string, unknown> | undefined
    expect(robustness).toBeDefined()
    expect('edge_e_values' in robustness!).toBe(false)
  })
})
