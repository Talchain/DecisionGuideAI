/**
 * v5CanonicalAnalysisDiagnostics — classifier tests.
 *
 * v5-canonical-analysis brief PR 1 item 6: distinguish "no CEE request
 * made" from "CEE request failed".
 */
import { describe, it, expect } from 'vitest'

import {
  classifyV5CanonicalAnalysisDiagnostic,
  type V5CeeCapture,
} from '../v5CanonicalAnalysisDiagnostics'

function capture(overrides: Partial<V5CeeCapture> = {}): V5CeeCapture {
  return {
    request_id: 'req-1',
    scenario_id: 'scenario-A',
    turn_id: null,
    endpoint: null,
    status: 200,
    duration_ms: 50,
    request_present: true,
    response_present: true,
    parse_ok: true,
    parse_error: null,
    response_top_level_keys: ['blocks', 'assistant_text'],
    raw_response_present: false,
    parse_failure_kind: null,
    unknown_block_types: null,
    has_additive_extensions: false,
    phase3_blocks_tolerated_count: 0,
    phase3_block_types: [],
    unknown_blocks_tolerated_count: 0,
    source: 'proxy_v5_turn',
    ...overrides,
  }
}

describe('classifyV5CanonicalAnalysisDiagnostic', () => {
  describe('analysis_fact_status', () => {
    it('present when factPresentForScenario=true', () => {
      const r = classifyV5CanonicalAnalysisDiagnostic({
        canonicalFlagOn: true,
        analysisStateSource: 'cee_v5_run_analysis',
        factPresentForScenario: true,
        ceeResponseHasAnalysisResult: true,
        v5Capture: capture(),
        hasResultsReport: true,
        plotRequestCaptured: false,
      })
      expect(r.analysis_fact_status).toBe('present')
    })

    it('missing when canonical flag is on but no fact attached', () => {
      const r = classifyV5CanonicalAnalysisDiagnostic({
        canonicalFlagOn: true,
        analysisStateSource: 'orphaned_plot_result',
        factPresentForScenario: false,
        ceeResponseHasAnalysisResult: false,
        v5Capture: null,
        hasResultsReport: true,
        plotRequestCaptured: true,
      })
      expect(r.analysis_fact_status).toBe('missing')
    })

    it('unknown_not_checked when canonical flag is off', () => {
      const r = classifyV5CanonicalAnalysisDiagnostic({
        canonicalFlagOn: false,
        analysisStateSource: 'direct_plot_legacy',
        factPresentForScenario: false,
        ceeResponseHasAnalysisResult: false,
        v5Capture: null,
        hasResultsReport: true,
        plotRequestCaptured: true,
      })
      expect(r.analysis_fact_status).toBe('unknown_not_checked')
    })
  })

  describe('debug_capture_status', () => {
    it('complete when CEE request + response + parse_ok', () => {
      const r = classifyV5CanonicalAnalysisDiagnostic({
        canonicalFlagOn: true,
        analysisStateSource: 'cee_v5_run_analysis',
        factPresentForScenario: true,
        ceeResponseHasAnalysisResult: true,
        v5Capture: capture(),
        hasResultsReport: true,
        plotRequestCaptured: false,
      })
      expect(r.debug_capture_status).toBe('complete')
    })

    it('cee_capture_missing when no V5 capture at all but results exist', () => {
      const r = classifyV5CanonicalAnalysisDiagnostic({
        canonicalFlagOn: true,
        analysisStateSource: 'orphaned_plot_result',
        factPresentForScenario: false,
        ceeResponseHasAnalysisResult: false,
        v5Capture: null,
        hasResultsReport: true,
        plotRequestCaptured: false,
      })
      expect(r.debug_capture_status).toBe('cee_capture_missing')
    })

    it('plot_only_capture when PLoT was called directly and no V5 capture', () => {
      const r = classifyV5CanonicalAnalysisDiagnostic({
        canonicalFlagOn: false,
        analysisStateSource: 'direct_plot_legacy',
        factPresentForScenario: false,
        ceeResponseHasAnalysisResult: false,
        v5Capture: null,
        hasResultsReport: true,
        plotRequestCaptured: true,
      })
      expect(r.debug_capture_status).toBe('plot_only_capture')
    })

    it('request_failed when V5 request fired but response is absent', () => {
      const r = classifyV5CanonicalAnalysisDiagnostic({
        canonicalFlagOn: true,
        analysisStateSource: 'orphaned_plot_result',
        factPresentForScenario: false,
        ceeResponseHasAnalysisResult: false,
        v5Capture: capture({ response_present: false, status: 0 }),
        hasResultsReport: false,
        plotRequestCaptured: false,
      })
      expect(r.debug_capture_status).toBe('request_failed')
    })

    it('parse_failed when V5 response present but parse_ok=false', () => {
      const r = classifyV5CanonicalAnalysisDiagnostic({
        canonicalFlagOn: true,
        analysisStateSource: 'orphaned_plot_result',
        factPresentForScenario: false,
        ceeResponseHasAnalysisResult: false,
        v5Capture: capture({ parse_ok: false, parse_error: 'bad schema' }),
        hasResultsReport: false,
        plotRequestCaptured: false,
      })
      expect(r.debug_capture_status).toBe('parse_failed')
    })
  })

  it('passes through analysis_state_source verbatim', () => {
    const r = classifyV5CanonicalAnalysisDiagnostic({
      canonicalFlagOn: true,
      analysisStateSource: 'cee_v5_followup',
      factPresentForScenario: true,
      ceeResponseHasAnalysisResult: true,
      v5Capture: capture(),
      hasResultsReport: true,
      plotRequestCaptured: false,
    })
    expect(r.analysis_state_source).toBe('cee_v5_followup')
    expect(r.canonical_flag_on).toBe(true)
  })
})
