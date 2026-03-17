/**
 * HighlightContext — bidirectional hover synchronisation between canvas nodes and panel items.
 *
 * PoC scope (Phase 3A): only WorthInvestigating participates as a panel producer/consumer.
 * ModelNotes and ModelReceiptBlock lack canonical node IDs and are excluded.
 * Expand this list when ID propagation is complete across those surfaces.
 *
 * Highlight precedence: last-write-wins. Both setHoveredFromPanel(null) and
 * setHoveredFromCanvas(null) clear unconditionally. No conflicting state is
 * possible because there is a single shared hoveredElementId value.
 *
 * Large-graph guardrail: canvas-side dimming (setHighlightedNodes) is skipped
 * when the graph has more than LARGE_GRAPH_THRESHOLD nodes. Panel-side
 * highlighting (bg-info/5 ring) is always preserved regardless of graph size.
 * The guardrail is checked via a cached ref — derived once when node count
 * changes, not on every hover event.
 *
 * Feature-gated at call sites by isCrossHighlightEnabled().
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useCanvasStore } from '../store'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LARGE_GRAPH_THRESHOLD = 50

// Module-level set to track which graph versions (by node count) have already
// had the large-graph guardrail logged. Prevents log spam on every hover.
const loggedGraphVersions = new Set<number>()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HighlightContextValue {
  /** ID of the element currently hovered in any surface, or null when none. */
  hoveredElementId: string | null
  /**
   * Called by panel items (e.g. WorthInvestigating) on mouseenter/mouseleave.
   * Syncs hoveredElementId and, for graphs ≤ LARGE_GRAPH_THRESHOLD nodes,
   * triggers canvas highlighting via setHighlightedNodes.
   */
  setHoveredFromPanel: (id: string | null) => void
  /**
   * Called by canvas node onMouseEnter/onMouseLeave handlers.
   * Syncs hoveredElementId so panel items can react.
   * Does NOT call setHighlightedNodes (canvas handles its own highlight internally).
   */
  setHoveredFromCanvas: (id: string | null) => void
  /**
   * Clears all highlight state: sets hoveredElementId to null and calls
   * setHighlightedNodes([]). Safe to call from Escape handlers or on unmount.
   */
  clearHighlight: () => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** Safe no-op default: components outside the provider boundary do not crash. */
const defaultValue: HighlightContextValue = {
  hoveredElementId: null,
  setHoveredFromPanel: () => {},
  setHoveredFromCanvas: () => {},
  clearHighlight: () => {},
}

export const HighlightContext = createContext<HighlightContextValue>(defaultValue)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface HighlightProviderProps {
  children: ReactNode
}

export function HighlightProvider({ children }: HighlightProviderProps) {
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null)

  // Cache whether the current graph is "large" to avoid recomputing on every
  // hover event. Derived once when node count changes via a separate selector
  // that returns a primitive boolean — no array reference churn.
  const nodeCount = useCanvasStore(s => s.nodes.length)
  const isLargeGraphRef = useRef(nodeCount > LARGE_GRAPH_THRESHOLD)

  useEffect(() => {
    isLargeGraphRef.current = nodeCount > LARGE_GRAPH_THRESHOLD
  }, [nodeCount])

  const setHoveredFromPanel = useCallback((id: string | null) => {
    setHoveredElementId(id)

    if (id === null) {
      // Always clean up canvas highlight on leave, regardless of graph size
      useCanvasStore.getState().setHighlightedNodes([])
      return
    }

    if (isLargeGraphRef.current) {
      // Log guardrail activation once per graph version (node count)
      const version = useCanvasStore.getState().nodes.length
      if (!loggedGraphVersions.has(version)) {
        loggedGraphVersions.add(version)
        // eslint-disable-next-line no-console
        console.info(
          `[HighlightContext] Large graph guardrail active (${version} nodes > ${LARGE_GRAPH_THRESHOLD}). ` +
          'Canvas dimming disabled; panel emphasis preserved.',
        )
      }
      // Skip canvas highlighting — panel-side emphasis still applies via context
      return
    }

    useCanvasStore.getState().setHighlightedNodes([id])
  }, [])

  const setHoveredFromCanvas = useCallback((id: string | null) => {
    setHoveredElementId(id)
    // No canvas store call: canvas manages its own highlight via ReactFlow events.
    // Panel items react via hoveredElementId from context.
  }, [])

  const clearHighlight = useCallback(() => {
    setHoveredElementId(null)
    useCanvasStore.getState().setHighlightedNodes([])
  }, [])

  const value = useMemo<HighlightContextValue>(
    () => ({ hoveredElementId, setHoveredFromPanel, setHoveredFromCanvas, clearHighlight }),
    [hoveredElementId, setHoveredFromPanel, setHoveredFromCanvas, clearHighlight],
  )

  return <HighlightContext.Provider value={value}>{children}</HighlightContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access highlight state. Must be called inside <HighlightProvider>.
 * Falls back to no-op default if called outside (no crash).
 */
export function useHighlightContext(): HighlightContextValue {
  return useContext(HighlightContext)
}
