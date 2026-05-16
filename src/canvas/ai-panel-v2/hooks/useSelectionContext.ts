import { useMemo } from 'react'
import { useCanvasStore } from '../../store'
import { borderColourClassFor, nodeKindFromType, type EntityKind } from '../utils/entityColour'

export interface SelectionContext {
  hasSelection: boolean
  label: string | null
  kind: EntityKind
  borderClass: string
}

// Surface the user's current canvas selection in the form the AI panel
// needs: a human label (for the SelectionPill), an entity kind (for the
// border tint), and the resolved Tailwind border class.

export function useSelectionContext(): SelectionContext {
  const selection = useCanvasStore(s => s.selection)
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  return useMemo(() => {
    const nodeIds = selection?.nodeIds
    const edgeIds = selection?.edgeIds

    if (nodeIds && nodeIds.size > 0) {
      const id = nodeIds.values().next().value as string
      const node = nodes.find(n => n.id === id)
      const data = node?.data as { label?: string } | undefined
      const kind = nodeKindFromType(node?.type)
      const label = data?.label?.trim() || `${kind} ${id}`
      return {
        hasSelection: true,
        label,
        kind,
        borderClass: borderColourClassFor(kind),
      }
    }

    if (edgeIds && edgeIds.size > 0) {
      const id = edgeIds.values().next().value as string
      const edge = edges.find(e => e.id === id)
      const data = edge?.data as { label?: string } | undefined
      const label = data?.label?.trim() || 'edge'
      return {
        hasSelection: true,
        label,
        kind: 'edge',
        borderClass: borderColourClassFor('edge'),
      }
    }

    return {
      hasSelection: false,
      label: null,
      kind: 'unknown',
      borderClass: borderColourClassFor('unknown'),
    }
  }, [selection, nodes, edges])
}
