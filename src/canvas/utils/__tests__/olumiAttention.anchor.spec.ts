/**
 * ATTENTION MUST HAVE A NODE TO ANCHOR TO, OR IT IS REFUSED.
 *
 * ── THE STATE THIS FORBIDS ────────────────────────────────────────────────
 * An edge-only hold writes `nodeIds: []`, and two consumers then disagree about
 * whether anything is on screen:
 *
 *   BaseNode  — dims every node NOT in `nodeIds`, i.e. with an empty set, ALL
 *               of them, to `opacity-30 saturate-50`
 *   OlumiAttentionCard — anchors on `attention.nodeIds[0]` and returns null
 *
 * so the user gets a fully greyed canvas, no explanation, and no dismiss button
 * (the dismiss button belongs to the card that did not render). The card cannot
 * anchor without a node, so this is a state the UI has no way to present.
 *
 * ⚠ REACHABILITY, STATED PRECISELY. The `ui_directive` path cannot reach it at
 * the vendored `@talchain/schemas@0.48.0`, where `ui_directive.note` is
 * `z.string()` on a `.strict()` block — so the object-note branch that feeds
 * attention is dead code. That makes it LATENT, not safe: a contract bump alone
 * would arm it, in a lane with no reason to look at this file. The direct
 * callers (`focusModelTarget`) reach it today.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { requestOlumiAttention } from '../olumiAttention'
import { useCanvasStore } from '../../store'

const note = { move: 'challenge' as const, title: 'T', body: 'B' }

describe('requestOlumiAttention — anchoring', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [
        { id: 'fac_price', type: 'factor', position: { x: 0, y: 0 }, data: {} } as never,
        { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: {} } as never,
      ],
      edges: [{ id: 'e1', source: 'fac_price', target: 'goal_1', data: {} } as never],
      olumiAttention: null,
    })
  })

  it('refuses an edge-only hold rather than greying the canvas with no card', () => {
    const result = requestOlumiAttention({ edgeIds: ['e1'], nodeIds: [], note })

    expect(useCanvasStore.getState().olumiAttention).toBeNull()
    expect(result.applied).toEqual([])
    // The refusal is REPORTED, not silent: the edge is named as dropped so a
    // caller can tell "refused" from "applied nothing because there was nothing".
    expect(result.dropped).toContain('e1')
  })

  // The opposite direction — the refusal must not swallow legitimate holds.
  it('accepts an edge hold that carries its endpoints', () => {
    const result = requestOlumiAttention({
      edgeIds: ['e1'],
      nodeIds: ['fac_price', 'goal_1'],
      note,
    })

    const held = useCanvasStore.getState().olumiAttention
    expect(held?.edgeIds).toEqual(['e1'])
    expect(held?.nodeIds).toEqual(['fac_price', 'goal_1'])
    expect(result.applied).toContain('e1')
  })

  it('accepts a plain node hold', () => {
    requestOlumiAttention({ nodeIds: ['fac_price'], edgeIds: [], note })
    expect(useCanvasStore.getState().olumiAttention?.nodeIds).toEqual(['fac_price'])
  })

  // Pre-existing behaviour, pinned here so the new branch above cannot be
  // mistaken for the one that already handled the all-stale case.
  it('still writes nothing when every target has gone stale', () => {
    const result = requestOlumiAttention({ nodeIds: ['gone'], edgeIds: ['also_gone'], note })
    expect(useCanvasStore.getState().olumiAttention).toBeNull()
    expect(result.applied).toEqual([])
  })

  it('drops a stale node but keeps a live one, and still anchors', () => {
    requestOlumiAttention({ nodeIds: ['gone', 'goal_1'], edgeIds: [], note })
    expect(useCanvasStore.getState().olumiAttention?.nodeIds).toEqual(['goal_1'])
  })
})
