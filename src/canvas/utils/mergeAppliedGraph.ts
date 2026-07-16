/**
 * mergeAppliedGraphAdditive — ingest an applied-edit receipt's graph into a
 * NON-EMPTY canvas (POC Lane C, edit-journey display closure, 2026-07-11).
 *
 * Wire contract: CEE #414/#424 attach the FULL committed post-mutation graph
 * to applied-edit receipts via the EXISTING top-level `draft_graph` field
 * (OlumiResponseSchema 0.8.0+, unchanged at the pinned 0.15.0), post-commit
 * only — see olumi-assistants-service
 * src/orchestrator-v5/compose/applied-graph-emit.ts. The UI's only inline
 * ingestion path (applyDraftResult via useConversation) was gated on
 * canvasIsEmpty, so a confirmed structural edit (add factor / add edge) never
 * reached a populated canvas until a full reload.
 *
 * Why "draft_graph + non-empty canvas" is treated as an applied-edit receipt:
 * the V5 payload carries NO graph_state (buildPayload.ts — MessageTurnPayload
 * is turn ids/stage/message/source/chip only), so CEE's
 * `extensions.graphState` is null on EVERY V5 turn and does not discriminate.
 * The actual server-side suppression of the fresh-draft dispatch is the
 * continuation guard: route-v2 `isDraftGraphShape` requires
 * `!isContinuationScenario` (loadHasPriorTurns on the scenario), and a
 * non-empty canvas normally belongs to a scenario with prior committed turns.
 * The reachable misfire — a FRESH scenario_id with a populated canvas whose
 * first message is a ≥30-char brief-shaped text — slips past that guard and
 * returns a misdrafted fresh graph; the zero-overlap guard below drops it
 * client-side (an applied receipt always supersets the committed graph, so
 * zero node-id overlap with the canvas is diagnostic). CEE also COMMITS that
 * misdrafted graph server-side — a pre-existing CEE bug filed as its own
 * follow-up lane (see PR #266 body).
 *
 * Semantics — ADDITIVE ONLY:
 *   - Wire nodes/edges missing from the canvas are added, converted with the
 *     SAME mappers as the draft path (mapDraftNodeToCanvas /
 *     mapDraftEdgeToCanvas), then pulsed with the applied-edit highlight.
 *   - Existing canvas elements are never repositioned, rewritten, or removed.
 *     Value updates on existing elements arrive separately as graph_patch
 *     blocks (applyV5State); removals have no ingestion path yet (known
 *     residual, same class as applyV5State's missing delete case).
 *   - No full re-layout: added nodes are placed in a column to the right of
 *     the current graph's bounding box so the user's layout is untouched.
 *   - A receipt whose graph carries nothing new (e.g. a value-only edit) is a
 *     strict no-op — no history entry, no store write, no autosave.
 *   - Zero node-id overlap with a non-empty canvas ⇒ DROP + structured warn
 *     (never graft an unrelated graph).
 *
 * Freshness: deliberately NOT marking the local dirty overlay here. The same
 * response carries CEE's post-apply analysis_ready.freshness verdict (routed
 * through applyV5State step 4 setAnalysisFreshness before this merge runs);
 * that verdict is authoritative for exactly this graph — the overlay exists
 * for local writes CEE has not seen. graphEditedSinceLastRun /
 * analysisStateReady are set EXPLICITLY in the commit below (true / false):
 * pushHistory alone cannot be relied on for them, because pushToHistory
 * early-returns without flipping either flag when the pre-merge state equals
 * the last history snapshot.
 */

import { useCanvasStore } from '../store'
import { validateNodesBatch } from '../domain/nodes'
import { logger } from '../../lib/logger'
import { saveAutosave } from '../store/scenarios'
import { pulseAppliedTargets } from './appliedEditPulse'
import {
  backfillInterventionsOntoOptionNodes,
  mapDraftEdgeToCanvas,
  mapDraftNodeToCanvas,
} from './applyDraftResult'
import type { CEEDraftResponse, CEEv2Response, CEEv3Response } from '../../adapters/cee/types'

/** Horizontal gap between the current bounding box and the added column. */
const ADDED_COLUMN_X_GAP = 260
/** Vertical spacing between stacked added nodes. */
const ADDED_COLUMN_Y_STEP = 140

export interface MergeAppliedGraphResult {
  addedNodeCount: number
  addedEdgeCount: number
}

export function mergeAppliedGraphAdditive(
  draftData: CEEDraftResponse | CEEv2Response | CEEv3Response
): MergeAppliedGraphResult {
  const rawNodes: any[] =
    (draftData as any)?.nodes ?? (draftData as any)?.graph?.nodes ?? []
  const rawEdges: any[] =
    (draftData as any)?.edges ?? (draftData as any)?.graph?.edges ?? []

  const store = useCanvasStore.getState()
  const existingNodeIds = new Set(store.nodes.map((n) => n.id))
  const existingEdgeIds = new Set(store.edges.map((e) => e.id))

  // Structural guard (PR #266 review): an applied-edit receipt's graph is the
  // COMMITTED canvas graph plus/minus the edit, so it always shares node ids
  // with a non-empty canvas. Zero overlap means this draft_graph is a
  // misdrafted FRESH graph (fresh scenario_id + populated canvas + first
  // brief-shaped message slips past CEE's continuation guard) — grafting it
  // would union two unrelated graphs. Drop and warn instead.
  if (store.nodes.length > 0 && rawNodes.length > 0) {
    const hasOverlap = rawNodes.some(
      (n: any) => n != null && typeof n.id === 'string' && existingNodeIds.has(n.id)
    )
    if (!hasOverlap) {
      logger.warn('merge_applied_graph.zero_overlap_drop', {
        scenarioId: store.currentScenarioId ?? null,
        canvasNodeCount: store.nodes.length,
        wireNodeCount: rawNodes.length,
      })
      return { addedNodeCount: 0, addedEdgeCount: 0 }
    }
  }
  // Endpoint-pair dedupe: an existing edge whose id was locally rewritten
  // (fallback `e-${i}` ids from an earlier draft) must not be re-added under
  // the wire's id. Parallel edges between the same pair are not a supported
  // canvas shape today, so the pair key is a safe identity fallback.
  const existingEdgePairs = new Set(
    store.edges.map((e) => `${e.source}\u0000${e.target}`)
  )

  // --- Added nodes: on the wire, not on the canvas ---
  const missingRawNodes = rawNodes.filter(
    (n: any) =>
      n != null &&
      typeof n.id === 'string' &&
      n.id.length > 0 &&
      !existingNodeIds.has(n.id)
  )
  const addedNodes = missingRawNodes.map((n: any) => mapDraftNodeToCanvas(n))

  // Deterministic placement: a column to the right of the current bounding
  // box. Never re-layouts the user's existing nodes.
  if (addedNodes.length > 0) {
    const xs = store.nodes.map((n) => n.position?.x ?? 0)
    const ys = store.nodes.map((n) => n.position?.y ?? 0)
    const baseX = (xs.length ? Math.max(...xs) : 0) + ADDED_COLUMN_X_GAP
    const baseY = ys.length ? Math.min(...ys) : 0
    addedNodes.forEach((n: any, idx: number) => {
      n.position = { x: baseX, y: baseY + idx * ADDED_COLUMN_Y_STEP }
    })
  }

  // --- Added edges: on the wire, not on the canvas, endpoints resolvable ---
  const unionNodeIds = new Set<string>([
    ...existingNodeIds,
    ...addedNodes.map((n: any) => n.id as string),
  ])
  // Track endpoint pairs already taken — by existing canvas edges AND by
  // earlier NEW edges in this same receipt. The commit below writes via a
  // direct setState (bypassing addEdge's duplicate guard), so two wire edges
  // sharing a pair must self-dedupe here (first wins).
  const seenEdgePairs = new Set(existingEdgePairs)
  const missingRawEdges = rawEdges.filter((e: any) => {
    if (e == null) return false
    const from = e.from ?? e.source
    const to = e.to ?? e.target
    if (typeof from !== 'string' || typeof to !== 'string') return false
    if (typeof e.id === 'string' && existingEdgeIds.has(e.id)) return false
    if (seenEdgePairs.has(`${from}\u0000${to}`)) return false
    // Fail-closed: never add a dangling edge (e.g. wire endpoint the user
    // deleted locally and the receipt re-references).
    if (!unionNodeIds.has(from) || !unionNodeIds.has(to)) return false
    seenEdgePairs.add(`${from}\u0000${to}`)
    return true
  })
  const usedEdgeIds = new Set<string>(existingEdgeIds)
  const addedEdges = missingRawEdges.map((e: any, i: number) => {
    const mapped = mapDraftEdgeToCanvas(e, i)
    // The mapper's fallback id (`e-${i}`) indexes the wire array — make it
    // collision-proof against edges already on the canvas.
    let id: string = mapped.id
    while (usedEdgeIds.has(id)) id = `${id}-a`
    usedEdgeIds.add(id)
    return { ...mapped, id }
  })

  if (addedNodes.length === 0 && addedEdges.length === 0) {
    return { addedNodeCount: 0, addedEdgeCount: 0 }
  }

  // --- Commit: one history entry, additive store write ---
  const canvas = useCanvasStore.getState()
  canvas.pushHistory()
  useCanvasStore.setState({
    nodes: [...canvas.nodes, ...addedNodes],
    edges: [...canvas.edges, ...addedEdges],
  })

  // Staleness flags set EXPLICITLY (not via pushToHistory, which early-returns
  // without flipping them when the pre-merge state equals the last snapshot),
  // and ATOMICALLY: the freshness banners read the analysisFreshnessDirty
  // overlay, not the legacy pair, and every other mutation path already marks
  // all three (applyDraftResult, the edit chokepoints, commitValidatedMutation).
  useCanvasStore.getState().markGraphStructurallyEdited?.()

  // Warning-only schema validation on the added nodes (mirrors applyDraftResult).
  validateNodesBatch(addedNodes)

  // Seamlessness R2: acknowledge the AI's applied edit with the SAME
  // coalesced 2s highlight the graph_patch path uses — pulse only, no
  // selection/viewport hijack. Fail-closed downstream against the canvas.
  pulseAppliedTargets({
    nodeIds: addedNodes.map((n: any) => n.id as string),
    edgeIds: addedEdges.map((e: any) => e.id as string),
  })

  // Newly added option nodes need node.data.interventions mirrored from
  // analysis_ready (OptionNode render, islRequestAdapter fallback readers).
  // applyV5State step 4 wrote ceeAnalysisReady BEFORE this merge ran, when
  // the option node did not yet exist — close the loop now. Idempotent.
  const analysisReady = useCanvasStore.getState().ceeAnalysisReady
  if (analysisReady) {
    backfillInterventionsOntoOptionNodes(analysisReady)
  }

  // Immediate autosave for crash resilience (mirrors applyDraftResult).
  try {
    const current = useCanvasStore.getState()
    saveAutosave({
      timestamp: Date.now(),
      scenarioId: current.currentScenarioId || undefined,
      nodes: current.nodes,
      edges: current.edges,
    })
  } catch {
    // Non-critical — swallow save errors
  }

  return { addedNodeCount: addedNodes.length, addedEdgeCount: addedEdges.length }
}
