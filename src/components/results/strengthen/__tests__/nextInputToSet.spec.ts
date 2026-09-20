/**
 * THE NEXT INPUT THIS RUN TURNS ON — bound to two real captures.
 *
 * ⚠ THE FIXTURES ARE A RECORD, NOT AN OPINION. `__fixtures__/nextInputToSet.captures.json`
 * is generated from Paul's own debug bundles `olumi-debug-0db2eb0a-20260920.json`
 * and `olumi-debug-52383f4b-20260920.json`, both post-result on served UI build
 * `fd992149`. A fixture this module's author wrote by hand would confirm the
 * author's model of the producer rather than test it; these carry the
 * producer's own ids, labels, influence scores and blocking set verbatim.
 * APPEND-ONLY: add captures, never edit one to match a new expectation.
 *
 * ⚠ SCOPE OF `influence`. The captures carry the producer's `influence_score`,
 * which is what the display policy adopts when EVERY row carries one — true on
 * both of these. On a run where it does not, the panel's display value and this
 * number differ, and these fixtures say nothing about that case.
 */

import { describe, it, expect } from 'vitest'
import { selectNextInputToSet } from '../nextInputToSet'
import captures from '../__fixtures__/nextInputToSet.captures.json'

interface CaptureFactor {
  factorId: string
  label: string
  influence: number
  producerInfluenceRank: number
}
interface Capture {
  awaitingUserIds: string[]
  factors: CaptureFactor[]
  _permitted_analysis_mode: string
}
const CAPTURES = captures as unknown as Record<string, Capture>

// ⚠ ASSERT THE CORPUS ITSELF COLLECTED. A fixture file that failed to load
// would leave every `it` below iterating an empty list, and an empty loop is a
// green suite that ran nothing (CLAUDE.md trap 13 / the collect-shrink defect).
describe('nextInputToSet — the corpus', () => {
  it('carries exactly the two post-result captures, each in quantified_provisional', () => {
    const names = Object.keys(CAPTURES).sort()
    expect(names).toEqual(['0db2eb0a', '52383f4b'])
    for (const name of names) {
      expect(CAPTURES[name]._permitted_analysis_mode, name).toBe('quantified_provisional')
      expect(CAPTURES[name].factors.length, name).toBeGreaterThan(1)
      expect(CAPTURES[name].awaitingUserIds.length, name).toBeGreaterThan(1)
    }
  })
})

describe('nextInputToSet — on the real captures', () => {
  it.each([
    ['0db2eb0a', 'c4f243aa', 'Pitch Quality'],
    ['52383f4b', 'c2413bb5', 'New Customer Conversion Rate'],
  ])('%s names %s', (name, expectedId, expectedLabel) => {
    const c = CAPTURES[name]
    const got = selectNextInputToSet(c.factors, c.awaitingUserIds, true)
    expect(got).not.toBeNull()
    expect(got!.factorId).toBe(expectedId)
    expect(got!.label).toBe(expectedLabel)
    expect(got!.setSize).toBe(new Set(c.factors.map((f) => f.factorId)).size)
  })

  /**
   * ⭐ ONE RANK AUTHORITY. This module ranks by the policy-resolved display
   * value; the wire also carries the producer's own `influence_rank`. They must
   * agree, and this is what REDs if they ever fork — the point at which someone
   * would otherwise have to choose which of two answers to one question is the
   * real one.
   */
  it.each(Object.keys(CAPTURES))('%s agrees with the producer influence_rank', (name) => {
    const c = CAPTURES[name]
    const producerRankOne = c.factors.filter((f) => f.producerInfluenceRank === 1)
    expect(producerRankOne).toHaveLength(1)
    const got = selectNextInputToSet(c.factors, c.awaitingUserIds, true)
    expect(got!.factorId).toBe(producerRankOne[0].factorId)
  })

  /**
   * ⭐⭐ THE DISCRIMINATING PAIR. One alone proves nothing: the first shows the
   * selection is sensitive to the producer's set, the second shows it is NOT
   * sensitive to array order — which is what proves no UI sort is happening
   * (PLoT: "UI renders WITHOUT reordering").
   */
  it.each(Object.keys(CAPTURES))('%s falls back when rank 1 leaves the blocking set', (name) => {
    const c = CAPTURES[name]
    const chosen = selectNextInputToSet(c.factors, c.awaitingUserIds, true)!
    const without = c.awaitingUserIds.filter((id) => id !== chosen.factorId)
    expect(without.length).toBeGreaterThan(0)
    expect(selectNextInputToSet(c.factors, without, true)).toBeNull()
  })

  it.each(Object.keys(CAPTURES))('%s is unchanged when the factor array is reordered', (name) => {
    const c = CAPTURES[name]
    const forward = selectNextInputToSet(c.factors, c.awaitingUserIds, true)
    const reversed = selectNextInputToSet([...c.factors].reverse(), c.awaitingUserIds, true)
    expect(reversed).toEqual(forward)
  })

  it.each(Object.keys(CAPTURES))('%s names nothing when the identity is not current', (name) => {
    const c = CAPTURES[name]
    expect(selectNextInputToSet(c.factors, c.awaitingUserIds, false)).toBeNull()
  })

  /**
   * ⛔ THE BARE-AMOUNT TRAP. `declaresNoRange` is carried out, never swallowed:
   * a caller that routes to the value editor on such a factor can leave the
   * model unanalysable with no route back (`ModelRowView.tsx`, 10 Sep witness).
   */
  it.each(Object.keys(CAPTURES))('%s carries declaresNoRange through to the caller', (name) => {
    const c = CAPTURES[name]
    const top = c.factors.find((f) => f.producerInfluenceRank === 1)!
    const flagged = c.factors.map((f) =>
      f.factorId === top.factorId ? { ...f, declaresNoRange: true } : f,
    )
    expect(selectNextInputToSet(flagged, c.awaitingUserIds, true)!.declaresNoRange).toBe(true)
    expect(selectNextInputToSet(c.factors, c.awaitingUserIds, true)!.declaresNoRange).toBe(false)
  })
})

describe('nextInputToSet — fails closed', () => {
  const base = [
    { factorId: 'a', label: 'Alpha', influence: 0.9 },
    { factorId: 'b', label: 'Beta', influence: 0.2 },
  ]
  const blocking = ['a', 'b']

  it('names nothing on an undefined or empty blocking set', () => {
    expect(selectNextInputToSet(base, undefined, true)).toBeNull()
    expect(selectNextInputToSet(base, [], true)).toBeNull()
  })

  it('names nothing when one member of the set is unreadable', () => {
    expect(selectNextInputToSet(base, ['a', ''], true)).toBeNull()
  })

  it('names nothing when the top factor is not clear of its runner-up', () => {
    const tied = [
      { factorId: 'a', label: 'Alpha', influence: 0.5 },
      { factorId: 'b', label: 'Beta', influence: 0.5 },
    ]
    expect(selectNextInputToSet(tied, blocking, true)).toBeNull()
  })

  it('names nothing when there is no runner-up to rank against', () => {
    expect(selectNextInputToSet([base[0]], ['a'], true)).toBeNull()
  })

  it('names nothing when the chosen factor has no usable label', () => {
    const blank = [{ factorId: 'a', label: '   ', influence: 0.9 }, base[1]]
    expect(selectNextInputToSet(blank, blocking, true)).toBeNull()
  })
})
