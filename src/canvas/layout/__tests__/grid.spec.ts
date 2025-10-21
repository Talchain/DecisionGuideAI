/**
 * Grid layout engine tests
 */

import { describe, it, expect } from 'vitest'
import { applyGridLayout } from '../engines/grid'
import type { LayoutNode } from '../types'

describe('Grid Layout', () => {
  const createNodes = (count: number): LayoutNode[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `${i + 1}`,
      width: 200,
      height: 80
    }))
  }

  it('returns empty positions for empty nodes', () => {
    const result = applyGridLayout([], 'medium')
    expect(result.positions).toEqual({})
  })

  it('positions single node', () => {
    const nodes = createNodes(1)
    const result = applyGridLayout(nodes, 'medium')
    
    expect(result.positions['1']).toBeDefined()
    expect(result.positions['1'].x).toBeGreaterThanOrEqual(0)
    expect(result.positions['1'].y).toBeGreaterThanOrEqual(0)
  })

  it('arranges multiple nodes in grid', () => {
    const nodes = createNodes(9)
    const result = applyGridLayout(nodes, 'medium')
    
    // All nodes should have positions
    expect(Object.keys(result.positions)).toHaveLength(9)
    
    // Positions should be non-negative
    Object.values(result.positions).forEach(pos => {
      expect(pos.x).toBeGreaterThanOrEqual(0)
      expect(pos.y).toBeGreaterThanOrEqual(0)
    })
  })

  it('respects spacing parameter', () => {
    const nodes = createNodes(4)
    
    const smallResult = applyGridLayout(nodes, 'small')
    const largeResult = applyGridLayout(nodes, 'large')
    
    // Large spacing should create more spread
    const smallSpread = Math.max(...Object.values(smallResult.positions).map(p => p.x))
    const largeSpread = Math.max(...Object.values(largeResult.positions).map(p => p.x))
    
    expect(largeSpread).toBeGreaterThan(smallSpread)
  })

  it('preserves locked nodes', () => {
    const nodes = createNodes(4)
    const preserveIds = new Set(['1', '2'])
    
    const result = applyGridLayout(nodes, 'medium', preserveIds)
    
    // Preserved nodes should not have positions
    expect(result.positions['1']).toBeUndefined()
    expect(result.positions['2']).toBeUndefined()
    
    // Other nodes should have positions
    expect(result.positions['3']).toBeDefined()
    expect(result.positions['4']).toBeDefined()
  })

  it('completes within performance budget', () => {
    const nodes = createNodes(150)
    const result = applyGridLayout(nodes, 'medium')
    
    // Should complete in < 250ms
    expect(result.duration).toBeLessThan(250)
  })
})
