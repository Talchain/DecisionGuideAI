/**
 * graphGuardrails — Pure, synchronous graph validation functions for pre-mutation checks.
 *
 * These are the client-side structural guardrails that run before or immediately after
 * every structural edit. No backend calls. Instant feedback.
 *
 * Extracted from useModelHealth.ts (Kahn's algorithm, BFS reachability) and unified
 * with new pre-mutation checks (cycle prevention, deletion impact assessment, limits).
 */

import type { Node, Edge } from '@xyflow/react'
import type { LimitsV1 } from '../../adapters/plot/types'

// ---------------------------------------------------------------------------
// PRD guardrail limits
// ---------------------------------------------------------------------------

/** Maximum number of nodes allowed in the graph (static product cap / engine-limit fallback) */
export const MAX_NODES = 50

/**
 * Maximum number of edges allowed in the graph (static product cap /
 * engine-limit fallback). 100 is the shared-contract REJECT cap
 * (@talchain/schemas MAX_EDGES): PLoT's V2 preflight 422-blocks and the
 * SCM-Lite V1 path 400s above it. PLoT's 120/160 numbers are CRITIQUE
 * thresholds (advisory / results-marked-approximate), not accept limits —
 * the fallback ceiling must never exceed what the engine accepts, because
 * this constant is exactly what applies when the live /v1/limits fetch
 * fails. When the fetch succeeds the live value still wins when lower.
 */
export const MAX_EDGES = 100

/** The single effective ceiling all add-time limit checks compare against. */
export interface EffectiveGraphLimits {
  maxNodes: number
  maxEdges: number
}

function validEngineMax(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null
}

/**
 * Resolve the ONE effective graph-size ceiling from the engine's live
 * /v1/limits value and the static product caps.
 *
 * Semantics: min(static cap, engine limit when validly present).
 * - Engine BELOW the cap wins — building past what the engine accepts only
 *   moves the failure to run time.
 * - Engine ABOVE the cap does not raise it — the static cap is a product
 *   decision, not a capacity guess.
 * - Absent/invalid engine data (null, 0, NaN) falls back to the static caps,
 *   so a bad limits payload can never brick editing.
 */
export function resolveGraphLimits(
  engineLimits?: LimitsV1 | null,
): EffectiveGraphLimits {
  const engineNodes = validEngineMax(engineLimits?.nodes?.max)
  const engineEdges = validEngineMax(engineLimits?.edges?.max)
  return {
    maxNodes: engineNodes !== null ? Math.min(MAX_NODES, engineNodes) : MAX_NODES,
    maxEdges: engineEdges !== null ? Math.min(MAX_EDGES, engineEdges) : MAX_EDGES,
  }
}

// ---------------------------------------------------------------------------
// Primitive checks
// ---------------------------------------------------------------------------

export function isSelfLoop(source: string, target: string): boolean {
  return source === target
}

export function isDuplicateEdge(
  edges: ReadonlyArray<{ source: string; target: string }>,
  source: string,
  target: string,
): boolean {
  return edges.some(e => e.source === source && e.target === target)
}

// ---------------------------------------------------------------------------
// Cycle detection — Kahn's algorithm (topological sort)
// ---------------------------------------------------------------------------

/**
 * Detect all nodes participating in at least one cycle.
 * Returns the set of node IDs that are part of a cycle.
 */
export function detectCycles(
  nodeIds: string[],
  edges: ReadonlyArray<{ source: string; target: string }>,
): Set<string> {
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adj.set(id, [])
  }
  for (const e of edges) {
    if (!inDegree.has(e.source) || !inDegree.has(e.target)) continue
    adj.get(e.source)!.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const sorted = new Set<string>()
  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.add(node)
    for (const neighbor of adj.get(node) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  const cycleNodes = new Set<string>()
  for (const id of nodeIds) {
    if (!sorted.has(id)) cycleNodes.add(id)
  }
  return cycleNodes
}

/**
 * Would adding an edge from proposedSource → proposedTarget create a cycle?
 * Simulates the edge addition and runs cycle detection.
 */
export function wouldCreateCycle(
  nodeIds: string[],
  edges: ReadonlyArray<{ source: string; target: string }>,
  proposedSource: string,
  proposedTarget: string,
): boolean {
  // Quick check: if target can already reach source via existing edges, adding
  // source→target would close the loop. BFS from target is faster than full Kahn's.
  const adj = new Map<string, string[]>()
  for (const id of nodeIds) adj.set(id, [])
  for (const e of edges) {
    adj.get(e.source)?.push(e.target)
  }

  // BFS from proposedTarget: can we reach proposedSource?
  const visited = new Set<string>()
  const queue = [proposedTarget]
  while (queue.length > 0) {
    const node = queue.shift()!
    if (node === proposedSource) return true
    if (visited.has(node)) continue
    visited.add(node)
    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) queue.push(neighbor)
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// BFS reachability
// ---------------------------------------------------------------------------

/**
 * BFS reachability from a set of start nodes through a directed adjacency map.
 */
export function bfsReachable(
  startIds: Set<string>,
  adj: Map<string, string[]>,
): Set<string> {
  const visited = new Set<string>()
  const queue = [...startIds]
  while (queue.length > 0) {
    const node = queue.shift()!
    if (visited.has(node)) continue
    visited.add(node)
    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) queue.push(neighbor)
    }
  }
  return visited
}

/**
 * Build a forward adjacency map from edges.
 */
export function buildAdjacency(
  nodeIds: string[],
  edges: ReadonlyArray<{ source: string; target: string }>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const id of nodeIds) adj.set(id, [])
  for (const e of edges) {
    adj.get(e.source)?.push(e.target)
  }
  return adj
}

// ---------------------------------------------------------------------------
// Limit checks
// ---------------------------------------------------------------------------

export type LimitExceeded = 'node_limit' | 'edge_limit'

/**
 * Check if adding nodes/edges would exceed the effective graph limits.
 * Returns the type of limit that would be exceeded, or null if OK.
 *
 * Pass the store's live `engineLimits` (LimitsV1 | null) so the check runs
 * against the single resolved ceiling (see resolveGraphLimits). Omitting it
 * falls back to the static product caps.
 */
export function wouldExceedLimits(
  currentNodeCount: number,
  currentEdgeCount: number,
  addingNodes: number,
  addingEdges: number,
  engineLimits?: LimitsV1 | null,
): LimitExceeded | null {
  const { maxNodes, maxEdges } = resolveGraphLimits(engineLimits)
  if (currentNodeCount + addingNodes > maxNodes) return 'node_limit'
  if (currentEdgeCount + addingEdges > maxEdges) return 'edge_limit'
  return null
}

/**
 * User-facing message for limit exceeded.
 */
export function limitExceededMessage(
  kind: LimitExceeded,
  currentCount: number,
): string {
  if (kind === 'node_limit') {
    return `Your model has reached ${currentCount} nodes. Consider simplifying before adding more. Tip: remove factors with low influence.`
  }
  return `Your model has reached ${currentCount} edges. Consider simplifying before adding more. Tip: remove factors with low influence.`
}

// ---------------------------------------------------------------------------
// Deletion impact assessment
// ---------------------------------------------------------------------------

export interface DeletionImpact {
  /** Options that would lose their path to the goal */
  disconnectsOptions: Array<{ optionId: string; optionLabel: string }>
  /** Nodes that would become orphaned (no remaining edges) */
  orphansNodes: Array<{ nodeId: string; nodeLabel: string }>
  /** Whether this removes the last goal node */
  removesLastGoal: boolean
  /** Whether this removes the last decision node */
  removesLastDecision: boolean
}

function getLabel(node: Node): string {
  return (node.data as Record<string, unknown>)?.label as string ?? node.id
}

/**
 * Assess the structural impact of deleting a node.
 */
export function assessNodeDeletion(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
  _goalNodeId?: string,
): DeletionImpact {
  const impact: DeletionImpact = {
    disconnectsOptions: [],
    orphansNodes: [],
    removesLastGoal: false,
    removesLastDecision: false,
  }

  const nodeToDelete = nodes.find(n => n.id === nodeId)
  if (!nodeToDelete) return impact

  // Check last goal/decision
  if (nodeToDelete.type === 'goal') {
    const goalCount = nodes.filter(n => n.type === 'goal').length
    if (goalCount <= 1) impact.removesLastGoal = true
  }
  if (nodeToDelete.type === 'decision') {
    const decisionCount = nodes.filter(n => n.type === 'decision').length
    if (decisionCount <= 1) impact.removesLastDecision = true
  }

  // Simulate deletion: remove node and its edges
  const remainingNodes = nodes.filter(n => n.id !== nodeId)
  const remainingEdges = edges.filter(e => e.source !== nodeId && e.target !== nodeId)
  const remainingNodeIds = remainingNodes.map(n => n.id)

  // Check for disconnected options (no path to goal after deletion)
  const goalIds = new Set(
    remainingNodes.filter(n => n.type === 'goal').map(n => n.id),
  )
  if (goalIds.size > 0) {
    const adj = buildAdjacency(remainingNodeIds, remainingEdges)
    const optionNodes = remainingNodes.filter(n => n.type === 'option')
    for (const opt of optionNodes) {
      const reachable = bfsReachable(new Set([opt.id]), adj)
      const reachesGoal = [...goalIds].some(gid => reachable.has(gid))
      if (!reachesGoal) {
        // Check if this option previously reached the goal (before deletion)
        const prevAdj = buildAdjacency(nodes.map(n => n.id), edges)
        const prevReachable = bfsReachable(new Set([opt.id]), prevAdj)
        const prevReachedGoal = [...goalIds].some(gid => prevReachable.has(gid))
          || (nodeToDelete.type === 'goal' && prevReachable.has(nodeId))
        if (prevReachedGoal) {
          impact.disconnectsOptions.push({ optionId: opt.id, optionLabel: getLabel(opt) })
        }
      }
    }
  }

  // Check for newly orphaned nodes (had edges through deleted node, now have none)
  const remainingConnected = new Set<string>()
  for (const e of remainingEdges) {
    remainingConnected.add(e.source)
    remainingConnected.add(e.target)
  }
  const prevConnected = new Set<string>()
  for (const e of edges) {
    prevConnected.add(e.source)
    prevConnected.add(e.target)
  }
  for (const node of remainingNodes) {
    if (node.type === 'decision') continue // Decision nodes are expected to be standalone
    if (!remainingConnected.has(node.id) && prevConnected.has(node.id)) {
      impact.orphansNodes.push({ nodeId: node.id, nodeLabel: getLabel(node) })
    }
  }

  return impact
}

/**
 * Assess the structural impact of deleting an edge.
 */
export function assessEdgeDeletion(
  nodes: Node[],
  edges: Edge[],
  edgeId: string,
): DeletionImpact {
  const impact: DeletionImpact = {
    disconnectsOptions: [],
    orphansNodes: [],
    removesLastGoal: false,
    removesLastDecision: false,
  }

  const edgeToDelete = edges.find(e => e.id === edgeId)
  if (!edgeToDelete) return impact

  // Simulate deletion
  const remainingEdges = edges.filter(e => e.id !== edgeId)
  const nodeIds = nodes.map(n => n.id)

  // Check for disconnected options
  const goalIds = new Set(nodes.filter(n => n.type === 'goal').map(n => n.id))
  if (goalIds.size > 0) {
    const adj = buildAdjacency(nodeIds, remainingEdges)
    const prevAdj = buildAdjacency(nodeIds, edges)
    const optionNodes = nodes.filter(n => n.type === 'option')
    for (const opt of optionNodes) {
      const reachable = bfsReachable(new Set([opt.id]), adj)
      const reachesGoal = [...goalIds].some(gid => reachable.has(gid))
      if (!reachesGoal) {
        const prevReachable = bfsReachable(new Set([opt.id]), prevAdj)
        const prevReachedGoal = [...goalIds].some(gid => prevReachable.has(gid))
        if (prevReachedGoal) {
          impact.disconnectsOptions.push({ optionId: opt.id, optionLabel: getLabel(opt) })
        }
      }
    }
  }

  // Check for newly orphaned nodes
  const remainingConnected = new Set<string>()
  for (const e of remainingEdges) {
    remainingConnected.add(e.source)
    remainingConnected.add(e.target)
  }
  for (const nodeId of [edgeToDelete.source, edgeToDelete.target]) {
    const node = nodes.find(n => n.id === nodeId)
    if (!node || node.type === 'decision') continue
    if (!remainingConnected.has(nodeId)) {
      impact.orphansNodes.push({ nodeId, nodeLabel: getLabel(node) })
    }
  }

  return impact
}

/**
 * Check if a deletion impact is significant enough to warrant a confirmation dialog.
 */
export function isSignificantImpact(impact: DeletionImpact): boolean {
  return (
    impact.removesLastGoal ||
    impact.removesLastDecision ||
    impact.disconnectsOptions.length > 0 ||
    impact.orphansNodes.length > 0
  )
}

/**
 * Build a user-facing confirmation message from a DeletionImpact.
 */
export function buildDeletionMessage(impact: DeletionImpact, elementLabel: string): {
  title: string
  message: string
  blocked: boolean
} {
  if (impact.removesLastGoal) {
    return {
      title: 'Cannot remove the only goal',
      message: 'Every model needs a goal. Add a different goal before removing this one.',
      blocked: true,
    }
  }
  if (impact.removesLastDecision) {
    return {
      title: 'Cannot remove the only decision',
      message: 'Every model needs a decision node. Add a different one before removing this.',
      blocked: true,
    }
  }

  const parts: string[] = []
  if (impact.disconnectsOptions.length > 0) {
    const names = impact.disconnectsOptions.map(o => `"${o.optionLabel}"`).join(', ')
    parts.push(
      `Removing "${elementLabel}" breaks the path from ${names} to your goal. The analysis won't be able to evaluate ${impact.disconnectsOptions.length === 1 ? 'that option' : 'those options'}.`,
    )
  }
  if (impact.orphansNodes.length > 0) {
    const names = impact.orphansNodes.map(o => `"${o.nodeLabel}"`).join(', ')
    parts.push(
      `${names} will be left disconnected and won't affect the analysis.`,
    )
  }

  return {
    title: `Remove "${elementLabel}"?`,
    message: parts.join(' '),
    blocked: false,
  }
}
