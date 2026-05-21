/**
 * Phase 3 review_card bridge — DGAI V5 surfacing audit follow-up.
 *
 * The bridge appends CEE-produced Phase 3 review_card content to the assistant
 * turn's `blocks[]` after Run analysis, so the existing ReviewCardBlockRenderer
 * surfaces it in the AI panel. No new renderer, no schema/parser change.
 *
 * Tests below cover the 11 requirements from the brief:
 *
 *   1. review_card appended on current run_analysis turn with Phase 3 rawBlocks.
 *   2. review_card NOT appended on non-run-analysis / stale / unrelated turns.
 *   3. v5_analysis_result remains before review_card.
 *   4. evidence blocks not inserted.
 *   5. coaching blocks not inserted.
 *   6. prompt chips without action_type unchanged — see existing
 *      ChatThread.chipGroup.spec.tsx / SuggestedChips.spec.tsx; the bridge
 *      does not touch action chips. Spot-check via mappedBlocks/chips
 *      separation here (composePhase3BridgedBlocks does not see chips).
 *   7. executable chips unchanged — same.
 *   8. mapV5Blocks does not emit review_card directly (regression guard).
 *   9. duplicate review_card not inserted when one already exists in mappedBlocks.
 *  10. cap respected: only top 1 review_card.
 *  11. review_card mapping defaults match existing adaptCEEBlock wrapped-block
 *      defaults (summary→body, variant defaults to info, tone→variant mapping).
 */

import { describe, it, expect } from 'vitest'
import {
  adaptPhase3ReviewCard,
  selectTopPhase3ReviewCard,
  composePhase3BridgedBlocks,
  adaptCEEBlock,
} from '../useConversation'
import type { ConversationBlock } from '../types'
import type { Phase3RawBlock } from '../../../v5/extractPhase3FromV5Response'
import { mapV5Blocks } from '../../../v5/blocks/mapV5Blocks'

// ─── Test fixtures ──────────────────────────────────────────────────────

function makeReviewCardRaw(overrides: Record<string, unknown> = {}): Phase3RawBlock {
  return {
    type: 'review_card',
    id: 'rc-1',
    source: 'sidecar_blocks_array',
    raw: {
      type: 'review_card',
      block_id: 'rc-narrative-1',
      signal_id: 'review:narrative:opt-a',
      created_at: '2026-05-18T10:00:00.000+01:00',
      source_handler: 'decision_review',
      graph_hash_at_generation: 'graph-h-1',
      freshness: 'fresh',
      card_kind: 'narrative',
      title: 'Decision review',
      summary: 'Robust under the modelled uncertainty.',
      target_refs: [{ type: 'option', id: 'opt-a' }],
      ...overrides,
    },
  }
}

function makeEvidenceRaw(): Phase3RawBlock {
  return {
    type: 'evidence',
    id: 'ev-1',
    source: 'sidecar_blocks_array',
    raw: {
      type: 'evidence',
      block_id: 'ev-1',
      signal_id: 'ev:1',
      factor_ref: 'node-A',
      target_refs: [{ type: 'node', id: 'node-A' }],
    },
  }
}

function makeCoachingRaw(): Phase3RawBlock {
  return {
    type: 'coaching',
    id: 'coach-1',
    source: 'sidecar_blocks_array',
    raw: {
      type: 'coaching',
      block_id: 'coach-1',
      signal_id: 'coaching:strengthen:node-A',
      action_intent: 'gather_evidence',
      priority_rank: 1,
      coaching_kind: 'strengthen',
      title: 'Strengthen evidence',
      target_refs: [{ type: 'node', id: 'node-A', label: 'Factor A' }],
    },
  }
}

const V5_ANALYSIS_RESULT_BLOCK: ConversationBlock = {
  type: 'v5_analysis_result',
  summary: 'Option A leads',
  leading_option_id: 'opt-a',
  win_probabilities: { 'opt-a': 0.7, 'opt-b': 0.3 },
}

// ─── (11) Mapping defaults parity with adaptCEEBlock ────────────────────

describe('adaptPhase3ReviewCard — mapping defaults', () => {
  it('maps title and falls back summary→body when body/description absent', () => {
    const block = adaptPhase3ReviewCard({
      title: 'Decision review',
      summary: 'Robust under the modelled uncertainty.',
    })
    expect(block).toEqual({
      type: 'review_card',
      title: 'Decision review',
      body: 'Robust under the modelled uncertainty.',
      variant: 'info',
    })
  })

  it('prefers description over body over summary (matches adaptCEEBlock priority)', () => {
    // Wrapped-path order in adaptCEEBlock is `description ?? body`. The Phase 3
    // adapter mirrors that, with `summary` consulted only when both are absent
    // (the v1.3 Phase 3 emit shape uses `summary`, not `body`/`description`).
    const block = adaptPhase3ReviewCard({
      title: 'T',
      body: 'B',
      description: 'D',
      summary: 'S',
    })
    expect(block?.body).toBe('D')
    const block2 = adaptPhase3ReviewCard({
      title: 'T',
      body: 'B',
      summary: 'S',
    })
    expect(block2?.body).toBe('B')
    const block3 = adaptPhase3ReviewCard({ title: 'T', summary: 'S' })
    expect(block3?.body).toBe('S')
  })

  it('parity with adaptCEEBlock: body resolves the same way when both description and body are present', () => {
    // Lock in the same observable behaviour as the wrapped path, end-to-end:
    // a CEE block carrying both `description` and `body` must resolve to
    // `description` in both adapters.
    const wrapped = adaptCEEBlock({
      block_type: 'review_card',
      block_id: 'rc-parity',
      data: { title: 'T', description: 'D', body: 'B' },
    })
    const bridged = adaptPhase3ReviewCard({
      title: 'T',
      description: 'D',
      body: 'B',
    })
    expect(wrapped).toMatchObject({ type: 'review_card', title: 'T', body: 'D' })
    expect(bridged).toMatchObject({ type: 'review_card', title: 'T', body: 'D' })
  })

  it('defaults variant to info when no tone or variant emitted', () => {
    const block = adaptPhase3ReviewCard({ title: 'T', summary: 'S' })
    expect(block?.variant).toBe('info')
    expect(block?.tone).toBeUndefined()
  })

  it('maps tone challenger→alert and facilitator→info, passes tone through', () => {
    const a = adaptPhase3ReviewCard({ title: 'T', summary: 'S', tone: 'challenger' })
    expect(a?.variant).toBe('alert')
    expect(a?.tone).toBe('challenger')
    const f = adaptPhase3ReviewCard({ title: 'T', summary: 'S', tone: 'facilitator' })
    expect(f?.variant).toBe('info')
    expect(f?.tone).toBe('facilitator')
  })

  it('honours explicit variant when tone absent', () => {
    const alert = adaptPhase3ReviewCard({ title: 'T', summary: 'S', variant: 'alert' })
    expect(alert?.variant).toBe('alert')
    const info = adaptPhase3ReviewCard({ title: 'T', summary: 'S', variant: 'info' })
    expect(info?.variant).toBe('info')
  })

  it('passes priority through only for the valid four-value union', () => {
    const high = adaptPhase3ReviewCard({ title: 'T', summary: 'S', priority: 'high' })
    expect(high?.priority).toBe('high')
    // unknown priority strings and numeric priority_rank are NOT promoted to
    // the categorical priority field — no invented mapping.
    const bogus = adaptPhase3ReviewCard({ title: 'T', summary: 'S', priority: 'p1' })
    expect(bogus?.priority).toBeUndefined()
    const numeric = adaptPhase3ReviewCard({ title: 'T', summary: 'S', priority_rank: 1 })
    expect(numeric?.priority).toBeUndefined()
  })

  it('refuses to render with empty title (no fabricated copy)', () => {
    expect(adaptPhase3ReviewCard({ summary: 'body only' })).toBeNull()
    expect(adaptPhase3ReviewCard({ title: '', summary: 'body only' })).toBeNull()
    expect(adaptPhase3ReviewCard({ title: '   ', summary: 'body only' })).toBeNull()
  })

  it('refuses to render with empty body (no fabricated copy)', () => {
    expect(adaptPhase3ReviewCard({ title: 'T only' })).toBeNull()
    expect(adaptPhase3ReviewCard({ title: 'T', body: '', description: '', summary: '' })).toBeNull()
  })

  it('mapping parity: same defaults as adaptCEEBlock wrapped review_card branch', () => {
    // Existing wrapped-block path (adaptCEEBlock) given equivalent CEE wrapped
    // shape — must produce the same variant/tone/priority defaults the bridge
    // does. Body source preference differs only in that wrapped CEE uses
    // `data.description ?? data.body` (no `summary` fallback), so we test with
    // a body that matches both code paths.
    const wrapped = adaptCEEBlock({
      block_type: 'review_card',
      block_id: 'rc-1',
      data: {
        title: 'Decision review',
        description: 'Robust under the modelled uncertainty.',
        tone: 'facilitator',
        priority: 'high',
      },
    })
    const bridged = adaptPhase3ReviewCard({
      title: 'Decision review',
      description: 'Robust under the modelled uncertainty.',
      tone: 'facilitator',
      priority: 'high',
    })
    expect(bridged).toEqual({
      type: 'review_card',
      title: 'Decision review',
      body: 'Robust under the modelled uncertainty.',
      variant: 'info',
      tone: 'facilitator',
      priority: 'high',
    })
    // adaptCEEBlock includes the same fields with identical defaults.
    expect(wrapped).toMatchObject({
      type: 'review_card',
      title: 'Decision review',
      body: 'Robust under the modelled uncertainty.',
      variant: 'info',
      tone: 'facilitator',
      priority: 'high',
    })
  })
})

// ─── (10) Selector: top 1 by priority_rank, tie-broken by harvest order ─

describe('selectTopPhase3ReviewCard — cap and ranking', () => {
  it('returns null when no review_card present', () => {
    expect(selectTopPhase3ReviewCard([])).toBeNull()
    expect(selectTopPhase3ReviewCard([makeEvidenceRaw(), makeCoachingRaw()])).toBeNull()
  })

  it('returns the single review_card when only one present', () => {
    const rc = makeReviewCardRaw()
    expect(selectTopPhase3ReviewCard([rc])).toBe(rc)
  })

  it('returns the lowest priority_rank when multiple present (ascending = higher priority)', () => {
    const r3 = makeReviewCardRaw({ block_id: 'r3', priority_rank: 3, title: 'T3' })
    const r1 = makeReviewCardRaw({ block_id: 'r1', priority_rank: 1, title: 'T1' })
    const r2 = makeReviewCardRaw({ block_id: 'r2', priority_rank: 2, title: 'T2' })
    const picked = selectTopPhase3ReviewCard([r3, r1, r2])
    expect((picked?.raw as { block_id: string }).block_id).toBe('r1')
  })

  it('falls back to harvest order when priority_rank is missing on all candidates', () => {
    const first = makeReviewCardRaw({ block_id: 'first', title: 'first' })
    const second = makeReviewCardRaw({ block_id: 'second', title: 'second' })
    delete (first.raw as Record<string, unknown>).priority_rank
    delete (second.raw as Record<string, unknown>).priority_rank
    expect((selectTopPhase3ReviewCard([first, second])!.raw as { block_id: string }).block_id).toBe('first')
  })

  it('treats ranked candidates as outranking unranked ones', () => {
    const unranked = makeReviewCardRaw({ block_id: 'unranked', title: 'unranked' })
    delete (unranked.raw as Record<string, unknown>).priority_rank
    const ranked = makeReviewCardRaw({ block_id: 'ranked', priority_rank: 5, title: 'ranked' })
    const picked = selectTopPhase3ReviewCard([unranked, ranked])
    expect((picked?.raw as { block_id: string }).block_id).toBe('ranked')
  })
})

// ─── Composition: gating, ordering, dedupe, exclusion ───────────────────

describe('composePhase3BridgedBlocks — gating', () => {
  it('(1) appends review_card when factPresent is true', () => {
    const rc = makeReviewCardRaw()
    const result = composePhase3BridgedBlocks(true, [rc], [V5_ANALYSIS_RESULT_BLOCK])
    expect(result).toHaveLength(2)
    expect(result[1].type).toBe('review_card')
  })

  it('(2a) does NOT append review_card when factPresent is false (conversational/follow-up turn)', () => {
    const rc = makeReviewCardRaw()
    const result = composePhase3BridgedBlocks(false, [rc], [V5_ANALYSIS_RESULT_BLOCK])
    expect(result).toEqual([V5_ANALYSIS_RESULT_BLOCK])
    expect(result.some((b) => b.type === 'review_card')).toBe(false)
  })

  it('(2b) does NOT append when no review_card rawBlocks are present', () => {
    const result = composePhase3BridgedBlocks(
      true,
      [makeEvidenceRaw(), makeCoachingRaw()],
      [V5_ANALYSIS_RESULT_BLOCK],
    )
    expect(result).toEqual([V5_ANALYSIS_RESULT_BLOCK])
  })

  it('(2c) does NOT append when the only review_card is unusable (missing title or body)', () => {
    const empty: Phase3RawBlock = {
      type: 'review_card',
      id: 'rc-empty',
      source: 'sidecar_blocks_array',
      raw: { type: 'review_card', summary: 'body only, no title' },
    }
    const result = composePhase3BridgedBlocks(true, [empty], [V5_ANALYSIS_RESULT_BLOCK])
    expect(result).toEqual([V5_ANALYSIS_RESULT_BLOCK])
  })
})

describe('composePhase3BridgedBlocks — ordering', () => {
  it('(3) preserves v5_analysis_result first, then review_card after V5-mapped blocks', () => {
    const rc = makeReviewCardRaw({ title: 'Review', summary: 'Body' })
    const explanationBlock: ConversationBlock = {
      type: 'v5_explanation',
      narrative: 'Because…',
      referenced_option_ids: ['opt-a'],
    }
    const result = composePhase3BridgedBlocks(
      true,
      [rc],
      [V5_ANALYSIS_RESULT_BLOCK, explanationBlock],
    )
    expect(result.map((b) => b.type)).toEqual([
      'v5_analysis_result',
      'v5_explanation',
      'review_card',
    ])
  })
})

describe('composePhase3BridgedBlocks — exclusions', () => {
  it('(4) does not insert evidence blocks even when factPresent and rawBlocks contain evidence', () => {
    const result = composePhase3BridgedBlocks(true, [makeEvidenceRaw()], [V5_ANALYSIS_RESULT_BLOCK])
    expect(result.some((b) => b.type === 'evidence')).toBe(false)
  })

  it('(5) does not insert coaching blocks (no InlineBlocks renderer)', () => {
    const result = composePhase3BridgedBlocks(true, [makeCoachingRaw()], [V5_ANALYSIS_RESULT_BLOCK])
    expect(result.some((b) => (b as { type: string }).type === 'coaching')).toBe(false)
  })

  it('(4,5) when mixed Phase 3 rawBlocks arrive, only the top review_card is surfaced', () => {
    const rc = makeReviewCardRaw({ priority_rank: 1 })
    const result = composePhase3BridgedBlocks(
      true,
      [makeEvidenceRaw(), makeCoachingRaw(), rc],
      [V5_ANALYSIS_RESULT_BLOCK],
    )
    expect(result.map((b) => b.type)).toEqual(['v5_analysis_result', 'review_card'])
  })
})

describe('composePhase3BridgedBlocks — dedupe and cap', () => {
  it('(9) does not insert a duplicate when mappedBlocks already carries a review_card', () => {
    const existing: ConversationBlock = {
      type: 'review_card',
      title: 'Existing',
      body: 'Existing body',
      variant: 'info',
    }
    const rc = makeReviewCardRaw()
    const result = composePhase3BridgedBlocks(true, [rc], [V5_ANALYSIS_RESULT_BLOCK, existing])
    expect(result.filter((b) => b.type === 'review_card')).toHaveLength(1)
    // The pre-existing review_card is preserved; the Phase 3 candidate is dropped.
    expect((result.find((b) => b.type === 'review_card') as { title: string }).title).toBe('Existing')
  })

  it('(10) cap respected: at most one Phase 3 review_card is inserted, even when many present', () => {
    const r1 = makeReviewCardRaw({ block_id: 'r1', priority_rank: 1, title: 'T1' })
    const r2 = makeReviewCardRaw({ block_id: 'r2', priority_rank: 2, title: 'T2' })
    const r3 = makeReviewCardRaw({ block_id: 'r3', priority_rank: 3, title: 'T3' })
    const result = composePhase3BridgedBlocks(true, [r1, r2, r3], [V5_ANALYSIS_RESULT_BLOCK])
    const inserted = result.filter((b) => b.type === 'review_card')
    expect(inserted).toHaveLength(1)
    expect((inserted[0] as { title: string }).title).toBe('T1')
  })
})

// ─── (8) Regression: mapV5Blocks does not emit review_card itself ────────

describe('mapV5Blocks — regression guard', () => {
  it('does not emit review_card from any V5-schema-strict block type', () => {
    // OlumiResponseSchema rejects Phase 3 blocks at the parser boundary, so
    // mapV5Blocks never sees them — only the schema-strict block types.
    // Construct one of each strict block type and confirm none produce a
    // review_card.
    const v5Blocks = [
      { type: 'text', content: 'hello' },
      {
        type: 'analysis_result',
        summary: 'Option A leads',
        leading_option_id: 'opt-a',
        win_probabilities: { 'opt-a': 0.7, 'opt-b': 0.3 },
      },
      {
        type: 'graph_patch',
        status: 'proposed',
        operation: 'add_node',
        target_id: 'n1',
        before: null,
        after: { id: 'n1', label: 'Factor 1' },
      },
      {
        type: 'explanation',
        narrative: 'Because…',
        referenced_option_ids: ['opt-a'],
      },
      {
        type: 'comparison',
        options: [{ label: 'A' }, { label: 'B' }],
      },
      {
        type: 'flip_analysis',
        narrative: 'If X then Y',
        flip_scenarios: [],
      },
    ] as Parameters<typeof mapV5Blocks>[0]

    const mapped = mapV5Blocks(v5Blocks)
    expect(mapped.some((b) => b.type === 'review_card')).toBe(false)
  })
})

// ─── (6,7) Chips unchanged note ─────────────────────────────────────────

describe('chips unchanged by bridge', () => {
  it('(6,7) bridge composition does not see suggested_actions / actionChips', () => {
    // The bridge function only composes `blocks`. The V5 turn-rendering site
    // still computes `actionChips` from `target.response.suggested_actions`
    // separately and passes them to addMessage unchanged. This test fixes
    // the contract by asserting composePhase3BridgedBlocks never touches
    // chip data (it is not accepted as input).
    type ComposeArgs = Parameters<typeof composePhase3BridgedBlocks>
    const args: ComposeArgs = [true, [makeReviewCardRaw()], [V5_ANALYSIS_RESULT_BLOCK]]
    expect(args).toHaveLength(3) // factPresent, rawBlocks, mappedBlocks — no chips
    const result = composePhase3BridgedBlocks(...args)
    expect(result).toHaveLength(2)
  })
})
