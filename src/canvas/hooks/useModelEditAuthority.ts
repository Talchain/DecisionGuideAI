/**
 * useModelEditAuthority — the Model Editor v2's write seam, implemented AS the
 * canonical transaction path (16 Aug 2026 mount train).
 *
 * ⚠ THIS MODULE INVENTS NOTHING. Every step below is the reference factor-value
 * commit — `FactorsSection.handleValueCommit` (ROADMAP 2.121 slice 1 / #513 /
 * 2.129(b)) — extracted so the v2 outline and the v1 card commit through ONE
 * path rather than two that must stay in sync:
 *
 *   1. `buildFactorValueEditEvent` owns the scale contract (the node's OWN
 *      cap/unit decides whether the typed number is a user-unit magnitude);
 *      it FAILS CLOSED (returns null) on anything the wire cannot carry.
 *   2. `captureOptimisticFactorEdit` snapshots the undo BEFORE the write, from
 *      the same pre-write data the event was built from.
 *   3. `setObservedValue` — the sanctioned setter — writes value + raw_value +
 *      the provenance stamp in ONE update. Never a raw `updateNode`.
 *   4. `sendSystemEvent(event, { optimisticFactorEdit })` — the undo travels
 *      WITH the send: the conversation dispatcher owns the reply (and the
 *      deferral buffer), so a server REFUSAL reverts the optimistic write and
 *      an acceptance stamps it, for immediate and deferred dispatch alike.
 *
 * WHAT THIS DOES **NOT** PROVIDE, stated so nobody reads more into it: the
 * receipt-bearing `EditProposalHandle` of `model-tab-v2/contracts.ts` §1
 * (`applied` reachable only from a receipt). Today's dispatcher resolves
 * refusal/acceptance CENTRALLY and does not hand the caller a receipt — a
 * deferred send's promise resolves `SEND_DEFERRED` before the turn exists. An
 * authority that echoed its own typed value back as an "applied" receipt would
 * be an optimistic write wearing a confirmation (contracts.ts C11's warning),
 * so this hook deliberately returns only the DISPATCH outcome and lets the row
 * render the store, which the central machinery keeps honest. When the
 * receipt-bearing transaction API lands, this seam is where it plugs in.
 *
 * SCOPE AT THIS TIP: `proposeFactorValue` only. The UI's wire vocabulary
 * (`WIRE_SYSTEM_EVENT_TYPES`) carries exactly three server-authoritative edit
 * carriers — `factor_value_edit`, `prior_range_edit` (emitted inside the
 * sanctioned `setPriorRange`) and `edge_adjudication`. Edge strength /
 * likelihood / direction, option interventions, the goal target and factor
 * confirmation have NO canonical carrier yet; the v2 surface renders those
 * affordances DISABLED with an honest label rather than routing them through a
 * local-only write that would look identical to a server-backed one
 * (design §2 F6).
 */

import { useCallback } from 'react'
import { useCanvasStore } from '../store'
import { useOptionalConversationContext } from '../conversation/ConversationContext'
import { useNodeMutations } from '../ui/inspector-v2/useInspectorMutations'
import { buildFactorValueEditEvent } from '../conversation/factorValueEdit'
import { captureOptimisticFactorEdit } from '../conversation/optimisticFactorEdit'

/**
 * How a proposal left this seam.
 *
 * - `dispatched`   — local optimistic write landed AND the wire event is with
 *                    the conversation dispatcher (which owns refusal/revert).
 * - `local_only`   — local write landed; no ConversationProvider is mounted,
 *                    so no turn was sent. The same degradation the v1 card has:
 *                    isolated renders edit locally, never throw.
 * - `not_encodable`— nothing happened at all: the edit could not be encoded
 *                    for the wire (no node, non-finite number), so — fail
 *                    CLOSED — no store write either. A dropped edit is a
 *                    visible "nothing happened"; a half-committed one is a
 *                    silent split-brain.
 */
export type FactorValueProposalOutcome = 'dispatched' | 'local_only' | 'not_encodable'

export interface ModelEditAuthorityLive {
  proposeFactorValue: (typedValue: number) => FactorValueProposalOutcome
}

/**
 * The authority for ONE node — the node whose edit is currently active.
 * Hook-parameterised exactly as `useNodeMutations` is; pass `null` when no
 * edit is active (every proposal is then `not_encodable`).
 */
export function useModelEditAuthority(activeNodeId: string | null): ModelEditAuthorityLive {
  const mutations = useNodeMutations(activeNodeId ?? '')
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent

  const proposeFactorValue = useCallback(
    (typedValue: number): FactorValueProposalOutcome => {
      if (!activeNodeId) return 'not_encodable'
      const node = useCanvasStore.getState().nodes.find(n => n.id === activeNodeId)
      if (!node) return 'not_encodable'
      const data = node.data as Record<string, unknown>

      const event = buildFactorValueEditEvent({
        nodeId: activeNodeId,
        typedValue,
        // The node's data as it is BEFORE the local write — its cap/unit is
        // what decides the scale of what the user typed.
        nodeData: data,
      })
      if (!event) return 'not_encodable'
      const { value: modelValue, raw_value: rawMagnitude } = event.payload as {
        value: number
        raw_value?: number
      }

      // Undo BEFORE the write, from the same pre-write data.
      const undo = captureOptimisticFactorEdit(activeNodeId, modelValue, data)

      // Local write first, in ONE update: value + raw_value + provenance stamp.
      mutations.setObservedValue(modelValue, rawMagnitude, { source: 'user' })

      if (!sendSystemEvent) return 'local_only'
      void Promise.resolve(
        sendSystemEvent(event, undo ? { optimisticFactorEdit: undo } : undefined),
      ).catch(() => {
        // Swallowed deliberately — a genuine send failure is recorded by the
        // conversation's own failure channel, and a server REFUSAL is not a
        // failure: the dispatcher's central revert handles it. Identical to the
        // reference surface's catch, for the identical reason.
      })
      return 'dispatched'
    },
    [activeNodeId, mutations, sendSystemEvent],
  )

  return { proposeFactorValue }
}
