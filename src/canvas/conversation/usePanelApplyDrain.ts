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
 * 1. EXACTLY ONCE. The intent is forgotten BEFORE the send, and a ref guards
 *    against a re-render racing a second drain. A double drain would post two
 *    turns and write two entries into the user's transcript for one click.
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
import {
  forgetPendingApply,
  readPendingApply,
  type PendingPanelApply,
} from '../../collab/panelApplyHandoff'

export interface PanelApplyDrainArgs {
  /** The scenario the canvas is showing. Empty until it resolves. */
  scenarioId: string | undefined
  /**
   * The node's `data` for the intent's target, read for its OWN cap/unit — the
   * builder needs it to decide the scale. `undefined` when the graph has not
   * loaded yet, which DEFERS the drain rather than dropping it.
   */
  lookupNodeData: (targetId: string) => unknown | undefined
  /** The one real turn sender, from the conversation context. */
  sendSystemEvent: ((event: WireSystemEvent) => Promise<unknown>) | undefined
  /** Notified after a successful dispatch, for the canvas confirmation. */
  onApplied?: (intent: PendingPanelApply) => void
}

export function usePanelApplyDrain({
  scenarioId,
  lookupNodeData,
  sendSystemEvent,
  onApplied,
}: PanelApplyDrainArgs): void {
  // Guards the exactly-once property across re-renders and StrictMode's double
  // effect invocation. Keyed by scenario so navigating between models still
  // drains each one's own intent.
  const drainedFor = useRef<string | null>(null)

  useEffect(() => {
    if (scenarioId === undefined || scenarioId === '') return
    if (sendSystemEvent === undefined) return
    if (drainedFor.current === scenarioId) return

    const intent = readPendingApply(scenarioId)
    if (intent === null) return

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
      },
    })

    // Fail CLOSED. The builder refuses a model-scale number outside [0,1] or on
    // a magnitude-scaled factor, for every caller. Forget the intent so a
    // permanently-unencodable one cannot wedge the drain on every visit.
    if (event === null) {
      drainedFor.current = scenarioId
      forgetPendingApply(scenarioId)
      return
    }

    // Order is load-bearing: mark and forget BEFORE sending, so a rejected send
    // cannot be replayed. See `forgetPendingApply`'s header.
    drainedFor.current = scenarioId
    forgetPendingApply(scenarioId)

    void Promise.resolve(sendSystemEvent(event))
      .then(() => {
        onApplied?.(intent)
      })
      .catch(() => {
        // The turn failed in transit. Deliberately silent HERE: CEE's own
        // refusal copy is the honest message and arrives on the turn, and a
        // second client-invented sentence about a server outcome would be the
        // product guessing. The value simply does not change.
      })
  }, [scenarioId, lookupNodeData, sendSystemEvent, onApplied])
}
