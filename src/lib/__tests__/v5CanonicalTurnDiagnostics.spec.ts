/**
 * Tests for v5CanonicalTurnDiagnostics — the richer assembler that
 * composes (not replaces) the legacy classifier. Covers the brief's
 * required cases plus extractor helpers.
 */

import { describe, expect, it } from 'vitest'

import {
  assembleV5CanonicalTurnDiagnostics,
  attachAnalysisFactDetails,
  extractFactorSensitivityCountFromPlotResponse,
  extractOptionCountFromPlotResponse,
  type AssembleV5CanonicalTurnDiagnosticsInputs,
} from '../v5CanonicalTurnDiagnostics'
import type { V5CanonicalAnalysisDiagnostic, V5CeeCapture } from '../v5CanonicalAnalysisDiagnostics'
import type { ScenarioIdReconciliation } from '../scenarioIdReconciliation'

function makeCapture(overrides: Partial<V5CeeCapture> = {}): V5CeeCapture {
  return {
    request_id: 'req-x',
    scenario_id: 'sid-1',
    turn_id: null,
    endpoint: null,
    status: 200,
    duration_ms: 50,
    request_present: true,
    response_present: true,
    parse_ok: true,
    parse_error: null,
    response_top_level_keys: ['blocks'],
    raw_response_present: false,
    parse_failure_kind: null,
    unknown_block_types: null,
    has_additive_extensions: false,
    phase3_blocks_tolerated_count: 0,
    phase3_block_types: [],
    source: 'proxy_v5_turn',
    ...overrides,
  }
}

function makeLegacy(
  overrides: Partial<V5CanonicalAnalysisDiagnostic> = {},
): V5CanonicalAnalysisDiagnostic {
  return {
    v5_cee_capture: makeCapture(),
    analysis_state_source: 'cee_v5_run_analysis',
    analysis_fact_status: 'present',
    debug_capture_status: 'complete',
    canonical_flag_on: true,
    ...overrides,
  }
}

function makeReconciliation(): ScenarioIdReconciliation {
  return {
    selected_scenario_id: 'sid-1',
    selected_source: 'store',
    candidates: {
      store: 'sid-1',
      v5_fact: null,
      payload: null,
      url: null,
      full_graph: null,
    },
    conflicts: [],
  }
}

function defaults(): AssembleV5CanonicalTurnDiagnosticsInputs {
  return {
    legacyDiagnostic: makeLegacy(),
    flagDiagnostic: { resolved: true, source: 'env' },
    analysisStateSource: 'cee_v5_run_analysis',
    hasResultsReport: true,
    graphHashAtGeneration: null,
    optionCount: 0,
    factorSensitivityCount: 0,
    capturePipeline: {
      capture_pipeline_status: 'complete',
      coherence: { state: 'complete', issues: [] },
    },
    scenarioIdReconciliation: makeReconciliation(),
  }
}

describe('assembleV5CanonicalTurnDiagnostics — composition with legacy classifier', () => {
  it('emits canonical_flag_on, canonical_flag_source from inputs', () => {
    const out = assembleV5CanonicalTurnDiagnostics(defaults())
    expect(out.canonical_flag_on).toBe(true)
    expect(out.canonical_flag_source).toBe('env')
  })

  it('falls back to canonical_flag_source = "unknown" when flagDiagnostic is null', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      flagDiagnostic: null,
    })
    expect(out.canonical_flag_source).toBe('unknown')
  })

  it('latest_v5_turn mirrors the legacy capture fields', () => {
    const out = assembleV5CanonicalTurnDiagnostics(defaults())
    expect(out.latest_v5_turn).toEqual({
      request_present: true,
      response_present: true,
      status: 200,
    })
  })

  it('emits null fields when legacy capture is null', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({ v5_cee_capture: null }),
    })
    expect(out.latest_v5_turn.request_present).toBe(false)
    expect(out.parse.parse_ok).toBeNull()
    expect(out.analysis_fact.phase3_raw_block_count).toBe(0)
  })

  it('parse details surface from the legacy capture', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({
        v5_cee_capture: makeCapture({
          parse_ok: false,
          parse_error: 'boom',
          parse_failure_kind: 'schema_mismatch',
          raw_response_present: true,
          response_top_level_keys: ['kind', 'reason', 'raw'],
        }),
      }),
    })
    expect(out.parse.parse_ok).toBe(false)
    expect(out.parse.parse_error).toBe('boom')
    expect(out.parse.parse_failure_kind).toBe('schema_mismatch')
    expect(out.parse.raw_response_present).toBe(true)
    expect(out.parse.response_top_level_keys).toEqual(['kind', 'reason', 'raw'])
  })

  it('analysis_fact.present mirrors legacy analysis_fact_status', () => {
    const present = assembleV5CanonicalTurnDiagnostics(defaults()).analysis_fact.present
    expect(present).toBe(true)

    const missing = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({ analysis_fact_status: 'missing' }),
    }).analysis_fact.present
    expect(missing).toBe(false)
  })

  it('graph_hash_at_generation is null when input is null (read-through)', () => {
    const out = assembleV5CanonicalTurnDiagnostics(defaults())
    expect(out.analysis_fact.graph_hash_at_generation).toBeNull()
  })

  it('graph_hash_at_generation emits the slice value when present', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      graphHashAtGeneration: 'gh-abc123',
    })
    expect(out.analysis_fact.graph_hash_at_generation).toBe('gh-abc123')
  })

  it('phase3 block counts/types pass through from the capture', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({
        v5_cee_capture: makeCapture({
          phase3_blocks_tolerated_count: 3,
          phase3_block_types: ['coaching', 'evidence', 'review_card'],
        }),
      }),
    })
    expect(out.analysis_fact.phase3_raw_block_count).toBe(3)
    expect(out.analysis_fact.phase3_raw_block_types).toEqual([
      'coaching',
      'evidence',
      'review_card',
    ])
  })

  it('results.source uses the existing 5-value AnalysisStateSource enum', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      analysisStateSource: 'orphaned_plot_result',
    })
    expect(out.results.source).toBe('orphaned_plot_result')
  })

  it('coherence + capture_pipeline_status come from the capture-pipeline classifier verbatim', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      capturePipeline: {
        capture_pipeline_status: 'results_rendered_from_store_without_capture',
        coherence: {
          state: 'contradictory',
          issues: ['results_rendered_from_store_without_capture'],
        },
      },
    })
    expect(out.capture_pipeline_status).toBe('results_rendered_from_store_without_capture')
    expect(out.coherence.state).toBe('contradictory')
    expect(out.coherence.issues).toContain('results_rendered_from_store_without_capture')
  })

  it('scenario_id_reconciliation is exposed verbatim', () => {
    const recon: ScenarioIdReconciliation = {
      selected_scenario_id: 'sid-x',
      selected_source: 'payload',
      candidates: {
        store: null,
        v5_fact: null,
        payload: 'sid-x',
        url: null,
        full_graph: null,
      },
      conflicts: [],
    }
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      scenarioIdReconciliation: recon,
    })
    expect(out.scenario_id_reconciliation).toEqual(recon)
  })
})

describe('attachAnalysisFactDetails', () => {
  it('overlays has_run_analysis_fact and freshness when a fact is provided', () => {
    const base = assembleV5CanonicalTurnDiagnostics(defaults())
    const withFact = attachAnalysisFactDetails(base, {
      hasRunAnalysisFact: true,
      freshness: 'fresh',
    })
    expect(withFact.analysis_fact.has_run_analysis_fact).toBe(true)
    expect(withFact.analysis_fact.freshness).toBe('fresh')
    // Other fields preserved
    expect(withFact.analysis_fact.scenario_id).toBe(base.analysis_fact.scenario_id)
  })

  it('is a no-op when fact is null', () => {
    const base = assembleV5CanonicalTurnDiagnostics(defaults())
    const out = attachAnalysisFactDetails(base, null)
    expect(out).toBe(base)
  })
})

describe('option / factor_sensitivity extractors', () => {
  it('extractOptionCountFromPlotResponse returns array length', () => {
    expect(
      extractOptionCountFromPlotResponse({ option_comparison: [{ id: 'a' }, { id: 'b' }] }),
    ).toBe(2)
  })

  it('extractOptionCountFromPlotResponse returns 0 when missing', () => {
    expect(extractOptionCountFromPlotResponse(null)).toBe(0)
    expect(extractOptionCountFromPlotResponse({})).toBe(0)
    expect(extractOptionCountFromPlotResponse({ option_comparison: 'not-array' })).toBe(0)
  })

  it('extractFactorSensitivityCountFromPlotResponse returns array length', () => {
    expect(
      extractFactorSensitivityCountFromPlotResponse({
        factor_sensitivity: [{}, {}, {}],
      }),
    ).toBe(3)
  })

  it('extractFactorSensitivityCountFromPlotResponse returns 0 when missing', () => {
    expect(extractFactorSensitivityCountFromPlotResponse(null)).toBe(0)
    expect(extractFactorSensitivityCountFromPlotResponse({})).toBe(0)
  })
})

describe('coherence contradiction surfacing (composition)', () => {
  it('cee_v5_run_analysis + effective none + analysis_fact_present → contradictory state with issues', () => {
    // This is the headline contradiction from the brief. The assembler
    // accepts the capture-pipeline classifier's output verbatim; the
    // contradiction is detected there. Verify the wiring surfaces it.
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      analysisStateSource: 'cee_v5_run_analysis',
      capturePipeline: {
        capture_pipeline_status: 'results_rendered_from_store_without_capture',
        coherence: {
          state: 'contradictory',
          issues: [
            'analysis_state_cee_v5_but_effective_cee_response_none',
            'results_rendered_from_store_without_capture',
            'analysis_fact_present_but_cee_capture_missing',
          ],
        },
      },
    })
    expect(out.coherence.state).toBe('contradictory')
    expect(out.coherence.issues).toContain(
      'analysis_state_cee_v5_but_effective_cee_response_none',
    )
    expect(out.coherence.issues).toContain(
      'analysis_fact_present_but_cee_capture_missing',
    )
  })
})
