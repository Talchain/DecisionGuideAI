/**
 * S5-STORAGE: Versioned Storage Tests
 *
 * Tests versioned persistence with:
 * - Schema versioning
 * - Migrations
 * - Quota checking
 * - Autosave/recovery
 * - Export fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createVersionedPayload,
  saveCanvasData,
  loadCanvasData,
  saveAutosave,
  loadAutosave,
  clearAutosave,
  getStorageQuota,
  migratePayload,
  exportAsFile
} from '../versionedStorage'
import type { CanvasDataV1, VersionedPayload } from '../types'

// Mock localStorage
const mockLocalStorage: Record<string, string> = {}

beforeEach(() => {
  // Reset mock localStorage
  Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])

  // Mock window.localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key]
      },
      clear: () => {
        Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
      },
      get length() {
        return Object.keys(mockLocalStorage).length
      },
      key: (index: number) => Object.keys(mockLocalStorage)[index] || null
    },
    writable: true,
    configurable: true
  })

  // Mock navigator.storage
  Object.defineProperty(navigator, 'storage', {
    value: {
      estimate: vi.fn().mockResolvedValue({
        usage: 1024 * 100, // 100 KB used
        quota: 1024 * 1024 * 5 // 5 MB total
      })
    },
    writable: true,
    configurable: true
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('S5-STORAGE: Versioned Storage', () => {
  describe('Payload Creation', () => {
    it('should create versioned payload with schema and version', () => {
      const data = { scenarios: [], currentScenarioId: undefined }
      const payload = createVersionedPayload(data)

      expect(payload.schema).toBe('canvas.v1')
      expect(payload.version).toBe('1.0.0')
      expect(payload.timestamp).toBeGreaterThan(0)
      expect(payload.data).toEqual(data)
    })

    it('should use current timestamp', () => {
      const before = Date.now()
      const payload = createVersionedPayload({ test: 'data' })
      const after = Date.now()

      expect(payload.timestamp).toBeGreaterThanOrEqual(before)
      expect(payload.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('Storage Quota', () => {
    it('should get storage quota from navigator.storage.estimate', async () => {
      const quota = await getStorageQuota()

      expect(quota.available).toBe(true)
      expect(quota.used).toBe(1024 * 100)
      expect(quota.total).toBe(1024 * 1024 * 5)
      expect(quota.percentage).toBeCloseTo(1.95, 1)
    })

    it('should determine if can store based on quota', async () => {
      const quota = await getStorageQuota()

      // Small size should be okay
      expect(quota.canStore(1024)).toBe(true)

      // Size that would exceed 90% should fail
      expect(quota.canStore(5 * 1024 * 1024)).toBe(false)
    })

    it('should fallback to manual estimation if navigator.storage unavailable', async () => {
      // Mock navigator.storage as undefined
      Object.defineProperty(navigator, 'storage', {
        value: undefined,
        writable: true,
        configurable: true
      })

      mockLocalStorage['test-key'] = 'test-value'

      const quota = await getStorageQuota()

      expect(quota.available).toBe(true)
      expect(quota.used).toBeGreaterThan(0) // Estimated from localStorage
    })
  })

  describe('Save and Load', () => {
    it('should save and load canvas data', async () => {
      const data: CanvasDataV1 = {
        scenarios: [
          {
            id: 'scenario-1',
            name: 'Test Scenario',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            graph: {
              nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }],
              edges: []
            }
          }
        ]
      }

      const saveResult = await saveCanvasData(data)
      expect(saveResult.success).toBe(true)

      const loadResult = loadCanvasData()
      expect(loadResult.success).toBe(true)
      if (loadResult.success) {
        expect(loadResult.data.scenarios).toHaveLength(1)
        expect(loadResult.data.scenarios[0].name).toBe('Test Scenario')
      }
    })

    it('should return empty data when nothing stored', () => {
      const loadResult = loadCanvasData()

      expect(loadResult.success).toBe(true)
      if (loadResult.success) {
        expect(loadResult.data.scenarios).toEqual([])
      }
    })

    it('should fail when quota exceeded', async () => {
      // Mock quota as nearly full
      vi.mocked(navigator.storage.estimate).mockResolvedValue({
        usage: 1024 * 1024 * 4.8, // 4.8 MB used
        quota: 1024 * 1024 * 5 // 5 MB total (96% used)
      })

      const data: CanvasDataV1 = {
        scenarios: Array.from({ length: 100 }, (_, i) => ({
          id: `scenario-${i}`,
          name: `Scenario ${i}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          graph: { nodes: [], edges: [] }
        }))
      }

      const saveResult = await saveCanvasData(data)

      expect(saveResult.success).toBe(false)
      if (!saveResult.success) {
        expect(saveResult.error.type).toBe('QUOTA_EXCEEDED')
        expect(saveResult.error.message).toContain('quota exceeded')
      }
    })

    it('should handle localStorage unavailability', async () => {
      // Mock localStorage as undefined
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
        configurable: true
      })

      const data: CanvasDataV1 = { scenarios: [] }
      const saveResult = await saveCanvasData(data)

      expect(saveResult.success).toBe(false)
      if (!saveResult.success) {
        expect(saveResult.error.type).toBe('UNAVAILABLE')
      }
    })

    it('should handle parse errors gracefully', () => {
      // Store invalid JSON
      mockLocalStorage['olumi-canvas-scenarios-v1'] = '{invalid json}'

      const loadResult = loadCanvasData()

      expect(loadResult.success).toBe(false)
      if (!loadResult.success) {
        expect(loadResult.error.type).toBe('PARSE_ERROR')
      }
    })

    it('should handle missing required fields', () => {
      // Store payload without required fields
      mockLocalStorage['olumi-canvas-scenarios-v1'] = JSON.stringify({
        data: { scenarios: [] }
        // Missing schema and version
      })

      const loadResult = loadCanvasData()

      expect(loadResult.success).toBe(false)
      if (!loadResult.success) {
        expect(loadResult.error.type).toBe('PARSE_ERROR')
        expect(loadResult.error.message).toContain('Missing required fields')
      }
    })
  })

  describe('Migrations', () => {
    it('should not migrate when already current version', () => {
      const payload: VersionedPayload<CanvasDataV1> = {
        schema: 'canvas.v1',
        version: '1.0.0',
        timestamp: Date.now(),
        data: { scenarios: [] }
      }

      const result = migratePayload(payload)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(payload)
      }
    })

    it('should warn when no migration path found', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const payload: VersionedPayload<any> = {
        schema: 'canvas.v0',
        version: '0.1.0',
        timestamp: Date.now(),
        data: {}
      }

      const result = migratePayload(payload)

      expect(result.success).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No migration path found')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Autosave', () => {
    it('should save and load autosave data', async () => {
      const nodes = [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }]
      const edges = [{ id: 'e1', source: '1', target: '2' }]

      const saveResult = await saveAutosave(nodes, edges)
      expect(saveResult.success).toBe(true)

      const loadResult = loadAutosave()
      expect(loadResult.success).toBe(true)
      if (loadResult.success && loadResult.data) {
        expect(loadResult.data.nodes).toEqual(nodes)
        expect(loadResult.data.edges).toEqual(edges)
        expect(loadResult.data.timestamp).toBeGreaterThan(0)
      }
    })

    it('should return null when no autosave exists', () => {
      const loadResult = loadAutosave()

      expect(loadResult.success).toBe(true)
      if (loadResult.success) {
        expect(loadResult.data).toBeNull()
      }
    })

    it('should clear autosave', async () => {
      const nodes = [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: {} }]
      await saveAutosave(nodes, [])

      clearAutosave()

      const loadResult = loadAutosave()
      expect(loadResult.success).toBe(true)
      if (loadResult.success) {
        expect(loadResult.data).toBeNull()
      }
    })

    it('should skip autosave when quota nearly full', async () => {
      // Mock quota as 96% full
      vi.mocked(navigator.storage.estimate).mockResolvedValue({
        usage: 1024 * 1024 * 4.8,
        quota: 1024 * 1024 * 5
      })

      const nodes = [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: {} }]
      const saveResult = await saveAutosave(nodes, [])

      expect(saveResult.success).toBe(false)
      if (!saveResult.success) {
        expect(saveResult.error.message).toContain('quota nearly full')
      }
    })

    it('should not throw on autosave failures', async () => {
      // Mock localStorage to throw
      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: () => {
            throw new Error('Storage error')
          }
        },
        writable: true,
        configurable: true
      })

      const nodes = [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: {} }]

      // Should not throw
      const saveResult = await saveAutosave(nodes, [])
      expect(saveResult.success).toBe(false)
    })
  })

  describe('Export Fallback', () => {
    it('should export data as downloadable file', () => {
      // Mock DOM APIs
      const mockClick = vi.fn()
      const mockCreateElement = vi.fn(() => ({
        href: '',
        download: '',
        click: mockClick
      }))
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
      const mockRevokeObjectURL = vi.fn()

      vi.stubGlobal('document', {
        createElement: mockCreateElement
      })
      vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL
      })

      const data: CanvasDataV1 = {
        scenarios: [
          {
            id: 'scenario-1',
            name: 'Export Test',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            graph: { nodes: [], edges: [] }
          }
        ]
      }

      exportAsFile(data, 'test-export.json')

      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

      vi.unstubAllGlobals()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty scenarios array', async () => {
      const data: CanvasDataV1 = { scenarios: [] }

      const saveResult = await saveCanvasData(data)
      expect(saveResult.success).toBe(true)

      const loadResult = loadCanvasData()
      expect(loadResult.success).toBe(true)
      if (loadResult.success) {
        expect(loadResult.data.scenarios).toEqual([])
      }
    })

    it('should handle large scenario data', async () => {
      const data: CanvasDataV1 = {
        scenarios: [
          {
            id: 'large-scenario',
            name: 'Large Scenario',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            graph: {
              nodes: Array.from({ length: 100 }, (_, i) => ({
                id: `${i}`,
                type: 'goal',
                position: { x: i * 100, y: i * 100 },
                data: { label: `Node ${i}`, description: 'A'.repeat(1000) }
              })),
              edges: Array.from({ length: 99 }, (_, i) => ({
                id: `e${i}`,
                source: `${i}`,
                target: `${i + 1}`
              }))
            }
          }
        ]
      }

      const saveResult = await saveCanvasData(data)
      expect(saveResult.success).toBe(true)

      const loadResult = loadCanvasData()
      expect(loadResult.success).toBe(true)
      if (loadResult.success) {
        expect(loadResult.data.scenarios[0].graph.nodes).toHaveLength(100)
        expect(loadResult.data.scenarios[0].graph.edges).toHaveLength(99)
      }
    })
  })
})
