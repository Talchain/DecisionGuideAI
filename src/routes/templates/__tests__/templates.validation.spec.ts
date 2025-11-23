import { describe, it, expect } from 'vitest'
import { validateGraph, type ApiLimits } from '../../../lib/plotApi'

// Import all templates
import pricingTemplate from '../data/pricing-v1.json'
import hiringTemplate from '../data/hiring-v1.json'
import marketingTemplate from '../data/marketing-v1.json'
import supplyTemplate from '../data/supply-v1.json'
import featureTemplate from '../data/feature-v1.json'
import investmentTemplate from '../data/investment-v1.json'

const TEMPLATES = [
  { name: 'pricing-v1', data: pricingTemplate },
  { name: 'hiring-v1', data: hiringTemplate },
  { name: 'marketing-v1', data: marketingTemplate },
  { name: 'supply-v1', data: supplyTemplate },
  { name: 'feature-v1', data: featureTemplate },
  { name: 'investment-v1', data: investmentTemplate }
]

const LIMITS: ApiLimits = { max_nodes: 50, max_edges: 200 }

describe('Template Validation', () => {
  TEMPLATES.forEach(({ name, data }) => {
    describe(name, () => {
      it('has required fields', () => {
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('name')
        expect(data).toHaveProperty('description')
        expect(data).toHaveProperty('seed')
        expect(data).toHaveProperty('graph')
        expect(data.graph).toHaveProperty('goalNodeId')
        expect(data.graph).toHaveProperty('nodes')
        expect(data.graph).toHaveProperty('edges')
      })

      it('has valid node structure', () => {
        data.graph.nodes.forEach((node: any) => {
          expect(node).toHaveProperty('id')
          expect(node).toHaveProperty('kind')
          expect(node).toHaveProperty('label')
          
          // kind should be lowercase
          expect(['goal', 'decision', 'option', 'risk', 'outcome']).toContain(node.kind)
        })
      })

      it('has valid edge structure', () => {
        data.graph.edges.forEach((edge: any) => {
          expect(edge).toHaveProperty('id')
          expect(edge).toHaveProperty('source')
          expect(edge).toHaveProperty('target')
          expect(edge).toHaveProperty('weight')
          expect(edge).toHaveProperty('belief')
          
          // weight and belief should be numbers
          expect(typeof edge.weight).toBe('number')
          expect(typeof edge.belief).toBe('number')
          
          // belief should be between 0 and 1
          expect(edge.belief).toBeGreaterThanOrEqual(0)
          expect(edge.belief).toBeLessThanOrEqual(1)
        })
      })

      it('edges reference valid nodes', () => {
        const nodeIds = new Set(data.graph.nodes.map((n: any) => n.id))
        
        data.graph.edges.forEach((edge: any) => {
          expect(nodeIds.has(edge.source)).toBe(true)
          expect(nodeIds.has(edge.target)).toBe(true)
        })
      })

      it('goalNodeId references a valid goal node', () => {
        const goalNode = data.graph.nodes.find((n: any) => n.id === data.graph.goalNodeId)
        expect(goalNode).toBeDefined()
        expect(goalNode?.kind).toBe('goal')
      })

      it('respects node limit (≤50 nodes)', () => {
        expect(data.graph.nodes.length).toBeLessThanOrEqual(LIMITS.max_nodes)
      })

      it('respects edge limit (≤200 edges)', () => {
        expect(data.graph.edges.length).toBeLessThanOrEqual(LIMITS.max_edges)
      })

      it('passes validateGraph check', () => {
        const result = validateGraph(data.graph as any, LIMITS)
        expect(result).toBeNull()
      })
    })
  })

  it('all templates have unique IDs', () => {
    const ids = TEMPLATES.map(t => t.data.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('all templates have unique seeds', () => {
    const seeds = TEMPLATES.map(t => t.data.seed)
    const uniqueSeeds = new Set(seeds)
    expect(uniqueSeeds.size).toBe(seeds.length)
  })
})
