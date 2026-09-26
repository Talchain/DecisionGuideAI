import { create } from 'zustand'

/**
 * Whether the floating node/edge inspector is on screen.
 *
 * ⭐ Design audit #14 (served `853feeb7`, 26 Sep 2026): one click on a factor
 * opened the inspector AND a dock row, "Selected: <name> · Ask about this".
 * The inspector already offers "Explore with Olumi" for the same element, so
 * the dock row repeated it. The inspector's open state lives in
 * `ReactFlowGraph` (local `showFullInspector`), a different tree from the dock,
 * so `InspectorModal` reports its own mount here and `SelectionPill` reads it.
 *
 * Display only: nothing here selects, writes or routes.
 */
interface InspectorPresenceState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useInspectorPresenceStore = create<InspectorPresenceState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
