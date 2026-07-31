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
 *      per the v1.3 contract. Malformed/content-less blocks are counted
 *      ('malformed_phase3_block_suppressed') and suppressed.
 *   4b. ROADMAP 2.211 §2 (supersedes slice 2's PLACEMENT only): the
 *      unranked exercise no longer sorts last. It takes a rank DERIVED
 *      from the turn's review cards, so it sits directly after them and
 *      ahead of coaching — the selected lens is the turn's chosen
 *      most-useful insight, and last put it behind `Show N more`. Harvest
 *      order among multiple exercises, the fail-closed rules and dedupe
 *      are unchanged.
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
  it('renders schema-valid evidence AND exercise as typed blocks; evidence shares the rank ordering, exercise follows the review cards', () => {
    // Ranks: evidence 41 < review 71 < coaching 101.
    //
    // ⚠ SUPERSEDED EXPECTATION, recorded rather than quietly rewritten. This
    // test read `[…, 'v5_review_card', 'v5_coaching', 'v5_exercise']` — the
    // exercise LAST, on the slice-2 +Infinity convention. ROADMAP 2.211 §2
    // changes that deliberately (the selected lens is the turn's chosen
    // most-useful insight, and last meant behind `Show N more`). The exercise
    // now sits directly after the review cards. Nothing else about slice 2
    // moves: evidence still carries its own producer rank, malformed and
    // content-less blocks still fail closed, dedupe is unchanged.
    const out = composePhase3BridgedBlocks(
      true,
      [typedExerciseRaw(), typedCoachingRaw(), typedEvidenceRaw(), typedReviewCardRaw()],
      MAPPED,
    )
    expect(out.map((b) => b.type)).toEqual([
      'v5_analysis_result',
      'v5_evidence',
      'v5_review_card',
      'v5_exercise',
      'v5_coaching',
    ])
    const evidence = out[1] as V5EvidenceBlock
    expect(evidence.evidence_gap).toBe(
      'The conversion rate estimate is based on a single week of data.',
    )
    const exercise = out[3] as V5ExerciseBlock
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

  it('ROADMAP 2.211 §2: the lens exercise ranks directly AFTER the review cards, ahead of coaching', () => {
    // THE ADJUDICATION (ROADMAP 2.211 + parallel-briefs/LENS-EMISSION-2211,
    // orchestrator 1 Aug). The turn's selected lens is by definition the
    // system's chosen most-useful insight, and at +Infinity it sorted LAST —
    // behind `Show N more` in a phase-3 stack measured at 8-14 cards, where a
    // collapsed card returns `null` and is not in the DOM at all. Two clicks
    // from view even when emitted.
    //
    // The rank is DERIVED from this turn's review cards, not a UI-invented
    // number: the file's standing doctrine is producer-owned ordering ("No new
    // ranking is invented", selectTopPhase3ReviewCard). Expressing the position
    // RELATIVE to the producer's own ranks survives a CEE band change that any
    // hard-coded constant would silently invert (platform trap 12).
    const out = composePhase3BridgedBlocks(
      true,
      [
        typedCoachingRaw({ block_id: 'co-late', priority_rank: 202 }),
        typedExerciseRaw(),
        typedCoachingRaw({ block_id: 'co-first', priority_rank: 101 }),
        typedEvidenceRaw(),
        typedReviewCardRaw({ block_id: 'rc-last', priority_rank: 74 }),
        typedReviewCardRaw({ block_id: 'rc-top', priority_rank: 71 }),
      ],
      MAPPED,
    )
    // Live bands, from the staging capture the fixtures mirror
    // (cee-response-b82c89dd): evidence 41 < review 71-74 < coaching 101-202.
    expect(out.map((b) => b.type)).toEqual([
      'v5_analysis_result',
      'v5_evidence',
      'v5_review_card',
      'v5_review_card',
      'v5_exercise',
      'v5_coaching',
      'v5_coaching',
    ])
    // Named explicitly, because "directly after the review cards" is the whole
    // ruling: the LAST review card precedes it and the FIRST coaching follows.
    expect((out[3] as V5ReviewCardBlock).block_id).toBe('rc-last')
    expect((out[4] as V5ExerciseBlock).block_id).toBe('ex-typed-1')
    expect((out[5] as V5CoachingBlock).block_id).toBe('co-first')
  })

  it('ROADMAP 2.211 §2: the anchor is DERIVED — a shifted review band carries the exercise with it', () => {
    // The mutant a constant cannot survive. If CEE's review_card band ever moves
    // above the coaching band, a hard-coded UI rank would silently invert the
    // ruling ("after the review cards") while every other test stayed green.
    // Here review cards sit at 301-302 and coaching at 101: the exercise must
    // still land immediately after the review cards, which now means LAST.
    const out = composePhase3BridgedBlocks(
      true,
      [
        typedExerciseRaw(),
        typedCoachingRaw({ block_id: 'co-1', priority_rank: 101 }),
        typedReviewCardRaw({ block_id: 'rc-a', priority_rank: 301 }),
        typedReviewCardRaw({ block_id: 'rc-b', priority_rank: 302 }),
      ],
      [],
    )
    expect(out.map((b) => b.type)).toEqual([
      'v5_coaching',
      'v5_review_card',
      'v5_review_card',
      'v5_exercise',
    ])
    expect((out[2] as V5ReviewCardBlock).block_id).toBe('rc-b')
  })

  it('ROADMAP 2.211 §2: NO review card on the turn → the contract convention is kept, no rank invented', () => {
    // The exercise derives its permission from a surviving review card
    // (LENS-EMISSION-2211 §3), so an exercise with no review card beside it is
    // not the case this row is about. With no anchor to sit after, the v1.3
    // convention stands unchanged (+Infinity, harvest order) rather than a
    // number being made up. Pre-2.211 behaviour, preserved deliberately.
    const out = composePhase3BridgedBlocks(
      true,
      [typedExerciseRaw(), typedCoachingRaw(), typedEvidenceRaw()],
      [],
    )
    expect(out.map((b) => b.type)).toEqual(['v5_evidence', 'v5_coaching', 'v5_exercise'])
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
