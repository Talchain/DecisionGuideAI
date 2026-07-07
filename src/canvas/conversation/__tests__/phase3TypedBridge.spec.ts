/**
 * Lane UI-R3 (truth rendering) — Track C slice 1: typed Phase 3 bridge
 * behaviour of composePhase3BridgedBlocks.
 *
 * New contract under test (approved D-5; provisional_doctrine_v0):
 *   1. 0.13.x-valid coaching + review_card raw blocks render as typed
 *      v5_coaching / v5_review_card conversation blocks, mapped blocks
 *      first, producer priority_rank ascending.
 *   2. Typed blocks are NOT gated on factPresent (coaching arrives on
 *      draft turns).
 *   3. Fail-closed: malformed coaching → counted + suppressed, never
 *      crashes composition.
 *   4. evidence / exercise keep counting ('no_renderer_for_block_type')
 *      and stay unrendered.
 *   5. Legacy-shaped review_card falls back to the ORIGINAL bridge rules
 *      (factPresent gate + top-1 cap + adaptPhase3ReviewCard) — locked in
 *      detail by phase3ReviewCardBridge.spec.ts; spot-checked here.
 *   6. Dedupe by block_id across the typed path.
 *
 * Counting assertions use the real dropped-content counter snapshot
 * (session-scoped; reset per test).
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { composePhase3BridgedBlocks } from '../useConversation'
import type { ConversationBlock, V5CoachingBlock, V5ReviewCardBlock } from '../types'
import type { Phase3RawBlock } from '../../../v5/extractPhase3FromV5Response'
import {
  _resetDroppedContentCounter,
  getDroppedContentSnapshot,
} from '../../../lib/droppedContentCounter'

// ─── Fixtures: 0.13.x-shaped raw payloads (field set mirrors the live
//     staging capture cee-response-b82c89dd-trimmed.json) ────────────────

function typedReviewCardRaw(overrides: Record<string, unknown> = {}): Phase3RawBlock {
  const raw: Record<string, unknown> = {
    type: 'review_card',
    block_id: 'rc-typed-1',
    signal_id: 'review:assumption:1:hash',
    source_handler: 'decision_review_enricher',
    graph_hash_at_generation: 'hash-1',
    freshness: 'fresh',
    card_kind: 'assumption',
    title: 'A load-bearing assumption',
    body: 'The relationship between X and Y remains stable.',
    severity: 'info',
    priority_rank: 71,
    target_refs: [],
    ...overrides,
  }
  return {
    type: 'review_card',
    id: String(raw.block_id ?? 'rc-typed-1'),
    source: 'sidecar_blocks_array',
    raw,
  }
}

function typedCoachingRaw(overrides: Record<string, unknown> = {}): Phase3RawBlock {
  const raw: Record<string, unknown> = {
    type: 'coaching',
    block_id: 'co-typed-1',
    signal_id: 'coach:assumption:1:hash',
    source_handler: 'decision_review_enricher',
    graph_hash_at_generation: 'hash-1',
    freshness: 'fresh',
    coaching_kind: 'assumption_check',
    title: 'An assumption to check',
    body: 'Check that the relationship between X and Y is stable.',
    source: 'decision_review',
    action_intent: 'confirm_factor',
    action_label: 'Confirm this assumption',
    priority_rank: 101,
    target_refs: [],
    ...overrides,
  }
  return {
    type: 'coaching',
    id: String(raw.block_id ?? 'co-typed-1'),
    source: 'sidecar_blocks_array',
    raw,
  }
}

function legacyReviewCardRaw(id: string): Phase3RawBlock {
  return {
    type: 'review_card',
    id,
    source: 'sidecar_blocks_array',
    raw: {
      type: 'review_card',
      block_id: id,
      title: 'Legacy decision review',
      summary: 'Legacy body under summary field.',
      freshness: 'fresh',
    },
  }
}

const MAPPED: ConversationBlock[] = [
  {
    type: 'v5_analysis_result',
    summary: 'Ran analysis.',
    leading_option_id: 'opt_a',
  },
]

beforeEach(() => {
  _resetDroppedContentCounter()
})

describe('composePhase3BridgedBlocks — typed path (slice 1)', () => {
  it('renders schema-valid coaching AND review_card as typed blocks after mapped blocks, priority_rank ascending', () => {
    const out = composePhase3BridgedBlocks(
      true,
      [typedCoachingRaw(), typedReviewCardRaw()],
      MAPPED,
    )
    expect(out.map((b) => b.type)).toEqual([
      'v5_analysis_result',
      'v5_review_card', // rank 71 outranks coaching rank 101
      'v5_coaching',
    ])
    const card = out[1] as V5ReviewCardBlock
    expect(card.title).toBe('A load-bearing assumption')
    expect(card.body).toBe('The relationship between X and Y remains stable.')
    const coaching = out[2] as V5CoachingBlock
    expect(coaching.action_label).toBe('Confirm this assumption')
  })

  it('does NOT gate typed blocks on factPresent (coaching on draft turns renders)', () => {
    const out = composePhase3BridgedBlocks(false, [typedCoachingRaw()], [])
    expect(out.map((b) => b.type)).toEqual(['v5_coaching'])
  })

  it('fail-closed: malformed coaching is counted + suppressed, composition never crashes', () => {
    const malformed = typedCoachingRaw({ body: undefined })
    const out = composePhase3BridgedBlocks(true, [malformed, typedReviewCardRaw()], MAPPED)
    expect(out.map((b) => b.type)).toEqual(['v5_analysis_result', 'v5_review_card'])

    const snapshot = getDroppedContentSnapshot()
    expect(snapshot.total_dropped).toBe(1)
    expect(snapshot.entries[0]).toMatchObject({
      block_type: 'coaching',
      source: 'phase3_block_bridge',
      rationale: 'malformed_phase3_block_suppressed',
      count: 1,
    })
  })

  it('evidence and exercise keep counting and stay unrendered', () => {
    const evidence: Phase3RawBlock = {
      type: 'evidence',
      id: 'ev-1',
      source: 'sidecar_blocks_array',
      raw: { type: 'evidence', block_id: 'ev-1' },
    }
    const exercise: Phase3RawBlock = {
      type: 'exercise',
      id: 'ex-1',
      source: 'sidecar_blocks_array',
      raw: { type: 'exercise', block_id: 'ex-1' },
    }
    const out = composePhase3BridgedBlocks(true, [evidence, exercise], MAPPED)
    expect(out.map((b) => b.type)).toEqual(['v5_analysis_result'])

    const snapshot = getDroppedContentSnapshot()
    expect(snapshot.total_dropped).toBe(2)
    const byType = new Map(snapshot.entries.map((e) => [e.block_type, e]))
    expect(byType.get('evidence')).toMatchObject({
      source: 'phase3_block_bridge',
      rationale: 'no_renderer_for_block_type',
    })
    expect(byType.get('exercise')).toMatchObject({
      source: 'phase3_block_bridge',
      rationale: 'no_renderer_for_block_type',
    })
  })

  it('dedupes typed blocks by block_id (same card harvested twice renders once)', () => {
    const out = composePhase3BridgedBlocks(
      true,
      [typedReviewCardRaw(), typedReviewCardRaw()],
      [],
    )
    expect(out.filter((b) => b.type === 'v5_review_card')).toHaveLength(1)
  })

  it('renders ALL typed review cards (no top-1 cap on the typed path)', () => {
    const out = composePhase3BridgedBlocks(
      true,
      [
        typedReviewCardRaw({ block_id: 'rc-1', priority_rank: 73 }),
        typedReviewCardRaw({ block_id: 'rc-2', priority_rank: 71 }),
        typedReviewCardRaw({ block_id: 'rc-3', priority_rank: 72 }),
      ],
      [],
    )
    const ranks = out
      .filter((b): b is V5ReviewCardBlock => b.type === 'v5_review_card')
      .map((b) => b.priority_rank)
    expect(ranks).toEqual([71, 72, 73])
  })
})

describe('composePhase3BridgedBlocks — legacy fallback preserved', () => {
  it('legacy-shaped review_card still renders through the fact-gated top-1 legacy bridge', () => {
    const out = composePhase3BridgedBlocks(true, [legacyReviewCardRaw('rc-legacy-1')], MAPPED)
    expect(out.map((b) => b.type)).toEqual(['v5_analysis_result', 'review_card'])
  })

  it('legacy card suppressed when factPresent=false, and the suppression is counted', () => {
    const out = composePhase3BridgedBlocks(false, [legacyReviewCardRaw('rc-legacy-1')], MAPPED)
    expect(out.map((b) => b.type)).toEqual(['v5_analysis_result'])

    const snapshot = getDroppedContentSnapshot()
    expect(snapshot.entries[0]).toMatchObject({
      block_type: 'review_card',
      source: 'phase3_block_bridge',
      rationale: 'legacy_review_card_suppressed',
      count: 1,
    })
  })

  it('legacy top-1 cap: the non-selected legacy cards are counted as suppressed', () => {
    const out = composePhase3BridgedBlocks(
      true,
      [legacyReviewCardRaw('rc-legacy-1'), legacyReviewCardRaw('rc-legacy-2')],
      MAPPED,
    )
    expect(out.filter((b) => b.type === 'review_card')).toHaveLength(1)
    const snapshot = getDroppedContentSnapshot()
    expect(snapshot.total_dropped).toBe(1)
    expect(snapshot.entries[0]).toMatchObject({
      block_type: 'review_card',
      rationale: 'legacy_review_card_suppressed',
    })
  })

  it('typed and legacy cards can coexist on one turn: typed renders typed, legacy renders top-1', () => {
    const out = composePhase3BridgedBlocks(
      true,
      [typedReviewCardRaw(), legacyReviewCardRaw('rc-legacy-1')],
      MAPPED,
    )
    expect(out.map((b) => b.type)).toEqual([
      'v5_analysis_result',
      'v5_review_card',
      'review_card',
    ])
  })
})
