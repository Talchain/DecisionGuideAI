/**
 * useGraphEditEvents — Debounced system events for canvas graph mutations
 *
 * Subscribes to canvas store and detects structural changes (add/remove/update
 * nodes and edges). Position-only changes are excluded. Batches changes during
 * a 1.5-second debounce window, then sends a `direct_graph_edit` system event
 * to the orchestrator.
 *
 * Only active when `VITE_ENABLE_ORCHESTRATOR_V2` is ON.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { isOrchestratorV2Enabled } from '../../flags'
import type { SystemEvent } from './types'
import type { Node, Edge } from '@xyflow/react'

const DEBOUNCE_MS = 1500
const MAX_IDS_PER_BATCH = 50

interface GraphSnapshot {
  /** Map of node id → serialised structural data (excludes position) */
  nodes: Map<string, string>
  /** Map of edge id → serialised data */
  edges: Map<string, string>
}

/** Serialise a node's structural data (excludes position/selected/dragging) */
function serialiseNode(node: Node): string {
  // Only structural fields: type, data (label, kind, observedState, etc.)
  return JSON.stringify({ type: node.type, data: node.data })
}

/** Serialise an edge's structural data */
function serialiseEdge(edge: Edge): string {
  return JSON.stringify({ source: edge.source, target: edge.target, data: edge.data })
}

function takeSnapshot(nodes: Node[], edges: Edge[]): GraphSnapshot {
  const nodeMap = new Map<string, string>()
  for (const n of nodes) nodeMap.set(n.id, serialiseNode(n))
  const edgeMap = new Map<string, string>()
  for (const e of edges) edgeMap.set(e.id, serialiseEdge(e))
  return { nodes: nodeMap, edges: edgeMap }
}

interface DiffAccumulator {
  changedNodeIds: Set<string>
  changedEdgeIds: Set<string>
  operations: Set<'add' | 'update' | 'remove'>
}

function diffSnapshots(prev: GraphSnapshot, curr: GraphSnapshot): DiffAccumulator | null {
  const diff: DiffAccumulator = {
    changedNodeIds: new Set(),
    changedEdgeIds: new Set(),
    operations: new Set(),
  }

  // Node diffs
  for (const [id, data] of curr.nodes) {
    if (!prev.nodes.has(id)) {
      diff.changedNodeIds.add(id)
      diff.operations.add('add')
    } else if (prev.nodes.get(id) !== data) {
      diff.changedNodeIds.add(id)
      diff.operations.add('update')
    }
  }
  for (const id of prev.nodes.keys()) {
    if (!curr.nodes.has(id)) {
      diff.changedNodeIds.add(id)
      diff.operations.add('remove')
    }
  }

  // Edge diffs
  for (const [id, data] of curr.edges) {
    if (!prev.edges.has(id)) {
      diff.changedEdgeIds.add(id)
      diff.operations.add('add')
    } else if (prev.edges.get(id) !== data) {
      diff.changedEdgeIds.add(id)
      diff.operations.add('update')
    }
  }
  for (const id of prev.edges.keys()) {
    if (!curr.edges.has(id)) {
      diff.changedEdgeIds.add(id)
      diff.operations.add('remove')
    }
  }

  const hasChanges = diff.changedNodeIds.size > 0 || diff.changedEdgeIds.size > 0
  return hasChanges ? diff : null
}

function buildSummary(acc: DiffAccumulator): string {
  const parts: string[] = []
  const nodeCount = acc.changedNodeIds.size
  const edgeCount = acc.changedEdgeIds.size

  if (nodeCount > 0) {
    const ops = [...acc.operations].filter(op =>
      // Determine which ops apply to nodes (simplified — we just list the operations present)
      true,
    )
    parts.push(`${nodeCount} node${nodeCount !== 1 ? 's' : ''} changed`)
  }
  if (edgeCount > 0) {
    parts.push(`${edgeCount} edge${edgeCount !== 1 ? 's' : ''} changed`)
  }

  return parts.join(', ')
}

/**
 * Hook that subscribes to canvas store mutations and sends debounced
 * `direct_graph_edit` system events.
 *
 * @param sendSystemEvent - The sendSystemEvent function from useConversation
 */
export function useGraphEditEvents(
  sendSystemEvent: (event: SystemEvent) => Promise<void>,
): void {
  const snapshotRef = useRef<GraphSnapshot | null>(null)
  const accRef = useRef<DiffAccumulator | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scenarioIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isOrchestratorV2Enabled()) return

    // Take initial snapshot
    const state = useCanvasStore.getState()
    snapshotRef.current = takeSnapshot(state.nodes, state.edges)
    scenarioIdRef.current = state.currentScenarioId

    const unsubscribe = useCanvasStore.subscribe((curr, prev) => {
      // Scenario switch — reset everything
      if (curr.currentScenarioId !== scenarioIdRef.current) {
        scenarioIdRef.current = curr.currentScenarioId
        snapshotRef.current = takeSnapshot(curr.nodes, curr.edges)
        accRef.current = null
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        return
      }

      // Skip if same reference (no change)
      if (curr.nodes === prev.nodes && curr.edges === prev.edges) return

      const prevSnapshot = snapshotRef.current
      if (!prevSnapshot) {
        snapshotRef.current = takeSnapshot(curr.nodes, curr.edges)
        return
      }

      const currSnapshot = takeSnapshot(curr.nodes, curr.edges)
      const diff = diffSnapshots(prevSnapshot, currSnapshot)

      if (!diff) {
        // Position-only change — update snapshot but don't trigger event
        snapshotRef.current = currSnapshot
        return
      }

      // Accumulate changes
      if (!accRef.current) {
        accRef.current = {
          changedNodeIds: new Set(),
          changedEdgeIds: new Set(),
          operations: new Set(),
        }
      }
      const acc = accRef.current
      for (const id of diff.changedNodeIds) acc.changedNodeIds.add(id)
      for (const id of diff.changedEdgeIds) acc.changedEdgeIds.add(id)
      for (const op of diff.operations) acc.operations.add(op)

      // Update snapshot for next comparison
      snapshotRef.current = currSnapshot

      // Reset debounce timer
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (!accRef.current) return

        const batchAcc = accRef.current
        accRef.current = null

        // Cap IDs to prevent pathological payloads
        const changedNodeIds = [...batchAcc.changedNodeIds].slice(0, MAX_IDS_PER_BATCH)
        const changedEdgeIds = [...batchAcc.changedEdgeIds].slice(0, MAX_IDS_PER_BATCH)

        sendSystemEvent({
          type: 'direct_graph_edit',
          payload: {
            changed_node_ids: changedNodeIds,
            changed_edge_ids: changedEdgeIds,
            operations: [...batchAcc.operations],
            summary: buildSummary(batchAcc),
          },
        })
      }, DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      accRef.current = null
    }
  }, [sendSystemEvent])
}
