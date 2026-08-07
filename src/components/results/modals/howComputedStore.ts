/**
 * howComputedStore — open/close state for the Model-Card-Lite dialog
 * ("How these numbers are computed", roadmap M4 / P1-9).
 *
 * Mirrors the successMeasureStore / decisionRecordStore pattern so any
 * surface can open the card without prop drilling. Deliberately NOT
 * persisted: the card holds no user data, only a disclosure of this run's
 * method, so there is nothing to survive a reload.
 */
import { create } from 'zustand'

export interface HowComputedState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useHowComputedStore = create<HowComputedState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))

/**
 * Open the Model-Card-Lite from any surface (results header, a number's
 * tooltip, a coach reply). The modal itself must be mounted once — see
 * HowComputedModal, mounted in OutputsDock beside the other results modals.
 */
export function openHowComputed(): void {
  useHowComputedStore.getState().open()
}

export function closeHowComputed(): void {
  useHowComputedStore.getState().close()
}
