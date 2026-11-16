/** Whether "Compare views" stands over the canvas in the main workspace (member views side by side, then where they differ). Nothing else lives here. */
import { create } from 'zustand'
import { useOverview } from '../../strategy/overview/useOverview'

export const useCompare = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  // One surface over the canvas at a time: opening the comparison closes the Strategy Overview (and the Overview's opener closes this).
  show: () => { useOverview.getState().hide(); set({ open: true }) },
  hide: () => set({ open: false }),
}))
