/**
 * Lane UI-R3 (truth rendering) — roadmap 1.7 + 1.12 mapper contract.
 *
 * Feature B (1.7): mapV5AnalysisToReport previously narrowed
 * `enrichment.factor_sensitivity[]` to { factor_id, factor_label,
 * sensitivity, direction }, DROPPING the producer's influence_score /
 * influence_rank / zero_reason before the store. These tests lock the
 * additive passthrough (provisional_doctrine_v0: influence ≠ sensitivity).
 *
 * Feature C (1.12): `enrichment.inference_warnings[]` previously never left
 * the mapper, so warning-severity entries could not reach any user surface.
 * These tests lock the verbatim passthrough onto the widened report.
 *
 * Fixture: real staging capture (debug bundle olumi-debug-45c9b625-20260707,
 * payloads.cee_response.blocks[0]) — real factor ids, real influence values,
 * real warning shapes. See fixture _provenance for the one synthetic
 * warning-severity entry.
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
  influence_score?: number
  influence_rank?: number
  zero_reason?: string
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

describe('mapV5AnalysisToReport — influence passthrough (roadmap 1.7)', () => {
  it('carries producer influence_score and influence_rank verbatim onto factor_sensitivity rows', () => {
    const report = mapBundleBlock()

    // Real staging values from the captured bundle.
    const receptivity = factorById(report, 'fac_market_receptivity')
    expect(receptivity.influence_score).toBe(0.6209677419354838)
    expect(receptivity.influence_rank).toBe(2)

    const founderTime = factorById(report, 'fac_founder_time')
    expect(founderTime.influence_score).toBe(0.4838709677419354)
    expect(founderTime.influence_rank).toBe(3)

    const adSpend = factorById(report, 'fac_ad_spend')
    expect(adSpend.influence_score).toBe(0.14516129032258066)
    expect(adSpend.influence_rank).toBe(5)
  })

  it('pinned factor (zero_reason intervention_override) keeps influence_score 1 despite sensitivity 0', () => {
    const report = mapBundleBlock()
    const pinned = factorById(report, 'fac_marketing_expertise')
    // Producer says: maximum structural influence, zero sensitivity because
    // the options pin it. Both truths must reach the store unaltered.
    expect(pinned.influence_score).toBe(1)
    expect(pinned.influence_rank).toBe(1)
    expect(pinned.sensitivity).toBe(0)
    expect(pinned.zero_reason).toBe('intervention_override')
  })

  it('omits influence fields when the producer omits them (no defaults, no derivation)', () => {
    const block = {
      type: 'analysis_result',
      summary: 'legacy shape without influence fields',
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
    expect(row.factor_id).toBe('fac_x')
    expect('influence_score' in row).toBe(false)
    expect('influence_rank' in row).toBe(false)
    expect('zero_reason' in row).toBe(false)
  })
})

describe('mapV5AnalysisToReport — inference_warnings passthrough (roadmap 1.12)', () => {
  it('passes enrichment.inference_warnings through verbatim onto the widened report', () => {
    const report = mapBundleBlock()
    const warnings = report.inference_warnings as Array<Record<string, unknown>>
    expect(Array.isArray(warnings)).toBe(true)
    expect(warnings).toHaveLength(3)

    // Real staging entries — byte-identical passthrough (code, message, severity).
    expect(warnings[0].code).toBe('EDGE_SENSITIVITY_UNAVAILABLE_V2_WIRE')
    expect(warnings[0].severity).toBe('info')
    expect(warnings[1].code).toBe('CONSTRAINT_NODE_DEFAULT_BASE')
    expect(warnings[1].severity).toBe('info')
    expect(warnings[1].message).toBe(
      "Node 'out_campaign_effectiveness' has no ParameterUncertainty — defaulted to base=0.0, constraint probability may be unreliable",
    )

    // Warning-severity entry (per producer-documented CONSTRAINT_TARGET_UNRELIABLE shape).
    expect(warnings[2].code).toBe('CONSTRAINT_TARGET_UNRELIABLE')
    expect(warnings[2].severity).toBe('warning')
    expect(typeof warnings[2].message).toBe('string')

    // Verbatim: the mapped array is the fixture array's content, unrewritten.
    expect(warnings).toEqual(
      (bundleFixture.block as { enrichment: { inference_warnings: unknown[] } }).enrichment
        .inference_warnings,
    )
  })

  it('emits no inference_warnings key when the enrichment carries none', () => {
    const block = {
      type: 'analysis_result',
      summary: 'no warnings',
      leading_option_id: null,
      win_probabilities: { opt_a: 0.6 },
      enrichment: {},
    } as unknown as AnalysisResultBlock
    const report = mapV5AnalysisToReport(block) as WidenedReport
    expect('inference_warnings' in report).toBe(false)
  })
})
