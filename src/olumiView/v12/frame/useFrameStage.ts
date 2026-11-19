/** Whether the Frame page stands over the canvas, and the scenario it last opened itself for. In memory only: nothing is persisted. */
import { create } from 'zustand'
import { useViewStore } from '../../store'
import { useOverview } from '../../strategy/overview/useOverview'
import { useCompare } from '../views/useCompare'

export const useFrameStage = create<{ open: boolean; armedFor: string | null; show: () => void; hide: () => void; arm: (sid: string) => void }>((set) => ({
  open: false,
  armedFor: null,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  // Opens once per scenario load (the first time a model is there); "Full graph" then keeps it shut until the opener asks.
  arm: (sid) => set({ open: true, armedFor: sid }),
}))

/** Whether the Frame page is on screen: asked to open, a model to show, and neither the overview nor the comparison over it. */
export const useFrameShown = (): boolean => {
  const open = useFrameStage((s) => s.open)
  const hasModel = useViewStore((s) => s.view?.model != null)
  const overview = useOverview((s) => s.open)
  const compare = useCompare((s) => s.open)
  return open && hasModel && !overview && !compare
}
