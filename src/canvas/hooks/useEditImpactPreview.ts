/**
 * useEditImpactPreview — Qualitative directional indicators during parameter edits.
 *
 * Graph Editing Experience Task 5: When a user adjusts edge strength or factor baseline,
 * BFS downstream through the graph to show directional impact on connected nodes.
 *
 * Spec:
 * - Trigger: fires on slider `input` events, debounced 150ms
 * - Clear: annotations clear immediately on blur/release (no debounce on clear)
 * - Performance: BFS must complete in <5ms on a 12-node graph
 *
 * Usage in inspector/popover:
 *   const { previewEdit, clearPreview } = useEditImpactPreview()
 *   <input onInput={() => previewEdit(edgeId, newVal - origVal)}
 *          onBlur={() => clearPreview()} />
 */

import { useCallback, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useEditPreviewStore, type ImpactDirection } from '../stores/editPreviewStore'

/**
 * Compute qualitative downstream impact from a changed element.
 * Returns a map of nodeId → direction based on sign propagation through negative edges.
 */
function computeDownstreamImpact(
  elementId: string,
  delta: number,
  nodes: Array<{ id: string }>,
  edges: Array<{ id: string; source: string; target: string; data?: Record<string, unknown> }>,
): Map<string, ImpactDirection> {
  const startTime = performance.now()
  const result = new Map<string, ImpactDirection>()

  // Build adjacency: source → [{ target, isNegative }]
  const adj = new Map<string, Array<{ target: string; isNegative: boolean }>>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of edges) {
    const direction = e.data?.direction as string | undefined
    const isNegative = direction === 'negative'
    adj.get(e.source)?.push({ target: e.target, isNegative })
  }

  // Find start nodes: if elementId is an edge, start from its target; if a node, start from the node
  const startEdge = edges.find(e => e.id === elementId)
  const startNodes: Array<{ id: string; sign: number }> = []
  if (startEdge) {
    const edgeIsNegative = (startEdge.data?.direction as string) === 'negative'
    startNodes.push({ id: startEdge.target, sign: delta > 0 ? (edgeIsNegative ? -1 : 1) : (edgeIsNegative ? 1 : -1) })
  } else {
    // Node edit: propagate from the node itself
    startNodes.push(...(adj.get(elementId) ?? []).map(n => ({
      id: n.target,
      sign: delta > 0 ? (n.isNegative ? -1 : 1) : (n.isNegative ? 1 : -1),
    })))
  }

  // BFS with sign tracking
  const visited = new Map<string, number>() // nodeId → net sign
  const queue = [...startNodes]

  while (queue.length > 0) {
    const { id, sign } = queue.shift()!
    if (performance.now() - startTime > 5) break // Performance gate

    const existing = visited.get(id)
    if (existing !== undefined) {
      if (existing !== sign) visited.set(id, 0) // mixed
      continue
    }
    visited.set(id, sign)

    for (const neighbour of adj.get(id) ?? []) {
      const nextSign = neighbour.isNegative ? -sign : sign
      queue.push({ id: neighbour.target, sign: nextSign })
    }
  }

  for (const [nodeId, sign] of visited) {
    if (sign > 0) result.set(nodeId, 'increase')
    else if (sign < 0) result.set(nodeId, 'decrease')
    else result.set(nodeId, 'mixed')
  }

  return result
}

/**
 * Hook providing debounced edit impact preview functions.
 * Call `previewEdit(elementId, delta)` on slider input (debounced 150ms).
 * Call `clearPreview()` on blur/release (immediate).
 */
export function useEditImpactPreview() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const previewEdit = useCallback((elementId: string, delta: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (delta === 0) {
      useEditPreviewStore.getState().clearImpact()
      return
    }
    debounceRef.current = setTimeout(() => {
      const { nodes, edges } = useCanvasStore.getState()
      const impact = computeDownstreamImpact(
        elementId,
        delta,
        nodes.map(n => ({ id: n.id })),
        edges.map(e => ({ id: e.id, source: e.source, target: e.target, data: e.data as Record<string, unknown> | undefined })),
      )
      useEditPreviewStore.getState().setImpact(impact)
    }, 150)
  }, [])

  const clearPreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    useEditPreviewStore.getState().clearImpact()
  }, [])

  return { previewEdit, clearPreview }
}
