/**
 * A qualitative model on the default canvas (Codex H07, 17:12Z; proposal 005): where core's model holds no option and no figure (only the
 * question and its aims), the purposes, readings and tensions core folded behind the question ARE the picture, so they are opened once on
 * arrival: the same View read the question's notes badge makes when pressed (`?open=`, Badge.tsx toggleBadge), so core unfolds and draws them
 * as cards with its own provenance marks. Nothing is written and nothing is invented; closing them is the person's choice and is kept for the
 * page (opened once per scenario, never re-opened behind their back). A model with any option or figure is left exactly as core folds it.
 */
import { useEffect } from 'react'
import type { View } from '../client'
import { toggleBadge } from '../Badge'
import { QUESTION } from '../layout'

const openedOnce = new Set<string>()
/** Test seam: forget which scenarios were opened. */
export const resetQualitativeNotes = (): void => openedOnce.clear()

/** A model with no option and no figure: the question, its aims and notes only. */
export const isQualitative = (model: { cards: readonly { family: string }[] } | null | undefined): boolean =>
  model != null && !model.cards.some((c) => c.family === 'option' || c.family === 'quantity')
/** A card whose notes are its picture, so core's `premises` are drawn open on it: every card of a qualitative model, and on any model an option the Run has no chance for
 *  (no chance row) where core has placed the notes that concern it on the card. An option with a chance keeps its premises in the Rests on lens, as before. */
export const notesOpenOn = (model: { cards: readonly { family: string }[] } | null | undefined, card: { family: string; rows?: readonly { kind: string }[]; premises?: readonly unknown[] }): boolean =>
  isQualitative(model) || (card.family === 'option' && (card.premises ?? []).length > 0 && !(card.rows ?? []).some((r) => r.kind === 'chance'))
/** True where the model is only a question and its aims, and the question holds folded notes not yet open. */
export function qualitativeNotesToOpen(view: View | null): boolean {
  const m = view?.model
  if (m == null) return false
  const b = m.question.badge
  if (b == null || b.open || b.records.length === 0) return false
  return isQualitative(m)
}

export function useQualitativeNotes(sid: string | null, view: View | null): void {
  const due = sid !== null && qualitativeNotesToOpen(view) && !openedOnce.has(sid)
  useEffect(() => {
    if (!due || sid === null || view?.model?.question.badge == null) return
    openedOnce.add(sid)
    void toggleBadge(QUESTION, view.model.question.badge)
  }, [due, sid, view])
}
