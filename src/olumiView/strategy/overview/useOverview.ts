/** Whether the Strategy Overview page is showing in place of the canvas stage. Nothing else lives here. */
import { create } from 'zustand'

export const useOverview = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
