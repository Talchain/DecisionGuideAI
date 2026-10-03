/**
 * focusNeighbourhood — F2 (graph-visuals): when the user focuses a node (from a
 * driver row, a chat pill, or Alt+V validation cycling), the camera should fit
 * the node AND its direct neighbours to a readable zoom, rather than centre on
 * it at whatever zoom the user happened to be at. This returns the id set to
 * fit; the caller passes the matching node objects to ReactFlow's fitView with
 * a maxZoom cap so it never disorients.
 */

import {
  nodesComfortablyVisible,
  type FocusCamera,
  type SizedNodeLike,
} from './cameraComfort'
export function neighbourhoodNodeIds(
  nodeId: string,
  edges: ReadonlyArray<{ source: string; target: string }>,
): Set<string> {
  const ids = new Set<string>([nodeId])
  for (const e of edges) {
    if (e.source === nodeId) ids.add(e.target)
    if (e.target === nodeId) ids.add(e.source)
  }
  return ids
}

/**
 * computeFocusPlan — the single focus decision (F2 camera + F3 dim), pure so
 * the contract is pinned in unit tests; ReactFlowGraph's handleFocusNode
 * only applies the plan (select → dim → conditionally fit).
 *
 * - focusNodeIds: the target and its direct neighbours (the F2 fit set).
 * - dimNodeIds: every node OUTSIDE the neighbourhood (the F3 transient dim,
 *   written through the store field BaseNode's dim classes already consume).
 * - moveCamera: false only when the whole neighbourhood is already
 *   comfortably visible (cameraComfort's pinned no-churn rule); an
 *   unmeasurable camera fails open to fitting.
 *
 * Returns null when the node is not on the canvas (fail-closed, same rule
 * as focusExistingTarget).
 */
export function computeFocusPlan(
  nodeId: string,
  nodes: ReadonlyArray<SizedNodeLike & { id: string }>,
  edges: ReadonlyArray<{ source: string; target: string }>,
  camera: FocusCamera | null,
): FocusPlan | null {
  if (!nodes.some((n) => n.id === nodeId)) return null
  const focusNodeIds = neighbourhoodNodeIds(nodeId, edges)
  const dimNodeIds: string[] = []
  const focusNodes: Array<SizedNodeLike & { id: string }> = []
  for (const node of nodes) {
    if (focusNodeIds.has(node.id)) focusNodes.push(node)
    else dimNodeIds.push(node.id)
  }
  const moveCamera =
    camera === null ||
    !nodesComfortablyVisible(
      focusNodes,
      camera.viewport,
      camera.paneWidth,
      camera.paneHeight,
      camera.insets,
    )
  return { focusNodeIds, dimNodeIds, moveCamera }
}

/**
 * EDGE focus, under the SAME no-churn rule as a node's (DL #85 5939855664: "no camera jumps when the element is already
 * in view"). It used to re-centre on the link's midpoint on every focus, so a click on a "What changed" link row that
 * was already on screen still slid the canvas. Now the camera moves ONLY when the link's two ends are not both
 * comfortably visible (`nodesComfortablyVisible`, the node plan's gate); an unmeasurable camera fails open and moves.
 * `null` = the edge or one of its ends is not on the canvas (fail-closed: nothing happens).
 */
export function computeEdgeFocusPlan(
  edgeId: string,
  nodes: ReadonlyArray<SizedNodeLike & { id: string }>,
  edges: ReadonlyArray<{ id: string; source: string; target: string }>,
  camera: FocusCamera | null,
): EdgeFocusPlan | null {
  const edge = edges.find((e) => e.id === edgeId)
  if (!edge) return null
  const source = nodes.find((n) => n.id === edge.source)
  const target = nodes.find((n) => n.id === edge.target)
  if (!source || !target) return null
  const moveCamera =
    camera === null ||
    !nodesComfortablyVisible([source, target], camera.viewport, camera.paneWidth, camera.paneHeight, camera.insets)
  return {
    midX: (source.position.x + target.position.x) / 2,
    midY: (source.position.y + target.position.y) / 2,
    moveCamera,
  }
}

export interface EdgeFocusPlan {
  midX: number
  midY: number
  moveCamera: boolean
}

export interface FocusPlan {
  focusNodeIds: Set<string>
  dimNodeIds: string[]
  moveCamera: boolean
}
