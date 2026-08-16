import { useCanvasStore } from '../../store'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../utils/openEdgeStrengthEditor'

/**
 * Select `nodeId` and raise the full inspector on it.
 *
 * The node twin of `openEdgeStrengthEditor`, and deliberately built the same
 * way: the inspector's visibility is LOCAL React state in `ReactFlowGraph`
 * (`showFullInspector`), reachable from outside only through the
 * `OPEN_FULL_INSPECTOR_EVENT` window event. The event carries no payload — it
 * raises the panel on whatever is CURRENTLY selected — so the selection write
 * must land first, and does.
 *
 * Why this file exists at all: the store field `showInspectorPanel` reads like
 * the way to do this, and eight on-node call sites used it. It has zero render
 * consumers repo-wide (writers in ActionIcons, ConnRow, NodeCoachingMarker,
 * DecisionNode, FactorNode, GoalNode, OptionNode ×2, ConversationPanel,
 * GraphPatchBlockRenderer, InspectorGuidanceSection, usePalette; readers: the
 * debug bundle and a localStorage rehydrate, and nothing else). Every one of
 * those controls was silently dead. Contrast control, same grep, same scope:
 * the adjacent `showResultsPanel` has live subscribers in ReactFlowGraph:397
 * and OutputsDock:580 — so this is a real absence, not a blind probe.
 *
 * Returns `false` when the node is not on the graph — fail-closed and silent,
 * matching `openEdgeStrengthEditor`. A caller must never be able to open an
 * empty inspector by naming a stale id.
 */
export function openNodeInspector(nodeId: string): boolean {
  const state = useCanvasStore.getState()
  if (!state.nodes.some(n => n.id === nodeId)) return false

  // SELECT — `InspectorModal` reads `selectedNodeId` from the store, so the
  // selection decides which node the panel shows. Without history: opening an
  // inspector is not a graph change and must not be undoable.
  // `selectNodeWithoutHistory`, not `onSelectionChange`: the latter is
  // documented as a defensive backstop and writes only the selection set, so
  // the node would not carry React Flow's `selected` ring.
  state.selectNodeWithoutHistory(nodeId)

  // RAISE THE INSPECTOR. Last, so it opens onto a settled selection.
  window.dispatchEvent(new Event(OPEN_FULL_INSPECTOR_EVENT))
  return true
}
