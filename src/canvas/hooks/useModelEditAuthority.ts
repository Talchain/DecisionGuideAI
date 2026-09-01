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

import { useCallback, useSyncExternalStore } from 'react'
import { useCanvasStore } from '../store'
import {
  beginModelEditAttempt,
  getModelEditAttempt,
  getModelEditCompletionVersion,
  markModelEditUnresolved,
  modelEditAttemptsForNode,
  subscribeModelEditCompletion,
  type ModelEditAttempt,
  type ModelEditAttemptId,
} from './modelEditCompletion'
import { resolveNodeTypeLiteral } from '../domain/nodes'
import { factorHasConfirmableValue } from '../domain/valueProvenance'
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
 * What ONE proposal returns — the dispatch outcome PLUS its correlation token.
 *
 * ⚠ THE OUTCOME IS NOT THE COMPLETION, and keeping them in one object is how
 * that stays visible. `outcome: 'dispatched'` says the wire event left this
 * seam; it says NOTHING about whether the model took the number. The completion
 * is read from `completionFor(attemptId)` and settles later — see
 * `modelEditCompletion.ts` for why a receipt alone can never mean "committed".
 *
 * `attemptId` is `null` exactly when nothing was dispatched (`not_encodable`),
 * because there is no attempt to correlate to.
 */
export interface FactorValueProposal {
  readonly outcome: FactorValueProposalOutcome
  readonly attemptId: ModelEditAttemptId | null
}

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
  proposeFactorValue: (typedValue: number) => FactorValueProposal
  /**
   * The retained completion for one attempt, or `null` if the ledger has never
   * heard of it.
   *
   * ⚠⚠ THIS INTERFACE HAS NO CONSUMER YET, AND #1033 IS NOT ONE. An earlier
   * version of this comment said "THIS IS THE INTERFACE #1033 CONSUMES". That
   * was false, and falsely reassuring: it is the sentence that made the two PRs
   * look composed when they are not.
   *
   * Derived at #1033's head `5af774a9`, with a contrast control so the zeros are
   * absence and not a blind probe: `completionFor` **0**, `attemptsForNode`
   * **0**, `latestAttemptForNode` **0**, `modelEditCompletion` **0**,
   * `ModelEditAttemptId` **0** — against contrasts in the same sweep that fire,
   * `EditProposalHandle` 2, `EditCommitState` 3, `useModelEditAuthority` 3.
   * #1033 instead holds its unconfirmed rows in a COMPONENT-SCOPED
   * `useState<ReadonlyMap<string, EditCommitState>>` in `ModelTabV2Panel`,
   * keyed by row id and destroyed on unmount — which is precisely the event
   * this ledger exists to survive, and which `attemptsForNode` below was built
   * to recover from. #1033's own plan text says so in as many words:
   * *"`EditProposalHandle` is an existing documented shape with no live
   * implementation; exposing and wiring it is still work for the shared owner."*
   *
   * ⭐ SO WHICH OF THE TWO IS RIGHT? The INTERFACE is — it is the durable answer
   * to a problem #1033 currently solves non-durably — but the CLAIM was
   * premature, and the adoption it asserts is real, unstarted work: map
   * `EditCommitState` onto `completionFor` (correlated) with `attemptsForNode`
   * as the post-remount recovery read, and delete the local map. Until that
   * lands this interface has **zero production consumers**: every call site of
   * `proposeFactorValue` discards the proposal, including
   * `ModelTabV2Panel.tsx:390` on the proven Model-tab path.
   *
   * ⚠ MERGE ORDER FOLLOWS FROM THAT, and it is not "either order". This is not
   * inert while unconsumed: `CanvasMVP` mounts `useModelEditCanonicalConfirm`
   * unconditionally and real `proposeFactorValue` calls feed it, so every
   * receipted edit spends 1–8 `POST /bff/cee/scenarios/{id}/graph` reads for
   * ZERO rendered output. Merging this alone buys network traffic and no
   * capability. It should land WITH its consumer, not before it.
   *
   * What the interface itself guarantees, and does today: it survives unmount
   * because the ledger is module-scoped — the panel can be destroyed and
   * remounted, or the user can edit another factor and come back, and the
   * attempt's outcome is still here. A component that re-reads this after a
   * remount gets the same answer it would have got before — contract point (4).
   *
   * Correlated BY ATTEMPT ID, never by node or by "the last edit": A's late
   * answer settles A even if the user is now looking at B.
   */
  completionFor: (attemptId: ModelEditAttemptId | null | undefined) => ModelEditAttempt | null
  /**
   * ⭐⭐ THE RECOVERY READ — for when the caller has LOST the attempt id.
   *
   * `completionFor` is the correlated read and stays the primary one. But it is
   * useless across the exact event the ledger was built to survive: the panel
   * holds its attempt ids in `useState`, and a tab switch unmounts the panel
   * and destroys them. Retention in the store with no way to reach it after a
   * remount is not retention — the outcome was retained and unreachable, and
   * #1033 could not render it.
   *
   * So a row that has lost its id recovers by NODE, and gets back the whole
   * attempt INCLUDING its `attemptId`, which re-establishes the correlation
   * from that point on.
   *
   * ⚠ THIS IS NOT THE "LAST EDIT FLAG" THE INTERFACE REFUSES TO BE, and the
   * difference is worth stating because they look alike. A last-edit flag is a
   * single global slot that any outcome overwrites and that cannot say which
   * attempt it describes. This returns a specific, identified attempt scoped to
   * one node in one scenario; every other attempt remains addressable by id,
   * and a late answer for a superseded attempt still settles that attempt
   * alone. Recovery by node is how you FIND an id you dropped, not a
   * replacement for having one.
   *
   * Scoped to the CURRENT scenario, so A→B→A recovers A's state and B never
   * shows A's.
   */
  attemptsForNode: (nodeId: string) => readonly ModelEditAttempt[]
  /** The most recent attempt against `nodeId`, or `null`. Convenience over `attemptsForNode`. */
  latestAttemptForNode: (nodeId: string) => ModelEditAttempt | null
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
    (typedValue: number): FactorValueProposal => {
      const nothingDispatched: FactorValueProposal = {
        outcome: 'not_encodable',
        attemptId: null,
      }
      if (!activeNodeId) return nothingDispatched
      const state = useCanvasStore.getState()
      const node = state.nodes.find(n => n.id === activeNodeId)
      if (!node) return nothingDispatched
      const data = node.data as Record<string, unknown>

      const event = buildFactorValueEditEvent({
        nodeId: activeNodeId,
        typedValue,
        // The node's data as it is BEFORE the local write — its cap/unit is
        // what decides the scale of what the user typed.
        nodeData: data,
      })
      if (!event) return nothingDispatched
      const { value: modelValue, raw_value: rawMagnitude } = event.payload as {
        value: number
        raw_value?: number
      }

      // ⭐ THE ATTEMPT IS MINTED BEFORE THE WRITE, and its id rides to the
      // settle points on the undo snapshot — the carrier that ALREADY survives
      // the deferral buffer, so an immediate dispatch and a deferred flush
      // correlate through one path (see `modelEditCompletion`'s header).
      const attemptId = beginModelEditAttempt({
        nodeId: activeNodeId,
        scenarioId: state.currentScenarioId ?? null,
        attemptedValue: modelValue,
        attemptedRawValue: typeof rawMagnitude === 'number' ? rawMagnitude : null,
      })

      // Undo BEFORE the write, from the same pre-write data.
      const undo = captureOptimisticFactorEdit(activeNodeId, modelValue, data, undefined, attemptId)

      // Local write first, in ONE update: value + raw_value + provenance stamp.
      mutations.setObservedValue(modelValue, rawMagnitude, { source: 'user' })

      if (!sendSystemEvent) {
        // ⚠ `local_only` IS NOT A COMPLETION. Nothing left the browser, so no
        // canonical evidence is ever coming — the honest phase is `unresolved`,
        // never `committed`. A surface that read the local write back as a
        // success would be design §2 F6 exactly.
        markModelEditUnresolved(attemptId, 'No conversation is mounted, so this was never sent.')
        return { outcome: 'local_only', attemptId }
      }
      void Promise.resolve(
        sendSystemEvent(event, undo ? { optimisticFactorEdit: undo } : undefined),
      ).catch(() => {
        // Swallowed deliberately — a genuine send failure is recorded by the
        // conversation's own failure channel, and a server REFUSAL is not a
        // failure: the dispatcher's central revert handles it. Identical to the
        // reference surface's catch, for the identical reason.
      })
      return { outcome: 'dispatched', attemptId }
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

  // Subscribe to the ledger so a settled outcome re-renders the consumer. The
  // snapshot is a version counter, not the Map — see `getModelEditCompletionVersion`.
  useSyncExternalStore(
    subscribeModelEditCompletion,
    getModelEditCompletionVersion,
    getModelEditCompletionVersion,
  )
  const completionFor = useCallback(
    (attemptId: ModelEditAttemptId | null | undefined) => getModelEditAttempt(attemptId),
    [],
  )
  // ⚠ THE SCENARIO IS READ AT CALL TIME, not captured in the closure: a row
  // recovering after a tab switch must be scoped to the scenario that is live
  // NOW, or A→B would hand B the attempts made against A.
  const attemptsForNode = useCallback(
    (nodeId: string) =>
      modelEditAttemptsForNode(nodeId, useCanvasStore.getState().currentScenarioId ?? null),
    [],
  )
  const latestAttemptForNode = useCallback(
    (nodeId: string) => {
      const all = attemptsForNode(nodeId)
      return all.length === 0 ? null : all[all.length - 1]
    },
    [attemptsForNode],
  )

  return {
    proposeFactorValue,
    proposeOptionIntervention,
    proposeFactorConfirmation,
    completionFor,
    attemptsForNode,
    latestAttemptForNode,
  }
}
