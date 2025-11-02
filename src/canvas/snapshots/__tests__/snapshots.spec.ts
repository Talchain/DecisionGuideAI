/**
 * Snapshots v2 Tests
 *
 * Tests for snapshot storage with FIFO rotation and sanitization.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveSnapshot,
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
  restoreSnapshot,
  clearAllSnapshots,
  getSnapshotCount,
  isAtMaxCapacity,
} from '../snapshots'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../../domain/edges'

describe('Snapshots v2', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('saveSnapshot', () => {
    it('saves a snapshot with sanitized labels', () => {
      const nodes: Node[] = [
        {
          id: 'n1',
          type: 'decision',
          position: { x: 100, y: 200 },
          data: { label: 'Test <script>alert(1)</script>' },
        },
      ]

      const edges: Edge<EdgeData>[] = []

      const id = saveSnapshot('My Snapshot', nodes, edges)

      expect(id).toBeTruthy()

      const snapshots = listSnapshots()
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].meta.name).toBe('My Snapshot')
      expect(snapshots[0].nodes[0].label).not.toContain('<script>')
    })

    it('stores explicit properties only (no preview/debug)', () => {
      const nodes: Node[] = [
        {
          id: 'n1',
          type: 'decision',
          position: { x: 10, y: 20 },
          data: { label: 'Node 1', extra: 'should not be saved' },
        } as any,
      ]

      const edges: Edge<EdgeData>[] = []

      saveSnapshot('Test', nodes, edges)

      const snapshot = listSnapshots()[0]

      // Should only have id, label, x, y, type
      expect(snapshot.nodes[0]).toEqual({
        id: 'n1',
        label: 'Node 1',
        x: 10,
        y: 20,
        type: 'decision',
      })

      // Should not have extra properties
      expect(snapshot.nodes[0]).not.toHaveProperty('extra')
      expect(snapshot.nodes[0]).not.toHaveProperty('data')
    })

    it('saves metadata (seed, hash)', () => {
      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      saveSnapshot('With Meta', nodes, edges, {
        seed: 42,
        hash: 'abc123',
      })

      const snapshot = listSnapshots()[0]
      expect(snapshot.meta.seed).toBe(42)
      expect(snapshot.meta.hash).toBe('abc123')
    })

    it('rotates oldest snapshot when exceeding max (10)', () => {
      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      // Save 12 snapshots (exceeds max of 10)
      for (let i = 1; i <= 12; i++) {
        saveSnapshot(`Snapshot ${i}`, nodes, edges)
      }

      const snapshots = listSnapshots()
      expect(snapshots).toHaveLength(10)

      // First two should be rotated out (FIFO)
      expect(snapshots[0].meta.name).toBe('Snapshot 3')
      expect(snapshots[9].meta.name).toBe('Snapshot 12')
    })

    it('sanitizes snapshot names', () => {
      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      saveSnapshot('<b>Dangerous</b> Name', nodes, edges)

      const snapshot = listSnapshots()[0]
      expect(snapshot.meta.name).not.toContain('<b>')
      expect(snapshot.meta.name).not.toContain('</b>')
    })
  })

  describe('listSnapshots', () => {
    it('returns empty array when no snapshots', () => {
      const snapshots = listSnapshots()
      expect(snapshots).toEqual([])
    })

    it('returns all snapshots in order', () => {
      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      saveSnapshot('First', nodes, edges)
      saveSnapshot('Second', nodes, edges)
      saveSnapshot('Third', nodes, edges)

      const snapshots = listSnapshots()
      expect(snapshots).toHaveLength(3)
      expect(snapshots[0].meta.name).toBe('First')
      expect(snapshots[1].meta.name).toBe('Second')
      expect(snapshots[2].meta.name).toBe('Third')
    })
  })

  describe('getSnapshot', () => {
    it('retrieves snapshot by ID', () => {
      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      const id = saveSnapshot('Test', nodes, edges)
      const snapshot = getSnapshot(id)

      expect(snapshot).toBeTruthy()
      expect(snapshot?.meta.id).toBe(id)
      expect(snapshot?.meta.name).toBe('Test')
    })

    it('returns null for non-existent ID', () => {
      const snapshot = getSnapshot('nonexistent')
      expect(snapshot).toBeNull()
    })
  })

  describe('deleteSnapshot', () => {
    it('deletes snapshot by ID', () => {
      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      const id = saveSnapshot('To Delete', nodes, edges)
      expect(listSnapshots()).toHaveLength(1)

      const deleted = deleteSnapshot(id)
      expect(deleted).toBe(true)
      expect(listSnapshots()).toHaveLength(0)
    })

    it('returns false for non-existent ID', () => {
      const deleted = deleteSnapshot('nonexistent')
      expect(deleted).toBe(false)
    })

    it('does not affect other snapshots', () => {
      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      const id1 = saveSnapshot('Keep 1', nodes, edges)
      const id2 = saveSnapshot('Delete', nodes, edges)
      const id3 = saveSnapshot('Keep 2', nodes, edges)

      deleteSnapshot(id2)

      const snapshots = listSnapshots()
      expect(snapshots).toHaveLength(2)
      expect(snapshots[0].meta.id).toBe(id1)
      expect(snapshots[1].meta.id).toBe(id3)
    })
  })

  describe('restoreSnapshot', () => {
    it('restores nodes and edges from snapshot', () => {
      const nodes: Node[] = [
        {
          id: 'n1',
          type: 'decision',
          position: { x: 100, y: 200 },
          data: { label: 'Node 1' },
        },
      ]

      const edges: Edge<EdgeData>[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          data: { label: 'causes', weight: 0.8 },
        },
      ]

      const id = saveSnapshot('Test Restore', nodes, edges)
      const restored = restoreSnapshot(id)

      expect(restored).toBeTruthy()
      expect(restored?.nodes).toHaveLength(1)
      expect(restored?.nodes[0].id).toBe('n1')
      expect(restored?.nodes[0].position).toEqual({ x: 100, y: 200 })
      expect(restored?.nodes[0].data.label).toBe('Node 1')

      expect(restored?.edges).toHaveLength(1)
      expect(restored?.edges[0].source).toBe('n1')
      expect(restored?.edges[0].target).toBe('n2')
      expect(restored?.edges[0].data.label).toBe('causes')
    })

    it('returns null for non-existent snapshot', () => {
      const restored = restoreSnapshot('nonexistent')
      expect(restored).toBeNull()
    })
  })

  describe('clearAllSnapshots', () => {
    it('removes all snapshots', () => {
      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      saveSnapshot('Snap 1', nodes, edges)
      saveSnapshot('Snap 2', nodes, edges)
      saveSnapshot('Snap 3', nodes, edges)

      expect(listSnapshots()).toHaveLength(3)

      clearAllSnapshots()

      expect(listSnapshots()).toHaveLength(0)
    })
  })

  describe('getSnapshotCount', () => {
    it('returns correct count', () => {
      expect(getSnapshotCount()).toBe(0)

      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      saveSnapshot('Snap 1', nodes, edges)
      expect(getSnapshotCount()).toBe(1)

      saveSnapshot('Snap 2', nodes, edges)
      expect(getSnapshotCount()).toBe(2)
    })
  })

  describe('isAtMaxCapacity', () => {
    it('returns false when below max', () => {
      expect(isAtMaxCapacity()).toBe(false)

      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      saveSnapshot('Snap 1', nodes, edges)
      expect(isAtMaxCapacity()).toBe(false)
    })

    it('returns true when at max (10)', () => {
      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      for (let i = 1; i <= 10; i++) {
        saveSnapshot(`Snap ${i}`, nodes, edges)
      }

      expect(isAtMaxCapacity()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty nodes/edges arrays', () => {
      const id = saveSnapshot('Empty', [], [])
      const snapshot = getSnapshot(id)

      expect(snapshot?.nodes).toEqual([])
      expect(snapshot?.edges).toEqual([])
    })

    it('handles malformed localStorage data gracefully', () => {
      localStorage.setItem('canvas-snapshots-v2', 'not valid json')

      const snapshots = listSnapshots()
      expect(snapshots).toEqual([])
    })

    it('handles non-array localStorage data', () => {
      localStorage.setItem('canvas-snapshots-v2', JSON.stringify({ not: 'array' }))

      const snapshots = listSnapshots()
      expect(snapshots).toEqual([])
    })

    it('preserves snapshot order after delete and save', () => {
      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      const id1 = saveSnapshot('Snap 1', nodes, edges)
      saveSnapshot('Snap 2', nodes, edges)
      const id3 = saveSnapshot('Snap 3', nodes, edges)

      deleteSnapshot(id1)
      saveSnapshot('Snap 4', nodes, edges)

      const snapshots = listSnapshots()
      expect(snapshots).toHaveLength(3)
      expect(snapshots[0].meta.name).toBe('Snap 2')
      expect(snapshots[1].meta.name).toBe('Snap 3')
      expect(snapshots[2].meta.name).toBe('Snap 4')
    })
  })

  describe('Performance', () => {
    it('saves and loads 10 snapshots in <50ms', () => {
      const nodes: Node[] = Array.from({ length: 10 }, (_, i) => ({
        id: `n${i}`,
        type: 'decision',
        position: { x: i * 100, y: i * 100 },
        data: { label: `Node ${i}` },
      }))

      const edges: Edge<EdgeData>[] = []

      const start = performance.now()

      for (let i = 0; i < 10; i++) {
        saveSnapshot(`Snapshot ${i}`, nodes, edges)
      }

      listSnapshots()

      const duration = performance.now() - start

      expect(duration).toBeLessThan(50)
    })
  })
})
