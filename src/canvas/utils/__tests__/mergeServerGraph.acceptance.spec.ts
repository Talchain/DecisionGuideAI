/**
 * L61 ITEM 2 (merge half) — RED-first. A REFUSAL MUST BE DISTINGUISHABLE FROM
 * AN IDEMPOTENT MERGE.
 *
 * `mergeServerGraphOnHydrate` has three refusal exits — unusable shape, an empty
 * server graph, and the zero-node-id-overlap structural guard — and every one of
 * them returned the SAME all-zero counts an ACCEPTED-but-idempotent merge
 * returns. The caller therefore could not tell "I read the server's graph and it
 * matched" from "I refused to look at it", and went on to record CEE's identity
 * token for a graph it had just thrown away.
 *
 * The decision this pins: `accepted` is TRUE exactly when the merge reached the
 * body that records `lastAuthoritativeGraph` and writes. That is a STRUCTURAL
 * definition, not a second flag someone has to remember to set — the two identity
 * records (`lastAuthoritativeGraph` here, `serverGraphIdentity` in the hydration
 * caller) now answer to ONE rule instead of drifting apart.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'

function seed(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      { id: 'factor-1', type: 'factor', position: { x: 10, y: 20 }, data: { label: 'Spend', kind: 'factor', value: 100 } },
      { id: 'goal-1', type: 'goal', position: { x: 300, y: 400 }, data: { label: 'Profit', kind: 'goal', value: 5 } },
    ] as never,
    edges: [] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
  } as never)
}

beforeEach(seed)

describe('§1 the three refusals report themselves', () => {
  it('ZERO OVERLAP is a refusal, not an idempotent merge', () => {
    const res = mergeServerGraphOnHydrate({
      nodes: [
        { id: 'unrelated-a', kind: 'factor', label: 'Other' },
        { id: 'unrelated-b', kind: 'goal', label: 'Elsewhere' },
      ],
      edges: [],
    })
    expect(res.accepted).toBe(false)
    expect(res.refusedReason).toBe('zeroOverlap')
    expect(res.changed).toBe(false)
  })

  it('an EMPTY server graph is a refusal — nothing was observed', () => {
    const res = mergeServerGraphOnHydrate({ nodes: [], edges: [] })
    expect(res.accepted).toBe(false)
    expect(res.refusedReason).toBe('emptyServerGraph')
  })

  it('an UNUSABLE shape is a refusal', () => {
    expect(mergeServerGraphOnHydrate(null).accepted).toBe(false)
    expect(mergeServerGraphOnHydrate(null).refusedReason).toBe('unusableShape')
    expect(mergeServerGraphOnHydrate('not a graph').refusedReason).toBe('unusableShape')
  })
})

describe('§2 acceptance is reported for BOTH a changing and an idempotent merge', () => {
  it('a merge that MOVED a value is accepted AND changed', () => {
    const res = mergeServerGraphOnHydrate({
      nodes: [{ id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 }],
      edges: [],
    })
    expect(res.accepted).toBe(true)
    expect(res.refusedReason).toBeNull()
    expect(res.changed).toBe(true)
    expect(res.updatedNodeCount).toBe(1)
  })

  it('THE DISCRIMINATING CASE — an IDEMPOTENT merge is accepted but NOT changed', () => {
    // ⭐ This is the case the old all-zero return conflated with a refusal, and
    // it is the reason `changed` cannot simply be read off the counts by the
    // caller: "nothing moved" and "I refused to look" are different facts and
    // only one of them licenses recording an identity token.
    const res = mergeServerGraphOnHydrate({
      nodes: [
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 100 },
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 5 },
      ],
      edges: [],
    })
    expect(res.accepted, 'the server graph WAS read and it matched').toBe(true)
    expect(res.changed).toBe(false)
    expect(res.updatedNodeCount).toBe(0)
    expect(res.addedNodeCount).toBe(0)
  })
})

describe('§3 `accepted` agrees with the OTHER identity record — one rule, not two', () => {
  it('accepted ⇒ lastAuthoritativeGraph recorded', () => {
    const res = mergeServerGraphOnHydrate({
      nodes: [{ id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 }],
      edges: [],
    })
    expect(res.accepted).toBe(true)
    expect(useCanvasStore.getState().lastAuthoritativeGraph).not.toBeNull()
  })

  it.each([
    ['zeroOverlap', { nodes: [{ id: 'unrelated-a', kind: 'factor', label: 'X' }], edges: [] }],
    ['emptyServerGraph', { nodes: [], edges: [] }],
    ['unusableShape', null as unknown],
  ])('refused (%s) ⇒ lastAuthoritativeGraph NOT recorded', (_reason, graph) => {
    const res = mergeServerGraphOnHydrate(graph)
    expect(res.accepted).toBe(false)
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toBeNull()
  })
})
