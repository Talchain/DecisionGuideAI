/**
 * ⭐⭐ THE REASONING FRONTIER MOVED ONTO THE CARD — measured, not preferred.
 *
 * 14 of 20 tier doors were outside the framed window on the five starters. The
 * obvious refinement was to reposition them; measured on those captures it is
 * arithmetically impossible — best clearance beside a model is 128 graph units
 * for a 187-unit card, and a below-placement needs a pane of 1065–1266px against
 * a 1012px window. So the anchor changes, not the offset.
 *
 * These tests pin the two things that could silently undo it: the invitation
 * must land on the card the door stood beside (not merely on SOME card), and the
 * graph-space door must stop being placed.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Node } from '@xyflow/react'
import { tierInvitations, withGhostTiers, GHOST_TIERS } from '../ghostTiers'

function n(id: string, type: string, x: number, y: number, label = id): Node {
  return { id, type, position: { x, y }, data: { label }, width: 200 } as unknown as Node
}

/** A row of three factors; `f3` is rightmost, so it ends the row. */
const GRAPH: Node[] = [
  n('goal', 'goal', 0, 900, 'Reach £20k MRR'),
  n('f1', 'factor', 0, 300),
  n('f2', 'factor', 300, 300),
  n('f3', 'factor', 600, 300),
  n('r1', 'risk', 0, 600),
  n('r2', 'risk', 400, 600),
]

describe('the invitation is on the card, because there is nowhere else to put it', () => {
  it('⭐ lands on the card that ENDS the row', () => {
    const inv = tierInvitations(GRAPH)
    expect(inv.get('f3')?.map(i => i.tier)).toEqual(['factor'])
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Without it, an implementation that put the
   * invitation on every card of the tier — or on every card full stop — passes
   * the assertion above. That would be four questions on twenty cards.
   */
  it('⛔ CONTRAST: does NOT land on the other cards in the same row', () => {
    const inv = tierInvitations(GRAPH)
    expect(inv.get('f1')).toBeUndefined()
    expect(inv.get('f2')).toBeUndefined()
  })

  it('⛔ CONTRAST: a tier with no members gets no invitation — that would be a judgement', () => {
    const noOutcomes = tierInvitations(GRAPH)
    const tiers = [...noOutcomes.values()].flat().map(i => i.tier)
    expect(tiers).not.toContain('outcome')
    expect(tiers).not.toContain('option')
  })

  it('the question is the tier table’s own string, not a paraphrase', () => {
    const factorTier = GHOST_TIERS.find(t => t.siblingType === 'factor')!
    expect(tierInvitations(GRAPH).get('f3')?.[0].label).toBe(factorTier.label)
  })

  it('⭐ the prompt names what the tier actually holds, so it could only be about THIS model', () => {
    const p = tierInvitations(GRAPH).get('f3')?.[0].prompt ?? ''
    expect(p).toContain('3 factors')
    expect(p).toContain('f1')
    // The subject clause comes from the goal when there is no decision node.
    expect(p).toContain('Reach £20k MRR')
  })

  it('⭐ two tiers sharing one row BOTH reach the card — neither is dropped', () => {
    // risks and outcomes share the consequence row (founder ruling, 14 Sep).
    const shared: Node[] = [...GRAPH, n('o1', 'outcome', 800, 600, 'Churn falls')]
    const onAnchor = tierInvitations(shared).get('o1')?.map(i => i.tier) ?? []
    expect(onAnchor).toContain('risk')
    expect(onAnchor).toContain('outcome')
  })

  /**
   * ⛔ BOUND TO THE MOUNT, NOT TO THE PURE FUNCTION — and my first version of
   * this test was bound to the wrong one. `withGhostTiers` is UNCHANGED: its
   * placement arithmetic keeps its own tests (row anchoring, the shared
   * risk/outcome row, the door-on-door collision), which is evidence worth
   * keeping if the camera floor ever moves. What changed is that the canvas no
   * longer FEEDS its output to React Flow.
   */
  it('⛔ the mount no longer adds tier doors to the rendered node set', () => {
    const src = readFileSync('src/canvas/ReactFlowGraph.tsx', 'utf8')
    expect(src).toContain('return [...nodes, ghostNode]')
    expect(src).not.toContain('return withGhostTiers(')
  })

  it('⛔ CONTRAST: the placement arithmetic itself still works and stays tested', () => {
    // If this stopped producing doors the assertion above would still pass,
    // and the retired code would rot unobserved.
    const out = withGhostTiers(GRAPH)
    expect(out.filter(x => String(x.id).startsWith('__ghost')).length).toBeGreaterThan(0)
  })
})
