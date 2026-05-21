/**
 * Unit tests for `src/lib/v5EmbeddedEvidence.ts` —
 * `resolveScientificEvidence` precedence + path-boundary +
 * malformed-input safety.
 *
 * Post-PR #162 follow-up: under V5 canonical mode, the browser
 * never fetches PLoT/ISL directly. Embedded enrichment in
 * `bundle.payloads.cee_response.blocks[type==='analysis_result'].enrichment`
 * is the only live evidence available to scientific validators.
 * This resolver lifts it WITHOUT mutating `bundle.payloads.*`.
 *
 * Honesty contract: top-level capture wins (preserves dev/local
 * path); embedded fallback requires at least one indicative key;
 * missing fields stay missing.
 */

import { describe, it, expect } from 'vitest'

import {
  resolveScientificEvidence,
  type ResolvedEvidence,
} from '../v5EmbeddedEvidence'
import realCeeShape from '../../v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json'

const EMPTY_TOP_LEVEL = {
  plot_response: null,
  isl_request: null,
  isl_response: null,
}

describe('resolveScientificEvidence — top-level precedence', () => {
  it('returns top-level plot_response when present, regardless of CEE content', () => {
    const topLevel = {
      plot_response: { factor_sensitivity: [{ factor_id: 'f1' }] },
      isl_request: null,
      isl_response: null,
    }
    const r = resolveScientificEvidence(topLevel, realCeeShape)
    expect(r.plot_response).toEqual(topLevel.plot_response)
    expect(r.plot_response_source).toBe('top_level')
    expect(r.plot_response_source_path).toBe('payloads.plot_response')
  })

  it('returns top-level isl_request when present', () => {
    const topLevel = {
      plot_response: null,
      isl_request: { parameter_uncertainties: {} },
      isl_response: null,
    }
    const r = resolveScientificEvidence(topLevel, null)
    expect(r.isl_request).toEqual(topLevel.isl_request)
    expect(r.isl_request_source).toBe('top_level')
    expect(r.isl_request_source_path).toBe('payloads.isl_request')
  })

  it('returns top-level isl_response when present', () => {
    const topLevel = {
      plot_response: null,
      isl_request: null,
      isl_response: { factor_sensitivity: [{ factor_id: 'f1' }] },
    }
    const r = resolveScientificEvidence(topLevel, null)
    expect(r.isl_response).toEqual(topLevel.isl_response)
    expect(r.isl_response_source).toBe('top_level')
    expect(r.isl_response_source_path).toBe('payloads.isl_response')
  })
})

describe('resolveScientificEvidence — CEE-embedded fallback', () => {
  it('lifts enrichment as plot_response when top-level is null (real staging fixture)', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, realCeeShape)
    expect(r.plot_response).not.toBeNull()
    expect(r.plot_response_source).toBe('cee_embedded')
    expect(r.plot_response_source_path).toMatch(
      /^payloads\.cee_response\.blocks\[\d+\]\.enrichment$/,
    )
    // Sanity check that the resolver lifted the actual enrichment
    // (not a synthesized empty object).
    expect(
      (r.plot_response as Record<string, unknown>)?.factor_sensitivity,
    ).toBeDefined()
    expect(
      (r.plot_response as Record<string, unknown>)?.option_comparison,
    ).toBeDefined()
    expect(
      (r.plot_response as Record<string, unknown>)?.robustness,
    ).toBeDefined()
  })

  it('returns full ResolvedEvidence shape even when only plot_response is found', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, realCeeShape)
    // ISL fields stay unavailable — the fixture has no downstream_calls.isl.
    expect(r.isl_request).toBeNull()
    expect(r.isl_request_source).toBe('unavailable')
    expect(r.isl_request_source_path).toBeNull()
    expect(r.isl_response).toBeNull()
    expect(r.isl_response_source).toBe('unavailable')
    expect(r.isl_response_source_path).toBeNull()
  })

  it('lifts isl_response from enrichment.downstream_calls.isl.response when present', () => {
    // Synthetic CEE response with downstream_calls — exercises the
    // resolver's ISL fallback path (which the real staging fixture
    // does not cover).
    const ceeWithDownstreamIsl = {
      blocks: [
        {
          type: 'analysis_result',
          enrichment: {
            factor_sensitivity: [{ factor_id: 'f1' }],
            downstream_calls: {
              isl: {
                response: {
                  factor_sensitivity: [
                    { factor_id: 'f1', evpi_percentage_points: 5.2 },
                  ],
                },
              },
            },
          },
        },
      ],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeWithDownstreamIsl)
    expect(r.isl_response).not.toBeNull()
    expect(r.isl_response_source).toBe('cee_embedded')
    expect(r.isl_response_source_path).toMatch(
      /^payloads\.cee_response\.blocks\[0\]\.enrichment\.downstream_calls\.isl\.response$/,
    )
  })

  it('picks the FIRST analysis_result block when multiple exist (predictable, reviewer-checkable)', () => {
    const ceeWithMultipleBlocks = {
      blocks: [
        { type: 'text', text: 'noise' },
        {
          type: 'analysis_result',
          enrichment: { factor_sensitivity: [{ factor_id: 'first' }] },
        },
        {
          type: 'analysis_result',
          enrichment: { factor_sensitivity: [{ factor_id: 'second' }] },
        },
      ],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeWithMultipleBlocks)
    expect(
      (r.plot_response as Record<string, unknown>)?.factor_sensitivity,
    ).toEqual([{ factor_id: 'first' }])
    expect(r.plot_response_source_path).toBe(
      'payloads.cee_response.blocks[1].enrichment',
    )
  })
})

describe('resolveScientificEvidence — indicative-keys gate (no synthesis)', () => {
  it('does NOT promote enrichment that lacks indicative keys', () => {
    const ceeWithEmptyEnrichment = {
      blocks: [
        {
          type: 'analysis_result',
          // No option_comparison, factor_sensitivity, m1_coaching,
          // flip_thresholds, or robustness — just noise.
          enrichment: { summary: 'A summary', leading_option_id: 'opt_1' },
        },
      ],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeWithEmptyEnrichment)
    expect(r.plot_response).toBeNull()
    expect(r.plot_response_source).toBe('unavailable')
    expect(r.plot_response_source_path).toBeNull()
  })

  it('does NOT promote enrichment={} (empty object)', () => {
    const ceeWithEmptyObj = {
      blocks: [{ type: 'analysis_result', enrichment: {} }],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeWithEmptyObj)
    expect(r.plot_response).toBeNull()
    expect(r.plot_response_source).toBe('unavailable')
  })

  it('promotes enrichment when ONLY robustness is present (single indicative key suffices)', () => {
    const ceeWithRobustnessOnly = {
      blocks: [
        {
          type: 'analysis_result',
          enrichment: { robustness: { fragile_edges: [] } },
        },
      ],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeWithRobustnessOnly)
    expect(r.plot_response_source).toBe('cee_embedded')
    expect(r.plot_response).not.toBeNull()
  })
})

describe('resolveScientificEvidence — unavailable when both missing', () => {
  it('returns all unavailable when both top-level and CEE are null', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, null)
    const expected: ResolvedEvidence = {
      plot_response: null,
      plot_response_source: 'unavailable',
      plot_response_source_path: null,
      isl_request: null,
      isl_request_source: 'unavailable',
      isl_request_source_path: null,
      isl_response: null,
      isl_response_source: 'unavailable',
      isl_response_source_path: null,
    }
    expect(r).toEqual(expected)
  })

  it('returns unavailable when CEE response has no analysis_result block', () => {
    const ceeNoAnalysisBlock = {
      blocks: [
        { type: 'text', text: 'just a text block' },
        { type: 'graph_patch', patch: { nodes: [] } },
      ],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeNoAnalysisBlock)
    expect(r.plot_response_source).toBe('unavailable')
    expect(r.isl_response_source).toBe('unavailable')
  })
})

describe('resolveScientificEvidence — mixed sources (top-level + embedded)', () => {
  it('top-level PLoT + embedded ISL (via downstream_calls)', () => {
    const topLevel = {
      plot_response: { factor_sensitivity: [{ factor_id: 'top' }] },
      isl_request: null,
      isl_response: null,
    }
    const ceeWithIsl = {
      blocks: [
        {
          type: 'analysis_result',
          enrichment: {
            factor_sensitivity: [{ factor_id: 'embedded' }],
            downstream_calls: {
              isl: {
                response: { factor_sensitivity: [{ factor_id: 'isl' }] },
              },
            },
          },
        },
      ],
    }
    const r = resolveScientificEvidence(topLevel, ceeWithIsl)
    // PLoT comes from top-level (top-level wins).
    expect(r.plot_response_source).toBe('top_level')
    expect(
      (r.plot_response as Record<string, unknown>)?.factor_sensitivity,
    ).toEqual([{ factor_id: 'top' }])
    // ISL response comes from embedded (top-level was null).
    expect(r.isl_response_source).toBe('cee_embedded')
    expect(
      (r.isl_response as Record<string, unknown>)?.factor_sensitivity,
    ).toEqual([{ factor_id: 'isl' }])
  })
})

describe('resolveScientificEvidence — malformed-input safety (no throws)', () => {
  it('handles non-object ceeResponse', () => {
    expect(() => resolveScientificEvidence(EMPTY_TOP_LEVEL, 'bad')).not.toThrow()
    expect(() => resolveScientificEvidence(EMPTY_TOP_LEVEL, 42)).not.toThrow()
    expect(() => resolveScientificEvidence(EMPTY_TOP_LEVEL, [])).not.toThrow()
  })

  it('handles ceeResponse.blocks not being an array', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, { blocks: 'not-array' })
    expect(r.plot_response_source).toBe('unavailable')
  })

  it('handles block missing type field', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      blocks: [{ enrichment: { factor_sensitivity: [] } }],
    })
    expect(r.plot_response_source).toBe('unavailable')
  })

  it('handles block.enrichment not being an object', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      blocks: [{ type: 'analysis_result', enrichment: 'string-not-object' }],
    })
    expect(r.plot_response_source).toBe('unavailable')
  })

  it('handles top-level plot_response being an array (not object)', () => {
    const r = resolveScientificEvidence(
      { plot_response: [], isl_request: null, isl_response: null },
      null,
    )
    // Array is NOT a plain object — defensive guard rejects it.
    expect(r.plot_response_source).toBe('unavailable')
  })

  it('handles null/undefined block.enrichment', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      blocks: [{ type: 'analysis_result', enrichment: null }],
    })
    expect(r.plot_response_source).toBe('unavailable')
  })
})
