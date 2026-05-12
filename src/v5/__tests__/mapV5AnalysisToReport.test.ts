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
