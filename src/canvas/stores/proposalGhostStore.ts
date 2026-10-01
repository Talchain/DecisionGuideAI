/**
 * Suggestion preview: the ghost the canvas draws for the proposal the latest reply offers (proposalPreview.ts).
 *
 * Render-only state, kept OUT of the canvas store on purpose: it never enters `nodes`/`edges`, so nothing can save,
 * send, count, fit or infer over it. Set by the conversation bridge (`useProposalGhostBridge`); read by the canvas
 * overlay. A clear names its proposal id, so a stale clear cannot wipe a newer ghost.
 */
import { create } from 'zustand'
import type { ProposalPreview } from '../conversation/proposalPreview'

interface ProposalGhostState {
  readonly ghost: ProposalPreview | null
  /** Show this proposal's ghost (a no-op when it is already the one shown). */
  showGhost: (preview: ProposalPreview) => void
  /** Clear the ghost, only when it is still the one for `proposalId`. */
  clearGhost: (proposalId: string) => void
}

export const useProposalGhostStore = create<ProposalGhostState>((set, get) => ({
  ghost: null,
  showGhost: (preview) => {
    if (get().ghost === preview) return
    set({ ghost: preview })
  },
  clearGhost: (proposalId) => {
    if (get().ghost?.proposalId === proposalId) set({ ghost: null })
  },
}))
