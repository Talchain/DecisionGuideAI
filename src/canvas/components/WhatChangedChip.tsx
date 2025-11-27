/**
 * S6-COMPARE: What Changed Chip
 *
 * Shows summary of graph changes from previous run:
 * - Nodes: +2, -1, ~3 (added, removed, modified)
 * - Edges: +1, ~2
 *
 * Clickable to highlight changes on canvas
 */

import { useCanvasStore } from '../store'
import { loadRuns } from '../store/runHistory'
import { useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { typography } from '../../styles/typography'

interface GraphDiff {
  nodes: {
    added: number
    removed: number
    modified: number
  }
  edges: {
    added: number
    removed: number
    modified: number
  }
}

function computeGraphDiff(
  currentNodes: Node[],
  currentEdges: Edge[],
  previousNodes: Node[],
  previousEdges: Edge[]
): GraphDiff {
  const diff: GraphDiff = {
    nodes: { added: 0, removed: 0, modified: 0 },
    edges: { added: 0, removed: 0, modified: 0 }
  }

  // Build maps for efficient lookup
  const currentNodeMap = new Map(currentNodes.map(n => [n.id, n]))
  const previousNodeMap = new Map(previousNodes.map(n => [n.id, n]))

  // Check nodes
  for (const node of currentNodes) {
    if (!previousNodeMap.has(node.id)) {
      diff.nodes.added++
    } else {
      // Check if modified (label or position changed)
      const prev = previousNodeMap.get(node.id)!
      const labelChanged = node.data?.label !== prev.data?.label
      const posChanged = node.position.x !== prev.position.x || node.position.y !== prev.position.y
      if (labelChanged || posChanged) {
        diff.nodes.modified++
      }
    }
  }

  for (const node of previousNodes) {
    if (!currentNodeMap.has(node.id)) {
      diff.nodes.removed++
    }
  }

  // Build edge maps
  const currentEdgeMap = new Map(currentEdges.map(e => [e.id, e]))
  const previousEdgeMap = new Map(previousEdges.map(e => [e.id, e]))

  // Check edges
  for (const edge of currentEdges) {
    if (!previousEdgeMap.has(edge.id)) {
      diff.edges.added++
    } else {
      // Check if modified (weight or belief changed)
      const prev = previousEdgeMap.get(edge.id)!
      const weightChanged = edge.data?.weight !== prev.data?.weight
      const beliefChanged = edge.data?.belief !== prev.data?.belief
      if (weightChanged || beliefChanged) {
        diff.edges.modified++
      }
    }
  }

  for (const edge of previousEdges) {
    if (!currentEdgeMap.has(edge.id)) {
      diff.edges.removed++
    }
  }

  return diff
}

export function WhatChangedChip() {
  // React #185 FIX: Use shallow comparison for array selectors
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  const diff = useMemo(() => {
    const runs = loadRuns()
    if (runs.length < 2) {
      return null // Need at least 2 runs to compare
    }

    // Compare current graph with previous run
    const previousRun = runs[runs.length - 2] // Second to last run
    const previousNodes = previousRun.graph?.nodes ?? []
    const previousEdges = previousRun.graph?.edges ?? []

    return computeGraphDiff(nodes, edges, previousNodes, previousEdges)
  }, [nodes, edges])

  if (!diff) {
    return null // No previous run to compare
  }

  const totalChanges =
    diff.nodes.added + diff.nodes.removed + diff.nodes.modified +
    diff.edges.added + diff.edges.removed + diff.edges.modified

  if (totalChanges === 0) {
    return null // No changes
  }

  // Format change summary
  const parts: string[] = []

  if (diff.nodes.added > 0 || diff.nodes.removed > 0 || diff.nodes.modified > 0) {
    const nodeParts: string[] = []
    if (diff.nodes.added > 0) nodeParts.push(`+${diff.nodes.added}`)
    if (diff.nodes.removed > 0) nodeParts.push(`-${diff.nodes.removed}`)
    if (diff.nodes.modified > 0) nodeParts.push(`~${diff.nodes.modified}`)
    parts.push(`Nodes: ${nodeParts.join(', ')}`)
  }

  if (diff.edges.added > 0 || diff.edges.removed > 0 || diff.edges.modified > 0) {
    const edgeParts: string[] = []
    if (diff.edges.added > 0) edgeParts.push(`+${diff.edges.added}`)
    if (diff.edges.removed > 0) edgeParts.push(`-${diff.edges.removed}`)
    if (diff.edges.modified > 0) edgeParts.push(`~${diff.edges.modified}`)
    parts.push(`Edges: ${edgeParts.join(', ')}`)
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 ${typography.caption} font-medium`}
      role="status"
      aria-label={`Graph changed: ${parts.join(' • ')}`}
      data-testid="what-changed-chip"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
      <span>What changed: {parts.join(' • ')}</span>
    </div>
  )
}
