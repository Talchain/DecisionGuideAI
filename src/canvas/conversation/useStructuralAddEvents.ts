/**
 * useStructuralAddEvents — the ONE sender for durable canvas node adds.
 *
 * `store.addNode` captures an intent synchronously against the POST-add graph
 * (see `canvas/mutations/structuralAdd.ts`); this hook drains the queue and puts
 * each gesture on the wire as ONE `structural_add` turn. Deliberately the same
 * shape as `useStructuralRenameEvents` and `useStructuralDeleteEvents`: a
 * recorder that cannot send, a single drainer that can — rather than four add
 * sites each growing their own transport.
 *
 * ⚠ NOT DEBOUNCED. `useGraphEditEvents` coalesces 1.5 s of mutations before
 * flushing; this event's `base_graph_hash` is an assertion about the graph the
 * user was looking at when they added, and a coalesced flush would read a hash
 * their own later edit had already moved. The capture is synchronous inside the
 * store action; the drain runs on the effect after the gesture's render.
 *
 * ⚠ SERIALISED, one gesture at a time, same as its two siblings. Two adds in
 * flight against one scenario is a guaranteed second refusal: the first commit
 * moves the persisted hash (an add ALWAYS moves it — a new id changes the
 * projected `nodes` array), so the second's `base_graph_hash` is stale by
 * construction. Draining in order and awaiting each send means the second
 * gesture's send happens after the first has resolved — and by then
 * `applyV5State` has captured the new `graph_hash`.
 */

import { useEffect, useRef } from 'react'

import { useCanvasStore } from '../store'
import { isOrchestratorV2Enabled } from '../../flags'
import {
  buildStructuralAddWirePayload,
  resolveStructuralAddBase,
  STRUCTURAL_ADD_UNCONFIRMED_TOAST,
  type StructuralAddIntent,
} from '../mutations/structuralAdd'
import type { WireSystemEvent } from './types'

/** The dispatcher this hook needs — the real `sendSystemEvent`, or a test double. */
export type StructuralAddSender = (
  event: WireSystemEvent,
  opts?: { structuralAdd?: StructuralAddIntent; debugSource?: string },
) => Promise<unknown>

export function useStructuralAddEvents(sendSystemEvent: StructuralAddSender): void {
  const pending = useCanvasStore((s) => s.pendingStructuralAdds)
  /**
   * ⭐⭐ SUBSCRIBED DELIBERATELY, AND IT IS HALF THE CAPABILITY. A node added on
   * a restored graph is queued with a NULL base hash, because none exists yet —
   * neither hydration nor the UI can supply one (see `structuralAdd.ts`). The
   * only real `base_graph_hash` arrives on a turn response, where `applyV5State`
   * stamps it here. Keying the effect on `pending` ALONE would leave that intent
   * sitting in the queue with nothing left to wake it: the gesture is long over,
   * so `pending` never changes again and the node is never written. Subscribing
   * to the hash is what closes `restored graph -> first added node -> canonical
   * writer`.
   */
  const baseGraphHash = useCanvasStore((s) => s.lastServerGraphHash)
  /** True while a drain is running — the serialisation lock. */
  const drainingRef = useRef(false)
  const senderRef = useRef(sendSystemEvent)
  senderRef.current = sendSystemEvent

  useEffect(() => {
    if (pending.length === 0) return
    if (!isOrchestratorV2Enabled()) {
      // The transport is off, so nothing can be sent. Draining anyway is the
      // honest move: leaving intents queued would send them the moment the flag
      // flipped, asserting ids and hashes read in a previous session.
      useCanvasStore.getState().takePendingStructuralAdds()
      return
    }
    // ⚠⚠ HOLD, DO NOT DISCARD. With no base hash yet there is nothing to stamp
    // onto a deferred intent, and dropping it here would reproduce the P0 one
    // layer down — the node on the canvas, nothing on the wire. The queue
    // survives; the next turn's `graph_hash` re-runs this effect through the
    // `baseGraphHash` subscription above and the add goes out then.
    //
    // ⭐ WHY A SINGLE TOP-LEVEL GATE IS SUFFICIENT rather than a per-intent
    // partition — derived from the field's transitions, not assumed:
    // `setLastServerGraphHash` REFUSES to clear (it early-returns on a
    // non-string or empty value), and the only writer of null is
    // `DECISION_CONTEXT_CLEAR`, which empties `pendingStructuralAdds` in the
    // SAME set. So while the queue is non-empty the hash is monotonic
    // null → string, and a mixed queue is unreachable.
    if (typeof baseGraphHash !== 'string' || baseGraphHash.length === 0) return
    if (drainingRef.current) return
    drainingRef.current = true

    // ⚠ NO CLEANUP-BASED CANCELLATION — the same correctness point the rename
    // and delete drains record. A gesture made mid-flight changes `pending`, so
    // React would run this effect's cleanup BEFORE the re-run; an
    // `AbortController` would therefore kill the drain the new gesture is
    // waiting behind, and the re-run would bail on `drainingRef` and strand the
    // queue. The loop re-reads the queue instead, so a gesture arriving during a
    // send is picked up by the SAME drain.
    void (async () => {
      try {
        for (;;) {
          // ⭐ ONE AT A TIME, AND ATOMICALLY. Taking the WHOLE batch and then
          // awaiting each send leaves every gesture after the first in NEITHER
          // the queue nor any record, so an abort or a remount in that window
          // destroys the only evidence the attempt existed. This moves exactly
          // one intent from the queue into the store-held lifecycle as
          // `in_flight`, in one `set()`.
          const record = useCanvasStore.getState().beginStructuralAddSend()
          if (record === null) return
          const intent = record.intent

          // Stamp the base hash for a DEFERRED intent; an intent captured with
          // its own hash keeps it. `null` here means the hash vanished between
          // the gate above and now, which the transitions make unreachable —
          // but the type makes it expressible, so it is refused rather than sent
          // with a hole where the assertion belongs.
          //
          // ⚠ AND THE REFUSAL IS NOT SILENT. A bare `continue` would drop the
          // intent — it has already left the queue — costing the user their node
          // with no record and no word. It settles `unconfirmed` like every
          // other exit, which is what makes the branch AUDIBLE if it is ever
          // reached.
          const resolved = resolveStructuralAddBase(
            intent,
            useCanvasStore.getState().lastServerGraphHash,
          )
          if (resolved) {
            // The outcome is resolved inside `sendTurn` against the server
            // receipt — a refusal removes the node and says so there, where the
            // response is in hand. Nothing here may treat a resolved promise as
            // evidence the add landed.
            await senderRef
              .current(
                {
                  type: 'structural_add',
                  payload: buildStructuralAddWirePayload(resolved),
                },
                { structuralAdd: resolved, debugSource: 'canvas_add' },
              )
              .catch((err) => {
                if (import.meta.env.DEV) {
                  console.warn('[structuralAdd] send failed:', err)
                }
              })
          }

          // ⭐⭐ THE EVERY-EXIT SETTLE, AND IT IS DERIVED RATHER THAN ENUMERATED.
          //
          // `useConversation` gates its whole optimistic resolution on
          // `!isAbort`, and its ABORT ARM handles `factor_value_edit` only.
          // Every V5 dispatch runs `abortRef.current?.abort()` before installing
          // its own controller, so adding a node and then asking Olumi anything
          // cancels the add's turn and NEITHER arm runs: no removal, no
          // confirmation, no sentence. The response arm is fenced again on
          // `activeV5TurnIdRef.current === turnClientId`, which discards a
          // superseded turn just as quietly.
          //
          // Rather than MIRROR that list of branches here — a hand-maintained
          // mirror that would drift the moment a new exit is added — this asks
          // the only question that matters at this point: my await has returned,
          // so did ANYBODY settle this attempt? If not, we sent it and never
          // heard, and `unconfirmed` is the honest terminal state.
          //
          // ⚠ IT MUST NOT REMOVE THE NODE. The cancel was CLIENT-side; CEE may
          // well have taken the add and there are no committed bytes either way.
          // Destroying the user's node on that guess is the data-loss direction
          // of the same harm.
          //
          // `settleStructuralAdd` is idempotent, so a resolver that already
          // wrote `committed` / `refused` / `unconfirmed` wins and this is a
          // no-op — which is why the toast is gated on the status READ BACK
          // rather than on having called the setter.
          const stillOpen =
            useCanvasStore
              .getState()
              .structuralAddLifecycle.find((r) => r.intent.id === intent.id)
              ?.status === 'in_flight'
          if (stillOpen) {
            useCanvasStore.getState().settleStructuralAdd(intent.id, 'unconfirmed')
            // Deliberately the canvas toast bridge, not `addMessage`: this code
            // outlives the React instance that started the send, so the
            // conversation it would write into may already be unmounted.
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('topbar:show-toast', {
                detail: { message: STRUCTURAL_ADD_UNCONFIRMED_TOAST, level: 'warning' },
              }))
            }
          }
        }
      } finally {
        drainingRef.current = false
      }
    })()
    // `baseGraphHash` is a REAL dependency, not lint appeasement: it is the only
    // thing that can wake a queue held by the gate above.
  }, [pending, baseGraphHash])
}
