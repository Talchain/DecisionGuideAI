/**
 * useStructuralRenameEvents — the ONE sender for durable canvas renames.
 *
 * `store.updateNodeLabel` captures an intent synchronously against the
 * pre-rename node (see `canvas/mutations/structuralRename.ts`); this hook drains
 * the queue and puts each gesture on the wire as ONE `structural_rename` turn.
 * Deliberately the same shape as `useStructuralDeleteEvents` and
 * `usePanelApplyDrain`: a recorder that cannot send, a single drainer that can —
 * rather than four rename sites each growing their own transport.
 *
 * ⚠ NOT DEBOUNCED, and for this event the reason is sharper than for deletes.
 * `useGraphEditEvents` coalesces 1.5s of mutations before flushing. Both of this
 * event's assertions are about the graph the user was LOOKING AT when they
 * typed: `base_graph_hash` and, more delicately, `expected_label`. A coalesced
 * flush would read a label the user's own earlier edit had already changed, so
 * the concurrency gate would compare our own write against itself and pass —
 * silently disarming the one gate that protects a concurrent rename. The capture
 * is synchronous inside the store action; the drain runs on the effect after the
 * gesture's render.
 *
 * ⚠ SERIALISED, one gesture at a time, same as the delete drain. Two renames in
 * flight against one scenario is a guaranteed second refusal: the first commit
 * may move the persisted hash, and it certainly moves the persisted LABEL, so
 * the second's `expected_label` is stale by construction. Draining in order and
 * awaiting each send means the second gesture's send happens after the first has
 * resolved — and by then `applyV5State` has captured the new `graph_hash`.
 * ⚠ THE QUEUED INTENT'S OWN ASSERTIONS ARE STILL THE ONES IT CAPTURED, so a
 * second rename of the SAME node made before the first turn returned genuinely
 * does carry a stale `expected_label` and is genuinely refused — correctly, and
 * the user is told which name the model now holds. Inventing a fresher assertion
 * here would be asserting a state nobody read.
 */

import { useEffect, useRef } from 'react'

import { useCanvasStore } from '../store'
import { isOrchestratorV2Enabled } from '../../flags'
import {
  buildStructuralRenameWirePayload,
  type StructuralRenameIntent,
} from '../mutations/structuralRename'
import type { WireSystemEvent } from './types'

/** The dispatcher this hook needs — the real `sendSystemEvent`, or a test double. */
export type StructuralRenameSender = (
  event: WireSystemEvent,
  opts?: { structuralRename?: StructuralRenameIntent; debugSource?: string },
) => Promise<unknown>

export function useStructuralRenameEvents(sendSystemEvent: StructuralRenameSender): void {
  const pending = useCanvasStore((s) => s.pendingStructuralRenames)
  /** True while a drain is running — the serialisation lock. */
  const drainingRef = useRef(false)
  const senderRef = useRef(sendSystemEvent)
  senderRef.current = sendSystemEvent

  useEffect(() => {
    if (pending.length === 0) return
    if (!isOrchestratorV2Enabled()) {
      // The transport is off, so nothing can be sent. Draining anyway is the
      // honest move: leaving intents queued would send them the moment the flag
      // flipped, asserting labels and hashes read in a previous session.
      useCanvasStore.getState().takePendingStructuralRenames()
      return
    }
    if (drainingRef.current) return
    drainingRef.current = true

    // ⚠ NO CLEANUP-BASED CANCELLATION — the same correctness point
    // `useStructuralDeleteEvents` records. A gesture made mid-flight changes
    // `pending`, so React would run this effect's cleanup BEFORE the re-run; an
    // `AbortController` would therefore kill the drain the new gesture is
    // waiting behind, and the re-run would bail on `drainingRef` and strand the
    // queue. The loop re-reads the queue instead, so a gesture arriving during a
    // send is picked up by the SAME drain.
    void (async () => {
      try {
        for (;;) {
          const batch = useCanvasStore.getState().takePendingStructuralRenames()
          if (batch.length === 0) return
          for (const intent of batch) {
            // The outcome is resolved inside `sendTurn` against the server
            // receipt — a refusal reverts the label and says so there, where the
            // response is in hand. Nothing here may treat a resolved promise as
            // evidence the rename landed.
            await senderRef
              .current(
                {
                  type: 'structural_rename',
                  payload: buildStructuralRenameWirePayload(intent),
                },
                { structuralRename: intent, debugSource: 'canvas_rename' },
              )
              .catch((err) => {
                if (import.meta.env.DEV) {
                  console.warn('[structuralRename] send failed:', err)
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
