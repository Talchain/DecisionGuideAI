/**
 * Recent Actions Tests
 *
 * Verify recent action tracking, deduplication, and sessionStorage persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getRecentActions,
  addRecentAction,
  clearRecentActions,
  indexRecentActions,
  type RecentAction
} from '../recent'
import type { PaletteItem } from '../indexers'

// Mock sessionStorage
const sessionStorageMock = (() => {
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
    }
  }
})()

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true
})

describe('Recent Actions', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  describe('getRecentActions', () => {
    it('returns empty array when no recent actions exist', () => {
      expect(getRecentActions()).toEqual([])
    })

    it('returns stored recent actions', () => {
      const actions: RecentAction[] = [
        { id: 'action:run', kind: 'action', label: 'Run Analysis', timestamp: Date.now() }
      ]
      sessionStorage.setItem('palette_recent_actions', JSON.stringify(actions))

      expect(getRecentActions()).toEqual(actions)
    })

    it('handles invalid JSON gracefully', () => {
      sessionStorage.setItem('palette_recent_actions', 'invalid json')
      expect(getRecentActions()).toEqual([])
    })

    it('filters out invalid entries', () => {
      const actions = [
        { id: 'action:run', kind: 'action', label: 'Run', timestamp: Date.now() }, // Valid
        { id: 'bad', kind: 'action' }, // Missing label and timestamp
        { label: 'No ID' }, // Missing id
      ]
      sessionStorage.setItem('palette_recent_actions', JSON.stringify(actions))

      const result = getRecentActions()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('action:run')
    })

    it('enforces max 5 items', () => {
      const actions: RecentAction[] = Array.from({ length: 10 }, (_, i) => ({
        id: `action:${i}`,
        kind: 'action',
        label: `Action ${i}`,
        timestamp: Date.now() - i * 1000
      }))
      sessionStorage.setItem('palette_recent_actions', JSON.stringify(actions))

      const result = getRecentActions()
      expect(result).toHaveLength(5)
    })
  })

  describe('addRecentAction', () => {
    it('adds new action to front', () => {
      const item: PaletteItem = {
        id: 'action:run',
        kind: 'action',
        label: 'Run Analysis'
      }

      addRecentAction(item)

      const recent = getRecentActions()
      expect(recent).toHaveLength(1)
      expect(recent[0].id).toBe('action:run')
      expect(recent[0].label).toBe('Run Analysis')
    })

    it('deduplicates existing items', () => {
      const item1: PaletteItem = {
        id: 'action:run',
        kind: 'action',
        label: 'Run Analysis'
      }
      const item2: PaletteItem = {
        id: 'action:compare',
        kind: 'action',
        label: 'Open Compare'
      }

      addRecentAction(item1)
      addRecentAction(item2)
      addRecentAction(item1) // Add item1 again

      const recent = getRecentActions()
      expect(recent).toHaveLength(2)
      expect(recent[0].id).toBe('action:run') // Most recent at front
      expect(recent[1].id).toBe('action:compare')
    })

    it('maintains max 5 items', () => {
      const items: PaletteItem[] = Array.from({ length: 7 }, (_, i) => ({
        id: `action:${i}`,
        kind: 'action',
        label: `Action ${i}`
      }))

      items.forEach(item => addRecentAction(item))

      const recent = getRecentActions()
      expect(recent).toHaveLength(5)
      // Most recent should be action:6
      expect(recent[0].id).toBe('action:6')
      expect(recent[4].id).toBe('action:2')
    })

    it('adds timestamp automatically', () => {
      const item: PaletteItem = {
        id: 'action:run',
        kind: 'action',
        label: 'Run'
      }

      const before = Date.now()
      addRecentAction(item)
      const after = Date.now()

      const recent = getRecentActions()
      expect(recent[0].timestamp).toBeGreaterThanOrEqual(before)
      expect(recent[0].timestamp).toBeLessThanOrEqual(after)
    })

    it('handles storage errors gracefully', () => {
      // Mock setItem to throw
      const originalSetItem = sessionStorage.setItem
      sessionStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded')
      })

      const item: PaletteItem = {
        id: 'action:run',
        kind: 'action',
        label: 'Run'
      }

      // Should not throw
      expect(() => addRecentAction(item)).not.toThrow()

      // Restore
      sessionStorage.setItem = originalSetItem
    })
  })

  describe('clearRecentActions', () => {
    it('removes all recent actions', () => {
      const item: PaletteItem = {
        id: 'action:run',
        kind: 'action',
        label: 'Run'
      }

      addRecentAction(item)
      expect(getRecentActions()).toHaveLength(1)

      clearRecentActions()
      expect(getRecentActions()).toEqual([])
    })

    it('handles storage errors gracefully', () => {
      // Mock removeItem to throw
      const originalRemoveItem = sessionStorage.removeItem
      sessionStorage.removeItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      // Should not throw
      expect(() => clearRecentActions()).not.toThrow()

      // Restore
      sessionStorage.removeItem = originalRemoveItem
    })
  })

  describe('indexRecentActions', () => {
    it('returns empty array when no recent actions', () => {
      expect(indexRecentActions()).toEqual([])
    })

    it('converts recent actions to PaletteItems', () => {
      const item: PaletteItem = {
        id: 'action:run',
        kind: 'action',
        label: 'Run Analysis'
      }

      addRecentAction(item)

      const indexed = indexRecentActions()
      expect(indexed).toHaveLength(1)
      expect(indexed[0].id).toBe('action:run')
      expect(indexed[0].kind).toBe('action')
      expect(indexed[0].label).toBe('Run Analysis')
    })

    it('adds "Recent" description', () => {
      const item: PaletteItem = {
        id: 'node:n1',
        kind: 'node',
        label: 'Risk Node'
      }

      addRecentAction(item)

      const indexed = indexRecentActions()
      expect(indexed[0].description).toBe('Recent')
    })

    it('adds recent keywords', () => {
      const item: PaletteItem = {
        id: 'action:run',
        kind: 'action',
        label: 'Run'
      }

      addRecentAction(item)

      const indexed = indexRecentActions()
      expect(indexed[0].keywords).toEqual(['recent', 'history'])
    })

    it('includes isRecent metadata', () => {
      const item: PaletteItem = {
        id: 'action:run',
        kind: 'action',
        label: 'Run'
      }

      addRecentAction(item)

      const indexed = indexRecentActions()
      expect(indexed[0].metadata?.isRecent).toBe(true)
      expect(indexed[0].metadata?.timestamp).toBeDefined()
    })

    it('maintains order from getRecentActions', () => {
      const items: PaletteItem[] = [
        { id: 'action:run', kind: 'action', label: 'Run' },
        { id: 'action:compare', kind: 'action', label: 'Compare' },
        { id: 'node:n1', kind: 'node', label: 'Node' },
      ]

      items.forEach(item => addRecentAction(item))

      const indexed = indexRecentActions()
      expect(indexed).toHaveLength(3)
      expect(indexed[0].id).toBe('node:n1') // Most recent
      expect(indexed[1].id).toBe('action:compare')
      expect(indexed[2].id).toBe('action:run')
    })
  })
})
