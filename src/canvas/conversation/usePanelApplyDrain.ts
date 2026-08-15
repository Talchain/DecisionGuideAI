/**
 * Drain a recorded panel-apply intent into the ONE real turn sender.
 *
 * The owner clicked "Use Grace's 0.85" on the panel page, which cannot send a
 * turn (it sits outside the conversation provider — see `panelApplyHandoff.ts`).
 * It recorded the intent and navigated to the model. This hook is the other end:
 * on the canvas, with `sendSystemEvent` in hand, it sends exactly one
 * `factor_value_edit` carrying `applied_from`.
 *
 * ── THE THREE PROPERTIES THAT MAKE THIS SAFE ──────────────────────────────
 * 1. ONE IN FLIGHT; CLEAR ONLY AFTER CONFIRMED ACCEPTANCE. An ephemeral claim
 *    prevents re-render, remount, and React StrictMode from dispatching the same
 *    intent while its promise is unresolved. The pending record is retained for
 *    rejected, deferred, blocked, and no-op outcomes, so a later readiness or
 *    revision change can retry without reconstructing the owner's action.
 * 2. IT ASSERTS NOTHING IT DID NOT VERIFY. The hook attaches `applied_from` as
 *    a CLAIM. CEE checks it against its own collab store and refuses the whole
 *    edit on any mismatch, so the worst a stale or wrong intent achieves is a
 *    refusal — never a false attribution on somebody's model.
 * 3. IT USES THE SHARED BUILDER. `buildFactorValueEditEvent` owns the scale
 *    rule and the structural refusals; re-deriving the payload here would be a
 *    second scale authority, which is the defect that module exists to prevent.
 */

import { useEffect, useRef } from 'react'

import { buildFactorValueEditEvent } from './factorValueEdit'
import type { WireSystemEvent } from './types'
import type { SendTurnOutcome } from './useConversation'
import {
  forgetPendingApply,
  readPendingApply,
  type PendingPanelApply,
} from '../../collab/panelApplyHandoff'

export interface PanelApplyDrainArgs {
  /** The scenario the canvas is showing. Empty until it resolves. */
  scenarioId: string | undefined
  /**
   * True only after the graph in the store belongs to `scenarioId`.
   *
   * Route navigation can mount the canvas while the previous scenario's graph
   * is still in the store. Reading that graph would make a same-id factor look
   * ready and send the new scenario's pending apply against stale node data.
   */
  graphReady: boolean
  /**
   * Changes whenever graph hydration/replacement changes the available nodes.
   *
   * `lookupNodeData` is deliberately stable, so a first pass that defers while
   * the target is absent needs this explicit dependency to run again after a
   * delayed server hydration supplies it.
   */
  graphRevision: unknown
  /**
   * The node's `data` for the intent's target, read for its OWN cap/unit — the
   * builder needs it to decide the scale. `undefined` when the graph has not
   * loaded yet, which DEFERS the drain rather than dropping it.
   */
  lookupNodeData: (targetId: string) => unknown | undefined
  /** The one real turn sender, from the conversation context. */
  sendSystemEvent: ((
    event: WireSystemEvent,
    opts: { deferIfBusy: false },
  ) => Promise<SendTurnOutcome>) | undefined
  /** Notified after a successful dispatch, for the canvas confirmation. */
  onApplied?: (intent: PendingPanelApply) => void
}

/**
 * Process-local transport claims only. The pending localStorage record remains
 * the sole retry authority; this set carries no payload and is deleted on every
 * settlement. Keeping the claim outside a component is what closes the brief
 * unmount/remount window created by React StrictMode.
 */
const inFlightIntentKeys = new Set<string>()

/**
 * Stable identity for one recorded action. Every claimed field participates:
 * a newer click that cites different evidence is a different action even when
 * the two records share one millisecond timestamp. The explicit -0 spelling
 * preserves the same Object.is-sensitive number semantics as the server
 * binding, and `null` makes citation absence explicit inside the array.
 */
function intentKey(intent: PendingPanelApply): string {
  const value = Object.is(intent.value, -0) ? '-0' : String(intent.value)
  return JSON.stringify([
    intent.scenario_id,
    intent.round_id,
    intent.participant_id,
    intent.target_id,
    value,
    intent.evidence_event_id ?? null,
    intent.recorded_at,
  ])
}

export function usePanelApplyDrain({
  scenarioId,
  graphReady,
  graphRevision,
  lookupNodeData,
  sendSystemEvent,
  onApplied,
}: PanelApplyDrainArgs): void {
  // Successful action identity, retained when localStorage removal itself is
  // unavailable so a fulfilled send cannot replay during this mount.
  const drainedFor = useRef<string | null>(null)
  useEffect(() => {
    if (scenarioId === undefined || scenarioId === '') return
    if (!graphReady) return
    if (sendSystemEvent === undefined) return
    const intent = readPendingApply(scenarioId)
    if (intent === null) return
    const key = intentKey(intent)
    if (drainedFor.current === key) return
    if (inFlightIntentKeys.has(key)) return

    // DEFER, do not drop: the graph may still be loading. Returning without
    // stamping `drainedFor` leaves the intent in place for the next render,
    // and the handoff's own staleness bound stops it waiting forever.
    const nodeData = lookupNodeData(intent.target_id)
    if (nodeData === undefined) return

    const event = buildFactorValueEditEvent({
      nodeId: intent.target_id,
      typedValue: intent.value,
      nodeData,
      appliedFrom: {
        round_id: intent.round_id,
        participant_id: intent.participant_id,
        // 0.41.0 — carried only when the recorded intent had one, so an
        // uncited drain builds the same event it built before.
        ...(intent.evidence_event_id !== undefined
          ? { evidence_event_id: intent.evidence_event_id }
          : {}),
      },
    })

    // Fail CLOSED. Keep the exact pending action: a later graph revision may
    // provide node scale metadata that makes the shared builder able to encode
    // it, and staleness bounds an action that remains permanently invalid.
    if (event === null) return

    // Mark in-flight BEFORE invoking the sender. Wrapping the invocation also
    // turns a synchronous throw into the same rejected-promise retry posture.
    inFlightIntentKeys.add(key)
    void Promise.resolve()
      // This caller already owns the durable pending record. Opting out of the
      // singleton sender's hidden queue means SEND_BLOCKED is returned while a
      // turn is busy, so there can never be a queued copy plus a later retry.
      .then(() => sendSystemEvent(event, { deferIfBusy: false }))
      .then((outcome) => {
        // The real sender contract names undefined as the sole accepted send.
        // SEND_DEFERRED, SEND_BLOCKED, and any defensive unknown/no-op result
        // retain the exact pending action and simply release its transport
        // claim for a later dependency-driven retry.
        if (outcome !== undefined) {
          inFlightIntentKeys.delete(key)
          return
        }

        // Confirmed acceptance is the first point at which replay suppression
        // and removal are truthful. Clear only if storage still contains THIS
        // action; a newer click must never be deleted by an older completion.
        drainedFor.current = key
        const pendingNow = readPendingApply(scenarioId)
        if (pendingNow !== null && intentKey(pendingNow) === key) {
          forgetPendingApply(scenarioId)
        }
        inFlightIntentKeys.delete(key)
        onApplied?.(intent)
      })
      .catch(() => {
        // Transport rejection proves no successful dispatch. Retain the exact
        // pending action and release only the in-flight guard; a later graph or
        // sender revision may retry through this same effect. No second client
        // sentence guesses at a server outcome.
        inFlightIntentKeys.delete(key)
      })
  }, [scenarioId, graphReady, graphRevision, lookupNodeData, sendSystemEvent, onApplied])
}
