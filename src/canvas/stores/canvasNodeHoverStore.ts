/**
 * canvasNodeHoverStore — which canvas CARD the pointer is over, if any.
 *
 * Written by the ONE place React Flow reports node hover
 * (`ReactFlowGraph`'s `onNodeMouseEnter` / `onNodeMouseLeave`), read by the
 * edges that change emphasis while an endpoint is hovered (`StyledEdge`: an
 * option → factor link returns to full emphasis while its option or its
 * factor is hovered — Canvas lead, 28 Sep 2026).
 *
 * Transient view state only: never persisted, never part of the model. Kept
 * out of `useCanvasStore` so a pointer move does not notify that store's
 * subscribers, and out of React Flow selection, which the user authors.
 */
import { create } from 'zustand'

interface CanvasNodeHoverState {
  /** The hovered card's id, or null. */
  hoveredNodeId: string | null
  setHoveredNodeId: (nodeId: string | null) => void
}

export const useCanvasNodeHoverStore = create<CanvasNodeHoverState>((set) => ({
  hoveredNodeId: null,
  // Same id → same state object, so a repeated enter notifies nobody.
  setHoveredNodeId: (nodeId) => set((s) => (s.hoveredNodeId === nodeId ? s : { hoveredNodeId: nodeId })),
}))
