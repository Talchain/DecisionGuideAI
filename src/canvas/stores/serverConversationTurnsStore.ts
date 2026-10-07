/**
 * ⭐ THE CHAT SURVIVES A RELOAD — the hand-off from the cold read to the chat panel.
 *
 * The cold read (`serverGraphHydration`) resolves AFTER `useConversation`'s mount restore has run, so the read's
 * `conversation_turns` cannot be handed over by call order. The read OFFERS them here, keyed by the scenario they came
 * back for. The panel keeps local transcript words and reconciles its held controls with the server sidecar;
 * server text restores only into an empty panel with no local history. Saved chips never provide authority.
 */
import { create } from 'zustand'
import type { RestoreRunContext, ServerConversationTurn } from '../conversation/serverConversationTurns'

export interface ServerConversationTurnsOffer {
  readonly scenarioId: string
  readonly turns: readonly ServerConversationTurn[]
  readonly run: RestoreRunContext
  /** Raw opt-in held-offer sidecar; the conversation reader validates it. */
  readonly heldProposalOffers?: unknown
  /** Raw opt-in S-D `proposal_fields` (§15); `proposalFields.ts` validates it. */
  readonly proposalFields?: unknown
}

interface ServerConversationTurnsState {
  offer: ServerConversationTurnsOffer | null
  offerServerConversationTurns: (offer: ServerConversationTurnsOffer) => void
  /** The panel took (or declined) the offer: it is spent, so a later render never re-applies it. */
  takeServerConversationTurns: (scenarioId: string) => void
}

export const useServerConversationTurnsStore = create<ServerConversationTurnsState>((set, get) => ({
  offer: null,
  offerServerConversationTurns: (offer) => set({ offer }),
  takeServerConversationTurns: (scenarioId) => {
    if (get().offer?.scenarioId === scenarioId) set({ offer: null })
  },
}))
