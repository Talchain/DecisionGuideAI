/**
 * Where core's `run.finding` is drawn: ONE function (S4, 19 Nov: "nothing is said twice"). The Olumi panel, the Frame page and the question card each
 * ask it and draw the finding only when it names them, so exactly one of them, on screen, says it. It reads typed state only: the View, whether the dock
 * fronts the Olumi tab, whether the Frame page stands over the canvas. No CSS, no attribute, no words.
 *  - 'panel': the Olumi tab is on screen, some option has a calculated result (without one the finding is a status the reply and the aim card already say),
 *    and the newest answered reply draws no lead. Where it draws one, that lead is the same fact in the panel's own place: NO surface draws the finding
 *    (S4 22:4xZ, url3c visual: the question card repeated it beside the lead).
 *  - 'frame': otherwise, while the Frame page stands over the canvas.
 *  - 'question': otherwise, on the question card.
 *  - null: core sends no finding.
 */
import { create } from 'zustand'
import { newestLeadDrawn } from './early'
import { useViewStore } from './store'
import { findingOf, hasAnyResult } from './v12/contract'
import { useFrameShown } from './v12/frame/useFrameStage'
import type { View } from './client'

export type FindingSurface = 'panel' | 'frame' | 'question'

/** Whether the dock is open on its Olumi tab with no overlay panel over it. Published by the dock, the only place that knows. */
export const useDockFrontsOlumi = create<{ fronted: boolean; set: (fronted: boolean) => void }>((set) => ({ fronted: false, set: (fronted) => set({ fronted }) }))

export const findingSurfaceOf = (view: Pick<View, 'model' | 'chat' | 'draft' | 'turn'> | null, ui: { olumiFronted: boolean; frameShown: boolean }): FindingSurface | null => {
  if (findingOf(view?.model) === null) return null
  // While the Olumi tab is on screen and an option has a result, the panel owns this fact: it draws the finding, or nothing where its newest lead already says it.
  if (ui.olumiFronted && hasAnyResult(view?.model)) return newestLeadDrawn(view) === null ? 'panel' : null
  return ui.frameShown ? 'frame' : 'question'
}

export const useFindingSurface = (): FindingSurface | null => {
  const view = useViewStore((s) => s.view)
  const olumiFronted = useDockFrontsOlumi((s) => s.fronted)
  const frameShown = useFrameShown()
  return findingSurfaceOf(view, { olumiFronted, frameShown })
}
