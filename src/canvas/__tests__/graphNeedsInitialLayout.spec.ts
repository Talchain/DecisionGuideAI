import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import {
  graphNeedsInitialLayout,
  getGraphIdentityKey,
  STACKED_SPREAD_PX,
} from '../utils/graphNeedsInitialLayout'

function node(id: string, x: number, y: number, locked = false): Node {
  return {
    id,
    type: 'factor',
    position: { x, y },
    data: locked ? { locked: true, label: id } : { label: id },
  } as Node
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target } as Edge
}

describe('graphNeedsInitialLayout — predicate', () => {
  it('returns true when 4 nodes are all at the origin', () => {
    const nodes = [node('a', 0, 0), node('b', 0, 0), node('c', 0, 0), node('d', 0, 0)]
    expect(graphNeedsInitialLayout(nodes)).toBe(true)
  })

  it('returns true when nodes are stacked at a non-origin point', () => {
    const nodes = [node('a', 120, 200), node('b', 120, 200), node('c', 120, 200)]
    expect(graphNeedsInitialLayout(nodes)).toBe(true)
  })

  it('returns false for a horizontally spread row', () => {
    const nodes = [node('a', 0, 0), node('b', 300, 0), node('c', 600, 0)]
    expect(graphNeedsInitialLayout(nodes)).toBe(false)
  })

  it('returns false for a vertically spread column', () => {
    const nodes = [node('a', 0, 0), node('b', 0, 200)]
    expect(graphNeedsInitialLayout(nodes)).toBe(false)
  })

  it('returns false for a single node', () => {
    expect(graphNeedsInitialLayout([node('a', 0, 0)])).toBe(false)
  })

  it('returns false for an empty node array', () => {
    expect(graphNeedsInitialLayout([])).toBe(false)
  })

  it('returns false when all stacked nodes are locked', () => {
    const nodes = [
      node('a', 0, 0, true),
      node('b', 0, 0, true),
      node('c', 0, 0, true),
    ]
    expect(graphNeedsInitialLayout(nodes)).toBe(false)
  })

  it('returns true for 2 locked + 2 unlocked all stacked (unlocked drives decision)', () => {
    const nodes = [
      node('a', 0, 0, true),
      node('b', 0, 0, true),
      node('c', 0, 0),
      node('d', 0, 0),
    ]
    expect(graphNeedsInitialLayout(nodes)).toBe(true)
  })

  it('returns false for 2 locked anywhere + 2 unlocked spread', () => {
    const nodes = [
      node('a', 500, 500, true),
      node('b', 700, 600, true),
      node('c', 0, 0),
      node('d', 300, 200),
    ]
    expect(graphNeedsInitialLayout(nodes)).toBe(false)
  })

  it('coerces missing position to {0,0}', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'factor', position: undefined as unknown as { x: number; y: number }, data: { label: 'a' } } as Node,
      { id: 'b', type: 'factor', position: undefined as unknown as { x: number; y: number }, data: { label: 'b' } } as Node,
    ]
    expect(graphNeedsInitialLayout(nodes)).toBe(true)
  })

  it('coerces NaN / Infinity coordinates to 0', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'factor', position: { x: NaN, y: Infinity }, data: { label: 'a' } } as Node,
      { id: 'b', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'b' } } as Node,
    ]
    expect(graphNeedsInitialLayout(nodes)).toBe(true)
  })

  it('boundary — spread of exactly 39 is stacked', () => {
    const nodes = [node('a', 0, 0), node('b', 39, 0), node('c', 0, 39)]
    expect(graphNeedsInitialLayout(nodes)).toBe(true)
  })

  it('boundary — spread of exactly 40 is not stacked', () => {
    const nodes = [node('a', 0, 0), node('b', 40, 0), node('c', 0, 0)]
    expect(graphNeedsInitialLayout(nodes)).toBe(false)
  })

  it('exposes STACKED_SPREAD_PX as a tunable export', () => {
    expect(typeof STACKED_SPREAD_PX).toBe('number')
    expect(STACKED_SPREAD_PX).toBe(40)
  })
})

describe('getGraphIdentityKey — composite key with structural hash', () => {
  const nodesA: Node[] = [node('n1', 0, 0), node('n2', 0, 0)]
  const edgesA: Edge[] = [edge('e1', 'n1', 'n2')]

  it('returns the same key for the same scenario id + structure', () => {
    const k1 = getGraphIdentityKey('scA', nodesA, edgesA)
    const k2 = getGraphIdentityKey('scA', nodesA, edgesA)
    expect(k1).toBe(k2)
    expect(k1.startsWith('scenario:scA:')).toBe(true)
  })

  it('returns different keys for two distinct scenario ids', () => {
    const kA = getGraphIdentityKey('scA', nodesA, edgesA)
    const kB = getGraphIdentityKey('scB', nodesA, edgesA)
    expect(kA).not.toBe(kB)
  })

  it('same scenario id with changed structure produces a different key', () => {
    const kBefore = getGraphIdentityKey('scA', nodesA, edgesA)
    const nodesB = [...nodesA, node('n3', 0, 0)]
    const kAfter = getGraphIdentityKey('scA', nodesB, edgesA)
    expect(kAfter).not.toBe(kBefore)
    expect(kAfter.startsWith('scenario:scA:')).toBe(true)
  })

  it('null scenario id falls back to draft prefix', () => {
    const k = getGraphIdentityKey(null, nodesA, edgesA)
    expect(k.startsWith('draft:')).toBe(true)
  })

  it('undefined scenario id falls back to draft prefix', () => {
    const k = getGraphIdentityKey(undefined, nodesA, edgesA)
    expect(k.startsWith('draft:')).toBe(true)
  })

  it('empty-string scenario id falls back to draft prefix', () => {
    const k = getGraphIdentityKey('', nodesA, edgesA)
    expect(k.startsWith('draft:')).toBe(true)
  })

  it('scenario id and draft mode with the same structure produce distinct keys', () => {
    const draft = getGraphIdentityKey(null, nodesA, edgesA)
    const scoped = getGraphIdentityKey('scA', nodesA, edgesA)
    expect(draft).not.toBe(scoped)
  })

  it('is stable across array ordering of nodes and edges', () => {
    const a = getGraphIdentityKey(null, [node('a', 0, 0), node('b', 0, 0)], [edge('e1', 'a', 'b')])
    const b = getGraphIdentityKey(null, [node('b', 0, 0), node('a', 0, 0)], [edge('e1', 'a', 'b')])
    expect(a).toBe(b)
  })

  it('detects edge id changes', () => {
    const k1 = getGraphIdentityKey('scA', nodesA, [edge('e1', 'n1', 'n2')])
    const k2 = getGraphIdentityKey('scA', nodesA, [edge('e2', 'n1', 'n2')])
    expect(k1).not.toBe(k2)
  })

  it('falls back to source->target identity when edge.id is missing', () => {
    const edgeMissingId: Edge = { source: 'n1', target: 'n2' } as Edge
    const edgeMissingId2: Edge = { source: 'n1', target: 'n2' } as Edge
    const k1 = getGraphIdentityKey('scA', nodesA, [edgeMissingId])
    const k2 = getGraphIdentityKey('scA', nodesA, [edgeMissingId2])
    expect(k1).toBe(k2)
  })

  it('source->target fallback changes when source or target changes', () => {
    const e1: Edge = { source: 'n1', target: 'n2' } as Edge
    const e2: Edge = { source: 'n1', target: 'n3' } as Edge
    const k1 = getGraphIdentityKey('scA', nodesA, [e1])
    const k2 = getGraphIdentityKey('scA', nodesA, [e2])
    expect(k1).not.toBe(k2)
  })

  it('encodes ids defensively so delimiter-bearing ids cannot collide', () => {
    // If structuralHash used a naive `join(",")` separator, the two
    // node sets below would serialise to the same string. JSON.stringify
    // encoding makes them distinct.
    const nodesAB: Node[] = [node('a,b', 0, 0), node('c', 0, 0)]
    const nodesACommaB: Node[] = [node('a', 0, 0), node('b,c', 0, 0)]
    const k1 = getGraphIdentityKey('scA', nodesAB, [])
    const k2 = getGraphIdentityKey('scA', nodesACommaB, [])
    expect(k1).not.toBe(k2)
  })
})
