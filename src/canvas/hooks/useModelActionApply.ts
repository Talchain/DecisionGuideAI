/**
 * useModelActionApply - Apply ModelActions from CEE to canvas
 *
 * Provides methods to apply graph edits proposed by CEE.
 * Used for one-tap improvements and suggested actions from /assist/v1/ask.
 *
 * IMPORTANT: Destructive actions (delete_node, delete_edge) require confirmation
 * unless skipConfirm option is passed.
 *
 * Usage:
 * const { applyAction, confirmDialog } = useModelActionApply()
 *
 * // Apply with confirmation for destructive actions
 * applyAction({ action_id: 'act_001', op: 'delete_node', target_id: 'n1' })
 * // -> Sets confirmDialog.isOpen = true
 *
 * // Skip confirmation (for undo/redo scenarios)
 * applyAction({ ... }, { skipConfirm: true })
 */

import { useCallback, useState } from 'react'
import { useCanvasStore } from '../store'
import { NODE_REGISTRY, type NodeType } from '../domain/nodes'
import type { ModelAction, ModelActionResult } from '../../types/primitives'
import type { EdgeData } from '../domain/edges'

// =============================================================================
// Types
// =============================================================================

export interface ApplyOptions {
  /** Skip confirmation dialog for destructive actions */
  skipConfirm?: boolean
}

export interface ConfirmDialogState {
  /** Whether dialog is open */
  isOpen: boolean

  /** Pending action awaiting confirmation */
  action: ModelAction | null

  /** Human-readable description of action */
  description: string

  /** Confirm the action */
  onConfirm: () => void

  /** Cancel the action */
  onCancel: () => void
}

interface UseModelActionApplyReturn {
  /** Apply a single ModelAction (may trigger confirm dialog for destructive ops) */
  applyAction: (action: ModelAction, options?: ApplyOptions) => ModelActionResult | 'pending'

  /** Apply multiple ModelActions in sequence */
  applyActions: (actions: ModelAction[], options?: ApplyOptions) => ModelActionResult[]

  /** Apply actions from CEE response */
  applyFromResponse: (actions: ModelAction[] | undefined, options?: ApplyOptions) => ModelActionResult[]

  /** Check if an action can be applied (validation) */
  canApplyAction: (action: ModelAction) => { valid: boolean; reason?: string }

  /** Check if an action is destructive */
  isDestructiveAction: (action: ModelAction) => boolean

  /** Confirm dialog state for rendering */
  confirmDialog: ConfirmDialogState
}

// =============================================================================
// Helper Functions
// =============================================================================

function isValidNodeType(type: unknown): type is NodeType {
  return typeof type === 'string' && type in NODE_REGISTRY
}

function randomPosition(): { x: number; y: number } {
  const baseX = 200
  const baseY = 200
  const variance = 50
  return {
    x: baseX + Math.random() * variance - variance / 2,
    y: baseY + Math.random() * variance - variance / 2,
  }
}

function getActionDescription(action: ModelAction): string {
  switch (action.op) {
    case 'delete_node': {
      const state = useCanvasStore.getState()
      const node = state.nodes.find(n => n.id === action.target_id)
      const label = node?.data?.label || action.target_id || 'this node'
      const connectedEdges = state.edges.filter(
        e => e.source === action.target_id || e.target === action.target_id
      )
      const edgeInfo = connectedEdges.length > 0
        ? ` and ${connectedEdges.length} connected edge${connectedEdges.length > 1 ? 's' : ''}`
        : ''
      return `Delete "${label}"${edgeInfo}?`
    }

    case 'delete_edge': {
      const state = useCanvasStore.getState()
      const edge = state.edges.find(e => e.id === action.target_id)
      if (edge) {
        const sourceNode = state.nodes.find(n => n.id === edge.source)
        const targetNode = state.nodes.find(n => n.id === edge.target)
        const sourceName = sourceNode?.data?.label || edge.source
        const targetName = targetNode?.data?.label || edge.target
        return `Delete connection from "${sourceName}" to "${targetName}"?`
      }
      return `Delete this connection?`
    }

    default:
      return `Apply ${action.op}?`
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useModelActionApply(): UseModelActionApplyReturn {
  const addNode = useCanvasStore(s => s.addNode)
  const updateNode = useCanvasStore(s => s.updateNode)
  const addEdge = useCanvasStore(s => s.addEdge)
  const updateEdge = useCanvasStore(s => s.updateEdge)
  const deleteNodeById = useCanvasStore(s => s.deleteNodeById)
  const deleteEdgeById = useCanvasStore(s => s.deleteEdgeById)
  const pushHistory = useCanvasStore(s => s.pushHistory)

  // Confirm dialog state
  const [pendingAction, setPendingAction] = useState<ModelAction | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  /**
   * Check if action is destructive
   */
  const isDestructiveAction = useCallback((action: ModelAction): boolean => {
    return action.op === 'delete_node' || action.op === 'delete_edge'
  }, [])

  /**
   * Validate if an action can be applied
   */
  const canApplyAction = useCallback((action: ModelAction): { valid: boolean; reason?: string } => {
    const state = useCanvasStore.getState()
    const { nodes, edges } = state

    switch (action.op) {
      case 'add_node': {
        const type = action.payload.type
        if (type && !isValidNodeType(type)) {
          return { valid: false, reason: `Invalid node type: ${type}` }
        }
        return { valid: true }
      }

      case 'add_edge': {
        const source = action.payload.source as string
        const target = action.payload.target as string
        if (!source || !target) {
          return { valid: false, reason: 'Edge requires source and target' }
        }
        const sourceExists = nodes.some(n => n.id === source)
        const targetExists = nodes.some(n => n.id === target)
        if (!sourceExists) {
          return { valid: false, reason: `Source node not found: ${source}` }
        }
        if (!targetExists) {
          return { valid: false, reason: `Target node not found: ${target}` }
        }
        return { valid: true }
      }

      case 'update_node': {
        if (!action.target_id) {
          return { valid: false, reason: 'update_node requires target_id' }
        }
        const nodeExists = nodes.some(n => n.id === action.target_id)
        if (!nodeExists) {
          return { valid: false, reason: `Node not found: ${action.target_id}` }
        }
        return { valid: true }
      }

      case 'update_edge': {
        if (!action.target_id) {
          return { valid: false, reason: 'update_edge requires target_id' }
        }
        const edgeExists = edges.some(e => e.id === action.target_id)
        if (!edgeExists) {
          return { valid: false, reason: `Edge not found: ${action.target_id}` }
        }
        return { valid: true }
      }

      case 'delete_node': {
        if (!action.target_id) {
          return { valid: false, reason: 'delete_node requires target_id' }
        }
        const nodeExists = nodes.some(n => n.id === action.target_id)
        if (!nodeExists) {
          return { valid: false, reason: `Node not found: ${action.target_id}` }
        }
        return { valid: true }
      }

      case 'delete_edge': {
        if (!action.target_id) {
          return { valid: false, reason: 'delete_edge requires target_id' }
        }
        const edgeExists = edges.some(e => e.id === action.target_id)
        if (!edgeExists) {
          return { valid: false, reason: `Edge not found: ${action.target_id}` }
        }
        return { valid: true }
      }

      default:
        return { valid: false, reason: `Unknown operation: ${action.op}` }
    }
  }, [])

  /**
   * Execute action (internal - no confirmation check)
   */
  const executeAction = useCallback((action: ModelAction): ModelActionResult => {
    // Validate first
    const validation = canApplyAction(action)
    if (!validation.valid) {
      return {
        success: false,
        action_id: action.action_id,
        error: validation.reason,
      }
    }

    try {
      switch (action.op) {
        case 'add_node': {
          const type = (action.payload.type as NodeType) || 'factor'
          const label = (action.payload.label as string) || 'New Node'
          const position = (action.payload.position as { x: number; y: number }) || randomPosition()

          addNode(position, type)

          const state = useCanvasStore.getState()
          const lastNode = state.nodes[state.nodes.length - 1]

          if (lastNode && (label || action.payload.description)) {
            updateNode(lastNode.id, {
              data: {
                ...lastNode.data,
                label,
                description: action.payload.description as string,
              },
            })
          }

          return {
            success: true,
            action_id: action.action_id,
            created_id: lastNode?.id,
          }
        }

        case 'add_edge': {
          const source = action.payload.source as string
          const target = action.payload.target as string
          const label = action.payload.label as string
          const confidence = action.payload.confidence as number

          const edgeData: Partial<EdgeData> = {}
          if (label) edgeData.label = label
          if (confidence !== undefined) edgeData.confidence = confidence

          addEdge({
            source,
            target,
            data: edgeData as EdgeData,
          })

          const state = useCanvasStore.getState()
          const lastEdge = state.edges[state.edges.length - 1]

          return {
            success: true,
            action_id: action.action_id,
            created_id: lastEdge?.id,
          }
        }

        case 'update_node': {
          const nodeId = action.target_id!
          const state = useCanvasStore.getState()
          const existingNode = state.nodes.find(n => n.id === nodeId)

          if (!existingNode) {
            return {
              success: false,
              action_id: action.action_id,
              error: `Node not found: ${nodeId}`,
            }
          }

          const updates: Record<string, unknown> = {}

          if (action.payload.type && isValidNodeType(action.payload.type)) {
            updates.type = action.payload.type
          }

          if (action.payload.label || action.payload.description || action.payload.uncertainty !== undefined) {
            updates.data = {
              ...existingNode.data,
              ...(action.payload.label && { label: action.payload.label }),
              ...(action.payload.description && { description: action.payload.description }),
              ...(action.payload.uncertainty !== undefined && { uncertainty: action.payload.uncertainty }),
            }
          }

          if (action.payload.position) {
            updates.position = action.payload.position
          }

          updateNode(nodeId, updates)

          return {
            success: true,
            action_id: action.action_id,
          }
        }

        case 'update_edge': {
          const edgeId = action.target_id!
          const updates: Record<string, unknown> = {}

          if (action.payload.label !== undefined ||
              action.payload.confidence !== undefined ||
              action.payload.weight !== undefined ||
              action.payload.kind !== undefined) {
            const state = useCanvasStore.getState()
            const existingEdge = state.edges.find(e => e.id === edgeId)

            updates.data = {
              ...existingEdge?.data,
              ...(action.payload.label !== undefined && { label: action.payload.label }),
              ...(action.payload.confidence !== undefined && { confidence: action.payload.confidence }),
              ...(action.payload.weight !== undefined && { weight: action.payload.weight }),
              ...(action.payload.kind !== undefined && { kind: action.payload.kind }),
            }
          }

          updateEdge(edgeId, updates)

          return {
            success: true,
            action_id: action.action_id,
          }
        }

        case 'delete_node': {
          const nodeId = action.target_id!

          // Use store action which properly handles history, selection, and edges
          deleteNodeById(nodeId)

          return {
            success: true,
            action_id: action.action_id,
          }
        }

        case 'delete_edge': {
          const edgeId = action.target_id!

          // Use store action which properly handles history and selection
          deleteEdgeById(edgeId)

          return {
            success: true,
            action_id: action.action_id,
          }
        }

        default:
          return {
            success: false,
            action_id: action.action_id,
            error: `Unknown operation: ${action.op}`,
          }
      }
    } catch (error) {
      return {
        success: false,
        action_id: action.action_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }, [addNode, updateNode, addEdge, updateEdge, deleteNodeById, deleteEdgeById, pushHistory, canApplyAction])

  /**
   * Apply a single ModelAction (may trigger confirm dialog)
   */
  const applyAction = useCallback((
    action: ModelAction,
    options: ApplyOptions = {}
  ): ModelActionResult | 'pending' => {
    // For destructive actions, require confirmation unless skipped
    if (isDestructiveAction(action) && !options.skipConfirm) {
      setPendingAction(action)
      setShowConfirm(true)
      return 'pending'
    }

    return executeAction(action)
  }, [isDestructiveAction, executeAction])

  /**
   * Confirm pending action
   */
  const confirmAction = useCallback(() => {
    if (pendingAction) {
      executeAction(pendingAction)
      setPendingAction(null)
      setShowConfirm(false)
    }
  }, [pendingAction, executeAction])

  /**
   * Cancel pending action
   */
  const cancelAction = useCallback(() => {
    setPendingAction(null)
    setShowConfirm(false)
  }, [])

  /**
   * Apply multiple ModelActions in sequence
   */
  const applyActions = useCallback((
    actions: ModelAction[],
    options: ApplyOptions = {}
  ): ModelActionResult[] => {
    pushHistory()
    return actions.map(action => {
      const result = applyAction(action, { ...options, skipConfirm: true })
      return result === 'pending'
        ? { success: false, action_id: action.action_id, error: 'Pending confirmation' }
        : result
    })
  }, [applyAction, pushHistory])

  /**
   * Apply actions from CEE response
   */
  const applyFromResponse = useCallback((
    actions: ModelAction[] | undefined,
    options: ApplyOptions = {}
  ): ModelActionResult[] => {
    if (!actions || actions.length === 0) return []
    return applyActions(actions, options)
  }, [applyActions])

  // Confirm dialog state object
  const confirmDialog: ConfirmDialogState = {
    isOpen: showConfirm,
    action: pendingAction,
    description: pendingAction ? getActionDescription(pendingAction) : '',
    onConfirm: confirmAction,
    onCancel: cancelAction,
  }

  return {
    applyAction,
    applyActions,
    applyFromResponse,
    canApplyAction,
    isDestructiveAction,
    confirmDialog,
  }
}

export default useModelActionApply
