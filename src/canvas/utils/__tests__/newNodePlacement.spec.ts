/**
 * A new node lands at the end of its own row.
 *
 * FOUNDER REPORT, 21 Sep 2026: *"I added a new factor, but it was still put in
 * the wrong row. It moves it to the right row when I perform analysis."*
 *
 * Root cause measured at the bytes: `store.addNode` / `addNodeWithEdge` took the
 * caller's position — the POINTER from `contextMenu/actions.ts:311`, or
 * `{x:200,y:200}` from the command palette — and nothing re-laid the graph out,
 * because `useMeasureThenLayout` re-runs only on measured-height GROWTH. The
 * card therefore sat where it was dropped until `applyLayout` ran, which
 * analysis does. The row LABEL followed it because the lane bands are bounding
 * boxes over their members.
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { rowEndPositionForNewNode } from '../newNodePlacement'
import { LAYOUT_NODE_GAP, NODE_CARD_MAX_W } from '../nodeLayoutConstants'

const node = (id: string, type: string, x: number, y: number, w?: number): Node =>
  ({
    id,
    type,
    position: { x, y },
    data: { label: id },
    ...(w === undefined ? {} : { measured: { width: w, height: 100 } }),
  }) as unknown as Node

describe('rowEndPositionForNewNode', () => {
  it('⭐ puts a new factor at the end of the factor row, not at the click point', () => {
    const nodes = [
      node('dec', 'decision', 500, 0),
      node('opt', 'option', 300, 200),
      node('f1', 'factor', 100, 500, 336),
      node('f2', 'factor', 468, 500, 336),
    ]
    const pos = rowEndPositionForNewNode(nodes, 'factor')
    expect(pos).not.toBeNull()
    // The row's Y, and clear of the rightmost occupant by one gap.
    expect(pos!.y).toBe(500)
    expect(pos!.x).toBe(468 + 336 + LAYOUT_NODE_GAP)
  })

  it('⛔ MUTANT: it does NOT return the Question row, which is where the founder saw it land', () => {
    // The discriminating half. Without this, the assertion above passes for any
    // function that returns some plausible point. The reported symptom was a
    // factor level with the decision card, so that specific Y must be refused.
    const nodes = [
      node('dec', 'decision', 500, 0),
      node('f1', 'factor', 100, 500, 336),
    ]
    const pos = rowEndPositionForNewNode(nodes, 'factor')
    expect(pos!.y).not.toBe(0)
    expect(pos!.y).toBe(500)
  })

  it('⭐ keys the row on the TIER, not the KIND — the half `rowAnchorFor` did not generalise', () => {
    // `factor`, `action` and `constraint` share tier 2. `ghostTiers.rowAnchorFor`
    // derives its row Y from SAME-TYPE siblings, so a board carrying actions and
    // no factors yields it no row for a new factor — even though the row plainly
    // exists. This is the case that proves the generalisation, and it is the one
    // a same-type implementation fails.
    const nodes = [
      node('dec', 'decision', 500, 0),
      node('a1', 'action', 100, 500, 336),
    ]
    const pos = rowEndPositionForNewNode(nodes, 'factor')
    expect(pos, 'a factor must join the tier-2 row that an action already occupies').not.toBeNull()
    expect(pos!.y).toBe(500)
    expect(pos!.x).toBe(100 + 336 + LAYOUT_NODE_GAP)
  })

  it('⛔ counts a GHOST DOOR as an occupant, so a new node is never painted on top of one', () => {
    // Ghost doors are real nodes with real positions and they stand at the END
    // of their row — exactly where a new node wants to go. `withGhostTiers`
    // fixed this for a second door after one was painted over an outcome card;
    // the same hazard arrives here by a different route.
    const nodes = [
      node('f1', 'factor', 100, 500, 336),
      node('__ghost-factor__', 'ghost-tier', 468, 500, 94),
    ]
    const pos = rowEndPositionForNewNode(nodes, 'factor')
    expect(pos!.x).toBe(468 + 94 + LAYOUT_NODE_GAP)
    expect(pos!.x).toBeGreaterThan(468)
  })

  it('returns null for an EMPTY tier, so the caller keeps its existing fallback', () => {
    // Non-vacuity in the other direction: inventing a Y for a row that does not
    // exist would be a guess, and it would change the blank-canvas case this
    // fix must not touch.
    const nodes = [node('dec', 'decision', 500, 0)]
    expect(rowEndPositionForNewNode(nodes, 'factor')).toBeNull()
    expect(rowEndPositionForNewNode([], 'factor')).toBeNull()
  })

  it('falls back to the card width when a node has not been measured', () => {
    const nodes = [node('f1', 'factor', 100, 500)] // no `measured`
    const pos = rowEndPositionForNewNode(nodes, 'factor')
    expect(pos!.x).toBe(100 + NODE_CARD_MAX_W + LAYOUT_NODE_GAP)
  })

  it('an unknown kind defaults to the factor tier, the way layout.ts does', () => {
    const nodes = [node('f1', 'factor', 100, 500, 336)]
    const pos = rowEndPositionForNewNode(nodes, 'not-a-real-kind')
    expect(pos!.y).toBe(500)
  })
})
