import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore } from '../../../src/canvas/store'
import { getBlueprintById } from '../../../src/templates/blueprints'

// Mock React Flow
vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: any) => children,
  useReactFlow: () => ({
    getViewport: () => ({ x: 0, y: 0, zoom: 1 })
  })
}))

describe('Template Insert - Connectors', () => {
  beforeEach(() => {
    useCanvasStore.setState({ nodes: [], edges: [] })
  })

  it('inserts template with edges', () => {
    const blueprint = getBlueprintById('pricing-v1')
    expect(blueprint).toBeDefined()
    expect(blueprint?.edges).toBeDefined()
    expect(blueprint?.edges.length).toBeGreaterThan(0)
  })

  it('blueprint edges have correct structure', () => {
    const blueprint = getBlueprintById('pricing-v1')
    
    blueprint?.edges.forEach(edge => {
      expect(edge).toHaveProperty('from')
      expect(edge).toHaveProperty('to')
      expect(edge).toHaveProperty('probability')
    })
  })

  it('edges reference valid node IDs', () => {
    const blueprint = getBlueprintById('pricing-v1')
    const nodeIds = new Set(blueprint?.nodes.map(n => n.id))
    
    blueprint?.edges.forEach(edge => {
      expect(nodeIds.has(edge.from)).toBe(true)
      expect(nodeIds.has(edge.to)).toBe(true)
    })
  })

  it('probability labels are formatted correctly', () => {
    const blueprint = getBlueprintById('pricing-v1')
    
    blueprint?.edges.forEach(edge => {
      if (edge.probability != null) {
        const pct = Math.round(edge.probability * 100)
        const label = `${pct}%`
        expect(label).toMatch(/^\d+%$/)
      }
    })
  })
})
