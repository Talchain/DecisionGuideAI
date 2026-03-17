/**
 * applyPatch — Bulk-apply graph_patch operations to the canvas store
 *
 * Replaces the per-operation addNode/addEdge pattern with batch setState,
 * matching the proven applyDraftResult.ts approach. Handles CEE field name
 * normalisation (kind→type, from/to→source/target) and operation ordering.
 */

import { useCanvasStore } from '../../store'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import { saveAutosave } from '../../store/scenarios'
import type { PatchOperation, GraphPatchBlock } from '../types'
import type { EffectDirection, CEEAnalysisReady, CEEInterventionV3 } from '../../../adapters/cee/types'

// ---------------------------------------------------------------------------
// Operation sort order — ensures nodes exist before edges reference them,
// and removes happen last so updates can still target them.
// ---------------------------------------------------------------------------

const OP_ORDER: Record<string, number> = {
  add_node: 0,
  add_edge: 1,
  update_node: 2,
  update_edge: 3,
  remove_edge: 4,
  remove_node: 5,
}

// ---------------------------------------------------------------------------
// Critical node IDs for ceeAnalysisReady invalidation
// Mirrors store.ts getCriticalNodeIds — goal, option, and intervention targets
// ---------------------------------------------------------------------------

function getCriticalNodeIds(analysisReady: CEEAnalysisReady | null): Set<string> {
  const ids = new Set<string>()
  if (!analysisReady) return ids
  if (analysisReady.goal_node_id) ids.add(analysisReady.goal_node_id)
  for (const option of analysisReady.options ?? []) {
    if (option.id) ids.add(option.id)
    for (const nodeId of Object.keys(option.interventions ?? {})) {
      ids.add(nodeId)
    }
  }
  return ids
}

export function sortPatchOperations(ops: PatchOperation[]): PatchOperation[] {
  return [...ops].sort(
    (a, b) => (OP_ORDER[a.op] ?? 99) - (OP_ORDER[b.op] ?? 99)
  )
}

// ---------------------------------------------------------------------------
// Node builder — mirrors applyDraftResult.ts:36-49
// ---------------------------------------------------------------------------

function buildNode(op: PatchOperation) {
  const d = op.data ?? {}
  const kind = (d.kind as string) || (d.type as string) || 'decision'
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { kind: _k, type: _t, observed_state, ...rest } = d as Record<string, unknown>
  return {
    id: op.target_id,
    type: kind,
    position: { x: 0, y: 0 },
    data: {
      ...rest,
      label: (d.label as string) ?? 'Untitled',
      kind,
      ...(observed_state ? { observedState: observed_state } : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// Edge builder — mirrors applyDraftResult.ts:52-105
// ---------------------------------------------------------------------------

function buildEdge(op: PatchOperation) {
  const d = op.data ?? {}
  const source = (d.source as string) ?? (d.from as string) ?? ''
  const target = (d.target as string) ?? (d.to as string) ?? ''

  // Weight priority: strength.mean > strength_mean > weight > default
  const strength = d.strength as Record<string, unknown> | undefined
  const rawWeight: number =
    typeof strength?.mean === 'number'
      ? strength.mean
      : typeof d.strength_mean === 'number'
        ? d.strength_mean
        : typeof d.weight === 'number'
          ? (d.weight as number)
          : DEFAULT_EDGE_DATA.weight

  // Direction inference
  const directionFromData: EffectDirection | undefined =
    d.effect_direction === 'positive' || d.effect_direction === 'negative'
      ? (d.effect_direction as EffectDirection)
      : undefined
  const direction: EffectDirection =
    directionFromData ?? ((rawWeight as number) < 0 ? 'negative' : 'positive')

  const weight = Math.max(0, Math.min(2, Math.abs(rawWeight as number)))
  const confidence =
    typeof d.belief === 'number'
      ? Math.max(0, Math.min(1, d.belief as number))
      : undefined
  const beliefExists =
    typeof d.belief_exists === 'number'
      ? Math.max(0, Math.min(1, d.belief_exists as number))
      : confidence
  const strengthStd: number | undefined =
    typeof strength?.std === 'number'
      ? (strength.std as number)
      : typeof d.strength_std === 'number'
        ? (d.strength_std as number)
        : undefined

  return {
    id: op.target_id,
    source,
    target,
    type: 'styled' as const,
    data: {
      ...DEFAULT_EDGE_DATA,
      weight,
      pathType: 'bezier' as const,
      confidence,
      beliefExists,
      ...(direction ? { direction } : {}),
      ...(strengthStd !== undefined ? { strengthStd } : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// Main: apply a graph_patch block to the canvas store
// ---------------------------------------------------------------------------

export interface ApplyPatchResult {
  addedNodeCount: number
  addedEdgeCount: number
  modifiedIds: string[]
}

export function applyAutoApplyPatch(patchBlock: GraphPatchBlock): ApplyPatchResult {
  const result: ApplyPatchResult = { addedNodeCount: 0, addedEdgeCount: 0, modifiedIds: [] }
  const sorted = sortPatchOperations(patchBlock.operations)

  // Partition operations
  const newNodes: ReturnType<typeof buildNode>[] = []
  const newEdges: ReturnType<typeof buildEdge>[] = []
  const nodeUpdates = new Map<string, Record<string, unknown>>()
  const edgeUpdates = new Map<string, Record<string, unknown>>()
  const removeNodeIds = new Set<string>()
  const removeEdgeIds = new Set<string>()

  for (const op of sorted) {
    // Guard: skip ops with missing target_id (except nothing should lack it)
    if (!op.target_id) continue

    switch (op.op) {
      case 'add_node':
        if (!op.data) break
        newNodes.push(buildNode(op))
        result.modifiedIds.push(op.target_id)
        break

      case 'add_edge': {
        if (!op.data) break
        const edge = buildEdge(op)
        // Guard: skip edges with missing endpoints
        if (!edge.source || !edge.target) {
          if (import.meta.env.DEV) {
            console.warn(`[applyAutoApplyPatch] add_edge skipped — missing source/target for "${op.target_id}"`)
          }
          break
        }
        newEdges.push(edge)
        result.modifiedIds.push(op.target_id)
        break
      }

      case 'update_node': {
        if (!op.data) break
        // Normalise CEE field names in update data
        const updateData = { ...op.data }
        if ('observed_state' in updateData) {
          updateData.observedState = updateData.observed_state
          delete updateData.observed_state
        }
        nodeUpdates.set(op.target_id, updateData)
        result.modifiedIds.push(op.target_id)
        break
      }

      case 'update_edge': {
        if (!op.data) break
        // Normalise CEE endpoint field names for rewires
        const edgeUpdate = { ...op.data }
        const rewireSource = (edgeUpdate.source as string) ?? (edgeUpdate.from as string)
        const rewireTarget = (edgeUpdate.target as string) ?? (edgeUpdate.to as string)
        if (rewireSource) { edgeUpdate._rewireSource = rewireSource }
        if (rewireTarget) { edgeUpdate._rewireTarget = rewireTarget }
        // Clean raw endpoint fields from data payload (they live on the edge top-level)
        delete edgeUpdate.source; delete edgeUpdate.from
        delete edgeUpdate.target; delete edgeUpdate.to
        edgeUpdates.set(op.target_id, edgeUpdate)
        result.modifiedIds.push(op.target_id)
        break
      }

      case 'remove_node':
        removeNodeIds.add(op.target_id)
        result.modifiedIds.push(op.target_id)
        break

      case 'remove_edge':
        removeEdgeIds.add(op.target_id)
        result.modifiedIds.push(op.target_id)
        break

      default:
        if (import.meta.env.DEV) {
          console.warn(`[applyAutoApplyPatch] unknown op: "${(op as any).op}"`)
        }
    }
  }

  // --- Single bulk mutation ---
  const store = useCanvasStore.getState()
  const existingNodes = [...store.nodes]
  const existingEdges = [...store.edges]

  // 1. Apply node updates to existing nodes
  let mergedNodes = existingNodes.map((n) => {
    const update = nodeUpdates.get(n.id)
    if (!update) return n
    return { ...n, data: { ...n.data, ...update } }
  })

  // 2. Apply edge updates to existing edges (including endpoint rewires)
  let mergedEdges = existingEdges.map((e) => {
    const update = edgeUpdates.get(e.id)
    if (!update) return e
    const { _rewireSource, _rewireTarget, ...dataUpdate } = update
    return {
      ...e,
      ...(typeof _rewireSource === 'string' ? { source: _rewireSource } : {}),
      ...(typeof _rewireTarget === 'string' ? { target: _rewireTarget } : {}),
      data: { ...e.data, ...dataUpdate },
    }
  })

  // 3. Append new nodes and edges
  mergedNodes = [...mergedNodes, ...newNodes]
  mergedEdges = [...mergedEdges, ...newEdges]

  // 4. Remove marked nodes and edges (cascade: also remove edges referencing removed nodes)
  if (removeNodeIds.size > 0) {
    mergedNodes = mergedNodes.filter((n) => !removeNodeIds.has(n.id))
    mergedEdges = mergedEdges.filter(
      (e) => !removeNodeIds.has(e.source) && !removeNodeIds.has(e.target)
    )
  }
  if (removeEdgeIds.size > 0) {
    mergedEdges = mergedEdges.filter((e) => !removeEdgeIds.has(e.id))
  }

  // 5. Commit to store in a single setState
  useCanvasStore.setState({
    nodes: mergedNodes as any,
    edges: mergedEdges as any,
  })

  result.addedNodeCount = newNodes.length
  result.addedEdgeCount = newEdges.length

  // 5b. Invalidation parity — match store.deleteNodeById / deleteEdgeById semantics
  if (removeNodeIds.size > 0 || removeEdgeIds.size > 0) {
    const s = useCanvasStore.getState()

    // Clear outcomeNodeId if the outcome node was removed
    if (removeNodeIds.size > 0 && s.outcomeNodeId && removeNodeIds.has(s.outcomeNodeId)) {
      useCanvasStore.setState({ outcomeNodeId: null })
    }

    // Invalidate ceeAnalysisReady if critical nodes/edges were removed
    const analysisReady = s.ceeAnalysisReady as CEEAnalysisReady | null
    if (analysisReady) {
      const criticalIds = getCriticalNodeIds(analysisReady)
      const shouldInvalidate =
        // Any removed node is critical
        [...removeNodeIds].some(id => criticalIds.has(id)) ||
        // Any removed edge connected critical nodes
        existingEdges
          .filter(e => removeEdgeIds.has(e.id) || removeNodeIds.has(e.source) || removeNodeIds.has(e.target))
          .some(e => criticalIds.has(e.source) || criticalIds.has(e.target))
      if (shouldInvalidate) {
        useCanvasStore.setState({ ceeAnalysisReady: null, ceeAnalysisReadyNodeIds: null })
      }
    }
  }

  // 6. Trigger layout if any nodes were added (they start at 0,0)
  if (newNodes.length > 0) {
    const s = useCanvasStore.getState()
    void s
      .applyLayout()
      .then(() => useCanvasStore.getState().setPendingFitView(true))
      .catch((err) => console.warn('[applyAutoApplyPatch] Layout failed:', err))
  }

  // 7. Auto-select goal node if exactly one exists
  const allNodes = useCanvasStore.getState().nodes
  const goalNodes = allNodes.filter((n: any) => n.type === 'goal')
  if (goalNodes.length === 1) {
    useCanvasStore.getState().setOutcomeNode(goalNodes[0].id)
  }

  // 8. Autosave for crash resilience
  try {
    const current = useCanvasStore.getState()
    saveAutosave({
      timestamp: Date.now(),
      scenarioId: current.currentScenarioId || undefined,
      nodes: current.nodes,
      edges: current.edges,
    })
  } catch {
    // Non-critical
  }

  return result
}

// ---------------------------------------------------------------------------
// FALLBACK: Edge synthesis used only when CEE block lacks analysis_ready.
// Remove once all CEE paths guaranteed to include it.
// The primary path (handleEnvelope) now consumes block.analysis_ready
// directly when CEE provides it. This synthesis is the fallback for
// older CEE versions that don't include analysis_ready on graph_patch.
// ---------------------------------------------------------------------------

/**
 * Synthesise a minimal CEEAnalysisReady from the current graph state.
 *
 * Called after applyAutoApplyPatch when the CEE block lacks analysis_ready.
 * Extracts option nodes, builds interventions from outgoing option→factor
 * edges, and populates the store so usePreRunValidation sees mapped options.
 */
export function synthesiseCeeAnalysisReady(): CEEAnalysisReady | null {
  const { nodes, edges, outcomeNodeId } = useCanvasStore.getState()

  // Find goal node
  const goalNode = nodes.find((n: any) => n.type === 'goal')
  const goalNodeId = outcomeNodeId ?? goalNode?.id
  if (!goalNodeId) return null

  // Find option nodes
  const optionNodes = nodes.filter((n: any) => n.type === 'option')
  if (optionNodes.length === 0) return null

  // Build a set of factor/outcome/risk node IDs (valid intervention targets)
  const factorKinds = new Set(['factor', 'outcome', 'risk'])
  const factorNodeIds = new Set(
    nodes
      .filter((n: any) => factorKinds.has(n.type ?? (n.data as any)?.kind ?? ''))
      .map((n) => n.id)
  )

  // For each option, find outgoing edges to factor nodes and build interventions
  const options = optionNodes.map((optNode) => {
    const interventions: Record<string, CEEInterventionV3> = {}

    // Find edges where this option is the source and target is a factor
    const outgoingEdges = edges.filter(
      (e) => e.source === optNode.id && factorNodeIds.has(e.target)
    )

    for (const edge of outgoingEdges) {
      // Value: reconstruct signed value from unsigned weight + direction
      // (buildEdge stores Math.abs(rawWeight) as weight, sign in direction)
      const edgeData = edge.data as Record<string, unknown> | undefined
      const weight = typeof edgeData?.weight === 'number' ? edgeData.weight : 1
      const direction = edgeData?.direction as string | undefined
      const signedValue = direction === 'negative' ? -weight : weight

      interventions[edge.target] = {
        value: signedValue,
        source: 'cee_hypothesis',
        target_match: {
          node_id: edge.target,
          match_type: 'exact_id',
          confidence: 'high',
        },
      }
    }

    return {
      id: optNode.id,
      label: (optNode.data as any)?.label ?? optNode.id,
      status: 'ready' as const,
      interventions,
    }
  })

  return {
    status: 'ready',
    goal_node_id: goalNodeId,
    options,
  }
}
