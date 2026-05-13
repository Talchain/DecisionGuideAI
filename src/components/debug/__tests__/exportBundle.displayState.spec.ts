/**
 * exportBundle.displayState — covers the canonical analysis display fields
 * that captureDisplayState writes into debug bundles. The legacy fields
 * (`analysis_status_displayed`, `hero_headline_displayed`) are retained
 * for backwards-compatibility; the canonical fields (`analysis_display_state`,
 * `analysis_display_headline`) are the ones bundle consumers should migrate
 * to. Tests below pin the four-state mapping plus the exact bug-shape from
 * bundle bef4470b (28 Apr 2026).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface MockCanvasState {
  nodes: Array<{ id: string; data: Record<string, unknown> }>
  edges: Array<{ id: string }>
  results: {
    status: string
    report?: unknown
  } | null
  ceeAnalysisReady: { status?: string } | null
  graphEditedSinceLastRun: boolean
  showResultsPanel?: boolean
  showInspectorPanel?: boolean
  showDraftChat?: boolean
}

let mockState: MockCanvasState

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: {
    getState: () => mockState,
  },
}))

async function importCapture() {
  const mod = await import('../utils/exportBundle')
  return mod.captureDisplayState
}

function makeState(overrides: Partial<MockCanvasState> = {}): MockCanvasState {
  return {
    nodes: [],
    edges: [],
    results: { status: 'idle', report: null },
    ceeAnalysisReady: null,
    graphEditedSinceLastRun: false,
    ...overrides,
  }
}

describe('captureDisplayState — canonical analysis display fields', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('not_ready: empty state with no CEE response', async () => {
    mockState = makeState()
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('not_ready')
    expect(result.analysis_display_headline).toBe('Set up your model')
  })

  it('ready_to_analyse: CEE ready, no report', async () => {
    mockState = makeState({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'idle', report: null },
    })
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('ready_to_analyse')
    expect(result.analysis_display_headline).toBe('Ready to analyse')
  })

  it('complete: hasReport && !graphEditedSinceLastRun', async () => {
    mockState = makeState({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: { option_comparison: [] } },
      graphEditedSinceLastRun: false,
    })
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('complete')
    expect(result.analysis_display_headline).toBe('Analysis complete')
  })

  it('results_stale: hasReport && graphEditedSinceLastRun', async () => {
    mockState = makeState({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: { option_comparison: [] } },
      graphEditedSinceLastRun: true,
    })
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('results_stale')
    expect(result.analysis_display_headline).toBe('Results may be outdated')
  })

  // The exact pattern from bundle bef4470b: CEE says 'ready', the legacy
  // results.status enum value is still 'complete' from a previous run, but
  // the report has been cleared (hasReport=false). The canonical field MUST
  // report 'ready_to_analyse' and the canonical headline MUST NOT be
  // "Analysis complete". The legacy fields are allowed to keep their
  // existing (buggy) behaviour for backwards-compatibility.
  it('bug-shape: hasReport=false but resultsStatus=complete + CEE ready → ready_to_analyse, NOT complete', async () => {
    mockState = makeState({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: null },
      graphEditedSinceLastRun: false,
    })
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('ready_to_analyse')
    expect(result.analysis_display_headline).toBe('Ready to analyse')
    expect(result.analysis_display_headline).not.toBe('Analysis complete')
  })

  it('non-ready CEE statuses collapse to not_ready', async () => {
    for (const status of ['needs_encoding', 'needs_user_mapping', 'needs_user_input']) {
      mockState = makeState({ ceeAnalysisReady: { status } })
      const captureDisplayState = await importCapture()
      const result = await captureDisplayState()
      expect(result.analysis_display_state).toBe('not_ready')
      expect(result.analysis_display_headline).toBe('Set up your model')
    }
  })

  // Precedence assertion: a CEE-non-ready status MUST win over a prior
  // populated report. This is the "user deleted the goal after a run"
  // shape — the old report is meaningless and showing "Analysis complete"
  // would mislead the user into asking CEE about non-existent results.
  it('non-ready CEE with stored report → not_ready, NOT complete', async () => {
    mockState = makeState({
      ceeAnalysisReady: { status: 'needs_user_mapping' },
      results: { status: 'complete', report: { option_comparison: [] } },
      graphEditedSinceLastRun: false,
    })
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('not_ready')
    expect(result.analysis_display_headline).toBe('Set up your model')
  })

  it('legacy fields stay populated for backwards compatibility', async () => {
    mockState = makeState({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: { option_comparison: [] } },
    })
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    // Legacy: mirrors results.status enum verbatim
    expect(result.analysis_status_displayed).toBe('complete')
    // New: canonical 4-state mapping
    expect(result.analysis_display_state).toBe('complete')
  })
})

// V5-aware capture (added 2026-05-13, Phase 1 of V5 completion plan).
// The exporter previously read win_probability and factor_sensitivity ONLY
// from `state.results.apiResponse.*` (V4 / Comparison-mode shape). V5
// single-scenario `run_analysis` turns never populate `apiResponse`, so
// every V5 turn produced `win_probability_displayed: null` /
// `win_probability_source: "unmatched"` regardless of UI render state.
// Phase 1 adds `state.results.report.option_probabilities` and
// `state.results.report.factor_sensitivity` as the FIRST sources in
// resolveOption() and extractRenderedFactors() respectively, so V5 debug
// bundles carry numeric values matching what the user sees.
describe('captureDisplayState — V5-aware sources (Phase 1 of V5 completion plan)', () => {
  beforeEach(() => {
    mockState = {
      nodes: [],
      edges: [],
      results: { status: 'idle', report: null },
      ceeAnalysisReady: null,
      graphEditedSinceLastRun: false,
    }
  })

  it('V5 happy path: rendered_options[*].win_probability_source === state.results.report.option_probabilities.win_probability', async () => {
    mockState = {
      ceeAnalysisReady: { status: 'ready' },
      graphEditedSinceLastRun: false,
      // Two canvas option-nodes whose IDs match the V5 mapper's
      // option_probabilities keys (per applyDraftResult contract:
      // canvas node.id === backend option_id).
      nodes: [
        { id: 'opt_hire_local', data: { label: 'Hire Locally', kind: 'option', type: 'option' } },
        { id: 'opt_offshore', data: { label: 'Offshore', kind: 'option', type: 'option' } },
      ],
      edges: [],
      results: {
        status: 'complete',
        report: {
          schema: 'report.v1',
          option_probabilities: {
            opt_hire_local: { win_probability: 0.7193333333333334, confidence: 0.5 },
            opt_offshore: { win_probability: 0.054, confidence: 0.5 },
          },
        },
      },
    }
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.rendered_options).toHaveLength(2)
    const byId = new Map(result.rendered_options!.map((r) => [r.id, r]))
    // Exact value from staging — proves V5 source is read first AND that
    // numeric value flows through, not null/unmatched.
    expect(byId.get('opt_hire_local')?.win_probability_displayed).toBe(0.7193333333333334)
    expect(byId.get('opt_hire_local')?.win_probability_source).toBe(
      'state.results.report.option_probabilities.win_probability',
    )
    expect(byId.get('opt_offshore')?.win_probability_displayed).toBe(0.054)
    expect(byId.get('opt_offshore')?.win_probability_source).toBe(
      'state.results.report.option_probabilities.win_probability',
    )
    // No more "unmatched" on V5 turns.
    for (const row of result.rendered_options!) {
      expect(row.win_probability_source).not.toBe('unmatched')
    }
  })

  it('V5 + V4 simultaneous (Comparison-mode + V5 hydration): V5 source wins per the new ordering', async () => {
    mockState = {
      ceeAnalysisReady: { status: 'ready' },
      graphEditedSinceLastRun: false,
      nodes: [
        { id: 'opt_a', data: { label: 'A', kind: 'option', type: 'option' } },
      ],
      edges: [],
      results: {
        status: 'complete',
        report: {
          option_probabilities: { opt_a: { win_probability: 0.7, confidence: 0.5 } },
        },
        // V4 / Comparison-mode also present with a CONFLICTING value —
        // V5 source wins because it appears first in the chain.
        apiResponse: {
          option_comparison: [{ option_id: 'opt_a', option_label: 'A', win_probability: 0.4 }],
        },
      },
    }
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    const row = result.rendered_options!.find((r) => r.id === 'opt_a')
    expect(row?.win_probability_displayed).toBe(0.7) // V5, not V4
    expect(row?.win_probability_source).toBe(
      'state.results.report.option_probabilities.win_probability',
    )
  })

  it('V4-only regression guard (Comparison-mode users): no V5 hydration → falls back to apiResponse path unchanged', async () => {
    mockState = {
      ceeAnalysisReady: { status: 'ready' },
      graphEditedSinceLastRun: false,
      nodes: [
        { id: 'opt_a', data: { label: 'A', kind: 'option', type: 'option' } },
      ],
      edges: [],
      results: {
        status: 'complete',
        report: {
          // No option_probabilities — V5 path empty, V4 fallback expected.
        },
        apiResponse: {
          option_comparison: [{ option_id: 'opt_a', option_label: 'A', win_probability: 0.4 }],
        },
      },
    }
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    const row = result.rendered_options!.find((r) => r.id === 'opt_a')
    expect(row?.win_probability_displayed).toBe(0.4) // V4 fallback
    expect(row?.win_probability_source).toBe(
      'payloads.plot_response.option_comparison.win_probability',
    )
  })

  it('V5 factor_sensitivity flows into rendered_factors with the V5 source label', async () => {
    mockState = {
      ceeAnalysisReady: { status: 'ready' },
      graphEditedSinceLastRun: false,
      nodes: [
        { id: 'fac_eng_capacity', data: { label: 'Engineering Capacity', kind: 'factor', type: 'factor', observedState: { value: 80, unit: '%' } } },
      ],
      edges: [],
      results: {
        status: 'complete',
        report: {
          factor_sensitivity: [
            { factor_id: 'fac_eng_capacity', factor_label: 'Engineering Capacity', sensitivity: 0.4325, direction: 'positive' },
          ],
        },
      },
    }
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.rendered_factors).toHaveLength(1)
    const row = result.rendered_factors![0]
    expect(row.id).toBe('fac_eng_capacity')
    expect(row.factor_id).toBe('fac_eng_capacity')
    expect(row.label_displayed).toBe('Engineering Capacity')
    expect(row.value_displayed).toBe('80 %')
    // V5 source: sensitivity flows through with the V5 enum value.
    expect(row.sensitivity_displayed).toBe(0.4325)
    expect(row.sensitivity_source).toBe('state.results.report.factor_sensitivity.sensitivity')
    // Influence has no V5 analog yet — honest unmatched.
    expect(row.influence_displayed).toBeNull()
    expect(row.influence_source).toBe('unmatched')
  })

  it('staging fixture shape: full V5 envelope round-trips with all V5 sources, never unmatched', async () => {
    // Mirrors the captured staging fixture used by the wire-to-selector
    // test (`v5-analysis-result.staging-real-shape.json`). Asserts the
    // exporter no longer lies about V5 turns.
    mockState = {
      ceeAnalysisReady: { status: 'ready' },
      graphEditedSinceLastRun: false,
      nodes: [
        { id: 'opt_hire_local', data: { label: 'Hire Two Senior Engineers Locally', kind: 'option', type: 'option' } },
        { id: 'opt_offshore', data: { label: 'Engage Offshore Partner', kind: 'option', type: 'option' } },
        { id: 'opt_status_quo', data: { label: 'Maintain Current Team (Status Quo)', kind: 'option', type: 'option' } },
        { id: 'opt_tiered_pricing', data: { label: 'Introduce Tiered Pricing for Gradual Hiring', kind: 'option', type: 'option' } },
        { id: 'fac_eng_capacity', data: { label: 'Engineering Capacity', kind: 'factor', type: 'factor', observedState: { value: 1, unit: '' } } },
      ],
      edges: [],
      results: {
        status: 'complete',
        report: {
          option_probabilities: {
            opt_hire_local: { win_probability: 0.7193333333333334, confidence: 0.5 },
            opt_offshore: { win_probability: 0.054, confidence: 0.5 },
            opt_status_quo: { win_probability: 0.22533333333333333, confidence: 0.5 },
            opt_tiered_pricing: { win_probability: 0.0013333333333333333, confidence: 0.5 },
          },
          factor_sensitivity: [
            { factor_id: 'fac_eng_capacity', factor_label: 'Engineering Capacity', sensitivity: 0.43249999999999994, direction: 'positive' },
          ],
        },
      },
    }
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()

    // All four options have numeric win_probability_displayed AND V5 source.
    expect(result.rendered_options).toHaveLength(4)
    for (const row of result.rendered_options!) {
      expect(typeof row.win_probability_displayed).toBe('number')
      expect(row.win_probability_source).toBe(
        'state.results.report.option_probabilities.win_probability',
      )
    }

    // Factor sensitivity also flows.
    expect(result.rendered_factors).toHaveLength(1)
    const facRow = result.rendered_factors![0]
    expect(facRow.sensitivity_displayed).toBe(0.43249999999999994)
    expect(facRow.sensitivity_source).toBe('state.results.report.factor_sensitivity.sensitivity')
  })
})
