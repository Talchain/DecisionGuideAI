/**
 * Olumi's next step, held beside its card, SURVIVES A RELOAD (olumi-core lane). Live, a turn's note is applied by `applyCoreTurnState`; on a
 * reload the shim derives the same note from the same stored reply (`olumi_note` on the saved-model read) and the page offers it here. It is
 * applied by `ReloadNoteApplier` once its card is on the canvas (a note fails closed on a card that is not there, so applying it at the read,
 * before the cards land, would drop it). A note is shown once per page load: one a person dismissed, or that a live turn already showed, is
 * not brought back by a later read.
 */
import { create } from 'zustand'

export interface ReloadNote { readonly element_id: string; readonly text: string; readonly turn_id: string }
export interface ReloadNoteOffer { readonly scenarioId: string; readonly note: ReloadNote; readonly revision: string | null }

interface State {
  offer: ReloadNoteOffer | null
  set: (offer: ReloadNoteOffer | null) => void
}
export const useReloadNoteStore = create<State>()((set) => ({ offer: null, set: (offer) => set({ offer }) }))

const shown = new Set<string>()
const keyOf = (n: { element_id: string; text: string }): string => `${n.element_id}\u0000${n.text.trim()}`
/** A note the page has shown (a live turn's, or a reload's): not offered again this page load. */
export function markNoteShown(n: { element_id: string; text: string }): void { shown.add(keyOf(n)) }
/** For specs. */
export function resetShownNotes(): void { shown.clear(); useReloadNoteStore.getState().set(null) }

/** The read's `olumi_note`, as an offer; anything not a note (absent, malformed) clears the offer. */
export function offerReloadNote(scenarioId: string, raw: unknown, revision: string | null): void {
  const r = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  const ok = r !== null && typeof r.element_id === 'string' && r.element_id !== '' && typeof r.text === 'string' && r.text.trim() !== '' && typeof r.turn_id === 'string'
  if (!ok || shown.has(keyOf(r as { element_id: string; text: string }))) { useReloadNoteStore.getState().set(null); return }
  useReloadNoteStore.getState().set({ scenarioId, note: { element_id: r.element_id as string, text: r.text as string, turn_id: r.turn_id as string }, revision })
}
