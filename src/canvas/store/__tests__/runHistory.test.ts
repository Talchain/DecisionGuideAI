/**
 * Run History Tests
 * Tests localStorage persistence, pruning, comparison logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadRuns,
  saveRuns,
  addRun,
  togglePin,
  deleteRun,
  getRun,
  compareRuns,
  generateGraphHash,
  type StoredRun
} from '../runHistory'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    clear: () => {
      store = {}
    }
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
})

describe('runHistory', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('generateGraphHash', () => {
    it('should generate consistent hash for same inputs', () => {
      const nodes = [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } }]
      const edges = [{ id: 'e1', source: '1', target: '2' }]
      const seed = 1337

      const hash1 = generateGraphHash(nodes, edges, seed)
      const hash2 = generateGraphHash(nodes, edges, seed)

      expect(hash1).toBe(hash2)
    })

    it('should generate different hash for different inputs', () => {
      const nodes1 = [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } }]
      const nodes2 = [{ id: '2', position: { x: 0, y: 0 }, data: { label: 'B' } }]
      const edges = [{ id: 'e1', source: '1', target: '2' }]

      const hash1 = generateGraphHash(nodes1, edges, 1337)
      const hash2 = generateGraphHash(nodes2, edges, 1337)

      expect(hash1).not.toBe(hash2)
    })

    it('should generate different hash for different seeds', () => {
      const nodes = [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } }]
      const edges = [{ id: 'e1', source: '1', target: '2' }]

      const hash1 = generateGraphHash(nodes, edges, 1337)
      const hash2 = generateGraphHash(nodes, edges, 9999)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('loadRuns / saveRuns', () => {
    it('should return empty array when no runs stored', () => {
      const runs = loadRuns()
      expect(runs).toEqual([])
    })

    it('should save and load runs', () => {
      const mockRun: StoredRun = {
        id: '1',
        ts: Date.now(),
        seed: 1337,
        hash: 'abc123',
        adapter: 'auto',
        summary: 'Test summary',
        graphHash: 'hash1',
        report: {
          summary: 'Test summary',
          recommendation: 'Test rec',
          confidence: 85,
          timestamp: Date.now()
        }
      }

      saveRuns([mockRun])
      const loaded = loadRuns()

      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('1')
      expect(loaded[0].summary).toBe('Test summary')
    })

    it('should sort runs by timestamp (latest first)', () => {
      const runs: StoredRun[] = [
        {
          id: '1',
          ts: 1000,
          seed: 1,
          adapter: 'auto',
          summary: 'Old',
          graphHash: 'h1',
          report: { summary: 'Old', recommendation: '', confidence: 80, timestamp: 1000 }
        },
        {
          id: '2',
          ts: 3000,
          seed: 2,
          adapter: 'auto',
          summary: 'New',
          graphHash: 'h2',
          report: { summary: 'New', recommendation: '', confidence: 80, timestamp: 3000 }
        },
        {
          id: '3',
          ts: 2000,
          seed: 3,
          adapter: 'auto',
          summary: 'Mid',
          graphHash: 'h3',
          report: { summary: 'Mid', recommendation: '', confidence: 80, timestamp: 2000 }
        }
      ]

      saveRuns(runs)
      const loaded = loadRuns()

      expect(loaded[0].id).toBe('2') // Newest
      expect(loaded[1].id).toBe('3') // Middle
      expect(loaded[2].id).toBe('1') // Oldest
    })

    it('should prune to MAX_RUNS (20)', () => {
      const runs: StoredRun[] = Array.from({ length: 25 }, (_, i) => ({
        id: String(i),
        ts: Date.now() + i,
        seed: i,
        adapter: 'auto' as const,
        summary: `Run ${i}`,
        graphHash: `hash${i}`,
        report: { summary: `Run ${i}`, recommendation: '', confidence: 80, timestamp: Date.now() }
      }))

      saveRuns(runs)
      const loaded = loadRuns()

      expect(loaded).toHaveLength(20)
    })

    it('should preserve pinned runs even if beyond MAX_RUNS', () => {
      const runs: StoredRun[] = Array.from({ length: 25 }, (_, i) => ({
        id: String(i),
        ts: Date.now() + i,
        seed: i,
        adapter: 'auto' as const,
        summary: `Run ${i}`,
        graphHash: `hash${i}`,
        report: { summary: `Run ${i}`, recommendation: '', confidence: 80, timestamp: Date.now() },
        isPinned: i === 0 // Pin the oldest
      }))

      saveRuns(runs)
      const loaded = loadRuns()

      expect(loaded).toHaveLength(20)
      expect(loaded.some(r => r.id === '0' && r.isPinned)).toBe(true)
    })
  })

  describe('addRun', () => {
    it('should add run to front of list', () => {
      const run1: StoredRun = {
        id: '1',
        ts: 1000,
        seed: 1,
        adapter: 'auto',
        summary: 'Run 1',
        graphHash: 'h1',
        report: { summary: 'Run 1', recommendation: '', confidence: 80, timestamp: 1000 }
      }

      const run2: StoredRun = {
        id: '2',
        ts: 2000,
        seed: 2,
        adapter: 'auto',
        summary: 'Run 2',
        graphHash: 'h2',
        report: { summary: 'Run 2', recommendation: '', confidence: 80, timestamp: 2000 }
      }

      addRun(run1)
      addRun(run2)

      const loaded = loadRuns()
      expect(loaded[0].id).toBe('2') // Latest first
      expect(loaded[1].id).toBe('1')
    })
  })

  describe('togglePin', () => {
    it('should toggle pin status', () => {
      const run: StoredRun = {
        id: '1',
        ts: Date.now(),
        seed: 1,
        adapter: 'auto',
        summary: 'Test',
        graphHash: 'h1',
        report: { summary: 'Test', recommendation: '', confidence: 80, timestamp: Date.now() }
      }

      addRun(run)
      togglePin('1')

      const loaded = loadRuns()
      expect(loaded[0].isPinned).toBe(true)

      togglePin('1')
      const loaded2 = loadRuns()
      expect(loaded2[0].isPinned).toBe(false)
    })

    it('should do nothing if run not found', () => {
      togglePin('nonexistent')
      const loaded = loadRuns()
      expect(loaded).toEqual([])
    })
  })

  describe('deleteRun', () => {
    it('should delete run by ID', () => {
      const run1: StoredRun = {
        id: '1',
        ts: Date.now(),
        seed: 1,
        adapter: 'auto',
        summary: 'Run 1',
        graphHash: 'h1',
        report: { summary: 'Run 1', recommendation: '', confidence: 80, timestamp: Date.now() }
      }

      const run2: StoredRun = {
        id: '2',
        ts: Date.now(),
        seed: 2,
        adapter: 'auto',
        summary: 'Run 2',
        graphHash: 'h2',
        report: { summary: 'Run 2', recommendation: '', confidence: 80, timestamp: Date.now() }
      }

      addRun(run1)
      addRun(run2)

      deleteRun('1')

      const loaded = loadRuns()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('2')
    })
  })

  describe('getRun', () => {
    it('should return run by ID', () => {
      const run: StoredRun = {
        id: '1',
        ts: Date.now(),
        seed: 1337,
        adapter: 'auto',
        summary: 'Test run',
        graphHash: 'h1',
        report: { summary: 'Test run', recommendation: '', confidence: 80, timestamp: Date.now() }
      }

      addRun(run)

      const found = getRun('1')
      expect(found).toBeDefined()
      expect(found?.summary).toBe('Test run')
    })

    it('should return undefined if not found', () => {
      const found = getRun('nonexistent')
      expect(found).toBeUndefined()
    })
  })

  describe('compareRuns', () => {
    it('should return null if runs not found', () => {
      const comparison = compareRuns('1', '2')
      expect(comparison).toBeNull()
    })

    it('should detect summary changes', () => {
      const runA: StoredRun = {
        id: '1',
        ts: Date.now(),
        seed: 1,
        adapter: 'auto',
        summary: 'Summary A',
        graphHash: 'h1',
        report: { summary: 'Summary A', recommendation: '', confidence: 80, timestamp: Date.now() }
      }

      const runB: StoredRun = {
        id: '2',
        ts: Date.now(),
        seed: 2,
        adapter: 'auto',
        summary: 'Summary B',
        graphHash: 'h2',
        report: { summary: 'Summary B', recommendation: '', confidence: 80, timestamp: Date.now() }
      }

      addRun(runA)
      addRun(runB)

      const comparison = compareRuns('1', '2')
      expect(comparison).not.toBeNull()
      expect(comparison?.summaryChanged).toBe(true)
    })

    it('should compute driver deltas (added/removed/common)', () => {
      const runA: StoredRun = {
        id: '1',
        ts: Date.now(),
        seed: 1,
        adapter: 'auto',
        summary: 'A',
        graphHash: 'h1',
        report: { summary: 'A', recommendation: '', confidence: 80, timestamp: Date.now() },
        drivers: [
          { kind: 'node', id: 'n1', label: 'Node 1' },
          { kind: 'node', id: 'n2', label: 'Node 2' }
        ]
      }

      const runB: StoredRun = {
        id: '2',
        ts: Date.now(),
        seed: 2,
        adapter: 'auto',
        summary: 'B',
        graphHash: 'h2',
        report: { summary: 'B', recommendation: '', confidence: 80, timestamp: Date.now() },
        drivers: [
          { kind: 'node', id: 'n2', label: 'Node 2' },
          { kind: 'node', id: 'n3', label: 'Node 3' }
        ]
      }

      addRun(runA)
      addRun(runB)

      const comparison = compareRuns('1', '2')
      expect(comparison).not.toBeNull()
      expect(comparison?.driversAdded).toHaveLength(1)
      expect(comparison?.driversAdded[0].id).toBe('n3')
      expect(comparison?.driversRemoved).toHaveLength(1)
      expect(comparison?.driversRemoved[0].id).toBe('n1')
      expect(comparison?.driversCommon).toHaveLength(1)
      expect(comparison?.driversCommon[0].id).toBe('n2')
    })

    it('should compare drivers by label if no ID', () => {
      const runA: StoredRun = {
        id: '1',
        ts: Date.now(),
        seed: 1,
        adapter: 'auto',
        summary: 'A',
        graphHash: 'h1',
        report: { summary: 'A', recommendation: '', confidence: 80, timestamp: Date.now() },
        drivers: [
          { kind: 'node', label: 'Market Growth' }
        ]
      }

      const runB: StoredRun = {
        id: '2',
        ts: Date.now(),
        seed: 2,
        adapter: 'auto',
        summary: 'B',
        graphHash: 'h2',
        report: { summary: 'B', recommendation: '', confidence: 80, timestamp: Date.now() },
        drivers: [
          { kind: 'node', label: 'Market Growth' }
        ]
      }

      addRun(runA)
      addRun(runB)

      const comparison = compareRuns('1', '2')
      expect(comparison).not.toBeNull()
      expect(comparison?.driversCommon).toHaveLength(1)
      expect(comparison?.driversAdded).toHaveLength(0)
      expect(comparison?.driversRemoved).toHaveLength(0)
    })
  })
})
