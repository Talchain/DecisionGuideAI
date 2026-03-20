/**
 * Context menu action implementations.
 *
 * All graph mutation actions go through commitValidatedMutation (Hard rule 2).
 * UI-only state (flagged_as_assumption, _baseline_snapshot) bypasses PLoT (Hard rule 3).
 * Ask AI uses the _sendMessage callback from guidanceStore (fallback path).
 */

import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
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

type ShowToastFn = (message: string, type: 'error' | 'info' | 'success' | 'warning') => void

// ---------------------------------------------------------------------------
// Delete (with structural guardrails — Graph Editing Experience Task 2d)
// ---------------------------------------------------------------------------

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

export async function deleteAction(
  target: ContextTarget,
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
    // Deduplicate
    const seenOptions = new Set<string>()
    aggregated.disconnectsOptions = aggregated.disconnectsOptions.filter(o => {
      if (seenOptions.has(o.optionId)) return false
      seenOptions.add(o.optionId)
      return true
    })
    // Don't warn about nodes being orphaned if they're also being deleted
    const deletingIds = new Set(target.nodeIds)
    aggregated.orphansNodes = aggregated.orphansNodes.filter(o => !deletingIds.has(o.nodeId))

    if (isSignificantImpact(aggregated)) {
      const label = `${target.nodeIds.length} element${target.nodeIds.length > 1 ? 's' : ''}`
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

// ---------------------------------------------------------------------------
// Add node (canvas pane target)
// ---------------------------------------------------------------------------

export async function addNodeAction(
  type: NodeType,
  flowPos: { x: number; y: number },
  showToast: ShowToastFn,
): Promise<void> {
  const store = useCanvasStore.getState()

  // Task 6b: Auto-connect option to decision node
  if (type === 'option') {
    const decisionNode = store.nodes.find(n => n.type === 'decision')
    if (decisionNode) {
      const limitKind = wouldExceedLimits(store.nodes.length, store.edges.length, 1, 1)
      if (limitKind) {
        showToast(limitExceededMessage(limitKind, limitKind === 'node_limit' ? store.nodes.length : store.edges.length), 'warning')
        return
      }
      const nodeId = store.createNodeId()
      const edgeId = store.createEdgeId()
      const ops: PatchOperation[] = [
        { op: 'add_node', target_id: nodeId, data: { kind: 'option', label: 'New option' } },
        { op: 'add_edge', target_id: edgeId, data: { from: decisionNode.id, to: nodeId } },
      ]
      await commitValidatedMutation(
        ops,
        () => store.addNodeWithEdge(flowPos, 'option', decisionNode.id, 'from-target'),
        showToast,
      )
      return
    }
  }

  // PRD guardrail: check node limit before creating
  const limitKind = wouldExceedLimits(store.nodes.length, store.edges.length, 1, 0)
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
  const limitKind = wouldExceedLimits(store.nodes.length, store.edges.length, 1, 1)
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
    { op: 'add_node', target_id: nodeId, data: { kind: 'factor', label: 'New factor', category: 'external' } },
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

  const limitKind = wouldExceedLimits(store.nodes.length, store.edges.length, 1, 1)
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

  const limitKind = wouldExceedLimits(store.nodes.length, store.edges.length, 1, 1)
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
  const limitKind = wouldExceedLimits(store.nodes.length, store.edges.length, 1, 1)
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
    { op: 'add_node', target_id: newNodeId, data: { kind: 'factor', label: 'New factor', category: 'external' } },
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
          data: { label: 'New factor', kind: 'factor', category: 'external' },
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
