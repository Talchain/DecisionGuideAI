/**
 * Context menu action implementations.
 *
 * All graph mutation actions go through commitValidatedMutation (Hard rule 2).
 * UI-only state (flagged_as_assumption, _baseline_snapshot) bypasses PLoT (Hard rule 3).
 * Ask AI uses the _sendMessage callback from guidanceStore (fallback path).
 */

import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { commitValidatedMutation } from '../mutations/commitValidatedMutation'
import type { PatchOperation } from '../conversation/types'
import type { ContextTarget, NodeTarget, EdgeTarget, MultiTarget } from './types'
import type { NodeType } from '../domain/nodes'

type ShowToastFn = (message: string, type: 'error' | 'info' | 'success' | 'warning') => void

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteAction(
  target: ContextTarget,
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()

  if (target.kind === 'edge') {
    const ops: PatchOperation[] = [{ op: 'remove_edge', target_id: target.edgeId, data: {} }]
    await commitValidatedMutation(ops, () => store.deleteEdge(target.edgeId), showToast)
  } else if (target.kind === 'node') {
    // Include connected edge removals in patch for explicitness (local cascades automatically)
    const connectedEdgeOps: PatchOperation[] = store.edges
      .filter((e) => e.source === target.nodeId || e.target === target.nodeId)
      .map((e) => ({ op: 'remove_edge' as const, target_id: e.id, data: {} }))
    const ops: PatchOperation[] = [
      ...connectedEdgeOps,
      { op: 'remove_node', target_id: target.nodeId, data: {} },
    ]
    await commitValidatedMutation(ops, () => store.deleteNodeById(target.nodeId), showToast)
  } else if (target.kind === 'multi') {
    const ops: PatchOperation[] = [
      ...target.edgeIds.map((id) => ({ op: 'remove_edge' as const, target_id: id, data: {} })),
      ...target.nodeIds.map((id) => ({ op: 'remove_node' as const, target_id: id, data: {} })),
    ]
    await commitValidatedMutation(ops, () => store.deleteSelected(), showToast)
  }
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

  const kind = (targetNode.data?.kind as string) ?? targetNode.type ?? 'factor'
  const edgeDirection = getEdgeDirectionForKind(kind)
  const pos = computeConnectedNodePos(targetNode)

  const nodeId = store.createNodeId()
  const edgeId = store.createEdgeId()
  const [source, target_] = edgeDirection === 'to-target'
    ? [nodeId, target.nodeId]
    : [target.nodeId, nodeId]

  const ops: PatchOperation[] = [
    { op: 'add_node', target_id: nodeId, data: { kind: 'factor', label: 'New factor', category: 'controllable' } },
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

function buildAskAIPrompt(target: ContextTarget, intent: string): string {
  if (target.kind === 'node') {
    const label = (target.node.data as any)?.label ?? 'this element'
    if (intent === 'explain_element') {
      return `Explain the role of "${label}" in this decision model.`
    }
    if (intent === 'challenge_element') {
      return `Challenge the current setup of "${label}". What could be wrong or missing?`
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

  // 3. Send message once ConversationPanel has mounted and registered _sendMessage.
  //    The panel needs multiple frames to render + run effects, so poll with a timeout.
  const prompt = buildAskAIPrompt(target, intent)
  let attempts = 0
  const MAX_ATTEMPTS = 20 // ~1s max wait (50ms × 20)
  const tryToSend = () => {
    const sendMessage = useGuidanceStore.getState()._sendMessage
    if (sendMessage) {
      sendMessage(prompt)
      return
    }
    attempts++
    if (attempts < MAX_ATTEMPTS) {
      setTimeout(tryToSend, 50)
    } else {
      showToast?.('Could not send message — try typing your question directly.', 'warning')
    }
  }
  // Start after first frame to give React a chance to commit
  requestAnimationFrame(tryToSend)
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
