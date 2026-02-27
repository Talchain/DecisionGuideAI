/**
 * highlightHelpers — singleton highlight dispatch for results panel → canvas.
 *
 * Cross-boundary dependency: Results panel components call these helpers
 * to highlight nodes/edges on the canvas via useCanvasStore singleton.
 * This avoids passing canvas store hooks through the results component tree.
 */

import { useCanvasStore } from '../store'

/** Highlight a single node on the canvas. */
export function highlightNode(nodeId: string): void {
  useCanvasStore.getState().setHighlightedNodes([nodeId])
}

/** Highlight a single edge on the canvas. */
export function highlightEdge(edgeId: string): void {
  useCanvasStore.getState().setHighlightedEdges([edgeId])
}

/** Clear all node and edge highlights. */
export function clearHighlight(): void {
  useCanvasStore.getState().setHighlightedNodes([])
  useCanvasStore.getState().setHighlightedEdges([])
}
