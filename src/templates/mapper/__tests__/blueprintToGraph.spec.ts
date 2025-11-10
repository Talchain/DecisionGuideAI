import { describe, it, expect } from 'vitest'
import { blueprintToGraph } from '../blueprintToGraph'
import type { Blueprint } from '../../blueprints/types'

describe('blueprintToGraph', () => {
  it('preserves v1.2 edge metadata (weight, belief, provenance)', () => {
    const blueprint: Blueprint = {
      id: 'test-v12',
      name: 'Test v1.2',
      description: 'Test template',
      nodes: [
        { id: 'goal', kind: 'goal', label: 'Goal', position: { x: 0, y: 0 } },
        { id: 'opt1', kind: 'option', label: 'Option 1', position: { x: 0, y: 100 } }
      ],
      edges: [
        {
          from: 'goal',
          to: 'opt1',
          probability: 0.75,
          weight: 0.6,
          belief: 0.8,
          provenance: 'template'
        }
      ]
    }

    const graph = blueprintToGraph(blueprint)

    expect(graph.edges).toHaveLength(1)
    const edge = graph.edges[0]

    expect(edge.from).toBe('goal')
    expect(edge.to).toBe('opt1')
    expect(edge.probability).toBe(0.75)
    expect(edge.weight).toBe(0.6)
    expect(edge.belief).toBe(0.8)
    expect(edge.provenance).toBe('template')
  })

  it('handles missing v1.2 fields gracefully (legacy blueprints)', () => {
    const blueprint: Blueprint = {
      id: 'test-legacy',
      name: 'Test Legacy',
      description: 'Legacy template',
      nodes: [
        { id: 'goal', kind: 'goal', label: 'Goal', position: { x: 0, y: 0 } },
        { id: 'opt1', kind: 'option', label: 'Option 1', position: { x: 0, y: 100 } }
      ],
      edges: [
        {
          from: 'goal',
          to: 'opt1',
          probability: 0.75
        }
      ]
    }

    const graph = blueprintToGraph(blueprint)

    expect(graph.edges).toHaveLength(1)
    const edge = graph.edges[0]

    expect(edge.probability).toBe(0.75)
    expect(edge.weight).toBeUndefined()
    expect(edge.belief).toBeUndefined()
    expect(edge.provenance).toBeUndefined()
  })

  it('preserves negative weight for drag edges', () => {
    const blueprint: Blueprint = {
      id: 'test-negative',
      name: 'Test Negative',
      description: 'Negative weight test',
      nodes: [
        { id: 'goal', kind: 'goal', label: 'Goal', position: { x: 0, y: 0 } },
        { id: 'risk', kind: 'risk', label: 'Risk', position: { x: 0, y: 100 } }
      ],
      edges: [
        {
          from: 'goal',
          to: 'risk',
          weight: -0.7,  // Negative weight (drag)
          belief: 0.9,
          provenance: 'template'
        }
      ]
    }

    const graph = blueprintToGraph(blueprint)

    expect(graph.edges).toHaveLength(1)
    const edge = graph.edges[0]

    expect(edge.weight).toBe(-0.7)
    expect(edge.belief).toBe(0.9)
    expect(edge.provenance).toBe('template')
  })

  it('preserves user provenance', () => {
    const blueprint: Blueprint = {
      id: 'test-user',
      name: 'Test User',
      description: 'User provenance test',
      nodes: [
        { id: 'goal', kind: 'goal', label: 'Goal', position: { x: 0, y: 0 } },
        { id: 'opt1', kind: 'option', label: 'Option 1', position: { x: 0, y: 100 } }
      ],
      edges: [
        {
          from: 'goal',
          to: 'opt1',
          weight: 0.5,
          belief: 0.7,
          provenance: 'user'
        }
      ]
    }

    const graph = blueprintToGraph(blueprint)

    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].provenance).toBe('user')
  })

  it('preserves inferred provenance', () => {
    const blueprint: Blueprint = {
      id: 'test-inferred',
      name: 'Test Inferred',
      description: 'Inferred provenance test',
      nodes: [
        { id: 'goal', kind: 'goal', label: 'Goal', position: { x: 0, y: 0 } },
        { id: 'opt1', kind: 'option', label: 'Option 1', position: { x: 0, y: 100 } }
      ],
      edges: [
        {
          from: 'goal',
          to: 'opt1',
          weight: 0.5,
          belief: 0.65,
          provenance: 'inferred'
        }
      ]
    }

    const graph = blueprintToGraph(blueprint)

    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].provenance).toBe('inferred')
  })

  it('adds auto-goal with v1.2 fields when goal missing', () => {
    const blueprint: Blueprint = {
      id: 'test-auto-goal',
      name: 'Test Auto Goal',
      description: 'Auto goal test',
      nodes: [
        { id: 'decision', kind: 'decision', label: 'Decision', position: { x: 0, y: 0 } },
        { id: 'opt1', kind: 'option', label: 'Option 1', position: { x: 0, y: 100 } }
      ],
      edges: [
        {
          from: 'decision',
          to: 'opt1',
          weight: 0.6,
          belief: 0.8,
          provenance: 'template'
        }
      ]
    }

    const graph = blueprintToGraph(blueprint)

    // Should have auto-goal node
    expect(graph.nodes).toHaveLength(3)
    const goalNode = graph.nodes.find(n => n.id === 'auto-goal')
    expect(goalNode).toBeDefined()
    expect(goalNode?.kind).toBe('goal')

    // Should have auto-goal edge
    expect(graph.edges).toHaveLength(2)
    const autoEdge = graph.edges.find(e => e.from === 'auto-goal')
    expect(autoEdge).toBeDefined()
    expect(autoEdge?.to).toBe('decision')
    expect(autoEdge?.probability).toBe(1.0)

    // Original edge should preserve v1.2 fields
    const originalEdge = graph.edges.find(e => e.from === 'decision')
    expect(originalEdge?.weight).toBe(0.6)
    expect(originalEdge?.belief).toBe(0.8)
    expect(originalEdge?.provenance).toBe('template')
  })
})
