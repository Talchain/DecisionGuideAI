/**
 * M4: Graph Repair
 * Deterministic fixes for validation issues
 */

import type { Node, Edge } from '@xyflow/react'
import type { ValidationIssue, RepairAction } from './types'

/**
 * Apply repair action to graph
 * Returns updated nodes and edges
 */
export function applyRepair(
  nodes: Node[],
  edges: Edge[],
  action: RepairAction
): { nodes: Node[]; edges: Edge[] } {
  switch (action.type) {
    case 'remove_node':
      return removeNode(nodes, edges, action.targetId)
    case 'remove_edge':
      return removeEdge(nodes, edges, action.targetId)
    case 'add_edge':
      return addEdge(nodes, edges, action.data)
    case 'update_node':
      return updateNode(nodes, edges, action.targetId, action.data)
    case 'update_edge':
      return updateEdge(nodes, edges, action.targetId, action.data)
    default:
      return { nodes, edges }
  }
}

/**
 * Apply multiple repairs in sequence (deterministic order)
 */
export function applyRepairs(
  nodes: Node[],
  edges: Edge[],
  issues: ValidationIssue[]
): { nodes: Node[]; edges: Edge[] } {
  let currentNodes = nodes
  let currentEdges = edges

  // Sort issues by type for deterministic application
  const sortedIssues = [...issues].sort((a, b) => {
    const order: Record<string, number> = {
      dangling_edge: 1,
      self_loop: 2,
      duplicate_edge: 3,
      cycle: 4,
      missing_label: 5,
      orphan_node: 6,
    }
    return (order[a.type] || 99) - (order[b.type] || 99)
  })

  for (const issue of sortedIssues) {
    if (issue.suggestedFix) {
      const result = applyRepair(currentNodes, currentEdges, issue.suggestedFix)
      currentNodes = result.nodes
      currentEdges = result.edges
    }
  }

  return { nodes: currentNodes, edges: currentEdges }
}

/**
 * Remove node and all connected edges
 */
function removeNode(nodes: Node[], edges: Edge[], nodeId: string): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: nodes.filter((n) => n.id !== nodeId),
    edges: edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
  }
}

/**
 * Remove edge by ID
 */
function removeEdge(nodes: Node[], edges: Edge[], edgeId: string): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes,
    edges: edges.filter((e) => e.id !== edgeId),
  }
}

/**
 * Add new edge
 */
function addEdge(nodes: Node[], edges: Edge[], edgeData: any): { nodes: Node[]; edges: Edge[] } {
  const newEdge: Edge = {
    id: edgeData.id || `edge-${Date.now()}`,
    source: edgeData.source,
    target: edgeData.target,
    data: edgeData.data || {},
  }

  return {
    nodes,
    edges: [...edges, newEdge],
  }
}

/**
 * Update node data
 */
function updateNode(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
  data: any
): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: nodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            data: { ...n.data, ...data },
          }
        : n
    ),
    edges,
  }
}

/**
 * Update edge data
 */
function updateEdge(
  nodes: Node[],
  edges: Edge[],
  edgeId: string,
  data: any
): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes,
    edges: edges.map((e) =>
      e.id === edgeId
        ? {
            ...e,
            data: { ...e.data, ...data },
          }
        : e
    ),
  }
}

/**
 * Quick fix all issues with suggested fixes
 */
export function quickFixAll(
  nodes: Node[],
  edges: Edge[],
  issues: ValidationIssue[]
): { nodes: Node[]; edges: Edge[]; fixedCount: number } {
  const fixableIssues = issues.filter((i) => i.suggestedFix)
  const result = applyRepairs(nodes, edges, fixableIssues)

  return {
    ...result,
    fixedCount: fixableIssues.length,
  }
}
