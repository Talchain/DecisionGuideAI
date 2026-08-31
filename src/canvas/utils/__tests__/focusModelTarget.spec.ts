/**
 * Parity P1 — universal model-target focus resolution.
 *
 * Strengthen recommendations and guidance items can carry a canvas node id,
 * a canvas edge id, OR a PLoT edge id (producer edge_id or the synthetic
 * `${from}->${to}` arrow form). The old focusExistingTarget(id, 'node')
 * treated everything as a node id, so edge-targeted "Focus on canvas"
 * buttons silently no-oped (audit broken-function class). focusModelTarget
 * resolves all three shapes and stays fail-closed for unknowns.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  registerFocusHelpers,
  unregisterFocusHelpers,
  focusModelTarget,
} from '../focusHelpers'
import type { OlumiAttentionNote } from '../olumiAttention'
import { useCanvasStore } from '../../store'

describe('focusModelTarget', () => {
  const focusNode = vi.fn()
  const focusEdge = vi.fn()

  beforeEach(() => {
    focusNode.mockClear()
    focusEdge.mockClear()
    registerFocusHelpers(focusNode, focusEdge)
    useCanvasStore.setState({
      nodes: [
        { id: 'fac_price', type: 'factor', position: { x: 0, y: 0 }, data: {} } as any,
        { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: {} } as any,
      ],
      edges: [
        { id: 'e1', source: 'fac_price', target: 'goal_1', data: {} } as any,
        { id: 'e2', source: 'goal_1', target: 'fac_price', data: { edge_id: 'plot_edge_77' } } as any,
      ],
      olumiAttention: null,
    })
  })

  afterEach(() => {
    unregisterFocusHelpers()
  })

  it('resolves a canvas node id', () => {
    expect(focusModelTarget('fac_price')).toBe(true)
    expect(focusNode).toHaveBeenCalledWith('fac_price')
  })

  it('resolves a canvas edge id', () => {
    expect(focusModelTarget('e1')).toBe(true)
    expect(focusEdge).toHaveBeenCalledWith('e1')
  })

  it('resolves the PLoT arrow form to the real canvas edge', () => {
    expect(focusModelTarget('fac_price->goal_1')).toBe(true)
    expect(focusEdge).toHaveBeenCalledWith('e1')
    expect(focusNode).not.toHaveBeenCalled()
  })

  it('arrow form with an unmatchable side falls back to the endpoint node that exists', () => {
    // Container fallback builds `${from_id}->${to_label}` — the label side
    // matches no node, but the from side is a real node.
    expect(focusModelTarget('fac_price->Higher revenue')).toBe(true)
    expect(focusNode).toHaveBeenCalledWith('fac_price')
    expect(focusEdge).not.toHaveBeenCalled()
  })

  it('resolves a producer edge_id stashed on edge.data', () => {
    expect(focusModelTarget('plot_edge_77')).toBe(true)
    expect(focusEdge).toHaveBeenCalledWith('e2')
  })

  it('fails closed for an unknown id', () => {
    expect(focusModelTarget('ghost')).toBe(false)
    expect(focusNode).not.toHaveBeenCalled()
    expect(focusEdge).not.toHaveBeenCalled()
  })

  it('fails closed for an empty id', () => {
    expect(focusModelTarget('')).toBe(false)
  })

  // ── ATTENTION — the optional second argument ────────────────────────────
  //
  // A caller with something to SAY about the element passes a note, and the
  // element is held under attention with the explanation beside it. A caller
  // with nothing to say passes nothing and gets exactly the viewport move it
  // had before. One predicate, two directions, so both get cases.
  describe('held attention', () => {
    const note: OlumiAttentionNote = {
      move: 'challenge',
      title: 'This link is doing a lot of work',
      body: 'The result flips if this weakens.',
      sourceLine: 'Source: robustness analysis.',
      actions: [{ id: 'strengthen-challenge', label: 'Ask Olumi', prompt: 'Why is this so influential?' }],
    }

    it('holds attention on a node, carrying the note verbatim', () => {
      expect(focusModelTarget('fac_price', note)).toBe(true)
      const held = useCanvasStore.getState().olumiAttention
      expect(held?.nodeIds).toEqual(['fac_price'])
      expect(held?.edgeIds).toEqual([])
      expect(held?.note).toBe(note)
    })

    // ⭐ THE DISCRIMINATING CASE. `fac_price->goal_1` is not on the canvas.
    // Holding attention on the id as GIVEN would be dropped by
    // requestOlumiAttention's fail-closed filter and dim nothing, so the
    // element would be focused with no card — the failure would be silent.
    // Attention must land on the id the resolver actually produced.
    it('holds attention on the RESOLVED edge, not on the arrow-form id it was given', () => {
      expect(focusModelTarget('fac_price->goal_1', note)).toBe(true)
      const held = useCanvasStore.getState().olumiAttention
      expect(held?.edgeIds).toEqual(['e1'])
    })

    // ⭐ AND IT HOLDS THE EDGE'S ENDPOINTS, WHICH IS NOT DECORATION. An
    // edge-only hold writes `nodeIds: []`; `BaseNode` then dims every node that
    // is not attended — all of them — while the card anchors on `nodeIds[0]`
    // and renders nothing. A fully greyed canvas with no card and no dismiss
    // button. Holding the endpoints is both the fix and the honest reading: a
    // claim about a link is a claim about the two things it joins.
    it('holds the edge AND its endpoint nodes, so the canvas cannot grey out anchorless', () => {
      expect(focusModelTarget('e1', note)).toBe(true)
      const held = useCanvasStore.getState().olumiAttention
      expect(held?.edgeIds).toEqual(['e1'])
      expect(held?.nodeIds).toEqual(['fac_price', 'goal_1'])
    })

    it('holds attention on the canvas edge behind a producer edge_id, with its endpoints', () => {
      expect(focusModelTarget('plot_edge_77', note)).toBe(true)
      const held = useCanvasStore.getState().olumiAttention
      expect(held?.edgeIds).toEqual(['e2'])
      expect(held?.nodeIds).toEqual(['goal_1', 'fac_price'])
    })

    // The opposite direction: narrowing what raises attention must not make
    // every existing caller start dimming the model. Six of the seven call
    // sites pass no note and must be untouched.
    it('holds NOTHING when no note is passed, and still focuses', () => {
      expect(focusModelTarget('fac_price')).toBe(true)
      expect(focusNode).toHaveBeenCalledWith('fac_price')
      expect(useCanvasStore.getState().olumiAttention).toBeNull()
    })

    it('holds nothing when the target does not resolve', () => {
      expect(focusModelTarget('ghost', note)).toBe(false)
      expect(useCanvasStore.getState().olumiAttention).toBeNull()
    })
  })
})
