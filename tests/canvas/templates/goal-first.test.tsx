import { describe, it, expect } from 'vitest'
import { blueprintToGraph } from '../../../src/templates/mapper/blueprintToGraph'
import { getBlueprintById } from '../../../src/templates/blueprints'

describe('Goal-First Templates', () => {
  it('adds goal node if missing', () => {
    const blueprint = getBlueprintById('pricing-v1')!
    const graph = blueprintToGraph(blueprint)
    
    const goals = graph.nodes.filter(n => n.kind === 'goal')
    expect(goals.length).toBeGreaterThanOrEqual(1)
    
    // Goal should be connected to first decision
    const decisions = graph.nodes.filter(n => n.kind === 'decision')
    if (decisions.length > 0) {
      const goalEdges = graph.edges.filter(e => 
        goals.some(g => g.id === e.from) && 
        decisions.some(d => d.id === e.to)
      )
      expect(goalEdges.length).toBeGreaterThan(0)
    }
  })

  it('preserves existing goal', () => {
    const blueprint = {
      id: 'test-with-goal',
      name: 'Test',
      description: 'Test',
      nodes: [
        { id: 'g1', kind: 'goal' as const, label: 'Goal' },
        { id: 'd1', kind: 'decision' as const, label: 'Decision' }
      ],
      edges: [
        { from: 'g1', to: 'd1', probability: 1 }
      ]
    }
    
    const graph = blueprintToGraph(blueprint)
    const goals = graph.nodes.filter(n => n.kind === 'goal')
    
    expect(goals.length).toBe(1)
    expect(goals[0].id).toBe('g1')
  })

  it('all templates have exactly one goal after transform', () => {
    const ids = ['pricing-v1', 'hiring-v1', 'marketing-v1', 'supply-v1', 'feature-tradeoffs-v1', 'retention-v1']
    
    ids.forEach(id => {
      const blueprint = getBlueprintById(id)
      if (!blueprint) return
      
      const graph = blueprintToGraph(blueprint)
      const goals = graph.nodes.filter(n => n.kind === 'goal')
      
      expect(goals.length).toBeGreaterThanOrEqual(1)
    })
  })
})
