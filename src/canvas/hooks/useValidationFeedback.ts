import { useCallback } from 'react'
import { useCanvasStore } from '../store'
import { useReactFlow } from '@xyflow/react'
import type { ValidationError } from '../components/ValidationBanner'

/**
 * Hook for handling validation feedback across all run entry points
 *
 * Features:
 * - Formats validation errors into human-readable messages
 * - Provides focus targets for "Fix now" button
 * - Handles node/edge selection and viewport focusing
 */
export function useValidationFeedback() {
  const selectNodeWithoutHistory = useCanvasStore(s => s.selectNodeWithoutHistory)
  const { setCenter, getNode, getEdge } = useReactFlow()

  /**
   * Focus on the first invalid element (node or edge)
   * Called when user clicks "Fix now" button
   */
  const focusError = useCallback((error: ValidationError) => {
    if (error.node_id) {
      // Focus on node
      const node = getNode(error.node_id)
      if (node) {
        selectNodeWithoutHistory(error.node_id)
        setCenter(node.position.x, node.position.y, {
          zoom: 1.5,
          duration: 400,
        })
      }
    } else if (error.edge_id) {
      // Focus on edge's source node as proxy
      const edge = getEdge(error.edge_id)
      if (edge) {
        const sourceNode = getNode(edge.source)
        if (sourceNode) {
          // Select edge visually (canvas doesn't have edge selection API)
          // So we focus on the source node instead
          selectNodeWithoutHistory(edge.source)
          setCenter(sourceNode.position.x, sourceNode.position.y, {
            zoom: 1.5,
            duration: 400,
          })
        }
      }
    }
  }, [getNode, getEdge, selectNodeWithoutHistory, setCenter])

  /**
   * Format validation errors with helpful context
   */
  const formatError = useCallback((error: ValidationError): ValidationError => {
    // Add node/edge context to message if available
    let message = error.message

    if (error.node_id) {
      const node = getNode(error.node_id)
      if (node) {
        const nodeLabel = (node.data as any)?.label || error.node_id
        message = `Node "${nodeLabel}": ${message}`
      }
    } else if (error.edge_id) {
      const edge = getEdge(error.edge_id)
      if (edge) {
        const sourceNode = getNode(edge.source)
        const targetNode = getNode(edge.target)
        const sourceLabel = sourceNode ? ((sourceNode.data as any)?.label || edge.source) : edge.source
        const targetLabel = targetNode ? ((targetNode.data as any)?.label || edge.target) : edge.target
        message = `Edge ${sourceLabel} → ${targetLabel}: ${message}`
      }
    }

    return {
      ...error,
      message,
    }
  }, [getNode, getEdge])

  /**
   * Format all validation errors with context
   */
  const formatErrors = useCallback((errors: ValidationError[]): ValidationError[] => {
    return errors.map(formatError)
  }, [formatError])

  return {
    focusError,
    formatError,
    formatErrors,
  }
}
