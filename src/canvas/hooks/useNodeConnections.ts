/**
 * useNodeConnections — provides edge relationship data for ConnRow rendering inside canvas nodes.
 *
 * Factor nodes use direction='outbound' for "Influences:" section.
 * Outcome/Risk nodes use direction='inbound' for "Depends on:" section.
 *
 * Gate: returns [] pre-analysis (resultsStatus !== 'complete').
 * Confidence: exists_probability ?? beliefExists, scaled to 0-100. Null when missing.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import type { NodeType } from '../domain/nodes'

export interface ConnRowData {
  edgeId: string
  connectedNodeId: string
  connectedNodeKind: NodeType
  connectedNodeLabel: string
  /** Confidence percentage (0-100), or null when exists_probability is unknown */
  confidencePct: number | null
}

export function useNodeConnections(
  nodeId: string,
  direction: 'inbound' | 'outbound',
): ConnRowData[] {
  const edges = useCanvasStore(s => s.edges)
  const nodes = useCanvasStore(s => s.nodes)
  const resultsStatus = useCanvasStore(s => s.results.status)

  return useMemo(() => {
    if (resultsStatus !== 'complete') return []

    const matched = direction === 'outbound'
      ? edges.filter(e => e.source === nodeId)
      : edges.filter(e => e.target === nodeId)

    const rows: ConnRowData[] = []
    for (const edge of matched) {
      const connectedId = direction === 'outbound' ? edge.target : edge.source
      const connectedNode = nodes.find(n => n.id === connectedId)
      if (!connectedNode) continue

      const kind = (connectedNode.type ?? connectedNode.data?.type ?? 'factor') as NodeType
      const label = (connectedNode.data?.label as string) ?? 'Untitled'
      const data = edge.data as Record<string, unknown> | undefined

      // Confidence: prefer exists_probability, fall back to beliefExists
      const existsProb = typeof data?.exists_probability === 'number' ? data.exists_probability : null
      const beliefExists = typeof data?.beliefExists === 'number' ? data.beliefExists : null
      const raw = existsProb ?? beliefExists

      rows.push({
        edgeId: edge.id,
        connectedNodeId: connectedId,
        connectedNodeKind: kind,
        connectedNodeLabel: label,
        confidencePct: raw != null ? Math.round(raw * 100) : null,
      })
    }

    // Sort by confidence descending (nulls last)
    rows.sort((a, b) => (b.confidencePct ?? -1) - (a.confidencePct ?? -1))
    return rows
  }, [edges, nodes, nodeId, direction, resultsStatus])
}
