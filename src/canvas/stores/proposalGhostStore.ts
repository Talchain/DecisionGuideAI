/**
 * Suggestion preview: the ghost the canvas draws for the proposal the latest reply offers (proposalPreview.ts).
 *
 * Render-only state, kept OUT of the canvas store on purpose: it never enters `nodes`/`edges`, so nothing can save,
 * send, count, fit or infer over it. Set by the conversation bridge (`useProposalGhostBridge`); read by the canvas
 * overlay. A clear names its proposal id, so a stale clear cannot wipe a newer ghost.
 */
import { create } from 'zustand'
import type { ProposalConsentChips, ProposalPreview } from '../conversation/proposalPreview'

interface ProposalGhostState {
  readonly ghost: ProposalPreview | null
  /** The chips that settle it, as the reply offers them: the ghost's own Approve / Not now press exactly these. */
  readonly chips: ProposalConsentChips | null
  /** Show this proposal's ghost (a no-op when it is already the one shown, with the same chips). */
  showGhost: (preview: ProposalPreview, chips?: ProposalConsentChips | null) => void
  /** Clear the ghost, only when it is still the one for `proposalId`. */
  clearGhost: (proposalId: string) => void
}

export const useProposalGhostStore = create<ProposalGhostState>((set, get) => ({
  ghost: null,
  chips: null,
  showGhost: (preview, chips = null) => {
    if (get().ghost === preview && get().chips === chips) return
    set({ ghost: preview, chips })
  },
  clearGhost: (proposalId) => {
    if (get().ghost?.proposalId === proposalId) set({ ghost: null, chips: null })
  },
}))
