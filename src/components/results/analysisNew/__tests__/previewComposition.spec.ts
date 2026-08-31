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
  /**
   * ⚠⚠ POLICY CHANGED HERE, DELIBERATELY — the previous expectation is recorded
   * below because it was correct under the old rule and is not a bug that was
   * fixed.
   *
   * WAS: exactly one swap, so this shape produced `clarify · clarify ·
   * challenge` and `strengthen:broaden` stayed below the fold.
   * NOW: `clarify · challenge · broaden`.
   *
   * The old rule intervened only when the preview asked for ONE kind. That was
   * right for the run it was written against. Then producer bias findings began
   * classifying honestly as `challenge`, heads started reading `[clarify,
   * challenge, challenge]`, and the rule bailed on two kinds while the only
   * creative move in the product sat at priority 140 below the fold.
   *
   * THE TRADE, STATED PLAINLY: a producer-ranked finding
   * (`strengthen:phase3:a`) loses its visible slot to a UI-triggered one
   * (`strengthen:broaden`). That is a real cost. It is taken because a slot
   * spent on a SECOND row of a kind already on screen buys the reader nothing,
   * and a kind of thinking they cannot see buys them a great deal.
   */
  it('fills the slots with as many DISTINCT kinds of thinking as are available', () => {
    const plan = planPreview(REAL_SHAPE, 3)

    expect(ids(plan.ordered).slice(0, 3)).toEqual([
      'strengthen:success-measure',
      'strengthen:robustness',
      'strengthen:broaden',
    ])
    // Three kinds on screen, from a head that offered one.
    expect(new Set(plan.ordered.slice(0, 3).map((r) => r.helpType)).size).toBe(3)
    expect(plan.promotedIds).toEqual(['strengthen:robustness', 'strengthen:broaden'])
  })

  /**
   * ⭐ THE GUARANTEE THAT STOPS THIS BEING A RE-RANK. Only rows whose kind is
   * ALREADY represented above the fold may be displaced, lowest-ranked first —
   * so the engine's top finding can never lose its slot, whatever else moves.
   */
  it('never displaces the engine’s top-ranked finding', () => {
    expect(ids(planPreview(REAL_SHAPE, 3).ordered)[0]).toBe('strengthen:success-measure')
    expect(ids(planPreview(REAL_SHAPE, 2).ordered)[0]).toBe('strengthen:success-measure')
    expect(ids(planPreview(REAL_SHAPE, 4).ordered)[0]).toBe('strengthen:success-measure')
  })

  /**
   * ⭐ AND THE OTHER HALF: a kind is never EVICTED to admit another. Displacing
   * the sole carrier of a kind would trade one absent kind for a different
   * absent kind and gain the reader nothing.
   */
  it('never evicts a kind to admit another', () => {
    const plan = planPreview(
      [rec('a', 'clarify'), rec('b', 'challenge'), rec('c', 'broaden'), rec('d', 'commit')],
      3,
    )
    // Head already carries three distinct kinds; `commit` stays below.
    expect(ids(plan.ordered)).toEqual(['a', 'b', 'c', 'd'])
    expect(plan.promotedIds).toEqual([])
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
    // `d` is promoted FIRST, which is the entitlement being tested. A second
    // pass then admits `e`, so `d` sits at index 1 once both kinds are on
    // screen — the order of PROMOTION is what this case pins.
    expect(plan.promotedId).toBe('d')
    expect(plan.promotedIds[0]).toBe('d')
    expect(ids(plan.ordered).slice(0, 3)).toEqual(['a', 'd', 'e'])
  })

  it('displaces to the FRONT of the tail — nothing is hidden, only reordered', () => {
    const plan = planPreview(REAL_SHAPE, 3)
    // The row that lost its slot is the first thing "Show N more" reveals.
    // Displaced rows lead the tail, in the order they were displaced.
    expect(ids(plan.ordered)[3]).toBe('strengthen:phase3:b')
    // And every input id is still present exactly once.
    expect(ids(plan.ordered).sort()).toEqual(ids(REAL_SHAPE).sort())
    expect(plan.ordered).toHaveLength(REAL_SHAPE.length)
  })

  it('reports which kinds are below the fold, so the disclosure can say why to open it', () => {
    const plan = planPreview(REAL_SHAPE, 3)
    // Only `clarify` remains below now that the creative move was surfaced —
    // which is precisely the improvement.
    expect(plan.hiddenKinds).toEqual(['clarify'])
  })
})

/**
 * ⚠ THE OPPOSITE DIRECTION, AND IT IS HALF THE POINT. A rule that always
 * reshuffled would pass every case above while overriding a producer ranking
 * that was already doing its job.
 */
describe('it does nothing when nothing needs doing', () => {
  /**
   * ⚠ THIS CASE INVERTED WITH THE POLICY, and it is the sharpest illustration
   * of why the policy changed. It used to assert that `[clarify, challenge,
   * clarify]` was left alone because it "already spans two kinds" — while a
   * `broaden` sat below the fold and a DUPLICATE `clarify` held the slot it
   * could have had. Two kinds shown, three available.
   */
  it('trades a DUPLICATE kind for one that is missing, even when already diverse', () => {
    const plan = planPreview(
      [rec('a', 'clarify'), rec('b', 'challenge'), rec('c', 'clarify'), rec('d', 'broaden')],
      3,
    )
    expect(ids(plan.ordered)).toEqual(['a', 'b', 'd', 'c'])
    expect(plan.promotedIds).toEqual(['d'])
    // Nothing lost: the displaced duplicate leads the tail.
    expect(ids(plan.ordered)).toHaveLength(4)
  })

  it('leaves a preview alone when every visible row is already a distinct kind', () => {
    const plan = planPreview(
      [rec('a', 'clarify'), rec('b', 'challenge'), rec('c', 'broaden'), rec('d', 'clarify')],
      3,
    )
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
