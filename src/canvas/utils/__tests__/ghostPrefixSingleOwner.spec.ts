/**
 * "THE MODEL" MUST MEAN ONE SET, EVERYWHERE.
 *
 * The frontier affordances (`__ghost-…`) are invitations to extend the model,
 * not part of it. Three things have to agree about that: the fit's target set,
 * the extent notice's count, and the e2e geometry measurements. They did not.
 *
 *   `fitTargets.ts`   — matched a bare `'__ghost-'` literal, under a comment
 *                       claiming the id was "spelled ONCE for the whole codebase"
 *   `ghostTiers.ts`   — declared its OWN `GHOST_ID_PREFIX` and a SECOND
 *                       `export const GHOST_OPTION_NODE_ID` with the same value
 *   two e2e measures  — compared `nd.id === '__ghost-option__'`, so once the
 *                       affordance reached the factor, risk and outcome tiers
 *                       they counted three placeholders as the user's model
 *
 * Nothing was wrong while there was one ghost. Adding three turned four
 * independent lists that happened to agree into four that quietly did not.
 *
 * ⚠ A DERIVED GUARD PROVES AGREEMENT, NOT COMPLETENESS (CLAUDE.md trap 12d).
 * Iterating `GHOST_TIERS` here cannot notice a ghost minted somewhere else
 * entirely — so the last case is a hand-written corpus of the literal ids as
 * they are actually spelled, which is the only thing that can catch a tier the
 * registry forgot.
 */
import { describe, it, expect } from 'vitest'
import {
  GHOST_ID_PREFIX,
  GHOST_OPTION_NODE_ID,
  isGhostNode,
  excludeNonModelNodes,
} from '../fitTargets'
import { GHOST_TIERS } from '../ghostTiers'

describe('the ghost prefix has exactly one owner', () => {
  it('every registered tier id is recognised by the predicate', () => {
    expect(GHOST_TIERS.length).toBeGreaterThan(0)
    for (const tier of GHOST_TIERS) {
      expect(isGhostNode(tier.id), `${tier.id} is not recognised as a ghost`).toBe(true)
    }
  })

  it('the fit excludes every registered tier', () => {
    const nodes = [
      { id: 'fac_price' },
      { id: 'goal_1' },
      ...GHOST_TIERS.map(t => ({ id: t.id })),
    ]
    expect(excludeNonModelNodes(nodes).map(n => n.id)).toEqual(['fac_price', 'goal_1'])
  })

  // The opposite direction: a predicate that swallowed real nodes would pass
  // every case above and destroy the model instead of the affordances.
  it('does NOT treat a real node as a ghost', () => {
    expect(isGhostNode('fac_price')).toBe(false)
    expect(isGhostNode('ghost')).toBe(false)
    expect(isGhostNode('')).toBe(false)
    // Adjacent but not the prefix — the underscores matter.
    expect(isGhostNode('_ghost-option__')).toBe(false)
  })

  it('the options id is built from the shared prefix, not restated', () => {
    expect(GHOST_OPTION_NODE_ID.startsWith(GHOST_ID_PREFIX)).toBe(true)
    expect(isGhostNode(GHOST_OPTION_NODE_ID)).toBe(true)
  })

  // ⭐ THE HAND-WRITTEN CORPUS. Derivation from `GHOST_TIERS` is blind to a
  // ghost that never reached the registry; this is the list as the ids are
  // actually spelled on the canvas today, so a tier that goes missing REDs.
  it('the known ghost ids are all covered, including ones the registry might lose', () => {
    for (const id of ['__ghost-option__', '__ghost-factor__', '__ghost-risk__', '__ghost-outcome__']) {
      expect(isGhostNode(id), `${id} would be counted as part of the model`).toBe(true)
    }
    const registered = new Set(GHOST_TIERS.map(t => t.id))
    expect(registered.has(GHOST_OPTION_NODE_ID)).toBe(true)
  })
})
