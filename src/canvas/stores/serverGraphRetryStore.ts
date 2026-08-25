/**
 * Server-Graph-Retry Store — what the boot re-ask may tell the user.
 *
 * `useServerGraphHydration` is fire-and-forget: its outcome goes to
 * `logger.debug` and NOTHING about it is observable by React. That is correct
 * for the outcomes that need no surface, and it is why the returning-guest
 * defect was invisible in the product — the canvas simply sat empty. A bounded
 * re-ask needs somewhere to say "still looking" and "that did not work", so this
 * is that somewhere, and it holds nothing else.
 *
 * ── WHY A STORE RATHER THAN A PROP ─────────────────────────────────────────
 * Same reason as `contextIntegrityStore`: the read happens in a boot hook at the
 * route, the surface renders inside the canvas area, and zustand is the house
 * pattern for that gap (see also `guidanceStore`, `layoutProgressStore`).
 *
 * ── ⚠ THE STAGE IS KEYED BY SCENARIO, AND THAT IS LOAD-BEARING ─────────────
 * `contextIntegrityStore`'s header records a P0 caused by exactly the omission
 * this avoids: an unkeyed value survived a scenario change and rendered A
 * PREVIOUS DECISION'S content. An unkeyed clear must be remembered at every
 * transition (trap 12, the hand-maintained mirror); content that carries its own
 * identity fails safe at the point of use instead. So `ServerGraphRetryNotice`
 * refuses to render unless this id matches the live `currentScenarioId`, and a
 * stale stage cannot reach the screen even if nothing clears it.
 *
 * ── ⚠ WHAT THIS STORE MAY NEVER BE USED TO SAY ─────────────────────────────
 * Nothing about WHERE the user's work lives. "Saved locally", "only in this
 * browser" and "sign in to save your work" are all FALSE for a guest — a guest's
 * graph also exists server-side, and `ScenarioListPage.tsx:369-380` records the
 * derivation. The copy this store drives is confined to what the CLIENT
 * observed: it asked, and it did or did not get a model back.
 */
import { create } from 'zustand'

import type { AbsentGraphRetryStage } from '../hydrate/absentGraphRetry'

/** `idle` = nothing to say. The initial value, and the value after any clear. */
export type ServerGraphRetryStageValue = 'idle' | AbsentGraphRetryStage

export interface ServerGraphRetryState {
  /**
   * The scenario this stage describes. `null` when idle.
   *
   * ⚠ HAS A READER AND MUST KEEP ONE. `ServerGraphRetryNotice` gates its entire
   * render on this matching the live scenario; if a future change drops that
   * comparison, a previous decision's "could not load" strip can appear over a
   * healthy canvas. The pinning spec is `ServerGraphRetryNotice.spec.tsx` →
   * "never renders for another decision".
   */
  scenarioId: string | null
  stage: ServerGraphRetryStageValue
  /**
   * `scenarioId` is REQUIRED, deliberately — a stage this store cannot attribute
   * to a decision is a stage the surface must never show, and making the caller
   * state it means a new writer cannot omit it by accident.
   */
  setRetryStage: (input: {
    scenarioId: string
    stage: AbsentGraphRetryStage
  }) => void
  clear: () => void
}

const EMPTY = { scenarioId: null, stage: 'idle' } as const

export const useServerGraphRetryStore = create<ServerGraphRetryState>((set) => ({
  ...EMPTY,
  setRetryStage: ({ scenarioId, stage }) => set({ scenarioId, stage }),
  clear: () => set({ ...EMPTY }),
}))
