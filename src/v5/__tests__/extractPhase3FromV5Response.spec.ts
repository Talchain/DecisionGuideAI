/**
 * extractPhase3FromV5Response — extractor tests.
 *
 * v5-canonical-analysis brief PR 1 correction 4: raw Phase 3 blocks must
 * be preserved verbatim (no flattening of freshness, action_intent,
 * priority_rank, target_refs, graph_hash_at_generation).
 *
 * Correction 3: analysis_ready alone is not proof of a run_analysis fact.
 */
import { describe, it, expect } from 'vitest'

import type { OlumiResponse } from '@talchain/schemas/boundary'

import {
  ADDITIVE_EXTENSIONS_KEY,
  type OlumiResponseWithExtensions,
} from '../responseParser'
import {
  extractPhase3FromV5Response,
  v5ResponseHasRunAnalysisFact,
} from '../extractPhase3FromV5Response'

function baseResponse(overrides: Partial<OlumiResponse> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    ...overrides,
  } as OlumiResponse
}

function attachExtensions(
  response: OlumiResponse,
  extensions: Record<string, unknown>,
): OlumiResponseWithExtensions {
  const target = response as OlumiResponseWithExtensions
  Object.defineProperty(target, ADDITIVE_EXTENSIONS_KEY, {
    value: Object.freeze(extensions),
    enumerable: false,
    writable: false,
    configurable: false,
  })
  return target
}

describe('extractPhase3FromV5Response', () => {
  it('returns empty extraction when no Phase 3 content is present', () => {
    const r = extractPhase3FromV5Response(baseResponse())
    expect(r.rawBlocks).toEqual([])
    expect(r.guidanceItems).toEqual([])
    expect(r.analysisFreshness).toBeNull()
    expect(r.hasRunAnalysisFact).toBeNull()
  })

  it('preserves freshness, action_intent, priority_rank, target_refs, graph_hash_at_generation in raw block', () => {
    const coachingBlock = {
      type: 'coaching',
      id: 'c-1',
      title: 'Validate factor source',
      detail: 'The factor was inferred — confirm before relying on it.',
      action_intent: 'open_inspector',
      priority_rank: 3,
      target_refs: [
        { type: 'node', id: 'node-A', label: 'Factor A' },
        { type: 'node', id: 'node-B' },
      ],
      graph_hash_at_generation: 'graph-abc',
      analysis_hash: 'analysis-xyz',
    }
    const response = attachExtensions(baseResponse(), {
      phase3_blocks: [coachingBlock],
    })
    const r = extractPhase3FromV5Response(response)
    expect(r.rawBlocks).toHaveLength(1)
    expect(r.rawBlocks[0].raw).toEqual(coachingBlock)
    expect(r.rawBlocks[0].type).toBe('coaching')
    expect(r.rawBlocks[0].source).toBe('sidecar')

    // Derived guidance item — surfaces what the AI panel needs, but the
    // raw block above is intact for any consumer that wants full fidelity.
    expect(r.guidanceItems).toHaveLength(1)
    const g = r.guidanceItems[0]
    expect(g.title).toBe('Validate factor source')
    expect(g.target_object).toEqual({ type: 'node', id: 'node-A', label: 'Factor A' })
    expect(g.related_elements).toEqual([{ id: 'node-B', type: 'node' }])
    expect(g.valid_while).toEqual({
      analysis_hash: 'analysis-xyz',
      graph_hash: 'graph-abc',
    })
    // priority_rank 3 → 100 - 3 = 97
    expect(g.priority).toBe(97)
  })

  it('reads Phase 3 content from analysis_ready passthrough', () => {
    const response = baseResponse({
      analysis_ready: {
        status: 'ready',
        options: [{ id: 'opt-1' }],
        goal_node_id: 'goal',
        coaching: [
          {
            id: 'cc-1',
            title: 'Watch out for fragile edges',
            category: 'should_fix',
          },
        ],
      } as unknown as OlumiResponse['analysis_ready'],
    })
    const r = extractPhase3FromV5Response(response)
    expect(r.rawBlocks).toHaveLength(1)
    expect(r.rawBlocks[0].source).toBe('analysis_ready')
    expect(r.rawBlocks[0].type).toBe('coaching')
  })

  it('reads Phase 3 content from analysis_result.enrichment', () => {
    const response = baseResponse({
      blocks: [
        {
          type: 'analysis_result',
          summary: 'analysis',
          leading_option_id: 'opt-1',
          enrichment: {
            review_card: {
              id: 'rc-1',
              title: 'Decision review summary',
              summary: 'Looks solid.',
            },
          },
        },
      ],
    })
    const r = extractPhase3FromV5Response(response)
    expect(r.rawBlocks).toHaveLength(1)
    expect(r.rawBlocks[0].type).toBe('review_card')
    expect(r.rawBlocks[0].source).toBe('enrichment')
  })

  it('deduplicates by id across sources, preferring earliest seen', () => {
    const response = attachExtensions(
      baseResponse({
        analysis_ready: {
          status: 'ready',
          options: [{ id: 'opt-1' }],
          goal_node_id: 'goal',
          coaching: [{ id: 'shared', title: 'From analysis_ready' }],
        } as unknown as OlumiResponse['analysis_ready'],
      }),
      { phase3_blocks: [{ type: 'coaching', id: 'shared', title: 'From sidecar' }] },
    )
    const r = extractPhase3FromV5Response(response)
    expect(r.rawBlocks).toHaveLength(1)
    expect(r.rawBlocks[0].raw).toMatchObject({ title: 'From sidecar' })
    expect(r.rawBlocks[0].source).toBe('sidecar')
  })

  it('extracts hasRunAnalysisFact and freshness from sidecar', () => {
    const response = attachExtensions(baseResponse(), {
      analysis_freshness: 'fresh',
      has_run_analysis_fact: true,
      freshness_reason: 'just_minted',
    })
    const r = extractPhase3FromV5Response(response)
    expect(r.analysisFreshness).toBe('fresh')
    expect(r.hasRunAnalysisFact).toBe(true)
    expect(r.freshnessReason).toBe('just_minted')
  })

  it('extracts hasRunAnalysisFact and freshness from analysis_ready when sidecar is absent', () => {
    const response = baseResponse({
      analysis_ready: {
        status: 'ready',
        options: [{ id: 'opt-1' }],
        goal_node_id: 'goal',
        analysis_freshness: 'none',
        has_run_analysis_fact: false,
        freshness_reason: 'no_successful_run_analysis_fact',
      } as unknown as OlumiResponse['analysis_ready'],
    })
    const r = extractPhase3FromV5Response(response)
    expect(r.analysisFreshness).toBe('none')
    expect(r.hasRunAnalysisFact).toBe(false)
    expect(r.freshnessReason).toBe('no_successful_run_analysis_fact')
  })

  it('correction 3: ready analysis_ready alone does NOT yield hasRunAnalysisFact=true', () => {
    const response = baseResponse({
      analysis_ready: {
        status: 'ready',
        options: [{ id: 'opt-1' }],
        goal_node_id: 'goal',
      } as unknown as OlumiResponse['analysis_ready'],
    })
    const r = extractPhase3FromV5Response(response)
    expect(r.hasRunAnalysisFact).toBeNull()
    expect(r.analysisFreshness).toBeNull()
    expect(v5ResponseHasRunAnalysisFact(response, r)).toBe(false)
  })
})

describe('v5ResponseHasRunAnalysisFact', () => {
  it('returns true when CEE explicitly emits has_run_analysis_fact=true', () => {
    const response = attachExtensions(
      baseResponse({
        blocks: [{ type: 'analysis_result', summary: '', leading_option_id: null }],
      }),
      { has_run_analysis_fact: true },
    )
    expect(v5ResponseHasRunAnalysisFact(response)).toBe(true)
  })

  it('returns true when freshness=fresh AND an analysis_result block exists', () => {
    const response = attachExtensions(
      baseResponse({
        blocks: [{ type: 'analysis_result', summary: '', leading_option_id: null }],
      }),
      { analysis_freshness: 'fresh' },
    )
    expect(v5ResponseHasRunAnalysisFact(response)).toBe(true)
  })

  it('returns false when freshness=fresh but NO analysis_result block', () => {
    const response = attachExtensions(baseResponse(), {
      analysis_freshness: 'fresh',
    })
    expect(v5ResponseHasRunAnalysisFact(response)).toBe(false)
  })

  it('returns false when CEE explicitly emits has_run_analysis_fact=false', () => {
    const response = attachExtensions(
      baseResponse({
        blocks: [{ type: 'analysis_result', summary: '', leading_option_id: null }],
      }),
      { has_run_analysis_fact: false, analysis_freshness: 'fresh' },
    )
    // hasRunAnalysisFact=false short-circuits before freshness check.
    expect(v5ResponseHasRunAnalysisFact(response)).toBe(false)
  })
})
