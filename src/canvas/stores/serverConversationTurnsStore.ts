/**
 * ⭐ THE CHAT SURVIVES A RELOAD — the hand-off from the cold read to the chat panel.
 *
 * The cold read (`serverGraphHydration`) resolves AFTER `useConversation`'s mount restore has run, so the read's
 * `conversation_turns` cannot be handed over by call order. The read OFFERS them here, keyed by the scenario they came
 * back for; the panel takes the offer only while it is empty and the browser holds no transcript of its own (a local
 * transcript is the first choice — it is the thread this browser saw, chips and all).
 */
import { create } from 'zustand'
import type { RestoreRunContext, ServerConversationTurn } from '../conversation/serverConversationTurns'

export interface ServerConversationTurnsOffer {
  readonly scenarioId: string
  readonly turns: readonly ServerConversationTurn[]
  readonly run: RestoreRunContext
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
