/**
 * useCanvasResultsSync - Sync canvas selection with Results panel
 *
 * When a factor node is selected on the canvas, this hook:
 * 1. Finds the matching driver row in the Results panel
 * 2. Expands the DriversSection accordion if collapsed
 * 3. Scrolls to the matching driver row
 * 4. Applies a temporary highlight (2 seconds)
 *
 * Graph Interaction P1: Canvas → Results bidirectional sync
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useCanvasStore } from '../../canvas/store'
import type { DriverItem } from './types'

interface UseCanvasResultsSyncOptions {
  /** Array of drivers from the Results panel */
  drivers: DriverItem[]
  /** Whether the DriversSection accordion is expanded */
  isAccordionExpanded: boolean
  /** Callback to expand the DriversSection accordion */
  onExpandAccordion: () => void
}

interface UseCanvasResultsSyncReturn {
  /** ID of the currently highlighted driver (for styling) */
  highlightedDriverId: string | null
  /** Ref callback to register driver row elements */
  registerDriverRef: (factorKey: string, element: HTMLDivElement | null) => void
}

export function useCanvasResultsSync({
  drivers,
  isAccordionExpanded,
  onExpandAccordion,
}: UseCanvasResultsSyncOptions): UseCanvasResultsSyncReturn {
  const [highlightedDriverId, setHighlightedDriverId] = useState<string | null>(null)
  const driverRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // React #185 FIX: Use primitive selectors to avoid infinite loops
  const selectionSize = useCanvasStore((s) => s.selection.nodeIds.size)
  const selectedId = useCanvasStore((s) => {
    if (s.selection.nodeIds.size !== 1) return null
    return s.selection.nodeIds.values().next().value ?? null
  })

  // Get node type to check if it's a factor
  const selectedNodeKind = useCanvasStore((s) => {
    if (s.selection.nodeIds.size !== 1) return null
    const id = s.selection.nodeIds.values().next().value
    if (!id) return null
    const node = s.nodes.find((n) => n.id === id)
    return node?.data?.kind ?? node?.data?.type ?? node?.type ?? null
  })

  // Register driver row ref
  const registerDriverRef = useCallback((factorKey: string, element: HTMLDivElement | null) => {
    if (element) {
      driverRefs.current.set(factorKey, element)
    } else {
      driverRefs.current.delete(factorKey)
    }
  }, [])

  useEffect(() => {
    // Clear previous timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = null
    }

    // Only sync when single factor is selected
    if (selectionSize !== 1 || !selectedId) {
      setHighlightedDriverId(null)
      return
    }

    // Only sync for factor nodes (risks aren't represented in drivers)
    if (selectedNodeKind !== 'factor') {
      setHighlightedDriverId(null)
      return
    }

    // Find matching driver by matchedNodeId or factorKey
    const matchingDriver = drivers.find(
      (d) => d.matchedNodeId === selectedId || d.factorKey === selectedId
    )

    if (!matchingDriver) {
      setHighlightedDriverId(null)
      return
    }

    // Expand accordion if collapsed
    if (!isAccordionExpanded) {
      onExpandAccordion()
    }

    // Wait for expansion animation before scrolling
    // Use double requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const rowElement = driverRefs.current.get(matchingDriver.factorKey)
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setHighlightedDriverId(matchingDriver.factorKey)

          // Clear highlight after 2 seconds
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedDriverId(null)
          }, 2000)
        }
      })
    })

    // Cleanup
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [
    selectionSize,
    selectedId,
    selectedNodeKind,
    drivers,
    isAccordionExpanded,
    onExpandAccordion,
  ])

  return {
    highlightedDriverId,
    registerDriverRef,
  }
}

export default useCanvasResultsSync
