/**
 * useStructuralDeleteEvents — the ONE sender for durable canvas deletions.
 *
 * The store's four delete actions capture an intent synchronously against the
 * pre-delete graph (see `canvas/mutations/structuralDelete.ts`); this hook
 * drains the queue and puts each gesture on the wire as ONE `structural_delete`
 * turn. It is deliberately the same shape as `usePanelApplyDrain`: a recorder
 * that cannot send, a single drainer that can — rather than five gesture sites
 * each growing their own transport.
 *
 * ⚠ NOT DEBOUNCED, and that is the point. `useGraphEditEvents` coalesces 1.5s of
 * mutations before flushing; `base_graph_hash` asserts the graph the user was
 * looking at WHEN THEY DELETED, so a coalesced flush would send a hash for a
 * graph that had already moved and CEE would refuse a delete the user made
 * correctly. The drain runs on the effect after the gesture's render.
 *
 * ⚠ SERIALISED, one gesture at a time. Two deletes in flight against the same
 * scenario is a guaranteed second refusal: the first commit moves the persisted
 * hash, so the second's base is stale by construction. Draining in order and
 * awaiting each send makes the second gesture's send happen after the first has
 * resolved — and by then `applyV5State` has captured the new `graph_hash`.
 * ⚠ THE QUEUED INTENT'S HASH IS STILL THE ONE IT CAPTURED, so a second gesture
 * made BEFORE the first turn returned genuinely does carry a stale base and is
 * genuinely refused — correctly. The user is told and the elements come back;
 * inventing a fresher hash here would be asserting a base nobody read.
 */

import { useEffect, useRef } from 'react'

import { useCanvasStore } from '../store'
import { isOrchestratorV2Enabled } from '../../flags'
import {
  buildStructuralDeleteWirePayload,
  STRUCTURAL_DELETE_NOTICE,
  type StructuralDeleteIntent,
} from '../mutations/structuralDelete'
import type { WireSystemEvent } from './types'
import {
  settleStructuralDeleteAttempt,
  takeStructuralDeleteAttemptSettled,
} from './unconfirmedStructuralDelete'
import { SEND_DEFERRED } from './useConversation'

/** The dispatcher this hook needs — the real `sendSystemEvent`, or a test double. */
export type StructuralDeleteSender = (
  event: WireSystemEvent,
  opts?: { structuralDelete?: StructuralDeleteIntent; debugSource?: string },
) => Promise<unknown>

export function useStructuralDeleteEvents(sendSystemEvent: StructuralDeleteSender): void {
  const pending = useCanvasStore((s) => s.pendingStructuralDeletes)
  /** True while a drain is running — the serialisation lock. */
  const drainingRef = useRef(false)
  const senderRef = useRef(sendSystemEvent)
  senderRef.current = sendSystemEvent

  useEffect(() => {
    if (pending.length === 0) return
    if (!isOrchestratorV2Enabled()) {
      // The transport is off, so nothing can be sent. Draining anyway is the
      // honest move: leaving intents queued would send them the moment the flag
      // flipped, against hashes captured in a previous session.
      useCanvasStore.getState().takePendingStructuralDeletes()
      return
    }
    if (drainingRef.current) return
    drainingRef.current = true

    // ⚠ NO CLEANUP-BASED CANCELLATION HERE, and it is a correctness point rather
    // than an omission. A gesture made mid-flight changes `pending`, so React
    // would run this effect's cleanup BEFORE the re-run — an `AbortController`
    // or a `cancelled` flag would therefore kill the drain that the new gesture
    // is waiting behind, and the re-run would bail on `drainingRef` and leave
    // the queue stranded. The loop below re-reads the queue instead, so a
    // gesture that arrives during a send is picked up by the SAME drain.
    void (async () => {
      try {
        for (;;) {
          const batch = useCanvasStore.getState().takePendingStructuralDeletes()
          if (batch.length === 0) return
          for (const intent of batch) {
            // Captured BEFORE the send, as `sendTurn` captures its own: the
            // attempt belongs to the decision it was made in, whatever the user
            // has opened by the time the await returns.
            const scenarioIdAtDispatch = useCanvasStore.getState().currentScenarioId ?? null
            // The outcome is resolved inside `sendTurn` against the server
            // receipt — a refusal reverts the canvas and says so there, where
            // the response is in hand. Nothing here may treat a resolved
            // promise as evidence the deletion landed.
            const outcome = await senderRef.current(
              {
                type: 'structural_delete',
                payload: buildStructuralDeleteWirePayload(intent),
              },
              { structuralDelete: intent, debugSource: 'canvas_delete' },
            ).catch((err) => {
              if (import.meta.env.DEV) {
                console.warn('[structuralDelete] send failed:', err)
              }
            })

            // ⭐⭐ THE EVERY-EXIT SETTLE (Panel's #1905 item 1) — the rename
            // twin's rule (`useStructuralRenameEvents`), asked of the delete.
            //
            // `sendTurn` resolves a delete on three arms and misses three exits:
            // its catch resolves only when `!isAbort`, so a user preempt ("send
            // a chat message while the delete is on the wire") or a client
            // timeout resolves nothing; the response arm is fenced on
            // `activeV5TurnIdRef.current === turnClientId`; and the scenario
            // fence returns before either. On each, NOTHING recorded the
            // attempt, so once delivery settled one whole-graph register carried
            // the post-delete canvas and its ack made a deletion CEE may have
            // refused canonical — the abort is client-side, CEE does not cancel.
            //
            // Derived rather than enumerated: my await has returned, so did
            // ANYBODY settle this attempt? If not, it was sent and never heard,
            // and `unconfirmed` is the honest terminal state — recorded, so
            // registration holds while the canvas still shows the deletion.
            //
            // ⚠ IT MUST NOT REVERT, for the rename twin's reason: the cancel was
            // client-side and CEE may well have taken the delete; restoring the
            // node on that guess would be the opposite lie.
            //
            // ⚠ NOT on `SEND_DEFERRED`: the delete is QUEUED behind a turn in
            // flight, not unanswered, and `sendTurn` resolves it against its own
            // receipt when the queue dispatches it. Settling here would record
            // and announce an outcome for a send that has not happened yet.
            if (outcome !== SEND_DEFERRED && !takeStructuralDeleteAttemptSettled(intent.id)) {
              settleStructuralDeleteAttempt(intent, scenarioIdAtDispatch, 'unconfirmed')
              // "Couldn't confirm" — not the transport copy, which says the
              // deletion "didn't reach the server": an aborted request usually
              // did. Deliberately the canvas toast bridge, not `addMessage`:
              // this code outlives the React instance that started the send.
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('topbar:show-toast', {
                  detail: { message: STRUCTURAL_DELETE_NOTICE.unconfirmed_server, level: 'warning' },
                }))
              }
            }
          }
        }
      } finally {
        drainingRef.current = false
      }
    })()
  }, [pending])
}
