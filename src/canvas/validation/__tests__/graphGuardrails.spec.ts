/**
 * Regression tests for Graph Editing Experience guardrails.
 *
 * Covers: cycle detection, duplicate prevention, self-loop prevention,
 * limit checks, deletion impact assessment.
 */
import { describe, it, expect } from 'vitest'
import {
  isSelfLoop,
  isDuplicateEdge,
  wouldCreateCycle,
  detectCycles,
  bfsReachable,
  buildAdjacency,
  wouldExceedLimits,
  resolveGraphLimits,
  limitExceededMessage,
  assessNodeDeletion,
  assessEdgeDeletion,
  isSignificantImpact,
  buildDeletionMessage,
  MAX_NODES,
  MAX_EDGES,
} from '../graphGuardrails'
import type { Node, Edge } from '@xyflow/react'

// ─── Primitive checks ───────────────────────────────────────────────

describe('isSelfLoop', () => {
  it('returns true when source equals target', () => {
    expect(isSelfLoop('a', 'a')).toBe(true)
  })
  it('returns false when source differs from target', () => {
    expect(isSelfLoop('a', 'b')).toBe(false)
  })
})

describe('isDuplicateEdge', () => {
  it('returns true when edge already exists', () => {
    expect(isDuplicateEdge([{ source: 'a', target: 'b' }], 'a', 'b')).toBe(true)
  })
  it('returns false for reverse direction', () => {
    expect(isDuplicateEdge([{ source: 'a', target: 'b' }], 'b', 'a')).toBe(false)
  })
  it('returns false when no edges exist', () => {
    expect(isDuplicateEdge([], 'a', 'b')).toBe(false)
  })
})

// ─── Cycle detection ────────────────────────────────────────────────

describe('wouldCreateCycle', () => {
  it('detects a simple cycle A→B→C, proposed C→A', () => {
    const nodeIds = ['a', 'b', 'c']
    const edges = [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }]
    expect(wouldCreateCycle(nodeIds, edges, 'c', 'a')).toBe(true)
  })
  it('allows non-cyclic edge', () => {
    const nodeIds = ['a', 'b', 'c']
    const edges = [{ source: 'a', target: 'b' }]
    expect(wouldCreateCycle(nodeIds, edges, 'b', 'c')).toBe(false)
  })
  it('allows edge to a disconnected node', () => {
    const nodeIds = ['a', 'b', 'c']
    const edges: Array<{ source: string; target: string }> = []
    expect(wouldCreateCycle(nodeIds, edges, 'a', 'b')).toBe(false)
  })
})

describe('detectCycles', () => {
  it('returns empty set for a DAG', () => {
    const nodeIds = ['a', 'b', 'c']
    const edges = [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }]
    expect(detectCycles(nodeIds, edges).size).toBe(0)
  })
  it('returns cycle members', () => {
    const nodeIds = ['a', 'b', 'c']
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' },
    ]
    const result = detectCycles(nodeIds, edges)
    expect(result.size).toBe(3)
    expect(result.has('a')).toBe(true)
  })
})

// ─── Limit checks ──────────────────────────────────────────────────

describe('wouldExceedLimits', () => {
  it('allows creation within limits', () => {
    expect(wouldExceedLimits(5, 10, 1, 1)).toBeNull()
  })
  it('blocks node creation at limit', () => {
    expect(wouldExceedLimits(MAX_NODES, 5, 1, 0)).toBe('node_limit')
  })
  it('blocks edge creation at limit', () => {
    expect(wouldExceedLimits(5, MAX_EDGES, 0, 1)).toBe('edge_limit')
  })
  it('node limit takes priority', () => {
    expect(wouldExceedLimits(MAX_NODES, MAX_EDGES, 1, 1)).toBe('node_limit')
  })

  it('engine limit below the static cap becomes the ceiling', () => {
    const engine = { nodes: { max: 10 }, edges: { max: 8 } }
    expect(wouldExceedLimits(10, 0, 1, 0, engine)).toBe('node_limit')
    expect(wouldExceedLimits(0, 8, 0, 1, engine)).toBe('edge_limit')
    expect(wouldExceedLimits(9, 7, 1, 1, engine)).toBeNull()
  })

  it('engine limit above the static cap does not raise it', () => {
    const engine = { nodes: { max: 500 }, edges: { max: 500 } }
    expect(wouldExceedLimits(MAX_NODES, 0, 1, 0, engine)).toBe('node_limit')
    expect(wouldExceedLimits(0, MAX_EDGES, 0, 1, engine)).toBe('edge_limit')
  })

  it('null/absent engine limits fall back to the static caps', () => {
    expect(wouldExceedLimits(MAX_NODES - 1, MAX_EDGES - 1, 1, 1, null)).toBeNull()
    expect(wouldExceedLimits(MAX_NODES, MAX_EDGES, 1, 1, null)).toBe('node_limit')
  })
})

describe('resolveGraphLimits', () => {
  it('returns static caps when engine limits are absent', () => {
    expect(resolveGraphLimits()).toEqual({ maxNodes: MAX_NODES, maxEdges: MAX_EDGES })
    expect(resolveGraphLimits(null)).toEqual({ maxNodes: MAX_NODES, maxEdges: MAX_EDGES })
  })

  it('takes the minimum of static cap and engine limit per axis', () => {
    // nodes: engine (30) < static (50) → engine wins.
    // edges: engine (100) < static (160) → engine wins.
    expect(resolveGraphLimits({ nodes: { max: 30 }, edges: { max: 100 } })).toEqual({
      maxNodes: 30,
      maxEdges: 100,
    })
  })

  it('ignores invalid engine values (zero, negative, NaN) so a bad payload never bricks editing', () => {
    expect(resolveGraphLimits({ nodes: { max: 0 }, edges: { max: -5 } })).toEqual({
      maxNodes: MAX_NODES,
      maxEdges: MAX_EDGES,
    })
    expect(resolveGraphLimits({ nodes: { max: Number.NaN }, edges: { max: 12.9 } })).toEqual({
      maxNodes: MAX_NODES,
      maxEdges: 12,
    })
  })
})

describe('limitExceededMessage', () => {
  it('mentions node count for node_limit', () => {
    const msg = limitExceededMessage('node_limit', 12)
    expect(msg).toContain('12 nodes')
    expect(msg).toContain('simplifying')
  })
  it('mentions edge count for edge_limit', () => {
    const msg = limitExceededMessage('edge_limit', 20)
    expect(msg).toContain('20 edges')
  })
})

// ─── Deletion impact ────────────────────────────────────────────────

function makeNode(id: string, type: string, label: string): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { label } } as Node
}
function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, data: {} } as Edge
}

describe('assessNodeDeletion', () => {
  it('detects last goal removal', () => {
    const nodes = [makeNode('g1', 'goal', 'Goal')]
    const impact = assessNodeDeletion(nodes, [], 'g1')
    expect(impact.removesLastGoal).toBe(true)
  })
  it('does not flag last goal when multiple exist', () => {
    const nodes = [makeNode('g1', 'goal', 'Goal 1'), makeNode('g2', 'goal', 'Goal 2')]
    const impact = assessNodeDeletion(nodes, [], 'g1')
    expect(impact.removesLastGoal).toBe(false)
  })
  it('detects orphaned nodes', () => {
    const nodes = [makeNode('a', 'factor', 'A'), makeNode('b', 'factor', 'B'), makeNode('c', 'factor', 'C')]
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')]
    // Deleting B orphans both A and C (they lose their only connections)
    const impact = assessNodeDeletion(nodes, edges, 'b')
    expect(impact.orphansNodes.length).toBe(2)
  })
})

describe('isSignificantImpact', () => {
  it('returns false for empty impact', () => {
    expect(isSignificantImpact({
      disconnectsOptions: [],
      orphansNodes: [],
      removesLastGoal: false,
      removesLastDecision: false,
    })).toBe(false)
  })
  it('returns true when removing last goal', () => {
    expect(isSignificantImpact({
      disconnectsOptions: [],
      orphansNodes: [],
      removesLastGoal: true,
      removesLastDecision: false,
    })).toBe(true)
  })
})

describe('buildDeletionMessage', () => {
  it('blocks when removing last goal', () => {
    const result = buildDeletionMessage({
      disconnectsOptions: [],
      orphansNodes: [],
      removesLastGoal: true,
      removesLastDecision: false,
    }, 'Goal')
    expect(result.blocked).toBe(true)
    expect(result.message).toContain('goal')
  })
})

// ─── BFS utility ────────────────────────────────────────────────────

describe('bfsReachable', () => {
  it('returns all reachable nodes from start', () => {
    const adj = buildAdjacency(['a', 'b', 'c', 'd'], [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ])
    const reachable = bfsReachable(new Set(['a']), adj)
    expect(reachable.has('a')).toBe(true)
    expect(reachable.has('b')).toBe(true)
    expect(reachable.has('c')).toBe(true)
    expect(reachable.has('d')).toBe(false)
  })
})
