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
 * ⚠ SCOPE WIDENED 18 Aug 2026 (the REHOME → DELETE lane), and the widening is
 * the point: the founder's ruling is *"do not preserve the duplicate editor
 * because some capabilities are still local-only; EXTEND THE CANONICAL
 * TRANSACTIONAL AUTHORITY WHERE REQUIRED, then remove the duplicate."* So this
 * hook now owns THREE operations, not one — and it owns them for BOTH editors,
 * which is what makes the second one deletable.
 *
 * The two new ones are LOCAL COMMITS, and they are typed as a different thing
 * from `proposeFactorValue` on purpose (trap 21 — two questions must not share
 * one name). `proposeFactorValue` asks *"will the server accept this number?"*.
 * `proposeOptionIntervention` and `proposeFactorConfirmation` ask *"record this
 * in the model"*, and there is NO server carrier for either: the wire's only
 * value-bearing node edit is `factor_value_edit`, whose `field` is the literal
 * `'value'`. They reach CEE exactly as they always have — through the debounced,
 * VALUE-LESS `direct_graph_edit` notification that `useGraphEditEvents`
 * emits off the store. Nothing here claims otherwise, and `LocalCommitOutcome`
 * has no `dispatched` member so no caller can accidentally report one.
 *
 * WHAT THE EXTENSION IS *NOT*: a new writer. Both operations go through the
 * SANCTIONED SETTERS (`setIntervention`, `setObservedSource`) that the v1
 * sections already used — the same store write, relocated behind one authority
 * so the surfaces stop each owning their own copy of it.
 *
 * WIRE-CARRIER SCOPE. The UI's wire vocabulary
 * (`WIRE_SYSTEM_EVENT_TYPES`) carries four server-authoritative edit carriers —
 * `factor_value_edit`, `prior_range_edit` (emitted inside the sanctioned
 * `setPriorRange`), `edge_adjudication`, and — since schemas 0.48.0 —
 * `structural_delete`, the durable REMOVAL, which is emitted from the canvas
 * delete gestures via `useStructuralDeleteEvents` and resolves its own receipt
 * inside `sendTurn` (this hook is not on that path). Edge strength / likelihood
 * / direction and the goal target still have NO canonical carrier and NO entry
 * point here; the v2 surface keeps rendering those affordances DISABLED with an
 * honest label rather than routing them through a local-only write that would
 * look identical to a server-backed one (design §2 F6).
 *
 * ⚠ AND F6 IS *NOT* RE-OPENED BY THE TWO LOCAL COMMITS. F6's harm is that a
 * local write and a server-backed one are INDISTINGUISHABLE on screen. These
 * two are distinguishable by construction: neither renders the value-edit
 * three-beat, and each is a distinct gesture with its own visible result — a
 * confirmation flips the provenance pill to "Confirmed by you", and an
 * intervention target shows the number the user set. Neither ever claims a
 * server accepted anything, because neither can return an outcome that says so.
 */

import { useCallback } from 'react'
import { useCanvasStore } from '../store'
import { resolveNodeTypeLiteral } from '../domain/nodes'
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

/**
 * How a LOCAL COMMIT left this seam.
 *
 * ⚠ THERE IS DELIBERATELY NO `dispatched` MEMBER. These operations have no
 * value-bearing wire carrier, so a caller cannot report that a server accepted
 * one — the type makes the honest statement the only statement available.
 *
 * - `committed`      — the sanctioned setter wrote the model. CEE learns of it
 *                      only through the debounced, value-less
 *                      `direct_graph_edit` notification, exactly as it did from
 *                      the v1 sections.
 * - `not_encodable`  — nothing happened anywhere. Fail CLOSED: a dropped edit
 *                      is a visible "nothing happened"; a half-committed one is
 *                      a silent split-brain.
 */
export type LocalCommitOutcome = 'committed' | 'not_encodable'

export interface ModelEditAuthorityLive {
  proposeFactorValue: (typedValue: number) => FactorValueProposalOutcome
  /**
   * Set the ACTIVE OPTION's target value for one factor.
   *
   * `activeNodeId` is the OPTION; `factorId` names the factor whose value that
   * option would move. Both halves are checked — see the implementation for why
   * an unresolvable `factorId` must fail closed rather than write.
   */
  proposeOptionIntervention: (factorId: string, value: number) => LocalCommitOutcome
  /**
   * Ratify the ACTIVE FACTOR's existing value as correct.
   *
   * ⚠ STAMPS `user_confirmed`, NEVER `user`. See the implementation.
   */
  proposeFactorConfirmation: () => LocalCommitOutcome
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

  /**
   * ⚠ WHY THE FACTOR MUST EXIST BEFORE AN INTERVENTION IS WRITTEN.
   *
   * `interventions` is a map KEYED BY FACTOR ID. Writing a key that resolves to
   * no node produces an entry nothing can label — and every surface that lists
   * interventions falls back to the key when the lookup misses
   * (`OptionsSection.buildInterventions`: `factorNode?.data?.label ?? factorId`).
   * So an unchecked write here surfaces a RAW WIRE ID to the user, one hop
   * later, which is the exact leak class this lane's outline work closed. The
   * guard is at the WRITE because that is the only place it cannot be bypassed.
   *
   * It is also preamble P6: an entry the user cannot name is structure the
   * product invented, and it would go on to manufacture a "set this value" ask
   * for an element that is not in the model.
   */
  const proposeOptionIntervention = useCallback(
    (factorId: string, value: number): LocalCommitOutcome => {
      if (!activeNodeId) return 'not_encodable'
      if (!Number.isFinite(value)) return 'not_encodable'
      if (typeof factorId !== 'string' || factorId.trim() === '') return 'not_encodable'
      const state = useCanvasStore.getState()
      const option = state.nodes.find(n => n.id === activeNodeId)
      // An intervention belongs to an OPTION. Writing an `interventions` map
      // onto a factor would be a well-formed store patch that means nothing,
      // and nothing downstream would ever report it.
      if (!option || resolveNodeTypeLiteral(option) !== 'option') return 'not_encodable'
      if (!state.nodes.some(n => n.id === factorId)) return 'not_encodable'

      mutations.setIntervention(factorId, value)
      return 'committed'
    },
    [activeNodeId, mutations],
  )

  /**
   * ⚠ THE STAMP IS `user_confirmed`, AND THAT IS THE WHOLE FIX.
   *
   * The v1 Model tab wrote `setObservedSource('user')` for this gesture. The
   * shared classifier (`canvas/domain/valueProvenance.ts`) maps `'user'` to the
   * `edited` class, so the pill read **"User edited"** for an act in which the
   * user changed NO number — they ratified Olumi's. Pre-analysis, the outputs
   * dock and the calibrate drill-in all write `user_confirmed` for the
   * identical gesture and get "Confirmed by you": one act, two stamps, decided
   * by which surface the user happened to be standing on.
   *
   * ⚠ `source` ALONE — no `extractionType`. The two sibling surfaces also write
   * `extractionType: 'explicit'`, and copying that would be inventing a claim
   * this gesture does not establish: confirming a number says nothing about
   * HOW it was extracted. Ratifying a value may change its provenance and
   * nothing else, which is precisely why the old handler's baseline sibling was
   * corrected on the same grounds (see `FactorsSection.handleBaselineSave`).
   *
   * ⚠ AND THERE MUST BE A VALUE TO RATIFY. Stamping "confirmed by you" over an
   * absent number is a claim about the model that the model does not contain
   * (preamble P5), and it would silently drop the factor out of the verify
   * count — `countFactorsToVerify` clears on any source that is neither absent
   * nor `cee_inference`. The gap would stop being reported without being fixed.
   */
  const proposeFactorConfirmation = useCallback((): LocalCommitOutcome => {
    if (!activeNodeId) return 'not_encodable'
    const node = useCanvasStore.getState().nodes.find(n => n.id === activeNodeId)
    if (!node || resolveNodeTypeLiteral(node) !== 'factor') return 'not_encodable'
    const data = node.data as Record<string, unknown> | undefined
    const obs = (data?.observedState ?? data?.observed_state) as
      | Record<string, unknown>
      | undefined
    const value = obs?.value
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'not_encodable'

    mutations.setObservedSource('user_confirmed')
    return 'committed'
  }, [activeNodeId, mutations])

  return { proposeFactorValue, proposeOptionIntervention, proposeFactorConfirmation }
}
