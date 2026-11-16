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
/** A card whose notes are its picture, so core's `premises` are drawn open on it: every card of a qualitative model. On any other model they stay behind the card's
 *  "Rests on N" press and the Rests on lens (R1 priorities 1 and 2, 16 Nov): an option with no chance and an aim nothing is counted against once drew their whole
 *  lists open, three times the height of any other card, so the whole model was never in view. */
export const notesOpenOn = (model: { cards: readonly { family: string }[] } | null | undefined, _card?: { family: string; rows?: readonly { kind: string }[]; premises?: readonly unknown[]; bound?: { measured: boolean } | null }): boolean =>
  isQualitative(model)
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
