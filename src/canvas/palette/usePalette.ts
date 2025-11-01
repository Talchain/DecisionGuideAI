/**
 * Command Palette State Hook
 *
 * Manages palette state, keyboard shortcuts, and search indexing.
 * Debounces indexing to maintain ≤50ms open latency.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useCanvasStore } from '../store'
import type { PaletteItem, SearchResult } from './indexers'
import {
  indexNodes,
  indexEdges,
  indexDrivers,
  indexTemplates,
  indexRuns,
  indexActions,
  searchItems,
  groupResultsByKind,
} from './indexers'

export interface UsePaletteOptions {
  /** Whether palette is enabled (feature flag) */
  enabled?: boolean
  /** Debounce delay for indexing (ms) */
  indexDebounce?: number
}

export interface PaletteState {
  isOpen: boolean
  query: string
  selectedIndex: number
  results: SearchResult[]
  groupedResults: ReturnType<typeof groupResultsByKind>
}

export interface PaletteActions {
  open: () => void
  close: () => void
  toggle: () => void
  setQuery: (query: string) => void
  selectNext: () => void
  selectPrevious: () => void
  executeSelected: () => void
  executeItem: (item: PaletteItem) => void
}

/**
 * Command Palette state and actions hook
 */
export function usePalette(options: UsePaletteOptions = {}): PaletteState & PaletteActions {
  const { enabled = true, indexDebounce = 300 } = options

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [allItems, setAllItems] = useState<PaletteItem[]>([])

  // Canvas store selectors
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const selectNodeWithoutHistory = useCanvasStore(s => s.selectNodeWithoutHistory)

  // Index all searchable items (debounced)
  useEffect(() => {
    if (!enabled) return

    const timer = setTimeout(() => {
      const items: PaletteItem[] = [
        ...indexActions(),
        ...indexNodes(nodes),
        ...indexEdges(edges),
        // TODO: Add drivers, templates, runs when stores exist
        // ...indexDrivers(drivers),
        // ...indexTemplates(templates),
        // ...indexRuns(runs),
      ]
      setAllItems(items)
    }, indexDebounce)

    return () => clearTimeout(timer)
  }, [nodes, edges, indexDebounce, enabled])

  // Search results
  const results = useMemo(() => {
    return searchItems(query, allItems, 20)
  }, [query, allItems])

  const groupedResults = useMemo(() => {
    return groupResultsByKind(results)
  }, [results])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // Keyboard shortcut: ⌘K / CTRL+K
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or CTRL+K to toggle
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
        return
      }

      // Only handle other keys when palette is open
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          setQuery('')
          break

        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
          break

        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          break

        case 'Enter':
          e.preventDefault()
          if (results[selectedIndex]) {
            executeItem(results[selectedIndex])
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, isOpen, results, selectedIndex])

  // Actions
  const open = useCallback(() => {
    if (enabled) setIsOpen(true)
  }, [enabled])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev)
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  const selectNext = useCallback(() => {
    setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
  }, [results.length])

  const selectPrevious = useCallback(() => {
    setSelectedIndex(prev => Math.max(prev - 1, 0))
  }, [])

  const executeItem = useCallback(
    (item: PaletteItem) => {
      // Execute action based on item kind
      switch (item.kind) {
        case 'node':
          if (item.metadata?.nodeId) {
            selectNodeWithoutHistory(item.metadata.nodeId as string)
            // TODO: Add focus/center node when canvas API available
          }
          break

        case 'edge':
          // TODO: Implement edge focus/highlight
          break

        case 'action':
          // TODO: Implement action handlers
          break

        case 'template':
          // TODO: Implement template loading
          break

        case 'run':
          // TODO: Implement run restoration
          break

        case 'driver':
          // TODO: Implement driver focus (node/edge)
          break
      }

      // Close palette after execution
      close()
    },
    [selectNodeWithoutHistory, close]
  )

  const executeSelected = useCallback(() => {
    if (results[selectedIndex]) {
      executeItem(results[selectedIndex])
    }
  }, [results, selectedIndex, executeItem])

  return {
    isOpen,
    query,
    selectedIndex,
    results,
    groupedResults,
    open,
    close,
    toggle,
    setQuery,
    selectNext,
    selectPrevious,
    executeSelected,
    executeItem,
  }
}
