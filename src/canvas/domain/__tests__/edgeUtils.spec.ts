import { describe, it, expect } from 'vitest'
import { getEdgeKey, isStructuralEdge, findConnectedEdges } from '../edgeUtils'
import { DEFAULT_EDGE_DATA } from '../edges'
import type { Edge } from '@xyflow/react'
import type { EdgeData } from '../edges'

function makeEdge(overrides: Partial<Edge<EdgeData>> & { source: string; target: string }): Edge<EdgeData> {
  return {
    id: `${overrides.source}-${overrides.target}`,
    type: 'styled',
    data: { ...DEFAULT_EDGE_DATA },
    ...overrides,
  }
}

describe('getEdgeKey', () => {
  it('produces source->target format', () => {
    expect(getEdgeKey({ source: 'n1', target: 'n2' })).toBe('n1->n2')
  })

  it('is directional (a->b !== b->a)', () => {
    expect(getEdgeKey({ source: 'a', target: 'b' })).not.toBe(getEdgeKey({ source: 'b', target: 'a' }))
  })
})

describe('isStructuralEdge', () => {
  const kindMap: Record<string, string> = {
    d1: 'decision',
    o1: 'option',
    f1: 'factor',
    g1: 'goal',
    r1: 'risk',
  }
  const getKind = (id: string) => kindMap[id]

  it('returns true for decision -> option (kind check)', () => {
    const edge = makeEdge({ source: 'd1', target: 'o1' })
    expect(isStructuralEdge(edge, getKind)).toBe(true)
  })

  it('returns false for factor -> factor', () => {
    const edge = makeEdge({ source: 'f1', target: 'f1' })
    expect(isStructuralEdge(edge, getKind)).toBe(false)
  })

  it('returns false for factor -> goal', () => {
    const edge = makeEdge({ source: 'f1', target: 'g1' })
    expect(isStructuralEdge(edge, getKind)).toBe(false)
  })

  it('returns false for option -> factor (reversed structural)', () => {
    const edge = makeEdge({ source: 'o1', target: 'f1' })
    expect(isStructuralEdge(edge, getKind)).toBe(false)
  })

  it('returns true for canonical strength signature (mean:1.0, std:0.01, exists:1.0)', () => {
    const edge = makeEdge({
      source: 'f1',
      target: 'g1',
      data: {
        ...DEFAULT_EDGE_DATA,
        weight: 1.0,
        strengthStd: 0.01,
        beliefExists: 1.0,
      },
    })
    expect(isStructuralEdge(edge, getKind)).toBe(true)
  })

  it('returns false when strength signature is close but not exact', () => {
    const edge = makeEdge({
      source: 'f1',
      target: 'g1',
      data: {
        ...DEFAULT_EDGE_DATA,
        weight: 1.0,
        strengthStd: 0.02,
        beliefExists: 1.0,
      },
    })
    expect(isStructuralEdge(edge, getKind)).toBe(false)
  })

  it('handles missing node kind gracefully', () => {
    const edge = makeEdge({ source: 'unknown', target: 'o1' })
    expect(isStructuralEdge(edge, getKind)).toBe(false)
  })
})

describe('findConnectedEdges', () => {
  const edges: Edge<EdgeData>[] = [
    makeEdge({ source: 'a', target: 'b' }),
    makeEdge({ source: 'b', target: 'c' }),
    makeEdge({ source: 'c', target: 'd' }),
  ]

  it('finds edges where source or target is in the set', () => {
    const result = findConnectedEdges(new Set(['b']), edges)
    expect(result).toHaveLength(2)
    expect(result.map((e) => e.id)).toEqual(['a-b', 'b-c'])
  })

  it('returns empty array when no match', () => {
    expect(findConnectedEdges(new Set(['z']), edges)).toHaveLength(0)
  })

  it('deduplicates when node appears as both source and target', () => {
    const result = findConnectedEdges(new Set(['a', 'd']), edges)
    expect(result).toHaveLength(2)
    expect(result.map((e) => e.id)).toEqual(['a-b', 'c-d'])
  })
})
