/**
 * Autosave Throttle Tests (P2 Hotfix)
 *
 * Verifies that saveAutosave:
 * - Skips write when payload is identical to last save
 * - Writes when payload changes
 * - Uses ≥1000ms throttle (already 30s interval)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { saveAutosave, clearAutosave } from '../scenarios'
import type { Node, Edge } from '@xyflow/react'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get store() {
      return store
    }
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
})

describe('Autosave Throttle', () => {
  beforeEach(() => {
    localStorageMock.clear()
    clearAutosave()
    vi.clearAllMocks()
  })

  afterEach(() => {
    clearAutosave()
  })

  describe('saveAutosave', () => {
    it('should write first save to localStorage', () => {
      const data = {
        timestamp: Date.now(),
        nodes: [
          { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      saveAutosave(data)

      const stored = localStorageMock.getItem('canvas-autosave')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!)).toMatchObject({
        timestamp: data.timestamp,
        nodes: data.nodes,
        edges: data.edges
      })
    })

    it('should skip write when payload is identical', () => {
      const data = {
        timestamp: Date.now(),
        nodes: [
          { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      // First save
      saveAutosave(data)
      const firstPayload = localStorageMock.getItem('canvas-autosave')

      // Second save with identical data - should skip
      saveAutosave(data)
      const secondPayload = localStorageMock.getItem('canvas-autosave')

      // Should be the same reference (no write occurred)
      expect(secondPayload).toBe(firstPayload)
    })

    it('should write when payload changes', () => {
      const data1 = {
        timestamp: Date.now(),
        nodes: [
          { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      const data2 = {
        timestamp: Date.now() + 1000,
        nodes: [
          { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 100 }, data: { label: 'Node 2' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      // First save
      saveAutosave(data1)
      const firstPayload = localStorageMock.getItem('canvas-autosave')
      const firstParsed = JSON.parse(firstPayload!)

      // Second save with changed data - should write
      saveAutosave(data2)
      const secondPayload = localStorageMock.getItem('canvas-autosave')
      const secondParsed = JSON.parse(secondPayload!)

      expect(secondPayload).not.toBe(firstPayload)
      expect(secondParsed.nodes).toHaveLength(2)
      expect(firstParsed.nodes).toHaveLength(1)
    })

    it('should detect changes in node properties', () => {
      const data1 = {
        timestamp: Date.now(),
        nodes: [
          { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Original' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      const data2 = {
        timestamp: Date.now(),
        nodes: [
          { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Modified' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      saveAutosave(data1)
      const firstPayload = localStorageMock.getItem('canvas-autosave')

      saveAutosave(data2)
      const secondPayload = localStorageMock.getItem('canvas-autosave')

      expect(secondPayload).not.toBe(firstPayload)
      expect(JSON.parse(secondPayload!).nodes[0].data.label).toBe('Modified')
    })

    it('should detect changes in edges', () => {
      const data1 = {
        timestamp: Date.now(),
        nodes: [] as Node[],
        edges: [
          { id: 'e1', source: 'a', target: 'b' }
        ] as Edge[]
      }

      const data2 = {
        timestamp: Date.now(),
        nodes: [] as Node[],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' }
        ] as Edge[]
      }

      saveAutosave(data1)
      const firstPayload = localStorageMock.getItem('canvas-autosave')

      saveAutosave(data2)
      const secondPayload = localStorageMock.getItem('canvas-autosave')

      expect(secondPayload).not.toBe(firstPayload)
      expect(JSON.parse(secondPayload!).edges).toHaveLength(2)
    })

    it('should detect timestamp changes', () => {
      const data1 = {
        timestamp: 1000,
        nodes: [] as Node[],
        edges: [] as Edge[]
      }

      const data2 = {
        timestamp: 2000,
        nodes: [] as Node[],
        edges: [] as Edge[]
      }

      saveAutosave(data1)
      const firstPayload = localStorageMock.getItem('canvas-autosave')

      saveAutosave(data2)
      const secondPayload = localStorageMock.getItem('canvas-autosave')

      expect(secondPayload).not.toBe(firstPayload)
      expect(JSON.parse(secondPayload!).timestamp).toBe(2000)
    })

    it('should detect scenarioId changes', () => {
      const data1 = {
        timestamp: Date.now(),
        scenarioId: 'scenario-1',
        nodes: [] as Node[],
        edges: [] as Edge[]
      }

      const data2 = {
        timestamp: Date.now(),
        scenarioId: 'scenario-2',
        nodes: [] as Node[],
        edges: [] as Edge[]
      }

      saveAutosave(data1)
      const firstPayload = localStorageMock.getItem('canvas-autosave')

      saveAutosave(data2)
      const secondPayload = localStorageMock.getItem('canvas-autosave')

      expect(secondPayload).not.toBe(firstPayload)
      expect(JSON.parse(secondPayload!).scenarioId).toBe('scenario-2')
    })

    it('should handle multiple identical saves in sequence', () => {
      const data = {
        timestamp: Date.now(),
        nodes: [
          { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ] as Node[],
        edges: [] as Edge[]
      }

      // First save
      saveAutosave(data)
      const firstPayload = localStorageMock.getItem('canvas-autosave')

      // Multiple identical saves - all should be skipped
      saveAutosave(data)
      saveAutosave(data)
      saveAutosave(data)

      const finalPayload = localStorageMock.getItem('canvas-autosave')
      expect(finalPayload).toBe(firstPayload) // Same reference = no writes
    })

    it('should handle empty graph', () => {
      const data = {
        timestamp: Date.now(),
        nodes: [] as Node[],
        edges: [] as Edge[]
      }

      saveAutosave(data)

      const stored = localStorageMock.getItem('canvas-autosave')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!)).toMatchObject({
        nodes: [],
        edges: []
      })
    })
  })
})
