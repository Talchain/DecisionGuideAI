// src/modules/critique/useCritique.ts
import { useMemo } from 'react'
import type { CritiqueHeuristics, CritiqueItem } from './types'

type Node = { id: string; label: string; x?: number; y?: number }
type Edge = { from: string; to: string; label?: string }

export function useCritique(nodes: Node[], edges: Edge[]): CritiqueHeuristics {
  return useMemo(() => {
    const blockers: CritiqueItem[] = []
    const improvements: CritiqueItem[] = []
    const observations: CritiqueItem[] = []

    // Blocker: Dangling decisions (nodes with no outgoing edges)
    const nodesWithOutgoing = new Set(edges.map(e => e.from))
    nodes.forEach(node => {
      if (!nodesWithOutgoing.has(node.id) && nodes.length > 1) {
        blockers.push({
          id: `dangling-${node.id}`,
          severity: 'blocker',
          title: `"${node.label}" has no outcomes`,
          rationale: 'Every decision should lead somewhere',
          nodeId: node.id,
          fixAction: 'link-outcome'
        })
      }
    })

    // Improvement: Nodes without labels
    nodes.forEach(node => {
      if (!node.label || node.label.trim() === '') {
        improvements.push({
          id: `unlabeled-${node.id}`,
          severity: 'improvement',
          title: `Node "${node.id}" needs a label`,
          rationale: 'Clear labels improve understanding',
          nodeId: node.id,
          fixAction: 'focus-rename'
        })
      }
    })

    // Improvement: Isolated nodes (no incoming or outgoing edges)
    const nodesWithIncoming = new Set(edges.map(e => e.to))
    nodes.forEach(node => {
      if (!nodesWithOutgoing.has(node.id) && !nodesWithIncoming.has(node.id) && nodes.length > 1) {
        improvements.push({
          id: `isolated-${node.id}`,
          severity: 'improvement',
          title: `"${node.label}" is isolated`,
          rationale: 'Connect to the decision flow',
          nodeId: node.id
        })
      }
    })

    // Observation: High-degree hubs (nodes with >3 incoming edges)
    const incomingCounts = new Map<string, number>()
    edges.forEach(edge => {
      incomingCounts.set(edge.to, (incomingCounts.get(edge.to) || 0) + 1)
    })
    
    incomingCounts.forEach((count, nodeId) => {
      if (count > 3) {
        const node = nodes.find(n => n.id === nodeId)
        observations.push({
          id: `hub-${nodeId}`,
          severity: 'observation',
          title: `"${node?.label || nodeId}" is a hub (${count} inputs)`,
          rationale: 'Consider splitting complex nodes',
          nodeId
        })
      }
    })

    return { blockers, improvements, observations }
  }, [nodes, edges])
}
