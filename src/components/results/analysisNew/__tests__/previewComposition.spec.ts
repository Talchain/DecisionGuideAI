/**
 * The preview asks for more than one kind of thinking, when more than one is
 * available — and it does nothing at all when it is not needed.
 *
 * ⚠ EVERY CASE HERE BINDS BY IDENTITY (recommendation ids), never by a count or
 * a position that another finding could satisfy (CLAUDE.md trap 19). A count
 * cannot tell "the right thing was promoted" from "something was promoted".
 */

import { describe, expect, it } from 'vitest'

import { planPreview } from '../previewComposition'
import type { HelpType, Recommendation } from '../../strengthen/strengthenTypes'

const rec = (id: string, helpType: HelpType): Recommendation =>
  ({
    id,
    helpType,
    title: `Title ${id}`,
    signal: 'signal',
    whyNow: 'why',
    tryThis: 'try',
    sourceLine: 'Source: test.',
    action: { kind: 'ai-dialogue', label: 'Go', actionType: 'discuss', prompt: 'm' },
    targetId: null,
    priority: 1,
  }) as Recommendation

const ids = (recs: readonly Recommendation[]) => recs.map((r) => r.id)

/**
 * The real shape, from the measured staging run: a monotone `clarify` head
 * (a success-measure trigger plus producer guidance), with the only critical
 * and creative moves stranded below the fold.
 */
const REAL_SHAPE = [
  rec('strengthen:success-measure', 'clarify'),
  rec('strengthen:phase3:a', 'clarify'),
  rec('strengthen:phase3:b', 'clarify'),
  rec('strengthen:phase3:c', 'clarify'),
  rec('strengthen:robustness', 'challenge'),
  rec('strengthen:broaden', 'broaden'),
]

describe('the preview is not allowed to ask for only one kind of thought', () => {
  it('gives the last slot to the highest-ranked finding of a different kind', () => {
    const plan = planPreview(REAL_SHAPE, 3)

    // The engine's top two keep the positions they earned — this is not a re-rank.
    expect(ids(plan.ordered).slice(0, 2)).toEqual([
      'strengthen:success-measure',
      'strengthen:phase3:a',
    ])
    // ...and the third slot goes to the challenge move, by IDENTITY.
    expect(ids(plan.ordered)[2]).toBe('strengthen:robustness')
    expect(plan.promotedId).toBe('strengthen:robustness')
  })

  it('promotes the HIGHEST-RANKED different kind, not merely the first one it finds', () => {
    // `broaden` sits above `challenge` here, so `broaden` is the one entitled
    // to the slot. A rule keyed on a technique chip, or on "challenge is most
    // important", would pick the wrong row and this case would catch it.
    const plan = planPreview(
      [
        rec('a', 'clarify'),
        rec('b', 'clarify'),
        rec('c', 'clarify'),
        rec('d', 'broaden'),
        rec('e', 'challenge'),
      ],
      3,
    )
    expect(plan.promotedId).toBe('d')
    expect(ids(plan.ordered)[2]).toBe('d')
  })

  it('displaces to the FRONT of the tail — nothing is hidden, only reordered', () => {
    const plan = planPreview(REAL_SHAPE, 3)
    // The row that lost its slot is the first thing "Show N more" reveals.
    expect(ids(plan.ordered)[3]).toBe('strengthen:phase3:b')
    // And every input id is still present exactly once.
    expect(ids(plan.ordered).sort()).toEqual(ids(REAL_SHAPE).sort())
    expect(plan.ordered).toHaveLength(REAL_SHAPE.length)
  })

  it('reports which kinds are below the fold, so the disclosure can say why to open it', () => {
    const plan = planPreview(REAL_SHAPE, 3)
    expect(plan.hiddenKinds).toEqual(['clarify', 'broaden'])
  })
})

/**
 * ⚠ THE OPPOSITE DIRECTION, AND IT IS HALF THE POINT. A rule that always
 * reshuffled would pass every case above while overriding a producer ranking
 * that was already doing its job.
 */
describe('it does nothing when nothing needs doing', () => {
  it('leaves an already-diverse preview exactly as the engine ordered it', () => {
    const diverse = [
      rec('a', 'clarify'),
      rec('b', 'challenge'),
      rec('c', 'clarify'),
      rec('d', 'broaden'),
    ]
    const plan = planPreview(diverse, 3)
    expect(ids(plan.ordered)).toEqual(['a', 'b', 'c', 'd'])
    expect(plan.promotedId).toBeNull()
  })

  it('leaves a list with nothing below the fold alone', () => {
    const short = [rec('a', 'clarify'), rec('b', 'clarify')]
    const plan = planPreview(short, 3)
    expect(ids(plan.ordered)).toEqual(['a', 'b'])
    expect(plan.promotedId).toBeNull()
    expect(plan.hiddenKinds).toEqual([])
  })

  it('invents no diversity when every finding genuinely is the same kind', () => {
    const monotone = [
      rec('a', 'clarify'),
      rec('b', 'clarify'),
      rec('c', 'clarify'),
      rec('d', 'clarify'),
    ]
    const plan = planPreview(monotone, 3)
    expect(ids(plan.ordered)).toEqual(['a', 'b', 'c', 'd'])
    expect(plan.promotedId).toBeNull()
    expect(plan.hiddenKinds).toEqual(['clarify'])
  })

  it('handles an empty list and a zero preview without reordering anything', () => {
    expect(planPreview([], 3).ordered).toEqual([])
    expect(planPreview(REAL_SHAPE, 0).promotedId).toBeNull()
    expect(ids(planPreview(REAL_SHAPE, 0).ordered)).toEqual(ids(REAL_SHAPE))
  })
})
