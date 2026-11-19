/** Whether the Frame page stands over the canvas, and the scenario it last opened itself for. In memory only: nothing is persisted. */
import { create } from 'zustand'

export const useFrameStage = create<{ open: boolean; armedFor: string | null; show: () => void; hide: () => void; arm: (sid: string) => void }>((set) => ({
  open: false,
  armedFor: null,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  // Opens once per scenario load (the first time a model is there); "Full graph" then keeps it shut until the opener asks.
  arm: (sid) => set({ open: true, armedFor: sid }),
}))
