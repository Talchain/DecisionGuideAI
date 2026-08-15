/**
 * messageComposition — the composition contract (PX-B).
 *
 * These guards bind the CONTRACT, not the current stacking behaviour:
 *   · every block lands in exactly one class (total partition — nothing dropped)
 *   · at most MAX_POINTS points are exposed
 *   · producer order is preserved inside every class (no UI-invented rank)
 *   · a headline is only ever the producer's own (no fabrication)
 *
 * Assertions bind blocks by INDEX — the block's identity — never by a value
 * predicate another block could satisfy (platform trap 19).
 */
import { describe, it, expect } from 'vitest'
import {
  composeMessage,
  assertTotalPartition,
  isPointCandidate,
  isPinnedBlock,
  MAX_POINTS,
  POINT_CANDIDATE_TYPES,
  PINNED_BLOCK_TYPES,
} from '../messageComposition'
import type { ConversationBlock } from '../types'

/** Minimal well-typed block builders — only the fields the composition reads. */
const coaching = (id: string): ConversationBlock =>
  ({ type: 'v5_coaching', id, body: id }) as unknown as ConversationBlock
const reviewCard = (id: string): ConversationBlock =>
  ({ type: 'v5_review_card', id, severity: 'info', title: id, body: id }) as unknown as ConversationBlock
const exercise = (id: string): ConversationBlock =>
  ({ type: 'v5_exercise', id, title: id }) as unknown as ConversationBlock
const patch = (id: string): ConversationBlock =>
  ({ type: 'graph_patch', patch_id: id, operations: [] }) as unknown as ConversationBlock
const commentary = (id: string): ConversationBlock =>
  ({ type: 'commentary', text: id }) as unknown as ConversationBlock
const comparison = (id: string): ConversationBlock =>
  ({ type: 'comparison', options: [], id }) as unknown as ConversationBlock
const premortem = (id: string): ConversationBlock =>
  ({ type: 'premortem', risk_paths: [], id }) as unknown as ConversationBlock

describe('composeMessage — total partition (nothing is dropped)', () => {
  it('places every block in exactly one class, for a flood turn', () => {
    // The live phase-3 counts this repo measured are 8-14 cards per analysis
    // turn (phase3Pacing.ts). 14 is the worst measured case.
    const blocks = [
      patch('p1'),
      commentary('c'),
      ...Array.from({ length: 14 }, (_, i) => coaching(`k${i}`)),
      comparison('cmp'),
      premortem('pm'),
    ]
    const composition = composeMessage(blocks)
    expect(assertTotalPartition(blocks.length, composition)).toBeNull()
  })

  it('holds for an empty turn', () => {
    const composition = composeMessage([])
    expect(assertTotalPartition(0, composition)).toBeNull()
    expect(composition.points).toEqual([])
    expect(composition.pinned).toEqual([])
    expect(composition.detail).toEqual([])
  })

  it('holds when every block is a point candidate', () => {
    const blocks = Array.from({ length: 9 }, (_, i) => reviewCard(`r${i}`))
    const composition = composeMessage(blocks)
    expect(assertTotalPartition(blocks.length, composition)).toBeNull()
    expect(composition.points).toHaveLength(MAX_POINTS)
    expect(composition.detail).toHaveLength(9 - MAX_POINTS)
  })

  it('holds when no block is a point candidate', () => {
    const blocks = [comparison('a'), premortem('b')]
    const composition = composeMessage(blocks)
    expect(assertTotalPartition(blocks.length, composition)).toBeNull()
    // FILL: with no coaching cards competing, these take the free slots rather
    // than being demoted — see the "never hides a small turn" block below.
    expect(composition.points.map((e) => e.index)).toEqual([0, 1])
    expect(composition.detail).toEqual([])
  })

  // The partition checker must be able to FAIL, or every case above is vacuous
  // (platform trap 13 — an absence probe needs a positive control).
  it('assertTotalPartition detects a dropped block', () => {
    const blocks = [coaching('a'), coaching('b')]
    const composition = composeMessage(blocks)
    const lossy = { ...composition, points: composition.points.slice(0, 1) }
    expect(assertTotalPartition(blocks.length, lossy)).toContain('1 of 2')
  })

  it('assertTotalPartition detects a duplicated block', () => {
    const blocks = [coaching('a'), coaching('b')]
    const composition = composeMessage(blocks)
    const dup = { ...composition, detail: [{ index: 0, blockType: 'v5_coaching' as const }] }
    expect(assertTotalPartition(blocks.length, dup)).toContain('more than one class')
  })
})

describe('composeMessage — the ≤3 point cap', () => {
  it('exposes at most MAX_POINTS points however many cards arrive', () => {
    for (const n of [0, 1, 3, 4, 8, 14, 30]) {
      const blocks = Array.from({ length: n }, (_, i) => coaching(`k${i}`))
      const composition = composeMessage(blocks)
      expect(composition.points.length).toBe(Math.min(n, MAX_POINTS))
      expect(assertTotalPartition(n, composition)).toBeNull()
    }
  })

  it('demotes the overflow to detail rather than dropping it', () => {
    const blocks = Array.from({ length: 8 }, (_, i) => coaching(`k${i}`))
    const composition = composeMessage(blocks)
    // Bound by IDENTITY: indices 0-2 are the points, 3-7 the demoted remainder.
    expect(composition.points.map((e) => e.index)).toEqual([0, 1, 2])
    expect(composition.detail.map((e) => e.index)).toEqual([3, 4, 5, 6, 7])
  })
})

/**
 * OPPOSITE-DIRECTION TWINS for the cap.
 *
 * The cap defends against a flood. These defend against its inverse: a small
 * turn silently hidden behind a disclosure. Found by running the real render
 * specs against the first version of this module, which demoted a lone `fact`
 * block and produced an EMPTY message body above a "Show 1 more" toggle.
 * A corpus that only tested the flood direction certified that build.
 */
describe('composeMessage — never hides a small turn (the cap has two harms)', () => {
  it('exposes a lone non-coaching block at top level', () => {
    for (const b of [comparison('c'), premortem('p'),
      { type: 'fact', label: 'x', value: '1' } as unknown as ConversationBlock,
      { type: 'framing', goal: 'g', options: [] } as unknown as ConversationBlock,
      { type: 'brief', title: 't', summary: 's' } as unknown as ConversationBlock,
      { type: 'totally_unknown_kind' } as unknown as ConversationBlock,
    ]) {
      const composition = composeMessage([b])
      expect(composition.detail).toEqual([])
      expect([...composition.pinned, ...composition.points]).toHaveLength(1)
    }
  })

  it('never produces a detail class while a top-level slot is free', () => {
    // Exhaustive over small mixed turns: if anything is demoted, the top level
    // must be full. A demotion with a spare slot is the empty-body defect.
    const kinds = [coaching('k'), comparison('c'), patch('p'), commentary('m'), exercise('e')]
    for (let n = 0; n <= 5; n++) {
      for (let offset = 0; offset < kinds.length; offset++) {
        const blocks = Array.from({ length: n }, (_, i) => kinds[(i + offset) % kinds.length])
        const composition = composeMessage(blocks)
        expect(assertTotalPartition(blocks.length, composition)).toBeNull()
        if (composition.detail.length > 0) {
          expect(composition.points.length).toBe(MAX_POINTS)
        }
      }
    }
  })

  it('fills free slots from non-coaching blocks in producer order', () => {
    const blocks = [comparison('c'), coaching('k'), premortem('p')]
    const composition = composeMessage(blocks)
    expect(composition.points.map((e) => e.index)).toEqual([0, 1, 2])
    expect(composition.detail).toEqual([])
  })

  it('gives coaching cards first claim on the slots, then fills', () => {
    // 2 coaching cards + 3 others: coaching takes 2 slots, the EARLIEST other
    // takes the third, the remaining others are demoted.
    const blocks = [comparison('c'), premortem('p'), coaching('k1'), coaching('k2'), comparison('c2')]
    const composition = composeMessage(blocks)
    expect(composition.points.map((e) => e.index)).toEqual([0, 2, 3])
    expect(composition.detail.map((e) => e.index)).toEqual([1, 4])
  })

  it('does not let the fill resurrect a demoted coaching overflow card', () => {
    // 5 coaching cards and nothing else: 3 points, 2 demoted. The fill must not
    // pull the overflow back in — that would defeat the cap entirely.
    const blocks = Array.from({ length: 5 }, (_, i) => coaching(`k${i}`))
    const composition = composeMessage(blocks)
    expect(composition.points.map((e) => e.index)).toEqual([0, 1, 2])
    expect(composition.detail.map((e) => e.index)).toEqual([3, 4])
  })
})

describe('composeMessage — producer order is preserved (no UI-invented rank)', () => {
  it('takes a PREFIX of the candidates, never a sorted selection', () => {
    // Severity deliberately descends: a UI that re-ranked by severity would
    // pick the LAST card first. Producer order must win.
    const blocks = [
      { type: 'v5_review_card', id: 'first', severity: 'info' },
      { type: 'v5_review_card', id: 'second', severity: 'warning' },
      { type: 'v5_review_card', id: 'third', severity: 'critical' },
      { type: 'v5_review_card', id: 'fourth', severity: 'critical' },
    ] as unknown as ConversationBlock[]
    const composition = composeMessage(blocks)
    expect(composition.points.map((e) => e.index)).toEqual([0, 1, 2])
    expect(composition.detail.map((e) => e.index)).toEqual([3])
  })

  it('keeps indices ascending within each class', () => {
    const blocks = [
      coaching('a'), comparison('x'), coaching('b'), patch('p'),
      coaching('c'), premortem('y'), coaching('d'),
    ]
    const composition = composeMessage(blocks)
    const ascending = (xs: number[]) => xs.every((v, i) => i === 0 || v > xs[i - 1])
    expect(ascending(composition.points.map((e) => e.index))).toBe(true)
    expect(ascending(composition.detail.map((e) => e.index))).toBe(true)
    expect(ascending(composition.pinned.map((e) => e.index))).toBe(true)
  })
})

describe('composeMessage — pinned blocks survive the cap', () => {
  it('keeps a graph patch top-level behind a flood of cards', () => {
    const blocks = [...Array.from({ length: 12 }, (_, i) => coaching(`k${i}`)), patch('p1')]
    const composition = composeMessage(blocks)
    expect(composition.pinned.map((e) => e.index)).toEqual([12])
    expect(composition.detail.map((e) => e.index)).not.toContain(12)
  })

  it('never counts a pinned block against the point cap', () => {
    const blocks = [patch('p'), commentary('c'), coaching('a'), coaching('b'), coaching('c2')]
    const composition = composeMessage(blocks)
    expect(composition.pinned.map((e) => e.index)).toEqual([0, 1])
    expect(composition.points.map((e) => e.index)).toEqual([2, 3, 4])
    expect(composition.detail).toEqual([])
  })

  it('pins consent affordances — a proposal is never demoted into the disclosure', () => {
    const blocks = [
      ...Array.from({ length: 6 }, (_, i) => coaching(`k${i}`)),
      { type: 'v5_held_proposal', id: 'hp' } as unknown as ConversationBlock,
    ]
    const composition = composeMessage(blocks)
    expect(composition.pinned.map((e) => e.index)).toEqual([6])
  })

  it('the pinned and point-candidate sets are disjoint', () => {
    for (const t of PINNED_BLOCK_TYPES) {
      expect(POINT_CANDIDATE_TYPES.has(t)).toBe(false)
    }
  })
})

describe('composeMessage — lens companion reservation (ROADMAP 2.242 carried forward)', () => {
  it('promotes an overflowed companion card by DISPLACING a point, not adding one', () => {
    const blocks = [coaching('a'), coaching('b'), coaching('c'), coaching('d'), exercise('lens')]
    const composition = composeMessage(blocks)
    expect(composition.points).toHaveLength(MAX_POINTS)
    // The companion (index 4) is promoted; the last point (index 2) is displaced.
    expect(composition.points.map((e) => e.index)).toEqual([0, 1, 4])
    expect(composition.detail.map((e) => e.index)).toEqual([2, 3])
    expect(assertTotalPartition(blocks.length, composition)).toBeNull()
  })

  it('does not displace anything when the companion already fits', () => {
    const blocks = [coaching('a'), exercise('lens'), coaching('b')]
    const composition = composeMessage(blocks)
    expect(composition.points.map((e) => e.index)).toEqual([0, 1, 2])
  })

  it('never opens a fourth point when two companions arrive', () => {
    const blocks = [
      coaching('a'), coaching('b'), coaching('c'), coaching('d'),
      exercise('lens1'), exercise('lens2'),
    ]
    const composition = composeMessage(blocks)
    expect(composition.points).toHaveLength(MAX_POINTS)
    expect(assertTotalPartition(blocks.length, composition)).toBeNull()
  })
})

describe('composeMessage — the headline is never fabricated', () => {
  it('is null when the producer supplied none', () => {
    expect(composeMessage([commentary('a long piece of prose')]).headline).toBeNull()
    expect(composeMessage([]).headline).toBeNull()
  })

  it('is the producer headline verbatim when supplied', () => {
    const composition = composeMessage([], 'Raising price is the stronger option.')
    expect(composition.headline).toBe('Raising price is the stronger option.')
  })
})

describe('classification predicates', () => {
  it('classifies each block exactly once', () => {
    const samples: ConversationBlock[] = [
      coaching('a'), reviewCard('b'), exercise('c'),
      patch('d'), commentary('e'), comparison('f'), premortem('g'),
    ]
    for (const b of samples) {
      expect(isPinnedBlock(b) && isPointCandidate(b)).toBe(false)
    }
  })
})
