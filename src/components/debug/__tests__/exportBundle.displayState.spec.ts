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
// The exporter previously read win_probability and factor_sensitivity from
// `state.results.apiResponse.*` — a field that never resolved in production
// (apiResponse lives on useComparisonStore, not on canvas-store results).
// PR #141 fixes the read path by sourcing from `state.rawV2Response.*` (the
// canonical wire response at canvas-store root, populated by `resultsComplete`)
// primary, with `state.results.report.option_probabilities` (the V5
// mapper-synthesised keyed map) as the report fallback for runs where
// rawV2Response is null (e.g. historical Supabase-hydrated runs).
//
// Factor sensitivity is read from `rawV2Response.factor_sensitivity` only:
// `report.factor_sensitivity` is the V5 mapper-narrowed shape that drops
// `influence_score`/`sensitivity_score` per-field, so report-only fallback
// stays honest-miss (`unmatched`) rather than fabricating values.
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

  it('V5 happy path: rendered_options[*].win_probability_source === results.report.option_probabilities.win_probability (report fallback when rawV2Response is null)', async () => {
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
      'results.report.option_probabilities.win_probability',
    )
    expect(byId.get('opt_offshore')?.win_probability_displayed).toBe(0.054)
    expect(byId.get('opt_offshore')?.win_probability_source).toBe(
      'results.report.option_probabilities.win_probability',
    )
    // No more "unmatched" on V5 turns.
    for (const row of result.rendered_options!) {
      expect(row.win_probability_source).not.toBe('unmatched')
    }
  })

  it('rawV2Response + report simultaneous: rawV2Response.option_comparison wins (canonical wire is primary)', async () => {
    mockState = {
      ceeAnalysisReady: { status: 'ready' },
      graphEditedSinceLastRun: false,
      nodes: [
        { id: 'opt_a', data: { label: 'A', kind: 'option', type: 'option' } },
      ],
      edges: [],
      // Canonical wire at canvas-store root — the primary read path.
      rawV2Response: {
        option_comparison: [{ option_id: 'opt_a', option_label: 'A', win_probability: 0.4 }],
      },
      results: {
        status: 'complete',
        report: {
          // Report carries a conflicting value — wire wins because it
          // appears first in resolveOption()'s chain.
          option_probabilities: { opt_a: { win_probability: 0.7, confidence: 0.5 } },
        },
      },
    }
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    const row = result.rendered_options!.find((r) => r.id === 'opt_a')
    expect(row?.win_probability_displayed).toBe(0.4) // wire, not report
    expect(row?.win_probability_source).toBe(
      'payloads.plot_response.option_comparison.win_probability',
    )
  })

  it('rawV2Response.option_comparison only (wire path): source is canonical option_comparison', async () => {
    mockState = {
      ceeAnalysisReady: { status: 'ready' },
      graphEditedSinceLastRun: false,
      nodes: [
        { id: 'opt_a', data: { label: 'A', kind: 'option', type: 'option' } },
      ],
      edges: [],
      // Wire-only — the canonical PLoT response surface.
      rawV2Response: {
        option_comparison: [{ option_id: 'opt_a', option_label: 'A', win_probability: 0.4 }],
      },
      results: {
        status: 'complete',
        report: {},
      },
    }
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    const row = result.rendered_options!.find((r) => r.id === 'opt_a')
    expect(row?.win_probability_displayed).toBe(0.4)
    expect(row?.win_probability_source).toBe(
      'payloads.plot_response.option_comparison.win_probability',
    )
  })

  it('report.factor_sensitivity without rawV2Response: honest-miss (V5 mapper drops influence_score/sensitivity_score)', async () => {
    // The V5 mapper narrows report.factor_sensitivity to
    // {factor_id, factor_label, sensitivity, direction} — without the
    // per-field `influence_score`/`sensitivity_score` keys that the bundle
    // surface advertises. Reading from this report shape would either
    // silently miss the metrics the factor card displays (V5 mapper drops
    // them) or fabricate a misleading provenance label. PR #141's design
    // chooses honest-miss: when rawV2Response.factor_sensitivity is absent,
    // both influence_source and sensitivity_source stay `unmatched`.
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
    // Honest-miss under PR #141's design — no rawV2Response means no wire
    // factor_sensitivity to read, and report.factor_sensitivity is
    // deliberately NOT a fallback because the V5 mapper narrows the shape.
    expect(row.sensitivity_displayed).toBeNull()
    expect(row.sensitivity_source).toBe('unmatched')
    expect(row.influence_displayed).toBeNull()
    expect(row.influence_source).toBe('unmatched')
  })

  it('staging fixture shape (report-only fallback): all options surface numeric win_probability via report; factor stays honest-miss', async () => {
    // Mirrors a Supabase-hydrated staging shape where rawV2Response is null
    // (historical runs and Supabase hydration explicitly clear it — see
    // canvas/store.ts:2715, 2757) and only the mapper-synthesised report is
    // present. PR #141's design surfaces option win_probabilities via the
    // report fallback while keeping factor metrics honest-miss (the V5 mapper
    // drops influence_score/sensitivity_score from report.factor_sensitivity).
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

    // All four options surface numeric win_probability via the report fallback.
    expect(result.rendered_options).toHaveLength(4)
    for (const row of result.rendered_options!) {
      expect(typeof row.win_probability_displayed).toBe('number')
      expect(row.win_probability_source).toBe(
        'results.report.option_probabilities.win_probability',
      )
    }

    // Factor sensitivity stays honest-miss — see the dedicated test above
    // for the rationale (V5 mapper narrows report.factor_sensitivity).
    expect(result.rendered_factors).toHaveLength(1)
    const facRow = result.rendered_factors![0]
    expect(facRow.sensitivity_displayed).toBeNull()
    expect(facRow.sensitivity_source).toBe('unmatched')
  })
})
