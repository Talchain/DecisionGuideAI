/**
 * S2-IMPORT: DOM Integration Tests for Scenario Import with ID Reseeding
 * Tests import validation, ID collision avoidance, and current canvas integration
 * Uses Vitest for store-level integration testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  importScenarioFromFile,
  createScenario,
  loadScenarios,
  saveScenarios,
  clearAutosave
} from '../scenarios'
import type { Node, Edge } from '@xyflow/react'

describe('S2-IMPORT: Scenario Import with ID Reseeding', () => {
  // Clean up localStorage before/after each test
  beforeEach(() => {
    localStorage.clear()
    clearAutosave()
  })

  afterEach(() => {
    localStorage.clear()
    clearAutosave()
  })

  describe('Valid Import Format', () => {
    it('should import valid scenario file', () => {
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: {
          name: 'Test Import',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        graph: {
          nodes: [
            { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
          ],
          edges: []
        }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)
      expect(result.scenario).toBeDefined()
      expect(result.scenario?.name).toBe('Test Import')
      expect(result.scenario?.graph.nodes.length).toBe(1)
    })

    it('should preserve node data during import', () => {
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Data Test' },
        graph: {
          nodes: [
            {
              id: '1',
              type: 'decision',
              position: { x: 100, y: 200 },
              data: {
                label: 'Important Decision',
                description: 'This is critical',
                metadata: { foo: 'bar' }
              }
            }
          ],
          edges: []
        }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)
      const node = result.scenario?.graph.nodes[0]
      expect(node?.data.label).toBe('Important Decision')
      expect(node?.data.description).toBe('This is critical')
      expect(node?.data.metadata).toEqual({ foo: 'bar' })
      expect(node?.position).toEqual({ x: 100, y: 200 })
    })

    it('should preserve edge data during import', () => {
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Edge Test' },
        graph: {
          nodes: [
            { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } },
            { id: '2', type: 'outcome', position: { x: 200, y: 0 }, data: { label: 'B' } }
          ],
          edges: [
            {
              id: 'e1',
              source: '1',
              target: '2',
              data: {
                weight: 0.75,
                belief: 0.9,
                label: 'Strong Link'
              }
            }
          ]
        }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)
      const edge = result.scenario?.graph.edges[0]
      expect(edge?.data.weight).toBe(0.75)
      expect(edge?.data.belief).toBe(0.9)
      expect(edge?.data.label).toBe('Strong Link')
    })
  })

  describe('Invalid Format Rejection', () => {
    it('should reject invalid format version', () => {
      const fileContent = JSON.stringify({
        format: 'invalid-format-v2',
        scenario: { name: 'Test' },
        graph: { nodes: [], edges: [] }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported format')
    })

    it('should reject missing scenario data', () => {
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        graph: { nodes: [], edges: [] }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('missing scenario')
    })

    it('should reject missing graph data', () => {
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        scenario: { name: 'Test' }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('missing')
    })

    it('should reject invalid nodes array', () => {
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        scenario: { name: 'Test' },
        graph: { nodes: 'not-an-array', edges: [] }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('nodes and edges arrays')
    })

    it('should reject invalid JSON', () => {
      const fileContent = 'not valid JSON {{'

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('ID Reseeding from Saved Scenarios', () => {
    it('should reseed node IDs to avoid conflicts with saved scenarios', () => {
      // Create existing scenario with nodes 1, 2
      createScenario({
        name: 'Existing',
        nodes: [
          { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'N1' } },
          { id: '2', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'N2' } }
        ],
        edges: []
      })

      // Import scenario with nodes 1, 2 (should conflict)
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Import' },
        graph: {
          nodes: [
            { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } },
            { id: '2', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'B' } }
          ],
          edges: []
        }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)

      // IDs should be reseeded (3, 4) not (1, 2)
      const nodeIds = result.scenario?.graph.nodes.map(n => n.id) || []
      expect(nodeIds).not.toContain('1')
      expect(nodeIds).not.toContain('2')
      expect(nodeIds).toEqual(['3', '4'])
    })

    it('should reseed edge IDs to avoid conflicts', () => {
      // Create existing scenario with edge e1
      createScenario({
        name: 'Existing',
        nodes: [
          { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'N1' } },
          { id: '2', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'N2' } }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2', data: {} }
        ]
      })

      // Import scenario with edge e1 (should conflict)
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Import' },
        graph: {
          nodes: [
            { id: '10', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } },
            { id: '20', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'B' } }
          ],
          edges: [
            { id: 'e1', source: '10', target: '20', data: {} }
          ]
        }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)

      // Edge ID should be reseeded (e2) not (e1)
      const edgeIds = result.scenario?.graph.edges.map(e => e.id) || []
      expect(edgeIds).not.toContain('e1')
      expect(edgeIds).toContain('e2')
    })

    it('should maintain edge source/target references after reseeding', () => {
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Import' },
        graph: {
          nodes: [
            { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } },
            { id: '2', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'B' } }
          ],
          edges: [
            { id: 'e1', source: '1', target: '2', data: {} }
          ]
        }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)

      const nodes = result.scenario?.graph.nodes || []
      const edges = result.scenario?.graph.edges || []

      const nodeIds = nodes.map(n => n.id)
      const edge = edges[0]

      // Edge source/target should reference new node IDs
      expect(nodeIds).toContain(edge.source)
      expect(nodeIds).toContain(edge.target)
    })
  })

  describe('ID Reseeding from Current Canvas', () => {
    it('should reseed IDs to avoid conflicts with current canvas nodes', () => {
      // Simulate current canvas with nodes 1, 2
      const currentCanvasNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Current' } },
        { id: '2', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Current' } }
      ]

      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Import' },
        graph: {
          nodes: [
            { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Import' } }
          ],
          edges: []
        }
      })

      const result = importScenarioFromFile(fileContent, currentCanvasNodes, [])

      expect(result.success).toBe(true)

      // IDs should be reseeded (3) not (1)
      const nodeIds = result.scenario?.graph.nodes.map(n => n.id) || []
      expect(nodeIds).not.toContain('1')
      expect(nodeIds).toEqual(['3'])
    })

    it('should check both saved scenarios AND current canvas for conflicts', () => {
      // Saved scenario with node 1
      createScenario({
        name: 'Saved',
        nodes: [
          { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Saved' } }
        ],
        edges: []
      })

      // Current canvas with node 2
      const currentCanvasNodes: Node[] = [
        { id: '2', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Current' } }
      ]

      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Import' },
        graph: {
          nodes: [
            { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Import' } }
          ],
          edges: []
        }
      })

      const result = importScenarioFromFile(fileContent, currentCanvasNodes, [])

      expect(result.success).toBe(true)

      // IDs should be reseeded (3) not (1 or 2)
      const nodeIds = result.scenario?.graph.nodes.map(n => n.id) || []
      expect(nodeIds).toEqual(['3'])
    })

    it('should reseed edge IDs to avoid current canvas conflicts', () => {
      // Current canvas with edge e1
      const currentCanvasNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } },
        { id: '2', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'B' } }
      ]
      const currentCanvasEdges: Edge[] = [
        { id: 'e1', source: '1', target: '2', data: {} }
      ]

      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Import' },
        graph: {
          nodes: [
            { id: '10', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'C' } },
            { id: '20', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'D' } }
          ],
          edges: [
            { id: 'e1', source: '10', target: '20', data: {} }
          ]
        }
      })

      const result = importScenarioFromFile(fileContent, currentCanvasNodes, currentCanvasEdges)

      expect(result.success).toBe(true)

      // Edge ID should be reseeded (e2) not (e1)
      const edgeIds = result.scenario?.graph.edges.map(e => e.id) || []
      expect(edgeIds).not.toContain('e1')
      expect(edgeIds).toContain('e2')
    })
  })

  describe('Complex Import Scenarios', () => {
    it('should handle large graph import with many nodes', () => {
      const nodes = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        type: 'decision' as const,
        position: { x: i * 100, y: 0 },
        data: { label: `Node ${i + 1}` }
      }))

      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Large Import' },
        graph: { nodes, edges: [] }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)
      expect(result.scenario?.graph.nodes.length).toBe(50)

      // All IDs should be numeric and unique
      const nodeIds = result.scenario?.graph.nodes.map(n => n.id) || []
      const uniqueIds = new Set(nodeIds)
      expect(uniqueIds.size).toBe(50)
    })

    it('should handle complex graph with many edges', () => {
      const nodes = [
        { id: '1', type: 'decision' as const, position: { x: 0, y: 0 }, data: { label: 'A' } },
        { id: '2', type: 'outcome' as const, position: { x: 200, y: 0 }, data: { label: 'B' } },
        { id: '3', type: 'option' as const, position: { x: 400, y: 0 }, data: { label: 'C' } }
      ]

      const edges = [
        { id: 'e1', source: '1', target: '2', data: {} },
        { id: 'e2', source: '2', target: '3', data: {} },
        { id: 'e3', source: '1', target: '3', data: {} }
      ]

      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Complex Graph' },
        graph: { nodes, edges }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)
      expect(result.scenario?.graph.edges.length).toBe(3)

      // All edges should reference valid nodes
      const resultNodes = result.scenario?.graph.nodes || []
      const resultEdges = result.scenario?.graph.edges || []
      const nodeIds = resultNodes.map(n => n.id)

      resultEdges.forEach(edge => {
        expect(nodeIds).toContain(edge.source)
        expect(nodeIds).toContain(edge.target)
      })
    })

    it('should preserve template metadata during import', () => {
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: {
          name: 'Template-based',
          source_template_id: 'template-123',
          source_template_version: '1.0.0'
        },
        graph: {
          nodes: [
            { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node' } }
          ],
          edges: []
        }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)
      expect(result.scenario?.source_template_id).toBe('template-123')
      expect(result.scenario?.source_template_version).toBe('1.0.0')
    })

    it('should handle import with no edges', () => {
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'No Edges' },
        graph: {
          nodes: [
            { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Isolated' } }
          ],
          edges: []
        }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)
      expect(result.scenario?.graph.nodes.length).toBe(1)
      expect(result.scenario?.graph.edges.length).toBe(0)
    })

    it('should handle import with no nodes', () => {
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Empty Graph' },
        graph: {
          nodes: [],
          edges: []
        }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)
      expect(result.scenario?.graph.nodes.length).toBe(0)
      expect(result.scenario?.graph.edges.length).toBe(0)
    })
  })

  describe('Persistence Integration', () => {
    it('should save imported scenario to localStorage', () => {
      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date().toISOString(),
        scenario: { name: 'Persistent Import' },
        graph: {
          nodes: [
            { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node' } }
          ],
          edges: []
        }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)

      // Check that scenario was saved to localStorage
      const savedScenarios = loadScenarios()
      expect(savedScenarios.length).toBe(1)
      expect(savedScenarios[0].name).toBe('Persistent Import')
    })

    it('should generate new ID and timestamps for imported scenario', () => {
      const oldTimestamp = Date.now() - 10000

      const fileContent = JSON.stringify({
        format: 'olumi-scenario-v1',
        exportedAt: new Date(oldTimestamp).toISOString(),
        scenario: {
          id: 'old-id-123',
          name: 'Old Import',
          createdAt: oldTimestamp,
          updatedAt: oldTimestamp
        },
        graph: {
          nodes: [],
          edges: []
        }
      })

      const result = importScenarioFromFile(fileContent)

      expect(result.success).toBe(true)
      expect(result.scenario?.id).not.toBe('old-id-123')
      expect(result.scenario?.createdAt).toBeGreaterThan(oldTimestamp)
      expect(result.scenario?.updatedAt).toBeGreaterThan(oldTimestamp)
    })
  })
})
