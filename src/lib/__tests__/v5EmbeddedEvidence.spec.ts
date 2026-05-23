/**
 * Unit tests for `src/lib/v5EmbeddedEvidence.ts` —
 * `resolveScientificEvidence` precedence + `_meta.payloads`
 * probing + path-boundary + malformed-input safety.
 *
 * Post-PR #162 + R-2 review follow-up. Resolver shape:
 *
 *   resolveScientificEvidence(topLevel, ceeResponse) →
 *     {
 *       bodies: { plot_request, plot_response, isl_request, isl_response },
 *       resolution: {
 *         plot_request:  { source, path, available, required_upstream_support, notes },
 *         plot_response: { source, path, available, required_upstream_support, notes },
 *         isl_request:   { source, path, available, required_upstream_support, notes },
 *         isl_response:  { source, path, available, required_upstream_support, notes },
 *       },
 *     }
 *
 * Bodies and metadata kept in separate buckets so the bundle's
 * `evidence_resolution` field stays purely metadata; bodies flow
 * into validators only.
 */

import { describe, it, expect } from 'vitest'

import {
  resolveScientificEvidence,
  type EvidenceResolutionReport,
} from '../v5EmbeddedEvidence'
import realCeeShape from '../../v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json'

const EMPTY_TOP_LEVEL = {
  plot_request: null,
  plot_response: null,
  isl_request: null,
  isl_response: null,
}

describe('resolveScientificEvidence — top-level precedence', () => {
  it('top-level plot_response wins regardless of CEE content', () => {
    const r = resolveScientificEvidence(
      {
        ...EMPTY_TOP_LEVEL,
        plot_response: { factor_sensitivity: [{ factor_id: 'top' }] },
      },
      realCeeShape,
    )
    expect(r.bodies.plot_response).toEqual({
      factor_sensitivity: [{ factor_id: 'top' }],
    })
    expect(r.resolution.plot_response.source).toBe('top_level')
    expect(r.resolution.plot_response.path).toBe('payloads.plot_response')
    expect(r.resolution.plot_response.available).toBe(true)
    expect(r.resolution.plot_response.required_upstream_support).toBeNull()
  })

  it('top-level plot_request wins (no embedded fallback for request)', () => {
    const r = resolveScientificEvidence(
      {
        ...EMPTY_TOP_LEVEL,
        plot_request: { graph: { nodes: [] } },
      },
      null,
    )
    expect(r.bodies.plot_request).toEqual({ graph: { nodes: [] } })
    expect(r.resolution.plot_request.source).toBe('top_level')
    expect(r.resolution.plot_request.path).toBe('payloads.plot_request')
  })

  it('top-level isl_request wins', () => {
    const r = resolveScientificEvidence(
      {
        ...EMPTY_TOP_LEVEL,
        isl_request: { parameter_uncertainties: { f1: { std: 0.1 } } },
      },
      null,
    )
    expect(r.resolution.isl_request.source).toBe('top_level')
    expect(r.resolution.isl_request.path).toBe('payloads.isl_request')
  })

  it('top-level isl_response wins', () => {
    const r = resolveScientificEvidence(
      {
        ...EMPTY_TOP_LEVEL,
        isl_response: { factor_sensitivity: [{ factor_id: 'f1' }] },
      },
      null,
    )
    expect(r.resolution.isl_response.source).toBe('top_level')
    expect(r.resolution.isl_response.path).toBe('payloads.isl_response')
  })
})

describe('resolveScientificEvidence — _meta.payloads sidecar (Blocker 1)', () => {
  // The reviewer's R-2 Blocker 1: the resolver MUST probe
  // `enrichment._meta.payloads.<kind>` for each evidence kind.
  // These tests prove it.

  const ceeWithMeta = {
    blocks: [
      {
        type: 'analysis_result',
        enrichment: {
          // Bare enrichment also has indicative keys — to prove
          // `_meta.payloads.plot_response` is preferred over the
          // bare enrichment (closer to upstream shape).
          factor_sensitivity: [
            { factor_id: 'from_bare', sensitivity_score: 0.1 },
          ],
          _meta: {
            payloads: {
              plot_request: { graph: { nodes: [{ id: 'meta_node' }] } },
              plot_response: {
                factor_sensitivity: [
                  {
                    factor_id: 'from_meta',
                    confidence_provenance: { computation_source: 'plot' },
                  },
                ],
                flip_thresholds_status: 'computed',
              },
              isl_request: {
                parameter_uncertainties: { f1: { std: 0.2 } },
              },
              isl_response: {
                factor_sensitivity: [
                  { factor_id: 'from_meta_isl', evpi_percentage_points: 5.2 },
                ],
              },
            },
          },
        },
      },
    ],
  }

  it('lifts plot_request from _meta.payloads.plot_request', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeWithMeta)
    expect(r.bodies.plot_request).toEqual({
      graph: { nodes: [{ id: 'meta_node' }] },
    })
    expect(r.resolution.plot_request.source).toBe('cee_embedded')
    expect(r.resolution.plot_request.path).toBe(
      'payloads.cee_response.blocks[0].enrichment._meta.payloads.plot_request',
    )
  })

  it('lifts plot_response from _meta.payloads.plot_response in PREFERENCE to bare enrichment', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeWithMeta)
    // The bare enrichment ALSO has a `factor_sensitivity` (from
    // `from_bare`); the resolver MUST pick the `_meta.payloads`
    // version (from `from_meta`) because it's closer to upstream shape.
    expect(
      (r.bodies.plot_response as Record<string, unknown>)?.factor_sensitivity,
    ).toEqual([
      {
        factor_id: 'from_meta',
        confidence_provenance: { computation_source: 'plot' },
      },
    ])
    expect(r.resolution.plot_response.source).toBe('cee_embedded')
    expect(r.resolution.plot_response.path).toBe(
      'payloads.cee_response.blocks[0].enrichment._meta.payloads.plot_response',
    )
  })

  it('lifts isl_request from _meta.payloads.isl_request', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeWithMeta)
    expect(r.bodies.isl_request).toEqual({
      parameter_uncertainties: { f1: { std: 0.2 } },
    })
    expect(r.resolution.isl_request.source).toBe('cee_embedded')
    expect(r.resolution.isl_request.path).toBe(
      'payloads.cee_response.blocks[0].enrichment._meta.payloads.isl_request',
    )
  })

  it('lifts isl_response from _meta.payloads.isl_response (preferred over downstream_calls)', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeWithMeta)
    expect(r.resolution.isl_response.source).toBe('cee_embedded')
    expect(r.resolution.isl_response.path).toBe(
      'payloads.cee_response.blocks[0].enrichment._meta.payloads.isl_response',
    )
  })

  it('rejects malformed _meta.payloads (non-object) — falls through to next branch', () => {
    const ceeMalformedMeta = {
      blocks: [
        {
          type: 'analysis_result',
          enrichment: {
            factor_sensitivity: [{ factor_id: 'enr_only' }],
            _meta: { payloads: 'not-an-object' },
          },
        },
      ],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeMalformedMeta)
    // _meta.payloads is non-object → falls through to bare enrichment.
    expect(r.resolution.plot_response.source).toBe('cee_embedded')
    expect(r.resolution.plot_response.path).toBe(
      'payloads.cee_response.blocks[0].enrichment',
    )
  })

  it('rejects _meta.payloads.plot_response when it lacks indicative keys', () => {
    // The plot_response indicative-keys gate applies to the sidecar
    // path too — an empty/placeholder body must NOT be promoted.
    const ceeEmptyMetaPlotResponse = {
      blocks: [
        {
          type: 'analysis_result',
          enrichment: {
            // Bare enrichment lacks indicative keys.
            summary: 'no indicative keys here',
            _meta: {
              payloads: {
                // _meta sidecar plot_response also lacks indicative keys.
                plot_response: { unrelated_key: 'placeholder' },
              },
            },
          },
        },
      ],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeEmptyMetaPlotResponse)
    expect(r.resolution.plot_response.source).toBe('unavailable')
    expect(r.bodies.plot_response).toBeNull()
  })

  it('rejects _meta.payloads.<kind> when the body is an empty object', () => {
    const ceeEmptyMetaIsl = {
      blocks: [
        {
          type: 'analysis_result',
          enrichment: {
            _meta: { payloads: { isl_request: {} } },
          },
        },
      ],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeEmptyMetaIsl)
    expect(r.resolution.isl_request.source).toBe('unavailable')
  })
})

describe('resolveScientificEvidence — bare enrichment fallback (existing path)', () => {
  it('lifts bare enrichment as plot_response when top-level + _meta absent (real staging fixture)', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, realCeeShape)
    expect(r.bodies.plot_response).not.toBeNull()
    expect(r.resolution.plot_response.source).toBe('cee_embedded')
    expect(r.resolution.plot_response.path).toMatch(
      /^payloads\.cee_response\.blocks\[\d+\]\.enrichment$/,
    )
    // Sanity: the lifted body carries the fixture's enrichment keys.
    expect(
      (r.bodies.plot_response as Record<string, unknown>)?.factor_sensitivity,
    ).toBeDefined()
    expect(
      (r.bodies.plot_response as Record<string, unknown>)?.option_comparison,
    ).toBeDefined()
    expect(
      (r.bodies.plot_response as Record<string, unknown>)?.robustness,
    ).toBeDefined()
  })

  it('lifts isl_response from downstream_calls.isl.response when _meta sidecar absent', () => {
    const ceeWithDownstream = {
      blocks: [
        {
          type: 'analysis_result',
          enrichment: {
            factor_sensitivity: [{ factor_id: 'f1' }],
            downstream_calls: {
              isl: {
                response: {
                  factor_sensitivity: [
                    { factor_id: 'isl', evpi_percentage_points: 5.2 },
                  ],
                },
              },
            },
          },
        },
      ],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeWithDownstream)
    expect(r.resolution.isl_response.source).toBe('cee_embedded')
    expect(r.resolution.isl_response.path).toBe(
      'payloads.cee_response.blocks[0].enrichment.downstream_calls.isl.response',
    )
  })

  it('picks the FIRST analysis_result block when multiple exist', () => {
    const ceeMulti = {
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
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeMulti)
    expect(
      (r.bodies.plot_response as Record<string, unknown>)?.factor_sensitivity,
    ).toEqual([{ factor_id: 'first' }])
    expect(r.resolution.plot_response.path).toBe(
      'payloads.cee_response.blocks[1].enrichment',
    )
  })
})

describe('resolveScientificEvidence — indicative-keys gate (no synthesis)', () => {
  it('does NOT promote bare enrichment that lacks indicative keys', () => {
    const ceeNoKeys = {
      blocks: [
        {
          type: 'analysis_result',
          enrichment: { summary: 'noise', leading_option_id: 'opt_1' },
        },
      ],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeNoKeys)
    expect(r.resolution.plot_response.source).toBe('unavailable')
    expect(r.bodies.plot_response).toBeNull()
  })

  it('does NOT promote enrichment={} (empty)', () => {
    const ceeEmpty = {
      blocks: [{ type: 'analysis_result', enrichment: {} }],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeEmpty)
    expect(r.resolution.plot_response.source).toBe('unavailable')
  })

  it('promotes enrichment when ONLY robustness is present (single key suffices)', () => {
    const ceeRobOnly = {
      blocks: [
        {
          type: 'analysis_result',
          enrichment: { robustness: { fragile_edges: [] } },
        },
      ],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, ceeRobOnly)
    expect(r.resolution.plot_response.source).toBe('cee_embedded')
  })
})

describe('resolveScientificEvidence — unavailable + metadata shape', () => {
  it('returns all unavailable + populated metadata when nothing is present', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, null)
    // Bodies are null.
    expect(r.bodies.plot_request).toBeNull()
    expect(r.bodies.plot_response).toBeNull()
    expect(r.bodies.isl_request).toBeNull()
    expect(r.bodies.isl_response).toBeNull()
    // Each metadata entry reports unavailable + null path +
    // available=false + non-null required_upstream_support + a
    // non-empty diagnostic note.
    const kinds = [
      r.resolution.plot_request,
      r.resolution.plot_response,
      r.resolution.isl_request,
      r.resolution.isl_response,
    ]
    for (const e of kinds) {
      expect(e.source).toBe('unavailable')
      expect(e.path).toBeNull()
      expect(e.available).toBe(false)
      expect(typeof e.required_upstream_support).toBe('string')
      expect((e.required_upstream_support as string).length).toBeGreaterThan(0)
      expect(typeof e.notes).toBe('string')
      expect(e.notes.length).toBeGreaterThan(0)
    }
    // Type-anchor for EvidenceResolutionReport import.
    const _typed: EvidenceResolutionReport = r.resolution
    expect(_typed).toBe(r.resolution)
  })

  it('available=false ↔ required_upstream_support is non-null (invariant)', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, null)
    for (const e of [
      r.resolution.plot_request,
      r.resolution.plot_response,
      r.resolution.isl_request,
      r.resolution.isl_response,
    ]) {
      // Strict iff: available iff required_upstream_support is null.
      expect(e.available === (e.required_upstream_support === null)).toBe(true)
    }
  })
})

describe('resolveScientificEvidence — mixed sources', () => {
  it('top-level PLoT + embedded ISL via downstream_calls', () => {
    const r = resolveScientificEvidence(
      {
        ...EMPTY_TOP_LEVEL,
        plot_response: { factor_sensitivity: [{ factor_id: 'top' }] },
      },
      {
        blocks: [
          {
            type: 'analysis_result',
            enrichment: {
              factor_sensitivity: [{ factor_id: 'emb' }],
              downstream_calls: {
                isl: { response: { factor_sensitivity: [{ factor_id: 'isl' }] } },
              },
            },
          },
        ],
      },
    )
    // PLoT from top-level.
    expect(r.resolution.plot_response.source).toBe('top_level')
    // ISL from embedded.
    expect(r.resolution.isl_response.source).toBe('cee_embedded')
  })
})

describe('resolveScientificEvidence — malformed-input safety', () => {
  it('handles non-object ceeResponse without throwing', () => {
    expect(() => resolveScientificEvidence(EMPTY_TOP_LEVEL, 'bad')).not.toThrow()
    expect(() => resolveScientificEvidence(EMPTY_TOP_LEVEL, 42)).not.toThrow()
    expect(() => resolveScientificEvidence(EMPTY_TOP_LEVEL, [])).not.toThrow()
  })

  it('handles ceeResponse.blocks not being an array', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, { blocks: 'no' })
    expect(r.resolution.plot_response.source).toBe('unavailable')
  })

  it('handles block missing type field', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      blocks: [{ enrichment: { factor_sensitivity: [] } }],
    })
    expect(r.resolution.plot_response.source).toBe('unavailable')
  })

  it('handles block.enrichment not being an object', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      blocks: [{ type: 'analysis_result', enrichment: 'string' }],
    })
    expect(r.resolution.plot_response.source).toBe('unavailable')
  })

  it('handles top-level plot_response being an array (defensively rejected)', () => {
    const r = resolveScientificEvidence(
      { ...EMPTY_TOP_LEVEL, plot_response: [] },
      null,
    )
    expect(r.resolution.plot_response.source).toBe('unavailable')
  })

  it('handles null/undefined block.enrichment', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      blocks: [{ type: 'analysis_result', enrichment: null }],
    })
    expect(r.resolution.plot_response.source).toBe('unavailable')
  })
})

/**
 * PR #169 — parse-error wrapper coverage.
 *
 * `src/v5/responseParser.ts` wraps the original CEE body when the
 * OlumiResponse schema fails:
 *
 *     { kind: 'parse_error', reason: '...', raw: <original CEE body> }
 *
 * Manual staging validation of PR #168 (commit `5e9847db`,
 * 2026-05-21) showed this in the wild — the bundle had
 * `payloads.cee_response.kind === 'parse_error'` with full
 * enrichment under `payloads.cee_response.raw.blocks[0].enrichment`.
 * Pre-fix the resolver only probed `cee_response.blocks[*]` and
 * therefore marked `plot_response.source === 'unavailable'`. These
 * tests pin the fallback probe.
 */
describe('resolveScientificEvidence — parse-error wrapper (PR #169)', () => {
  const wrappedEnrichment = {
    factor_sensitivity: [
      { factor_id: 'wrapped-f1', sensitivity_score: 0.42 },
    ],
    option_comparison: [
      { id: 'wrapped-o1', win_probability: 0.61 },
    ],
    robustness: { is_robust: true, level: 'high' },
  }

  const parseErrorBody = {
    kind: 'parse_error',
    reason: 'body did not match OlumiResponse schema',
    raw: {
      blocks: [
        {
          type: 'analysis_result',
          summary: 'wrapped',
          enrichment: wrappedEnrichment,
        },
      ],
    },
  }

  it('lifts bare enrichment from `cee_response.raw.blocks[*].enrichment`', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, parseErrorBody)
    expect(r.resolution.plot_response.source).toBe('cee_embedded')
    expect(r.resolution.plot_response.path).toBe(
      'payloads.cee_response.raw.blocks[0].enrichment',
    )
    expect(r.resolution.plot_response.available).toBe(true)
    expect(r.resolution.plot_response.required_upstream_support).toBeNull()
    expect(r.bodies.plot_response).toEqual(wrappedEnrichment)
  })

  it('lifts `_meta.payloads.plot_response` sidecar from inside the wrapper', () => {
    const sidecarPlot = {
      factor_sensitivity: [{ factor_id: 'sidecar-f1' }],
      confidence_provenance: { foo: 'bar' },
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      kind: 'parse_error',
      reason: 'whatever',
      raw: {
        blocks: [
          {
            type: 'analysis_result',
            enrichment: {
              ...wrappedEnrichment,
              _meta: { payloads: { plot_response: sidecarPlot } },
            },
          },
        ],
      },
    })
    expect(r.resolution.plot_response.source).toBe('cee_embedded')
    expect(r.resolution.plot_response.path).toBe(
      'payloads.cee_response.raw.blocks[0].enrichment._meta.payloads.plot_response',
    )
    expect(r.bodies.plot_response).toEqual(sidecarPlot)
  })

  it('lifts `downstream_calls.isl.response` from inside the wrapper', () => {
    const downstreamIslResp = {
      factor_sensitivity: [{ factor_id: 'isl-f1', elasticity: 0.3 }],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      kind: 'parse_error',
      reason: 'whatever',
      raw: {
        blocks: [
          {
            type: 'analysis_result',
            enrichment: {
              ...wrappedEnrichment,
              downstream_calls: { isl: { response: downstreamIslResp } },
            },
          },
        ],
      },
    })
    expect(r.resolution.isl_response.source).toBe('cee_embedded')
    expect(r.resolution.isl_response.path).toBe(
      'payloads.cee_response.raw.blocks[0].enrichment.downstream_calls.isl.response',
    )
    expect(r.bodies.isl_response).toEqual(downstreamIslResp)
  })

  it('lifts ISL request from `_meta.payloads.isl_request` inside the wrapper', () => {
    const sidecarIslReq = {
      parameter_uncertainties: [{ name: 'p1', std: 0.1 }],
    }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      kind: 'parse_error',
      reason: 'x',
      raw: {
        blocks: [
          {
            type: 'analysis_result',
            enrichment: {
              ...wrappedEnrichment,
              _meta: { payloads: { isl_request: sidecarIslReq } },
            },
          },
        ],
      },
    })
    expect(r.resolution.isl_request.source).toBe('cee_embedded')
    expect(r.resolution.isl_request.path).toBe(
      'payloads.cee_response.raw.blocks[0].enrichment._meta.payloads.isl_request',
    )
    expect(r.bodies.isl_request).toEqual(sidecarIslReq)
  })

  it('top-level path WINS over wrapper — unwrapped blocks beat raw.blocks', () => {
    // Defensive: if both an unwrapped `.blocks` AND a `.raw.blocks` are
    // present, prefer the unwrapped form (it implies the body parsed
    // successfully, not the wrapper variant). Pre-fix this was the
    // only path the resolver knew about, so this test pins the
    // ordering rather than reversing it.
    const unwrappedEnrichment = { factor_sensitivity: [{ factor_id: 'unwrapped-f1' }] }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      blocks: [
        { type: 'analysis_result', enrichment: unwrappedEnrichment },
      ],
      // Defensive `raw.blocks` shouldn't be reached when top-level is good.
      raw: {
        blocks: [
          { type: 'analysis_result', enrichment: wrappedEnrichment },
        ],
      },
    })
    expect(r.resolution.plot_response.path).toBe(
      'payloads.cee_response.blocks[0].enrichment',
    )
    expect(r.bodies.plot_response).toEqual(unwrappedEnrichment)
  })

  it('top-level `payloads.plot_response` still beats the wrapper', () => {
    const topPlot = { factor_sensitivity: [{ factor_id: 'top' }] }
    const r = resolveScientificEvidence(
      { ...EMPTY_TOP_LEVEL, plot_response: topPlot },
      parseErrorBody,
    )
    expect(r.resolution.plot_response.source).toBe('top_level')
    expect(r.resolution.plot_response.path).toBe('payloads.plot_response')
    expect(r.bodies.plot_response).toEqual(topPlot)
  })

  it('parse-error wrapper without `raw` field → unavailable (no throw)', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      kind: 'parse_error',
      reason: 'no raw',
    })
    expect(r.resolution.plot_response.source).toBe('unavailable')
    expect(r.resolution.plot_response.required_upstream_support).not.toBeNull()
  })

  it('parse-error wrapper with `raw` but no analysis_result block → unavailable', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      kind: 'parse_error',
      reason: 'x',
      raw: {
        blocks: [
          { type: 'commentary', text: 'no analysis here' },
        ],
      },
    })
    expect(r.resolution.plot_response.source).toBe('unavailable')
  })

  it('parse-error wrapper with `raw.blocks` not an array → unavailable, no throw', () => {
    expect(() =>
      resolveScientificEvidence(EMPTY_TOP_LEVEL, {
        kind: 'parse_error',
        reason: 'x',
        raw: { blocks: 'not-an-array' },
      }),
    ).not.toThrow()
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      kind: 'parse_error',
      reason: 'x',
      raw: { blocks: 'not-an-array' },
    })
    expect(r.resolution.plot_response.source).toBe('unavailable')
  })

  it('wrapper enrichment WITHOUT indicative keys is NOT promoted (honesty gate preserved)', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      kind: 'parse_error',
      reason: 'x',
      raw: {
        blocks: [
          {
            type: 'analysis_result',
            // No factor_sensitivity / option_comparison / etc.
            enrichment: { summary: 'no science here' },
          },
        ],
      },
    })
    expect(r.resolution.plot_response.source).toBe('unavailable')
  })

  it('picks FIRST analysis_result inside wrapper when multiple exist', () => {
    const first = { factor_sensitivity: [{ factor_id: 'first' }] }
    const second = { factor_sensitivity: [{ factor_id: 'second' }] }
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      kind: 'parse_error',
      reason: 'x',
      raw: {
        blocks: [
          { type: 'commentary', text: 'noise' },
          { type: 'analysis_result', enrichment: first },
          { type: 'analysis_result', enrichment: second },
        ],
      },
    })
    expect(r.resolution.plot_response.path).toBe(
      'payloads.cee_response.raw.blocks[1].enrichment',
    )
    expect(r.bodies.plot_response).toEqual(first)
  })

  // PR #169 reviewer round-1 follow-up #1 — pin the intentionally
  // structural test in `findAnalysisResultBlock`. The fallback does
  // NOT require `kind === 'parse_error'`; it walks `ceeResponse.raw.blocks[*]`
  // whenever the unwrapped `.blocks` is absent. This is forward-compat
  // with potential CEE wrapper-shape evolution. The live-evidence
  // honesty contract is still owned by the downstream provenance gate
  // (R-2 Blocker 2) in `scientificValidation/index.ts`, so accepting a
  // non-parse_error wrapper here cannot mislabel as live by itself.
  it('resolves raw wrapper structurally even when kind !== parse_error (forward-compat)', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, {
      // Anything other than 'parse_error' — including completely
      // unknown wrapper shapes — must still resolve via raw.blocks.
      kind: 'something_else_unknown',
      raw: {
        blocks: [
          {
            type: 'analysis_result',
            enrichment: {
              factor_sensitivity: [{ factor_id: 'fwd-f1' }],
              robustness: { level: 'low' },
            },
          },
        ],
      },
    })
    expect(r.resolution.plot_response.source).toBe('cee_embedded')
    expect(r.resolution.plot_response.path).toBe(
      'payloads.cee_response.raw.blocks[0].enrichment',
    )
    expect(r.bodies.plot_response).toEqual({
      factor_sensitivity: [{ factor_id: 'fwd-f1' }],
      robustness: { level: 'low' },
    })
  })
})

describe('resolveScientificEvidence — ceeResponseBasePath parameter (evidence-trace split)', () => {
  // Workstream: DGAI debug output — preserve latest analysis
  // evidence after follow-up turns (2026-05-23). The bundle exposes
  // a recovered earlier CEE turn body under
  // `analysis_evidence_trace.response_body`. The resolver accepts
  // an optional `ceeResponseBasePath` so emitted `path` strings
  // truthfully point at the body it inspected — `'payloads.cee_response'`
  // by default (conversational), `'analysis_evidence_trace.response_body'`
  // when the caller routes a recovered body.
  const enrichmentBody = {
    blocks: [
      {
        type: 'analysis_result',
        enrichment: {
          factor_sensitivity: [{ factor_id: 'evidence-f1' }],
        },
      },
    ],
  }

  it('default base path: paths start with `payloads.cee_response.` (regression)', () => {
    const r = resolveScientificEvidence(EMPTY_TOP_LEVEL, enrichmentBody)
    expect(r.resolution.plot_response.source).toBe('cee_embedded')
    expect(r.resolution.plot_response.path).toBe(
      'payloads.cee_response.blocks[0].enrichment',
    )
  })

  it('explicit default param: behaves identically to omitted', () => {
    const r = resolveScientificEvidence(
      EMPTY_TOP_LEVEL,
      enrichmentBody,
      'payloads.cee_response',
    )
    expect(r.resolution.plot_response.path).toBe(
      'payloads.cee_response.blocks[0].enrichment',
    )
  })

  it('custom base path: paths start with `analysis_evidence_trace.response_body.`', () => {
    const r = resolveScientificEvidence(
      EMPTY_TOP_LEVEL,
      enrichmentBody,
      'analysis_evidence_trace.response_body',
    )
    expect(r.resolution.plot_response.source).toBe('cee_embedded')
    expect(r.resolution.plot_response.path).toBe(
      'analysis_evidence_trace.response_body.blocks[0].enrichment',
    )
  })

  it('custom base path + _meta.payloads sidecar: nested path inherits the base', () => {
    const bodyWithSidecar = {
      blocks: [
        {
          type: 'analysis_result',
          enrichment: {
            // bare body lacks indicative keys to force sidecar path
            _meta: {
              payloads: {
                plot_response: {
                  factor_sensitivity: [{ factor_id: 'sidecar-f1' }],
                },
                isl_response: {
                  some: 'isl-body',
                },
              },
            },
          },
        },
      ],
    }
    const r = resolveScientificEvidence(
      EMPTY_TOP_LEVEL,
      bodyWithSidecar,
      'analysis_evidence_trace.response_body',
    )
    expect(r.resolution.plot_response.path).toBe(
      'analysis_evidence_trace.response_body.blocks[0].enrichment._meta.payloads.plot_response',
    )
    expect(r.resolution.isl_response.path).toBe(
      'analysis_evidence_trace.response_body.blocks[0].enrichment._meta.payloads.isl_response',
    )
  })

  it('custom base path + parse-error wrapper: `raw.blocks` segment preserved', () => {
    const wrappedBody = {
      kind: 'parse_error',
      reason: 'schema mismatch',
      raw: {
        blocks: [
          {
            type: 'analysis_result',
            enrichment: {
              factor_sensitivity: [{ factor_id: 'wrapped-f1' }],
            },
          },
        ],
      },
    }
    const r = resolveScientificEvidence(
      EMPTY_TOP_LEVEL,
      wrappedBody,
      'analysis_evidence_trace.response_body',
    )
    expect(r.resolution.plot_response.source).toBe('cee_embedded')
    expect(r.resolution.plot_response.path).toBe(
      'analysis_evidence_trace.response_body.raw.blocks[0].enrichment',
    )
  })

  it('custom base path: top-level payloads still take precedence (paths unchanged)', () => {
    const r = resolveScientificEvidence(
      {
        ...EMPTY_TOP_LEVEL,
        plot_response: { factor_sensitivity: [{ factor_id: 'top' }] },
      },
      enrichmentBody,
      'analysis_evidence_trace.response_body',
    )
    // Top-level beats embedded regardless of base path.
    expect(r.resolution.plot_response.source).toBe('top_level')
    expect(r.resolution.plot_response.path).toBe('payloads.plot_response')
  })
})
