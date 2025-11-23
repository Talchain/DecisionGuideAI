import { describe, it, expect } from 'vitest'
import {
  graphToRunRequest,
  validateGraph,
  validateProbabilities,
  blueprintToGraph,
  type GraphState
} from '../graphToRunRequest'
import type { Blueprint } from '../../blueprints/types'

describe('graphToRunRequest', () => {
  const mockGraph: GraphState = {
    nodes: [
      { id: 'n1', data: { label: 'Start' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'End' }, position: { x: 100, y: 100 } }
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', data: { probability: 1.0 } }
    ]
  }

  it('creates run request with template ID', () => {
    const result = graphToRunRequest(mockGraph, { templateId: 'pricing-v1' })
    
    expect(result.template_id).toBe('pricing-v1')
    expect(result.mode).toBe('strict')
    expect(result.seed).toBeGreaterThan(0)
  })

  it('uses provided seed', () => {
    const result = graphToRunRequest(mockGraph, {
      templateId: 'pricing-v1',
      seed: 1337
    })
    
    expect(result.seed).toBe(1337)
  })

  it('includes inputs', () => {
    const inputs = { price: 99, volume: 1000 }
    const result = graphToRunRequest(mockGraph, {
      templateId: 'pricing-v1',
      inputs
    })
    
    expect(result.inputs).toEqual(inputs)
  })

  it('generates deterministic seed from template ID', () => {
    const result1 = graphToRunRequest(mockGraph, { templateId: 'pricing-v1' })
    const result2 = graphToRunRequest(mockGraph, { templateId: 'pricing-v1' })
    
    expect(result1.seed).toBe(result2.seed)
  })
})

describe('validateGraph', () => {
  it('validates empty graph', () => {
    const result = validateGraph({ nodes: [], edges: [] })
    
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Graph must have at least one node')
  })

  it('does not enforce a hard node-count limit', () => {
    const nodes = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      data: { label: `Node ${i}` },
      position: { x: 0, y: 0 }
    }))

    const result = validateGraph({ nodes, edges: [] })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('does not enforce a hard edge-count limit', () => {
    const nodes = [
      { id: 'n1', data: { label: 'N1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'N2' }, position: { x: 0, y: 0 } }
    ]
    const edges = Array.from({ length: 210 }, (_, i) => ({
      id: `e${i}`,
      source: 'n1',
      target: 'n2'
    }))

    const result = validateGraph({ nodes, edges })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('validates edge references', () => {
    const graph: GraphState = {
      nodes: [{ id: 'n1', data: { label: 'N1' }, position: { x: 0, y: 0 } }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }]
    }
    
    const result = validateGraph(graph)
    
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('non-existent'))).toBe(true)
  })

  it('validates correct graph', () => {
    const graph: GraphState = {
      nodes: [
        { id: 'n1', data: { label: 'N1' }, position: { x: 0, y: 0 } },
        { id: 'n2', data: { label: 'N2' }, position: { x: 0, y: 0 } }
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }]
    }
    
    const result = validateGraph(graph)
    
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})

describe('validateProbabilities', () => {
  it('validates probabilities sum to 1', () => {
    const graph: GraphState = {
      nodes: [
        { id: 'n1', data: { label: 'N1' }, position: { x: 0, y: 0 } },
        { id: 'n2', data: { label: 'N2' }, position: { x: 0, y: 0 } },
        { id: 'n3', data: { label: 'N3' }, position: { x: 0, y: 0 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { probability: 0.6 } },
        { id: 'e2', source: 'n1', target: 'n3', data: { probability: 0.4 } }
      ]
    }
    
    const result = validateProbabilities(graph)
    
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('detects invalid probability sum', () => {
    const graph: GraphState = {
      nodes: [
        { id: 'n1', data: { label: 'N1' }, position: { x: 0, y: 0 } },
        { id: 'n2', data: { label: 'N2' }, position: { x: 0, y: 0 } },
        { id: 'n3', data: { label: 'N3' }, position: { x: 0, y: 0 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { probability: 0.5 } },
        { id: 'e2', source: 'n1', target: 'n3', data: { probability: 0.3 } }
      ]
    }
    
    const result = validateProbabilities(graph)
    
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('0.800')
  })
})

describe('blueprintToGraph', () => {
  it('converts blueprint to graph', () => {
    const blueprint: Blueprint = {
      id: 'test',
      name: 'Test',
      description: 'Test blueprint',
      nodes: [
        { id: 'n1', label: 'Start', kind: 'decision', position: { x: 0, y: 0 } },
        { id: 'n2', label: 'End', kind: 'outcome', position: { x: 100, y: 100 } }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', probability: 1.0 }
      ]
    }
    
    const graph = blueprintToGraph(blueprint)
    
    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)
    expect(graph.nodes[0].id).toBe('n1')
    expect(graph.edges[0].source).toBe('n1')
    expect(graph.edges[0].target).toBe('n2')
  })
})
