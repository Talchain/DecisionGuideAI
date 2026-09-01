/**
 * structuralRename — the UI half of the DURABLE label write (schemas 0.50.0).
 *
 * THE DEFECT THIS CLOSES. A rename the user typed on the canvas reached CEE
 * only as the debounced `direct_graph_edit` NOTIFICATION, which CEE classifies
 * `'ack_and_commit'`: a turn row and NO graph write. CEE's own dispatch table
 * names the harm in terms — "the user's new factor survives exactly until the
 * next reload and then silently vanishes — a lie told by omission". The UI
 * therefore had no rename at all: `InspectorRouter` passed no `onLabelChange`,
 * so `EditableLabel` rendered a bare `<span>` and the canvas double-click that
 * arms `requestNodeRename` landed in an editor that could never open.
 *
 * ⚠ THIS IS THE RE-ENABLEMENT OF A DELIBERATELY REVERTED CAPABILITY, not a new
 * one. UI #1025 reverted #1024 for exactly one stated reason — "a node-label
 * edit has no wire carrier and a server rehydrate silently discarded the user's
 * rename" (`nodes/DecisionNode.tsx:519-530`). That premise held at 0.48.0 and is
 * false at 0.50.0: CEE staging `a705319f` classifies `structural_rename`
 * `'mutating'` and ships `system-events/structural-rename.ts`. The carrier now
 * exists, so the reason for the revert is spent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ TWO GATES, AND THEY GET DIFFERENT ANSWERS — the single most important
 * fact about this event, derived at CEE's writer rather than assumed by
 * symmetry with `structural_delete`.
 *
 *   · `base_graph_hash` — the ANALYSIS-AFFECTING hash (`aag_v1`, 16 hex).
 *     Divergence → HTTP 409 `GRAPH_DIVERGED`, nothing appended. Handled by the
 *     estate's existing `isProvenNoWriteConflict` set, which already holds
 *     `BASE_HASH_DIVERGED`. Nothing new is needed for this arm.
 *
 *   · `expected_label` — the LABEL-SPACE gate, and it is NOT redundant with the
 *     hash. `label` is absent from `projectNode`'s keep-list in CEE's
 *     `context/graph-hash.ts`, so two users renaming the same node concurrently
 *     move NO hash: `base_graph_hash` alone would let the second rename silently
 *     clobber the first, on the one field the stale gate is structurally blind
 *     to. The contract states the obligation directly — "CEE MUST compare
 *     `expected_label` against the persisted label and refuse on mismatch".
 *
 * ⚠⚠ AND THE MISMATCH IS **NOT A 409**. CEE returns a COMMITTED 200 refusal
 * naming the current label, and its writer gives the derived reason: the 409
 * envelope's only recovery payload is `expected_base_graph_hash`, which on a
 * label-only divergence is UNCHANGED — the server would answer "refresh and
 * reconfirm" while handing back the exact value the client already holds, and a
 * client comparing the two would conclude nothing moved and resend the same
 * rename. An affordance terminating in refusal with no exit.
 *
 * So a UI that only watched `conflict_category` would treat the concurrent-
 * rename case as a SUCCESS and leave the user's label on the canvas over a model
 * that never took it. That is why the receipt below reads the COMMITTED BYTES
 * rather than the status code.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHICH HASH — the same three-way trap `structuralDelete.ts` documents, and the
 * answer is the same one: `OlumiResponse.graph_hash`, CEE's `aag_v1` 16-hex
 * ANALYSIS-AFFECTING hash, echoed from the last turn and never computed here.
 * The UI's own `canvas/utils/graphHash.ts` is a DIFFERENT algorithm and the
 * `identity.v1` envelope has no wire emitter at all.
 *
 * ⚠⚠ THE FORMER "KNOWN GAP" IS CLOSED, AND THIS PARAGRAPH USED TO SAY THE
 * OPPOSITE — it is corrected here rather than left to rot, because a false claim
 * in the header of the module that implements the behaviour is the estate's
 * dominant defect, not a cosmetic one.
 *
 * It read: "This module records NO intent and reports the reason, rather than
 * fabricating a hash. The rename still applies locally — it simply claims no
 * durability it cannot deliver." The second half was always true and still is.
 * The FIRST half described the P0: recording no intent while the store applied
 * the visible label anyway meant the first rename after a restore looked saved
 * and vanished on the next reload — the carrier existed, and the gesture was
 * dropped before reaching it.
 *
 * What is true now: with no CEE hash seen this session there is still no base to
 * assert, and the contract still forbids absent/null/empty — so nothing is
 * fabricated. But the gesture is HELD rather than dropped. The intent is recorded
 * with `baseGraphHash: null`, {@link resolveStructuralRenameBase} stamps the real
 * hash the moment a turn supplies one, and the wire builder accepts only a
 * resolved intent so a null base is unrepresentable rather than merely forbidden.
 * The user is told meanwhile — the queue is memory-only, so a reload before that
 * turn does still lose the rename, and the copy says so.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐ THE REVERT RESTORES **TWO** FIELDS, AND THE SECOND ONE IS THE ONE A
 * ONE-DIRECTION CORPUS WOULD MISS.
 *
 * `store.updateNodeLabel` does not only write `label`: on a GOAL node it also
 * stamps `provenance: 'user_set'` through `provenanceAfterHumanAuthoredLabel`,
 * which is what clears the "From your brief" pill. A revert that put back only
 * the label would leave a refused rename having permanently cleared that pill —
 * the model says the goal is still the brief's extract, and the canvas says the
 * user authored it. So the intent captures the previous provenance AND whether
 * the key was PRESENT AT ALL, because "absent" and "present with value
 * undefined" are different bytes and only one of them is what the field means.
 *
 * ⚠ AND `provenanceAfterHumanAuthoredLabel` IS NOT RE-DERIVED HERE. That module
 * is scoped to `goal` on purpose and its header states why: on a factor,
 * `data.provenance` answers a DIFFERENT question — who owns the VALUE — so
 * stamping `user_set` there would credit the user with a number Olumi
 * estimated. This module never writes provenance; it only records what to put
 * back, so the two questions cannot be collapsed here by accident.
 */

import type { SystemEventTurnPayload } from '@talchain/schemas/boundary'
import type { Node } from '@xyflow/react'

/**
 * The wire event — DERIVED from the union member, never hand-rolled.
 *
 * Same reason `structuralDelete.ts` gives: extracting it from
 * `SystemEventTurnPayload` cannot drift, because a contract change to the shape
 * changes this type with it. A hand-written interface would go stale silently
 * and every member of this union is `.strict()` inside a `discriminatedUnion`,
 * so one wrong field loses the WHOLE TURN at ingress (422), not just the field.
 */
export type StructuralRenameWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'structural_rename' }
>

/**
 * The contract's own label bounds, DERIVED from the producer rather than
 * re-typed. `NodeV3Schema.shape.label` is `min(1).max(200)`; the UI's own
 * `NODE_LABEL_MAX_LENGTH` is 100, i.e. strictly inside it. Both are checked —
 * the UI's cap is what the input enforces, and the contract's is what ingress
 * enforces, and a value that clears one but not the other is exactly the shape
 * that becomes a 422 on a turn the user thought succeeded.
 */
export const WIRE_LABEL_MIN_LENGTH = 1
export const WIRE_LABEL_MAX_LENGTH = 200

/** Why a rename gesture produced no wire intent. Never a silent drop. */
export type StructuralRenameStandDownReason =
  /** The mutation came from a producer (patch-apply, hydration), not a user. */
  | 'external_mutation'
  /** The node is not on the canvas, so there is nothing to name on the wire. */
  | 'node_not_found'
  /** `label === expected_label`. The contract's own refinement refuses this. */
  | 'no_change'
  /** The node id or either label fails a bound the contract enforces at ingress. */
  | 'unusable_for_wire'

/**
 * One user rename gesture, captured against the PRE-rename node.
 *
 * `restore` holds the previous label AND the previous provenance verbatim, so a
 * refusal can put the node back exactly as the server still holds it. See the
 * header for why the provenance half is load-bearing rather than tidy.
 */
export interface StructuralRenameIntent {
  /** Correlates the send with its capture; also the dedupe key for the queue. */
  readonly id: string
  /** Canonical node id, as CEE holds it. */
  readonly nodeId: string
  /** The new label the user typed. */
  readonly label: string
  /** The label last read from the canonical persisted node — the concurrency assertion. */
  readonly expectedLabel: string
  /**
   * The CEE-stamped `aag_v1` hash of the graph the user was looking at, or
   * `null` when NO turn had stamped one yet — the restored-graph case.
   *
   * ⚠⚠ NULL IS "NOT YET", NOT "NEVER", AND THAT DISTINCTION IS THE P0 THIS
   * FIELD'S NULLABILITY EXISTS TO CLOSE. A restore leaves `lastServerGraphHash`
   * null (a reload builds a fresh store; a scenario switch nulls it through
   * `DECISION_CONTEXT_CLEAR`), and neither hydration nor the UI can supply a
   * real one: the scenario-graph read returns only the `identity.v1` envelope,
   * and `boundary/graph-hash-contract` publishes a field VOCABULARY while
   * stating that it "does NOT implement a hashing function". The only genuine
   * `base_graph_hash` in existence arrives on a turn response via
   * `applyV5State`. So the intent is HELD with a null base and stamped at drain
   * time by {@link resolveStructuralRenameBase}, rather than dropped — which is
   * what left the first rename after a restore looking saved and then gone.
   *
   * ⚠ A null base NEVER reaches the wire: {@link buildStructuralRenameWirePayload}
   * accepts only a {@link ResolvedStructuralRenameIntent}, so "approximate" is
   * not expressible rather than merely discouraged.
   */
  readonly baseGraphHash: string | null
  /** Exactly what to put back if the server declines. */
  readonly restore: {
    readonly label: string
    /** Present only when the key existed before the rename — see the header. */
    readonly provenance?: unknown
    /** `false` means the key was ABSENT, which a `provenance: undefined` cannot express. */
    readonly provenanceWasPresent: boolean
  }
}

/**
 * An intent whose base hash is in hand. The ONLY shape the wire builder accepts,
 * so a deferred intent cannot be sent by forgetting to check a boolean.
 */
export type ResolvedStructuralRenameIntent = StructuralRenameIntent & {
  readonly baseGraphHash: string
}

export type CaptureStructuralRenameResult =
  | {
      readonly ok: true
      readonly intent: StructuralRenameIntent
      /**
       * True when the intent is queued WITHOUT a base hash and is waiting for a
       * turn to stamp one. The caller owes the user a disclosure in this state:
       * the label is on the canvas, the model does not hold it yet, and a reload
       * before the next turn loses it.
       */
      readonly deferred: boolean
    }
  | { readonly ok: false; readonly reason: StructuralRenameStandDownReason }

/**
 * Stamp the CURRENT base hash onto an intent, or refuse.
 *
 * ⭐ WHY DRAIN-TIME AND NOT CAPTURE-TIME, for the deferred case: at capture there
 * was no hash to read, so the choice is between the freshest real one and none
 * at all. It is safe precisely because `base_graph_hash` is NOT this event's
 * concurrency gate — `label` sits outside `projectNode`'s keep-list, so a rename
 * moves no analysis hash and two concurrent renames diverge no hash at all. The
 * gate that protects a rename is `expected_label`, and THAT is still the one
 * captured against the graph the user was looking at. Stamping a fresher base
 * asserts nothing the user did not see; inventing an `expected_label` would.
 *
 * Returns `null` rather than a partial intent: a rename we cannot express
 * correctly must not be expressed approximately.
 */
export function resolveStructuralRenameBase(
  intent: StructuralRenameIntent,
  currentBaseGraphHash: string | null,
): ResolvedStructuralRenameIntent | null {
  // An intent captured WITH a hash keeps its own — it asserts the graph that
  // gesture was made against, which is strictly better evidence than "now".
  if (typeof intent.baseGraphHash === 'string' && intent.baseGraphHash.length > 0) {
    return intent as ResolvedStructuralRenameIntent
  }
  if (typeof currentBaseGraphHash !== 'string' || currentBaseGraphHash.length === 0) return null
  return { ...intent, baseGraphHash: currentBaseGraphHash }
}

/**
 * What the user is told when a rename is captured but cannot be sent YET.
 *
 * ⚠⚠ THIS SENTENCE IS THE DIFFERENCE BETWEEN THIS LANE AND THE ONE THAT WAS
 * REVERTED. UI #1025 was reverted for shipping a control that HID the loss. The
 * failure mode here is real and reachable — the queue is memory-only, so a
 * reload before the next turn does lose the rename — and the copy names it
 * rather than implying a durability the product has not earned. It also names
 * the thing that COMPLETES the write, which is any message at all, because that
 * is what stamps a `graph_hash` (`applyV5State`). No affordance terminating in
 * refusal: the action named is the action that works.
 */
export const STRUCTURAL_RENAME_DEFERRED_NOTICE =
  "Renamed on the canvas. It isn't saved to the model yet — I'll save it with your next message. If you reload before then, the model will still hold the old name."

/**
 * ⭐⭐ WHAT A USER IS TOLD WHEN THE RENAME'S TURN WAS INTERRUPTED — the review P1.
 *
 * `useConversation`'s catch block gates the whole optimistic resolution on
 * `!isAbort`, and its ABORT ARM handles `factor_value_edit` ONLY — in terms:
 * "Its twin `structural_delete` is deliberately NOT handled here … Naming it
 * rather than silently widening the fix." `structural_rename` sits in that same
 * unhandled position, and every V5 dispatch runs `abortRef.current?.abort()`
 * before installing its own controller. So renaming a node and then asking Olumi
 * anything cancels the rename's turn, and NEITHER arm runs: no revert, no
 * confirmation, no sentence, and nothing in state to say an attempt was made.
 * The response arm is fenced again on `activeV5TurnIdRef.current === turnClientId`,
 * which discards a superseded turn just as quietly.
 *
 * ⚠ IT MUST NOT REVERT, for the same reason the value-edit arm must not: the
 * cancel was CLIENT-side, CEE may well have taken the rename, and there are no
 * committed bytes either way. Discarding the user's typing on that guess is the
 * data-loss direction of the same harm. `unconfirmed` is a legitimate TERMINAL
 * state — "we sent it and never heard" — and the honest move is to say so.
 *
 * Deliberately a TOAST rather than a chat message: the settle happens in the
 * drain, which outlives the React instance that started the send, so the
 * conversation's `addMessage` may belong to an unmounted tree.
 */
export const STRUCTURAL_RENAME_UNCONFIRMED_TOAST =
  "That rename was interrupted before the model answered, so I can't tell you whether it saved. It's on the canvas — reload this decision to see what the model actually holds."

/**
 * Where one rename gesture has got to. THREE outcomes, never two, and
 * `unconfirmed` is a terminal state rather than a polite word for success.
 *
 * ⚠ THE RECORD LIVES IN THE STORE, not in a closure owned by whichever
 * component happened to be mounted when the user typed. That is the entire
 * point: a panel close, a route change or a remount must not be able to destroy
 * the only evidence that an attempt was made.
 */
export type StructuralRenameLifecycleStatus =
  /** Sent; the server has not answered (or its answer has not been read). */
  | 'in_flight'
  /** The server's committed bytes carry this id at this label. */
  | 'committed'
  /** The server declined — a 409, or a committed 200 holding a different label. */
  | 'refused'
  /** We sent it and never heard. NOT a success, and never rendered as one. */
  | 'unconfirmed'

export interface StructuralRenameLifecycleRecord {
  readonly intent: StructuralRenameIntent
  /**
   * The scenario this attempt was made against, captured at DISPATCH. A verdict
   * about another decision is not ours to keep — the record is dropped on a
   * decision-context change, exactly like the queue it came from.
   */
  readonly scenarioId: string | null
  readonly status: StructuralRenameLifecycleStatus
}

/** Everything except `in_flight` — the states a settle may write. */
export type StructuralRenameTerminalStatus = Exclude<
  StructuralRenameLifecycleStatus,
  'in_flight'
>

/**
 * How many records to keep. The drain is SERIALISED (one gesture at a time), so
 * at most one record is ever `in_flight` and a plain "keep the newest N" cannot
 * evict a live attempt.
 */
export const STRUCTURAL_RENAME_LIFECYCLE_LIMIT = 20

export interface CaptureStructuralRenameInput {
  /** Nodes as they were BEFORE the rename was applied. */
  readonly nodesBefore: readonly Node[]
  readonly nodeId: string
  /** The new label, already trimmed by the caller's own cap. */
  readonly label: string
  /** The last CEE-stamped `graph_hash`, or null when none has been seen. */
  readonly baseGraphHash: string | null
  /** `_externalMutationActive > 0` — a producer write, not a user gesture. */
  readonly externalMutationActive: boolean
  /** Injected so the capture is deterministic under test. */
  readonly makeId: () => string
}

/**
 * The endpoint-id constraints `CanonicalEdgeEndpointIdSchema` enforces, applied
 * BEFORE the wire so a malformed local id becomes a stand-down rather than a 422
 * that rejects the whole turn.
 *
 * DERIVED FROM THE PRODUCER'S SCHEMA, not from what our ids happen to look like.
 * Deliberately the same predicate `structuralDelete.ts` exports and for the same
 * reason: `structural_rename.node_id` uses `CanonicalEdgeEndpointIdSchema`, not
 * `NodeV3Schema.shape.id` — the contract's own note says narrowing an
 * EXISTING-id field to the lowercase node-id regex "would refuse live nodes".
 */
export function isWireUsableNodeId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id === id.trim() &&
    !id.includes('→') &&
    !id.includes('->')
  )
}

/** Does this label clear the bound the CONTRACT enforces at ingress? */
export function isWireUsableLabel(label: unknown): label is string {
  return (
    typeof label === 'string' &&
    label.length >= WIRE_LABEL_MIN_LENGTH &&
    label.length <= WIRE_LABEL_MAX_LENGTH
  )
}

/**
 * Capture one gesture. Returns a stand-down reason rather than a partial intent:
 * a rename we cannot express correctly must not be expressed approximately.
 */
export function captureStructuralRename(
  input: CaptureStructuralRenameInput,
): CaptureStructuralRenameResult {
  if (input.externalMutationActive) return { ok: false, reason: 'external_mutation' }

  // ⚠ A MISSING BASE HASH IS NO LONGER A STAND-DOWN — it is a DEFERRAL, and the
  // ordering below matters: every OTHER refusal still applies to a deferred
  // gesture. A no-op, a vanished node or a wire-unusable label is just as wrong
  // held in a queue as it is on the wire, so those checks run regardless.
  const rawBase = input.baseGraphHash
  const baseGraphHash = typeof rawBase === 'string' && rawBase.length > 0 ? rawBase : null

  // BOUND BY IDENTITY — the node id, never a label predicate another node could
  // satisfy. Two nodes may legitimately share a label; only one has this id.
  const node = input.nodesBefore.find((n) => n.id === input.nodeId)
  if (!node) return { ok: false, reason: 'node_not_found' }

  const data = (node.data ?? {}) as Record<string, unknown>
  const rawPrevious = data.label
  const expectedLabel = typeof rawPrevious === 'string' ? rawPrevious : ''

  // The contract's own cross-field refinement: "a structural_rename to the label
  // it already has is a no-op". Refused HERE so it never costs a turn.
  if (input.label === expectedLabel) return { ok: false, reason: 'no_change' }

  if (
    !isWireUsableNodeId(input.nodeId) ||
    !isWireUsableLabel(input.label) ||
    !isWireUsableLabel(expectedLabel)
  ) {
    return { ok: false, reason: 'unusable_for_wire' }
  }

  const provenanceWasPresent = Object.prototype.hasOwnProperty.call(data, 'provenance')

  return {
    ok: true,
    deferred: baseGraphHash === null,
    intent: {
      id: input.makeId(),
      nodeId: input.nodeId,
      label: input.label,
      expectedLabel,
      baseGraphHash,
      restore: {
        label: expectedLabel,
        provenanceWasPresent,
        ...(provenanceWasPresent ? { provenance: data.provenance } : {}),
      },
    },
  }
}

/**
 * The wire payload for one captured intent.
 *
 * Field names are the CONTRACT's, not the intent's — `expected_label` rather
 * than `expectedLabel` — and the mapping lives in exactly one place so a
 * rename of the internal shape cannot silently change what goes on the wire.
 *
 * ⚠ ACCEPTS ONLY A RESOLVED INTENT. `base_graph_hash` is a REQUIRED `z.ZodString`
 * on a `.strict()` union member, so a deferred intent would build a payload that
 * fails ingress — or, worse, one carrying `null` where CEE expects an assertion.
 * Requiring the resolved type makes that unrepresentable rather than merely
 * forbidden: the only route here is through {@link resolveStructuralRenameBase}.
 */
export function buildStructuralRenameWirePayload(
  intent: ResolvedStructuralRenameIntent,
): Record<string, unknown> {
  return {
    node_id: intent.nodeId,
    label: intent.label,
    expected_label: intent.expectedLabel,
    base_graph_hash: intent.baseGraphHash,
  }
}

/** What the SERVER's committed bytes say about this rename. Three states, never two. */
export type StructuralRenameReceipt =
  /** The committed graph carries THIS id at THIS label. The rename is a fact. */
  | 'proven'
  /** The committed graph carries THIS id at a DIFFERENT label — someone else won, or CEE refused. */
  | 'refuted'
  /** No readable committed graph arrived. We know nothing; do not invent a verdict. */
  | 'unproven'

/**
 * Did the server's own committed bytes take this rename?
 *
 * ⭐⭐ THIS IS WHY THE STATUS CODE IS NOT ENOUGH. The `expected_label` mismatch —
 * the concurrent-rename case this whole event exists to catch — arrives as a
 * COMMITTED 200 (see the header). A UI keyed on `conflict_category` alone would
 * read it as a success and leave the user's label standing over a model that
 * holds someone else's. CEE's refusal path passes the PERSISTED graph through
 * `commitDirectAnswer(..., { contentGraph })`, so the graph that comes back on
 * that arm carries the OTHER label — which is a positive, readable refutation
 * rather than a silence.
 *
 * BOUND BY IDENTITY: this intent's exact node id. Another node having taken this
 * label is not evidence about ours, and a label predicate is precisely the shape
 * a same-labelled sibling satisfies.
 */
export function readStructuralRenameReceipt(
  intent: StructuralRenameIntent,
  response: unknown,
): StructuralRenameReceipt {
  const draftGraph = (response as { draft_graph?: unknown } | null | undefined)?.draft_graph
  if (!draftGraph || typeof draftGraph !== 'object') return 'unproven'

  const rawNodes = (draftGraph as { nodes?: unknown }).nodes
  if (!Array.isArray(rawNodes)) return 'unproven'

  const match = rawNodes.find(
    (n) => (n as { id?: unknown } | null)?.id === intent.nodeId,
  ) as { label?: unknown } | undefined
  // The node being ABSENT is not a refutation of a rename — it is a different
  // event entirely (a concurrent delete), and asserting "your rename failed"
  // there would be a claim these bytes do not support.
  if (match === undefined) return 'unproven'
  if (typeof match.label !== 'string') return 'unproven'

  return match.label === intent.label ? 'proven' : 'refuted'
}

/**
 * What the user is told when a rename does not land.
 *
 * ⚠ THERE IS NO `expected_label` NOTICE HERE, AND ITS ABSENCE IS A DECISION.
 * That outcome arrives as a COMMITTED 200 whose own assistant text already names
 * the current label — "That's called 'X' in the saved model now, not 'Y' —
 * someone renamed it while you were working." The system-turn 200 branch renders
 * that prose. Adding a notice beside it would put TWO VOICES on one outcome, and
 * ours would be the vaguer of the two: CEE's names the label the model actually
 * holds, which is the only datum that makes the user's next move bounded. The
 * canvas is still corrected — the revert runs on the refuted receipt — but the
 * SENTENCE is CEE's, because CEE is the one that knows the name.
 *
 * The keys below are exactly the outcomes where CEE says nothing at all.
 */
export const STRUCTURAL_RENAME_NOTICE = {
  /**
   * 409 `GRAPH_DIVERGED` / `BASE_HASH_DIVERGED`. CEE guarantees it wrote
   * nothing, so the previous name is back.
   *
   * ⚠ THE ACTION NAMED HERE IS THE ONE THAT ACTUALLY REFRESHES THE BASE, and it
   * is inherited from `STRUCTURAL_DELETE_NOTICE.base_hash_diverged` rather than
   * re-reasoned: "try again" re-sends the SAME `base_graph_hash` and refuses
   * identically forever, and "reload, then rename again" builds a fresh store
   * with `lastServerGraphHash` null, so the next rename stands down silently.
   * What DOES refresh it is a turn — `applyV5State` captures the top-level
   * `graph_hash` off every response — so the copy asks for the one thing that
   * works, in-session, with no reload.
   */
  base_hash_diverged:
    "The saved model changed while you were renaming that, so the new name wasn't saved — I've put the old one back rather than show you a name the model doesn't hold. Ask me anything about this decision and I'll re-sync with the saved model, then rename it again.",
  /**
   * The turn reached the server and failed, or came back with no readable
   * committed graph. We hold no bytes, so we know neither that it landed nor
   * that it did not. "Couldn't confirm" is the only claim the evidence supports —
   * and the name is LEFT ALONE, because reverting on a guess is as ungrounded as
   * keeping it, and it would discard the user's typing.
   */
  unconfirmed_server:
    "I couldn't confirm that new name reached the saved model. It's on the canvas, but it may revert when you reload — reload this decision to see what the model actually holds.",
  /**
   * Nothing reached the server. Same epistemic position, different cause; the
   * copy avoids blaming the model for a network failure.
   */
  unconfirmed_transport:
    "That rename didn't reach the server, so the saved model may still hold the old name. It's changed on the canvas — reload this decision to see what the model actually holds.",
} as const

export type StructuralRenameNoticeKey = keyof typeof STRUCTURAL_RENAME_NOTICE

/** What a revert did — reported, never assumed. */
export type StructuralRenameRevertOutcome =
  /** The previous label (and provenance) are back. */
  | 'restored'
  /** Nothing to do: the node already holds the previous label. */
  | 'already_previous'
  /** The node no longer holds the label WE sent — newer truth; do not overwrite it. */
  | 'stood_down'

export interface RevertStructuralRenameStore {
  readonly nodes: readonly Node[]
  readonly currentScenarioId?: string | null
  applyStructuralRenameRevert: (restore: {
    nodeId: string
    label: string
    provenance?: unknown
    provenanceWasPresent: boolean
  }) => void
}

/**
 * Put back the label the server refused to take.
 *
 * STAND-DOWN DISCIPLINE, copied from `revertStructuralDelete` and
 * `revertOptimisticFactorEdit` for the same reason: a late revert must not
 * overwrite newer truth. It writes only when the node STILL HOLDS THE LABEL THIS
 * INTENT SENT — if the user has renamed again, or a server graph has landed, the
 * canvas is describing something this gesture never saw, and restoring would be
 * a silent overwrite dressed as a correction.
 */
export function revertStructuralRename(
  intent: StructuralRenameIntent,
  store: RevertStructuralRenameStore,
  capturedScenarioId: string | null,
): StructuralRenameRevertOutcome {
  if ((store.currentScenarioId ?? null) !== capturedScenarioId) return 'stood_down'

  const node = store.nodes.find((n) => n.id === intent.nodeId)
  if (!node) return 'stood_down'

  const currentLabel = (node.data as { label?: unknown } | undefined)?.label
  if (currentLabel === intent.restore.label) return 'already_previous'
  if (currentLabel !== intent.label) return 'stood_down'

  store.applyStructuralRenameRevert({
    nodeId: intent.nodeId,
    label: intent.restore.label,
    provenanceWasPresent: intent.restore.provenanceWasPresent,
    ...(intent.restore.provenanceWasPresent ? { provenance: intent.restore.provenance } : {}),
  })
  return 'restored'
}
