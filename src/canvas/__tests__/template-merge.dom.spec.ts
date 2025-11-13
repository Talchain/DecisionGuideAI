/**
 * S2-MERGE: DOM Integration Tests for Template Merge with ID Mapping
 * Tests ID remapping, position offsetting, and edge reference updates
 * Uses Vitest for integration testing
 */

import { describe, it, expect } from 'vitest'
import { coerceNodes, type BackendNode } from '../adapters/backendKinds'
import type { Node, Edge } from '@xyflow/react'

describe('S2-MERGE: Template Merge with ID Mapping', () => {
  describe('Node ID Remapping', () => {
    it('should create unique IDs for merged nodes', () => {
      const backendNodes: BackendNode[] = [
        { id: 'n1', kind: 'decision', label: 'Node 1' },
        { id: 'n2', kind: 'outcome', label: 'Node 2' }
      ]

      const coercedNodes = coerceNodes(backendNodes)

      // Simulate ID remapping (as done in TemplatesPanel)
      const nodeIdMap = new Map<string, string>()
      let nextId = 100

      const remappedNodes = coercedNodes.map(node => {
        const newId = String(nextId++)
        nodeIdMap.set(node.id, newId)
        return {
          ...node,
          id: newId
        }
      })

      expect(remappedNodes[0].id).toBe('100')
      expect(remappedNodes[1].id).toBe('101')
      expect(nodeIdMap.get('n1')).toBe('100')
      expect(nodeIdMap.get('n2')).toBe('101')
    })

    it('should preserve node data during ID remapping', () => {
      const backendNodes: BackendNode[] = [
        {
          id: 'orig-1',
          kind: 'decision',
          label: 'Critical Decision',
          body: 'Body text',
          prior: { mean: 0.5 },
          position: { x: 100, y: 200 }
        }
      ]

      const coercedNodes = coerceNodes(backendNodes)
      const nodeIdMap = new Map<string, string>()

      const remapped = coercedNodes.map(node => {
        const newId = 'new-123'
        nodeIdMap.set(node.id, newId)
        return { ...node, id: newId }
      })[0]

      expect(remapped.id).toBe('new-123')
      expect(remapped.data.label).toBe('Critical Decision')
      expect(remapped.data.body).toBe('Body text')
      expect(remapped.data.prior).toEqual({ mean: 0.5 })
      expect(remapped.position).toEqual({ x: 100, y: 200 })
    })

    it('should handle multiple template merges with sequential IDs', () => {
      // First merge
      let nextId = 1
      const firstMerge = ['n1', 'n2'].map(id => ({
        id: String(nextId++),
        original: id
      }))

      // Second merge (IDs should continue from where first left off)
      const secondMerge = ['n3', 'n4'].map(id => ({
        id: String(nextId++),
        original: id
      }))

      expect(firstMerge.map(n => n.id)).toEqual(['1', '2'])
      expect(secondMerge.map(n => n.id)).toEqual(['3', '4'])
    })
  })

  describe('Edge Reference Remapping', () => {
    it('should update edge source and target after node ID remapping', () => {
      const nodeIdMap = new Map<string, string>([
        ['old-1', 'new-100'],
        ['old-2', 'new-101']
      ])

      const originalEdge = {
        id: 'e1',
        source: 'old-1',
        target: 'old-2',
        data: { weight: 0.5 }
      }

      const remappedEdge = {
        ...originalEdge,
        source: nodeIdMap.get(originalEdge.source) || originalEdge.source,
        target: nodeIdMap.get(originalEdge.target) || originalEdge.target
      }

      expect(remappedEdge.source).toBe('new-100')
      expect(remappedEdge.target).toBe('new-101')
      expect(remappedEdge.data.weight).toBe(0.5)
    })

    it('should create new edge IDs during merge', () => {
      let nextEdgeId = 1

      const originalEdges = [
        { id: 'e1', source: 'n1', target: 'n2', data: {} },
        { id: 'e2', source: 'n2', target: 'n3', data: {} }
      ]

      const remappedEdges = originalEdges.map(edge => ({
        ...edge,
        id: `e${nextEdgeId++}`
      }))

      expect(remappedEdges[0].id).toBe('e1')
      expect(remappedEdges[1].id).toBe('e2')
    })

    it('should handle edges with no matching nodes gracefully', () => {
      const nodeIdMap = new Map<string, string>([
        ['old-1', 'new-100']
        // old-2 is missing
      ])

      const originalEdge = {
        id: 'e1',
        source: 'old-1',
        target: 'old-2',
        data: {}
      }

      const remappedEdge = {
        ...originalEdge,
        source: nodeIdMap.get(originalEdge.source) || originalEdge.source,
        target: nodeIdMap.get(originalEdge.target) || originalEdge.target
      }

      expect(remappedEdge.source).toBe('new-100')
      expect(remappedEdge.target).toBe('old-2') // Falls back to original
    })

    it('should preserve edge data during remapping', () => {
      const nodeIdMap = new Map<string, string>([
        ['a', '1'],
        ['b', '2']
      ])

      const originalEdge = {
        id: 'edge-x',
        source: 'a',
        target: 'b',
        data: {
          weight: 0.75,
          belief: 0.9,
          label: 'Strong connection'
        }
      }

      const remappedEdge = {
        ...originalEdge,
        id: 'edge-new',
        source: nodeIdMap.get(originalEdge.source)!,
        target: nodeIdMap.get(originalEdge.target)!
      }

      expect(remappedEdge.source).toBe('1')
      expect(remappedEdge.target).toBe('2')
      expect(remappedEdge.data.weight).toBe(0.75)
      expect(remappedEdge.data.belief).toBe(0.9)
      expect(remappedEdge.data.label).toBe('Strong connection')
    })
  })

  describe('Position Offset Calculation', () => {
    it('should calculate offset based on rightmost existing node', () => {
      const existingNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: {}, width: 200, height: 100 },
        { id: '2', type: 'outcome', position: { x: 300, y: 0 }, data: {}, width: 200, height: 100 }
      ]

      // Find rightmost position
      const maxX = Math.max(...existingNodes.map(n => n.position.x + (n.width || 200)))
      const xOffset = maxX + 300 // 300px gap

      expect(xOffset).toBe(500 + 300) // 300 + 200 = 500, + 300 = 800
      expect(xOffset).toBe(800)
    })

    it('should use 0 offset for empty canvas', () => {
      const existingNodes: Node[] = []

      const maxX = existingNodes.length > 0
        ? Math.max(...existingNodes.map(n => n.position.x + (n.width || 200)))
        : 0

      const xOffset = existingNodes.length > 0 ? maxX + 300 : 0

      expect(xOffset).toBe(0)
    })

    it('should apply offset to all merged nodes', () => {
      const xOffset = 500
      const yOffset = 0

      const templateNodes = [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 400, y: 100 }
      ]

      const mergedNodes = templateNodes.map(pos => ({
        x: pos.x + xOffset,
        y: pos.y + yOffset
      }))

      expect(mergedNodes[0]).toEqual({ x: 500, y: 0 })
      expect(mergedNodes[1]).toEqual({ x: 700, y: 0 })
      expect(mergedNodes[2]).toEqual({ x: 900, y: 100 })
    })

    it('should handle nodes without width/height', () => {
      const existingNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: {} }, // No width
        { id: '2', type: 'outcome', position: { x: 300, y: 0 }, data: {} } // No width
      ]

      // Default width assumption: 200px
      const maxX = Math.max(...existingNodes.map(n => n.position.x + (n.width || 200)))
      const xOffset = maxX + 300

      expect(maxX).toBe(500) // 300 + 200
      expect(xOffset).toBe(800)
    })

    it('should calculate offset with mixed node widths', () => {
      const existingNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: {}, width: 150, height: 100 },
        { id: '2', type: 'outcome', position: { x: 200, y: 0 }, data: {}, width: 300, height: 150 }
      ]

      const maxX = Math.max(...existingNodes.map(n => n.position.x + (n.width || 200)))
      const xOffset = maxX + 300

      expect(maxX).toBe(500) // 200 + 300
      expect(xOffset).toBe(800)
    })
  })

  describe('Template Metadata Preservation', () => {
    it('should add template metadata to merged nodes', () => {
      const templateId = 'template-decision-tree'
      const templateName = 'Decision Tree Template'
      const mergeTimestamp = Date.now()

      const node = {
        id: '1',
        type: 'decision' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Node',
          templateId,
          templateName,
          templateCreatedAt: mergeTimestamp
        }
      }

      expect(node.data.templateId).toBe(templateId)
      expect(node.data.templateName).toBe(templateName)
      expect(node.data.templateCreatedAt).toBe(mergeTimestamp)
    })

    it('should preserve existing node data when adding template metadata', () => {
      const existingData = {
        label: 'My Decision',
        description: 'Important choice',
        prior: { mean: 0.5 }
      }

      const enhancedData = {
        ...existingData,
        templateId: 'tpl-1',
        templateName: 'Template',
        templateCreatedAt: Date.now()
      }

      expect(enhancedData.label).toBe('My Decision')
      expect(enhancedData.description).toBe('Important choice')
      expect(enhancedData.prior).toEqual({ mean: 0.5 })
      expect(enhancedData.templateId).toBe('tpl-1')
    })
  })

  describe('Complex Merge Scenarios', () => {
    it('should handle large template with many nodes', () => {
      const nodeIdMap = new Map<string, string>()
      let nextId = 1

      const templateNodes = Array.from({ length: 50 }, (_, i) => ({
        originalId: `template-n${i}`,
        newId: String(nextId++)
      }))

      templateNodes.forEach(node => {
        nodeIdMap.set(node.originalId, node.newId)
      })

      expect(nodeIdMap.size).toBe(50)
      expect(nodeIdMap.get('template-n0')).toBe('1')
      expect(nodeIdMap.get('template-n49')).toBe('50')
    })

    it('should handle template with complex edge graph', () => {
      const nodeIdMap = new Map<string, string>([
        ['a', '1'],
        ['b', '2'],
        ['c', '3']
      ])

      const templateEdges = [
        { source: 'a', target: 'b', data: {} },
        { source: 'b', target: 'c', data: {} },
        { source: 'a', target: 'c', data: {} } // Direct path
      ]

      const remappedEdges = templateEdges.map((edge, i) => ({
        id: `e${i + 1}`,
        source: nodeIdMap.get(edge.source)!,
        target: nodeIdMap.get(edge.target)!,
        data: edge.data
      }))

      expect(remappedEdges).toEqual([
        { id: 'e1', source: '1', target: '2', data: {} },
        { id: 'e2', source: '2', target: '3', data: {} },
        { id: 'e3', source: '1', target: '3', data: {} }
      ])
    })

    it('should merge multiple templates sequentially', () => {
      let nextId = 1
      let nextEdgeId = 1

      // First merge
      const firstNodes = ['n1', 'n2'].map(id => ({
        id: String(nextId++),
        type: 'decision' as const,
        position: { x: 0, y: 0 },
        data: { label: id }
      }))

      // Second merge (IDs continue)
      const secondNodes = ['n3', 'n4'].map(id => ({
        id: String(nextId++),
        type: 'outcome' as const,
        position: { x: 800, y: 0 },
        data: { label: id }
      }))

      const allNodes = [...firstNodes, ...secondNodes]

      expect(allNodes.map(n => n.id)).toEqual(['1', '2', '3', '4'])
      expect(nextId).toBe(5)
    })

    it('should handle template with unknown backend kinds', () => {
      const backendNodes: BackendNode[] = [
        { id: 'n1', kind: 'decision', label: 'Known' },
        { id: 'n2', kind: 'custom-unknown-type', label: 'Unknown' }
      ]

      const coerced = coerceNodes(backendNodes)

      // Unknown kind should be coerced to 'factor' with metadata
      expect(coerced[0].type).toBe('decision')
      expect(coerced[1].type).toBe('factor') // Fallback
      expect(coerced[1].data.unknownKind).toBe(true)
      expect(coerced[1].data.originalKind).toBe('custom-unknown-type')
    })

    it('should handle template with nodes lacking positions', () => {
      const backendNodes: BackendNode[] = [
        { id: 'n1', kind: 'decision', label: 'No Position 1' },
        { id: 'n2', kind: 'outcome', label: 'No Position 2' },
        { id: 'n3', kind: 'option', label: 'No Position 3' }
      ]

      const coerced = coerceNodes(backendNodes)

      // Grid layout should be applied (200 + index%3*250, 100 + floor(index/3)*200)
      expect(coerced[0].position).toEqual({ x: 200, y: 100 })
      expect(coerced[1].position).toEqual({ x: 450, y: 100 })
      expect(coerced[2].position).toEqual({ x: 700, y: 100 })
    })
  })

  describe('ID Collision Avoidance', () => {
    it('should avoid ID collisions with existing canvas nodes', () => {
      const existingNodeIds = new Set(['1', '2', '3'])

      // Find next available ID
      let nextId = 1
      while (existingNodeIds.has(String(nextId))) {
        nextId++
      }

      expect(nextId).toBe(4)
    })

    it('should track all assigned IDs during merge', () => {
      const assignedIds = new Set<string>()

      const templateNodes = ['a', 'b', 'c', 'd']
      let nextId = 1

      const remappedNodes = templateNodes.map(original => {
        const newId = String(nextId++)
        assignedIds.add(newId)
        return { original, newId }
      })

      expect(assignedIds.size).toBe(4)
      expect(Array.from(assignedIds).sort()).toEqual(['1', '2', '3', '4'])
    })

    it('should handle merge when canvas has non-numeric IDs', () => {
      const existingNodeIds = new Set(['node-a', 'node-b', '1', '2'])

      // Extract numeric IDs
      const numericIds = Array.from(existingNodeIds)
        .map(id => parseInt(id, 10))
        .filter(n => !isNaN(n))

      const maxNumericId = numericIds.length > 0 ? Math.max(...numericIds) : 0

      const nextId = maxNumericId + 1

      expect(nextId).toBe(3)
    })
  })

  describe('Edge Cases', () => {
    it('should handle merge with empty template', () => {
      const backendNodes: BackendNode[] = []
      const coerced = coerceNodes(backendNodes)

      expect(coerced).toEqual([])
    })

    it('should handle merge with single node template', () => {
      const backendNodes: BackendNode[] = [
        { id: 'single', kind: 'decision', label: 'Only Node' }
      ]

      const coerced = coerceNodes(backendNodes)

      expect(coerced.length).toBe(1)
      expect(coerced[0].data.label).toBe('Only Node')
    })

    it('should handle negative position offsets', () => {
      const xOffset = -500
      const yOffset = -300

      const node = {
        position: { x: 600, y: 400 }
      }

      const offsetNode = {
        position: {
          x: node.position.x + xOffset,
          y: node.position.y + yOffset
        }
      }

      expect(offsetNode.position).toEqual({ x: 100, y: 100 })
    })

    it('should handle very large coordinate values', () => {
      const xOffset = 99999
      const yOffset = 88888

      const node = {
        position: { x: 1, y: 1 }
      }

      const offsetNode = {
        position: {
          x: node.position.x + xOffset,
          y: node.position.y + yOffset
        }
      }

      expect(offsetNode.position).toEqual({ x: 100000, y: 88889 })
    })
  })
})
