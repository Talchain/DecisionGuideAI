/**
 * Tests for v5CanonicalTurnDiagnostics — the richer assembler that
 * composes (not replaces) the legacy classifier. Covers the brief's
 * required cases plus extractor helpers.
 */

import { describe, expect, it } from 'vitest'

import {
  assembleV5CanonicalTurnDiagnostics,
  attachAnalysisFactDetails,
  determineCaptureTier,
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
    legacyDiagnosticFromClassifier: true,
    flagDiagnostic: { resolved: true, source: 'env' },
    analysisStateSource: 'cee_v5_run_analysis',
    hasResultsReport: true,
    effectiveCeeResponseSource: 'direct',
    graphHashAtGeneration: null,
    optionCount: 0,
    factorSensitivityCount: 0,
    captureTier: 'bundle_payloads',
    renderedOptionCount: null,
    renderedFactorCount: null,
    capturePipeline: {
      capture_pipeline_status: 'complete',
      coherence: { state: 'complete', issues: [] },
    },
    scenarioIdReconciliation: makeReconciliation(),
  }
}

describe('assembleV5CanonicalTurnDiagnostics — composition with legacy classifier', () => {
  it('emits canonical_flag_env_key as the verbatim VITE_V5_CANONICAL_ANALYSIS string', () => {
    const out = assembleV5CanonicalTurnDiagnostics(defaults())
    expect(out.canonical_flag_env_key).toBe('VITE_V5_CANONICAL_ANALYSIS')
  })

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

  it('latest_v5_turn mirrors the legacy capture fields (including brief-required request_id, scenario_id, turn_id, endpoint, duration_ms, source)', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({
        v5_cee_capture: makeCapture({
          request_id: 'req-1',
          scenario_id: 'sid-1',
          turn_id: 'turn-1',
          endpoint: '/bff/orchestrate/v2/turn',
          status: 200,
          duration_ms: 123,
          source: 'proxy_v5_turn',
        }),
      }),
    })
    expect(out.latest_v5_turn).toEqual({
      request_present: true,
      response_present: true,
      request_id: 'req-1',
      // Default captureTier is bundle_payloads → session-level
      // request_id provenance.
      request_id_source: 'session',
      scenario_id: 'sid-1',
      turn_id: 'turn-1',
      endpoint: '/bff/orchestrate/v2/turn',
      status: 200,
      duration_ms: 123,
      // Brief's provenance enum: bundle.payloads.cee_* carried the data
      // (default captureTier is 'bundle_payloads').
      source: 'bundle_payloads',
    })
  })

  it('latest_v5_turn.source = "payload_trace" when captureTier is payload_trace', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      captureTier: 'payload_trace',
    })
    expect(out.latest_v5_turn.source).toBe('payload_trace')
    // request_id_source must also flip to payload_trace.
    expect(out.latest_v5_turn.request_id_source).toBe('payload_trace')
  })

  it('latest_v5_turn.source = "service_metadata" when captureTier is service_metadata', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({
        v5_cee_capture: makeCapture({ request_present: false, response_present: false }),
      }),
      captureTier: 'service_metadata',
    })
    expect(out.latest_v5_turn.source).toBe('service_metadata')
    expect(out.latest_v5_turn.request_id_source).toBe('session')
  })

  it('latest_v5_turn.source = "store" when captureTier is store (no capture, fact present)', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({
        v5_cee_capture: null,
        analysis_fact_status: 'present',
      }),
      captureTier: 'store',
    })
    expect(out.latest_v5_turn.source).toBe('store')
    expect(out.latest_v5_turn.request_id_source).toBe('none')
  })

  it('latest_v5_turn.source = "none" when captureTier is none', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({
        v5_cee_capture: null,
        analysis_fact_status: 'missing',
      }),
      captureTier: 'none',
    })
    expect(out.latest_v5_turn.source).toBe('none')
    expect(out.latest_v5_turn.request_id_source).toBe('none')
  })

  it('parse_ok is null when response_present is false (does NOT conflate "no response" with "parsed and failed")', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({
        v5_cee_capture: makeCapture({
          request_present: true,
          response_present: false,
          parse_ok: false, // legacy capture would report false, but
          // the snapshot must overlay null per P0.2
        }),
      }),
    })
    expect(out.parse.parse_ok).toBeNull()
    expect(out.diagnostic_source_strength.parse).toBe('unavailable')
  })

  it('diagnostic_source_strength.parse is "unavailable" for service-metadata-only failures', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      captureTier: 'service_metadata',
      legacyDiagnostic: makeLegacy({
        v5_cee_capture: makeCapture({
          request_present: false,
          response_present: false,
          parse_ok: false,
        }),
      }),
    })
    expect(out.parse.parse_ok).toBeNull()
    expect(out.diagnostic_source_strength.parse).toBe('unavailable')
    expect(out.diagnostic_source_strength.latest_v5_turn).toBe('service_metadata')
  })

  it('results.rendered_option_count / rendered_factor_count surface from display_state when provided', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      renderedOptionCount: 3,
      renderedFactorCount: 7,
    })
    expect(out.results.rendered_option_count).toBe(3)
    expect(out.results.rendered_factor_count).toBe(7)
  })

  it('results rendered counts are null (not fabricated) when display_state is absent', () => {
    const out = assembleV5CanonicalTurnDiagnostics(defaults())
    expect(out.results.rendered_option_count).toBeNull()
    expect(out.results.rendered_factor_count).toBeNull()
  })

  it('diagnostic_source_strength tracks each block independently', () => {
    const live = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      captureTier: 'payload_trace',
      optionCount: 2,
      factorSensitivityCount: 5,
    })
    expect(live.diagnostic_source_strength).toEqual({
      latest_v5_turn: 'live_trace',
      parse: 'live_response',
      results: 'plot_response',
    })

    const fallback = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({
        v5_cee_capture: null,
        analysis_fact_status: 'present',
      }),
      captureTier: 'store',
      hasResultsReport: true,
      optionCount: 0,
      factorSensitivityCount: 0,
    })
    expect(fallback.diagnostic_source_strength).toEqual({
      latest_v5_turn: 'fallback',
      parse: 'unavailable',
      results: 'store_report',
    })
  })

  it('effective_cee_response_source is exposed at top level (mirror of bundle field)', () => {
    expect(assembleV5CanonicalTurnDiagnostics(defaults()).effective_cee_response_source).toBe('direct')
    expect(
      assembleV5CanonicalTurnDiagnostics({
        ...defaults(),
        effectiveCeeResponseSource: 'none',
      }).effective_cee_response_source,
    ).toBe('none')
  })

  it('parse.unknown_block_types surfaces from the legacy capture', () => {
    const out = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({
        v5_cee_capture: makeCapture({
          parse_ok: false,
          parse_failure_kind: 'unknown_block_types',
          unknown_block_types: ['mystery_block', 'experimental'],
        }),
      }),
    })
    expect(out.parse.unknown_block_types).toEqual(['mystery_block', 'experimental'])
  })

  it('analysis_fact.source distinguishes legacy classifier from synthesised fallback', () => {
    const fromClassifier = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnosticFromClassifier: true,
      legacyDiagnostic: makeLegacy({ analysis_fact_status: 'present' }),
    })
    expect(fromClassifier.analysis_fact.source).toBe('v5_canonical_analysis')

    const fromFallback = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnosticFromClassifier: false,
      legacyDiagnostic: makeLegacy({ analysis_fact_status: 'present' }),
    })
    expect(fromFallback.analysis_fact.source).toBe('source_classifier')

    const noFact = assembleV5CanonicalTurnDiagnostics({
      ...defaults(),
      legacyDiagnostic: makeLegacy({ analysis_fact_status: 'missing' }),
    })
    expect(noFact.analysis_fact.source).toBe('none')
  })

  it('feature_flag_diagnostic emits the compact { VITE_V5_CANONICAL_ANALYSIS: { value, source } } shape', () => {
    const out = assembleV5CanonicalTurnDiagnostics(defaults())
    expect(out.feature_flag_diagnostic).toEqual({
      VITE_V5_CANONICAL_ANALYSIS: { value: true, source: 'env' },
    })
  })

  it('results.rendered_counts_documented_in points to bundle.display_state (no fabrication)', () => {
    const out = assembleV5CanonicalTurnDiagnostics(defaults())
    expect(out.results.rendered_counts_documented_in).toBe('bundle.display_state')
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

describe('determineCaptureTier — single canonical resolver', () => {
  it('returns payload_trace when a trace entry exists (highest tier)', () => {
    expect(
      determineCaptureTier({
        traceEntryPresent: true,
        bundlePayloadsCeeRequestPresent: true,
        bundlePayloadsCeeResponsePresent: true,
        serviceMetadataV5EndpointPresent: true,
        factPresentForScenario: true,
      }),
    ).toBe('payload_trace')
  })

  it('returns bundle_payloads when no trace entry but cee_request OR cee_response is set', () => {
    expect(
      determineCaptureTier({
        traceEntryPresent: false,
        bundlePayloadsCeeRequestPresent: true,
        bundlePayloadsCeeResponsePresent: false,
        serviceMetadataV5EndpointPresent: false,
        factPresentForScenario: false,
      }),
    ).toBe('bundle_payloads')
    expect(
      determineCaptureTier({
        traceEntryPresent: false,
        bundlePayloadsCeeRequestPresent: false,
        bundlePayloadsCeeResponsePresent: true,
        serviceMetadataV5EndpointPresent: false,
        factPresentForScenario: false,
      }),
    ).toBe('bundle_payloads')
  })

  it('returns service_metadata when only data.services.cee V5 endpoint is present', () => {
    expect(
      determineCaptureTier({
        traceEntryPresent: false,
        bundlePayloadsCeeRequestPresent: false,
        bundlePayloadsCeeResponsePresent: false,
        serviceMetadataV5EndpointPresent: true,
        factPresentForScenario: false,
      }),
    ).toBe('service_metadata')
  })

  it('returns store when no capture evidence but a fact is present', () => {
    expect(
      determineCaptureTier({
        traceEntryPresent: false,
        bundlePayloadsCeeRequestPresent: false,
        bundlePayloadsCeeResponsePresent: false,
        serviceMetadataV5EndpointPresent: false,
        factPresentForScenario: true,
      }),
    ).toBe('store')
  })

  it('returns none when there is no evidence at all', () => {
    expect(
      determineCaptureTier({
        traceEntryPresent: false,
        bundlePayloadsCeeRequestPresent: false,
        bundlePayloadsCeeResponsePresent: false,
        serviceMetadataV5EndpointPresent: false,
        factPresentForScenario: false,
      }),
    ).toBe('none')
  })
})
