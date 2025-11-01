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
  const [highlightTimeoutId, setHighlightTimeoutId] = useState<number | null>(null)

  // Canvas store selectors
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const selectNodeWithoutHistory = useCanvasStore(s => s.selectNodeWithoutHistory)
  const setHighlightedDriver = useCanvasStore(s => s.setHighlightedDriver)
  const resultsState = useCanvasStore(s => s.results)
  const drivers = resultsState.drivers || []
  const runHistory = useCanvasStore(s => s.runHistory) || []

  // Index all searchable items (debounced)
  useEffect(() => {
    if (!enabled) return

    const timer = setTimeout(() => {
      const items: PaletteItem[] = [
        ...indexActions(),
        ...indexNodes(nodes),
        ...indexEdges(edges),
        ...indexDrivers(drivers),
        ...indexRuns(runHistory),
        // TODO: Add templates when template store available
        // ...indexTemplates(templates),
      ]
      setAllItems(items)
    }, indexDebounce)

    return () => clearTimeout(timer)
  }, [nodes, edges, drivers, runHistory, indexDebounce, enabled])

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

    // Clear any pending highlight timeout
    if (highlightTimeoutId !== null) {
      window.clearTimeout(highlightTimeoutId)
      setHighlightTimeoutId(null)
    }
  }, [highlightTimeoutId])

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

  const selectByIndex = useCallback((index: number) => {
    if (index >= 0 && index < results.length) {
      setSelectedIndex(index)
    }
  }, [results.length])

  // Handle action items (run, cancel, compare, etc.)
  const handleAction = useCallback((actionId: string) => {
    switch (actionId) {
      case 'action:copy-seed':
        // Copy seed and hash to clipboard
        if (resultsState.seed !== undefined || resultsState.hash) {
          const text = `Seed: ${resultsState.seed ?? 'N/A'}\nHash: ${resultsState.hash ?? 'N/A'}`
          navigator.clipboard.writeText(text).then(() => {
            console.log('[Palette] Copied seed & hash to clipboard')
          }).catch(err => {
            console.error('[Palette] Failed to copy:', err)
          })
        } else {
          console.warn('[Palette] No seed or hash available to copy')
        }
        break

      case 'action:run':
        // TODO: Implement run trigger when useResultsRun hook can be accessed
        // This requires passing run function from parent component
        console.log('[Palette] Run action not yet wired - needs useResultsRun hook access')
        break

      case 'action:cancel':
        // TODO: Implement cancel trigger
        console.log('[Palette] Cancel action not yet wired - needs useResultsRun hook access')
        break

      case 'action:compare':
      case 'action:inspector':
      case 'action:results':
        // TODO: Implement panel opening when panel state management is available
        console.log(`[Palette] ${actionId} - Panel opening not yet wired`)
        break

      default:
        console.warn('[Palette] Unknown action:', actionId)
    }
  }, [resultsState.seed, resultsState.hash])

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
          // Highlight edge if metadata available
          if (item.metadata?.edgeId) {
            setHighlightedDriver({ kind: 'edge', id: item.metadata.edgeId as string })
            // Auto-clear after 2s
            setTimeout(() => setHighlightedDriver(null), 2000)
          }
          break

        case 'action':
          // Handle action items
          handleAction(item.id)
          break

        case 'template':
          // TODO: Implement template loading when template store available
          console.log('[Palette] Template loading not yet implemented:', item.id)
          break

        case 'run':
          // TODO: Implement run restoration when run history API available
          console.log('[Palette] Run restoration not yet implemented:', item.metadata?.runId)
          break

        case 'driver':
          // Focus the node or edge associated with this driver
          if (item.metadata?.nodeId) {
            selectNodeWithoutHistory(item.metadata.nodeId as string)
          } else if (item.metadata?.edgeId) {
            setHighlightedDriver({ kind: 'edge', id: item.metadata.edgeId as string })

            // Clear previous timeout if exists
            if (highlightTimeoutId !== null) {
              window.clearTimeout(highlightTimeoutId)
            }

            // Store new timeout ID
            const timeoutId = window.setTimeout(() => {
              setHighlightedDriver(null)
              setHighlightTimeoutId(null)
            }, 2000)
            setHighlightTimeoutId(timeoutId)
          }
          break
      }

      // Close palette after execution
      close()
    },
    [selectNodeWithoutHistory, setHighlightedDriver, handleAction, close, highlightTimeoutId]
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
    selectByIndex,
    executeSelected,
    executeItem,
  }
}
