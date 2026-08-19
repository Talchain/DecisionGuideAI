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

export interface DiffAccumulator {
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

/**
 * Drop from a diff the removals a `structural_delete` intent has already
 * claimed, so one gesture produces one turn.
 *
 * Bound by IDENTITY — the intent's exact node ids and exact canvas edge ids —
 * never by "this diff contains removals". A gesture that removed A while an
 * unrelated producer removed B must still report B.
 *
 * The op check is load-bearing in the other direction too: an id that was
 * REMOVED by the gesture and ADDED back by something else in the same debounce
 * window is a genuine add and stays.
 */
export function removeStructuralDeleteClaims(
  diff: DiffAccumulator,
  pending: ReadonlyArray<{
    claimedNodeIds: readonly string[]
    claimedEdgeIds: readonly string[]
  }>,
): void {
  if (pending.length === 0) return
  for (const intent of pending) {
    for (const id of intent.claimedNodeIds) {
      if (diff.nodeOps.get(id) !== 'remove') continue
      diff.changedNodeIds.delete(id)
      diff.nodeOps.delete(id)
      diff.fieldsChanged.delete(id)
    }
    for (const id of intent.claimedEdgeIds) {
      if (diff.edgeOps.get(id) !== 'remove') continue
      diff.changedEdgeIds.delete(id)
      diff.edgeOps.delete(id)
      diff.fieldsChanged.delete(id)
    }
  }
  // `operations` is a set of op KINDS, not of ids, so it must be re-derived
  // from what survived — leaving a stale 'remove' would tell CEE a removal
  // happened that this notification no longer names.
  diff.operations.clear()
  for (const op of diff.nodeOps.values()) diff.operations.add(op)
  for (const op of diff.edgeOps.values()) diff.operations.add(op)
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
      // ── schemas 0.48.0 — ONE GESTURE, ONE TURN ────────────────────────────
      //
      // A canvas delete is now carried by `structural_delete`, which the store
      // records SYNCHRONOUSLY (in its own set(), immediately before the removal
      // set() this callback is observing — so the queue is guaranteed populated
      // here, and guaranteed drained long before the 1.5 s debounce fires).
      //
      // Without this subtraction the same deletion would reach CEE twice: once
      // as the durable removal and once as a `direct_graph_edit` claiming the
      // same ids changed. Two turns describing one gesture is the second-
      // authority defect this estate pays for most often, and the notification
      // half is the one CEE classifies 'ack_and_commit' — the very
      // no-graph-write path the durable verb exists to replace.
      //
      // ⚠ SUBTRACTS ONLY WHAT WAS ACTUALLY CLAIMED, by id. When the capture
      // stands down (no CEE `graph_hash` yet — see structuralDelete.ts's KNOWN
      // GAP) no intent exists, nothing is subtracted, and the notification
      // still carries the removal exactly as it does today. The fallback is
      // preserved rather than replaced.
      if (!diff) {
        // Position-only change — update snapshot but don't trigger event
        snapshotRef.current = currSnapshot
        return
      }

      // Clear guidance immediately on structural change (before debounce fires).
      // Direct model edits invalidate all guidance — drop everything now so stale
      // items don't persist during the 1.5s debounce window.
      //
      // ⚠ BEFORE THE CLAIM SUBTRACTION, DELIBERATELY. Guidance invalidation is a
      // statement about the MODEL having changed, not about which turn reports
      // it — a delete carried by `structural_delete` invalidates guidance every
      // bit as much as one carried by the notification. Moving this below the
      // subtraction would leave stale guidance standing after exactly the most
      // destructive edit the canvas offers.
      useGuidanceStore.getState().clearGuidanceItems()

      removeStructuralDeleteClaims(diff, curr.pendingStructuralDeletes)
      if (diff.changedNodeIds.size === 0 && diff.changedEdgeIds.size === 0) {
        // Every change in this diff is already on the wire as a durable
        // removal. Advance the snapshot and emit nothing — one gesture, one
        // turn.
        snapshotRef.current = currSnapshot
        return
      }

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

// ---------------------------------------------------------------------------
// § useGuidanceInvalidationOnEdit — the coaching half, WITHOUT the wire half
//
// ⚠⚠ THE DEFECT THIS CLOSES (N-23, derived at the bytes in
// `drainHostReachability.derived.spec.ts` and confirmed again at `4d1e650b`):
// STALE COACHING SURVIVES A LOCAL STRUCTURAL EDIT. `clearGuidanceItems()` had
// exactly ONE production caller — `useGraphEditEvents` above — and that hook's
// only host is `DraftChat`, which `ReactFlowGraph.tsx:2484` mounts ONLY when
// `aiPanelV2` is OFF. The flag is ON in every deployed context
// (`flags.ts:358` `defaultValue: true`; `netlify.toml:57` `"true"` proves
// STAGING only — it is under `[context.staging.environment]`, and production
// inherits from `[build.environment]` alone, so the DEFAULT is what carries
// this). So for every real user, the model can be
// restructured underneath coaching that was minted against the PREVIOUS model,
// and that coaching stands until the next assistant turn replaces the whole
// list. Advice about a model the user has since changed is not merely stale —
// it is confidently wrong on a surface whose entire job is to be trusted.
//
// ⭐ WHY THIS IS A SEPARATE HOOK AND NOT A RE-HOST OF THE ONE ABOVE.
// A prior lane stopped at exactly this boundary and was right to. Mounting
// `useGraphEditEvents` on the live path would ALSO switch on `direct_graph_edit`
// wire emission for every user — a WIRE-BEHAVIOUR change (CEE starts receiving a
// system event it currently never receives from a flag-ON user) smuggled in as a
// UX fix. That is a different decision, with a different blast radius, and it is
// not this lane's to take. So the two jobs are split by CONSTRUCTION rather than
// by discipline: this hook takes NO `sendSystemEvent`, imports no transport, and
// is therefore STRUCTURALLY INCAPABLE of emitting anything. The guard for that
// is a source-level assertion in the spec, not a promise in this comment.
//
// SINGLE AUTHORITY ON "WHAT IS A STRUCTURAL CHANGE". This deliberately reuses
// `takeSnapshot`/`diffSnapshots` from the emitter above rather than
// re-implementing the diff. Two same-named-but-different notions of "the graph
// changed" is this estate's most-paid-for defect class (the two
// `generateGraphHash` twins), and a copy here would drift the moment either side
// is touched. Position-only changes are excluded by `diffSnapshots` returning
// `null` — dragging a node must not wipe the user's coaching.
//
// ⚠⚠ EXTERNAL MUTATIONS STAY SUPPRESSED — and the ORIGINAL VERSION OF THIS NOTE
// WAS FALSIFIED BY REVIEW, which is why it now reads at this length.
//
// It said: "Accepting an assistant patch runs under
// `beginExternalGraphMutation('patch_apply')` … a blanket clear here would
// destroy the untargeted items that are legitimately still valid." That is TRUE
// OF THE GUARDED WINDOW AND WAS FALSE OF THE TAIL. `ConversationPanel` CLOSED
// the window (`:330`) and then called `mirrorAnalysisReadyAfterAccept()`
// (`:335`), whose backfills write node `data` — so the tail arrived here
// UNSUPPRESSED, and this hook's blanket clear fired twelve lines before the
// deliberate `clearItemsByTargetIds(allIds)` at `:347`, which then no-opped on
// an empty store. Three more producer writers had the same hole
// (`applyDraftResult`, `reconcileAppliedGraph`, `mergeServerGraph`).
//
// The suppression is therefore load-bearing AND WAS NOT SUFFICIENT ON ITS OWN.
// The writers have been guarded at source (see each one's note), and
// `guidanceInvalidationProducerWrites.spec.tsx` drives the REAL producer
// functions to prove it — because the argument above is exactly the kind that
// reads correct and is wrong about which bytes execute.
//
// ⚠ NOT GATED ON `isOrchestratorV2Enabled()`, unlike the emitter above. That
// flag governs a TRANSPORT; whether the user's coaching is honest about their
// current model is not a transport concern. In the deployed posture the flag is
// `"true"` (`netlify.toml:35`) so this is behaviour-identical there; where it is
// OFF, this hook still keeps coaching honest instead of leaving the defect
// standing for a reason unrelated to it.
// ---------------------------------------------------------------------------

/**
 * Clear all guidance the moment the user makes a local structural edit.
 *
 * Wire-free by construction: takes no transport, emits nothing, and touches
 * only the canvas store (read) and the guidance store (clear).
 */
export function useGuidanceInvalidationOnEdit(): void {
  const snapshotRef = useRef<GraphSnapshot | null>(null)
  const scenarioIdRef = useRef<string | null>(null)

  useEffect(() => {
    const state = useCanvasStore.getState()
    snapshotRef.current = takeSnapshot(state.nodes, state.edges)
    scenarioIdRef.current = state.currentScenarioId

    const unsubscribe = useCanvasStore.subscribe((curr, prev) => {
      // Scenario switch — re-baseline and clear nothing. Guidance for the
      // decision being LEFT is not invalidated by leaving it, and the store's
      // own rehydration gate keys on `scenarioId` anyway.
      if (curr.currentScenarioId !== scenarioIdRef.current) {
        scenarioIdRef.current = curr.currentScenarioId
        snapshotRef.current = takeSnapshot(curr.nodes, curr.edges)
        return
      }

      // Same references — nothing moved.
      if (curr.nodes === prev.nodes && curr.edges === prev.edges) return

      // Patch-apply / hydration / envelope-apply. Re-baseline so the next real
      // user edit diffs against the post-mutation graph rather than a stale one.
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
      // Position-only change: advance the baseline, keep the coaching.
      if (!diff) {
        snapshotRef.current = currSnapshot
        return
      }

      snapshotRef.current = currSnapshot
      useGuidanceStore.getState().clearGuidanceItems()
    })

    return () => {
      unsubscribe()
    }
  }, [])
}
