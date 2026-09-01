/**
 * useStructuralAddEvents — the ONE sender for durable canvas node creation.
 *
 * `store.addNode` captures an intent synchronously (see
 * `canvas/mutations/structuralAdd.ts`); this hook drains the queue and puts each
 * gesture on the wire as ONE `structural_add` turn. Deliberately the same shape
 * as `useStructuralRenameEvents` and `useStructuralDeleteEvents`: a recorder
 * that cannot send, a single drainer that can — rather than every add call site
 * growing its own transport.
 *
 * ⚠ NOT DEBOUNCED. `useGraphEditEvents` coalesces 1.5s of mutations before
 * flushing; that is wrong for this event for the same reason it is wrong for the
 * rename. `base_graph_hash` asserts the graph the user was LOOKING AT when they
 * created the node, and a coalesced flush would send it long after a sibling
 * turn had moved the hash — turning the stale gate into a guaranteed 409 rather
 * than a guard that fires only on genuine divergence.
 *
 * ⚠ SERIALISED, one gesture at a time. Two adds in flight against one scenario
 * is a guaranteed second refusal: `nodes` IS inside CEE's analysis-affecting
 * hash projection, so the first commit MOVES the persisted hash by construction
 * and the second's `base_graph_hash` is stale before it is sent. Draining in
 * order and awaiting each send means the second gesture's send happens after the
 * first has resolved — and by then `applyV5State` has captured the new
 * `graph_hash`.
 *
 * ⚠ THE QUEUED INTENT'S OWN ASSERTION IS STILL THE ONE IT CAPTURED, so two nodes
 * created in the same tick genuinely do put a stale hash on the second, and it
 * is genuinely refused with CEE's own sentence. Inventing a fresher assertion
 * here would be asserting a state nobody read.
 */

import { useEffect, useRef } from 'react'

import { useCanvasStore } from '../store'
import { isOrchestratorV2Enabled } from '../../flags'
import {
  buildStructuralAddWirePayload,
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
  /** True while a drain is running — the serialisation lock. */
  const drainingRef = useRef(false)
  const senderRef = useRef(sendSystemEvent)
  senderRef.current = sendSystemEvent

  useEffect(() => {
    if (pending.length === 0) return
    if (!isOrchestratorV2Enabled()) {
      // The transport is off, so nothing can be sent. Draining anyway is the
      // honest move: leaving intents queued would send them the moment the flag
      // flipped, asserting a hash read in a previous session.
      useCanvasStore.getState().takePendingStructuralAdds()
      return
    }
    if (drainingRef.current) return
    drainingRef.current = true

    // ⚠ NO CLEANUP-BASED CANCELLATION — the correctness point both siblings
    // record. A gesture made mid-flight changes `pending`, so React would run
    // this effect's cleanup BEFORE the re-run; an `AbortController` would
    // therefore kill the drain the new gesture is waiting behind, and the re-run
    // would bail on `drainingRef` and strand the queue. The loop re-reads the
    // queue instead, so a gesture arriving during a send is picked up by the
    // SAME drain.
    void (async () => {
      try {
        for (;;) {
          const batch = useCanvasStore.getState().takePendingStructuralAdds()
          if (batch.length === 0) return
          for (const intent of batch) {
            // The outcome is resolved inside `sendTurn` against the server
            // receipt — a refusal takes the node back off and says so there,
            // where the response is in hand. Nothing here may treat a resolved
            // promise as evidence the add landed.
            await senderRef
              .current(
                {
                  type: 'structural_add',
                  payload: buildStructuralAddWirePayload(intent),
                },
                { structuralAdd: intent, debugSource: 'canvas_add_node' },
              )
              .catch((err) => {
                if (import.meta.env.DEV) {
                  console.warn('[structuralAdd] send failed:', err)
                }
              })
          }
        }
      } finally {
        drainingRef.current = false
      }
    })()
  }, [pending])
}
