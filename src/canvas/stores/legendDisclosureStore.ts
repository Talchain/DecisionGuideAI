/**
 * Legend Disclosure Store
 *
 * Tracks whether the canvas "How to read this" legend popover is open, so the
 * post-analysis EdgeThicknessLegend can yield while it is open — the two
 * bottom-left legends must never overlap. Display-only UI flag; intentionally
 * NOT persisted (transient per session).
 */
import { create } from 'zustand'

interface LegendDisclosureState {
  isLegendOpen: boolean
  setLegendOpen: (open: boolean) => void
  toggleLegend: () => void
}

export const useLegendDisclosure = create<LegendDisclosureState>((set) => ({
  isLegendOpen: false,
  setLegendOpen: (open) => set({ isLegendOpen: open }),
  // Functional toggle — reads the live value at call time, so the trigger is
  // immune to focus-before-click closure staleness on a real mouse click.
  toggleLegend: () => set((s) => ({ isLegendOpen: !s.isLegendOpen })),
}))
