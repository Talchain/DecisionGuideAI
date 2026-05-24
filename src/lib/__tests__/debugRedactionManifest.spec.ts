/**
 * Tests for debugRedactionManifest — the section that surfaces every
 * redacted/omitted path in the bundle and documents the analytical
 * preservation policy.
 *
 * Verifies:
 *   - analytical numeric fields under approved paths are preserved (not
 *     surfaced as `redacted` entries — they remain in the bundle).
 *   - sensitive keys (auth/token) are surfaced as redacted entries.
 *   - array truncation, max-depth markers, circular references are
 *     each surfaced with stable reason codes.
 *   - the preserved_analytical_paths list is emitted verbatim.
 */

import { describe, expect, it } from 'vitest'

import {
  buildDebugRedactionManifest,
  collectOmittedSections,
  collectRedactedPaths,
  PRESERVED_ANALYTICAL_PATHS,
} from '../debugRedactionManifest'

describe('collectRedactedPaths', () => {
  it('emits empty array when nothing is redacted', () => {
    const out = collectRedactedPaths({
      foo: 'bar',
      nested: { value: 0.5, count: 3 },
    })
    expect(out).toEqual([])
  })

  it('emits sensitive_key for [REDACTED] string values', () => {
    const out = collectRedactedPaths({
      headers: { authorization: '[REDACTED]', accept: 'application/json' },
    })
    expect(out).toContainEqual({
      path: 'headers.authorization',
      reason: 'sensitive_key',
    })
    // Non-redacted string at sibling path is not emitted
    expect(out).not.toContainEqual({
      path: 'headers.accept',
      reason: expect.anything(),
    })
  })

  it('emits string_truncated when the truncation suffix is present', () => {
    const out = collectRedactedPaths({
      body: {
        text: 'lorem ipsum ... [truncated_by: bundle_redaction, 12345 chars total]',
      },
    })
    expect(out).toContainEqual({
      path: 'body.text',
      reason: 'string_truncated',
    })
  })

  it('emits max_depth_or_unserialisable for { __redacted: true } objects', () => {
    const out = collectRedactedPaths({
      deep: { __redacted: true, type: 'object', keys: ['a', 'b'] },
    })
    expect(out).toContainEqual({
      path: 'deep',
      reason: 'max_depth_or_unserialisable',
    })
  })

  it('emits array_capped for { __truncated: true } objects and walks surviving items', () => {
    const out = collectRedactedPaths({
      list: {
        __truncated: true,
        items: [{ inner: '[REDACTED]' }],
        totalCount: 100,
      },
    })
    expect(out).toContainEqual({ path: 'list', reason: 'array_capped' })
    expect(out).toContainEqual({
      path: 'list[0].inner',
      reason: 'sensitive_key',
    })
  })

  it('emits size_limit for { __sizeLimitExceeded: true } objects', () => {
    const out = collectRedactedPaths({
      raw_error: { __sizeLimitExceeded: true, originalSize: 99999 },
    })
    expect(out).toContainEqual({ path: 'raw_error', reason: 'size_limit' })
  })

  it('emits circular_reference for { __circular: true } objects', () => {
    const out = collectRedactedPaths({
      cycle: { __circular: true, type: 'object' },
    })
    expect(out).toContainEqual({
      path: 'cycle',
      reason: 'circular_reference',
    })
  })

  it('survives genuine self-reference cycles without overflowing', () => {
    const root: Record<string, unknown> = { name: 'root' }
    root.self = root
    expect(() => collectRedactedPaths(root)).not.toThrow()
  })

  it('walks nested arrays with [idx] notation', () => {
    const out = collectRedactedPaths({
      items: [{ password: '[REDACTED]' }, { name: 'ok' }],
    })
    expect(out).toContainEqual({
      path: 'items[0].password',
      reason: 'sensitive_key',
    })
  })
})

describe('analytical preservation policy', () => {
  it('observed_state numeric children are NOT surfaced as redacted (they remain in the bundle)', () => {
    // The existing redactor allowlists observed_state via neverRedactKeys.
    // Build a bundle slice where observed_state contains analytical
    // numeric fields and assert no redaction markers are picked up.
    const out = collectRedactedPaths({
      data: {
        observed_state: {
          value: 0.42,
          std: 0.05,
          baseline: 0.4,
          unit: 'pp',
          cap: 1,
        },
      },
    })
    expect(out).toEqual([])
  })

  it('edge.data.strength numeric is NOT surfaced as redacted', () => {
    const out = collectRedactedPaths({
      payloads: {
        plot_request: {
          graph: {
            edges: [
              {
                id: 'e1',
                data: {
                  strength: 0.7,
                  exists_probability: 0.9,
                  function_params: { intercept: 0.1, slope: 0.4 },
                },
              },
            ],
          },
        },
      },
    })
    expect(out).toEqual([])
  })

  it('generic numeric scalar under a non-analytical path is also not redacted (numeric values pass redaction)', () => {
    // Numerics are passed through by redactPayload regardless of path.
    // The point of the brief is that they should not be relied upon
    // BY KEY NAME alone — but path-aware preservation is descriptive
    // policy. The manifest just surfaces what the redactor produced.
    const out = collectRedactedPaths({ telemetry: { value: 42, mean: 1.5 } })
    expect(out).toEqual([])
  })
})

describe('collectOmittedSections', () => {
  it('emits an entry per probe that reports present=false', () => {
    const out = collectOmittedSections([
      { path: 'v5_canonical_turn_diagnostics', present: false, reason_if_omitted: 'assembler_bailed' },
      { path: 'capture_pipeline_status', present: true, reason_if_omitted: 'n/a' },
      { path: 'scientific_validation', present: false, reason_if_omitted: 'p1_not_built_yet' },
    ])
    expect(out).toEqual([
      { path: 'v5_canonical_turn_diagnostics', reason: 'assembler_bailed' },
      { path: 'scientific_validation', reason: 'p1_not_built_yet' },
    ])
  })
})

describe('buildDebugRedactionManifest — top-level assembler', () => {
  it('emits the policy preservation list verbatim', () => {
    const manifest = buildDebugRedactionManifest({ payloads: {} }, [])
    expect(manifest.preserved_analytical_paths).toEqual([
      ...PRESERVED_ANALYTICAL_PATHS,
    ])
  })

  it('scopes redacted scan to bundle.payloads.* and bundle.analysis_evidence_trace.response_body (not the whole bundle)', () => {
    const manifest = buildDebugRedactionManifest(
      {
        payloads: {
          cee_request: {
            headers: { authorization: '[REDACTED]' },
          },
        },
        // Sibling object containing a marker — must NOT appear in the
        // manifest because the scan is scoped (payloads + recovered
        // evidence body only).
        meta: {
          something: { __redacted: true },
        },
      },
      [],
    )
    expect(manifest.redacted).toContainEqual({
      path: 'payloads.cee_request.headers.authorization',
      reason: 'sensitive_key',
    })
    expect(manifest.redacted).not.toContainEqual({
      path: expect.stringContaining('meta'),
      reason: expect.anything(),
    })
  })

  it('scans analysis_evidence_trace.response_body for redaction markers (workstream 2026-05-23)', () => {
    // The recovered earlier CEE turn body lives under
    // analysis_evidence_trace.response_body. It was redacted at
    // trace-store record time using the same redactor as
    // bundle.payloads.cee_response. The manifest surfaces these
    // markers so reviewers can verify the recovered body did not
    // bypass redaction.
    const manifest = buildDebugRedactionManifest(
      {
        payloads: {
          cee_response: {
            blocks: [{ type: 'text', text: 'follow-up prose' }],
          },
        },
        analysis_evidence_trace: {
          trace_id: 'run-analysis-1',
          source: 'recovered_earlier_cee_turn',
          response_body: {
            request_headers: {
              authorization: '[REDACTED]',
            },
            blocks: [
              {
                type: 'analysis_result',
                enrichment: {
                  factor_sensitivity: [{ factor_id: 'f1' }],
                  __redacted: true,
                },
              },
            ],
          },
        },
      },
      [],
    )
    expect(manifest.redacted).toContainEqual({
      path: 'analysis_evidence_trace.response_body.request_headers.authorization',
      reason: 'sensitive_key',
    })
    expect(manifest.redacted).toContainEqual({
      path: 'analysis_evidence_trace.response_body.blocks[0].enrichment',
      reason: 'max_depth_or_unserialisable',
    })
  })

  it('no-op scan when analysis_evidence_trace.response_body is null (selected_cee_turn or unavailable case)', () => {
    const manifest = buildDebugRedactionManifest(
      {
        payloads: {},
        analysis_evidence_trace: {
          trace_id: null,
          source: 'unavailable',
          response_body: null,
        },
      },
      [],
    )
    expect(manifest.redacted).toEqual([])
  })

  it('handles missing analysis_evidence_trace gracefully (legacy bundle)', () => {
    // Legacy bundle without the analysis_evidence_trace block —
    // manifest still works.
    const manifest = buildDebugRedactionManifest({ payloads: {} }, [])
    expect(manifest.redacted).toEqual([])
  })

  it('returns empty redacted list when nothing is marked', () => {
    const manifest = buildDebugRedactionManifest({ payloads: {} }, [])
    expect(manifest.redacted).toEqual([])
    expect(manifest.omitted).toEqual([])
  })

  it('handles non-object bundle root gracefully', () => {
    expect(buildDebugRedactionManifest(null, [])).toMatchObject({
      redacted: [],
      omitted: [],
    })
    expect(buildDebugRedactionManifest('string-root', [])).toMatchObject({
      redacted: [],
    })
  })
})
