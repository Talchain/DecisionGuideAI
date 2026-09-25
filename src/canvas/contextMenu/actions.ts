/**
 * Context menu action implementations.
 *
 * All graph mutation actions go through commitValidatedMutation (Hard rule 2).
 * UI-only state (flagged_as_assumption, _baseline_snapshot) bypasses PLoT (Hard rule 3).
 * Ask AI lands an editable draft via `requestAsk` (askSemantic.ts) — it never sends.
 */

import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { requestAsk, canReceiveAsk } from '../ui/inspector-v2/askSemantic'
import { useConfirmDialogStore } from '../stores/confirmDialogStore'
import { commitValidatedMutation } from '../mutations/commitValidatedMutation'
import { USER_EDGE_DEFAULTS } from '../domain/edges'
import {
  assessNodeDeletion,
  assessEdgeDeletion,
  isSignificantImpact,
  buildDeletionMessage,
  wouldExceedLimits,
  wouldCreateCycle,
  limitExceededMessage,
} from '../validation/graphGuardrails'
import type { PatchOperation } from '../conversation/types'
import type { ContextTarget, NodeTarget, EdgeTarget, MultiTarget } from './types'
import type { NodeType } from '../domain/nodes'

export type ShowToastFn = (message: string, type: 'error' | 'info' | 'success' | 'warning') => void

// ---------------------------------------------------------------------------
// Delete (with structural guardrails — Graph Editing Experience Task 2d)
// ---------------------------------------------------------------------------

/**
 * What a delete gesture names — the three fields `deleteAction` reads, and no
 * more. Every `ContextTarget` the menu builds already satisfies it; the keyboard
 * builds one from the selection (`deleteTargetFromSelection`) without having to
 * invent a screen position or a node object it has no use for.
 */
export type DeleteTarget =
  | Pick<NodeTarget, 'kind' | 'nodeId'>
  | Pick<EdgeTarget, 'kind' | 'edgeId'>
  | Pick<MultiTarget, 'kind' | 'nodeIds' | 'edgeIds'>

/** Execute the raw deletion through commitValidatedMutation */
async function executeNodeDelete(nodeId: string, showToast: ShowToastFn): Promise<void> {
  const store = useCanvasStore.getState()
  const connectedEdgeOps: PatchOperation[] = store.edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => ({ op: 'remove_edge' as const, target_id: e.id, data: {} }))
  const ops: PatchOperation[] = [
    ...connectedEdgeOps,
    { op: 'remove_node', target_id: nodeId, data: {} },
  ]
  await commitValidatedMutation(ops, () => store.deleteNodeById(nodeId), showToast)
}

async function executeEdgeDelete(edgeId: string, showToast: ShowToastFn): Promise<void> {
  const store = useCanvasStore.getState()
  const ops: PatchOperation[] = [{ op: 'remove_edge', target_id: edgeId, data: {} }]
  await commitValidatedMutation(ops, () => store.deleteEdge(edgeId), showToast)
}

async function executeMultiDelete(nodeIds: string[], edgeIds: string[], showToast: ShowToastFn): Promise<void> {
  const store = useCanvasStore.getState()
  const ops: PatchOperation[] = [
    ...edgeIds.map((id) => ({ op: 'remove_edge' as const, target_id: id, data: {} })),
    ...nodeIds.map((id) => ({ op: 'remove_node' as const, target_id: id, data: {} })),
  ]
  await commitValidatedMutation(ops, () => store.deleteSelected(), showToast)
}

/**
 * ⭐ THE ONE DELETE QUESTION — asked by the context menu AND by Delete/Backspace.
 *
 * Assess the structural impact; refuse (toast) when the removal would take the
 * last goal or decision; ask first (`useConfirmDialogStore`) when it would cut
 * an option off from the goal or orphan a node; otherwise delete at once.
 *
 * ⛔ THE KEYBOARD USED TO SKIP ALL OF THIS (fixed 25 Sep 2026). Delete/Backspace
 * called `store.deleteSelected()` directly, so the same card the menu would ask
 * about went with no question — and there is no Undo on the canvas. The key now
 * enters HERE, through `deleteSelectionAction`, so the two gestures cannot drift:
 * one assessment, one set of messages, one execute path. Do not give the
 * keyboard a second copy of any of it.
 */
export async function deleteAction(
  target: ContextTarget | DeleteTarget,
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()
  const { nodes, edges } = store
  const confirmStore = useConfirmDialogStore.getState()

  if (target.kind === 'edge') {
    const impact = assessEdgeDeletion(nodes, edges, target.edgeId)
    if (isSignificantImpact(impact)) {
      const edge = edges.find(e => e.id === target.edgeId)
      const edgeLabel = edge
        ? `${(nodes.find(n => n.id === edge.source)?.data as Record<string, unknown>)?.label ?? edge.source} → ${(nodes.find(n => n.id === edge.target)?.data as Record<string, unknown>)?.label ?? edge.target}`
        : 'this connection'
      const { title, message, blocked } = buildDeletionMessage(impact, edgeLabel)
      if (blocked) {
        showToast(message, 'warning')
        return
      }
      confirmStore.show({
        title,
        message,
        confirmLabel: 'Remove',
        onConfirm: () => { executeEdgeDelete(target.edgeId, showToast) },
      })
      return
    }
    await executeEdgeDelete(target.edgeId, showToast)
  } else if (target.kind === 'node') {
    const impact = assessNodeDeletion(nodes, edges, target.nodeId)
    if (isSignificantImpact(impact)) {
      const node = nodes.find(n => n.id === target.nodeId)
      const nodeLabel = (node?.data as Record<string, unknown>)?.label as string ?? target.nodeId
      const { title, message, blocked } = buildDeletionMessage(impact, nodeLabel)
      if (blocked) {
        showToast(message, 'warning')
        return
      }
      confirmStore.show({
        title,
        message,
        confirmLabel: 'Remove',
        onConfirm: () => { executeNodeDelete(target.nodeId, showToast) },
      })
      return
    }
    await executeNodeDelete(target.nodeId, showToast)
  } else if (target.kind === 'multi') {
    // Aggregate impacts for batch deletion
    const aggregated = {
      disconnectsOptions: [] as Array<{ optionId: string; optionLabel: string }>,
      orphansNodes: [] as Array<{ nodeId: string; nodeLabel: string }>,
      removesLastGoal: false,
      removesLastDecision: false,
    }
    for (const nodeId of target.nodeIds) {
      const impact = assessNodeDeletion(nodes, edges, nodeId)
      aggregated.disconnectsOptions.push(...impact.disconnectsOptions)
      aggregated.orphansNodes.push(...impact.orphansNodes)
      if (impact.removesLastGoal) aggregated.removesLastGoal = true
      if (impact.removesLastDecision) aggregated.removesLastDecision = true
    }
    // ⚠ SELECTED CONNECTIONS COUNT TOO (25 Sep 2026). This loop used to read
    // `nodeIds` only, so a marquee or ⌘-click selection holding the one link
    // between an option and the goal went without a question — from the menu
    // and, once the keyboard came through here, from Delete/Backspace as well.
    // An edge can never be "the last goal", so this adds dialogs, never refusals.
    for (const edgeId of target.edgeIds) {
      const impact = assessEdgeDeletion(nodes, edges, edgeId)
      aggregated.disconnectsOptions.push(...impact.disconnectsOptions)
      aggregated.orphansNodes.push(...impact.orphansNodes)
    }
    // Nothing that is itself being deleted is warned about: an option going in
    // the same gesture has no path left to lose, and a node going cannot be
    // left disconnected. Without the option half, selecting an option together
    // with its own link would ask about the option being removed.
    const deletingIds = new Set(target.nodeIds)
    const seenOptions = new Set<string>()
    aggregated.disconnectsOptions = aggregated.disconnectsOptions.filter(o => {
      if (deletingIds.has(o.optionId) || seenOptions.has(o.optionId)) return false
      seenOptions.add(o.optionId)
      return true
    })
    const seenOrphans = new Set<string>()
    aggregated.orphansNodes = aggregated.orphansNodes.filter(o => {
      if (deletingIds.has(o.nodeId) || seenOrphans.has(o.nodeId)) return false
      seenOrphans.add(o.nodeId)
      return true
    })

    if (isSignificantImpact(aggregated)) {
      // Counts connections as well as cards, as `deleteSelected`'s own history
      // label does — a selection of two links is not "0 elements".
      const count = target.nodeIds.length + target.edgeIds.length
      const label = `${count} element${count !== 1 ? 's' : ''}`
      const { title, message, blocked } = buildDeletionMessage(aggregated, label)
      if (blocked) {
        showToast(message, 'warning')
        return
      }
      confirmStore.show({
        title,
        message,
        confirmLabel: 'Remove',
        onConfirm: () => { executeMultiDelete(target.nodeIds, target.edgeIds, showToast) },
      })
      return
    }
    await executeMultiDelete(target.nodeIds, target.edgeIds, showToast)
  }
}

/**
 * The delete target the current selection names, shaped exactly as the menu
 * shapes it (`handleKeyboardContextMenu`): one card → `node`, one connection →
 * `edge`, anything more → `multi`. `null` when nothing is selected.
 */
export function deleteTargetFromSelection(selection: {
  nodeIds: ReadonlySet<string>
  edgeIds: ReadonlySet<string>
}): DeleteTarget | null {
  const nodeIds = [...selection.nodeIds]
  const edgeIds = [...selection.edgeIds]
  if (nodeIds.length === 0 && edgeIds.length === 0) return null
  if (nodeIds.length === 1 && edgeIds.length === 0) return { kind: 'node', nodeId: nodeIds[0] }
  if (edgeIds.length === 1 && nodeIds.length === 0) return { kind: 'edge', edgeId: edgeIds[0] }
  return { kind: 'multi', nodeIds, edgeIds }
}

/**
 * Delete/Backspace on the canvas: `deleteAction` on whatever is selected.
 *
 * ⚠ AN EMPTY SELECTION RETURNS BEFORE `deleteAction`, NOT INSIDE IT. An empty
 * `multi` would still reach `commitValidatedMutation`, whose local path marks
 * the analysis freshness dirty after `deleteSelected` has removed nothing — a
 * keypress on an empty canvas would quietly downgrade a `fresh` verdict.
 */
export function deleteSelectionAction(showToast: ShowToastFn): Promise<void> {
  const target = deleteTargetFromSelection(useCanvasStore.getState().selection)
  if (!target) return Promise.resolve()
  return deleteAction(target, showToast)
}

// ---------------------------------------------------------------------------
// Add node (canvas pane target)
// ---------------------------------------------------------------------------

export async function addNodeAction(
  type: NodeType,
  flowPos: { x: number; y: number },
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()

  // ⭐⭐ THE OPTION AUTO-CONNECT IS GONE, AND DROPPING IT IS WHAT MAKES THIS
  // GESTURE HONEST (2026-09-13).
  //
  // It read: if the kind is `option` and a decision node exists, route through
  // `store.addNodeWithEdge` so the option arrives already joined to the
  // decision. Convenient, and NOT DURABLE at the time: `addNodeWithEdge`
  // captured no `structural_add`. So five of the six kinds reached the durable
  // chokepoint and `option` — on any graph that has a decision, i.e. every real
  // one — silently did not.
  //
  // ⚠⚠ THE REASON GIVEN HERE HAS EXPIRED (corrected 18 Sep 2026), AND THE
  // DECISION HAS NOT. The sentence struck from this block said the capture was
  // absent "deliberately, because `structural_add_edge` is
  // `'reader_only_refusal'` in CEE — no writer (re-derived at CEE `staging`
  // `3575b189`)". CEE #1443 shipped that writer on 13 Sep, and
  // `store.addNodeWithEdge` now captures BOTH halves. ⭐ But the auto-connect
  // stays gone on the OTHER two reasons below, which never depended on it: the
  // contract's own model of an add is a node with no incident edges, and a menu
  // whose six kinds do not all behave alike is the defect this removal fixed.
  // A reason that stops holding is struck where the next reader will see it.
  //
  // ⚠ THE ASYMMETRY IS THE WHOLE POINT. While this menu was stripped it cost
  // nothing; the moment the item renders, one kind in six would save nothing
  // and say nothing, which is exactly the class of lie
  // `CANONICAL_EDIT_AUTHORITY` exists to forbid. A door that works for five
  // kinds and quietly fails for the sixth is worse than five doors.
  //
  // ⭐ AND THE CONTRACT AGREES, so this is alignment rather than a sacrifice: a
  // `structural_add` node "has no incident edges by construction", and
  // "drawing a node and then an edge is two gestures and two turns"
  // (`boundary/turn-payload` `StructuralAddEvent`). An added option with no
  // edge is the contract's own model of an add, not a degraded one.
  //
  // ⚠ NO USER LOSES ANYTHING BY THIS. `addNodeAction` has exactly one caller
  // (`useMenuItems.ts`, the pane submenu) and that submenu has never rendered
  // — it was stripped by `applyContextMenuMutationAuthority` from the day it
  // was written. There is no established behaviour here to preserve; this
  // chooses the shape at which the door opens.

  // PRD guardrail: check node limit before creating
  const limitKind = wouldExceedLimits(store.nodes.length, store.edges.length, 1, 0, store.engineLimits)
  if (limitKind) {
    showToast(limitExceededMessage(limitKind, store.nodes.length), 'warning')
    return
  }

  const nodesBefore = store.nodes.length
  const ops: PatchOperation[] = [{
    op: 'add_node',
    target_id: `pending-${nodesBefore}`,
    data: { kind: type, label: `New ${type}` },
  }]
  await commitValidatedMutation(
    ops,
    () => store.addNode(flowPos, type),
    showToast,
  )
  // Select new node for immediate editing
  const afterStore = useCanvasStore.getState()
  if (afterStore.nodes.length > nodesBefore) {
    const newNode = afterStore.nodes[afterStore.nodes.length - 1]
    afterStore.selectNodeWithoutHistory(newNode.id)
  }
}

// ---------------------------------------------------------------------------
// Add connected factor
// ---------------------------------------------------------------------------

/**
 * Determine edge direction based on target node kind.
 * Goal/outcome/risk/factor: new factor is a cause → new→target
 * Decision/option: new factor is an effect → target→new
 */
function getEdgeDirectionForKind(kind: string): 'to-target' | 'from-target' {
  if (kind === 'decision' || kind === 'option') return 'from-target'
  return 'to-target'
}

/**
 * Compute position for the new connected factor.
 * Places 150px in the direction with the most available canvas space
 * relative to the target node's position within the viewport.
 */
function computeConnectedNodePos(
  targetNode: { position: { x: number; y: number } },
): { x: number; y: number } {
  const OFFSET = 150
  const { x, y } = targetNode.position

  // Check available space in each direction using viewport midpoint as heuristic.
  // Nodes near the right edge → place left; near the bottom → place above.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  // Determine horizontal: prefer left (causes flow left→right) unless near left edge
  const dx = x > vw * 0.3 ? -OFFSET : OFFSET
  // Determine vertical: slight upward offset unless near top
  const dy = y > vh * 0.3 ? -50 : 50

  return { x: x + dx, y: y + dy }
}

export async function addConnectedFactorAction(
  target: NodeTarget,
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()
  const targetNode = store.nodes.find((n) => n.id === target.nodeId)
  if (!targetNode) return

  // PRD guardrail: adding 1 node + 1 edge
  const limitKind = wouldExceedLimits(store.nodes.length, store.edges.length, 1, 1, store.engineLimits)
  if (limitKind) {
    showToast(limitExceededMessage(limitKind, limitKind === 'node_limit' ? store.nodes.length : store.edges.length), 'warning')
    return
  }

  const kind = (targetNode.data?.kind as string) ?? targetNode.type ?? 'factor'
  const edgeDirection = getEdgeDirectionForKind(kind)
  const pos = computeConnectedNodePos(targetNode)

  const nodeId = store.createNodeId()
  const edgeId = store.createEdgeId()
  const [source, target_] = edgeDirection === 'to-target'
    ? [nodeId, target.nodeId]
    : [target.nodeId, nodeId]

  const ops: PatchOperation[] = [
    // ⚠ NO `category` — AND THIS IS THE SECOND WRITER, NOT A DUPLICATE OF THE
    // STORE'S. `commitValidatedMutation` sends these ops to PLoT's
    // `validatePatch` and, when it returns a validated graph, `setState`s THAT
    // graph instead of calling `localApply()`. So a `category: 'external'` left
    // here would re-seed the node on the validated path even though
    // `store.addNodeWithEdge` no longer seeds one — the two must agree or the
    // guarantee holds only on whichever branch happens to run. See the seed
    // note in `store.addNodeWithEdge` for why the category is wrong at all.
    //
    // ⚠ The option/outcome/risk siblings below never declared one, so this line
    // was also the only place the four items disagreed with each other.
    { op: 'add_node', target_id: nodeId, data: { kind: 'factor', label: 'New factor' } },
    { op: 'add_edge', target_id: edgeId, data: { from: source, to: target_ } },
  ]

  await commitValidatedMutation(
    ops,
    () => store.addNodeWithEdge(pos, 'factor', target.nodeId, edgeDirection),
    showToast,
  )
  // addNodeWithEdge already selects the new node
}

// ---------------------------------------------------------------------------
// Add connected outcome (Graph Editing Experience Task 3a)
// ---------------------------------------------------------------------------

export async function addConnectedOutcomeAction(
  target: NodeTarget,
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()
  const targetNode = store.nodes.find((n) => n.id === target.nodeId)
  if (!targetNode) return

  const limitKind = wouldExceedLimits(store.nodes.length, store.edges.length, 1, 1, store.engineLimits)
  if (limitKind) {
    showToast(limitExceededMessage(limitKind, limitKind === 'node_limit' ? store.nodes.length : store.edges.length), 'warning')
    return
  }

  const pos = computeConnectedNodePos(targetNode)
  const nodeId = store.createNodeId()
  const edgeId = store.createEdgeId()
  // Edge: FROM clicked node → TO new outcome (outcome is downstream)
  const ops: PatchOperation[] = [
    { op: 'add_node', target_id: nodeId, data: { kind: 'outcome', label: 'New outcome' } },
    { op: 'add_edge', target_id: edgeId, data: { from: target.nodeId, to: nodeId } },
  ]
  await commitValidatedMutation(
    ops,
    () => store.addNodeWithEdge(pos, 'outcome', target.nodeId, 'from-target'),
    showToast,
  )
}

// ---------------------------------------------------------------------------
// Add connected risk (Graph Editing Experience Task 3a)
// ---------------------------------------------------------------------------

export async function addConnectedRiskAction(
  target: NodeTarget,
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()
  const targetNode = store.nodes.find((n) => n.id === target.nodeId)
  if (!targetNode) return

  const limitKind = wouldExceedLimits(store.nodes.length, store.edges.length, 1, 1, store.engineLimits)
  if (limitKind) {
    showToast(limitExceededMessage(limitKind, limitKind === 'node_limit' ? store.nodes.length : store.edges.length), 'warning')
    return
  }

  const pos = computeConnectedNodePos(targetNode)
  const nodeId = store.createNodeId()
  const edgeId = store.createEdgeId()
  // Edge: FROM clicked node → TO new risk (risk is downstream)
  const ops: PatchOperation[] = [
    { op: 'add_node', target_id: nodeId, data: { kind: 'risk', label: 'New risk' } },
    { op: 'add_edge', target_id: edgeId, data: { from: target.nodeId, to: nodeId } },
  ]
  await commitValidatedMutation(
    ops,
    () => store.addNodeWithEdge(pos, 'risk', target.nodeId, 'from-target'),
    showToast,
  )
}

// ---------------------------------------------------------------------------
// Reverse edge direction (Graph Editing Experience Task 3b)
// ---------------------------------------------------------------------------

export async function reverseEdgeAction(
  edgeId: string,
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()
  const edge = store.edges.find(e => e.id === edgeId)
  if (!edge) return

  // Cycle check: would reversing create a cycle?
  const nodeIds = store.nodes.map(n => n.id)
  const otherEdges = store.edges.filter(e => e.id !== edgeId)
  if (wouldCreateCycle(nodeIds, otherEdges, edge.target, edge.source)) {
    showToast('Reversing this would create a circular dependency.', 'warning')
    return
  }

  const ops: PatchOperation[] = [{
    op: 'update_edge',
    target_id: edgeId,
    data: { from: edge.target, to: edge.source },
  }]
  await commitValidatedMutation(
    ops,
    () => store.updateEdgeEndpoints(edgeId, { source: edge.target, target: edge.source }),
    showToast,
  )
}

// ---------------------------------------------------------------------------
// Insert factor between (Graph Editing Experience Task 3b)
// ---------------------------------------------------------------------------

export async function insertFactorBetweenAction(
  edgeId: string,
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()
  const edge = store.edges.find(e => e.id === edgeId)
  if (!edge) return

  // Need 1 new node + 2 new edges - 1 old edge = net +1 node, +1 edge
  const limitKind = wouldExceedLimits(store.nodes.length, store.edges.length, 1, 1, store.engineLimits)
  if (limitKind) {
    showToast(limitExceededMessage(limitKind, limitKind === 'node_limit' ? store.nodes.length : store.edges.length), 'warning')
    return
  }

  const sourceNode = store.nodes.find(n => n.id === edge.source)
  const targetNode = store.nodes.find(n => n.id === edge.target)
  if (!sourceNode || !targetNode) return

  // Position at midpoint of source and target
  const midPos = {
    x: (sourceNode.position.x + targetNode.position.x) / 2,
    y: (sourceNode.position.y + targetNode.position.y) / 2,
  }

  const newNodeId = store.createNodeId()
  const newEdgeId1 = store.createEdgeId()
  const newEdgeId2 = store.createEdgeId()

  const ops: PatchOperation[] = [
    // ⚠ NO `category` — the same fix, on the same defect, as the connected-add
    // op above; see the seed note in `store.addNodeWithEdge`. This path is
    // worse than that one on arrival, not better: it splits an edge, so the new
    // factor lands as the SOURCE of `newEdgeId2` and `outcomesAffected` is 1
    // the instant it appears. With the category seeded it rendered "Uncertainty
    // here affects 1 outcome." about a factor the user had supplied nothing for.
    { op: 'add_node', target_id: newNodeId, data: { kind: 'factor', label: 'New factor' } },
    { op: 'remove_edge', target_id: edgeId, data: {} },
    { op: 'add_edge', target_id: newEdgeId1, data: { from: edge.source, to: newNodeId } },
    { op: 'add_edge', target_id: newEdgeId2, data: { from: newNodeId, to: edge.target } },
  ]

  await commitValidatedMutation(
    ops,
    () => {
      // Atomic: push one history frame, then batch all mutations in a single setState
      store.pushHistory()
      useCanvasStore.setState(s => ({
        nodes: [...s.nodes, {
          id: newNodeId,
          type: 'factor' as const,
          position: midPos,
          // ⚠ AND HERE TOO — the LOCAL branch. This action installs its node by
          // bare `setState` rather than through a store add action, so it has
          // its own copy of the seed and neither branch guards the other:
          // whichever of `commitValidatedMutation`'s two paths runs is decided
          // at RUNTIME by whether `plot.validatePatch` exists. Both must say
          // the same thing or the guarantee is a coin toss.
          data: { label: 'New factor', kind: 'factor' },
        }],
        edges: [
          ...s.edges.filter(e => e.id !== edgeId),
          { id: newEdgeId1, source: edge.source, target: newNodeId, type: 'styled', data: { ...USER_EDGE_DEFAULTS } },
          { id: newEdgeId2, source: newNodeId, target: edge.target, type: 'styled', data: { ...USER_EDGE_DEFAULTS } },
        ],
        selection: { nodeIds: new Set([newNodeId]), edgeIds: new Set<string>(), anchorPosition: null },
      }))
    },
    showToast,
  )
}

// ---------------------------------------------------------------------------
// Set value
// ---------------------------------------------------------------------------

function getNodeRange(node: any): { min: number; max: number } | null {
  const os = node.data?.observedState
  if (os?.range_min != null && os?.range_max != null) {
    return { min: os.range_min, max: os.range_max }
  }
  const prior = node.data?.prior
  if (prior?.range_min != null && prior?.range_max != null) {
    return { min: prior.range_min, max: prior.range_max }
  }
  const ss = node.data?.state_space
  if (ss?.range?.min != null && ss?.range?.max != null) {
    return { min: ss.range.min, max: ss.range.max }
  }
  return null
}

function ensureBaselineSnapshot(nodeId: string): void {
  const store = useCanvasStore.getState()
  const node = store.nodes.find((n) => n.id === nodeId)
  if (!node) return
  // Only capture on first modification (do not overwrite)
  if (node.data?._baseline_snapshot != null) return
  const currentValue = node.data?.observedState?.value
  if (currentValue != null) {
    store.updateNode(nodeId, { data: { ...node.data, _baseline_snapshot: currentValue } })
  }
}

export async function setValueBestCase(
  nodeId: string,
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()
  const node = store.nodes.find((n) => n.id === nodeId)
  if (!node) return
  const range = getNodeRange(node)
  if (!range) { showToast('No range defined — set a range first', 'info'); return }

  ensureBaselineSnapshot(nodeId)

  const ops: PatchOperation[] = [{
    op: 'update_node',
    target_id: nodeId,
    data: { observed_state: { ...node.data?.observedState, value: range.max } },
  }]
  await commitValidatedMutation(
    ops,
    () => store.updateNode(nodeId, {
      data: { ...node.data, observedState: { ...node.data?.observedState, value: range.max } },
    }),
    showToast,
  )
}

export async function setValueWorstCase(
  nodeId: string,
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()
  const node = store.nodes.find((n) => n.id === nodeId)
  if (!node) return
  const range = getNodeRange(node)
  if (!range) { showToast('No range defined — set a range first', 'info'); return }

  ensureBaselineSnapshot(nodeId)

  const ops: PatchOperation[] = [{
    op: 'update_node',
    target_id: nodeId,
    data: { observed_state: { ...node.data?.observedState, value: range.min } },
  }]
  await commitValidatedMutation(
    ops,
    () => store.updateNode(nodeId, {
      data: { ...node.data, observedState: { ...node.data?.observedState, value: range.min } },
    }),
    showToast,
  )
}

export async function setValueReset(
  nodeId: string,
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()
  const node = store.nodes.find((n) => n.id === nodeId)
  if (!node) return
  const baseline = node.data?._baseline_snapshot
  if (baseline == null) { showToast('No baseline snapshot to restore', 'info'); return }

  const ops: PatchOperation[] = [{
    op: 'update_node',
    target_id: nodeId,
    data: { observed_state: { ...node.data?.observedState, value: baseline } },
  }]
  await commitValidatedMutation(
    ops,
    () => store.updateNode(nodeId, {
      data: {
        ...node.data,
        observedState: { ...node.data?.observedState, value: baseline },
        _baseline_snapshot: undefined, // Clear after restore
      },
    }),
    showToast,
  )
}

export async function setValueCustom(
  nodeId: string,
  value: number,
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()
  const node = store.nodes.find((n) => n.id === nodeId)
  if (!node) return

  ensureBaselineSnapshot(nodeId)

  const ops: PatchOperation[] = [{
    op: 'update_node',
    target_id: nodeId,
    data: { observed_state: { ...node.data?.observedState, value } },
  }]
  await commitValidatedMutation(
    ops,
    () => store.updateNode(nodeId, {
      data: { ...node.data, observedState: { ...node.data?.observedState, value } },
    }),
    showToast,
  )
}

// ---------------------------------------------------------------------------
// Mark as assumption (UI-only, no PLoT — Hard rule 3)
// ---------------------------------------------------------------------------

export function markAsAssumption(
  targetId: string,
  targetType: 'node' | 'edge',
  showToast: ShowToastFn,
): void {
  const store = useCanvasStore.getState()

  if (targetType === 'node') {
    const node = store.nodes.find((n) => n.id === targetId)
    if (!node) return
    const isCurrently = node.data?.flagged_as_assumption === true
    store.updateNode(targetId, {
      data: { ...node.data, flagged_as_assumption: !isCurrently },
    })
    showToast(isCurrently ? 'Assumption flag removed' : 'Marked as assumption', 'info')
  } else {
    const edge = store.edges.find((e) => e.id === targetId)
    if (!edge) return
    const isCurrently = edge.data?.flagged_as_assumption === true
    store.updateEdgeData(targetId, { flagged_as_assumption: !isCurrently } as any)
    showToast(isCurrently ? 'Assumption flag removed' : 'Marked as assumption', 'info')
  }
}

// ---------------------------------------------------------------------------
// Trace to goal
// ---------------------------------------------------------------------------

export function traceToGoal(
  nodeId: string,
  showToast: ShowToastFn,
): void {
  const store = useCanvasStore.getState()
  store.selectNodeWithoutHistory(nodeId)

  // Check after a frame whether path highlighting found any paths
  requestAnimationFrame(() => {
    const { highlightedEdges } = useCanvasStore.getState()
    const highlighted = highlightedEdges ?? new Set<string>()
    if (highlighted.size === 0) {
      // Check if the selected node IS the goal (no path needed)
      const node = store.nodes.find((n) => n.id === nodeId)
      const kind = node?.data?.kind ?? node?.type
      if (kind !== 'goal') {
        showToast('No causal path found to the goal', 'info')
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Ask AI
// ---------------------------------------------------------------------------

/**
 * ⭐ WHICH NODE KINDS CAN BE ARGUED WITH — the one gate, and it lives here.
 *
 * THE GAP THIS CLOSES, measured across all eight kinds on deployed staging
 * `80ccf768` (8 Sep 2026): factor, goal, risk and outcome carried
 * `ask · challenge · inspect · menu`; decision and option carried only
 * `ask · inspect · menu`. The product would not let a team argue with the
 * QUESTION it is answering, or with the CHOICES on the table — the two nodes a
 * strategy team most wants to contest, missing from the strategic reasoning
 * layer.
 *
 * ⚠ WHY THIS IS A NEW SET AND NOT A WIDENED `FULL_MENU_KINDS`. The one-line
 * version of this change was to add `decision` and `option` to that Set. It
 * gates FOUR things, not one — Challenge this, Explore ▸ Trace to goal, Set
 * value ▸ Best case / Worst case / Reset to observed, and Mark as assumption —
 * so widening it would silently have offered a Question node "Set to the upper
 * bound of this factor's range". `DecisionNodeDataSchema` is the base schema
 * plus a type literal: no range, no observed value, so `getNodeRange` returns
 * null and those items would render permanently disabled behind "Set a range
 * first". One name answering two questions is how that happens (trap 21), so
 * the two questions get two names.
 *
 * ⭐ WHY IT LIVES IN THE PRODUCER RATHER THAN IN THE MENU. A kind is
 * challengeable exactly when this file can build a challenge for it. Those are
 * one fact, so they are one declaration — the Set sits beside the copy it
 * gates. `NodeQuickActions` already DERIVES its hover control from the menu's
 * gate rather than mirroring it; it now derives from this Set instead, which is
 * the same design one step closer to the truth it was reaching for. Its old
 * docblock asserted *"the menu builds no challenge prompt for them, so a
 * control here would open nothing"* — a claim about this file, held in a
 * consumer, where nothing could keep it true.
 *
 * CONSEQUENCE, and the reason this is a small change with a wide effect:
 * moving a kind in or out here moves BOTH the right-click menu and the hover
 * control row, with no second list to keep in sync.
 *
 * ⚠ `action` IS HELD OUT, AND THE SCOPE OF THAT IS STATED RATHER THAN HIDDEN.
 * It is in `NodeTypeEnum` but absent from `NODE_TYPE_ITEMS` (the six
 * user-creatable kinds) and its schema is the base plus a type literal. Whether
 * CEE ever emits an `action` node was NOT verified by this lane. It is excluded
 * because nothing established it is reachable — not because it was shown to be
 * unreachable.
 */
export const CHALLENGE_KINDS: ReadonlySet<NodeType> = new Set<NodeType>([
  'factor',
  'risk',
  'outcome',
  'goal',
  'decision',
  'option',
  'constraint',
])

/**
 * The sentence the four already-shipped kinds get, unchanged and pinned.
 *
 * It is deliberately NOT re-worded for factor / risk / outcome / goal: those
 * four are journey-witnessed on staging with this exact string, and rewording
 * witnessed copy is a separate change with a separate justification.
 */
const genericChallengePrompt = (label: string) =>
  `Challenge the current setup of "${label}". What could be wrong or missing?`

/** The menu tooltip those four kinds get, likewise unchanged. */
const GENERIC_CHALLENGE_TOOLTIP = "Ask AI to argue against this element's current setup"

/**
 * Per-kind challenge copy — the prompt AND the menu tooltip, together.
 *
 * ⭐ THEY ARE ONE ENTRY BECAUSE THEY ARE ONE PROMISE. The tooltip is the label
 * on the door and the prompt is what is behind it; if they can be edited apart
 * they will eventually describe different actions. The shipped tooltip is a
 * single fixed string — *"Ask AI to argue against this element's current
 * setup"* — which reads fine for a factor and is simply not true of a Question:
 * a question has no "setup" to argue against, it has a FRAMING. That is what
 * makes the copy part of this change rather than a follow-up.
 *
 * ⚠ "Question", not "Decision", is the user-facing word for this kind
 * (`DECISION_NODE_LABEL`, `domain/vocabulary.ts` — Paul retired "Decision" on
 * 31 Aug), so the decision copy argues with the question. Note that
 * `vocabulary.ts` records why "Challenge" was REJECTED as a name for this NODE:
 * the product already uses "challenge" as a verb for contesting an element.
 * That reservation is exactly what this copy spends.
 *
 * Register: these say "Ask AI", matching the submenu they sit in ("Ask AI",
 * tooltip "AI-powered analysis") rather than the "Ask Olumi" wording used on
 * the hover row. One submenu, one vocabulary; the estate's mixed usage is a
 * separate question and not this lane's to settle.
 *
 * Kinds absent from this table fall back to the generic pair above. The table
 * is therefore additive: it cannot silently reword what already ships.
 */
const CHALLENGE_COPY: Partial<
  Record<NodeType, { prompt: (label: string) => string; tooltip: string }>
> = {
  decision: {
    prompt: (label) =>
      `Challenge how this question is framed: "${label}". Is it the right thing to be working out, and what is it assuming?`,
    tooltip: 'Ask AI to argue this is the wrong question to be asking',
  },
  option: {
    prompt: (label) =>
      `Challenge the option "${label}". What would make it a worse choice than it looks, and what alternative is missing?`,
    tooltip: 'Ask AI to argue against this option',
  },
  // Constraint is included on the strength of its OWN schema, not by analogy:
  // `ConstraintNodeDataSchema` carries `constraintType`, `thresholdValue`,
  // `unit` and `hardConstraint` — more genuinely challengeable setup than a
  // goal, which already ships the control. The three things worth contesting
  // about a limit are whether it is real, whether it is set at the right level,
  // and who has the authority to move it.
  constraint: {
    prompt: (label) =>
      `Challenge the constraint "${label}". Is it real, is it set at the right level, and who could relax it?`,
    tooltip: 'Ask AI to argue this constraint is wrong or negotiable',
  },
}

/**
 * The menu's tooltip for "Challenge this", from the same table as the prompt.
 *
 * Exported so `useMenuItems` reads it rather than holding its own string — the
 * fixed literal it used to carry is precisely the hand-maintained mirror that
 * would drift the first time either half was reworded.
 */
export function buildChallengeTooltip(nodeType: NodeType): string {
  return CHALLENGE_COPY[nodeType]?.tooltip ?? GENERIC_CHALLENGE_TOOLTIP
}

/**
 * The one producer of ask-prompt copy for canvas elements.
 *
 * ⭐ EXPORTED so a surface can offer one of these prompts WITHOUT inheriting
 * `askAI`'s auto-send. `NodeQuickActions`' challenge button reads its text from
 * here and routes it through `requestAsk` instead — same sentence, different
 * confirmation. Pasting the string into that component would have been the
 * smaller diff and the worse change: one idea with two spellings, drifting the
 * first time either is reworded.
 *
 * ⚠ "`askAI`'s auto-send" NO LONGER EXISTS (24 Sep 2026): `askAI` now routes
 * through `requestAsk` too, so every door that reads this producer confirms the
 * same way. The export is still the right shape — a surface that does not want
 * `askAI`'s selection step can still take the sentence alone.
 *
 * The two questions this file answers are deliberately separate (trap 21):
 * WHAT is asked lives here; HOW an ask is confirmed lives at the call site.
 */
export function buildAskAIPrompt(target: ContextTarget, intent: string): string {
  if (target.kind === 'node') {
    const label = (target.node.data as any)?.label ?? 'this element'
    if (intent === 'explain_element') {
      return `Explain the role of "${label}" in this decision model.`
    }
    if (intent === 'challenge_element') {
      return (CHALLENGE_COPY[target.nodeType]?.prompt ?? genericChallengePrompt)(label)
    }
  }

  if (target.kind === 'edge') {
    const store = useCanvasStore.getState()
    const sourceNode = store.nodes.find((n) => n.id === target.edge.source)
    const targetNode = store.nodes.find((n) => n.id === target.edge.target)
    const sourceLabel = (sourceNode?.data as any)?.label ?? target.edge.source
    const targetLabel = (targetNode?.data as any)?.label ?? target.edge.target
    if (intent === 'explain_element') {
      return `Explain the relationship between "${sourceLabel}" and "${targetLabel}".`
    }
    if (intent === 'challenge_element') {
      return `Challenge the link between "${sourceLabel}" and "${targetLabel}". Is it overweighted or wrong?`
    }
  }

  if (target.kind === 'multi') {
    return 'Explain the relationship between these selected elements.'
  }

  if (target.kind === 'pane' && intent === 'review_model_gaps') {
    return "What's missing from this decision model? Review the graph for structural gaps."
  }

  return 'Tell me about this.'
}

export function askAI(
  target: ContextTarget,
  intent: string,
  showToast?: ShowToastFn,
): void {
  const store = useCanvasStore.getState()

  // 1. Select target element(s) so selected_elements is populated in turn request
  if (target.kind === 'node') {
    store.selectNodeWithoutHistory(target.nodeId)
  } else if (target.kind === 'edge') {
    // Directly set selection to include this edge
    useCanvasStore.setState({
      selection: {
        nodeIds: new Set<string>(),
        edgeIds: new Set([target.edgeId]),
        anchorPosition: null,
      },
    })
  } else if (target.kind === 'multi') {
    // Preserve both node and edge selection for multi-target context.
    // Must also update node.selected flags for React Flow visual highlighting.
    const nodeIdSet = new Set(target.nodeIds)
    useCanvasStore.setState((s) => ({
      nodes: s.nodes.map((n) => ({ ...n, selected: nodeIdSet.has(n.id) })),
      selection: {
        nodeIds: nodeIdSet,
        edgeIds: new Set(target.edgeIds),
        anchorPosition: null,
      },
    }))
  }

  // 2. Open conversation panel
  store.setShowDraftChat(true)

  // 3. Land the prompt as an editable DRAFT once a conversation surface has
  //    registered — never send it. The panel needs multiple frames to render +
  //    run effects, so poll with a timeout.
  //
  //    ⚠ THIS USED TO SEND (`_sendMessage(prompt)`), in the user's name, from
  //    the card's hover Ask and every context-menu ask — against the house rule
  //    `ASK_SEMANTIC = 'prefill-and-confirm'` that the challenge button, the
  //    ghost doors and the coaching icon already followed. Only the CONFIRMATION
  //    moved: selection (step 1) and the prompt copy are unchanged, and
  //    `requestAsk` picks the surface (composer, else the Ask drawer).
  const prompt = buildAskAIPrompt(target, intent)
  const label = target.kind === 'node'
    ? `Ask Olumi about ${(target.node.data as any)?.label ?? 'this element'}`
    : 'Ask Olumi'
  let attempts = 0
  const MAX_ATTEMPTS = 20 // ~1s max wait (50ms × 20)
  const tryToAsk = () => {
    if (canReceiveAsk(useGuidanceStore.getState())) {
      const landed = requestAsk({
        text: prompt,
        label,
        targetId: target.kind === 'node' ? target.nodeId : undefined,
        source: 'context-menu',
      })
      if (landed === 'none') showToast?.('Could not open a draft — try typing your question directly.', 'warning')
      return
    }
    attempts++
    if (attempts < MAX_ATTEMPTS) {
      setTimeout(tryToAsk, 50)
    } else {
      // Same words as the sibling doors (the challenge button, the coaching icon).
      showToast?.('Could not open a draft — try typing your question directly.', 'warning')
    }
  }
  // Start after first frame to give React a chance to commit
  requestAnimationFrame(tryToAsk)
}

// ---------------------------------------------------------------------------
// Clipboard operations (delegate to existing store actions)
// ---------------------------------------------------------------------------

export function copyAction(): void {
  useCanvasStore.getState().copySelected()
}

export async function cutAction(showToast: ShowToastFn): Promise<void> {
  const store = useCanvasStore.getState()
  store.copySelected()
  // Delete via commitValidatedMutation
  const { nodeIds, edgeIds } = store.selection
  if (nodeIds.size === 0 && edgeIds.size === 0) return
  const ops: PatchOperation[] = [
    ...[...edgeIds].map((id) => ({ op: 'remove_edge' as const, target_id: id, data: {} })),
    ...[...nodeIds].map((id) => ({ op: 'remove_node' as const, target_id: id, data: {} })),
  ]
  await commitValidatedMutation(ops, () => store.deleteSelected(), showToast)
}

export async function pasteAction(
  flowPos: { x: number; y: number },
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()
  if (!store.clipboard || store.clipboard.nodes.length === 0) return

  const nodeOps: PatchOperation[] = store.clipboard.nodes.map((n) => ({
    op: 'add_node' as const,
    target_id: n.id,
    data: { kind: (n.data as any)?.kind ?? n.type, label: (n.data as any)?.label ?? '' },
  }))
  const edgeOps: PatchOperation[] = store.clipboard.edges.map((e) => ({
    op: 'add_edge' as const,
    target_id: e.id,
    data: { from: e.source, to: e.target },
  }))
  await commitValidatedMutation([...nodeOps, ...edgeOps], () => store.pasteClipboard(), showToast)
}

export async function duplicateAction(showToast: ShowToastFn): Promise<void> {
  const store = useCanvasStore.getState()
  const { nodeIds, edgeIds } = store.selection
  if (nodeIds.size === 0 && edgeIds.size === 0) return

  const nodeOps: PatchOperation[] = [...nodeIds].map((id) => {
    const node = store.nodes.find((n) => n.id === id)
    return {
      op: 'add_node' as const,
      target_id: `dup-${id}`,
      data: { kind: (node?.data as any)?.kind ?? 'factor', label: (node?.data as any)?.label ?? '' },
    }
  })
  // Include edges whose both endpoints are in the selection (they'll be duplicated too)
  const edgeOps: PatchOperation[] = store.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      op: 'add_edge' as const,
      target_id: `dup-${e.id}`,
      data: { from: `dup-${e.source}`, to: `dup-${e.target}` },
    }))
  await commitValidatedMutation([...nodeOps, ...edgeOps], () => store.duplicateSelected(), showToast)
}

// ---------------------------------------------------------------------------
// Select path to goal (Graph Editing Experience Task 7c)
// ---------------------------------------------------------------------------

export function selectPathToGoalAction(
  nodeId: string,
  showToast: ShowToastFn,
): void {
  const store = useCanvasStore.getState()
  const { nodes, edges } = store
  const goalNodes = nodes.filter(n => n.type === 'goal')
  if (goalNodes.length === 0) {
    showToast('No goal node found in the model.', 'warning')
    return
  }

  // BFS from nodeId through forward edges to find path to any goal
  const adj = new Map<string, Array<{ target: string; edgeId: string }>>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of edges) {
    adj.get(e.source)?.push({ target: e.target, edgeId: e.id })
  }

  const goalIdSet = new Set(goalNodes.map(n => n.id))
  const visited = new Map<string, { parent: string | null; edgeId: string | null }>()
  const queue = [nodeId]
  visited.set(nodeId, { parent: null, edgeId: null })

  let foundGoal: string | null = null
  while (queue.length > 0 && !foundGoal) {
    const current = queue.shift()!
    for (const neighbour of adj.get(current) ?? []) {
      if (visited.has(neighbour.target)) continue
      visited.set(neighbour.target, { parent: current, edgeId: neighbour.edgeId })
      if (goalIdSet.has(neighbour.target)) {
        foundGoal = neighbour.target
        break
      }
      queue.push(neighbour.target)
    }
  }

  if (!foundGoal) {
    showToast('No path found from this node to the goal.', 'info')
    return
  }

  // Trace back to build path
  const pathNodeIds = new Set<string>()
  const pathEdgeIds = new Set<string>()
  let current: string | null = foundGoal
  while (current) {
    pathNodeIds.add(current)
    const entry = visited.get(current)
    if (entry?.edgeId) pathEdgeIds.add(entry.edgeId)
    current = entry?.parent ?? null
  }

  // Set selection
  store.selectNodes([...pathNodeIds])
  showToast(`Selected ${pathNodeIds.size} nodes on path to goal.`, 'info')
}
