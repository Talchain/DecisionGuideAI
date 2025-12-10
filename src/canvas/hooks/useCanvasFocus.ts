/**
 * useCanvasFocus - React hook for canvas focus operations
 *
 * Provides focusNode and focusEdge functions that:
 * - Pan the viewport to center the target
 * - Apply a brief highlight animation
 * - Select the node/edge for editing
 *
 * Uses the singleton focusHelpers under the hood.
 */

import { useCallback } from 'react'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'

export interface UseCanvasFocusReturn {
  /**
   * Focus and center a node by ID
   * Pans viewport, applies highlight, selects for editing
   */
  focusNode: (nodeId: string) => void

  /**
   * Focus and center an edge by ID
   * Pans viewport to midpoint, applies highlight
   */
  focusEdge: (edgeId: string) => void

  /**
   * Focus a node or edge based on which ID is provided
   * Convenience method for dynamic targets
   */
  focusElement: (options: { nodeId?: string; edgeId?: string }) => void
}

/**
 * Hook for canvas focus operations
 *
 * @example
 * ```tsx
 * function DriverChip({ driver }) {
 *   const { focusNode, focusEdge } = useCanvasFocus()
 *
 *   const handleClick = () => {
 *     if (driver.nodeId) focusNode(driver.nodeId)
 *     else if (driver.edgeId) focusEdge(driver.edgeId)
 *   }
 *
 *   return <button onClick={handleClick}>{driver.label}</button>
 * }
 * ```
 */
export function useCanvasFocus(): UseCanvasFocusReturn {
  const focusNode = useCallback((nodeId: string) => {
    focusNodeById(nodeId)
  }, [])

  const focusEdge = useCallback((edgeId: string) => {
    focusEdgeById(edgeId)
  }, [])

  const focusElement = useCallback(({ nodeId, edgeId }: { nodeId?: string; edgeId?: string }) => {
    if (nodeId) {
      focusNodeById(nodeId)
    } else if (edgeId) {
      focusEdgeById(edgeId)
    }
  }, [])

  return {
    focusNode,
    focusEdge,
    focusElement,
  }
}

export default useCanvasFocus
