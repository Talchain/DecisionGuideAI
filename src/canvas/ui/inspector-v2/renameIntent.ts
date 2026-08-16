/**
 * renameIntent — the inspector's EXPORTED rename entry point (L-04).
 *
 * The inspector owns the rename affordance; the workspace owns the gesture that
 * asks for it. This store is the seam between them, so neither lane has to
 * reach into the other's components.
 *
 * The workspace lane's canvas double-click handler calls `requestNodeRename(id)`
 * (after selecting the node, so the inspector mounts for it). The inspector
 * shell consumes the intent on mount and opens its label in editing state, then
 * CLEARS it — a rename intent is a one-shot event, not a mode. Leaving it set
 * would reopen the editor on every unrelated re-render.
 *
 * Bound by node id, never a global "edit now" flag: two inspectors can be
 * mounted (panel + modal) and only the requested element may enter editing.
 */

import { create } from 'zustand'

interface RenameIntentState {
  /** The node whose label should open in editing state, or null. */
  renameNodeId: string | null
  request: (nodeId: string) => void
  clear: () => void
}

export const useRenameIntentStore = create<RenameIntentState>((set) => ({
  renameNodeId: null,
  request: (nodeId) => set({ renameNodeId: nodeId }),
  clear: () => set({ renameNodeId: null }),
}))

/**
 * Ask the inspector to open `nodeId`'s title in editing state.
 *
 * Caller contract: the node must be (or be about to become) the inspector's
 * current selection — this sets the intent, it does not open the inspector.
 */
export function requestNodeRename(nodeId: string): void {
  useRenameIntentStore.getState().request(nodeId)
}

/** Drop any pending rename intent (consumed by the shell; also used in tests). */
export function clearNodeRename(): void {
  useRenameIntentStore.getState().clear()
}
