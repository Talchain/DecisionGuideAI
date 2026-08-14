/**
 * Open the edge-strength editor for one edge, from OUTSIDE the canvas.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * `EdgePanel` — the module that owns `setStrength` — renders only inside
 * `InspectorModal`, which is gated on `showFullInspector`: LOCAL React state in
 * `ReactFlowGraph`, set true by four canvas click handlers
 * (`ReactFlowGraph.tsx:914/922/927/931`) and by nothing else. A surface in the
 * OutputsDock therefore had no way to reach the editor at all: focusing an edge
 * (`focusEdgeById`) only sets `edges[].selected` and centres the camera, so a
 * button that focused and stopped left the user to find and click the edge
 * themselves.
 *
 * ── THE ARBITRATION THIS RESPECTS RATHER THAN FIGHTS ────────────────────────
 * `ReactFlowGraph.tsx:531-535` closes the inspector whenever the dock dispatches
 * `outputs-dock-opened`. That is deliberate competing-surface arbitration — ONE
 * full-width surface at a time, and the dock covers the canvas the inspector
 * expects to sit over.
 *
 * The naive fix is to open the inspector and leave the dock up, because the
 * existing rule is one-way and would not stop us. That would defeat the intent
 * while passing its letter. So this helper does the SYMMETRIC thing instead:
 * it stands the dock down first, then opens the inspector — the same
 * one-surface invariant, applied in the other direction. The event name mirrors
 * the existing one deliberately, so the pair reads as a pair.
 *
 * ── WHY AN EVENT AND NOT A STORE FLAG ───────────────────────────────────────
 * `showFullInspector` is component-local state. Lifting it into the store to
 * make it settable from here would change how four existing canvas handlers
 * work and put a fifth writer on a piece of UI arbitration — a materially
 * bigger change than this slice needs, and one that belongs with whoever owns
 * that surface. A window event is the mechanism the codebase ALREADY uses for
 * exactly this direction of cross-surface signalling, so this adds a second
 * instance of an established pattern rather than a new concept.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
 * It writes NO graph state. Selection and surface visibility only. The strength
 * itself is set by `useEdgeMutations.setStrength` in the panel this opens, which
 * remains the single writer of `weight`/`weightSource`.
 */

import { useCanvasStore } from '../store'
import { focusEdgeById } from './focusHelpers'

/**
 * Dispatched to ask the canvas to raise the full inspector for the CURRENT
 * selection. The twin of `outputs-dock-opened`; `ReactFlowGraph` listens for
 * both and they set the same piece of state in opposite directions.
 */
export const OPEN_FULL_INSPECTOR_EVENT = 'olumi:open-full-inspector'

/**
 * Select `edgeId`, stand the dock down, and raise the inspector on it.
 *
 * Returns `false` when the edge is not on the graph — fail-closed and silent,
 * matching `focusModelTarget`'s contract for a target that no longer exists.
 * A caller must never be able to open an empty inspector by naming a stale id.
 */
export function openEdgeStrengthEditor(edgeId: string): boolean {
  const state = useCanvasStore.getState()
  if (!state.edges.some(e => e.id === edgeId)) return false

  // 1. SELECT — `InspectorModal` reads `selectedEdgeId` from the store, so the
  //    selection is what decides which edge the panel edits. Without history:
  //    opening an editor is not a graph change and must not be undoable.
  state.selectEdgeWithoutHistory(edgeId)

  // 2. STAND THE DOCK DOWN — the other half of the one-surface invariant.
  state.setShowResultsPanel(false)

  // 3. CENTRE IT, so the edge is under the panel the user is about to read.
  focusEdgeById(edgeId)

  // 4. RAISE THE INSPECTOR. Last, so it opens onto a settled selection.
  window.dispatchEvent(new Event(OPEN_FULL_INSPECTOR_EVENT))
  return true
}
