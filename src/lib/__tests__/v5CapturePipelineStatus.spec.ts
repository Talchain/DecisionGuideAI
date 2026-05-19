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
  findLatestV5TurnEntry,
  hasResponseBody,
  type V5CapturePipelineStatusInputs,
} from '../v5CapturePipelineStatus'

function defaults(): V5CapturePipelineStatusInputs {
  return {
    v5Capture: null,
    hasResultsReport: false,
    rawV2ResponsePresent: false,
    failedHttpRecord: { present: false, source: null },
    serviceMetadataV5Failure: false,
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

  it('V5-endpoint service-metadata failure WITHOUT trace evidence → request_failed_from_service_metadata (not hydrated_only)', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      serviceMetadataV5Failure: true,
      // Even with results present + no rawV2 — service-metadata
      // failure must take precedence so reviewers don't read
      // hydrated_only and miss the actual failure signal.
      hasResultsReport: true,
      rawV2ResponsePresent: false,
    })
    expect(out.capture_pipeline_status).toBe('request_failed_from_service_metadata')
  })

  it('trace-recorded failure takes precedence over service-metadata flag', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      failedHttpRecord: { present: true, source: 'preflight_or_network' },
      serviceMetadataV5Failure: true,
    })
    expect(out.capture_pipeline_status).toBe('proxy_or_network_failure')
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

describe('classifyV5CapturePipelineStatus — negative tests for unrelated failed payloads', () => {
  it('an unrelated failed PLoT record does NOT trigger proxy_or_network_failure', () => {
    // detectFailedHttpRecord already scopes to V5 turns. This integration
    // check confirms the upstream classifier respects the scoping.
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      hasResultsReport: true,
      rawV2ResponsePresent: false,
      // Caller passes failedHttpRecord = {present: false} when the
      // scoped detection found nothing (even if unrelated services
      // failed elsewhere). Status must be hydrated_only, not
      // proxy_or_network_failure.
      failedHttpRecord: { present: false, source: null },
    })
    expect(out.capture_pipeline_status).not.toBe('proxy_or_network_failure')
    expect(out.capture_pipeline_status).toBe('hydrated_only')
  })

  it('issue legacy_pipeline_status_misleading_proxy_or_network_failure fires even when results are hydrated_only', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      hasResultsReport: true,
      rawV2ResponsePresent: false,
      legacyPipelineStatus: 'proxy_or_network_failure',
    })
    expect(out.capture_pipeline_status).toBe('hydrated_only')
    expect(out.coherence.issues).toContain(
      'legacy_pipeline_status_misleading_proxy_or_network_failure',
    )
  })
})

describe('classifyV5CapturePipelineStatus — additive coherence issues', () => {
  it('results_rendered_from_store_without_capture fires regardless of whether final status is hydrated_only or results_rendered_from_store_without_capture', () => {
    const hydrated = classifyV5CapturePipelineStatus({
      ...defaults(),
      hasResultsReport: true,
      rawV2ResponsePresent: false,
    })
    expect(hydrated.capture_pipeline_status).toBe('hydrated_only')
    expect(hydrated.coherence.issues).toContain(
      'results_rendered_from_store_without_capture',
    )

    const rawPresent = classifyV5CapturePipelineStatus({
      ...defaults(),
      hasResultsReport: true,
      rawV2ResponsePresent: true,
    })
    expect(rawPresent.capture_pipeline_status).toBe(
      'results_rendered_from_store_without_capture',
    )
    expect(rawPresent.coherence.issues).toContain(
      'results_rendered_from_store_without_capture',
    )
  })

  it('parse_failed_with_raw_preserved fires whenever parse_ok=false and raw_response_present=true, regardless of status enum', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      v5Capture: {
        request_present: true,
        response_present: true,
        parse_ok: false,
        raw_response_present: true,
      },
    })
    expect(out.coherence.issues).toContain('parse_failed_with_raw_preserved')
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

  it('legacy says proxy_or_network_failure but new says request_failed → mislabel issue STILL fires (different evidence strength)', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      v5Capture: {
        request_present: true,
        response_present: false,
        parse_ok: false,
        raw_response_present: false,
      },
      failedHttpRecord: { present: true, source: 'cee' },
      legacyPipelineStatus: 'proxy_or_network_failure',
    })
    expect(out.capture_pipeline_status).toBe('request_failed')
    expect(out.coherence.issues).toContain(
      'legacy_pipeline_status_misleading_proxy_or_network_failure',
    )
  })

  it('legacy says proxy_or_network_failure but new says request_failed_from_service_metadata → mislabel issue fires', () => {
    const out = classifyV5CapturePipelineStatus({
      ...defaults(),
      serviceMetadataV5Failure: true,
      legacyPipelineStatus: 'proxy_or_network_failure',
    })
    expect(out.capture_pipeline_status).toBe('request_failed_from_service_metadata')
    expect(out.coherence.issues).toContain(
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

describe('detectFailedHttpRecord — scoped to V5 CEE turns', () => {
  const v5 = (overrides: Record<string, unknown> = {}) => ({
    service: 'CEE',
    endpoint: '/bff/orchestrate/v2/turn',
    ...overrides,
  })

  it('returns absent when no payload qualifies', () => {
    expect(detectFailedHttpRecord([])).toEqual({ present: false, source: null })
    expect(
      detectFailedHttpRecord([
        v5({ completed: true, status: 200 }),
        v5({ completed: true, status: 201 }),
      ]),
    ).toEqual({ present: false, source: null })
  })

  it('returns present + source when a V5 record has completed=false', () => {
    expect(
      detectFailedHttpRecord([v5({ completed: false, source: 'preflight_or_network' })]),
    ).toEqual({ present: true, source: 'preflight_or_network' })
  })

  it('returns present when V5 status >= 500', () => {
    const out = detectFailedHttpRecord([v5({ completed: true, status: 502, source: 'proxy' })])
    expect(out.present).toBe(true)
    expect(out.source).toBe('proxy')
  })

  it('returns present when V5 error/errorName fields are set', () => {
    expect(
      detectFailedHttpRecord([v5({ completed: true, error: 'fetch failed' })]).present,
    ).toBe(true)
    expect(
      detectFailedHttpRecord([v5({ completed: true, errorName: 'TypeError' })]).present,
    ).toBe(true)
  })

  it('returns present when V5 source is a network/proxy classification', () => {
    for (const source of ['proxy', 'netlify', 'preflight_or_network', 'browser_timeout']) {
      const out = detectFailedHttpRecord([v5({ completed: true, status: 200, source })])
      expect(out.present).toBe(true)
      expect(out.source).toBe(source)
    }
  })

  it('source "cee" alone is not enough — must pair with a failure signal', () => {
    expect(
      detectFailedHttpRecord([v5({ completed: true, status: 200, source: 'cee' })]).present,
    ).toBe(false)
  })

  // --- Scoping (the reviewer-flagged correctness fix) ---

  it('IGNORES a failed PLoT record — only V5 CEE turns influence capture status', () => {
    expect(
      detectFailedHttpRecord([
        {
          service: 'PLoT',
          endpoint: '/plot/v2/run',
          completed: false,
          source: 'proxy',
          status: 502,
        },
      ]),
    ).toEqual({ present: false, source: null })
  })

  it('IGNORES a failed CEE record on a non-V5 endpoint (legacy /turn, draft-graph, etc)', () => {
    expect(
      detectFailedHttpRecord([
        {
          service: 'CEE',
          endpoint: '/bff/orchestrate/v1/turn',
          completed: false,
          source: 'preflight_or_network',
        },
        {
          service: 'CEE',
          endpoint: '/cee/draft-graph',
          completed: false,
          source: 'proxy',
        },
      ]),
    ).toEqual({ present: false, source: null })
  })

  it('returns the V5 failure even when an unrelated record appears first', () => {
    expect(
      detectFailedHttpRecord([
        {
          service: 'PLoT',
          endpoint: '/plot/v2/run',
          completed: false,
          source: 'proxy',
        },
        v5({ completed: false, source: 'preflight_or_network' }),
      ]),
    ).toEqual({ present: true, source: 'preflight_or_network' })
  })
})

describe('findLatestV5TurnEntry — preference order', () => {
  const v5 = (overrides: Record<string, unknown> = {}) => ({
    service: 'CEE',
    endpoint: '/bff/orchestrate/v2/turn',
    ...overrides,
  })

  it('returns null when no V5 entries exist', () => {
    expect(findLatestV5TurnEntry([])).toBeNull()
    expect(
      findLatestV5TurnEntry([
        { service: 'PLoT', endpoint: '/plot/v2/run' },
        { service: 'CEE', endpoint: '/bff/orchestrate/v1/turn' },
      ]),
    ).toBeNull()
  })

  it('prefers an entry WITH response body over a status-only entry (round-5 P1.2)', () => {
    const withBody = v5({
      id: 'b1',
      response: { body: { ok: true } },
      status: 200,
      completed: true,
    })
    const statusOnly = v5({ id: 'h1', status: 500, completed: true })
    // status-only first in the list — picker must still pick the
    // body-bearing entry. Prevents a metadata stub from masking a
    // parseable response.
    expect(findLatestV5TurnEntry([statusOnly, withBody])).toBe(withBody)
  })

  it('prefers a status-only entry over a request-only entry when no body exists', () => {
    const statusOnly = v5({ id: 'h1', status: 500, completed: true })
    const requestOnly = v5({ id: 'r1', request: { body: { kind: 'analysis' } } })
    expect(findLatestV5TurnEntry([requestOnly, statusOnly])).toBe(statusOnly)
  })

  it('prefers a request-only entry over a metadata-only stub', () => {
    const requestOnly = v5({ id: 'r1', request: { body: {} } })
    const metadataOnly = v5({ id: 'm1' })
    expect(findLatestV5TurnEntry([metadataOnly, requestOnly])).toBe(requestOnly)
  })

  it('falls back to metadata-only stub when nothing else exists', () => {
    const stub = v5({ id: 'meta' })
    expect(findLatestV5TurnEntry([stub])).toBe(stub)
  })

  it('accepts status-only as response evidence when no body-bearing entry exists', () => {
    const statusOnly = v5({ id: 'h1', status: 500, completed: true })
    expect(findLatestV5TurnEntry([statusOnly])).toBe(statusOnly)
  })
})

describe('hasResponseBody — body-presence helper', () => {
  it('returns true only when response.body is non-null', () => {
    expect(hasResponseBody({ response: { body: { ok: true } } })).toBe(true)
    expect(hasResponseBody({ response: { body: [] } })).toBe(true)
  })

  it('returns false for status-only / metadata-only entries', () => {
    expect(hasResponseBody({ response: { body: null } })).toBe(false)
    expect(hasResponseBody({ response: {} })).toBe(false)
    expect(hasResponseBody({})).toBe(false)
  })
})
