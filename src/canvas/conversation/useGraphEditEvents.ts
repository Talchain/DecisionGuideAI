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
import { isOrchestratorV2Enabled, isJourneyTabEnabled } from '../../flags'
import { useGuidanceStore } from '../stores/guidanceStore'
import { appendEvent } from '../../services/scenarioService'
import { resolveElementLabel } from './utils/resolveElementLabel'
import type { WireSystemEvent } from './types'
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

type ElementOp = 'add' | 'update' | 'remove'

interface DiffAccumulator {
  changedNodeIds: Set<string>
  changedEdgeIds: Set<string>
  operations: Set<ElementOp>
  /** Per-element operation for deterministic change_type in scenario events */
  nodeOps: Map<string, ElementOp>
  edgeOps: Map<string, ElementOp>
  /** Changed field names per element (top-level data keys that differ) */
  fieldsChanged: Map<string, Set<string>>
}

/** Extract top-level data keys that differ between two serialised JSON strings */
function extractChangedFields(prevJson: string, currJson: string): string[] {
  try {
    const prev = JSON.parse(prevJson)
    const curr = JSON.parse(currJson)
    const prevData = prev.data ?? {}
    const currData = curr.data ?? {}
    const keys = new Set([...Object.keys(prevData), ...Object.keys(currData)])
    const changed: string[] = []
    for (const key of keys) {
      if (JSON.stringify(prevData[key]) !== JSON.stringify(currData[key])) {
        changed.push(key)
      }
    }
    return changed
  } catch {
    return []
  }
}

function diffSnapshots(prev: GraphSnapshot, curr: GraphSnapshot): DiffAccumulator | null {
  const diff: DiffAccumulator = {
    changedNodeIds: new Set(),
    changedEdgeIds: new Set(),
    operations: new Set(),
    nodeOps: new Map(),
    edgeOps: new Map(),
    fieldsChanged: new Map(),
  }

  // Node diffs
  for (const [id, data] of curr.nodes) {
    if (!prev.nodes.has(id)) {
      diff.changedNodeIds.add(id)
      diff.operations.add('add')
      diff.nodeOps.set(id, 'add')
    } else if (prev.nodes.get(id) !== data) {
      diff.changedNodeIds.add(id)
      diff.operations.add('update')
      diff.nodeOps.set(id, 'update')
      diff.fieldsChanged.set(id, new Set(extractChangedFields(prev.nodes.get(id)!, data)))
    }
  }
  for (const id of prev.nodes.keys()) {
    if (!curr.nodes.has(id)) {
      diff.changedNodeIds.add(id)
      diff.operations.add('remove')
      diff.nodeOps.set(id, 'remove')
    }
  }

  // Edge diffs
  for (const [id, data] of curr.edges) {
    if (!prev.edges.has(id)) {
      diff.changedEdgeIds.add(id)
      diff.operations.add('add')
      diff.edgeOps.set(id, 'add')
    } else if (prev.edges.get(id) !== data) {
      diff.changedEdgeIds.add(id)
      diff.operations.add('update')
      diff.edgeOps.set(id, 'update')
      diff.fieldsChanged.set(id, new Set(extractChangedFields(prev.edges.get(id)!, data)))
    }
  }
  for (const id of prev.edges.keys()) {
    if (!curr.edges.has(id)) {
      diff.changedEdgeIds.add(id)
      diff.operations.add('remove')
      diff.edgeOps.set(id, 'remove')
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
  // Returns `unknown` rather than `void`: `sendSystemEvent` now resolves to a
  // SEND_DEFERRED sentinel when the in-flight lock queued the send. This hook
  // is a fire-and-forget notification emitter and does not act on the outcome,
  // so it only needs to accept a resolving promise of any shape — widening here
  // avoids forcing the sentinel type through every unrelated consumer.
  sendSystemEvent: (event: WireSystemEvent) => Promise<unknown>,
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

      // A.7: Skip accumulation during external mutations (patch-apply, hydration, envelope-apply).
      // Update snapshot so we don't diff against stale state once suppression ends.
      if (curr._externalMutationActive > 0) {
        snapshotRef.current = takeSnapshot(curr.nodes, curr.edges)
        return
      }

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

      // Clear guidance immediately on structural change (before debounce fires).
      // Direct model edits invalidate all guidance — drop everything now so stale
      // items don't persist during the 1.5s debounce window.
      useGuidanceStore.getState().clearGuidanceItems()

      // Accumulate changes
      if (!accRef.current) {
        accRef.current = {
          changedNodeIds: new Set(),
          changedEdgeIds: new Set(),
          operations: new Set(),
          nodeOps: new Map(),
          edgeOps: new Map(),
          fieldsChanged: new Map(),
        }
      }
      const acc = accRef.current
      for (const id of diff.changedNodeIds) acc.changedNodeIds.add(id)
      for (const id of diff.changedEdgeIds) acc.changedEdgeIds.add(id)
      for (const op of diff.operations) acc.operations.add(op)
      for (const [id, op] of diff.nodeOps) acc.nodeOps.set(id, op)
      for (const [id, op] of diff.edgeOps) acc.edgeOps.set(id, op)
      for (const [id, fields] of diff.fieldsChanged) {
        const existing = acc.fieldsChanged.get(id)
        if (existing) { for (const f of fields) existing.add(f) }
        else acc.fieldsChanged.set(id, new Set(fields))
      }

      // Update snapshot for next comparison
      snapshotRef.current = currSnapshot

      // Reset debounce timer
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (!accRef.current) return

        const batchAcc = accRef.current
        accRef.current = null

        // Cap IDs to prevent pathological payloads; sort for deterministic payloads
        const changedNodeIds = [...batchAcc.changedNodeIds].sort().slice(0, MAX_IDS_PER_BATCH)
        const changedEdgeIds = [...batchAcc.changedEdgeIds].sort().slice(0, MAX_IDS_PER_BATCH)
        const operations = [...batchAcc.operations].sort()

        // Per-element fields_changed map (id → sorted field names)
        const fieldsChangedMap: Record<string, string[]> = {}
        for (const [id, fields] of batchAcc.fieldsChanged) {
          if (fields.size > 0) fieldsChangedMap[id] = [...fields].sort()
        }

        // Best-effort background sync: sendSystemEvent now REJECTS on a failed
        // POST (SystemEventSendError). This debounced edit-mirror has no
        // user-facing surface, so consume the rejection here to avoid an
        // unhandled promise rejection — same best-effort `.catch()` pattern as
        // the sibling appendEvent calls below. Promise.resolve() coerces the
        // injected dispatcher's return so a non-thenable stub can't throw here.
        void Promise.resolve(
          sendSystemEvent({
            type: 'direct_graph_edit',
            payload: {
              changed_node_ids: changedNodeIds,
              changed_edge_ids: changedEdgeIds,
              operations,
              fields_changed: fieldsChangedMap,
              summary: buildSummary(batchAcc),
            },
          }),
        ).catch((err) => {
          if (import.meta.env.DEV) {
            console.warn('[useGraphEditEvents] direct_graph_edit sync failed (best-effort):', err)
          }
        })

        // Emit direct_edit scenario events with target_label (Journey tab data).
        // Gated on journeyTab flag, not threadPersist — these feed the timeline.
        // Best-effort: errors are caught and logged, never affect the UI.
        if (isJourneyTabEnabled() && scenarioIdRef.current) {
          const sid = scenarioIdRef.current
          const { nodes: currentNodes, edges: currentEdges } = useCanvasStore.getState()

          // Emit per-element events, capped at 5 total
          const MAX_EVENTS = 5
          let emitted = 0

          for (const nodeId of changedNodeIds) {
            if (emitted >= MAX_EVENTS) break
            const nodeOp = batchAcc.nodeOps.get(nodeId) ?? 'update'
            const changeType = nodeOp === 'add' ? 'add_node'
              : nodeOp === 'remove' ? 'remove_node'
              : 'update_node'
            void appendEvent(sid, crypto.randomUUID(), 'direct_edit', {
              change_type: changeType,
              target_id: nodeId,
              target_label: resolveElementLabel(nodeId, currentNodes, currentEdges),
            }).catch(() => {/* best-effort */})
            emitted++
          }
          for (const edgeId of changedEdgeIds) {
            if (emitted >= MAX_EVENTS) break
            const edgeOp = batchAcc.edgeOps.get(edgeId) ?? 'update'
            const changeType = edgeOp === 'add' ? 'add_edge'
              : edgeOp === 'remove' ? 'remove_edge'
              : 'update_edge'
            void appendEvent(sid, crypto.randomUUID(), 'direct_edit', {
              change_type: changeType,
              target_id: edgeId,
              target_label: resolveElementLabel(edgeId, currentNodes, currentEdges),
            }).catch(() => {/* best-effort */})
            emitted++
          }
        }
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
