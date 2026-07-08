// vNext-local selection context.
//
// Selection lives HERE, never in the shared canvas store: the vNext surface
// makes "no graph writes" a structural guarantee (onNodesChange/onEdgesChange
// are not wired, node.selected is never mutated), so selecting a node or
// pinning a relationship card in the preview leaves no residue in the
// default graph.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export interface VNextSelectionState {
  selectedNodeId: string | null
  /** Edge whose Relationship Card is pinned open. */
  pinnedEdgeId: string | null
  selectNode: (id: string | null) => void
  pinEdge: (id: string | null) => void
  clear: () => void
}

const VNextSelectionContext = createContext<VNextSelectionState | null>(null)

export function useVNextSelection(): VNextSelectionState {
  const ctx = useContext(VNextSelectionContext)
  if (!ctx) throw new Error('useVNextSelection must be used within VNextSelectionProvider')
  return ctx
}

export function VNextSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [pinnedEdgeId, setPinnedEdgeId] = useState<string | null>(null)

  const value = useMemo<VNextSelectionState>(
    () => ({
      selectedNodeId,
      pinnedEdgeId,
      selectNode: (id) => {
        setSelectedNodeId(id)
        if (id != null) setPinnedEdgeId(null)
      },
      pinEdge: (id) => {
        setPinnedEdgeId(id)
        if (id != null) setSelectedNodeId(null)
      },
      clear: () => {
        setSelectedNodeId(null)
        setPinnedEdgeId(null)
      },
    }),
    [selectedNodeId, pinnedEdgeId],
  )

  return <VNextSelectionContext.Provider value={value}>{children}</VNextSelectionContext.Provider>
}
