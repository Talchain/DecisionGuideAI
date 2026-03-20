/**
 * useModelHealth — Client-side structural health checks for the decision graph.
 *
 * Runs deterministic checks after every graph mutation (no backend call).
 * Returns a list of issues with severity, description, and affected elements.
 *
 * Checks:
 * - Orphan nodes (no connected edges)
 * - Cycles (topological sort failure)
 * - Disconnected options (no path from option's intervention targets to goal)
 * - Missing goal node
 * - Missing bridge node (no path from any factor to goal)
 * - Extreme edge weights (|mean| > 0.9 with std < 0.05)
 * - Duplicate edges (same from/to pair)
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import { detectCycles, bfsReachable } from '../validation/graphGuardrails'

/** Severity levels for model health issues */
export type HealthSeverity = 'blocker' | 'warning'

/** A single model health issue */
export interface HealthIssue {
  /** Unique key for React rendering and deduplication */
  key: string
  severity: HealthSeverity
  title: string
  description: string
  /** Affected node or edge IDs (clickable to select on canvas) */
  affectedIds: string[]
}

/** Main hook: computes model health issues from current graph state */
export function useModelHealth(): HealthIssue[] {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  return useMemo(() => {
    const issues: HealthIssue[] = []
    if (!nodes || nodes.length === 0) return issues

    const nodeIds = nodes.map(n => n.id)
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const safeEdges = edges ?? []
    const edgeList = safeEdges.map(e => ({ id: e.id, source: e.source, target: e.target, data: e.data }))

    // Build adjacency (forward + reverse)
    const adj = new Map<string, string[]>()
    for (const id of nodeIds) {
      adj.set(id, [])
    }
    for (const e of edgeList) {
      adj.get(e.source)?.push(e.target)
    }

    // Connected node IDs (has at least one edge)
    const connectedNodeIds = new Set<string>()
    for (const e of edgeList) {
      connectedNodeIds.add(e.source)
      connectedNodeIds.add(e.target)
    }

    // --- Check: Missing goal node ---
    const goalNodes = nodes.filter(n => n.type === 'goal')
    if (goalNodes.length === 0) {
      issues.push({
        key: 'missing-goal',
        severity: 'blocker',
        title: 'Missing goal node',
        description: 'The model needs a goal node to define what to optimise. Add a goal to enable analysis.',
        affectedIds: [],
      })
    }

    // --- Check: Orphan nodes (no connected edges) ---
    for (const node of nodes) {
      if (node.type === 'decision') continue
      if (!connectedNodeIds.has(node.id)) {
        issues.push({
          key: `orphan-${node.id}`,
          severity: 'warning',
          title: 'Orphan node',
          description: `"${(node.data as Record<string, unknown>)?.label ?? node.id}" has no connections. It won't affect the analysis.`,
          affectedIds: [node.id],
        })
      }
    }

    // --- Check: Cycles ---
    const cycleNodes = detectCycles(nodeIds, edgeList)
    if (cycleNodes.size > 0) {
      issues.push({
        key: 'cycle',
        severity: 'blocker',
        title: 'Cycle detected',
        description: `${cycleNodes.size} node${cycleNodes.size > 1 ? 's' : ''} form a cycle. The inference engine requires a directed acyclic graph (DAG).`,
        affectedIds: [...cycleNodes],
      })
    }

    // --- Check: Disconnected options ---
    if (goalNodes.length > 0) {
      const goalIds = new Set(goalNodes.map(n => n.id))
      const optionNodes = nodes.filter(n => n.type === 'option')
      for (const opt of optionNodes) {
        const reachable = bfsReachable(new Set([opt.id]), adj)
        const reachesGoal = [...goalIds].some(gid => reachable.has(gid))
        if (!reachesGoal) {
          issues.push({
            key: `disconnected-option-${opt.id}`,
            severity: 'blocker',
            title: 'Disconnected option',
            description: `"${(opt.data as Record<string, unknown>)?.label ?? opt.id}" has no path to the goal. Its interventions can't influence the outcome.`,
            affectedIds: [opt.id],
          })
        }
      }
    }

    // --- Check: Missing bridge (no factor->goal path) ---
    if (goalNodes.length > 0) {
      const goalIds = new Set(goalNodes.map(n => n.id))
      const factorNodes = nodes.filter(n => n.type === 'factor')
      if (factorNodes.length > 0) {
        const anyFactorReachesGoal = factorNodes.some(f => {
          const reachable = bfsReachable(new Set([f.id]), adj)
          return [...goalIds].some(gid => reachable.has(gid))
        })
        if (!anyFactorReachesGoal) {
          issues.push({
            key: 'no-bridge',
            severity: 'blocker',
            title: 'No path from factors to goal',
            description: 'No factor has a connected path to the goal node. Add edges to connect factors to the goal via outcomes or directly.',
            affectedIds: [...goalIds],
          })
        }
      }
    }

    // --- Check: Extreme edge weights ---
    for (const e of edgeList) {
      const data = e.data as Record<string, unknown> | undefined
      const weight = typeof data?.weight === 'number' ? data.weight as number : null
      const std = typeof data?.strengthStd === 'number' ? data.strengthStd as number : null
      if (weight !== null && Math.abs(weight) > 0.9 && std !== null && std < 0.05) {
        const sourceLabel = (nodeMap.get(e.source)?.data as Record<string, unknown>)?.label ?? e.source
        const targetLabel = (nodeMap.get(e.target)?.data as Record<string, unknown>)?.label ?? e.target
        issues.push({
          key: `extreme-weight-${e.id}`,
          severity: 'warning',
          title: 'Extreme edge weight',
          description: `Edge "${sourceLabel}" \u2192 "${targetLabel}" has very high strength (${weight.toFixed(2)}) with very low uncertainty (std ${std.toFixed(2)}). This suggests unrealistic certainty.`,
          affectedIds: [e.id],
        })
      }
    }

    // --- Check: Duplicate edges ---
    const edgePairs = new Map<string, string[]>()
    for (const e of edgeList) {
      const key = `${e.source}\u2192${e.target}`
      const existing = edgePairs.get(key)
      if (existing) {
        existing.push(e.id)
      } else {
        edgePairs.set(key, [e.id])
      }
    }
    for (const [pair, ids] of edgePairs) {
      if (ids.length > 1) {
        const [src, tgt] = pair.split('\u2192')
        const sourceLabel = (nodeMap.get(src)?.data as Record<string, unknown>)?.label ?? src
        const targetLabel = (nodeMap.get(tgt)?.data as Record<string, unknown>)?.label ?? tgt
        issues.push({
          key: `duplicate-edge-${ids[0]}`,
          severity: 'warning',
          title: 'Duplicate edge',
          description: `${ids.length} edges connect "${sourceLabel}" \u2192 "${targetLabel}". Only one should exist.`,
          affectedIds: ids,
        })
      }
    }

    return issues
  }, [nodes, edges])
}
