/**
 * Canvas Highlighting Tests
 *
 * Tests for post-run highlighting utilities
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import {
  applyPostRunHighlighting,
  clearHighlighting,
  focusOnDriver,
  type TopDriver,
} from '../canvasHighlighting'

describe('canvasHighlighting', () => {
  const mockNodes: Node[] = [
    {
      id: 'n1',
      type: 'default',
      position: { x: 0, y: 0 },
      data: {},
      style: {},
    },
    {
      id: 'n2',
      type: 'default',
      position: { x: 100, y: 100 },
      data: {},
      style: {},
    },
    {
      id: 'n3',
      type: 'default',
      position: { x: 200, y: 200 },
      data: {},
      style: {},
    },
  ]

  const mockEdges: Edge[] = [
    {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      style: {},
    },
    {
      id: 'e2',
      source: 'n2',
      target: 'n3',
      style: {},
    },
  ]

  const mockTopDrivers: TopDriver[] = [
    {
      node_id: 'n1',
      contribution: 0.45,
      node_label: 'Top Driver',
    },
  ]

  describe('applyPostRunHighlighting', () => {
    it('highlights top driver nodes at full opacity', () => {
      const result = applyPostRunHighlighting(mockNodes, mockEdges, mockTopDrivers)

      expect(result.nodes[0].style?.opacity).toBe(1)
      expect(result.nodes[0].className).toContain('driver-node')
    })

    it('fades non-driver nodes to 40%', () => {
      const result = applyPostRunHighlighting(mockNodes, mockEdges, mockTopDrivers)

      expect(result.nodes[1].style?.opacity).toBe(0.4)
      expect(result.nodes[1].className).toContain('faded-node')
      expect(result.nodes[2].style?.opacity).toBe(0.4)
      expect(result.nodes[2].className).toContain('faded-node')
    })

    it('adds glow effect to driver nodes', () => {
      const result = applyPostRunHighlighting(mockNodes, mockEdges, mockTopDrivers)

      expect(result.nodes[0].data?.style?.boxShadow).toBeDefined()
      expect(result.nodes[0].data?.style?.boxShadow).toContain('rgba(66, 153, 225, 0.4)')
    })

    it('highlights edges connected to drivers', () => {
      const result = applyPostRunHighlighting(mockNodes, mockEdges, mockTopDrivers)

      expect(result.edges[0].style?.opacity).toBe(1)
      expect(result.edges[0].className).toContain('driver-edge')
      expect(result.edges[0].animated).toBe(true)
    })

    it('fades non-driver edges to 20%', () => {
      const result = applyPostRunHighlighting(mockNodes, mockEdges, mockTopDrivers)

      expect(result.edges[1].style?.opacity).toBe(0.2)
      expect(result.edges[1].className).toContain('faded-edge')
    })

    it('highlights edges where driver is source', () => {
      const drivers: TopDriver[] = [{ node_id: 'n1', contribution: 0.5 }]
      const result = applyPostRunHighlighting(mockNodes, mockEdges, drivers)

      // e1: n1 -> n2 (should be highlighted because n1 is driver)
      expect(result.edges[0].style?.opacity).toBe(1)
      expect(result.edges[0].className).toContain('driver-edge')
    })

    it('highlights edges where driver is target', () => {
      const drivers: TopDriver[] = [{ node_id: 'n2', contribution: 0.5 }]
      const result = applyPostRunHighlighting(mockNodes, mockEdges, drivers)

      // Both edges connect to n2
      expect(result.edges[0].style?.opacity).toBe(1)
      expect(result.edges[1].style?.opacity).toBe(1)
    })

    it('limits highlighting to top 3 drivers', () => {
      const manyDrivers: TopDriver[] = [
        { node_id: 'n1', contribution: 0.5 },
        { node_id: 'n2', contribution: 0.3 },
        { node_id: 'n3', contribution: 0.2 },
        { node_id: 'n4', contribution: 0.1 }, // 4th should not be highlighted
      ]

      const result = applyPostRunHighlighting(mockNodes, mockEdges, manyDrivers)

      // Only first 3 nodes should be highlighted
      const highlightedCount = result.nodes.filter((n) =>
        n.className?.includes('driver-node')
      ).length
      expect(highlightedCount).toBe(3)
    })

    it('handles empty drivers array', () => {
      const result = applyPostRunHighlighting(mockNodes, mockEdges, [])

      // All nodes should be faded
      result.nodes.forEach((node) => {
        expect(node.style?.opacity).toBe(0.4)
        expect(node.className).toContain('faded-node')
      })

      // All edges should be faded
      result.edges.forEach((edge) => {
        expect(edge.style?.opacity).toBe(0.2)
        expect(edge.className).toContain('faded-edge')
      })
    })

    it('preserves existing className', () => {
      const nodesWithClass: Node[] = [
        {
          ...mockNodes[0],
          className: 'existing-class',
        },
      ]

      const result = applyPostRunHighlighting(nodesWithClass, mockEdges, mockTopDrivers)

      expect(result.nodes[0].className).toContain('existing-class')
      expect(result.nodes[0].className).toContain('driver-node')
    })
  })

  describe('clearHighlighting', () => {
    it('restores all nodes to full opacity', () => {
      const highlighted = applyPostRunHighlighting(mockNodes, mockEdges, mockTopDrivers)
      const cleared = clearHighlighting(highlighted.nodes, highlighted.edges)

      cleared.nodes.forEach((node) => {
        expect(node.style?.opacity).toBe(1)
      })
    })

    it('restores all edges to full opacity', () => {
      const highlighted = applyPostRunHighlighting(mockNodes, mockEdges, mockTopDrivers)
      const cleared = clearHighlighting(highlighted.nodes, highlighted.edges)

      cleared.edges.forEach((edge) => {
        expect(edge.style?.opacity).toBe(1)
      })
    })

    it('removes all highlighting classes', () => {
      const highlighted = applyPostRunHighlighting(mockNodes, mockEdges, mockTopDrivers)
      const cleared = clearHighlighting(highlighted.nodes, highlighted.edges)

      cleared.nodes.forEach((node) => {
        expect(node.className).not.toContain('driver-node')
        expect(node.className).not.toContain('faded-node')
        expect(node.className).not.toContain('focused-node')
      })

      cleared.edges.forEach((edge) => {
        expect(edge.className).not.toContain('driver-edge')
        expect(edge.className).not.toContain('faded-edge')
        expect(edge.className).not.toContain('focused-edge')
      })
    })

    it('removes glow effects', () => {
      const highlighted = applyPostRunHighlighting(mockNodes, mockEdges, mockTopDrivers)
      const cleared = clearHighlighting(highlighted.nodes, highlighted.edges)

      cleared.nodes.forEach((node) => {
        expect(node.data?.style?.boxShadow).toBeUndefined()
      })
    })

    it('disables edge animation', () => {
      const highlighted = applyPostRunHighlighting(mockNodes, mockEdges, mockTopDrivers)
      const cleared = clearHighlighting(highlighted.nodes, highlighted.edges)

      cleared.edges.forEach((edge) => {
        expect(edge.animated).toBe(false)
      })
    })
  })

  describe('focusOnDriver', () => {
    it('focuses single driver at full opacity', () => {
      const result = focusOnDriver(mockNodes, mockEdges, 'n2')

      expect(result.nodes[1].style?.opacity).toBe(1)
      expect(result.nodes[1].className).toContain('focused-node')
    })

    it('super-fades non-focused nodes', () => {
      const result = focusOnDriver(mockNodes, mockEdges, 'n2')

      expect(result.nodes[0].style?.opacity).toBe(0.2)
      expect(result.nodes[2].style?.opacity).toBe(0.2)
    })

    it('highlights edges connected to focused node', () => {
      const result = focusOnDriver(mockNodes, mockEdges, 'n2')

      // Both edges connect to n2
      expect(result.edges[0].style?.opacity).toBe(1)
      expect(result.edges[0].className).toContain('focused-edge')
      expect(result.edges[1].style?.opacity).toBe(1)
      expect(result.edges[1].className).toContain('focused-edge')
    })

    it('super-fades non-connected edges', () => {
      const result = focusOnDriver(mockNodes, mockEdges, 'n1')

      // e1 connects to n1, e2 does not
      expect(result.edges[0].style?.opacity).toBe(1)
      expect(result.edges[1].style?.opacity).toBe(0.1)
    })

    it('handles focus on node with no connections', () => {
      const isolatedNode: Node = {
        id: 'n4',
        type: 'default',
        position: { x: 300, y: 300 },
        data: {},
        style: {},
      }

      const result = focusOnDriver([...mockNodes, isolatedNode], mockEdges, 'n4')

      // n4 should be focused
      expect(result.nodes[3].style?.opacity).toBe(1)
      expect(result.nodes[3].className).toContain('focused-node')

      // All edges should be super-faded
      result.edges.forEach((edge) => {
        expect(edge.style?.opacity).toBe(0.1)
      })
    })
  })
})
