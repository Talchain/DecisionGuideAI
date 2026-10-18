/**
 * Which reasoning artefact is open beside the model (28 Sep study §3.1: one artefact at a time, opened by the user's
 * press or by the arrival of the artefact they asked for). Holds no artefact content: each artefact reads its own owner.
 */
import { create } from 'zustand'

export type ArtefactId = 'premortem'

interface ArtefactState {
  readonly open: ArtefactId | null
  show: (id: ArtefactId) => void
  close: () => void
}

export const useArtefactStore = create<ArtefactState>((set) => ({
  open: null,
  show: (id) => set({ open: id }),
  close: () => set({ open: null }),
}))
