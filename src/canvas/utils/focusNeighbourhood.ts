/**
 * focusNeighbourhood — F2 (graph-visuals): when the user focuses a node (from a
 * driver row, a chat pill, or Alt+V validation cycling), the camera should fit
 * the node AND its direct neighbours to a readable zoom, rather than centre on
 * it at whatever zoom the user happened to be at. This returns the id set to
 * fit; the caller passes the matching node objects to ReactFlow's fitView with
 * a maxZoom cap so it never disorients.
 */
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
