import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveState, loadState, saveSnapshot, listSnapshots, importCanvas, exportCanvas } from '../persist'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'

describe('Canvas Persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const mockNodes: Node[] = [
    { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Test', type: 'decision' } }
  ]

  const mockEdges: Edge<EdgeData>[] = [
    { id: 'e1', source: '1', target: '2', data: { weight: 1, style: 'solid', curvature: 0.15, schemaVersion: 2 } }
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

    it('excludes preview state from persistence (H3 security)', () => {
      // Simulate preview mode state with staged changes
      const stateWithPreview = {
        nodes: mockNodes,
        edges: mockEdges,
        // Preview state that should NOT be persisted
        preview: {
          active: true,
          status: 'complete',
          stagedNodes: new Map([['1', { data: { label: 'Staged Change' } }]]),
          stagedEdges: new Map(),
          previewReport: { /* mock report */ },
          previewSeed: 99999,
          previewHash: 'preview-hash-should-not-persist'
        }
      } as any

      // Save state (should only persist nodes and edges)
      saveState(stateWithPreview)

      // Load state and verify preview is excluded
      const loaded = loadState()
      expect(loaded).not.toBeNull()
      expect(loaded?.nodes).toHaveLength(1)
      expect(loaded?.edges).toHaveLength(1)

      // Verify preview state is NOT in persisted data
      expect(loaded).not.toHaveProperty('preview')
      expect(loaded).not.toHaveProperty('previewReport')
      expect(loaded).not.toHaveProperty('previewSeed')
      expect(loaded).not.toHaveProperty('previewHash')
      expect(loaded).not.toHaveProperty('stagedNodes')
      expect(loaded).not.toHaveProperty('stagedEdges')

      // Verify localStorage doesn't contain preview state
      const raw = localStorage.getItem('canvas-storage')
      expect(raw).not.toBeNull()
      expect(raw).not.toContain('preview')
      expect(raw).not.toContain('stagedNodes')
      expect(raw).not.toContain('previewReport')
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

    it('excludes preview state from snapshots (H3 security)', () => {
      // Simulate preview mode state with staged changes
      const stateWithPreview = {
        nodes: mockNodes,
        edges: mockEdges,
        // Preview state that should NOT be persisted
        preview: {
          active: true,
          status: 'complete',
          stagedNodes: new Map([['1', { data: { label: 'Staged Snapshot' } }]]),
          stagedEdges: new Map(),
          previewReport: { schema: 'report.v1' },
          previewSeed: 88888,
          previewHash: 'snapshot-preview-hash-excluded'
        }
      } as any

      // Save snapshot (should only persist nodes and edges)
      const saved = saveSnapshot(stateWithPreview)
      expect(saved).toBe(true)

      // Get the saved snapshot
      const snapshots = listSnapshots()
      expect(snapshots.length).toBeGreaterThan(0)

      // Get the most recent snapshot
      const latestSnapshot = snapshots[0]
      const snapshotKey = `canvas-snapshot-${latestSnapshot.timestamp}`
      const raw = localStorage.getItem(snapshotKey)
      expect(raw).not.toBeNull()

      // Parse and verify structure
      const parsed = JSON.parse(raw!)
      expect(parsed.nodes).toHaveLength(1)
      expect(parsed.edges).toHaveLength(1)

      // Verify preview state is NOT in snapshot
      expect(parsed).not.toHaveProperty('preview')
      expect(parsed).not.toHaveProperty('previewReport')
      expect(parsed).not.toHaveProperty('previewSeed')
      expect(parsed).not.toHaveProperty('previewHash')
      expect(parsed).not.toHaveProperty('stagedNodes')
      expect(parsed).not.toHaveProperty('stagedEdges')

      // Verify raw JSON doesn't contain preview keywords
      expect(raw).not.toContain('preview')
      expect(raw).not.toContain('stagedNodes')
      expect(raw).not.toContain('88888') // preview seed
    })
  })

  describe('import and export', () => {
    it('exports canvas to JSON', () => {
      const json = exportCanvas({ nodes: mockNodes, edges: mockEdges })
      const parsed = JSON.parse(json)

      expect(parsed.version).toBe(2) // Now exports v2 via migration API
      expect(parsed.nodes).toHaveLength(1)
      expect(parsed.edges).toHaveLength(1)
    })

    it('imports valid JSON', () => {
      // Create a proper v2 snapshot manually for testing
      const v2Snapshot = {
        version: 2,
        timestamp: Date.now(),
        nodes: mockNodes,
        edges: mockEdges
      }
      const json = JSON.stringify(v2Snapshot)
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

    it('blocks prototype pollution during import (sanitizeJSON)', () => {
      // Malicious JSON with __proto__ pollution attempt
      const pollutionJson = JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        __proto__: { isAdmin: true },
        constructor: { prototype: { polluted: 'yes' } },
        nodes: [
          {
            id: '1',
            type: 'decision',
            position: { x: 0, y: 0 },
            data: {
              label: 'Test',
              __proto__: { evil: true }
            }
          }
        ],
        edges: []
      })

      const imported = importCanvas(pollutionJson)
      expect(imported).not.toBeNull()

      // Verify prototype pollution was blocked
      expect(imported).not.toHaveProperty('__proto__')
      expect(imported).not.toHaveProperty('constructor')
      expect(imported?.nodes[0].data).not.toHaveProperty('__proto__')

      // Verify valid data still imported correctly
      expect(imported?.nodes).toHaveLength(1)
      expect(imported?.nodes[0].id).toBe('1')
      expect(imported?.nodes[0].data.label).toBe('Test')
    })
  })
})
