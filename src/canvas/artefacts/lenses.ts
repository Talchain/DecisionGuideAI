/**
 * ⭐ LENSES ON THE MODEL (Paul, 18 Oct 2026: "Lenses on the model"; DL-3's six answers and the PL's AMEND, 18 Oct).
 *
 * Each thinking tool is a lens that changes the graph itself, switched in one press from the lens bar:
 *   - Model: no lens.
 *   - Trade-offs: what each option gains and gives up, read along the model's own links to the goal
 *     (`tradeOffsModel.ts`); edits open the links' own editors.
 *   - Rests on: every figure the model rests on carries a number and its state (`assumptionMapModel.ts`, the ONE
 *     owner reader); the key card lists the same numbers.
 *   - If it failed: Olumi's pre-mortem stories, with the elements they rest on in front.
 *   - What would change: what the selected Run is most sensitive to, from CEE's analysis only. Before a Run it says
 *     how to get one.
 *   - What if: one different value held on its card and run beside the saved model (`WhatIfKey.tsx`). Nothing is saved.
 * Lenses are view-only: every act goes through the model's own controls, and nothing here writes the model (a what-if
 * runs a copy on CEE and writes nothing).
 */
import { useEffect, useRef } from 'react'
import { selectPremortemWorksheet, useCanvasStore, type LensMode } from '../store'
import type { PremortemWorksheetV1 } from '../../v5/readPremortemWorksheet'

/** The bar's lenses, in the bar's order. `option` isolation is entered from an option card, never the bar. */
export type BarLens = Exclude<LensMode, 'option'>
export const LENS_ORDER: readonly BarLens[] = ['full', 'tradeoffs', 'rests_on', 'premortem', 'what_changes', 'what_if']

/** "What would change" reads a Run, so before one it is shown but cannot be chosen. */
export const lensNeedsRun = (lens: BarLens): boolean => lens === 'what_changes'

/** The lens after `current` on the bar (wrapping), skipping one that cannot show yet. Option isolation counts as Model. */
export function nextBarLens(current: LensMode, hasRun: boolean): BarLens {
  const at = LENS_ORDER.indexOf(current === 'option' ? 'full' : current)
  for (let step = 1; step <= LENS_ORDER.length; step += 1) {
    const lens = LENS_ORDER[(at + step) % LENS_ORDER.length]
    if (hasRun || !lensNeedsRun(lens)) return lens
  }
  return 'full'
}

export const LENS_COPY = {
  bar: 'Lenses on the model',
  label: { full: 'Model', tradeoffs: 'Trade-offs', rests_on: 'Rests on', premortem: 'If it failed', what_changes: 'What would change', what_if: 'What if' },
  hint: {
    full: 'The model as you built it',
    tradeoffs: 'What each option gains and gives up, along the links in your model',
    rests_on: 'Every figure the model rests on, and who it came from',
    premortem: 'Ways each option could fail, imagined by Olumi',
    what_changes: 'What the last Run is most sensitive to',
    what_if: 'Try a different value and see each option beside the saved model. Nothing is saved.',
  },
  needsRun: 'Run the analysis to see what would change it.',
  /** What a segment's count means, said to a screen reader with its label. */
  count: { rests_on: (n: number) => `${n} to check or set`, premortem: (n: number) => (n === 1 ? '1 story' : `${n} stories`) },
} as const

/** The open scenario's pre-mortem worksheet, or null (none, unavailable, or another scenario's). */
export function useCurrentPremortemWorksheet(): PremortemWorksheetV1 | null {
  const read = useCanvasStore(selectPremortemWorksheet)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  return read?.status === 'available' && read.worksheet.scenario_id === scenarioId ? read.worksheet : null
}

/**
 * Restores this browser's worksheet for the same Run (P02), and turns to "If it failed" when a worksheet the user has
 * not seen arrives: the user asked for it. A worksheet already held when the canvas mounts, or restored on reload,
 * counts as seen and never switches the lens by itself.
 */
export function usePremortemArrival(): void {
  const worksheet = useCurrentPremortemWorksheet()
  const hydrate = useCanvasStore((s) => s.hydratePremortemWorksheet)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const graphHash = useCanvasStore((s) => s.lastServerGraphHash)
  const runAt = useCanvasStore((s) =>
    s.analysisStateV1?.run_state.kind === 'complete_current' ? s.analysisStateV1.run_state.computed_at : null)
  const mounted = useRef(false)
  const seen = useRef<string | null>(null)

  // Declared first: a live turn can change the worksheet and the Run in one commit, and it must switch before the
  // restore below would count it as seen.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      seen.current = worksheet?.turn_id ?? null
      return
    }
    if (!worksheet || worksheet.turn_id === seen.current) return
    seen.current = worksheet.turn_id
    useCanvasStore.getState().setLens('premortem')
  }, [worksheet])

  useEffect(() => {
    if (selectPremortemWorksheet(useCanvasStore.getState())?.status === 'available') return
    hydrate()
    const restored = selectPremortemWorksheet(useCanvasStore.getState())
    if (restored?.status === 'available') seen.current = restored.worksheet.turn_id
  }, [hydrate, scenarioId, graphHash, runAt])
}

/**
 * The lens a pressed action is about, turned on at once while Olumi answers in chat. Keyed by CEE's `action_id`
 * (opaque on the wire, `actionBarContract.ts`). The pre-mortem is absent on purpose: its lens turns on when the
 * worksheet arrives (`usePremortemArrival`), because it does not exist until Olumi has written it.
 */
const LENS_FOR_ACTION: Readonly<Record<string, BarLens>> = Object.freeze({
  strengthen: 'rests_on',
  check_estimates: 'rests_on',
  bias_anchoring: 'rests_on',
})

export function showLensForAction(actionId: string): void {
  const lens = LENS_FOR_ACTION[actionId]
  if (lens !== undefined) useCanvasStore.getState().setLens(lens)
}
