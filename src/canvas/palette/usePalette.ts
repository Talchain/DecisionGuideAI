/**
 * Command Palette State Hook
 *
 * Manages palette state, keyboard shortcuts, and search indexing.
 * Debounces indexing to maintain ≤50ms open latency.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useCanvasStore } from '../store'
import { loadRuns, getRun } from '../store/runHistory'
import { selectScenarioLastRun } from '../shared/lastRun'
import { getTemplateMetas } from '../../templates/blueprints'
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
  const setHighlightedDriver = useCanvasStore(s => (s as any).setHighlightedDriver) as
    | ((driver: { kind: 'node' | 'edge'; id: string } | null) => void)
    | undefined
  const resultsState = useCanvasStore(s => s.results)
  const scenarioTitle = useCanvasStore(s => s.currentScenarioFraming?.title ?? null)
  const scenarioLastResultHash = useCanvasStore(s => s.currentScenarioLastResultHash ?? null)
  const resultsLoadHistorical = useCanvasStore(s => s.resultsLoadHistorical)
  const setShowResultsPanel = useCanvasStore(s => s.setShowResultsPanel)
  const setShowInspectorPanel = useCanvasStore(s => s.setShowInspectorPanel)
  const openTemplatesPanel = useCanvasStore(s => s.openTemplatesPanel)

  // Index all searchable items (debounced)
  useEffect(() => {
    if (!enabled) return

    const timer = setTimeout(() => {
      const runs = loadRuns()
      const recentRuns = runs.slice(0, 10).map(run => ({
        id: run.id,
        seed: run.seed,
        hash: run.hash,
        timestamp: run.ts,
      }))

      const scenarioLastRun = selectScenarioLastRun({
        runs,
        scenarioLastResultHash,
        currentResultsHash: resultsState.hash ?? null,
      })

      const scenarioLastRunId = scenarioLastRun?.id ?? null

      // Drivers from the current results report (if available). These are the same
      // drivers shown in ResultsPanel and are already privacy-reviewed.
      const drivers = resultsState.report?.drivers ?? []

      // Templates from local blueprints metadata (no network calls).
      const templateMetas = getTemplateMetas()
      const templateItems = indexTemplates(
        templateMetas.map(meta => ({
          id: meta.id,
          title: meta.name,
          tags: meta.category ? [meta.category] : undefined,
        })),
      )

      const items: PaletteItem[] = [
        ...indexActions(),
        ...indexNodes(nodes),
        ...indexEdges(edges),
        ...indexDrivers(drivers),
        ...templateItems,
        ...indexRuns(recentRuns, {
          scenarioLastRunId,
          scenarioTitle,
        }),
      ]
      setAllItems(items)
    }, indexDebounce)

    return () => clearTimeout(timer)
  }, [nodes, edges, indexDebounce, enabled, isOpen, scenarioTitle, scenarioLastResultHash, resultsState.hash])

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

  // Handle action items (run, cancel, compare, etc.)
  const handleAction = useCallback((actionId: string) => {
    switch (actionId) {
      case 'action:copy-seed':
        // Copy seed and hash to clipboard
        if (resultsState.seed !== undefined || resultsState.hash) {
          const text = `Seed: ${resultsState.seed ?? 'N/A'}\nHash: ${resultsState.hash ?? 'N/A'}`
          navigator.clipboard.writeText(text).then(() => {
            if (import.meta.env.DEV) {
              console.log('[Palette] Copied seed & hash to clipboard')
            }
          }).catch(err => {
            console.error('[Palette] Failed to copy:', err)
          })
        } else {
          if (import.meta.env.DEV) {
            console.warn('[Palette] No seed or hash available to copy')
          }
        }
        break

      case 'action:run':
        // BLOCKED: Palette cannot safely trigger runs yet. This should be wired
        // through a shared run controller (wrapping useResultsRun) so we do not
        // duplicate CanvasToolbar / ResultsPanel gating and diagnostics logic.
        if (import.meta.env.DEV) {
          console.log('[Palette] Run action is not yet wired - waiting on shared run controller')
        }
        break

      case 'action:cancel':
        // BLOCKED: Palette cancel should delegate to the same controller as the
        // toolbar and ResultsPanel once that exists. Until then this remains a
        // no-op to avoid inconsistent behaviour.
        if (import.meta.env.DEV) {
          console.log('[Palette] Cancel action is not yet wired - waiting on shared run controller')
        }
        break

      case 'action:compare':
        // BLOCKED: Opening Compare from palette depends on panel state wiring
        // in OutputsDock/ResultsPanel. For now we keep this as a no-op.
        if (import.meta.env.DEV) {
          console.log(`[Palette] ${actionId} - Compare opening not yet wired`)
        }
        break

      case 'action:inspector':
        setShowInspectorPanel(true)
        break

      case 'action:results':
        setShowResultsPanel(true)
        break

      default:
        console.warn('[Palette] Unknown action:', actionId)
    }
  }, [resultsState.seed, resultsState.hash, setShowResultsPanel, setShowInspectorPanel])

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
          if (setHighlightedDriver && item.metadata?.edgeId) {
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
          // Open Templates panel; actual template selection is handled within the panel.
          if (openTemplatesPanel) {
            openTemplatesPanel()
          }
          break

        case 'run':
          // Restore a historical run into the Results panel using run history.
          if (item.metadata?.runId && typeof item.metadata.runId === 'string') {
            const runId = item.metadata.runId as string
            const run = getRun(runId)
            if (run) {
              resultsLoadHistorical(run)
              setShowResultsPanel(true)
            } else {
              console.warn('[Palette] Run not found for ID:', runId)
            }
          } else {
            console.warn('[Palette] Run item missing runId metadata:', item)
          }
          break

        case 'driver':
          // Focus the node or edge associated with this driver
          if (item.metadata?.nodeId) {
            selectNodeWithoutHistory(item.metadata.nodeId as string)
          } else if (setHighlightedDriver && item.metadata?.edgeId) {
            setHighlightedDriver({ kind: 'edge', id: item.metadata.edgeId as string })
            setTimeout(() => setHighlightedDriver(null), 2000)
          }
          break
      }

      // Close palette after execution
      close()
    },
    [
      selectNodeWithoutHistory,
      setHighlightedDriver,
      handleAction,
      close,
      resultsLoadHistorical,
      setShowResultsPanel,
      openTemplatesPanel,
    ]
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
