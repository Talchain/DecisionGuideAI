/**
 * hydrateAnalysis tests — P0-1 analysis hydration on load
 *
 * Tests the pure V2RunResponse → store state mapping.
 */

import { describe, it, expect } from 'vitest'
import {
  hydrateAnalysisFromV2Response,
  extractM1ReviewFromV2,
  extractM1CoachingFromV2,
} from '../hydrateAnalysis'
import type { V2RunResponse } from '../../adapters/plot/v2/types'
import type { AnalysisProvenance } from '../../types/scenario'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal valid V2RunResponse that passes isValidV2RunResponse */
function makeMinimalV2Response(overrides?: Partial<V2RunResponse>): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'unavailable',
    drivers_status: 'unavailable',
    option_comparison: [
      {
        option_id: 'opt-1',
        option_label: 'Option A',
        confidence_interval: [0.3, 0.7],
        expected_outcome: 0.5,
      },
    ],
    critiques: [],
    response_hash: 'abc123',
    ...overrides,
  } as V2RunResponse
}

function makeProvenance(overrides?: Partial<AnalysisProvenance>): AnalysisProvenance {
  return {
    graph_hash: 'graph-hash-1',
    seed_used: 42,
    response_hash: 'resp-hash-prov',
    analysed_at: '2026-02-20T10:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// hydrateAnalysisFromV2Response
// ---------------------------------------------------------------------------

describe('hydrateAnalysisFromV2Response', () => {
  it('returns null for null input', () => {
    expect(hydrateAnalysisFromV2Response(null, null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(hydrateAnalysisFromV2Response(undefined, null)).toBeNull()
  })

  it('returns null for empty object (missing required fields)', () => {
    expect(hydrateAnalysisFromV2Response({}, null)).toBeNull()
  })

  it('returns hydrated state for minimal valid V2RunResponse', () => {
    const v2 = makeMinimalV2Response()
    const result = hydrateAnalysisFromV2Response(v2, null)

    expect(result).not.toBeNull()
    expect(result!.results.status).toBe('complete')
    expect(result!.results.progress).toBe(100)
    expect(result!.results.error).toBeUndefined()
    expect(result!.results.hash).toBe('abc123')
    expect(result!.results.seed).toBe(0) // no provenance, no meta
    expect(result!.results.report).toBeDefined()
  })

  it('maps seed and hash from provenance when provided', () => {
    const v2 = makeMinimalV2Response()
    const prov = makeProvenance({ seed_used: 99, response_hash: 'prov-hash' })
    const result = hydrateAnalysisFromV2Response(v2, prov)

    expect(result!.results.seed).toBe(99)
    expect(result!.results.hash).toBe('prov-hash')
  })

  it('maps analysed_at to startedAt/finishedAt timestamps', () => {
    const v2 = makeMinimalV2Response()
    const prov = makeProvenance({ analysed_at: '2026-02-20T10:00:00Z' })
    const result = hydrateAnalysisFromV2Response(v2, prov)

    const expectedMs = new Date('2026-02-20T10:00:00Z').getTime()
    expect(result!.results.startedAt).toBe(expectedMs)
    expect(result!.results.finishedAt).toBe(expectedMs)
  })

  it('leaves startedAt/finishedAt undefined when no provenance', () => {
    const v2 = makeMinimalV2Response()
    const result = hydrateAnalysisFromV2Response(v2, null)

    expect(result!.results.startedAt).toBeUndefined()
    expect(result!.results.finishedAt).toBeUndefined()
  })

  it('falls back seed from v2Response.meta.seed_used when no provenance', () => {
    const v2 = makeMinimalV2Response({
      meta: { seed_used: '77' } as any,
    })
    const result = hydrateAnalysisFromV2Response(v2, null)

    expect(result!.results.seed).toBe(77)
  })

  it('populates runMeta.ceeReviewV1 for computed analysis', () => {
    const v2 = makeMinimalV2Response()
    const result = hydrateAnalysisFromV2Response(v2, null)

    // synthesizeCeeReviewFromV2 returns non-null for 'computed' status
    expect(result!.runMeta.ceeReviewV1).toBeDefined()
    expect(result!.runMeta.ceeErrorV1).toBeNull()
  })

  it('populates runMeta.m1Review when cee_status is present', () => {
    const v2 = makeMinimalV2Response({
      cee_status: 'complete',
      decision_quality: { score: 0.8, level: 'good', summary: 'Good' } as any,
    })
    const result = hydrateAnalysisFromV2Response(v2, null)

    expect(result!.runMeta.m1Review).not.toBeNull()
    expect(result!.runMeta.m1Review!.cee_status).toBe('complete')
  })

  it('sets m1Review to null when cee_status is skipped', () => {
    const v2 = makeMinimalV2Response({ cee_status: 'skipped' })
    const result = hydrateAnalysisFromV2Response(v2, null)

    expect(result!.runMeta.m1Review).toBeNull()
  })

  it('populates m1Coaching when m1_coaching is present', () => {
    const v2 = makeMinimalV2Response({
      m1_coaching: {
        executive_summary: { headline: 'Test' },
        story_headlines: {},
        evidence_gaps: [],
        next_actions: [],
        assumptions_ledger: [],
      } as any,
    })
    const result = hydrateAnalysisFromV2Response(v2, null)

    expect(result!.runMeta.m1Coaching).not.toBeNull()
  })

  it('sets m1Coaching to null when m1_coaching absent', () => {
    const v2 = makeMinimalV2Response()
    const result = hydrateAnalysisFromV2Response(v2, null)

    expect(result!.runMeta.m1Coaching).toBeNull()
  })

  it('rejects non-object data', () => {
    expect(hydrateAnalysisFromV2Response('not-an-object', null)).toBeNull()
    expect(hydrateAnalysisFromV2Response(42, null)).toBeNull()
    expect(hydrateAnalysisFromV2Response(true, null)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// extractM1ReviewFromV2
// ---------------------------------------------------------------------------

describe('extractM1ReviewFromV2', () => {
  it('returns null when cee_status is absent (defaults to skipped)', () => {
    const v2 = makeMinimalV2Response()
    expect(extractM1ReviewFromV2(v2)).toBeNull()
  })

  it('returns null when cee_status is explicitly skipped', () => {
    const v2 = makeMinimalV2Response({ cee_status: 'skipped' })
    expect(extractM1ReviewFromV2(v2)).toBeNull()
  })

  it('extracts fields when cee_status is complete', () => {
    const v2 = makeMinimalV2Response({
      cee_status: 'complete',
      rationale: { summary: 'test rationale' } as any,
    })
    const result = extractM1ReviewFromV2(v2)

    expect(result).not.toBeNull()
    expect(result!.cee_status).toBe('complete')
    expect(result!.rationale).toEqual({ summary: 'test rationale' })
  })
})

// ---------------------------------------------------------------------------
// extractM1CoachingFromV2
// ---------------------------------------------------------------------------

describe('extractM1CoachingFromV2', () => {
  it('returns null when m1_coaching is absent', () => {
    const v2 = makeMinimalV2Response()
    expect(extractM1CoachingFromV2(v2)).toBeNull()
  })

  it('extracts coaching fields with defaults', () => {
    const v2 = makeMinimalV2Response({
      m1_coaching: {
        executive_summary: { headline: 'H', body: 'B' },
      } as any,
    })
    const result = extractM1CoachingFromV2(v2)

    expect(result).not.toBeNull()
    expect(result!.executive_summary).toEqual({ headline: 'H', body: 'B' })
    expect(result!.evidence_gaps).toEqual([])
    expect(result!.next_actions).toEqual([])
    expect(result!.story_headlines).toEqual({})
  })
})
