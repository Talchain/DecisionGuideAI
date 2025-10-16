import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveState, loadState, saveSnapshot, listSnapshots, importCanvas, exportCanvas } from '../persist'
import type { Node, Edge } from '@xyflow/react'

describe('Canvas Persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const mockNodes: Node[] = [
    { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Test' } }
  ]

  const mockEdges: Edge[] = [
    { id: 'e1', source: '1', target: '2' }
  ]

  describe('saveState and loadState', () => {
    it('saves and loads state with versioning', () => {
      const result = saveState({ nodes: mockNodes, edges: mockEdges })
      expect(result).toBe(true)

      const loaded = loadState()
      expect(loaded).not.toBeNull()
      expect(loaded?.nodes).toHaveLength(1)
      expect(loaded?.edges).toHaveLength(1)
      expect(loaded?.version).toBe(1)
      expect(loaded?.timestamp).toBeGreaterThan(0)
    })

    it('sanitizes HTML in labels', () => {
      const maliciousNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: '<script>alert("xss")</script>Test' } }
      ]

      saveState({ nodes: maliciousNodes, edges: [] })
      const loaded = loadState()

      expect(loaded?.nodes[0].data.label).not.toContain('<script>')
      expect(loaded?.nodes[0].data.label).toContain('Test')
    })

    it('enforces max label length', () => {
      const longLabel = 'a'.repeat(200)
      const nodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: longLabel } }
      ]

      saveState({ nodes, edges: [] })
      const loaded = loadState()

      expect(loaded?.nodes[0].data.label).toHaveLength(100)
    })

    it('handles quota exceeded error', () => {
      // Mock localStorage.setItem to throw quota error
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => {
        const error = new DOMException('Quota exceeded', 'QuotaExceededError')
        throw error
      })

      const result = saveState({ nodes: mockNodes, edges: mockEdges })
      expect(result).toBe(false)

      Storage.prototype.setItem = originalSetItem
    })

    it('returns null for invalid state', () => {
      localStorage.setItem('canvas-storage', 'invalid json')
      const loaded = loadState()
      expect(loaded).toBeNull()
    })
  })

  describe('snapshot management', () => {
    it('saves and lists snapshots', () => {
      saveSnapshot({ nodes: mockNodes, edges: mockEdges })
      
      const snapshots = listSnapshots()
      expect(snapshots.length).toBeGreaterThan(0)
      expect(snapshots[0].timestamp).toBeGreaterThan(0)
      expect(snapshots[0].size).toBeGreaterThan(0)
    })

    it('rotates old snapshots (keeps max 10)', async () => {
      // Save 12 snapshots with minimal delay for unique timestamps
      for (let i = 0; i < 12; i++) {
        saveSnapshot({ nodes: mockNodes, edges: mockEdges })
        // Wait 1ms to ensure unique timestamps (Date.now() granularity)
        await new Promise(resolve => setTimeout(resolve, 2))
      }

      const snapshots = listSnapshots()
      expect(snapshots.length).toBeLessThanOrEqual(10)
    })
  })

  describe('import and export', () => {
    it('exports canvas to JSON', () => {
      const json = exportCanvas({ nodes: mockNodes, edges: mockEdges })
      const parsed = JSON.parse(json)

      expect(parsed.version).toBe(1)
      expect(parsed.nodes).toHaveLength(1)
      expect(parsed.edges).toHaveLength(1)
    })

    it('imports valid JSON', () => {
      const json = exportCanvas({ nodes: mockNodes, edges: mockEdges })
      const imported = importCanvas(json)

      expect(imported).not.toBeNull()
      expect(imported?.nodes).toHaveLength(1)
      expect(imported?.edges).toHaveLength(1)
    })

    it('rejects malformed JSON', () => {
      const imported = importCanvas('invalid json')
      expect(imported).toBeNull()
    })

    it('rejects JSON missing required fields', () => {
      const invalidJson = JSON.stringify({ nodes: [] }) // missing edges
      const imported = importCanvas(invalidJson)
      expect(imported).toBeNull()
    })

    it('rejects nodes with invalid structure', () => {
      const invalidJson = JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        nodes: [{ id: '1' }], // missing position
        edges: []
      })
      const imported = importCanvas(invalidJson)
      expect(imported).toBeNull()
    })

    it('rejects edges with invalid structure', () => {
      const invalidJson = JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        nodes: mockNodes,
        edges: [{ id: 'e1' }] // missing source/target
      })
      const imported = importCanvas(invalidJson)
      expect(imported).toBeNull()
    })

    it('sanitizes imported labels', () => {
      const maliciousJson = JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        nodes: [
          { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: '<img onerror="alert(1)">' } }
        ],
        edges: []
      })

      const imported = importCanvas(maliciousJson)
      expect(imported).not.toBeNull()
      expect(imported?.nodes[0].data.label).not.toContain('<img')
      expect(imported?.nodes[0].data.label).not.toContain('onerror')
    })
  })
})
