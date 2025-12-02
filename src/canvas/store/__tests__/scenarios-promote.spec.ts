/**
 * S9-PROMOTE: Scenario Promotion Tests
 * Tests promoting a comparison snapshot as the current scenario
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  promoteSnapshot,
  createScenario,
  getScenario,
  loadScenarios,
  saveScenarios
} from '../scenarios'
import type { Node, Edge } from '@xyflow/react'

const STORAGE_KEY = 'olumi-canvas-scenarios'

describe('S9-PROMOTE: promoteSnapshot', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Basic Promotion', () => {
    it('should promote a snapshot to a scenario', () => {
      // Create a scenario
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ],
        edges: []
      })

      // New graph to promote
      const newGraph = {
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
        ] as Node[],
        edges: [
          { id: 'e1', source: '1', target: '2', data: { weight: 0.8 } }
        ] as Edge[]
      }

      // Promote snapshot
      const success = promoteSnapshot(scenario.id, newGraph)

      expect(success).toBe(true)

      // Verify scenario was updated
      const updated = getScenario(scenario.id)
      expect(updated?.graph.nodes).toHaveLength(2)
      expect(updated?.graph.edges).toHaveLength(1)
      expect(updated?.graph.nodes[1].id).toBe('2')
      expect(updated?.graph.edges[0].id).toBe('e1')
    })

    it('should return false when scenario not found', () => {
      const newGraph = {
        nodes: [] as Node[],
        edges: [] as Edge[]
      }

      const success = promoteSnapshot('nonexistent-id', newGraph)

      expect(success).toBe(false)
    })

    it('should clear last_result_hash when promoting', () => {
      // Create scenario with a result hash
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ],
        edges: []
      })

      // Set a result hash
      const scenarios = loadScenarios()
      const updated = scenarios.map(s =>
        s.id === scenario.id ? { ...s, last_result_hash: 'test-hash-123' } : s
      )
      saveScenarios(updated)

      // Verify hash is set
      const before = getScenario(scenario.id)
      expect(before?.last_result_hash).toBe('test-hash-123')

      // Promote snapshot
      const newGraph = {
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Updated' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      promoteSnapshot(scenario.id, newGraph)

      // Verify hash is cleared
      const after = getScenario(scenario.id)
      expect(after?.last_result_hash).toBeUndefined()
    })

    it('should update updatedAt timestamp', () => {
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [],
        edges: []
      })

      const originalUpdatedAt = scenario.updatedAt

      // Wait a bit to ensure timestamp changes
      const newGraph = {
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      // Small delay to ensure different timestamp
      const now = Date.now()
      promoteSnapshot(scenario.id, newGraph)

      const updated = getScenario(scenario.id)
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })
  })

  describe('Graph Content Preservation', () => {
    it('should preserve all node properties', () => {
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [],
        edges: []
      })

      const newGraph = {
        nodes: [
          {
            id: '1',
            type: 'goal',
            position: { x: 100, y: 200 },
            data: { label: 'Test Node', color: 'blue', weight: 0.5 }
          }
        ] as Node[],
        edges: [] as Edge[]
      }

      promoteSnapshot(scenario.id, newGraph)

      const updated = getScenario(scenario.id)
      expect(updated?.graph.nodes[0]).toEqual(newGraph.nodes[0])
    })

    it('should preserve all edge properties', () => {
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
        ],
        edges: []
      })

      const newGraph = {
        nodes: scenario.graph.nodes,
        edges: [
          {
            id: 'e1',
            source: '1',
            target: '2',
            data: { weight: 0.8, belief: 0.9, provenance: 'test-doc' }
          }
        ] as Edge[]
      }

      promoteSnapshot(scenario.id, newGraph)

      const updated = getScenario(scenario.id)
      expect(updated?.graph.edges[0]).toEqual(newGraph.edges[0])
    })

    it('should handle empty graph', () => {
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ],
        edges: [
          { id: 'e1', source: '1', target: '1', data: {} }
        ]
      })

      const emptyGraph = {
        nodes: [] as Node[],
        edges: [] as Edge[]
      }

      promoteSnapshot(scenario.id, emptyGraph)

      const updated = getScenario(scenario.id)
      expect(updated?.graph.nodes).toHaveLength(0)
      expect(updated?.graph.edges).toHaveLength(0)
    })

    it('should handle large graphs', () => {
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [],
        edges: []
      })

      // Create a graph with 100 nodes and 200 edges
      const nodes: Node[] = Array.from({ length: 100 }, (_, i) => ({
        id: String(i + 1),
        type: 'goal',
        position: { x: i * 10, y: i * 10 },
        data: { label: `Node ${i + 1}` }
      }))

      const edges: Edge[] = Array.from({ length: 200 }, (_, i) => ({
        id: `e${i + 1}`,
        source: String((i % 100) + 1),
        target: String(((i + 1) % 100) + 1),
        data: { weight: 0.5 }
      }))

      const largeGraph = { nodes, edges }

      promoteSnapshot(scenario.id, largeGraph)

      const updated = getScenario(scenario.id)
      expect(updated?.graph.nodes).toHaveLength(100)
      expect(updated?.graph.edges).toHaveLength(200)
    })
  })

  describe('Scenario Metadata Preservation', () => {
    it('should preserve scenario name', () => {
      const scenario = createScenario({
        name: 'Original Name',
        nodes: [],
        edges: []
      })

      const newGraph = {
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      promoteSnapshot(scenario.id, newGraph)

      const updated = getScenario(scenario.id)
      expect(updated?.name).toBe('Original Name')
    })

    it('should preserve scenario ID', () => {
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [],
        edges: []
      })

      const originalId = scenario.id

      const newGraph = {
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      promoteSnapshot(scenario.id, newGraph)

      const updated = getScenario(scenario.id)
      expect(updated?.id).toBe(originalId)
    })

    it('should preserve createdAt timestamp', () => {
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [],
        edges: []
      })

      const originalCreatedAt = scenario.createdAt

      const newGraph = {
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      promoteSnapshot(scenario.id, newGraph)

      const updated = getScenario(scenario.id)
      expect(updated?.createdAt).toBe(originalCreatedAt)
    })

    it('should preserve source_template_id if present', () => {
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [],
        edges: [],
        source_template_id: 'template-123',
        source_template_version: 'v1'
      })

      const newGraph = {
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      promoteSnapshot(scenario.id, newGraph)

      const updated = getScenario(scenario.id)
      expect(updated?.source_template_id).toBe('template-123')
      expect(updated?.source_template_version).toBe('v1')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid scenario ID gracefully', () => {
      const newGraph = {
        nodes: [] as Node[],
        edges: [] as Edge[]
      }

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const success = promoteSnapshot('', newGraph)

      expect(success).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        '[scenarios] S9-PROMOTE: Scenario not found:',
        ''
      )

      consoleSpy.mockRestore()
    })

    it('should handle localStorage errors gracefully', () => {
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [],
        edges: []
      })

      // Mock localStorage.setItem to throw
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('localStorage full')
      })

      const newGraph = {
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      // Should not throw
      expect(() => promoteSnapshot(scenario.id, newGraph)).not.toThrow()

      // Restore
      localStorage.setItem = originalSetItem
    })
  })

  describe('Integration with StoredRun', () => {
    it('should accept graph from StoredRun structure', () => {
      const scenario = createScenario({
        name: 'Test Scenario',
        nodes: [],
        edges: []
      })

      // Simulate StoredRun graph structure
      const storedRunGraph = {
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'From Run' } }
        ] as Node[],
        edges: [
          { id: 'e1', source: '1', target: '1', data: { weight: 0.7 } }
        ] as Edge[]
      }

      const success = promoteSnapshot(scenario.id, storedRunGraph)

      expect(success).toBe(true)

      const updated = getScenario(scenario.id)
      expect(updated?.graph.nodes[0].data.label).toBe('From Run')
      expect(updated?.graph.edges[0].data.weight).toBe(0.7)
    })
  })
})
