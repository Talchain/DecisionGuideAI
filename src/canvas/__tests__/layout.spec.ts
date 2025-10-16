import { describe, it, expect } from 'vitest'
import { layoutGraph } from '../utils/layout'
import type { Node, Edge } from '@xyflow/react'

describe('ELK Layout', () => {
  const mockNodes: Node[] = [
    { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } },
    { id: '2', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'B' } },
    { id: '3', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'C' } }
  ]

  const mockEdges: Edge[] = [
    { id: 'e1', source: '1', target: '2' },
    { id: 'e2', source: '1', target: '3' }
  ]

  it('applies hierarchical layout to nodes', async () => {
    const { nodes } = await layoutGraph(mockNodes, mockEdges)

    expect(nodes).toHaveLength(3)
    
    // All nodes should have positions
    nodes.forEach(node => {
      expect(node.position.x).toBeGreaterThanOrEqual(0)
      expect(node.position.y).toBeGreaterThanOrEqual(0)
    })

    // Hierarchical layout should have vertical separation
    const node1 = nodes.find(n => n.id === '1')
    const node2 = nodes.find(n => n.id === '2')
    expect(node1?.position.y).toBeLessThan(node2?.position.y ?? 0)
  })

  it('preserves locked node positions', async () => {
    const lockedNodes: Node[] = [
      { id: '1', type: 'decision', position: { x: 100, y: 100 }, data: { label: 'Locked', locked: true } },
      { id: '2', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Unlocked' } }
    ]

    const { nodes } = await layoutGraph(lockedNodes, [], { preserveLocked: true })

    const locked = nodes.find(n => n.id === '1')
    const unlocked = nodes.find(n => n.id === '2')

    // Locked node should keep original position
    expect(locked?.position).toEqual({ x: 100, y: 100 })
    
    // Unlocked node position may change
    expect(unlocked?.position).toBeDefined()
  })

  it('handles empty graph', async () => {
    const { nodes, edges } = await layoutGraph([], [])
    expect(nodes).toHaveLength(0)
    expect(edges).toHaveLength(0)
  })

  it('handles single node', async () => {
    const singleNode: Node[] = [
      { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Solo' } }
    ]

    const { nodes } = await layoutGraph(singleNode, [])
    expect(nodes).toHaveLength(1)
    expect(nodes[0].position).toBeDefined()
  })

  it('respects layout direction option', async () => {
    const { nodes: downNodes } = await layoutGraph(mockNodes, mockEdges, { direction: 'DOWN' })
    const { nodes: rightNodes } = await layoutGraph(mockNodes, mockEdges, { direction: 'RIGHT' })

    // Both should have valid layouts
    expect(downNodes).toHaveLength(3)
    expect(rightNodes).toHaveLength(3)

    // Positions should differ based on direction
    expect(downNodes[0].position).not.toEqual(rightNodes[0].position)
  })
})
