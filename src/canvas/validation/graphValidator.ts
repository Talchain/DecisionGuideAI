/**
 * M4: Graph Validator
 * Detects cycles, dangling edges, orphans, and other issues
 */

import type { Node, Edge } from '@xyflow/react'
import type { ValidationIssue, GraphHealth, IssueType, IssueSeverity } from './types'

/**
 * Validate entire graph and return issues
 */
export function validateGraph(nodes: Node[], edges: Edge[]): GraphHealth {
  const issues: ValidationIssue[] = []

  // M4: Detect cycles
  issues.push(...detectCycles(nodes, edges))

  // M4: Detect dangling edges (edges referencing non-existent nodes)
  issues.push(...detectDanglingEdges(nodes, edges))

  // M4: Detect orphan nodes (no connections)
  issues.push(...detectOrphanNodes(nodes, edges))

  // M4: Detect duplicate edges
  issues.push(...detectDuplicateEdges(edges))

  // M4: Detect self-loops
  issues.push(...detectSelfLoops(edges))

  // M4: Detect missing labels
  issues.push(...detectMissingLabels(nodes))

  // Calculate health score
  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const score = Math.max(0, 100 - errorCount * 20 - warningCount * 5)

  // Determine overall status
  let status: GraphHealth['status'] = 'healthy'
  if (errorCount > 0) status = 'errors'
  else if (warningCount > 0) status = 'warnings'

  return { status, issues, score }
}

/**
 * Detect cycles in the graph using DFS
 */
function detectCycles(nodes: Node[], edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const adjacency = buildAdjacencyList(edges)
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function dfs(nodeId: string, path: string[]): string[] | null {
    visited.add(nodeId)
    recursionStack.add(nodeId)

    const neighbors = adjacency.get(nodeId) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor, [...path, nodeId])
        if (cycle) return cycle
      } else if (recursionStack.has(neighbor)) {
        // Cycle detected
        return [...path, nodeId, neighbor]
      }
    }

    recursionStack.delete(nodeId)
    return null
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const cycle = dfs(node.id, [])
      if (cycle) {
        issues.push({
          id: `cycle-${cycle.join('-')}`,
          type: 'cycle',
          severity: 'error',
          message: `Cycle detected: ${cycle.join(' → ')}`,
          nodeIds: cycle,
          suggestedFix: {
            type: 'remove_edge',
            targetId: findEdgeId(edges, cycle[cycle.length - 2], cycle[cycle.length - 1]) || '',
          },
        })
      }
    }
  }

  return issues
}

/**
 * Detect dangling edges (edges with missing source or target)
 */
function detectDanglingEdges(nodes: Node[], edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const nodeIds = new Set(nodes.map((n) => n.id))

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        id: `dangling-${edge.id}`,
        type: 'dangling_edge',
        severity: 'error',
        message: `Edge ${edge.id} references non-existent node`,
        edgeIds: [edge.id],
        suggestedFix: {
          type: 'remove_edge',
          targetId: edge.id,
        },
      })
    }
  }

  return issues
}

/**
 * Detect orphan nodes (nodes with no edges)
 */
function detectOrphanNodes(nodes: Node[], edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const connectedNodes = new Set<string>()

  for (const edge of edges) {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  }

  for (const node of nodes) {
    if (!connectedNodes.has(node.id)) {
      issues.push({
        id: `orphan-${node.id}`,
        type: 'orphan_node',
        severity: 'warning',
        message: `Node "${node.data.label || node.id}" has no connections`,
        nodeIds: [node.id],
      })
    }
  }

  return issues
}

/**
 * Detect duplicate edges (same source/target pair)
 */
function detectDuplicateEdges(edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const edgeMap = new Map<string, string[]>()

  for (const edge of edges) {
    const key = `${edge.source}->${edge.target}`
    if (!edgeMap.has(key)) {
      edgeMap.set(key, [])
    }
    edgeMap.get(key)!.push(edge.id)
  }

  for (const [key, edgeIds] of edgeMap.entries()) {
    if (edgeIds.length > 1) {
      issues.push({
        id: `duplicate-${key}`,
        type: 'duplicate_edge',
        severity: 'warning',
        message: `Duplicate edges between same nodes: ${key}`,
        edgeIds,
        suggestedFix: {
          type: 'remove_edge',
          targetId: edgeIds[1], // Keep first, remove duplicates
        },
      })
    }
  }

  return issues
}

/**
 * Detect self-loops (edges from node to itself)
 */
function detectSelfLoops(edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const edge of edges) {
    if (edge.source === edge.target) {
      issues.push({
        id: `self-loop-${edge.id}`,
        type: 'self_loop',
        severity: 'warning',
        message: `Edge ${edge.id} loops back to same node`,
        edgeIds: [edge.id],
        suggestedFix: {
          type: 'remove_edge',
          targetId: edge.id,
        },
      })
    }
  }

  return issues
}

/**
 * Detect nodes with missing labels
 */
function detectMissingLabels(nodes: Node[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const node of nodes) {
    if (!node.data.label || node.data.label.trim() === '') {
      issues.push({
        id: `missing-label-${node.id}`,
        type: 'missing_label',
        severity: 'info',
        message: `Node ${node.id} has no label`,
        nodeIds: [node.id],
        suggestedFix: {
          type: 'update_node',
          targetId: node.id,
          data: { label: `Node ${node.id}` },
        },
      })
    }
  }

  return issues
}

/**
 * Helper: Build adjacency list from edges
 */
function buildAdjacencyList(edges: Edge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()

  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, [])
    }
    adjacency.get(edge.source)!.push(edge.target)
  }

  return adjacency
}

/**
 * Helper: Find edge ID by source and target
 */
function findEdgeId(edges: Edge[], source: string, target: string): string | undefined {
  return edges.find((e) => e.source === source && e.target === target)?.id
}
