/**
 * Lane UI-R3 (truth rendering) — Track C slice 1: typed Phase 3 bridge
 * behaviour of composePhase3BridgedBlocks.
 *
 * Contract under test (approved D-5; provisional_doctrine_v0):
 *   1. 0.13.x-valid coaching + review_card raw blocks render as typed
 *      v5_coaching / v5_review_card conversation blocks, mapped blocks
 *      first, producer priority_rank ascending.
 *   2. Typed blocks are NOT gated on factPresent (coaching arrives on
 *      draft turns).
 *   3. Fail-closed: malformed coaching → counted + suppressed, never
 *      crashes composition.
 *   4. SLICE 2 (Lane UI-W4 C — supersedes the slice-1 rule here):
 *      0.13.1-valid evidence / exercise raw blocks now render as typed
 *      v5_evidence / v5_exercise blocks. Evidence participates in the
 *      shared priority_rank ordering; exercise carries NO priority_rank
 *      per the v1.3 contract, so it sorts after every ranked block in
 *      harvest order. Malformed/content-less blocks are counted
 *      ('malformed_phase3_block_suppressed') and suppressed.
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
import type {
  ConversationBlock,
  V5CoachingBlock,
  V5EvidenceBlock,
  V5ExerciseBlock,
  V5ReviewCardBlock,
} from '../types'
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

  it('SLICE 2 update: shape-invalid evidence/exercise are counted as MALFORMED and stay unrendered', () => {
    // These are the exact minimal shapes the slice-1 version of this test
    // used for 'no_renderer_for_block_type'. Slice 2 renders both types,
    // so a bare {type, block_id} is now a fail-closed adaptation failure —
    // deliberately re-rationalised to 'malformed_phase3_block_suppressed'.
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
      rationale: 'malformed_phase3_block_suppressed',
    })
    expect(byType.get('exercise')).toMatchObject({
      source: 'phase3_block_bridge',
      rationale: 'malformed_phase3_block_suppressed',
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

// ─── Track C slice 2 (Lane UI-W4 C): evidence / exercise typed path ──────

function typedEvidenceRaw(overrides: Record<string, unknown> = {}): Phase3RawBlock {
  const raw: Record<string, unknown> = {
    type: 'evidence',
    block_id: 'ev-typed-1',
    signal_id: 'evidence:fac_rate:1:hash',
    source_handler: 'evidence_ranking',
    graph_hash_at_generation: 'hash-1',
    freshness: 'fresh',
    factor_label: 'Conversion Rate',
    factor_ref: { id: 'fac_rate', label: 'Conversion Rate', kind: 'factor' },
    target_refs: [{ id: 'fac_rate', label: 'Conversion Rate', kind: 'factor' }],
    current_confidence: 'low',
    evidence_gap: 'The conversion rate estimate is based on a single week of data.',
    suggested_technique: 'Run the funnel report for the last quarter.',
    impact_if_gathered: 'A firmer estimate would settle which option leads.',
    priority_rank: 41,
    severity: 'warning',
    ...overrides,
  }
  return {
    type: 'evidence',
    id: String(raw.block_id ?? 'ev-typed-1'),
    source: 'sidecar_blocks_array',
    raw,
  }
}

function typedExerciseRaw(overrides: Record<string, unknown> = {}): Phase3RawBlock {
  const raw: Record<string, unknown> = {
    type: 'exercise',
    block_id: 'ex-typed-1',
    signal_id: 'exercise:pre_mortem:1:hash',
    source_handler: 'pre_mortem_handler',
    freshness: 'fresh',
    exercise_kind: 'pre_mortem',
    failure_scenario: 'The migration stalls on undocumented edge cases.',
    warning_signs: ['Coverage stays flat for two sprints'],
    mitigation: 'Timebox a legacy discovery spike first.',
    target_refs: [{ id: 'opt_migrate', label: 'Migrate', kind: 'option' }],
    ...overrides,
  }
  return {
    type: 'exercise',
    id: String(raw.block_id ?? 'ex-typed-1'),
    source: 'sidecar_blocks_array',
    raw,
  }
}

describe('composePhase3BridgedBlocks — typed path (slice 2: evidence / exercise)', () => {
  it('renders schema-valid evidence AND exercise as typed blocks; evidence shares the rank ordering, unranked exercise sorts last', () => {
    // Ranks: evidence 41 < review 71 < coaching 101; exercise has NO
    // priority_rank per the v1.3 contract → after every ranked block.
    const out = composePhase3BridgedBlocks(
      true,
      [typedExerciseRaw(), typedCoachingRaw(), typedEvidenceRaw(), typedReviewCardRaw()],
      MAPPED,
    )
    expect(out.map((b) => b.type)).toEqual([
      'v5_analysis_result',
      'v5_evidence',
      'v5_review_card',
      'v5_coaching',
      'v5_exercise',
    ])
    const evidence = out[1] as V5EvidenceBlock
    expect(evidence.evidence_gap).toBe(
      'The conversion rate estimate is based on a single week of data.',
    )
    const exercise = out[4] as V5ExerciseBlock
    expect(exercise.failure_scenario).toBe('The migration stalls on undocumented edge cases.')
  })

  it('does NOT gate evidence/exercise on factPresent (per-turn producer content)', () => {
    const out = composePhase3BridgedBlocks(false, [typedEvidenceRaw(), typedExerciseRaw()], [])
    expect(out.map((b) => b.type)).toEqual(['v5_evidence', 'v5_exercise'])
  })

  it('multiple unranked exercises preserve harvest order after ranked blocks', () => {
    const out = composePhase3BridgedBlocks(
      true,
      [
        typedExerciseRaw({ block_id: 'ex-b', failure_scenario: 'B fails.' }),
        typedExerciseRaw({ block_id: 'ex-a', failure_scenario: 'A fails.' }),
        typedEvidenceRaw(),
      ],
      [],
    )
    expect(out.map((b) => b.type)).toEqual(['v5_evidence', 'v5_exercise', 'v5_exercise'])
    expect((out[1] as V5ExerciseBlock).block_id).toBe('ex-b')
    expect((out[2] as V5ExerciseBlock).block_id).toBe('ex-a')
  })

  it('fail-closed: malformed evidence is counted + suppressed, composition never crashes', () => {
    const malformed = typedEvidenceRaw({ evidence_gap: undefined })
    const out = composePhase3BridgedBlocks(true, [malformed, typedExerciseRaw()], MAPPED)
    expect(out.map((b) => b.type)).toEqual(['v5_analysis_result', 'v5_exercise'])

    const snapshot = getDroppedContentSnapshot()
    expect(snapshot.total_dropped).toBe(1)
    expect(snapshot.entries[0]).toMatchObject({
      block_type: 'evidence',
      source: 'phase3_block_bridge',
      rationale: 'malformed_phase3_block_suppressed',
      count: 1,
    })
  })

  it('fail-closed: a content-less (schema-shaped, all prose absent) exercise is counted + suppressed — an empty card is dishonest', () => {
    const contentLess = typedExerciseRaw({
      failure_scenario: undefined,
      warning_signs: undefined,
      mitigation: undefined,
    })
    const out = composePhase3BridgedBlocks(true, [contentLess], MAPPED)
    expect(out.map((b) => b.type)).toEqual(['v5_analysis_result'])

    const snapshot = getDroppedContentSnapshot()
    expect(snapshot.entries[0]).toMatchObject({
      block_type: 'exercise',
      rationale: 'malformed_phase3_block_suppressed',
    })
  })

  it('dedupes typed evidence/exercise by block_id (same block harvested twice renders once)', () => {
    const out = composePhase3BridgedBlocks(
      true,
      [typedEvidenceRaw(), typedEvidenceRaw(), typedExerciseRaw(), typedExerciseRaw()],
      [],
    )
    expect(out.filter((b) => b.type === 'v5_evidence')).toHaveLength(1)
    expect(out.filter((b) => b.type === 'v5_exercise')).toHaveLength(1)
  })
})
