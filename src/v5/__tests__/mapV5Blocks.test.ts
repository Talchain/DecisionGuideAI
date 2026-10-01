import { describe, it, expect } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { mapV5Blocks, mapV5Block } from '../blocks/mapV5Blocks'
import { mapV5AnalysisToReport, v5AnalysisBlockContentHash } from '../mapV5AnalysisToReport'

type V5Block = OlumiResponse['blocks'][number]

describe('mapV5Block — per-kind conversion', () => {
  it('text block → commentary', () => {
    const r = mapV5Block({ type: 'text', content: 'hello' })
    expect(r).toEqual({ type: 'commentary', text: 'hello' })
  })

  it('error block → null (handled upstream)', () => {
    const r = mapV5Block({
      type: 'error',
      error_code: 'INTERNAL_ERROR',
      severity: 'error',
    })
    expect(r).toBeNull()
  })

  it('analysis_result → v5_analysis_result with all fields, and the Run\'s own identity (#2368)', () => {
    const wire = {
      type: 'analysis_result',
      summary: 'A leads.',
      leading_option_id: 'opt-a',
      win_probabilities: { 'opt-a': 0.6, 'opt-b': 0.4 },
      enrichment: { decision_review: { foo: 'bar' } },
    } as const
    const r = mapV5Block(wire)
    expect(r).toEqual({
      type: 'v5_analysis_result',
      summary: 'A leads.',
      leading_option_id: 'opt-a',
      win_probabilities: { 'opt-a': 0.6, 'opt-b': 0.4 },
      enrichment: { decision_review: { foo: 'bar' } },
      analysis_hash: v5AnalysisBlockContentHash(wire as never),
    })
    // The chat card's hash IS the report's Run identity (the store's `currentResultsHash`), not any other value.
    expect((r as { analysis_hash: string }).analysis_hash).toBe(mapV5AnalysisToReport(wire as never).model_card.response_hash)
  })

  it('analysis_result omits optional fields when absent (the Run identity is never optional)', () => {
    const wire = { type: 'analysis_result', summary: 'No probs yet.', leading_option_id: null } as const
    const r = mapV5Block(wire)
    expect(r).toEqual({
      type: 'v5_analysis_result',
      summary: 'No probs yet.',
      leading_option_id: null,
      analysis_hash: v5AnalysisBlockContentHash(wire as never),
    })
  })

  it('CONTRAST: two different Runs never share an analysis_hash', () => {
    const a = mapV5Block({ type: 'analysis_result', summary: 'A leads.', leading_option_id: 'opt-a' }) as { analysis_hash: string }
    const b = mapV5Block({ type: 'analysis_result', summary: 'B leads.', leading_option_id: 'opt-b' }) as { analysis_hash: string }
    expect(a.analysis_hash).not.toBe(b.analysis_hash)
  })

  it('graph_patch applied → v5_graph_patch', () => {
    const r = mapV5Block({
      type: 'graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'node-1',
      before: { value: 10 },
      after: { value: 42 },
    })
    expect(r).toEqual({
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'node-1',
      before: { value: 10 },
      after: { value: 42 },
    })
  })

  it('graph_patch noop with null before/after', () => {
    const r = mapV5Block({
      type: 'graph_patch',
      status: 'noop',
      operation: 'adjust_edge_strength',
      target_id: 'edge-1',
      before: null,
      after: null,
    })
    if (r?.type !== 'v5_graph_patch') throw new Error('expected v5_graph_patch')
    expect(r.status).toBe('noop')
    expect(r.before).toBeNull()
  })

  it('explanation block → v5_explanation', () => {
    const r = mapV5Block({
      type: 'explanation',
      narrative: 'A wins because X.',
      referenced_option_ids: ['opt-a'],
    })
    expect(r).toEqual({
      type: 'v5_explanation',
      narrative: 'A wins because X.',
      referenced_option_ids: ['opt-a'],
    })
  })

  it('comparison block → v5_comparison', () => {
    const r = mapV5Block({
      type: 'comparison',
      options: [
        { option_id: 'opt-a', label: 'A', win_probability: 0.6 },
        { option_id: 'opt-b', label: 'B' },
      ],
      narrative: 'A beats B.',
    })
    if (r?.type !== 'v5_comparison') throw new Error('expected v5_comparison')
    expect(r.options).toHaveLength(2)
    expect(r.narrative).toBe('A beats B.')
  })

  it('flip_analysis block → v5_flip_analysis', () => {
    const r = mapV5Block({
      type: 'flip_analysis',
      narrative: 'Three factors flip.',
      flip_scenarios: [
        {
          factor_id: 'f1',
          current_value: 0.5,
          flip_threshold: 0.7,
          from_option_id: 'opt-a',
          to_option_id: 'opt-b',
          fragile: false,
        },
      ],
    })
    if (r?.type !== 'v5_flip_analysis') throw new Error('expected v5_flip_analysis')
    expect(r.flip_scenarios).toHaveLength(1)
  })
})

describe('mapV5Blocks — batch', () => {
  it('maps a mixed array and filters errors', () => {
    const blocks: V5Block[] = [
      { type: 'text', content: 'hi' },
      { type: 'error', error_code: 'INTERNAL_ERROR', severity: 'error' },
      { type: 'analysis_result', summary: 'A leads', leading_option_id: 'opt-a' },
    ]
    const r = mapV5Blocks(blocks)
    expect(r).toHaveLength(2)
    expect(r[0]?.type).toBe('commentary')
    expect(r[1]?.type).toBe('v5_analysis_result')
  })

  it('empty array returns empty array', () => {
    expect(mapV5Blocks([])).toEqual([])
  })
})
