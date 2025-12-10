/**
 * Auto-Fix Utilities for Common Graph Validation Issues
 *
 * Provides one-click fixes for common validation issues with optimistic UI updates.
 * Each fixer returns a result indicating success/failure and the updated graph state.
 */

import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'
import { DEFAULT_EDGE_DATA } from '../domain/edges'

export interface AutoFixResult {
  success: boolean
  message: string
  updatedNodes?: Node[]
  updatedEdges?: Edge<EdgeData>[]
}

export type AutoFixType =
  | 'normalize_probabilities'
  | 'add_risk'
  | 'add_factor'
  | 'connect_orphan'
  | 'remove_cycle'

/**
 * Auto-fix parameters passed from ValidationPanel
 */
export interface AutoFixParams {
  fixType: AutoFixType
  nodeId?: string
  edgeId?: string
  targetId?: string
}

/**
 * Normalizes outgoing edge probabilities (confidence) to sum to 100%
 *
 * Note: `confidence` is the branch probability field (0-1, should sum to 1).
 * This is distinct from `belief` which represents epistemic uncertainty.
 *
 * Strategy:
 * - If ALL edges have non-zero confidence: scale proportionally to sum to 100%
 * - If SOME edges have zero/undefined confidence: distribute evenly across ALL edges
 *   (This ensures no edges are left at 0% which would fail backend validation)
 *
 * @param nodeId - Node with probability sum issue
 * @param edges - Current edge list
 * @returns AutoFixResult with updated edges
 */
export function normalizeProbabilities(
  nodeId: string,
  edges: Edge<EdgeData>[]
): AutoFixResult {
  const outgoingEdges = edges.filter(e => e.source === nodeId)

  if (outgoingEdges.length === 0) {
    return { success: false, message: 'No outgoing edges to normalize' }
  }

  // Count edges with meaningful (non-zero) confidence
  const confidenceValues = outgoingEdges.map(e => (e.data as EdgeData)?.confidence ?? 0)
  const nonZeroCount = confidenceValues.filter(c => c > 0).length
  const total = confidenceValues.reduce((sum, c) => sum + c, 0)

  // If any edges have zero/undefined confidence, OR total is 0,
  // distribute evenly to ensure all branches have valid probabilities
  const shouldDistributeEvenly = total === 0 || nonZeroCount < outgoingEdges.length

  if (shouldDistributeEvenly) {
    const evenConfidence = 1 / outgoingEdges.length
    const updatedEdges = edges.map(edge => {
      if (edge.source === nodeId) {
        return {
          ...edge,
          data: {
            ...((edge.data as EdgeData) || {}),
            confidence: evenConfidence,
          },
        }
      }
      return edge
    })

    const percentage = Math.round(evenConfidence * 100)
    return {
      success: true,
      message: `Set all ${outgoingEdges.length} edges to ${percentage}% each (totaling 100%)`,
      updatedEdges,
    }
  }

  // All edges have non-zero confidence - normalize proportionally
  const updatedEdges = edges.map(edge => {
    if (edge.source === nodeId) {
      const currentConfidence = (edge.data as EdgeData)?.confidence ?? 0
      const normalizedConfidence = currentConfidence / total
      return {
        ...edge,
        data: {
          ...((edge.data as EdgeData) || {}),
          confidence: normalizedConfidence,
        },
      }
    }
    return edge
  })

  return {
    success: true,
    message: `Normalized ${outgoingEdges.length} edge probabilities to 100%`,
    updatedEdges,
  }
}

/**
 * Adds a Risk node connected to the specified goal node
 *
 * @param goalId - Goal node to connect the risk to
 * @param nodes - Current node list
 * @param edges - Current edge list
 * @returns AutoFixResult with new node and edge
 */
export function addRiskNode(
  goalId: string,
  nodes: Node[],
  edges: Edge<EdgeData>[]
): AutoFixResult {
  const goalNode = nodes.find(n => n.id === goalId)

  if (!goalNode) {
    return { success: false, message: 'Goal node not found' }
  }

  const newRiskId = `risk_${Date.now()}`

  const newRisk: Node = {
    id: newRiskId,
    type: 'risk',
    data: {
      label: 'New Risk',
      kind: 'RISK',
    },
    position: {
      x: goalNode.position.x - 200,
      y: goalNode.position.y + 100,
    },
  }

  const newEdge: Edge<EdgeData> = {
    id: `${newRiskId}-${goalId}`,
    source: newRiskId,
    target: goalId,
    type: 'styled',
    data: {
      ...DEFAULT_EDGE_DATA,
      confidence: 1, // Single outgoing edge = 100% probability
      belief: 0.5,   // Default epistemic uncertainty
    },
  }

  return {
    success: true,
    message: 'Added Risk node - click to edit label',
    updatedNodes: [...nodes, newRisk],
    updatedEdges: [...edges, newEdge],
  }
}

/**
 * Adds a Factor node connected to the specified target node
 *
 * @param targetId - Target node to connect the factor to
 * @param nodes - Current node list
 * @param edges - Current edge list
 * @returns AutoFixResult with new node and edge
 */
export function addFactorNode(
  targetId: string,
  nodes: Node[],
  edges: Edge<EdgeData>[]
): AutoFixResult {
  const targetNode = nodes.find(n => n.id === targetId)

  if (!targetNode) {
    return { success: false, message: 'Target node not found' }
  }

  const newFactorId = `factor_${Date.now()}`

  const newFactor: Node = {
    id: newFactorId,
    type: 'factor',
    data: {
      label: 'New Factor',
      kind: 'FACTOR',
    },
    position: {
      x: targetNode.position.x - 180,
      y: targetNode.position.y + 80,
    },
  }

  const newEdge: Edge<EdgeData> = {
    id: `${newFactorId}-${targetId}`,
    source: newFactorId,
    target: targetId,
    type: 'styled',
    data: {
      ...DEFAULT_EDGE_DATA,
      confidence: 1, // Single outgoing edge = 100% probability
      belief: 0.5,   // Default epistemic uncertainty
    },
  }

  return {
    success: true,
    message: 'Added Factor node - click to edit label',
    updatedNodes: [...nodes, newFactor],
    updatedEdges: [...edges, newEdge],
  }
}

/**
 * Connects an orphan node to the nearest goal or decision node
 *
 * @param orphanId - The orphan node ID
 * @param nodes - Current node list
 * @param edges - Current edge list
 * @returns AutoFixResult with new edge
 */
export function connectOrphanNode(
  orphanId: string,
  nodes: Node[],
  edges: Edge<EdgeData>[]
): AutoFixResult {
  const orphanNode = nodes.find(n => n.id === orphanId)

  if (!orphanNode) {
    return { success: false, message: 'Orphan node not found' }
  }

  // Find potential target nodes (goals or decisions)
  const targetNodes = nodes.filter(
    n => (n.type === 'goal' || n.type === 'decision' || n.type === 'outcome') && n.id !== orphanId
  )

  if (targetNodes.length === 0) {
    return { success: false, message: 'No target nodes available to connect' }
  }

  // Find the nearest target node
  let nearestTarget = targetNodes[0]
  let minDistance = Infinity

  for (const target of targetNodes) {
    const dx = target.position.x - orphanNode.position.x
    const dy = target.position.y - orphanNode.position.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < minDistance) {
      minDistance = distance
      nearestTarget = target
    }
  }

  const newEdge: Edge<EdgeData> = {
    id: `${orphanId}-${nearestTarget.id}`,
    source: orphanId,
    target: nearestTarget.id,
    type: 'styled',
    data: {
      ...DEFAULT_EDGE_DATA,
      confidence: 1, // Default to 100% for single connection
      belief: 0.5,   // Default epistemic uncertainty
    },
  }

  return {
    success: true,
    message: `Connected to "${(nearestTarget.data as { label?: string })?.label || nearestTarget.id}"`,
    updatedEdges: [...edges, newEdge],
  }
}

/**
 * Determines the appropriate fix type based on critique item code
 */
export function determineFixType(code: string): AutoFixType | null {
  const codeUpper = code.toUpperCase()

  if (codeUpper.includes('PROBABILITY') || codeUpper.includes('SUM') || codeUpper.includes('BELIEF')) {
    return 'normalize_probabilities'
  }

  if (codeUpper.includes('ORPHAN') || codeUpper.includes('UNCONNECTED') || codeUpper.includes('DANGLING')) {
    return 'connect_orphan'
  }

  if (codeUpper.includes('NO_RISK') || codeUpper.includes('MISSING_RISK')) {
    return 'add_risk'
  }

  if (codeUpper.includes('NO_FACTOR') || codeUpper.includes('MISSING_FACTOR')) {
    return 'add_factor'
  }

  return null
}

/**
 * Main auto-fix dispatcher - executes the appropriate fix based on params
 */
export function executeAutoFix(
  params: AutoFixParams,
  nodes: Node[],
  edges: Edge<EdgeData>[]
): AutoFixResult {
  switch (params.fixType) {
    case 'normalize_probabilities':
      if (!params.nodeId) {
        return { success: false, message: 'Node ID required for probability normalization' }
      }
      return normalizeProbabilities(params.nodeId, edges)

    case 'add_risk':
      if (!params.nodeId) {
        return { success: false, message: 'Goal node ID required to add risk' }
      }
      return addRiskNode(params.nodeId, nodes, edges)

    case 'add_factor':
      if (!params.targetId && !params.nodeId) {
        return { success: false, message: 'Target node ID required to add factor' }
      }
      return addFactorNode(params.targetId || params.nodeId!, nodes, edges)

    case 'connect_orphan':
      if (!params.nodeId) {
        return { success: false, message: 'Orphan node ID required' }
      }
      return connectOrphanNode(params.nodeId, nodes, edges)

    default:
      return { success: false, message: `Unknown fix type: ${params.fixType}` }
  }
}
