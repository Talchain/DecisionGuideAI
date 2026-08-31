/**
 * A MODEL WITH NO OPTIONS STILL GETS ITS OTHER DOORS.
 *
 * `withGhostTiers` decides tier by tier, and refuses a door on a tier with no
 * members for a stated reason: a ghost on an empty tier would assert the tier
 * OUGHT to have members, which is a judgement this affordance exists not to
 * make.
 *
 * That per-tier care was defeated by a global gate in `ReactFlowGraph`:
 *
 *     if (optionNodes.length === 0) return nodes
 *
 * — correct when the options ghost was the only ghost, and wrong the moment the
 * frontier reached factors, risks and outcomes. A model with factors and risks
 * but no options got no door on ANY tier, including the tiers that had members.
 * The invitation disappeared exactly when the model was sparsest, which is when
 * it is worth most.
 *
 * ⚠ THIS PINS THE HELPER, NOT THE COMPONENT. `ReactFlowGraph` is a very large
 * component with a heavy mount; the behaviour that broke lives in which tiers
 * `withGhostTiers` is asked about, and that is checkable directly. The
 * component-level wiring is asserted by the deployed drive recorded in the PR.
 */
import { describe, it, expect } from 'vitest'
import { withGhostTiers, GHOST_TIERS } from '../ghostTiers'
import { isGhostNode } from '../fitTargets'
import type { Node } from '@xyflow/react'

const node = (id: string, type: string): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: {} } as unknown as Node)

const tierGhosts = GHOST_TIERS.filter(t => t.siblingType !== 'option')
const ghostIdsOf = (ns: Node[]) => ns.map(n => n.id).filter(isGhostNode)

describe('doors on a model with no options', () => {
  it('offers a factor door when factors exist and options do not', () => {
    const out = withGhostTiers([node('f1', 'factor')], tierGhosts)
    expect(ghostIdsOf(out)).toEqual(['__ghost-factor__'])
  })

  it('offers a door on every tier that has members', () => {
    const out = withGhostTiers(
      [node('f1', 'factor'), node('r1', 'risk'), node('o1', 'outcome')],
      tierGhosts,
    )
    expect(ghostIdsOf(out).sort()).toEqual(
      ['__ghost-factor__', '__ghost-outcome__', '__ghost-risk__'],
    )
  })

  // ⭐ THE OPPOSITE DIRECTION, AND THE LINE THE AFFORDANCE MUST NOT CROSS.
  // A door on an EMPTY tier would say the tier ought to have members — a
  // judgement about the user's model. Lifting the options gate must not lift
  // this one too.
  it('offers NO door on a tier with no members — that would be a judgement', () => {
    const out = withGhostTiers([node('f1', 'factor')], tierGhosts)
    expect(ghostIdsOf(out)).not.toContain('__ghost-risk__')
    expect(ghostIdsOf(out)).not.toContain('__ghost-outcome__')
  })

  it('adds nothing at all to an empty model', () => {
    expect(withGhostTiers([], tierGhosts)).toEqual([])
  })

  // The options ghost is deliberately NOT in this set — its position is derived
  // from the rightmost option node, so it genuinely requires one to exist.
  it('the tier set excludes options, which are positioned separately', () => {
    expect(tierGhosts.map(t => t.siblingType)).not.toContain('option')
    expect(tierGhosts.length).toBeGreaterThan(0)
  })
})
