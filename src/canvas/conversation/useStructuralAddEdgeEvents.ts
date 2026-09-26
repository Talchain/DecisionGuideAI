/**
 * useStructuralAddEdgeEvents — the ONE sender for durable canvas edge adds.
 *
 * `store.addEdge` captures an intent synchronously against the POST-add edges
 * (see `canvas/mutations/structuralAddEdge.ts`); this hook drains the queue and
 * puts each gesture on the wire as ONE `structural_add_edge` turn. Deliberately
 * the same shape as `useStructuralAddEvents`: a recorder that cannot send, a
 * single drainer that can.
 *
 * ⚠ NOT DEBOUNCED, for the sibling's reason: `base_graph_hash` asserts something
 * about the graph the user was looking at when they drew, and a coalesced flush
 * would read a hash their own later edit had already moved.
 *
 * ⚠ SERIALISED, one gesture at a time. An add ALWAYS moves the persisted hash
 * (a new edge changes the projected `edges` array), so two in flight against one
 * scenario guarantees the second a stale-base refusal by construction.
 *
 * ⚠⚠ WHAT THIS DOES **NOT** DO, STATED RATHER THAN DISCOVERED LATER. The node
 * sibling carries a full per-intent LIFECYCLE — `in_flight` → committed /
 * refused / unconfirmed — plus `applyStructuralAddRevert`, so a node the server
 * refuses is taken back off the canvas. **This hook has no equivalent.** A
 * refused edge stays on the canvas and the user learns of the refusal only from
 * CEE's own sentence in the conversation.
 *
 * That is a DELIBERATE, DISCLOSED gap rather than an oversight: the revert half
 * needs its own store lifecycle and its own reasoning about what to do when a
 * cancelled turn leaves the outcome genuinely unknown, and half of that
 * machinery would be worse than none — it is the arm that decides whether to
 * destroy a user's work on a guess. It is the next increment, and until it
 * lands the honest reading of this hook is "the edge is SENT", never "the edge
 * is SAVED".
 *
 * ⭐⭐ A LINK CHAINED TO A NODE ADD WAITS FOR IT, AND RIDES ITS HASH. Served
 * 409 (UI `eec722ab`, 25 Sep 2026): "+ Add option" sent the option on base
 * `a8e8…` (→ 200, `4892…`) and its decision link ALSO on `a8e8…` → 409
 * `BASE_HASH_DIVERGED`, leaving CEE an option linked to nothing. This drain and
 * the node's are independent, and the link's payload was built — stale base
 * included — before the option's write had moved the hash. A link carrying
 * `afterNodeAddIntentId` is now HELD in the queue until that add settles, then
 * sent on the hash its commit returned; if the add did not commit it is not
 * sent at all (`readChainedStructuralAddEdge`). No retry, no invented base.
 */

import { useEffect, useRef } from 'react'

import { useCanvasStore } from '../store'
import { isOrchestratorV2Enabled } from '../../flags'
import {
  buildStructuralAddEdgeWirePayload,
  readChainedStructuralAddEdge,
  resolveStructuralAddEdgeBase,
  STRUCTURAL_ADD_EDGE_UNCONFIRMED_TOAST,
  type ResolvedStructuralAddEdgeIntent,
} from '../mutations/structuralAddEdge'
import type { WireSystemEvent } from './types'

export type StructuralAddEdgeSender = (
  event: WireSystemEvent,
  opts?: { debugSource?: string },
) => Promise<unknown>

export function useStructuralAddEdgeEvents(sendSystemEvent: StructuralAddEdgeSender): void {
  const pending = useCanvasStore((s) => s.pendingStructuralAddEdges)
  /**
   * ⭐⭐ SUBSCRIBED DELIBERATELY, AND IT IS HALF THE CAPABILITY — the sibling's
   * reasoning applies unchanged. An edge drawn on a restored graph is queued
   * with a NULL base hash because none exists yet; the only real hash arrives on
   * a turn response. Keying the effect on `pending` alone would leave that
   * intent with nothing left to wake it.
   */
  const baseGraphHash = useCanvasStore((s) => s.lastServerGraphHash)
  /**
   * The node-add lifecycle — the only thing that can wake a link HELD behind the
   * node add it is chained to. Its settle is what makes that link sendable.
   */
  const addLifecycle = useCanvasStore((s) => s.structuralAddLifecycle)
  /** True while a drain is running — the serialisation lock. */
  const drainingRef = useRef(false)
  const senderRef = useRef(sendSystemEvent)
  senderRef.current = sendSystemEvent

  useEffect(() => {
    if (pending.length === 0) return
    if (!isOrchestratorV2Enabled()) {
      // The transport is off, so nothing can be sent. Draining anyway is the
      // honest move: leaving intents queued would send them the moment the flag
      // flipped, asserting hashes read in a previous session.
      useCanvasStore.getState().takePendingStructuralAddEdges()
      return
    }
    // ⚠⚠ HOLD, DO NOT DISCARD. With no base hash there is nothing to stamp, and
    // dropping here would reproduce the defect one layer down — the connection
    // on the canvas, nothing on the wire. The next turn's `graph_hash` re-runs
    // this effect through the subscription above.
    if (typeof baseGraphHash !== 'string' || baseGraphHash.length === 0) return
    if (drainingRef.current) return
    drainingRef.current = true

    // ⚠ NO CLEANUP-BASED CANCELLATION, the same correctness point all three
    // siblings record: a gesture made mid-flight changes `pending`, so React
    // runs cleanup BEFORE the re-run, and an AbortController would kill the
    // drain the new gesture is waiting behind.
    //
    // ⭐ THE LOOP RE-READS THE QUEUE, as the node sibling's does: a link that
    // becomes sendable while a send is awaited (its node add settled, or a new
    // gesture arrived) is picked up by THIS drain, because the effect re-run it
    // triggers bails on `drainingRef`. The drain ends only on a read that finds
    // nothing sendable, and releases the lock in the same tick — so a later
    // settle always finds the lock free.
    const readiness = (intent: Parameters<typeof readChainedStructuralAddEdge>[0]) => {
      const live = useCanvasStore.getState()
      return readChainedStructuralAddEdge(intent, live.pendingStructuralAdds, live.structuralAddLifecycle)
    }
    void (async () => {
      try {
        for (;;) {
          // A link whose node add has not settled STAYS QUEUED — held, never
          // dropped. Everything else leaves the queue in this one atomic read.
          const batch = useCanvasStore
            .getState()
            .takePendingStructuralAddEdges((intent) => readiness(intent).kind !== 'hold')
          if (batch.length === 0) return
          for (const intent of batch) {
            const chain = readiness(intent)
            // ⭐ C32 (Canonical State, #70 5841540452): the node's own commit
            // already holds this pair — CEE linked the option to the model's
            // sole decision in that write. The link is DONE. Not sent, no toast:
            // the canvas already shows exactly what the server holds.
            if (chain.kind === 'already_linked') continue
            if (chain.kind === 'stand_down' || chain.kind === 'hold') {
              // `hold` is unreachable here (the take above excluded it, and a
              // settled verdict is never rewritten). `stand_down`: the node add
              // did not commit, so this link would name an endpoint the server
              // may not hold. Not sent and not retried — the node's own settle
              // has already told the user where the gesture stands.
              if (import.meta.env.DEV) {
                console.warn(
                  `[structuralAddEdge] chained link not sent: node add ${chain.kind === 'stand_down' ? chain.nodeStatus : 'unsettled'}`,
                )
              }
              continue
            }
            // ⭐ A CHAINED link is based on the hash its node's commit RETURNED —
            // the graph the gesture produced. Only when that response carried no
            // hash does it fall back to the freshest known one, the same rule
            // every deferred intent follows.
            const resolved: ResolvedStructuralAddEdgeIntent | null =
              chain.kind === 'send' && chain.baseGraphHash !== null
                ? { ...intent, baseGraphHash: chain.baseGraphHash }
                : resolveStructuralAddEdgeBase(intent, useCanvasStore.getState().lastServerGraphHash)
            if (!resolved) {
              // Unreachable given the gate above, but expressible — so it is
              // AUDIBLE rather than a silent drop. The intent has already left the
              // queue; saying nothing would cost the user their connection with no
              // record and no word.
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('topbar:show-toast', {
                  detail: { message: STRUCTURAL_ADD_EDGE_UNCONFIRMED_TOAST, level: 'warning' },
                }))
              }
              continue
            }
            // Nothing here may treat a resolved promise as evidence the edge
            // landed: the outcome is CEE's, carried in the turn response.
            await senderRef
              .current(
                {
                  type: 'structural_add_edge',
                  payload: buildStructuralAddEdgeWirePayload(resolved),
                },
                { debugSource: 'canvas_add_edge' },
              )
              .catch((err) => {
                if (import.meta.env.DEV) {
                  console.warn('[structuralAddEdge] send failed:', err)
                }
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('topbar:show-toast', {
                    detail: { message: STRUCTURAL_ADD_EDGE_UNCONFIRMED_TOAST, level: 'warning' },
                  }))
                }
              })
          }
        }
      } finally {
        drainingRef.current = false
      }
    })()
    // `baseGraphHash` is a REAL dependency: it is the only thing that can wake a
    // queue held by the gate above. `addLifecycle` is the same for a link held
    // behind its node add.
  }, [pending, baseGraphHash, addLifecycle])
}
