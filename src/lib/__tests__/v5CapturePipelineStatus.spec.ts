/**
 * Tests for v5CapturePipelineStatus — the additive classifier that
 * replaces the legacy `proxy_or_network_failure` overuse with a coherent
 * 7-state reading of the capture surface.
 *
 * Covers the brief's required cases:
 *   - no failed HTTP record → never `proxy_or_network_failure`
 *   - actual failed proxy/network record → `proxy_or_network_failure`
 *   - results present, no capture, no failed record → `results_rendered_from_store_without_capture`
 *   - results present, rawV2Response = null → `hydrated_only`
 *   - parse-error envelope → `parse_failed`
 *   - no results, no capture → `capture_missing`
 *   - legacy pipeline disagreement → `legacy_pipeline_status_misleading_proxy_or_network_failure`
 *
 * Plus the explicit contradiction-as-coherence-issue cases from P0.2.
 */

import { describe, expect, it } from 'vitest'

import {
  classifyV5CapturePipelineStatus,
  detectFailedHttpRecord,
  type V5CapturePipelineStatusInputs,
} from '../v5CapturePipelineStatus'

function defaults(): V5CapturePipelineStatusInputs {
  return {
    v5Capture: null,
    hasResultsReport: false,
    rawV2ResponsePresent: false,
    failedHttpRecord: { present: false, source: null },
    analysisStateSource: 'none',
    effectiveCeeResponseSource: 'none',
    analysisFactPresent: false,
    scenarioIdConflictCount: 0,
    legacyPipelineStatus: null,
  }
}

describe('classifyV5CapturePipelineStatus — capture_pipeline_status enum', () => {
  it('no V5 capture + no results + no failed record → capture_missing', () => {
    const out = classifyV5CapturePipelineStatus(defaults())
    expect(out.capture_pipeline_status).toBe('capture_missing')
    expect(out.coherence.state).toBe('missing')
  })

  it('no failed HTTP record never emits proxy_or_network_failure', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      hasResultsReport: true,
      rawV2ResponsePresent: true,
    })
    expect(out.capture_pipeline_status).not.toBe('proxy_or_network_failure')
    expect(out.capture_pipeline_status).toBe('results_rendered_from_store_without_capture')
  })

  it('failed HTTP record classified as proxy/network → proxy_or_network_failure', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      failedHttpRecord: { present: true, source: 'preflight_or_network' },
    })
    expect(out.capture_pipeline_status).toBe('proxy_or_network_failure')
  })

  it('failed HTTP record with non-network source → request_failed', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      failedHttpRecord: { present: true, source: 'cee' },
    })
    expect(out.capture_pipeline_status).toBe('request_failed')
  })

  it('results present, no capture, no failed record, rawV2Response present → results_rendered_from_store_without_capture', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      hasResultsReport: true,
      rawV2ResponsePresent: true,
    })
    expect(out.capture_pipeline_status).toBe('results_rendered_from_store_without_capture')
    expect(out.coherence.issues).toContain('results_rendered_from_store_without_capture')
  })

  it('results present, no capture, no failed record, no rawV2Response → hydrated_only', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      hasResultsReport: true,
      rawV2ResponsePresent: false,
    })
    expect(out.capture_pipeline_status).toBe('hydrated_only')
  })

  it('request present + no response + no failed proxy record → request_failed', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      v5Capture: {
        request_present: true,
        response_present: false,
        parse_ok: false,
        raw_response_present: false,
      },
    })
    expect(out.capture_pipeline_status).toBe('request_failed')
  })

  it('parse-error envelope present (parse_ok=false) → parse_failed', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      v5Capture: {
        request_present: true,
        response_present: true,
        parse_ok: false,
        raw_response_present: true,
      },
    })
    expect(out.capture_pipeline_status).toBe('parse_failed')
    expect(out.coherence.issues).toContain('parse_failed_with_raw_preserved')
  })

  it('successful capture + results → complete', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      v5Capture: {
        request_present: true,
        response_present: true,
        parse_ok: true,
        raw_response_present: false,
      },
      hasResultsReport: true,
    })
    expect(out.capture_pipeline_status).toBe('complete')
    expect(out.coherence.state).toBe('complete')
    expect(out.coherence.issues).toEqual([])
  })

  it('successful non-analysis capture (no results yet) also reads as complete', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      v5Capture: {
        request_present: true,
        response_present: true,
        parse_ok: true,
        raw_response_present: false,
      },
      hasResultsReport: false,
    })
    expect(out.capture_pipeline_status).toBe('complete')
  })
})

describe('classifyV5CapturePipelineStatus — coherence issues', () => {
  it('analysis_state_source=cee_v5_run_analysis + effective_cee_response_source=none emits the explicit issue', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      analysisStateSource: 'cee_v5_run_analysis',
      effectiveCeeResponseSource: 'none',
      hasResultsReport: true,
      rawV2ResponsePresent: false,
    })
    expect(out.coherence.issues).toContain(
      'analysis_state_cee_v5_but_effective_cee_response_none',
    )
    expect(out.coherence.state).toBe('contradictory')
  })

  it('analysis_fact_present + v5_capture null emits analysis_fact_present_but_cee_capture_missing', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      analysisFactPresent: true,
      hasResultsReport: true,
      rawV2ResponsePresent: false,
    })
    expect(out.coherence.issues).toContain(
      'analysis_fact_present_but_cee_capture_missing',
    )
  })

  it('scenario_id conflict count > 0 emits scenario_id_conflict', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      scenarioIdConflictCount: 2,
    })
    expect(out.coherence.issues).toContain('scenario_id_conflict')
  })

  it('legacy pipeline says proxy_or_network_failure but capture says results_rendered_from_store_without_capture → emits legacy_pipeline_status_misleading_proxy_or_network_failure', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      hasResultsReport: true,
      rawV2ResponsePresent: true,
      legacyPipelineStatus: 'proxy_or_network_failure',
    })
    expect(out.capture_pipeline_status).toBe('results_rendered_from_store_without_capture')
    expect(out.coherence.issues).toContain(
      'legacy_pipeline_status_misleading_proxy_or_network_failure',
    )
  })

  it('legacy pipeline agrees with capture (both proxy_or_network_failure) → no disagreement issue', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      failedHttpRecord: { present: true, source: 'preflight_or_network' },
      legacyPipelineStatus: 'proxy_or_network_failure',
    })
    expect(out.capture_pipeline_status).toBe('proxy_or_network_failure')
    expect(out.coherence.issues).not.toContain(
      'legacy_pipeline_status_misleading_proxy_or_network_failure',
    )
  })

  it('coherence.state is "missing" only when status is capture_missing', () => {
    expect(
      classifyV5CapturePipelineStatus(defaults()).coherence.state,
    ).toBe('missing')
    expect(
      classifyV5CapturePipelineStatus({
        ...defaults(),
        hasResultsReport: true,
        rawV2ResponsePresent: false,
      }).coherence.state,
    ).not.toBe('missing')
  })
})

describe('detectFailedHttpRecord', () => {
  it('returns absent when no payload qualifies', () => {
    expect(detectFailedHttpRecord([])).toEqual({ present: false, source: null })
    expect(
      detectFailedHttpRecord([
        { completed: true, status: 200 },
        { completed: true, status: 201 },
      ]),
    ).toEqual({ present: false, source: null })
  })

  it('returns present + source when a record has completed=false', () => {
    expect(
      detectFailedHttpRecord([{ completed: false, source: 'preflight_or_network' }]),
    ).toEqual({ present: true, source: 'preflight_or_network' })
  })

  it('returns present when status >= 500', () => {
    const out = detectFailedHttpRecord([{ completed: true, status: 502, source: 'proxy' }])
    expect(out.present).toBe(true)
    expect(out.source).toBe('proxy')
  })

  it('returns present when error/errorName fields are set', () => {
    expect(
      detectFailedHttpRecord([{ completed: true, error: 'fetch failed' }]).present,
    ).toBe(true)
    expect(
      detectFailedHttpRecord([{ completed: true, errorName: 'TypeError' }]).present,
    ).toBe(true)
  })

  it('returns present when source is a network/proxy classification', () => {
    for (const source of ['proxy', 'netlify', 'preflight_or_network', 'browser_timeout']) {
      const out = detectFailedHttpRecord([{ completed: true, status: 200, source }])
      expect(out.present).toBe(true)
      expect(out.source).toBe(source)
    }
  })

  it('source "cee" alone is not enough — must pair with a failure signal', () => {
    expect(
      detectFailedHttpRecord([{ completed: true, status: 200, source: 'cee' }]).present,
    ).toBe(false)
  })
})
