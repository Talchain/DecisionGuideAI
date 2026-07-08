import { describe, expect, it } from 'vitest'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'

// Real staging V5 envelope captured 2026-04-30 against cee-staging.onrender.com
// (redacted excerpt of olumi-assistants-service-cee-ws1/tests/fixtures/
// cross-service/v5-turn.run-analysis.staging.json). The defining shape
// characteristic: block.win_probabilities is keyed by option LABELS, not
// option IDs — the mapper must resolve label-keys to canonical option_ids
// via enrichment.option_comparison so the Results panel selector
// (useResultsSectionData.ts:1042 reads `optionProbs[canvas_node_id]`) hits.
import realStagingFixture from './fixtures/v5-analysis-result.staging-real-shape.json'

const baseBlock = (overrides: Partial<AnalysisResultBlock> = {}): AnalysisResultBlock => ({
  type: 'analysis_result',
  summary: 'Option A leads',
  leading_option_id: 'opt_a',
  ...overrides,
})

describe('mapV5AnalysisToReport — option IDs and probabilities', () => {
  it('option_probabilities keys match win_probabilities keys exactly (no synthesised opt_0/opt_1)', () => {
    const block = baseBlock({
      win_probabilities: { opt_a: 0.64, opt_b: 0.36 },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { win_probability?: number; confidence: number }>
    }

    expect(report.option_probabilities).toBeDefined()
    const keys = Object.keys(report.option_probabilities!).sort()
    expect(keys).toEqual(['opt_a', 'opt_b'])
    expect(report.option_probabilities!.opt_a?.win_probability).toBe(0.64)
    expect(report.option_probabilities!.opt_b?.win_probability).toBe(0.36)
  })

  it('missing probability surfaces as undefined, never as silent 0', () => {
    // Enrichment.option_comparison lists a third option that win_probabilities
    // omits — its win_probability must be undefined, not 0.
    const block = baseBlock({
      win_probabilities: { opt_a: 0.5, opt_b: 0.5 },
      enrichment: {
        option_comparison: [
          { option_id: 'opt_c' /* no win_probability */ },
        ],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { win_probability?: number }>
    }
    expect(report.option_probabilities!.opt_c).toBeDefined()
    expect(report.option_probabilities!.opt_c.win_probability).toBeUndefined()
  })

  it('omits option_probabilities when block has neither win_probabilities nor enrichment.option_comparison', () => {
    const block = baseBlock({ leading_option_id: null })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, unknown>
    }
    expect(report.option_probabilities).toBeUndefined()
  })

  it('leading_option_id: null is supported without crashing or injecting synthetic primary', () => {
    const block = baseBlock({ leading_option_id: null, win_probabilities: { opt_a: 0.5 } })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      leading_option_id?: string
    }
    expect(report.leading_option_id).toBeUndefined()
    expect(report.option_probabilities).toBeDefined()
  })
})

describe('mapV5AnalysisToReport — factor sensitivity (dual shape, alias set)', () => {
  it('top-level enrichment.factor_sensitivity is collected with {factor_id, factor_label, sensitivity, direction}', () => {
    const block = baseBlock({
      enrichment: {
        factor_sensitivity: [
          { factor_id: 'fac_market', factor_label: 'Market size', sensitivity: 0.42, direction: 'positive' },
          { factor_id: 'fac_comp', factor_label: 'Competition', sensitivity: 0.21, direction: 'negative' },
        ],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      factor_sensitivity?: Array<{ factor_id: string; factor_label: string; sensitivity: number; direction: string }>
    }
    expect(report.factor_sensitivity).toEqual([
      { factor_id: 'fac_market', factor_label: 'Market size', sensitivity: 0.42, direction: 'positive' },
      { factor_id: 'fac_comp', factor_label: 'Competition', sensitivity: 0.21, direction: 'negative' },
    ])
  })

  it('per-result enrichment.results[].factor_sensitivity is also collected', () => {
    const block = baseBlock({
      enrichment: {
        results: [
          {
            option_id: 'opt_a',
            factor_sensitivity: [
              { factor_id: 'fac_x', factor_label: 'X', sensitivity: 0.31, direction: 'positive' },
            ],
          },
        ],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      factor_sensitivity?: Array<{ factor_id: string }>
    }
    expect(report.factor_sensitivity).toBeDefined()
    expect(report.factor_sensitivity!.map((f) => f.factor_id)).toContain('fac_x')
  })

  it('mixed top-level + per-result: same factor_id deduped, higher magnitude wins', () => {
    const block = baseBlock({
      enrichment: {
        factor_sensitivity: [
          { factor_id: 'fac_shared', label: 'Shared', sensitivity: 0.20 },
        ],
        results: [
          {
            option_id: 'opt_a',
            factor_sensitivity: [
              { factor_id: 'fac_shared', label: 'Shared', sensitivity: 0.55 },
            ],
          },
        ],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      factor_sensitivity?: Array<{ factor_id: string; sensitivity: number }>
    }
    expect(report.factor_sensitivity).toHaveLength(1)
    expect(report.factor_sensitivity![0].sensitivity).toBe(0.55)
  })

  it('alias set: {label, elasticity} and {factor_label, sensitivity_score} both normalise', () => {
    const block = baseBlock({
      enrichment: {
        factor_sensitivity: [
          { label: 'Legacy', elasticity: 0.4, direction: 'positive' },
          { factor_label: 'ISL', sensitivity_score: 0.6, node_id: 'fac_isl' },
        ],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      factor_sensitivity?: Array<{ factor_id: string; factor_label: string; sensitivity: number; direction: string }>
    }
    expect(report.factor_sensitivity).toBeDefined()
    const byLabel = new Map(report.factor_sensitivity!.map((f) => [f.factor_label, f]))
    expect(byLabel.get('Legacy')?.sensitivity).toBe(0.4)
    expect(byLabel.get('Legacy')?.direction).toBe('positive')
    expect(byLabel.get('ISL')?.sensitivity).toBe(0.6)
    expect(byLabel.get('ISL')?.factor_id).toBe('fac_isl')
  })

  it('direction defaults to sign of magnitude when missing', () => {
    const block = baseBlock({
      enrichment: {
        factor_sensitivity: [
          { factor_id: 'fac_pos', label: 'Positive', sensitivity: 0.3 },
          { factor_id: 'fac_neg', label: 'Negative', sensitivity: -0.2 },
        ],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      factor_sensitivity?: Array<{ factor_id: string; sensitivity: number; direction: string }>
    }
    const byId = new Map(report.factor_sensitivity!.map((f) => [f.factor_id, f]))
    expect(byId.get('fac_pos')?.direction).toBe('positive')
    expect(byId.get('fac_pos')?.sensitivity).toBe(0.3) // absolute value
    expect(byId.get('fac_neg')?.direction).toBe('negative')
    expect(byId.get('fac_neg')?.sensitivity).toBe(0.2) // absolute value
  })

  it('entries missing both id and magnitude are dropped, never defaulted', () => {
    const block = baseBlock({
      enrichment: {
        factor_sensitivity: [
          {}, // no id, no magnitude
          { factor_id: 'fac_a' /* no magnitude */ },
          { sensitivity: 0.5 /* no id */ },
          { factor_id: 'fac_b', sensitivity: 0.4 }, // valid
        ],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      factor_sensitivity?: Array<{ factor_id: string }>
    }
    expect(report.factor_sensitivity).toHaveLength(1)
    expect(report.factor_sensitivity![0].factor_id).toBe('fac_b')
  })

  it('omits factor_sensitivity entirely when enrichment has none (no empty-array placeholder)', () => {
    const block = baseBlock({ enrichment: { factor_sensitivity: [] } })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      factor_sensitivity?: unknown
    }
    expect(report.factor_sensitivity).toBeUndefined()
  })
})

describe('mapV5AnalysisToReport — drivers + confidence derivation', () => {
  it('drivers derived from top 5 factors by absolute sensitivity', () => {
    const block = baseBlock({
      enrichment: {
        factor_sensitivity: Array.from({ length: 8 }, (_, i) => ({
          factor_id: `fac_${i}`,
          factor_label: `Factor ${i}`,
          sensitivity: 0.1 + i * 0.1, // 0.1, 0.2, ..., 0.8
          direction: 'positive',
        })),
      },
    })

    const report = mapV5AnalysisToReport(block)
    expect(report.drivers).toHaveLength(5)
    // Sorted descending by sensitivity, so top driver is fac_7
    expect(report.drivers[0].label).toBe('Factor 7')
    expect(report.drivers[0].polarity).toBe('up')
    expect(report.drivers[0].strength).toBe('high') // 0.8 >= 0.7
    expect(report.drivers[0].nodeId).toBe('fac_7')
  })

  it('confidence level "high" when robust:fragile edge ratio >= 0.7', () => {
    const block = baseBlock({
      enrichment: {
        robustness: {
          fragile_edges: ['e1'],
          robust_edges: ['e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10'],
        },
      },
    })

    const report = mapV5AnalysisToReport(block)
    expect(report.confidence.level).toBe('high')
    expect(report.confidence.why).toContain('1 fragile edge')
    expect(report.confidence.why).toContain('9 robust edges')
  })

  it('confidence level "low" when robust:fragile ratio < 0.3', () => {
    const block = baseBlock({
      enrichment: {
        robustness: {
          fragile_edges: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'],
          robust_edges: ['e9'],
        },
      },
    })

    const report = mapV5AnalysisToReport(block)
    expect(report.confidence.level).toBe('low')
  })

  it('confidence level "medium" with informative reason when only factors are present (no robustness)', () => {
    const block = baseBlock({
      enrichment: {
        factor_sensitivity: [
          { factor_id: 'fac_a', label: 'A', sensitivity: 0.4 },
        ],
      },
    })

    const report = mapV5AnalysisToReport(block)
    expect(report.confidence.level).toBe('medium')
    expect(report.confidence.why).toContain('1 sensitivity factor')
  })

  it('confidence fallback "Based on available data" when nothing present', () => {
    const block = baseBlock({})

    const report = mapV5AnalysisToReport(block)
    expect(report.confidence.level).toBe('medium')
    expect(report.confidence.why).toBe('Based on available data')
  })
})

describe('mapV5AnalysisToReport — robustness + flip_thresholds + edge_e_values passthrough', () => {
  it('robustness passes through fragile_edges, robust_edges, flip_thresholds, edge_e_values, ranking_stability', () => {
    const block = baseBlock({
      enrichment: {
        robustness: {
          fragile_edges: [{ edge_id: 'e1' }],
          robust_edges: ['e2'],
          ranking_stability: 0.85,
          recommendation_stability: 0.9,
          is_robust: true,
          level: 'high',
          recommended_option_id: 'opt_a',
          flip_thresholds: [{ factor_id: 'fac_a', flip_at: 0.5 }],
          edge_e_values: [{ edge_id: 'e1', e_value: 0.3 }],
        },
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      robustness?: Record<string, unknown>
    }
    expect(report.robustness).toBeDefined()
    expect(report.robustness!.fragile_edges).toEqual([{ edge_id: 'e1' }])
    expect(report.robustness!.robust_edges).toEqual(['e2'])
    expect(report.robustness!.ranking_stability).toBe(0.85)
    expect(report.robustness!.recommendation_stability).toBe(0.9)
    expect(report.robustness!.is_robust).toBe(true)
    expect(report.robustness!.level).toBe('high')
    expect(report.robustness!.recommended_option_id).toBe('opt_a')
    expect(report.robustness!.flip_thresholds).toEqual([{ factor_id: 'fac_a', flip_at: 0.5 }])
    expect(report.robustness!.edge_e_values).toEqual([{ edge_id: 'e1', e_value: 0.3 }])
  })

  it('top-level enrichment.flip_thresholds and enrichment.edge_e_values surface on the report', () => {
    const block = baseBlock({
      enrichment: {
        flip_thresholds: [{ factor_id: 'fac_top', flip_at: 0.42 }],
        edge_e_values: [{ edge_id: 'e_top', e_value: 0.71 }],
        conditional_probabilities: { 'opt_a': 0.7 },
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      flip_thresholds?: unknown[]
      edge_e_values?: unknown[]
      conditional_probabilities?: unknown
    }
    expect(report.flip_thresholds).toEqual([{ factor_id: 'fac_top', flip_at: 0.42 }])
    expect(report.edge_e_values).toEqual([{ edge_id: 'e_top', e_value: 0.71 }])
    expect(report.conditional_probabilities).toEqual({ 'opt_a': 0.7 })
  })

  it('robustness absent when enrichment.robustness is missing or non-object', () => {
    const block = baseBlock({ enrichment: {} })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      robustness?: unknown
    }
    expect(report.robustness).toBeUndefined()
  })
})

describe('mapV5AnalysisToReport — enrichment.option_comparison hydrates outcome/CI fields', () => {
  it('outcome.mean/p10/p50/p90 flow from enrichment.option_comparison entries when present', () => {
    const block = baseBlock({
      win_probabilities: { opt_a: 0.6 },
      enrichment: {
        option_comparison: [
          {
            option_id: 'opt_a',
            outcome: { mean: 12.5, p10: 8.0, p50: 12.0, p90: 17.0 },
            confidence_interval: [9.0, 16.0],
            probability_of_goal: 0.55,
            expected_outcome: 12.5,
          },
        ],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, {
        win_probability?: number
        goal_probability?: number
        expected?: number
        outcome?: { mean?: number | null; p10?: number | null; p50?: number | null; p90?: number | null }
      }>
    }
    const opt = report.option_probabilities!.opt_a
    expect(opt.win_probability).toBe(0.6)
    expect(opt.goal_probability).toBe(0.55)
    expect(opt.expected).toBe(12.5)
    expect(opt.outcome).toEqual({ mean: 12.5, p10: 8.0, p50: 12.0, p90: 17.0 })
  })

  it('confidence_interval midpoint fills `expected` when outcome.mean is absent', () => {
    const block = baseBlock({
      win_probabilities: { opt_a: 0.5 },
      enrichment: {
        option_comparison: [
          { option_id: 'opt_a', confidence_interval: [10, 20] },
        ],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { expected?: number; outcome?: { p10?: number | null; p90?: number | null } }>
    }
    const opt = report.option_probabilities!.opt_a
    expect(opt.expected).toBe(15)
    expect(opt.outcome?.p10).toBe(10)
    expect(opt.outcome?.p90).toBe(20)
  })

  it('outcome quantiles are null (not 0) when enrichment has no option_comparison', () => {
    const block = baseBlock({
      win_probabilities: { opt_a: 0.5 },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { outcome?: { mean?: number | null; p10?: number | null; p50?: number | null; p90?: number | null } }>
    }
    const opt = report.option_probabilities!.opt_a
    expect(opt.outcome).toEqual({ mean: null, p10: null, p50: null, p90: null })
  })
})

describe('mapV5AnalysisToReport — real staging payload (label-keyed win_probabilities)', () => {
  // The fixture is a redacted excerpt of the actual staging envelope captured
  // 2026-04-30 / build 3bb151b. It encodes the specific shape that broke the
  // first-pass mapper: win_probabilities keyed by option labels rather than
  // option IDs. Without enrichment.option_comparison lookup, the Results
  // panel would silently miss every entry.
  const block = realStagingFixture.blocks[0] as AnalysisResultBlock

  it('option_probabilities is keyed by canonical option_id (not by win_probabilities label-keys)', () => {
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { win_probability?: number }>
    }
    const keys = Object.keys(report.option_probabilities ?? {}).sort()
    // Real option_ids from enrichment.option_comparison, NOT the human labels
    // (e.g. "Hire Two Senior Engineers Locally") that win_probabilities uses
    // as keys.
    expect(keys).toEqual(['opt_hire_local', 'opt_offshore', 'opt_status_quo', 'opt_tiered_pricing'])
    // No label-keyed entries leaked through.
    expect(report.option_probabilities!['Hire Two Senior Engineers Locally']).toBeUndefined()
  })

  it('win_probability resolves correctly from label-keyed win_probabilities via option_comparison.option_label', () => {
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { win_probability?: number }>
    }
    // Exact values from the captured staging response — NOT rounded, NOT
    // approximated. This is the field the Results panel reads at
    // useResultsSectionData.ts:1146 (`prob.win_probability`).
    expect(report.option_probabilities!.opt_hire_local.win_probability).toBe(0.7193333333333334)
    expect(report.option_probabilities!.opt_offshore.win_probability).toBe(0.054)
    expect(report.option_probabilities!.opt_status_quo.win_probability).toBe(0.22533333333333333)
    expect(report.option_probabilities!.opt_tiered_pricing.win_probability).toBe(0.0013333333333333333)
  })

  it('outcome quantiles flow through from enrichment.option_comparison[*].outcome (real staging shape)', () => {
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, {
        outcome?: { mean?: number | null; p10?: number | null; p50?: number | null; p90?: number | null }
      }>
    }
    const winner = report.option_probabilities!.opt_hire_local
    // Real staging outcome values — preserved exactly.
    expect(winner.outcome).toEqual({
      mean: 0.23738816930471338,
      p10: -0.032343256259984,
      p50: 0.25567048396546965,
      p90: 0.4781610864397162,
    })
  })

  it('factor_sensitivity passes through with real {factor_id, factor_label, sensitivity_score, direction, importance_rank}', () => {
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      factor_sensitivity?: Array<{ factor_id: string; factor_label: string; sensitivity: number; direction: string }>
    }
    expect(report.factor_sensitivity).toBeDefined()
    // Sorted by absolute sensitivity descending — top driver is Engineering Capacity.
    expect(report.factor_sensitivity![0].factor_id).toBe('fac_eng_capacity')
    expect(report.factor_sensitivity![0].factor_label).toBe('Engineering Capacity')
    expect(report.factor_sensitivity![0].sensitivity).toBe(0.43249999999999994)
    expect(report.factor_sensitivity![0].direction).toBe('positive')
  })

  it('confidence level derives from real robustness fragile/robust edge ratio', () => {
    const report = mapV5AnalysisToReport(block)
    // Real staging: 9 fragile vs 1 robust → ratio 0.1 → level 'low'.
    expect(report.confidence.level).toBe('low')
    expect(report.confidence.why).toContain('fragile edge')
    expect(report.confidence.why).toContain('robust edge')
  })

  it('leading_option_id is preserved verbatim (proper ID form, never relabelled)', () => {
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      leading_option_id?: string
    }
    expect(report.leading_option_id).toBe('opt_hire_local')
  })

  it('robustness.recommended_option_id passes through', () => {
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      robustness?: { recommended_option_id?: string; recommendation_stability?: number }
    }
    expect(report.robustness?.recommended_option_id).toBe('opt_hire_local')
    expect(report.robustness?.recommendation_stability).toBe(0.7193333333333334)
  })
})

describe('mapV5AnalysisToReport — option_comparison passthrough for the inspector OutcomePanel', () => {
  // OutcomePanel.OptionComparisonSection at
  // src/canvas/ui/inspector-v2/panels/OutcomePanel.tsx:70 reads
  // `report.option_comparison[]` directly. The V4 mapper never populated
  // this; the V5 enrichment carries it byte-for-byte from PLoT so the V5
  // path passes it through. Tests below pin the inspector-consumed shape
  // (option_id + option_label + win_probability + outcome.{mean,p10,p50,p90})
  // so a downstream reshape would fail loudly.

  it('passes through option_comparison entries keyed by option_id with the OutcomePanel-consumed fields', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 0.6, opt_b: 0.4 },
      enrichment: {
        option_comparison: [
          {
            id: 'opt_a',
            option_id: 'opt_a',
            option_label: 'Option A',
            win_probability: 0.6,
            outcome: { mean: 12.5, p10: 8, p50: 12, p90: 17 },
          },
          {
            id: 'opt_b',
            option_id: 'opt_b',
            option_label: 'Option B',
            win_probability: 0.4,
            outcome: { mean: 8, p10: 4, p50: 7.5, p90: 12 },
          },
        ],
      },
    }
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_comparison?: Array<{
        option_id: string
        option_label?: string
        win_probability?: number
        outcome?: { mean?: number | null; p10?: number | null; p50?: number | null; p90?: number | null }
      }>
    }
    expect(report.option_comparison).toBeDefined()
    expect(report.option_comparison).toHaveLength(2)

    const optA = report.option_comparison!.find((o) => o.option_id === 'opt_a')!
    expect(optA.option_label).toBe('Option A')
    expect(optA.win_probability).toBe(0.6)
    expect(optA.outcome).toEqual({ mean: 12.5, p10: 8, p50: 12, p90: 17 })

    const optB = report.option_comparison!.find((o) => o.option_id === 'opt_b')!
    expect(optB.win_probability).toBe(0.4)
  })

  it('option_comparison_status passes through from enrichment when present', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 1 },
      enrichment: {
        option_comparison: [{ id: 'opt_a', option_id: 'opt_a', option_label: 'A', win_probability: 1 }],
        option_comparison_status: 'computed',
      },
    }
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_comparison_status?: string
    }
    expect(report.option_comparison_status).toBe('computed')
  })

  it('option_comparison omitted from report when enrichment lacks it (honest miss, no synthetic rows)', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: null,
      win_probabilities: { opt_a: 0.5 },
      enrichment: {}, // no option_comparison
    }
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_comparison?: unknown
    }
    expect(report.option_comparison).toBeUndefined()
  })

  it('option_comparison entries with no outcome data omit the outcome field rather than emit null-filled placeholder', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 0.7 },
      enrichment: {
        option_comparison: [
          { id: 'opt_a', option_id: 'opt_a', option_label: 'A', win_probability: 0.7 },
        ],
      },
    }
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_comparison?: Array<{ option_id: string; outcome?: unknown }>
    }
    expect(report.option_comparison![0].outcome).toBeUndefined()
  })

  it('real staging fixture produces option_comparison with all 4 options and exact win_probabilities', () => {
    const block = realStagingFixture.blocks[0] as AnalysisResultBlock
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_comparison?: Array<{ option_id: string; win_probability?: number }>
    }
    expect(report.option_comparison).toBeDefined()
    expect(report.option_comparison).toHaveLength(4)
    const byId = new Map(report.option_comparison!.map((o) => [o.option_id, o]))
    expect(byId.get('opt_hire_local')?.win_probability).toBe(0.7193333333333334)
    expect(byId.get('opt_offshore')?.win_probability).toBe(0.054)
    expect(byId.get('opt_status_quo')?.win_probability).toBe(0.22533333333333333)
    expect(byId.get('opt_tiered_pricing')?.win_probability).toBe(0.0013333333333333333)
  })
})

describe('mapV5AnalysisToReport — duplicate-label edge case', () => {
  // The reviewer flagged: when block.win_probabilities is keyed by labels
  // (real staging behaviour) AND two options happen to share a label,
  // the label-keyed Record cannot distinguish them. The mapper must
  // handle this correctly in path A (option_comparison present) — each
  // option_comparison entry has its own win_probability, so duplicate
  // labels are not ambiguous — and document the limitation in path B
  // (option_comparison absent).

  it('path A: duplicate option_labels disambiguate correctly because option_comparison carries per-option win_probability', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: 'opt_a1',
      // Block-level win_probabilities is label-keyed (real-staging shape)
      // and two options share the SAME label — collision is unavoidable
      // at this level.
      win_probabilities: { 'Hire Locally': 0.6 },
      enrichment: {
        option_comparison: [
          // Each option_comparison entry carries its own canonical win_probability
          { id: 'opt_a1', option_id: 'opt_a1', option_label: 'Hire Locally', win_probability: 0.6 },
          { id: 'opt_a2', option_id: 'opt_a2', option_label: 'Hire Locally', win_probability: 0.3 },
        ],
      },
    }
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { win_probability?: number }>
    }
    // option_comparison.win_probability takes precedence over the
    // label-keyed block.win_probabilities, so the two duplicate-label
    // options retain distinct probabilities.
    expect(report.option_probabilities!.opt_a1.win_probability).toBe(0.6)
    expect(report.option_probabilities!.opt_a2.win_probability).toBe(0.3)
  })

  it('path A degraded: when option_comparison entries lack win_probability AND two share the same label, BOTH omit win_probability (no false precision)', () => {
    // The genuine edge case: option_comparison present but entries omit
    // win_probability, AND two options share an option_label.
    //
    // The label-keyed block.win_probabilities Record cannot disambiguate
    // two options that share a label. Earlier drafts of this mapper let
    // BOTH options fall through to block.win_probabilities[label] and
    // each receive the same value — false precision from ambiguous data.
    //
    // The mapper now detects label duplication among option_comparison
    // entries and skips the label-keyed fallback for any duplicated
    // label. The two options surface with NO win_probability, which is
    // the honest representation: "we cannot tell which option this
    // 0.6 belongs to". Backend should populate
    // option_comparison.win_probability per option when this
    // configuration is possible.
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: 'opt_a1',
      win_probabilities: { 'Hire Locally': 0.6 },
      enrichment: {
        option_comparison: [
          // No win_probability on either entry
          { id: 'opt_a1', option_id: 'opt_a1', option_label: 'Hire Locally' },
          { id: 'opt_a2', option_id: 'opt_a2', option_label: 'Hire Locally' },
        ],
      },
    }
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { win_probability?: number }>
    }
    // Both option entries exist but win_probability is omitted on each.
    expect(report.option_probabilities!.opt_a1).toBeDefined()
    expect(report.option_probabilities!.opt_a2).toBeDefined()
    expect(report.option_probabilities!.opt_a1.win_probability).toBeUndefined()
    expect(report.option_probabilities!.opt_a2.win_probability).toBeUndefined()
  })

  it('path A mixed: when one duplicate-label entry has its own win_probability and the other does not, only the explicit one renders', () => {
    // Regression guard for the duplicate-label fix. A per-entry
    // win_probability is canonical and trumps the duplicate-label
    // ambiguity check; the entry that lacks one must still omit.
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: 'opt_a1',
      win_probabilities: { 'Hire Locally': 0.6 },
      enrichment: {
        option_comparison: [
          { id: 'opt_a1', option_id: 'opt_a1', option_label: 'Hire Locally', win_probability: 0.55 },
          { id: 'opt_a2', option_id: 'opt_a2', option_label: 'Hire Locally' /* no win_probability */ },
        ],
      },
    }
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { win_probability?: number }>
      option_comparison?: Array<{ option_id: string; win_probability?: number }>
    }
    // Explicit entry: uses its own canonical value.
    expect(report.option_probabilities!.opt_a1.win_probability).toBe(0.55)
    // Ambiguous-label entry: omitted, not silently set to 0.6.
    expect(report.option_probabilities!.opt_a2.win_probability).toBeUndefined()

    // Same guarantee applies to the inspector OutcomePanel passthrough.
    const ocByOptId = new Map(
      report.option_comparison!.map((o) => [o.option_id, o]),
    )
    expect(ocByOptId.get('opt_a1')?.win_probability).toBe(0.55)
    expect(ocByOptId.get('opt_a2')?.win_probability).toBeUndefined()
  })

  it('path B: option_comparison absent AND label-keyed win_probabilities — labels survive as Record keys with no disambiguation (Results panel honestly misses by node.id)', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: null,
      // Label-keyed win_probabilities, no enrichment to resolve.
      win_probabilities: { 'Hire Locally': 0.6 },
      enrichment: {},
    }
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { win_probability?: number }>
    }
    // Path B emits verbatim. No id-keyed entry exists — the selector
    // lookup `optionProbs[node.id]` honestly misses rather than
    // mismatching against the wrong canvas node.
    expect(Object.keys(report.option_probabilities!).sort()).toEqual(['Hire Locally'])
    expect(report.option_probabilities!['Hire Locally'].win_probability).toBe(0.6)
    expect(report.option_probabilities!.opt_anything).toBeUndefined()
  })
})

describe('mapV5AnalysisToReport — label-keyed resolution unit cases', () => {
  it('win_probabilities keyed by labels: option_comparison.option_label resolves to canonical option_id', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: 'A leads',
      leading_option_id: 'opt_a',
      // Real-staging behaviour: keyed by label, not by ID.
      win_probabilities: {
        'Option A — full name': 0.6,
        'Option B — full name': 0.4,
      },
      enrichment: {
        option_comparison: [
          { id: 'opt_a', option_id: 'opt_a', option_label: 'Option A — full name' },
          { id: 'opt_b', option_id: 'opt_b', option_label: 'Option B — full name' },
        ],
      },
    }
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { win_probability?: number }>
    }
    expect(Object.keys(report.option_probabilities!).sort()).toEqual(['opt_a', 'opt_b'])
    expect(report.option_probabilities!.opt_a.win_probability).toBe(0.6)
    expect(report.option_probabilities!.opt_b.win_probability).toBe(0.4)
    // No label-keyed leakage:
    expect(report.option_probabilities!['Option A — full name']).toBeUndefined()
  })

  it('option_comparison.win_probability takes precedence over block.win_probabilities mismatches', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: 'opt_a',
      // Conflict: block says 0.5, enrichment says 0.7 — enrichment is canonical.
      win_probabilities: { 'opt_a': 0.5 },
      enrichment: {
        option_comparison: [
          { id: 'opt_a', option_id: 'opt_a', option_label: 'A', win_probability: 0.7 },
        ],
      },
    }
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { win_probability?: number }>
    }
    expect(report.option_probabilities!.opt_a.win_probability).toBe(0.7)
  })

  it('no option_comparison: emits verbatim keys (best-effort, honest miss when keys are labels)', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: null,
      win_probabilities: { opt_a: 0.5, opt_b: 0.5 },
      // No option_comparison in enrichment.
      enrichment: {},
    }
    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<string, { win_probability?: number }>
    }
    expect(Object.keys(report.option_probabilities!).sort()).toEqual(['opt_a', 'opt_b'])
  })
})

describe('mapV5AnalysisToReport — headline results (conservative/likely/optimistic) derive from leading option, never fabricated 0', () => {
  // Regression guard: report.results.{conservative,likely,optimistic} is
  // consumed by DetailedAnalysisSection, DecisionSummary, OutcomesSignal,
  // TemplatesPanel as the headline p10/p50/p90. Earlier draft hardcoded
  // these to 0, which would render as "0" in every consumer instead of
  // "no data". The mapper now derives from the LEADING option's outcome
  // (or first option if no leader), with null when no usable data exists.

  it('headline results derive from leading option_comparison outcome quantiles', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 0.7, opt_b: 0.3 },
      enrichment: {
        option_comparison: [
          { id: 'opt_a', option_id: 'opt_a', option_label: 'A', outcome: { mean: 12.5, p10: 8, p50: 12, p90: 17 } },
          { id: 'opt_b', option_id: 'opt_b', option_label: 'B', outcome: { mean: 7, p10: 3, p50: 6.5, p90: 11 } },
        ],
      },
    }
    const report = mapV5AnalysisToReport(block)
    // Pulled from opt_a (leading) outcome — NOT from opt_b, NOT zeros.
    expect(report.results.conservative).toBe(8)
    expect(report.results.likely).toBe(12)
    expect(report.results.optimistic).toBe(17)
  })

  it('headline results fall back to first option_comparison entry when leading_option_id does not match any entry', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: 'opt_phantom', // not in option_comparison
      win_probabilities: { opt_a: 0.6 },
      enrichment: {
        option_comparison: [
          { id: 'opt_a', option_id: 'opt_a', option_label: 'A', outcome: { p10: 1, p50: 2, p90: 3 } },
        ],
      },
    }
    const report = mapV5AnalysisToReport(block)
    expect(report.results.conservative).toBe(1)
    expect(report.results.likely).toBe(2)
    expect(report.results.optimistic).toBe(3)
  })

  it('headline results derive from confidence_interval when outcome is absent', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 1 },
      enrichment: {
        option_comparison: [
          { id: 'opt_a', option_id: 'opt_a', option_label: 'A', confidence_interval: [10, 20] },
        ],
      },
    }
    const report = mapV5AnalysisToReport(block)
    expect(report.results.conservative).toBe(10)
    expect(report.results.likely).toBe(15) // CI midpoint
    expect(report.results.optimistic).toBe(20)
  })

  it('headline results are null (not 0) when no option_comparison entry has outcome or CI data', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 1 },
      enrichment: {
        option_comparison: [
          { id: 'opt_a', option_id: 'opt_a', option_label: 'A' /* no outcome, no CI */ },
        ],
      },
    }
    const report = mapV5AnalysisToReport(block)
    // Type-lie tolerated for V4 parity; runtime value is null, NOT 0.
    expect(report.results.conservative).toBeNull()
    expect(report.results.likely).toBeNull()
    expect(report.results.optimistic).toBeNull()
  })

  it('headline results are null (not 0) when enrichment has no option_comparison at all', () => {
    const block: AnalysisResultBlock = {
      type: 'analysis_result',
      summary: '',
      leading_option_id: null,
      win_probabilities: { opt_a: 0.5 },
      enrichment: {},
    }
    const report = mapV5AnalysisToReport(block)
    expect(report.results.conservative).toBeNull()
    expect(report.results.likely).toBeNull()
    expect(report.results.optimistic).toBeNull()
  })

  it('real staging fixture: headline results pull from opt_hire_local (the leader) outcome', () => {
    const block = realStagingFixture.blocks[0] as AnalysisResultBlock
    const report = mapV5AnalysisToReport(block)
    // Exact values from the staging fixture's opt_hire_local.outcome:
    //   p10: -0.032343256259984, p50: 0.25567048396546965, p90: 0.4781610864397162
    expect(report.results.conservative).toBe(-0.032343256259984)
    expect(report.results.likely).toBe(0.25567048396546965)
    expect(report.results.optimistic).toBe(0.4781610864397162)
  })
})

describe('mapV5AnalysisToReport — deterministic hash + minimal envelope', () => {
  it('returns a valid minimal ReportV1 when block carries only summary + leading_option_id', () => {
    const block = baseBlock({ leading_option_id: 'opt_a' })

    const report = mapV5AnalysisToReport(block)
    expect(report.schema).toBe('report.v1')
    expect(report.meta.seed).toBe(0)
    expect(report.meta.response_id).toMatch(/^v5:[0-9a-f]{16}$/)
    expect(report.model_card.response_hash).toBe(report.meta.response_id)
    expect(report.confidence.level).toBe('medium')
    expect(report.drivers).toEqual([])
  })

  it('identical block content produces identical hash (dedupe contract)', () => {
    const blockA = baseBlock({ win_probabilities: { opt_a: 0.6, opt_b: 0.4 } })
    const blockB = baseBlock({ win_probabilities: { opt_b: 0.4, opt_a: 0.6 } }) // different key order

    const reportA = mapV5AnalysisToReport(blockA)
    const reportB = mapV5AnalysisToReport(blockB)
    expect(reportA.model_card.response_hash).toBe(reportB.model_card.response_hash)
  })

  it('different block content produces different hash', () => {
    const blockA = baseBlock({ summary: 'A leads' })
    const blockB = baseBlock({ summary: 'B leads' })

    const reportA = mapV5AnalysisToReport(blockA)
    const reportB = mapV5AnalysisToReport(blockB)
    expect(reportA.model_card.response_hash).not.toBe(reportB.model_card.response_hash)
  })

  it('enrichment delta produces a different hash even when summary/leading/win_probabilities are identical (dedupe regression guard)', () => {
    // Regression guard for the dedupe hole the brief codex review flagged:
    // the same summary + leading + win_probabilities with changed
    // factor_sensitivity / robustness must NOT be deduped away — the
    // Results panel needs to re-hydrate when enrichment changes.
    const blockA = baseBlock({
      win_probabilities: { opt_a: 0.6, opt_b: 0.4 },
      enrichment: {
        factor_sensitivity: [
          { factor_id: 'fac_x', label: 'X', sensitivity: 0.3 },
        ],
      },
    })
    const blockB = baseBlock({
      win_probabilities: { opt_a: 0.6, opt_b: 0.4 },
      enrichment: {
        factor_sensitivity: [
          { factor_id: 'fac_x', label: 'X', sensitivity: 0.9 }, // changed magnitude
        ],
      },
    })

    const reportA = mapV5AnalysisToReport(blockA)
    const reportB = mapV5AnalysisToReport(blockB)
    expect(reportA.model_card.response_hash).not.toBe(reportB.model_card.response_hash)
  })

  it('enrichment with re-ordered keys produces the SAME hash (stable canonical serialisation)', () => {
    // Counterpart to the previous test: incidental object-key reordering
    // must not invalidate dedupe (otherwise the same response received
    // twice would double-hydrate).
    const blockA = baseBlock({
      enrichment: {
        factor_sensitivity: [{ factor_id: 'fac_x', label: 'X', sensitivity: 0.3 }],
        robustness: { fragile_edges: ['e1'], robust_edges: ['e2'] },
      },
    })
    const blockB = baseBlock({
      enrichment: {
        // Same content, different top-level key order
        robustness: { robust_edges: ['e2'], fragile_edges: ['e1'] },
        factor_sensitivity: [{ label: 'X', sensitivity: 0.3, factor_id: 'fac_x' }],
      },
    })

    const reportA = mapV5AnalysisToReport(blockA)
    const reportB = mapV5AnalysisToReport(blockB)
    expect(reportA.model_card.response_hash).toBe(reportB.model_card.response_hash)
  })

  it('caller-provided responseHash overrides derived hash', () => {
    const block = baseBlock({})

    const report = mapV5AnalysisToReport(block, { responseHash: 'caller-hash-123' })
    expect(report.model_card.response_hash).toBe('caller-hash-123')
    expect(report.meta.response_id).toBe('caller-hash-123')
  })

  it('seed flows through to report.meta.seed', () => {
    const block = baseBlock({})

    const report = mapV5AnalysisToReport(block, { seed: 42 })
    expect(report.meta.seed).toBe(42)
  })
})

// ROADMAP 1.6b (claim-integrity, shared-seam UI lane): display_verdict,
// display_verdict_reason, confidence_tier, and goal_fit_basis are all
// ON-WIRE on Seam A (CEE compose.ts P0B_SAFE_TRANSPORT_ENRICHMENT_KEEP
// carries `robustness` and `confidence_tier` whole) but were previously
// never read by this mapper — the live conversational path showed
// "Robustness unknown" / the legacy confidence cascade / no goal-fit
// caveat regardless of what the producer sent. UI-BOUNDARY-DATA-INVENTORY.md
// §3.4/§3.5/§3.2/§4.
describe('mapV5AnalysisToReport — display_verdict / confidence_tier / goal_fit_basis (ROADMAP 1.6b)', () => {
  it('a live-shaped fixture carrying all four fields survives the mapper verbatim', () => {
    const block = baseBlock({
      win_probabilities: { opt_a: 0.6, opt_b: 0.4 },
      enrichment: {
        confidence_tier: 'fair',
        robustness: {
          fragile_edges: [],
          robust_edges: [],
          is_robust: true,
          level: 'high',
          display_verdict: 'robust',
          display_verdict_reason: 'No edge flips the winner within the tested range.',
        },
        option_comparison: [
          {
            option_id: 'opt_a',
            win_probability: 0.6,
            probability_of_joint_goal: 0.42,
            goal_fit_basis: {
              scored_from: 'modelled_outcome_distribution',
              node_ids: ['node_budget'],
            },
          },
          { option_id: 'opt_b', win_probability: 0.4 },
        ],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      confidence_tier?: string
      robustness?: { display_verdict?: string; display_verdict_reason?: string }
      option_probabilities?: Record<
        string,
        { goal_fit_basis?: { scored_from?: string; node_ids?: string[] } }
      >
    }

    expect(report.confidence_tier).toBe('fair')
    expect(report.robustness?.display_verdict).toBe('robust')
    expect(report.robustness?.display_verdict_reason).toBe(
      'No edge flips the winner within the tested range.',
    )
    expect(report.option_probabilities?.opt_a?.goal_fit_basis).toEqual({
      scored_from: 'modelled_outcome_distribution',
      node_ids: ['node_budget'],
    })
    // The unqualified option must NOT acquire a fabricated caveat.
    expect(report.option_probabilities?.opt_b?.goal_fit_basis).toBeUndefined()
  })

  it('a fixture WITHOUT the four fields produces honest absence — no invention, no crash', () => {
    const block = baseBlock({
      win_probabilities: { opt_a: 1 },
      enrichment: {
        robustness: { fragile_edges: [], robust_edges: [] },
        option_comparison: [{ option_id: 'opt_a', win_probability: 1 }],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      confidence_tier?: string
      robustness?: { display_verdict?: string; display_verdict_reason?: string }
      option_probabilities?: Record<string, { goal_fit_basis?: unknown }>
    }

    expect(report.confidence_tier).toBeUndefined()
    expect(report.robustness?.display_verdict).toBeUndefined()
    expect(report.robustness?.display_verdict_reason).toBeUndefined()
    expect(report.option_probabilities?.opt_a?.goal_fit_basis).toBeUndefined()
  })

  it('non-string display_verdict / confidence_tier values are dropped, not coerced', () => {
    const block = baseBlock({
      enrichment: {
        confidence_tier: 42,
        robustness: { fragile_edges: [], robust_edges: [], display_verdict: null },
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      confidence_tier?: string
      robustness?: { display_verdict?: string }
    }

    expect(report.confidence_tier).toBeUndefined()
    expect(report.robustness?.display_verdict).toBeUndefined()
  })

  it('goal_fit_basis with only scored_from (no node_ids) is preserved partially, not dropped wholesale', () => {
    const block = baseBlock({
      enrichment: {
        option_comparison: [
          {
            option_id: 'opt_a',
            probability_of_joint_goal: 0.1,
            goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
          },
        ],
      },
    })

    const report = mapV5AnalysisToReport(block) as ReturnType<typeof mapV5AnalysisToReport> & {
      option_probabilities?: Record<
        string,
        { goal_fit_basis?: { scored_from?: string; node_ids?: string[] } }
      >
    }

    expect(report.option_probabilities?.opt_a?.goal_fit_basis).toEqual({
      scored_from: 'modelled_outcome_distribution',
    })
  })

  it('constraints_status: forward-compatible passthrough when present, absent by default (NOT on CEE keep-list today)', () => {
    // Documents the residual: CEE's compose.ts P0B_SAFE_TRANSPORT_ENRICHMENT_KEEP
    // does not include constraints_status, so a real Seam-A payload never
    // carries it — this fixture simulates a FUTURE keep-list extension to
    // prove the mapper is ready without overclaiming today's wire shape.
    const withStatus = mapV5AnalysisToReport(
      baseBlock({ enrichment: { constraints_status: 'unavailable' } }),
    ) as ReturnType<typeof mapV5AnalysisToReport> & { constraints_status?: string }
    expect(withStatus.constraints_status).toBe('unavailable')

    const withoutStatus = mapV5AnalysisToReport(
      baseBlock({ enrichment: { robustness: { fragile_edges: [], robust_edges: [] } } }),
    ) as ReturnType<typeof mapV5AnalysisToReport> & { constraints_status?: string }
    expect(withoutStatus.constraints_status).toBeUndefined()
  })
})
