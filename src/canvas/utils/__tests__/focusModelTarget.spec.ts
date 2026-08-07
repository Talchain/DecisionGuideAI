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
})
