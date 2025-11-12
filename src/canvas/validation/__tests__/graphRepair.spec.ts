/**
 * M4: Graph Repair Tests
 */

import { describe, it, expect } from 'vitest'
import { applyRepair, applyRepairs, quickFixAll } from '../graphRepair'
import { validateGraph } from '../graphValidator'
import type { Node, Edge } from '@xyflow/react'
import type { RepairAction } from '../types'

describe('applyRepair (M4)', () => {
  it('removes node and connected edges', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n1' },
    ]

    const action: RepairAction = { type: 'remove_node', targetId: 'n1' }
    const result = applyRepair(nodes, edges, action)

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe('n2')
    expect(result.edges).toHaveLength(0) // Both edges connected to n1 removed
  })

  it('removes single edge', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n1' },
    ]

    const action: RepairAction = { type: 'remove_edge', targetId: 'e1' }
    const result = applyRepair(nodes, edges, action)

    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].id).toBe('e2')
  })

  it('updates node data', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: '' }, position: { x: 0, y: 0 } },
    ]
    const edges: Edge[] = []

    const action: RepairAction = {
      type: 'update_node',
      targetId: 'n1',
      data: { label: 'Updated Label' },
    }
    const result = applyRepair(nodes, edges, action)

    expect(result.nodes[0].data.label).toBe('Updated Label')
  })

  it('updates edge data', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2', data: {} }]

    const action: RepairAction = {
      type: 'update_edge',
      targetId: 'e1',
      data: { weight: 5 },
    }
    const result = applyRepair(nodes, edges, action)

    expect(result.edges[0].data?.weight).toBe(5)
  })

  it('adds new edge', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = []

    const action: RepairAction = {
      type: 'add_edge',
      targetId: 'e-new',
      data: { id: 'e-new', source: 'n1', target: 'n2', data: {} },
    }
    const result = applyRepair(nodes, edges, action)

    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].source).toBe('n1')
    expect(result.edges[0].target).toBe('n2')
  })
})

describe('applyRepairs (M4)', () => {
  it('applies repairs in deterministic order', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
      { id: 'n3', data: { label: 'Orphan' }, position: { x: 200, y: 0 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n1' }, // Self-loop
      { id: 'e2', source: 'n1', target: 'n2' },
      { id: 'e3', source: 'n1', target: 'n2' }, // Duplicate
    ]

    const health = validateGraph(nodes, edges)
    const result = applyRepairs(nodes, edges, health.issues)

    // Should remove self-loop and duplicate edge
    expect(result.edges.length).toBeLessThan(edges.length)
  })

  it('handles multiple repairs without conflicts', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: '' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: '' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = []

    const health = validateGraph(nodes, edges)
    const result = applyRepairs(nodes, edges, health.issues)

    // Both nodes should have labels now
    expect(result.nodes[0].data.label).toBeTruthy()
    expect(result.nodes[1].data.label).toBeTruthy()
  })
})

describe('quickFixAll (M4)', () => {
  it('fixes all issues with suggested fixes', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n1' }, // Self-loop
      { id: 'e2', source: 'n1', target: 'n2' },
      { id: 'e3', source: 'n1', target: 'n2' }, // Duplicate
    ]

    const health = validateGraph(nodes, edges)
    const result = quickFixAll(nodes, edges, health.issues)

    expect(result.fixedCount).toBeGreaterThan(0)
    expect(result.edges.length).toBeLessThan(edges.length)

    // Validate the result is healthier
    const newHealth = validateGraph(result.nodes, result.edges)
    expect(newHealth.issues.length).toBeLessThan(health.issues.length)
  })

  it('returns correct fixedCount', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: '' }, position: { x: 0, y: 0 } },
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n1' }]

    const health = validateGraph(nodes, edges)
    const fixableIssues = health.issues.filter((i) => i.suggestedFix)
    const result = quickFixAll(nodes, edges, health.issues)

    expect(result.fixedCount).toBe(fixableIssues.length)
  })

  it('improves health score after quick fix', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n1' },
      { id: 'e2', source: 'n1', target: 'n2' },
      { id: 'e3', source: 'n1', target: 'n2' },
    ]

    const beforeHealth = validateGraph(nodes, edges)
    const result = quickFixAll(nodes, edges, beforeHealth.issues)
    const afterHealth = validateGraph(result.nodes, result.edges)

    expect(afterHealth.score).toBeGreaterThan(beforeHealth.score)
    expect(afterHealth.issues.length).toBeLessThan(beforeHealth.issues.length)
  })

  it('handles graph with no fixable issues', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Orphan' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = []

    const health = validateGraph(nodes, edges)
    const result = quickFixAll(nodes, edges, health.issues)

    // Orphan warning has no suggested fix
    expect(result.fixedCount).toBe(0)
    expect(result.nodes).toEqual(nodes)
    expect(result.edges).toEqual(edges)
  })
})
