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
 * (`WIRE_SYSTEM_EVENT_TYPES`) carries FIVE server-authoritative edit carriers —
 * `factor_value_edit`, `prior_range_edit` (emitted inside the sanctioned
 * `setPriorRange`), `edge_adjudication`, `structural_delete` (since schemas
 * 0.48.0), the durable REMOVAL, which is emitted from the canvas delete gestures
 * via `useStructuralDeleteEvents` and resolves its own receipt inside `sendTurn`
 * (this hook is not on that path) — and `edge_strength_edit`.
 *
 * ⚠ THIS PARAGRAPH SAID "FOUR" AND OMITTED THE FIFTH, which was true when it was
 * written and stopped being true on 2026-09-07 when `useEdgeMutations.setStrength`
 * gained its emitter (#1287, fixed forward by #1295). The count is corrected
 * rather than the sentence rewritten, because a reader who inherited "four" would
 * conclude edge strength still needs a carrier DESIGNED — and it does not; since
 * 2026-09-08 this hook is an entry point to it (`proposeEdgeStrength`, below).
 *
 * ⚠ CORRECTED 2026-09-07 — THIS PARAGRAPH SAID "Edge strength / likelihood /
 * direction and the goal target still have NO canonical carrier". THE EDGE
 * STRENGTH HALF IS NOW FALSE, and it was the most misleading kind of stale: it
 * grouped a member that HAS had a contract carrier since schemas 0.42.0 and a
 * CEE writer since Train C with three that genuinely have none, so a lane
 * reading this would have concluded the carrier had to be designed. It only ever
 * lacked a UI EMITTER, and that landed at `useEdgeMutations.setStrength`.
 *
 * Goal targets now use the existing typed add_constraint route, not a new
 * system event. The earlier no-carrier claim counted only system-event kinds.
 * The Model control explicitly requests an absolute minimum with stated units;
 * only the server's committed response updates it. Other disabled controls are
 * unchanged; no local-only goal write is disguised as a saved target.
 *
 * ⚠⚠ CORRECTED 2026-09-08 — THE PARAGRAPH BELOW WAS TRUE AND IS NOW FALSE, and
 * it is left standing so its reasoning is not re-derived from scratch:
 *
 *   ~~AND EDGE STRENGTH IS **NOT** AN ENTRY POINT HERE EITHER, which is a
 *   different statement from "has no carrier". This hook is parameterised by a
 *   NODE id; an edge is addressed by its `(from, to)` pair. Adding an edge
 *   operation to a node authority would be the two-questions-one-name defect
 *   (trap 21), so the emitter lives at the edge setter instead.~~
 *
 * `proposeEdgeStrength` IS an entry point here now, and the trap-21 objection is
 * answered rather than ignored. The hook is no longer "the authority for one
 * NODE": it is the authority for WHATEVER ELEMENT THE ACTIVE GESTURE ADDRESSES,
 * and it takes the node and the edge in SEPARATE parameters precisely so the two
 * questions keep two names. Nothing is addressed by a wrong-kind id, and
 * `proposeEdgeStrength` re-states the edge id it was called with so a caller
 * whose hook is keyed to a different edge fails CLOSED instead of writing.
 *
 * ⚠ AND IT STILL DOES NOT WRITE. The edge write goes through the SANCTIONED
 * SETTER (`useEdgeMutations.setStrength`), which owns the emitter, the local
 * patch and the `preserveDirection` rule. This hook adds a refusal in front of
 * it and nothing else — see `proposeEdgeStrength` for why that refusal exists
 * and why it is not a copy of the setter's rules.
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
import { factorHasConfirmableValue } from '../domain/valueProvenance'
import { useOptionalConversationContext } from '../conversation/ConversationContext'
import {
  useEdgeMutations,
  useNodeMutations,
  type EdgeStrengthCommitOutcome,
} from '../ui/inspector-v2/useInspectorMutations'
import { buildFactorValueEditEvent } from '../conversation/factorValueEdit'
import { buildEdgeStrengthEditEvent } from '../conversation/edgeStrengthEdit'
import { captureOptimisticFactorEdit } from '../conversation/optimisticFactorEdit'
import { buildManualGoalTarget, manualGoalTargetMessage } from '../conversation/manualGoalTarget'
import {
  buildOptionInterventionEditEvent,
  type OptionInterventionEditRefusal,
} from '../conversation/optionInterventionEdit'
import {
  SEND_BLOCKED,
  SEND_DEFERRED,
  SystemEventSendError,
} from '../conversation/useConversation'
import { isProvenNoWriteConflict } from '../../v5/provenNoWriteConflict'

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

/**
 * How an OPTION-INTERVENTION proposal left this seam (schemas 0.54.0).
 *
 * ⚠ IT IS NO LONGER `LocalCommitOutcome`, AND THE SPLIT IS THE POINT. That type
 * deliberately has no `dispatched` member because its operations had no
 * value-bearing wire carrier — "the type makes the honest statement the only
 * statement available". `option_intervention_edit` now IS that carrier, so
 * keeping this gesture on the local-commit union would force it to report
 * `committed` for a write the server owns. `proposeFactorConfirmation` still has
 * no carrier and keeps the old type; the two gestures are named apart rather
 * than sharing a union that is now true of only one of them.
 *
 * - `dispatched`       — nothing was written locally; the typed event is with
 *                        the conversation dispatcher and the applied response
 *                        owns the store write. Exactly `proposeGoalTarget`'s
 *                        discipline on this same surface.
 * - `needs_fresh_base`  — ⭐ SPLIT OUT OF `not_encodable`, and the split is the
 *                        whole point. There is no CEE-stamped `graph_hash` this
 *                        session, which is the ordinary state after a reload: a
 *                        restore reads persistence with no CEE turn. It is the
 *                        one refusal the USER CAN CLEAR — any turn refreshes the
 *                        base — so it must be distinguishable at the caller,
 *                        which cannot offer a recovery it cannot tell apart.
 *                        Collapsed into `not_encodable` it reads as "your edit
 *                        was invalid", which is both false and unactionable.
 * - `not_encodable`    — nothing happened anywhere, and nothing the user can do
 *                        about it changes that: no ids, a non-finite or
 *                        out-of-scale value, or no conversation to send
 *                        through. Fail CLOSED.
 *
 * ⚠ THE TWO REFUSALS ARE DERIVED FROM THE BUILDER, NOT RE-SPELLED HERE. They are
 * decided by the builder's guards, so listing them again in this union would be
 * a hand-maintained mirror of exactly the kind that drifts silently — a refusal
 * added there and forgotten here would not fail to compile, it would fail to be
 * REPORTED.
 */
export type OptionInterventionProposalOutcome = 'dispatched' | OptionInterventionEditRefusal

/**
 * What the SENDER did with a dispatched effect edit — resolved later, because
 * the sync return above cannot know it.
 *
 * ⚠⚠ THE DISPATCH OUTCOME IS NOT THE SEND OUTCOME, and conflating them is the
 * defect this type exists to prevent. `dispatched` means the event left this
 * hook; the sender's promise resolves afterwards with one of three very
 * different facts, and a row that showed "sent" for all three would be telling
 * the user something false in two of them:
 *
 * - `sent`    — the turn was actually issued. The response settles the value,
 *               and the canonical store is what says so; this hook does not
 *               echo its own number back as a confirmation (contracts.ts C11).
 * - `queued`  — `SEND_DEFERRED`: another turn holds the lock, so this one is
 *               buffered and WILL be sent. Nothing is wrong and nothing has
 *               happened yet. The promise resolves *before the turn exists*,
 *               which is exactly why "sent" would be a lie here.
 *
 *               ⚠ UNREACHABLE BY CONSTRUCTION, AND KEPT ANYWAY. The send passes
 *               `deferIfBusy: false`, so the sender returns `SEND_BLOCKED`
 *               rather than buffering — see the implementation for why a
 *               buffered copy of THIS event is both unconfirmable and stale by
 *               construction. The branch stays because deleting it would leave
 *               a future `SEND_DEFERRED` falling through to `sent`, which is
 *               the one answer that is definitely wrong.
 * - `blocked` — `SEND_BLOCKED`, AND IT IS THE ONLY SETTLEMENT ENTITLED TO SAY
 *               "NOT SENT". The sender refused the dispatch outright — another
 *               turn holds the lock — so the request was never built and NO
 *               FETCH WAS MADE. That is the only pre-dispatch proof available
 *               anywhere on this path, and it is a proof about the client's own
 *               behaviour rather than an inference about the network's.
 *
 *               ⚠⚠ TWO WRONG ANSWERS HAVE NOW BEEN GIVEN HERE, IN OPPOSITE
 *               DIRECTIONS, AND BOTH CLAIMED MORE THAN THE EVIDENCE. First
 *               every transport rejection was folded in, which told a proxy
 *               timeout CEE went on to commit that it was never sent. Then it
 *               was split by `isUnverifiedDelivery`'s bit — and a FALSY bit was
 *               read as proof of non-delivery, which it is not: `v5Adapter`
 *               catches ANY fetch rejection without observing whether the
 *               server accepted, and `responseRouter` derives `network` purely
 *               from a MISSING `http_status`. So CEE can commit, the connection
 *               can die before headers reach the browser, fetch rejects
 *               `TypeError` — and that arrives indistinguishable from offline.
 *               ABSENT METADATA IS NOT PROOF; carrying the bit does not create
 *               a guarantee that was never derived.
 *
 * - `refused`  — the server RECEIVED the turn, failed it, and its envelope
 *                PROVES nothing was written (`isProvenNoWriteConflict`). The
 *                model does not hold this number and never did, so the row may
 *                say so outright.
 *
 * - `unverified` — a write is NOT ruled out, so the row may claim neither saved
 *                nor refused. THREE ways in, and the second is the one an
 *                earlier cut got wrong:
 *                  · a server failure whose category the producer has not
 *                    certified as a no-write;
 *                  · EVERY transport rejection, both halves. The proxy-timeout
 *                    half reached CEE, which goes on to commit (live-witnessed
 *                    at 123.1s, ROADMAP 2.665); the fetch-threw half MAY have
 *                    reached it and lost the response afterwards. Neither is
 *                    non-delivery, and nothing on this path can tell them from
 *                    a genuine offline;
 *                  · any rejection shape this seam does not recognise. An
 *                    unknown cannot prove non-delivery, so it takes the
 *                    cannot-confirm line, never the confident one.
 *
 * ⚠⚠ `refused` AND `unverified` WERE ONE THING — the catch reported `blocked`
 * for every rejection — AND THAT WAS FALSE IN BOTH DIRECTIONS. `blocked`'s copy
 * says nothing reached the server, which is a lie about a 409 the server sent
 * back deliberately; and answering "not sent" to a failure that MAY have
 * written is the more dangerous half, because the user re-sends a number the
 * model might already hold.
 */
export type OptionInterventionSendSettlement =
  | 'sent'
  | 'queued'
  | 'blocked'
  | 'refused'
  | 'unverified'

/**
 * How an EDGE STRENGTH proposal left this seam.
 *
 * ⭐⭐ IT EXTENDS `EdgeStrengthCommitOutcome` RATHER THAN RESTATING IT. The
 * sibling type at the setter already names the four states an edge-strength
 * commit can land in, and its header carries the reasoning for the fourth
 * (`not_wire_encodable` and `local_only` are different states needing opposite
 * follow-ups). Re-spelling those four here would be two lists of one thing —
 * this estate's dominant defect — so they are IMPORTED and exactly one member is
 * added.
 *
 * ⭐ THE ADDED MEMBER EXISTS BECAUSE THIS SEAM FAILS CLOSED AND ITS SIBLING DOES
 * NOT, which is a real difference and not a stylistic one:
 *
 *   · `setStrength` writes LOCALLY EVEN WHEN THE WIRE CANNOT CARRY THE EDIT, on
 *     purpose — it serves the inspector's slider, where a whole class of edges
 *     has no assertable `expected`, and failing closed there would make the
 *     control silently dead. It discloses the gap with `not_wire_encodable`.
 *   · THIS seam serves the Model tab v2, whose entire premise is that an
 *     affordance is offered ONLY where the write reaches the server (design §2
 *     F6). A local write behind a server-looking control is the harm that
 *     surface exists to remove, so an edit the wire cannot carry must leave the
 *     model UNTOUCHED — the same fail-closed rule `proposeFactorValue` follows.
 *
 * So the two seams cannot share one token for that case: at the setter it means
 * "written locally, not sent"; here it would have to mean "not written at all".
 * One name, two questions is trap 21, and the fix is to name them apart.
 *
 * - `refused_unassertable` — NOTHING HAPPENED ANYWHERE, deliberately. The edit
 *   could not be truthfully asserted to the server: no server-stated `expected`
 *   tuple for this edge, a non-canonical endpoint id, or a magnitude outside the
 *   contract's `[0, 1]`. Refusing beats a local write the row would render as
 *   though it were saved.
 * - `dispatched` / `local_only` / `not_wire_encodable` / `not_encodable` — as
 *   documented on `EdgeStrengthCommitOutcome`, returned verbatim from the setter.
 *
 * ⚠ `not_wire_encodable` IS UNREACHABLE FROM THIS SEAM AND IS STILL IN THE UNION,
 * which is deliberate. The refusal above runs the SAME builder over the SAME
 * synchronous store read the setter is about to make, so the setter cannot reach
 * its own null branch after it. The member stays because it belongs to the
 * imported type, not to this one — narrowing it away would fork the sibling's
 * vocabulary to assert a property of today's control flow, and if that property
 * ever stopped holding the honest token would be the one that had been deleted.
 */
export type EdgeStrengthProposalOutcome = EdgeStrengthCommitOutcome | 'refused_unassertable'

export interface ModelEditAuthorityLive {
  goalTargetDispatchAvailable: boolean
  /** The host captures identity without gaining a separate store access path. */
  captureScenarioId: () => string | null
  /** Dispatch only: the central typed-action receipt owns the eventual write. */
  proposeGoalTarget: (draft: string, unit: string, scenarioId: string | null) => 'dispatched' | 'not_encodable'
  proposeFactorValue: (typedValue: number) => FactorValueProposalOutcome
  /**
   * Set the ACTIVE OPTION's target value for one factor.
   *
   * `activeNodeId` is the OPTION; `factorId` names the factor whose value that
   * option would move. Both halves are checked — see the implementation for why
   * an unresolvable `factorId` must fail closed rather than write.
   */
  proposeOptionIntervention: (
    factorId: string,
    value: number,
    opts?: {
      /**
       * Called once when the SENDER settles. Optional so existing call sites are
       * unchanged; a caller that renders a pending state must pass it, or that
       * state has no way to end.
       */
      onSendSettled?: (settlement: OptionInterventionSendSettlement) => void
    },
  ) => OptionInterventionProposalOutcome
  /**
   * Ratify the ACTIVE FACTOR's existing value as correct.
   *
   * ⚠ STAMPS `user_confirmed`, NEVER `user`. See the implementation.
   */
  proposeFactorConfirmation: () => LocalCommitOutcome
  /**
   * Set the ACTIVE EDGE's strength — the `edge_strength_edit` carrier.
   *
   * `edgeId` is passed explicitly, as `model-tab-v2/contracts.ts` §1 declares
   * it, and is CHECKED against the edge this hook was keyed to rather than
   * trusted: a caller holding an authority for a different edge fails closed.
   *
   * ⚠ `directionStated` IS THE CALLER'S CLAIM ABOUT ITS OWN CONTROL and must
   * never be derived from `signedMean`'s sign. See the implementation.
   */
  proposeEdgeStrength: (
    edgeId: string,
    signedMean: number,
    opts: { directionStated: boolean },
  ) => EdgeStrengthProposalOutcome
}

/**
 * The authority for the ELEMENT the active gesture addresses.
 *
 * Hook-parameterised exactly as `useNodeMutations` / `useEdgeMutations` are; pass
 * `null` for a kind no gesture is currently addressing (every proposal against
 * that kind is then `not_encodable`).
 *
 * ⚠ TWO PARAMETERS, NOT ONE POLYMORPHIC ID. A node and an edge are addressed by
 * different identities — a node by its id, an edge canonically by its
 * `(from, to)` pair — and the sanctioned setters for them are different hooks.
 * Collapsing both into one `activeId` would put two questions under one name
 * (trap 21) and would let a node id key an edge mutation without a type error.
 * `activeEdgeId` DEFAULTS to `null`, so every existing node-only call site keeps
 * its exact behaviour and the widening cannot silently arm an edge write.
 */
export function useModelEditAuthority(
  activeNodeId: string | null,
  activeEdgeId: string | null = null,
): ModelEditAuthorityLive {
  const mutations = useNodeMutations(activeNodeId ?? '')
  const edgeMutations = useEdgeMutations(activeEdgeId ?? '')
  const conversation = useOptionalConversationContext()
  const sendSystemEvent = conversation?.sendSystemEvent
  const dispatchAction = conversation?.dispatchAction

  const proposeGoalTarget = useCallback((draft: string, unit: string, scenarioId: string | null) => {
    const state = useCanvasStore.getState()
    const node = state.nodes.find(n => n.id === activeNodeId)
    if (!node || resolveNodeTypeLiteral(node) !== 'goal' || !dispatchAction ||
        !scenarioId || state.currentScenarioId !== scenarioId) return 'not_encodable' as const
    const parameters = buildManualGoalTarget(node.id, draft, unit)
    if (!parameters) return 'not_encodable' as const
    // Do not echo the draft into the store or claim saved on promise resolution.
    // Typed add_constraint uses CEE's existing validated proposal/commit path;
    // central response application owns both acceptance and refusal.
    void Promise.resolve(dispatchAction({
      action_type: 'add_constraint', parameters, source: 'inspector',
      label: `Set minimum target: ${parameters.value} ${parameters.unit}`,
      message: manualGoalTargetMessage(parameters.value, parameters.unit),
    })).catch(() => { /* The conversation's existing failure channel owns this. */ })
    return 'dispatched' as const
  }, [activeNodeId, dispatchAction])

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
    (
      factorId: string,
      value: number,
      opts?: { onSendSettled?: (settlement: OptionInterventionSendSettlement) => void },
    ): OptionInterventionProposalOutcome => {
      if (!activeNodeId) return 'not_encodable'
      const state = useCanvasStore.getState()
      const option = state.nodes.find(n => n.id === activeNodeId)
      // An intervention belongs to an OPTION. Writing an `interventions` map
      // onto a factor would be a well-formed store patch that means nothing,
      // and nothing downstream would ever report it.
      if (!option || resolveNodeTypeLiteral(option) !== 'option') return 'not_encodable'
      // The factor must be in the model — see this member's header. The SERVER
      // additionally requires the option to be WIRED to it and refuses
      // otherwise; that is its check to make against its own persisted graph,
      // and duplicating it here would be a second spelling of one rule.
      if (!state.nodes.some(n => n.id === factorId)) return 'not_encodable'

      const built = buildOptionInterventionEditEvent({
        optionId: activeNodeId,
        factorId,
        modelValue: value,
        // ⚠ THE ONE OWNER OF THE BASE HASH, read here rather than captured.
        // Three intent builders already read this field; this is the fourth.
        // It is NULL after a reload — a restore reads persistence with no CEE
        // turn — and the builder refuses on null rather than sending a hash
        // that matches nothing. That refusal must be DISCLOSED by the caller,
        // never silently swallowed.
        baseGraphHash: state.lastServerGraphHash,
      })

      // ⭐⭐ THE ORDER OF THE NEXT THREE LINES IS THE MEANING, NOT THE STYLE.
      //
      // (1) AN UNENCODABLE EDIT IS UNENCODABLE WHATEVER THE BASE IS. The builder
      // asks its input guards before its base-hash guard, so `not_encodable`
      // here is never a stale base wearing the wrong name. This is the half an
      // earlier draft got backwards: it asked the base question first, so a
      // number off the model scale on a restored session was reported as
      // `needs_fresh_base` — sending the user to run a turn that cannot help,
      // after which the same number is refused again with a different sentence.
      //
      // (2) THE CARRIER QUESTION PRECEDES THE FRESHNESS ONE. `needs_fresh_base`
      // promises an action — any turn refreshes the base — and that action
      // exists only where there is a conversation to run it. With none, the
      // honest answer is that the gesture cannot be encoded here at all, and
      // offering a recovery that has nothing to recover through would be the
      // same lie in a friendlier voice.
      if (!built.ok && built.refusal === 'not_encodable') return 'not_encodable'
      if (!sendSystemEvent) return 'not_encodable'
      if (!built.ok) return built.refusal
      const event = built.event

      // ⭐ NO LOCAL WRITE, DELIBERATELY — `proposeGoalTarget`'s discipline on
      // this same surface: "the goal draft never changes the store before a
      // real applied response". The old body wrote through
      // `mutations.setIntervention` because the value had nowhere else to go;
      // it has somewhere now. Writing optimistically here would put a number on
      // screen that the server may refuse, on a surface whose whole premise is
      // that an affordance appears only where the write reaches the server.
      // ⚠ THE PROMISE IS READ NOW, NOT DISCARDED. It used to be `void
      // Promise.resolve(...).catch(...)` — which is right for a fire-and-forget
      // notification and wrong here, because two of the sender's three outcomes
      // mean the turn has NOT happened. Discarding it left a row saying "sent"
      // over an edit that was queued behind another turn, or one that was never
      // queued at all.
      // ⭐⭐ OPTED OUT OF THE SENDER'S HIDDEN QUEUE, AND THAT IS A HONESTY FIX,
      // NOT A PERFORMANCE ONE.
      //
      // With the default, a send made while a turn is in flight is BUFFERED and
      // the promise resolves `SEND_DEFERRED` — *before the turn exists*. There
      // is then no channel back: the buffered turn is sent later, may be
      // refused, and this caller's `onSendSettled` has already fired for the
      // last time. A row that entered "queued" could never leave it, which is
      // the same exitless state this leg exists to remove, hiding in the one
      // path that looked benign.
      //
      // ⚠ AND THE BUFFERED COPY WOULD CARRY A SUPERSEDED BASE. The queue holds
      // `SendTurnOpts` VERBATIM, so the event keeps the `base_graph_hash` read
      // at enqueue — while the very turn it waits behind is what stamps a new
      // one. A deferred effect edit behind a graph-changing turn is refused as
      // stale by construction.
      //
      // `SEND_BLOCKED` instead: the caller keeps the draft, the row says so, and
      // the user presses Save again against a base that is actually current.
      // Same reasoning, same option, as `usePanelApplyDrain` — "opting out of
      // the singleton sender's hidden queue means SEND_BLOCKED is returned while
      // a turn is busy, so there can never be a queued copy plus a later retry".
      void Promise.resolve(sendSystemEvent(event, { deferIfBusy: false }))
        .then(outcome => {
          if (outcome === SEND_DEFERRED) return opts?.onSendSettled?.('queued')
          if (outcome === SEND_BLOCKED) return opts?.onSendSettled?.('blocked')
          return opts?.onSendSettled?.('sent')
        })
        .catch((err: unknown) => {
          // ⚠ THE REJECTION IS READ, NOT ASSUMED. This reported `blocked` for
          // every rejection on the reasoning that "a rejected send is a POST
          // that failed" — true of a transport error and FALSE of everything
          // else that lands here. `sendSystemEvent` rejects for BOTH, and the
          // error it rejects with already distinguishes them: `kind` separates
          // "nothing reached the server" from "the server received the turn and
          // failed it", and `conflictCategory` is carried precisely because
          // 'server' is too coarse to decide what a surface may claim.
          //
          // ⭐ AND THE NO-WRITE QUESTION IS ASKED BY THE ONE AUTHORITY THAT OWNS
          // IT. `isProvenNoWriteConflict` is where this estate keeps "did the
          // producer state it wrote nothing?", derived per category from the
          // producer's own line. Re-deriving it here — from the status code,
          // from `retryable: false`, or from what a category name suggests —
          // is the twins defect that module was written to end, and its header
          // names `INGRESS_CONTRACT_VIOLATION` as the exact trap.
          if (err instanceof SystemEventSendError) {
            if (err.kind === 'server') {
              return opts?.onSendSettled?.(
                isProvenNoWriteConflict(err.conflictCategory) ? 'refused' : 'unverified',
              )
            }
            // ⚠ TRANSPORT DOES NOT PROVE NON-DELIVERY, EITHER HALF. `v5Adapter`
            // catches any fetch rejection without observing whether the server
            // accepted, and `responseRouter` derives `network` from a MISSING
            // `http_status` — so a commit whose response is lost before headers
            // reach the browser is indistinguishable from being offline. The
            // uncertainty is retained rather than resolved by the absence of a
            // bit nobody derived.
            return opts?.onSendSettled?.('unverified')
          }
          // A rejection shape this seam does not recognise. It cannot prove
          // non-delivery, so it must not claim it: the cannot-confirm line, not
          // the confident one. The conversation's own failure channel still
          // records the error; this only decides what the ROW says.
          opts?.onSendSettled?.('unverified')
        })
      return 'dispatched'
    },
    [activeNodeId, sendSystemEvent],
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
    // ⚠ THE REFUSAL IS `factorHasConfirmableValue`, NOT A COPY OF IT. This read
    // its own `observedState.value` finiteness inline, and FOUR surfaces
    // separately guessed at the same condition to decide whether to OFFER the
    // control — in three different spellings, two of them wrong on a reachable
    // class. The gate and the refusal are now the same function, so a surface
    // cannot offer what this will decline.
    if (!factorHasConfirmableValue(node.data)) return 'not_encodable'

    mutations.setObservedSource('user_confirmed')
    return 'committed'
  }, [activeNodeId, mutations])

  /**
   * ⭐⭐ `directionStated` → `preserveDirection`, AND THE MAPPING IS EXACT RATHER
   * THAN A JUDGEMENT CALL. The two documents describe one behaviour in one
   * vocabulary, so there is nothing here to choose between:
   *
   *   contracts.ts §1 `proposeEdgeStrength`: *"When nothing states a direction,
   *   the magnitude is written alone and the direction and its stamp are left
   *   untouched."*
   *   `useEdgeMutations.setStrength`: *"`opts.preserveDirection` writes the
   *   MAGNITUDE ONLY and leaves the edge's `direction` exactly as it is —
   *   including ABSENT"*, and *"Under `preserveDirection` neither key is written
   *   — a magnitude edit must not mint a direction claim"* (ROADMAP 2.263).
   *
   * "the magnitude written alone, direction and stamp untouched" IS
   * `preserveDirection: true`, sentence for sentence. So:
   *
   *     preserveDirection === !directionStated
   *
   * and the same flag reaches the wire as `direction_intent: 'preserve'`, so the
   * local write and the event cannot describe different gestures.
   *
   * ⚠ AND THE PROHIBITION THE CONTRACT ACTUALLY STATES: `directionStated` may not
   * be inferred FROM `signedMean`'s SIGN — *"a MAGNITUDE CANNOT CARRY A SIGN"*.
   * `-0 >= 0` is `true`, so zeroing a negative edge through a sign-derived write
   * flips it to positive; and an ABSENT direction has no sign to read at all.
   * That is why the flag is a parameter and not arithmetic. It is the CALLER's
   * statement about ITS OWN control — the Model tab v2 answers it from
   * `resolveEdgeDirectionDisplay`, the same resolver that decides whether its row
   * reads "positive effect" or "direction not stated", so the control's meaning
   * and the label above it cannot disagree.
   *
   * ⭐ WHY THERE IS A REFUSAL IN FRONT OF THE SANCTIONED SETTER, when the
   * factor path has none of this shape. `setStrength` writes locally even when
   * the wire cannot carry the edit — correct for the inspector's slider, and
   * WRONG here: this hook feeds a surface that offers the affordance only where
   * the write reaches the server, and a local write behind a server-looking
   * control is design §2 F6 exactly. So an edit the builder will not build is
   * refused BEFORE the setter runs, and the model is left untouched.
   *
   * ⚠ THE REFUSAL ASKS THE BUILDER, IT DOES NOT RE-STATE THE BUILDER'S RULES.
   * `buildEdgeStrengthEditEvent` is called with the SAME arguments the setter is
   * about to pass it, over the same synchronous store read; there is no second
   * copy of the endpoint-id rule, the `[0, 1]` magnitude bound or the
   * server-stated-`expected` requirement to drift out of sync (trap 12). It is
   * pure, so calling it twice costs a computation and changes nothing — the
   * setter's own call is the one whose event is sent.
   */
  const proposeEdgeStrength = useCallback(
    (
      edgeId: string,
      signedMean: number,
      opts: { directionStated: boolean },
    ): EdgeStrengthProposalOutcome => {
      // The hook is keyed to ONE edge. An id that is not that edge is a caller
      // holding the wrong authority — fail closed rather than write the edge it
      // happens to be keyed to, which would be an edit to an element the user
      // was not looking at.
      if (activeEdgeId === null || edgeId !== activeEdgeId) return 'not_encodable'
      if (typeof signedMean !== 'number' || !Number.isFinite(signedMean)) return 'not_encodable'

      const edge = useCanvasStore.getState().edges.find(e => e.id === edgeId)
      if (!edge) return 'not_encodable'

      const preserveDirection = !opts.directionStated
      if (!buildEdgeStrengthEditEvent({ edge, requestedMean: signedMean, preserveDirection })) {
        return 'refused_unassertable'
      }

      return edgeMutations.setStrength(signedMean, { preserveDirection })
    },
    [activeEdgeId, edgeMutations],
  )

  return {
    goalTargetDispatchAvailable: typeof dispatchAction === 'function',
    captureScenarioId: () => useCanvasStore.getState().currentScenarioId ?? null,
    proposeGoalTarget,
    proposeFactorValue,
    proposeOptionIntervention,
    proposeFactorConfirmation,
    proposeEdgeStrength,
  }
}
