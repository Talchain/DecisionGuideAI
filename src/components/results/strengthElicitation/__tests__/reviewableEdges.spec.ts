/**
 * The destination's eligibility, and the reason it takes TWO conjuncts.
 *
 * ⭐ THE DISCRIMINATING CASE IS THE THIRD ONE. An edge that is perfectly
 * assertable but touches an option node has NO ROW on the Model tab, because the
 * outline builds relationship rows only from `getCausalEdges`. A gate written on
 * assertability alone passes every other test in this file and still routes a
 * reader to a section that never renders their row — so the third case is the
 * only one that can tell a correct gate from a plausible one.
 *
 * Assertions bind by EDGE ID, never by set size: a set of the right size
 * containing the wrong edge is exactly the failure a count would bless.
 */
import { describe, it, expect } from 'vitest'
import type { Edge } from '@xyflow/react'
import { reviewableStrengthEdgeIds } from '../reviewableEdges'
import { edgeStrengthEditIsAssertable } from '../../../../canvas/conversation/edgeStrengthEdit'
import { DEFAULT_EDGE_DATA, type EdgeData } from '../../../../canvas/domain/edges'

/** A server-stated tuple — what an ordinary CEE-drafted edge carries. */
const SERVER_STATED = { strength_mean: 0.4, effect_direction: 'positive' as const }

const nodes = [
  { id: 'n_demand', type: 'factor' },
  { id: 'n_rev', type: 'factor' },
  { id: 'n_opt', type: 'option' },
]

const edge = (id: string, source: string, target: string, data: Record<string, unknown>): Edge<EdgeData> =>
  ({ id, source, target, data } as unknown as Edge<EdgeData>)

describe('reviewableStrengthEdgeIds — the destination decides, and it takes two facts', () => {
  it('POSITIVE CONTROL: the fixture I call assertable really is assertable', () => {
    // Without this, every "absent" below could be a fixture that never satisfied
    // the predicate — an absence probe with no positive control proves nothing.
    expect(
      edgeStrengthEditIsAssertable(edge('e_probe', 'n_demand', 'n_rev', { ...DEFAULT_EDGE_DATA, ...SERVER_STATED })),
    ).toBe(true)
    expect(edgeStrengthEditIsAssertable(edge('e_probe', 'n_demand', 'n_rev', { ...DEFAULT_EDGE_DATA }))).toBe(false)
  })

  it('causal AND assertable is offered', () => {
    const ids = reviewableStrengthEdgeIds(nodes, [
      edge('e_causal_assertable', 'n_demand', 'n_rev', { ...DEFAULT_EDGE_DATA, ...SERVER_STATED }),
    ])
    expect([...ids]).toEqual(['e_causal_assertable'])
  })

  it('causal but NOT assertable is withheld — the row exists, the control would not', () => {
    const ids = reviewableStrengthEdgeIds(nodes, [
      edge('e_causal_unassertable', 'n_demand', 'n_rev', { ...DEFAULT_EDGE_DATA }),
    ])
    expect(ids.has('e_causal_unassertable')).toBe(false)
  })

  it('⭐ assertable but NOT causal is withheld — there is no row to arrive at', () => {
    // The case a gate on assertability alone gets wrong, and the reason this
    // module composes two authorities instead of importing the convenient one.
    const optionEdge = edge('e_option_assertable', 'n_opt', 'n_rev', {
      ...DEFAULT_EDGE_DATA,
      ...SERVER_STATED,
    })
    expect(edgeStrengthEditIsAssertable(optionEdge)).toBe(true) // the narrower gate would say yes
    expect(reviewableStrengthEdgeIds(nodes, [optionEdge]).has('e_option_assertable')).toBe(false)
  })

  it('binds by identity: the eligible edge is offered and its ineligible sibling is not', () => {
    const ids = reviewableStrengthEdgeIds(nodes, [
      edge('e_yes', 'n_demand', 'n_rev', { ...DEFAULT_EDGE_DATA, ...SERVER_STATED }),
      edge('e_no_unassertable', 'n_rev', 'n_demand', { ...DEFAULT_EDGE_DATA }),
      edge('e_no_not_causal', 'n_opt', 'n_demand', { ...DEFAULT_EDGE_DATA, ...SERVER_STATED }),
    ])
    expect(ids.has('e_yes')).toBe(true)
    expect(ids.has('e_no_unassertable')).toBe(false)
    expect(ids.has('e_no_not_causal')).toBe(false)
  })
})
