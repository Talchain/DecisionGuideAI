/**
 * Which reasoning artefact is open beside the model (28 Sep study §3.1: one artefact at a time, opened by the user's
 * press or by the arrival of the artefact they asked for). Holds no artefact content: each artefact reads its own owner.
 */
import { create } from 'zustand'

export type ArtefactId = 'assumptions' | 'premortem'

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

/**
 * The artefact a pressed action is about, opened at once beside the model while Olumi answers in chat. Keyed by CEE's
 * `action_id` (opaque on the wire, `actionBarContract.ts`). The pre-mortem is absent on purpose: its worksheet opens
 * itself when it arrives (`ArtefactColumn`), because it does not exist until Olumi has written it.
 */
const ARTEFACT_FOR_ACTION: Readonly<Record<string, ArtefactId>> = Object.freeze({
  strengthen: 'assumptions',
  check_estimates: 'assumptions',
  bias_anchoring: 'assumptions',
})

export function showArtefactForAction(actionId: string): void {
  const id = ARTEFACT_FOR_ACTION[actionId]
  if (id !== undefined) useArtefactStore.getState().show(id)
}
