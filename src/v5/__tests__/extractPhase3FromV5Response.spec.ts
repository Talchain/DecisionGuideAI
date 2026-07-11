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

describe('extractPhase3FromV5Response — contract target_refs (TargetRefSchema {id,label,kind})', () => {
  // The wire contract (@talchain/schemas TargetRefSchema §0.1, strict) emits
  // `kind` ∈ factor|option|edge|goal|risk|constraint|outcome — NOT the legacy
  // `type` ∈ node|edge|option|graph|framing convention this extractor
  // originally read. These tests pin the contract convention end-to-end.

  function coachingWithRefs(target_refs: unknown[]): OlumiResponseWithExtensions {
    return attachExtensions(baseResponse(), {
      phase3_blocks: [
        {
          type: 'coaching',
          id: 'c-refs',
          title: 'Check this element',
          target_refs,
        },
      ],
    })
  }

  it('derives target_object from a contract ref: kind=factor maps to node', () => {
    const r = extractPhase3FromV5Response(
      coachingWithRefs([{ id: 'node-77', label: 'Pricing', kind: 'factor' }]),
    )
    expect(r.guidanceItems).toHaveLength(1)
    expect(r.guidanceItems[0].target_object).toEqual({
      type: 'node',
      id: 'node-77',
      label: 'Pricing',
    })
  })

  it('maps kind=edge to edge and kind=option to option', () => {
    const edge = extractPhase3FromV5Response(
      coachingWithRefs([{ id: 'edge-3', label: 'Price → Churn', kind: 'edge' }]),
    )
    expect(edge.guidanceItems[0].target_object).toEqual({
      type: 'edge',
      id: 'edge-3',
      label: 'Price → Churn',
    })

    const option = extractPhase3FromV5Response(
      coachingWithRefs([{ id: 'opt-1', label: 'Acquire', kind: 'option' }]),
    )
    expect(option.guidanceItems[0].target_object).toEqual({
      type: 'option',
      id: 'opt-1',
      label: 'Acquire',
    })
  })

  it.each(['goal', 'risk', 'constraint', 'outcome'] as const)(
    'maps kind=%s to node (all non-edge, non-option kinds are canvas nodes)',
    (kind) => {
      const r = extractPhase3FromV5Response(
        coachingWithRefs([{ id: `el-${kind}`, label: `The ${kind}`, kind }]),
      )
      expect(r.guidanceItems[0].target_object).toEqual({
        type: 'node',
        id: `el-${kind}`,
        label: `The ${kind}`,
      })
    },
  )

  it('fails closed on an unknown kind — no target_object fabricated', () => {
    const r = extractPhase3FromV5Response(
      coachingWithRefs([{ id: 'x-1', label: 'Mystery', kind: 'galaxy' }]),
    )
    expect(r.guidanceItems).toHaveLength(1)
    expect(r.guidanceItems[0].target_object).toBeUndefined()
  })

  it('prefers contract kind over a stray legacy type when both are present', () => {
    const r = extractPhase3FromV5Response(
      coachingWithRefs([{ id: 'n-9', label: 'Both', kind: 'factor', type: 'edge' }]),
    )
    expect(r.guidanceItems[0].target_object).toEqual({
      type: 'node',
      id: 'n-9',
      label: 'Both',
    })
  })

  it('keeps the legacy type convention working when kind is absent', () => {
    const r = extractPhase3FromV5Response(
      coachingWithRefs([{ id: 'node-A', label: 'Legacy', type: 'node' }]),
    )
    expect(r.guidanceItems[0].target_object).toEqual({
      type: 'node',
      id: 'node-A',
      label: 'Legacy',
    })
  })

  it('tolerates a contract ref without id (label-only), matching the legacy branch', () => {
    const r = extractPhase3FromV5Response(
      coachingWithRefs([{ label: 'Label only', kind: 'factor' }]),
    )
    expect(r.guidanceItems[0].target_object).toEqual({
      type: 'node',
      label: 'Label only',
    })
  })

  it('maps kind onto related_elements type for refs beyond the first', () => {
    const r = extractPhase3FromV5Response(
      coachingWithRefs([
        { id: 'node-1', label: 'Primary', kind: 'factor' },
        { id: 'edge-2', label: 'Linked edge', kind: 'edge' },
        { id: 'risk-3', label: 'Linked risk', kind: 'risk' },
      ]),
    )
    expect(r.guidanceItems[0].related_elements).toEqual([
      { id: 'edge-2', type: 'edge', label: 'Linked edge' },
      { id: 'risk-3', type: 'node', label: 'Linked risk' },
    ])
  })

  it('omits related_elements type for an unknown kind but keeps id and label', () => {
    const r = extractPhase3FromV5Response(
      coachingWithRefs([
        { id: 'node-1', label: 'Primary', kind: 'factor' },
        { id: 'z-1', label: 'Future thing', kind: 'galaxy' },
      ]),
    )
    expect(r.guidanceItems[0].related_elements).toEqual([
      { id: 'z-1', label: 'Future thing' },
    ])
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
