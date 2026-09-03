/**
 * The persistent-label SET — one label per target.
 *
 * Why this exists. `edgeLabelCollision.ts` records a measurement rather than a
 * preference: with one vertical degree of freedom and a fixed 160-wide box,
 * "three labels converging on a goal card have no clean assignment, and no
 * weighting invents one". It names exactly two exits — move labels sideways,
 * or pin fewer of them. This selector is the second exit, and it is
 * SUBTRACTION, not a new heuristic: rank exactly as before, then keep the
 * best-ranked edge PER TARGET before taking the top N.
 *
 * The founder's screenshot is the ONE-target case: three labels stacked into a
 * single goal card, two of them overlapping. Capping per target makes that
 * geometry unreachable rather than merely better-resolved.
 *
 * ⛔ NON-VACUITY CONTROL. A selector that returned "1" for everything would
 * pass the headline case, so the three-DISTINCT-targets case is asserted in
 * the same suite and must return 3. One test alone proves nothing here.
 *
 * ORDERING CONTRACT: the input is already in descending rank order with ties
 * broken by id at the call site (StyledEdge ranks by composite importance
 * post-analysis and by |strength.mean| pre-analysis — two different
 * comparators over one policy, so the ordering stays with the ranker and this
 * selector is a pure order-preserving filter).
 */
import { describe, it, expect } from 'vitest'
import {
  selectPersistentStrengthIds,
  PERSISTENT_LABEL_LIMIT,
  type RankedCausalEdge,
} from '../edgeLabelVisibility'

const e = (id: string, target: string): RankedCausalEdge => ({ id, target })

describe('selectPersistentStrengthIds — one label per target, then the top N', () => {
  it('THE DEFECT: three edges converging on ONE target pin exactly one label', () => {
    const out = selectPersistentStrengthIds([
      e('a', 'goal'),
      e('b', 'goal'),
      e('c', 'goal'),
    ])
    expect(out.size).toBe(1)
    // Bound by IDENTITY, not by size alone: the BEST-RANKED edge is the one
    // that survives, so the label that stays is the one worth reading.
    expect([...out]).toEqual(['a'])
  })

  it('CONTROL (non-vacuity): three edges into THREE targets still pin three', () => {
    const out = selectPersistentStrengthIds([
      e('a', 'g1'),
      e('b', 'g2'),
      e('c', 'g3'),
    ])
    expect(out.size).toBe(3)
    expect([...out].sort()).toEqual(['a', 'b', 'c'])
  })

  it('takes the best-ranked per target and then the top N across targets', () => {
    // Six edges, four targets, ranked a > b > c > d > f > g.
    const out = selectPersistentStrengthIds([
      e('a', 'g1'),
      e('b', 'g1'), // dropped: g1 already represented by the better-ranked a
      e('c', 'g2'),
      e('d', 'g3'),
      e('f', 'g4'), // dropped: the top-N limit is already reached
      e('g', 'g2'), // dropped: g2 already represented by c
    ])
    expect([...out]).toEqual(['a', 'c', 'd'])
    expect(out.size).toBe(PERSISTENT_LABEL_LIMIT)
  })

  it('never exceeds the limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => e(`e${i}`, `t${i}`))
    expect(selectPersistentStrengthIds(many).size).toBe(PERSISTENT_LABEL_LIMIT)
  })

  it('is deterministic — the same input yields the same set, twice', () => {
    const input = [e('a', 'g1'), e('b', 'g1'), e('c', 'g2'), e('d', 'g3')]
    const first = [...selectPersistentStrengthIds(input)]
    const second = [...selectPersistentStrengthIds(input)]
    expect(first).toEqual(second)
    expect(first).toEqual(['a', 'c', 'd'])
  })

  it('resolves a rank tie by the caller-supplied id order — the earlier id wins its target', () => {
    // Callers sort ties by id, so an id-ordered pair arrives in id order and
    // the selector must preserve it rather than re-ordering on its own.
    expect([...selectPersistentStrengthIds([e('aaa', 'g'), e('bbb', 'g')])]).toEqual(['aaa'])
    expect([...selectPersistentStrengthIds([e('bbb', 'g'), e('aaa', 'g')])]).toEqual(['bbb'])
  })

  it('an empty input pins nothing', () => {
    expect(selectPersistentStrengthIds([]).size).toBe(0)
  })

  it('honours an explicit limit', () => {
    const out = selectPersistentStrengthIds([e('a', 'g1'), e('b', 'g2')], 1)
    expect([...out]).toEqual(['a'])
  })
})
