/**
 * Open/closed state for the version-history panel.
 * British English: visualisation, colour, initialise.
 *
 * ── WHY THIS EXISTS (R4, 16 Aug 2026) ────────────────────────────────────────
 * The versions trigger used to be a FLOATING, absolutely-positioned pill that
 * `VersionsPanelHost` rendered beside its own panel, so host-local `useState`
 * was enough. Paul's R4 ruling retires that pill: the trigger now lives in the
 * app's top header bar (`components/layout/TopBar.tsx`), and the cockpit lane
 * mounts a second one in the analysis panel header. Trigger and panel are
 * therefore in different subtrees, and neither is an ancestor of the other.
 *
 * A store — not props, and not a window event:
 *   - props would mean threading a callback through the canvas route into two
 *     unrelated components, which is exactly the coupling the host was written
 *     to avoid;
 *   - a window event has no readable state, so a second trigger could not
 *     render its own pressed/expanded state honestly.
 *
 * ⚠ DELIBERATELY ITS OWN STORE, NOT `uiStore`. `uiStore.activeOverlaySurface`
 * is a ONE-SLOT exclusive register for transient, anchored surfaces (menus,
 * coach-marks); raising one lowers any other. Version history is a persistent
 * right-side panel the user may keep open while they work, so folding it into
 * that slot would make opening the kebab menu silently CLOSE it — the
 * "a raise is a lower in disguise" hazard uiStore's own header warns about.
 * Two different questions, two different concepts, named apart (trap 21).
 */

import { create } from 'zustand'

export interface VersionsPanelState {
  /** Is the version-history panel on screen? */
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useVersionsPanelStore = create<VersionsPanelState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}))

/**
 * Imperative open, for callers outside React (and for the one-line mount
 * instruction other lanes are given). Reads the store directly rather than
 * closing over a hook, so it is safe from an event handler or an effect.
 */
export function openVersionsPanel(): void {
  useVersionsPanelStore.getState().open()
}
