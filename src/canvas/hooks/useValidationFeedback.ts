import { useCallback } from 'react'
import { useCanvasStore } from '../store'
import { useReactFlow } from '@xyflow/react'
import type { ValidationError } from '../components/ValidationBanner'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import { cameraDuration } from '../utils/cameraMotion'

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
  // F1 (graph-visuals): "Fix now" focus is a camera move — honour
  // prefers-reduced-motion like every other call site (cameraDuration guard).
  const prefersReducedMotion = usePrefersReducedMotion()

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
          duration: cameraDuration(400, prefersReducedMotion),
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
            duration: cameraDuration(400, prefersReducedMotion),
          })
        }
      }
    }
  }, [getNode, getEdge, selectNodeWithoutHistory, setCenter, prefersReducedMotion])

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
   * Task 4: Codes for violations that are auto-handled internally and
   * should never surface in the ValidationBanner. The adapter clamps
   * out-of-range strengths automatically, so showing this to users
   * is confusing noise.
   */
  const SUPPRESSED_CODES = new Set([
    'STRENGTH_OUT_OF_RANGE',
  ])

  /**
   * Format all validation errors with context.
   * Task 4: Also filters out suppressed structural violations.
   */
  const formatErrors = useCallback((errors: ValidationError[]): ValidationError[] => {
    return errors
      .filter((e) => !SUPPRESSED_CODES.has(e.code))
      .map(formatError)
  }, [formatError])

  return {
    focusError,
    formatError,
    formatErrors,
  }
}
