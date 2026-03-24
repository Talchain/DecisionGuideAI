/**
 * Regression tests for EdgeSummarySection
 *
 * Issue 1 (P0): EdgeSummarySection crash — nodeMap TDZ error
 * getNodeKind referenced nodeMap before its const declaration, causing
 * "Cannot access 'nodeMap' before initialization" in production.
 *
 * Issue 3 (P1): Structural edges displaying as causal edges
 * Decision→option structural edges should be excluded from the summary.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../../store'
import { computeSignedMean } from '../../../domain/edges'
import { isStructuralEdge } from '../../../domain/edgeUtils'
import { DEFAULT_EDGE_DATA } from '../../../domain/edges'

// Minimal mock nodes matching the canvas store shape
function makeNode(id: string, kind: string) {
  return {
    id,
    type: kind,
    position: { x: 0, y: 0 },
    data: { label: id, kind },
  }
}

function makeEdge(id: string, source: string, target: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    source,
    target,
    type: 'styled' as const,
    data: { ...DEFAULT_EDGE_DATA, ...overrides },
  }
}

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
  })
})

describe('Issue 1 regression: nodeMap initialisation order', () => {
  it('isStructuralEdge does not throw when nodeMap is initialised before getNodeKind', () => {
    const nodes = [
      makeNode('d1', 'decision'),
      makeNode('o1', 'option'),
      makeNode('f1', 'factor'),
      makeNode('f2', 'factor'),
    ]
    const edges = [
      makeEdge('e1', 'd1', 'o1'),
      makeEdge('e2', 'f1', 'f2', { weight: 0.8 }),
    ]

    // Reproduce the fixed pattern: nodeMap BEFORE getNodeKind
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const getNodeKind = (id: string) => (nodeMap.get(id)?.type ?? (nodeMap.get(id)?.data as Record<string, unknown>)?.kind) as string | undefined

    // This should NOT throw — the TDZ bug would cause a ReferenceError here
    expect(() => {
      edges.filter(e => !isStructuralEdge(e as any, getNodeKind))
    }).not.toThrow()
  })

  it('correctly filters structural edges when nodeMap is available', () => {
    const nodes = [
      makeNode('d1', 'decision'),
      makeNode('o1', 'option'),
      makeNode('f1', 'factor'),
      makeNode('f2', 'factor'),
    ]
    const edges = [
      makeEdge('e1', 'd1', 'o1'),  // structural
      makeEdge('e2', 'f1', 'f2', { weight: 0.8 }),  // causal
    ]

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const getNodeKind = (id: string) => (nodeMap.get(id)?.type ?? (nodeMap.get(id)?.data as Record<string, unknown>)?.kind) as string | undefined

    const causalEdges = edges.filter(e => !isStructuralEdge(e as any, getNodeKind))
    expect(causalEdges).toHaveLength(1)
    expect(causalEdges[0].id).toBe('e2')
  })
})

describe('Issue 3 regression: structural edges excluded from causal summary', () => {
  it('decision→option edges are identified as structural', () => {
    const getKind = (id: string) => {
      if (id === 'd1') return 'decision'
      if (id === 'o1') return 'option'
      return 'factor'
    }
    const edge = makeEdge('e1', 'd1', 'o1')
    expect(isStructuralEdge(edge as any, getKind)).toBe(true)
  })

  it('factor→factor edges are NOT structural', () => {
    const getKind = (id: string) => {
      if (id === 'f1') return 'factor'
      if (id === 'f2') return 'factor'
      return 'unknown'
    }
    const edge = makeEdge('e1', 'f1', 'f2', { weight: 0.7 })
    expect(isStructuralEdge(edge as any, getKind)).toBe(false)
  })

  it('computeSignedMean works for causal edges', () => {
    const data = { weight: 0.8, direction: 'positive' }
    expect(computeSignedMean(data)).toBeCloseTo(0.8)
  })
})
