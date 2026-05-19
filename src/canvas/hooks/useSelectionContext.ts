import { useMemo } from 'react'
import { useCanvasStore } from '../store'

export interface SelectionContext {
  id: string
  label: string
  kind: 'node' | 'edge'
}

/**
 * Returns the single currently-selected canvas element, or null when nothing
 * or more than one element is selected. Used by the persistent input strip
 * (selection pill, stage-aware placeholder).
 */
export function useSelectionContext(): SelectionContext | null {
  const selection = useCanvasStore((s) => s.selection)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)

  return useMemo<SelectionContext | null>(() => {
    if (!selection) return null
    const nodeIds = selection.nodeIds
    const edgeIds = selection.edgeIds
    const nodeCount = nodeIds?.size ?? 0
    const edgeCount = edgeIds?.size ?? 0
    if (nodeCount + edgeCount !== 1) return null

    if (nodeCount === 1) {
      const id = nodeIds!.values().next().value as string
      const node = nodes.find((n) => n.id === id)
      if (!node) return null
      const label = (node.data?.label as string | undefined) ?? id
      return { id, label, kind: 'node' }
    }

    const id = edgeIds!.values().next().value as string
    const edge = edges.find((e) => e.id === id)
    if (!edge) return null
    const sourceLabel = nodes.find((n) => n.id === edge.source)?.data?.label ?? edge.source
    const targetLabel = nodes.find((n) => n.id === edge.target)?.data?.label ?? edge.target
    return { id, label: `${sourceLabel} → ${targetLabel}`, kind: 'edge' }
  }, [selection, nodes, edges])
}
