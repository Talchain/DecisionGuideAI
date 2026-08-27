/**
 * projectAuthoredEntities ↔ computeGraphFacts — the two authorities that count
 * the same entities must agree.
 *
 * ⭐ WHY THIS FILE EXISTS. The projection replaced two memos that asked
 * `(n.data)?.kind ?? n.type` with one that asks `kindOf` — the predicate
 * `computeGraphFacts` already uses. That convergence was shipped UNPINNED:
 * reverting it turned nothing red across all 41 spec files in this directory
 * (measured: 40 passed / 651 tests, the single failure an unrelated
 * pre-existing one). The only pre-existing `kindOf` test asserts it "prefers
 * data.kind over node.type" and never exercises the class where the two
 * predicates actually diverge.
 *
 * That gap mattered because the convergence is this change's own thesis: the
 * type makes a slice declare authorship, and this makes the two counts agree.
 * An unpinned half of the argument is the half that silently comes back.
 *
 * ⚠ THE INVARIANT IS WRITTEN AGAINST THE SPEC, NOT AGAINST THE FAILURE MODE.
 * The claim is not "the code calls `kindOf`" — that is an implementation
 * detail a refactor may legitimately change. The claim is that for any node
 * set, the number of entities the panel LISTS equals the number the panel
 * COUNTS. Those two numbers are rendered as near-identical sentences on one
 * screen: the Options group header says "N included" from the projection,
 * while the HealthBars tooltip says "N options included" from
 * `computeGraphFacts.optionCount` (`computeBars.ts`), and the option-breadth
 * signal (`signals/registry.ts`) reads the same count. Two authorities, one
 * user-visible claim.
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { projectAuthoredEntities } from '../projectAuthoredEntities'
import { computeGraphFacts } from '../graphFacts'

/**
 * `data.kind` is deliberately typed loose here: these are the representations
 * that actually arrive on the store, not a tidy subset of them.
 */
function node(id: string, type: string, dataKind: unknown, label: string): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: dataKind === undefined ? { label } : { kind: dataKind, label },
  } as Node
}

/**
 * The kind-representation classes a node can arrive in. The last two are the
 * DIVERGENT class — `?? ` accepts them as the kind (they are not nullish) while
 * `kindOf` falls through to `node.type`. `null` is deliberately NOT here: it is
 * nullish, so both predicates already agree on it.
 */
const OPTIONS: Node[] = [
  node('o_normal', 'option', 'option', 'Hire a tech lead'),
  node('o_typeonly', 'option', undefined, 'Hire two developers'),
  node('o_emptykind', 'option', '', 'Keep the current team'),
  node('o_numerickind', 'option', 123, 'Hire one senior and one junior'),
]

const RISKS: Node[] = [
  node('r_normal', 'risk', 'risk', 'Budget overrun'),
  node('r_emptykind', 'risk', '', 'Onboarding drag'),
]

describe('the two counting authorities agree, across every kind representation', () => {
  it('lists exactly as many options as computeGraphFacts counts', () => {
    const listed = projectAuthoredEntities(OPTIONS, 'option')
    const counted = computeGraphFacts(OPTIONS).optionCount

    // Bound by identity, not just by length: a projection that dropped
    // `o_emptykind` and gained some other node would keep the length.
    expect(listed.map(e => e.nodeId)).toEqual([
      'o_normal',
      'o_typeonly',
      'o_emptykind',
      'o_numerickind',
    ])
    expect(counted).toBe(OPTIONS.length)
    // The invariant itself, stated as agreement between the two authorities.
    expect(listed).toHaveLength(counted)
  })

  it('lists exactly as many risks as computeGraphFacts counts', () => {
    const listed = projectAuthoredEntities(RISKS, 'risk')
    const counted = computeGraphFacts(RISKS).riskCount
    expect(listed.map(e => e.nodeId)).toEqual(['r_normal', 'r_emptykind'])
    expect(counted).toBe(RISKS.length)
    expect(listed).toHaveLength(counted)
  })

  it('still agrees on a mixed graph, and does not bleed across kinds', () => {
    const mixed = [...OPTIONS, ...RISKS, node('g1', 'goal', 'goal', 'Increase output')]
    const facts = computeGraphFacts(mixed)
    expect(projectAuthoredEntities(mixed, 'option')).toHaveLength(facts.optionCount)
    expect(projectAuthoredEntities(mixed, 'risk')).toHaveLength(facts.riskCount)
    // A goal is neither, under either authority.
    expect(projectAuthoredEntities(mixed, 'option').map(e => e.nodeId)).not.toContain('g1')
    expect(projectAuthoredEntities(mixed, 'risk').map(e => e.nodeId)).not.toContain('g1')
  })
})
