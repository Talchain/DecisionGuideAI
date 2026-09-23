/**
 * The reactive reads of the ONE hold authority (`heldReason`,
 * `utils/analysisHeldOnInjectedModel.ts`) — for every component that states or
 * gates on the hold.
 *
 * ⚠ WHY A HOOK AND NOT A BARE STORE SELECTOR. Half of what `heldReason` reads is
 * NOT canvas-store state: whether an edit is on the wire, whether a sent value
 * or link strength is still unanswered, and whether a delete is still
 * unconfirmed live in module-level registers (`registration/editDeliveryHold.ts`,
 * `conversation/pendingFactorEdit.ts`, `conversation/pendingEdgeEdit.ts`,
 * `conversation/unconfirmedStructuralDelete.ts`).
 * The untyped 500 releases the wire mark and leaves the value pending WITHOUT a
 * store write, so a selector-only surface kept saying "still being saved" about
 * a turn that had settled unconfirmed; recording an unconfirmed delete is not a
 * store write either. The registers subscription below
 * re-renders on those moves; the store selector re-runs on every render and on
 * every store write, so the pair together sees both halves.
 *
 * ⚠ AND THE STORE IS READ ONLY THROUGH ITS SELECTOR, deliberately. Component
 * specs across this tree replace `useCanvasStore` with a bare
 * `(selector) => selector(state)`; reaching for `.subscribe` / `.getState` here
 * would break every one of them for a reason unrelated to what they test.
 */
import { useSyncExternalStore } from 'react'

import { useCanvasStore } from '../store'
import {
  deliveryRegistersVersion,
  subscribeDeliveryRegisters,
} from '../registration/editDeliveryHold'
import {
  heldReason,
  type AnalysisHoldReason,
  type AnalysisHoldReasonState,
} from '../utils/analysisHeldOnInjectedModel'

function useDeliveryRegisters(): void {
  useSyncExternalStore(subscribeDeliveryRegisters, deliveryRegistersVersion, deliveryRegistersVersion)
}

/**
 * The hold and its sentence, or `null` when analysis is not held. The value the
 * run gate takes (`canRunAnalysis({ analysisHeldOn })`). Reference-stable for
 * equal content (`heldReason` interns), so it is safe as a selector result and
 * as a memo dependency.
 */
export function useAnalysisHoldReason(): AnalysisHoldReason | null {
  useDeliveryRegisters()
  return useCanvasStore((s) => heldReason(s as unknown as AnalysisHoldReasonState))
}

/**
 * The hold sentence alone, or `null`. `enabled: false` skips the read (a chip
 * that is not a run affordance never states the hold) while keeping the hook
 * order stable.
 */
export function useAnalysisHeldNotice(enabled = true): string | null {
  useDeliveryRegisters()
  return useCanvasStore((s) =>
    enabled ? heldReason(s as unknown as AnalysisHoldReasonState)?.sentence ?? null : null,
  )
}
