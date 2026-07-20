/**
 * UI-SEM-085 (narrowed) — consume the producer's guidance `category` +
 * `priority` + `priority_rank` on their own contract terms.
 *
 * THE 0.19.0 CONTRACT (vendored tarball, package/dist/boundary/blocks.js,
 * stated once and authoritatively by the producer):
 *   - `priority_rank` is an ASCENDING ordinal: LOWER = shown FIRST. Positive
 *     integers, UNBOUNDED — "never invert it against 100 (ranks >= 100 are
 *     routine)". Bands: 1-9 lifecycle, 10-99 review cards, 100-199 coaching,
 *     200+ prompts/exercises. Equal ranks are producer-order ties.
 *   - `priority` is a COARSE 0-100 urgency, HIGHER = more urgent,
 *     band-granular (derived 1:1 from `category`; ties expected). It is NOT
 *     a display order — order by `priority_rank`, budget/style by `priority`.
 *   - `category` is the four-value code-keyed class.
 *
 * THE DEFECT THIS PINS (live, confirmed by an external Codex review):
 * `deriveGuidance` computed `100 - priority_rank` clamped to [0,100], so
 * every rank >= 100 clamped to 0 and the whole coaching band (100-199, in
 * use TODAY) collapsed into one tie broken by wire array order — presented
 * as merit. These tests are RED on that code by construction.
 *
 * NOTE ON LOCATION: deliberately OUTSIDE `src/v5/**` (the CI-tsc widening
 * trap) even though it exercises the v5 extractor.
 */
import { describe, expect, it } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import {
  ADDITIVE_EXTENSIONS_KEY,
  type OlumiResponseWithExtensions,
} from '../../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../../v5/extractPhase3FromV5Response'
import {
  compareGuidanceDisplayOrder,
  selectTopItem,
  type GuidanceItem,
  type GuidanceState,
} from '../../../../canvas/stores/guidanceStore'
import { buildRecommendations, toStrengthenPhase3Item } from '../buildRecommendations'
import type { StrengthenInputs } from '../strengthenTypes'

// ─── Wire plumbing (the real sidecar path the live V5 writer uses) ─────────

const extract = (blocks: Array<Record<string, unknown>>) => {
  const response = {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  } as unknown as OlumiResponse
  Object.defineProperty(response, ADDITIVE_EXTENSIONS_KEY, {
    value: Object.freeze({ phase3_blocks: blocks }),
    enumerable: false,
    writable: false,
    configurable: false,
  })
  return extractPhase3FromV5Response(response as OlumiResponseWithExtensions)
}

/** Realistic 0.19.0 coaching-band wire block (field names per the schema
 * fixtures: maximalCoachingBlock carries priority_rank + category + priority). */
const coachingBlock = (over: Record<string, unknown>): Record<string, unknown> => ({
  type: 'coaching',
  coaching_kind: 'strengthen',
  source: 'decision_review',
  freshness: 'fresh',
  ...over,
})

const baseInputs: StrengthenInputs = {
  goalThreshold: 62,
  analysisComplete: true,
  fragileEdges: [],
  factors: [],
  robustness: { status: null, level: null },
  biasFindingTypes: [],
  phase3Items: [],
}

const withFlip: Pick<StrengthenInputs, 'fragileEdges'> = {
  fragileEdges: [{ edgeId: 'e1', factorLabel: 'Salary cost', switchProbability: 0.62 }],
}

const UNRANKED_LINE = 'Source: Olumi model review (not ranked — shown in the order received).'
const RANKED_LINE = 'Source: Olumi model review.'

const makeStoreItem = (over: Partial<GuidanceItem>): GuidanceItem => ({
  item_id: 'i1',
  signal_code: 'coaching',
  category: 'should_fix',
  source: 'analysis',
  title: 'T',
  primary_action: { type: 'discuss', prompt: 'p' },
  priority: 50,
  ...over,
})

const stateWith = (items: GuidanceItem[]): GuidanceState =>
  ({ guidanceItems: items, activeGuidanceItemId: null }) as unknown as GuidanceState

// ─── Leg A: the ONE wire→internal mapping site (deriveGuidance) ────────────

describe('deriveGuidance — consumes 0.19.0 producer fields on their own terms', () => {
  it('THE DEFECT: coaching-band ranks (>= 100) are carried verbatim, never clamped into a tie', () => {
    const res = extract([
      coachingBlock({ block_id: 'c-201', title: 'Prompt-band block', priority_rank: 201 }),
      coachingBlock({ block_id: 'c-101', title: 'Coaching-band block A', priority_rank: 101 }),
      coachingBlock({ block_id: 'c-150', title: 'Coaching-band block B', priority_rank: 150 }),
    ])
    // Arrival order preserved in the array; ranks preserved verbatim.
    expect(res.guidanceItems.map((g) => g.priorityRank)).toEqual([201, 101, 150])
  })

  it('never derives the urgency `priority` from `priority_rank` (an order is not a score)', () => {
    const res = extract([
      coachingBlock({ block_id: 'c-1', title: 'Rank only', priority_rank: 101 }),
    ])
    const item = res.guidanceItems[0]
    expect(item.priorityRank).toBe(101)
    // Wire `priority` absent → the 50 fail-closed default, disclosed as such.
    expect(item.priority).toBe(50)
    expect(item.priorityIsProducerSupplied).toBe(false)
  })

  it('consumes producer `priority` verbatim (0-100, higher = more urgent) with the flag set', () => {
    const res = extract([
      coachingBlock({
        block_id: 'c-1',
        title: 'Full 0.19.0 block',
        priority_rank: 101,
        category: 'must_fix',
        priority: 90,
      }),
    ])
    const item = res.guidanceItems[0]
    expect(item.priority).toBe(90)
    expect(item.priorityIsProducerSupplied).toBe(true)
    expect(item.category).toBe('must_fix')
    expect(item.priorityRank).toBe(101)
  })

  it('consumes producer `category` for all four canonical values; fail-closed default only on genuine absence', () => {
    const res = extract([
      coachingBlock({ block_id: 'c-1', title: 'A', category: 'technique', priority: 30 }),
      coachingBlock({ block_id: 'c-2', title: 'B', category: 'could_fix', priority: 50 }),
      coachingBlock({ block_id: 'c-3', title: 'C' }), // pre-0.19.0 block
    ])
    expect(res.guidanceItems.map((g) => g.category)).toEqual([
      'technique',
      'could_fix',
      'should_fix', // fail-closed default, rare path
    ])
  })

  it('fails closed to unranked on a malformed rank (non-integer or < 1)', () => {
    const res = extract([
      coachingBlock({ block_id: 'c-1', title: 'A', priority_rank: 10.5 }),
      coachingBlock({ block_id: 'c-2', title: 'B', priority_rank: 0 }),
      coachingBlock({ block_id: 'c-3', title: 'C', priority_rank: -3 }),
    ])
    expect(res.guidanceItems.map((g) => g.priorityRank)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
  })
})

// ─── Leg B: the engine orders by the producer's ascending rank ─────────────

describe('buildRecommendations — ascending producer rank, no collapse, bands intact', () => {
  const wireToInputs = (blocks: Array<Record<string, unknown>>): StrengthenInputs => ({
    ...baseInputs,
    ...withFlip,
    phase3Items: extract(blocks).guidanceItems.map(toStrengthenPhase3Item),
  })

  it('THE DEFECT, end to end: scrambled coaching-band ranks order ascending with distinct priorities', () => {
    const recs = buildRecommendations(
      wireToInputs([
        coachingBlock({ block_id: 'c-201', title: 'Rank 201', priority_rank: 201 }),
        coachingBlock({ block_id: 'c-101', title: 'Rank 101', priority_rank: 101 }),
        coachingBlock({ block_id: 'c-150', title: 'Rank 150', priority_rank: 150 }),
      ]),
    )
    const phase3 = recs
      .filter((r) => r.id.startsWith('strengthen:phase3:'))
      .sort((a, b) => a.priority - b.priority)
    // Producer order (101, 150, 201), NOT the wire arrival order (201, 101, 150).
    expect(phase3.map((r) => r.id)).toEqual([
      'strengthen:phase3:c-101',
      'strengthen:phase3:c-150',
      'strengthen:phase3:c-201',
    ])
    // No collapse: three distinct engine priorities.
    expect(new Set(phase3.map((r) => r.priority)).size).toBe(3)
  })

  it('a producer-ranked block stays ABOVE the flip trigger whatever its band (ranks are unbounded)', () => {
    const recs = buildRecommendations(
      wireToInputs([
        coachingBlock({ block_id: 'c-1', title: 'Prompt-band rank', priority_rank: 201 }),
      ]),
    )
    const phase3 = recs.find((r) => r.id === 'strengthen:phase3:c-1')!
    const flip = recs.find((r) => r.id.startsWith('strengthen:flip:'))!
    expect(phase3.priority).toBeLessThan(flip.priority)
  })

  it('equal ranks are producer-order ties: arrival order holds (schema-blessed, labelled ranked)', () => {
    const recs = buildRecommendations(
      wireToInputs([
        coachingBlock({ block_id: 'c-b', title: 'Tie B', priority_rank: 101 }),
        coachingBlock({ block_id: 'c-a', title: 'Tie A', priority_rank: 101 }),
      ]),
    )
    const phase3 = recs
      .filter((r) => r.id.startsWith('strengthen:phase3:'))
      .sort((a, b) => a.priority - b.priority)
    expect(phase3.map((r) => r.id)).toEqual(['strengthen:phase3:c-b', 'strengthen:phase3:c-a'])
    expect(phase3.every((r) => r.sourceLine === RANKED_LINE)).toBe(true)
  })

  it('a genuinely-unranked block (exercise-class: priority but NO rank) is demoted and labelled', () => {
    // maximalExerciseBlock in the 0.19.0 fixtures carries category+priority
    // but no priority_rank — the contract has no producer ORDER for it.
    const recs = buildRecommendations(
      wireToInputs([
        coachingBlock({ block_id: 'c-r', title: 'Ranked', priority_rank: 101 }),
        coachingBlock({ block_id: 'c-u', title: 'Unranked', category: 'technique', priority: 30 }),
      ]),
    )
    const ranked = recs.find((r) => r.id === 'strengthen:phase3:c-r')!
    const unranked = recs.find((r) => r.id === 'strengthen:phase3:c-u')!
    expect(ranked.sourceLine).toBe(RANKED_LINE)
    expect(unranked.sourceLine).toBe(UNRANKED_LINE)
    // Demoted below the whole producer-backed ladder (commit = 200).
    expect(unranked.priority).toBeGreaterThan(200)
    expect(ranked.priority).toBeLessThan(100)
  })

  it('spends the promotion budget on producer-ranked rows before unranked ones', () => {
    const recs = buildRecommendations(
      wireToInputs([
        coachingBlock({ block_id: 'u1', title: 'Unranked 1' }),
        coachingBlock({ block_id: 'u2', title: 'Unranked 2' }),
        coachingBlock({ block_id: 'u3', title: 'Unranked 3' }),
        coachingBlock({ block_id: 'u4', title: 'Unranked 4' }),
        coachingBlock({ block_id: 'r1', title: 'Ranked late', priority_rank: 201 }),
      ]),
    )
    const ids = recs.filter((r) => r.id.startsWith('strengthen:phase3:')).map((r) => r.id)
    expect(ids).toHaveLength(4)
    expect(ids).toContain('strengthen:phase3:r1')
  })
})

// ─── Leg C: one display-order doctrine for every store consumer ────────────

describe('compareGuidanceDisplayOrder / selectTopItem — rank ascending, ranked first', () => {
  it('selectTopItem returns the LOWEST producer rank (lifecycle rank 5 beats coaching rank 101)', () => {
    const top = selectTopItem(
      stateWith([
        makeStoreItem({ item_id: 'coach', priorityRank: 101 }),
        makeStoreItem({ item_id: 'lifecycle', priorityRank: 5 }),
      ]),
    )
    expect(top?.item_id).toBe('lifecycle')
  })

  it('a producer-ranked item beats an unranked one regardless of urgency values', () => {
    const top = selectTopItem(
      stateWith([
        makeStoreItem({ item_id: 'unranked-urgent', priority: 90 }),
        makeStoreItem({ item_id: 'ranked', priorityRank: 150, priority: 50 }),
      ]),
    )
    expect(top?.item_id).toBe('ranked')
  })

  it('with no ranked items, falls back to the highest coarse urgency (legacy behaviour)', () => {
    const top = selectTopItem(
      stateWith([
        makeStoreItem({ item_id: 'low', priority: 20 }),
        makeStoreItem({ item_id: 'high', priority: 90 }),
      ]),
    )
    expect(top?.item_id).toBe('high')
  })

  it('the comparator sorts ranked-ascending then unranked by urgency-descending', () => {
    const items = [
      makeStoreItem({ item_id: 'u-low', priority: 10 }),
      makeStoreItem({ item_id: 'r-150', priorityRank: 150 }),
      makeStoreItem({ item_id: 'u-high', priority: 90 }),
      makeStoreItem({ item_id: 'r-12', priorityRank: 12 }),
    ]
    const sorted = [...items].sort(compareGuidanceDisplayOrder)
    expect(sorted.map((i) => i.item_id)).toEqual(['r-12', 'r-150', 'u-high', 'u-low'])
  })
})
