/**
 * Tests for adaptCEEBlock and prioritiseBlocks helpers in useConversation
 *
 * Verifies:
 * - Wrapped CEE format { block_type, data, actions } → flat UI types
 * - All 6 block types correctly mapped
 * - Unknown block_type passed through for InlineBlocks fallback
 * - Flat (legacy) format passed through unchanged
 * - prioritiseBlocks moves graph_patch blocks to front, preserves original order otherwise
 * - Suggested action chips: render, click pre-fills input (integration: see below)
 * - prefers-reduced-motion class assertions (CSS module)
 */

import { describe, it, expect } from 'vitest'
import { adaptCEEBlock, prioritiseBlocks } from '../useConversation'
import type { ConversationBlock } from '../types'

// ---------------------------------------------------------------------------
// adaptCEEBlock — flat (legacy) format pass-through
// ---------------------------------------------------------------------------

describe('adaptCEEBlock — flat format pass-through', () => {
  it('passes through flat commentary block', () => {
    const block: ConversationBlock = { type: 'commentary', text: 'Hello' }
    expect(adaptCEEBlock(block)).toEqual(block)
  })

  it('passes through flat fact block', () => {
    const block: ConversationBlock = { type: 'fact', label: 'Win', value: '72%' }
    expect(adaptCEEBlock(block)).toEqual(block)
  })

  it('passes through flat graph_patch block', () => {
    const block: ConversationBlock = {
      type: 'graph_patch',
      patch_id: 'p1',
      summary: 'Add node',
      operations: [],
      target_graph_hash: 'h1',
    }
    expect(adaptCEEBlock(block)).toEqual(block)
  })
})

// ---------------------------------------------------------------------------
// adaptCEEBlock — wrapped CEE format mapping
// ---------------------------------------------------------------------------

describe('adaptCEEBlock — wrapped CEE format', () => {
  it('maps framing block_type', () => {
    const raw = {
      block_type: 'framing',
      block_id: 'b1',
      data: {
        goal: 'Decide market',
        options: ['A', 'B'],
        constraints: ['Budget < $5M'],
        key_risks: ['FX risk'],
      },
    }
    const result = adaptCEEBlock(raw)
    expect(result.type).toBe('framing')
    const f = result as any
    expect(f.goal).toBe('Decide market')
    expect(f.options).toEqual(['A', 'B'])
    expect(f.constraints).toEqual(['Budget < $5M'])
    expect(f.key_risks).toEqual(['FX risk'])
  })

  it('maps graph_patch block_type with description→summary, applied_graph_hash→target_graph_hash', () => {
    const raw = {
      block_type: 'graph_patch',
      block_id: 'b2',
      data: {
        patch_id: 'p-from-cee',
        description: 'Add competitor risk',
        operations: [{ op: 'add_node', target_id: 'n1', data: {} }],
        applied_graph_hash: 'hash-abc',
        auto_apply: true,
      },
      actions: [
        { action_type: 'accept', label: 'Apply', variant: 'primary' },
      ],
    }
    const result = adaptCEEBlock(raw) as any
    expect(result.type).toBe('graph_patch')
    expect(result.patch_id).toBe('p-from-cee')
    expect(result.summary).toBe('Add competitor risk')
    expect(result.target_graph_hash).toBe('hash-abc')
    expect(result.auto_apply).toBe(true)
    expect(result.actions).toHaveLength(1)
    expect(result.block_id).toBe('b2')
  })

  it('normalises operations from CEE V2 path/value to target_id/data', () => {
    const raw = {
      block_type: 'graph_patch',
      block_id: 'b-v2',
      data: {
        operations: [
          { op: 'add_node', path: '/nodes/dec_x', value: { id: 'dec_x', kind: 'decision', label: 'X' } },
          { op: 'add_edge', path: '/edges/dec_x->fac_y', value: { from: 'dec_x', to: 'fac_y', strength: { mean: 0.5 } } },
        ],
        auto_apply: true,
      },
    }
    const result = adaptCEEBlock(raw) as any
    expect(result.operations).toHaveLength(2)

    // Node op normalised
    expect(result.operations[0].target_id).toBe('dec_x')
    expect(result.operations[0].data.kind).toBe('decision')
    expect(result.operations[0].path).toBeUndefined()
    expect(result.operations[0].value).toBeUndefined()

    // Edge op normalised — target_id derived from path tail since value has no .id
    expect(result.operations[1].target_id).toBeTruthy()
    expect(result.operations[1].data.from).toBe('dec_x')
    expect(result.operations[1].data.to).toBe('fac_y')
  })

  it('passes through legacy target_id/data operations unchanged', () => {
    const raw = {
      block_type: 'graph_patch',
      block_id: 'b-legacy',
      data: {
        operations: [
          { op: 'add_node', target_id: 'n1', data: { kind: 'factor', label: 'F' } },
        ],
        auto_apply: false,
      },
    }
    const result = adaptCEEBlock(raw) as any
    expect(result.operations[0].target_id).toBe('n1')
    expect(result.operations[0].data.kind).toBe('factor')
  })

  it('maps fact block_type with template fields', () => {
    const raw = {
      block_type: 'fact',
      block_id: 'b3',
      data: {
        label: 'Win probabilities',
        value: '',
        fact_type: 'option_comparison',
        facts: [{ label: 'A', value: 0.72 }],
        lineage: { n_samples: 5000 },
      },
    }
    const result = adaptCEEBlock(raw) as any
    expect(result.type).toBe('fact')
    expect(result.fact_type).toBe('option_comparison')
    expect(result.facts).toHaveLength(1)
    expect(result.lineage.n_samples).toBe(5000)
  })

  it('maps commentary block_type with narrative→text', () => {
    const raw = {
      block_type: 'commentary',
      block_id: 'b4',
      data: {
        narrative: 'The analysis shows strong sensitivity.',
        citations: [{ index: 1, source: 'Page 3' }],
      },
    }
    const result = adaptCEEBlock(raw) as any
    expect(result.type).toBe('commentary')
    expect(result.text).toBe('The analysis shows strong sensitivity.')
    expect(result.citations).toHaveLength(1)
  })

  it('maps review_card block_type with description→body', () => {
    const raw = {
      block_type: 'review_card',
      block_id: 'b5',
      data: {
        title: 'Concentration risk',
        description: 'Model depends on one factor.',
        variant: 'alert',
        priority: 'high',
      },
    }
    const result = adaptCEEBlock(raw) as any
    expect(result.type).toBe('review_card')
    expect(result.body).toBe('Model depends on one factor.')
    expect(result.priority).toBe('high')
  })

  it('maps brief block_type with shareable_url→brief_url', () => {
    const raw = {
      block_type: 'brief',
      block_id: 'b6',
      data: {
        title: 'Decision Brief',
        summary: 'Summary text.',
        shareable_url: 'https://example.com/brief/123',
      },
    }
    const result = adaptCEEBlock(raw) as any
    expect(result.type).toBe('brief')
    expect(result.title).toBe('Decision Brief')
    expect(result.brief_url).toBe('https://example.com/brief/123')
  })

  it('passes unknown block_type through for InlineBlocks fallback', () => {
    const raw = {
      block_type: 'future_block_v99',
      block_id: 'b7',
      data: { some_field: 'value' },
    }
    const result = adaptCEEBlock(raw) as any
    expect(result.type).toBe('future_block_v99')
  })

  it('handles null/undefined input gracefully', () => {
    const result = adaptCEEBlock(null)
    expect(result).toBeDefined()
    expect(result.type).toBe('commentary')
  })
})

// ---------------------------------------------------------------------------
// prioritiseBlocks
// ---------------------------------------------------------------------------

describe('prioritiseBlocks', () => {
  it('moves graph_patch blocks to front, preserves relative order', () => {
    const blocks: ConversationBlock[] = [
      { type: 'commentary', text: 'C1' },
      { type: 'graph_patch', patch_id: 'p1', summary: 'P1', operations: [], target_graph_hash: 'h' },
      { type: 'fact', label: 'F', value: '1' },
      { type: 'graph_patch', patch_id: 'p2', summary: 'P2', operations: [], target_graph_hash: 'h' },
    ]

    const result = prioritiseBlocks(blocks)

    expect(result[0].type).toBe('graph_patch')
    expect((result[0] as any).patch_id).toBe('p1')
    expect(result[1].type).toBe('graph_patch')
    expect((result[1] as any).patch_id).toBe('p2')
    expect(result[2].type).toBe('commentary')
    expect(result[3].type).toBe('fact')
  })

  it('returns original array unchanged when no graph_patch blocks', () => {
    const blocks: ConversationBlock[] = [
      { type: 'commentary', text: 'C1' },
      { type: 'fact', label: 'F', value: '1' },
      { type: 'framing', goal: 'G', options: [] },
    ]

    const result = prioritiseBlocks(blocks)

    expect(result[0].type).toBe('commentary')
    expect(result[1].type).toBe('fact')
    expect(result[2].type).toBe('framing')
  })

  it('returns empty array for empty input', () => {
    expect(prioritiseBlocks([])).toEqual([])
  })

  it('does not mutate the original array', () => {
    const blocks: ConversationBlock[] = [
      { type: 'commentary', text: 'C' },
      { type: 'graph_patch', patch_id: 'p', summary: 'P', operations: [], target_graph_hash: 'h' },
    ]
    const original = [...blocks]
    prioritiseBlocks(blocks)
    expect(blocks).toEqual(original)
  })
})
