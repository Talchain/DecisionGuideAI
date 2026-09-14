/**
 * Model tab v2 — the contracts this surface needs from OTHER lanes.
 * TYPE DECLARATIONS ONLY. No implementations, no runtime values.
 *
 * ⚠ MOUNT-TRAIN STATUS (16 Aug 2026, edge strength added 8 Sep 2026): the
 * surface is now mounted, and the subset of §1 with a live canonical carrier is
 * served by `src/canvas/hooks/useModelEditAuthority.ts` (factor values, and edge
 * strength where the server has stated one; prior range and edge adjudication
 * remain reachable through their existing sanctioned seams).
 * The RECEIPT-bearing handle below (`EditProposalHandle`, `applied` only from
 * a receipt) is still the target API and still unimplemented — the authority
 * hook documents why it must not be faked from an echo.
 *
 * This file exists so the two owning lanes have a concrete shape to bind to
 * instead of a paragraph in a design document:
 *   · the WRITE AUTHORITY (Codex's transactional-edit vertical) — §1 below;
 *   · the DOCK / panel-fronting mechanism (PX-A) — §2 below.
 *
 * ⚠ THIS LANE BUILDS NEITHER. Nothing here may be implemented in this
 * directory. A local implementation of §1 would be exactly the "new local
 * writer" the design forbids, and it is how the estate previously ended up
 * with the same edit committed through three different paths with three
 * different provenance stamps.
 *
 * Full rationale: `docs/Design/MODEL-EDITOR-V2.md` §9.
 * (Capital D. `docs/design/` does not exist — it resolves on a case-insensitive
 * macOS filesystem and would break a Linux CI checkout.)
 */

import type { EditCommitState } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — From the write authority (Codex)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The outcome of one proposed edit, as the ROW must render it.
 *
 * ⚠ THE ROW READS THIS; IT DOES NOT DECIDE IT. `state.phase === 'applied'` is
 * reachable only because the authority said so. See `EditCommitState`'s header
 * for why that matters: today an edge-strength edit and a factor-value edit
 * look identical on screen while only one of them reaches the server.
 */
export interface EditProposalHandle {
  state: EditCommitState
  /**
   * Present once the authority has answered. Carries whatever the receipt
   * establishes about the applied value — the row must not re-derive it from
   * the number it sent.
   */
  receipt?: { appliedValue: string; provenanceLiteral: string }
  /**
   * User-facing prose on refusal, never a code or a field path. The estate
   * already has a sanitiser for this class of text
   * (`ModelAdjustments.sanitiseDetail`) — reuse it rather than writing a second.
   */
  error?: string
}

/**
 * The named operations the v2 editor dispatches. Nothing here writes; each is a
 * request to the authority that owns the write.
 *
 * STATUS AT DERIVATION (UI staging `a3c71513`) — the reason this list is split
 * three ways rather than presented as one clean interface:
 *
 *   ALREADY SERVER-AUTHORITATIVE (reuse as-is, do not re-plumb):
 *     · proposeFactorValue      → `factor_value_edit`   (with optimistic revert)
 *     · proposePriorRange       → `prior_range_edit`    (carry-only: CEE
 *                                  persists a typed fact and writes no graph)
 *     · resolveContestedEdge    → `edge_adjudication`
 *
 *   IMPLEMENTED 2026-09-08, GATED PER EDGE (was "LANDED 2026-09-07", which
 *   described the EMITTER only — this surface still had no entry point to it,
 *   and that half is what changed):
 *     · proposeEdgeStrength     → `edge_strength_edit`
 *       The emitter lives at the seam every strength editor shares,
 *       `useEdgeMutations.setStrength`, and builds through
 *       `canvas/conversation/edgeStrengthEdit.ts`. THIS surface reaches it
 *       through `useModelEditAuthority.proposeEdgeStrength`, which returns
 *       `EdgeStrengthProposalOutcome` rather than the receipt-bearing handle
 *       below, for the reason that hook's header gives for every other member.
 *       ⚠⚠ ITS AFFORDANCE IS GATED PER EDGE, NOT PER SURFACE, and that is the
 *       load-bearing part of the implementation. `expected` asserts what the
 *       SERVER holds, so an edge the server never stated a strength for has
 *       nothing truthful to put there: the builder refuses, the edit would land
 *       LOCAL-ONLY, and offering the editor anyway would be design §2 F6. Those
 *       rows render their value with NO control at all — NOT "the disabled
 *       affordance", which this line used to claim and which does not exist:
 *       `ModelRowView`'s no-writer arm is a bare `<span>`, by the NOT SET WALL
 *       ruling, and the reason is carried section-level or not at all
 *       (`aRowWithNoWriterSaysNothing.spec.tsx` measures both arms and pins the
 *       relationships gap). `editConnectedIds` asks
 *       `edgeStrengthEditIsAssertable`, which puts the question to the builder
 *       rather than restating its rules.
 *       ⚠ NOT "with optimistic revert" — see the SERVER-AUTHORITATIVE group
 *       above, which earns that clause and this does not. There is no revert on
 *       refusal yet, and CEE's refusal for this kind is a POSITIVE, typed
 *       signal (`FEATURE_NOT_ENABLED` / `edge_strength_edit_reader_only`)
 *       rather than the absence-based rule `factor_value_edit` has to infer
 *       from, so the revert is buildable — it is simply not built.
 *
 * ─── FROM `staging` (kept in full — a DIFFERENT claim, not a rival one) ───
 *   ⚠⚠ DO NOT RE-DERIVE "`proposeEdgeStrength` HAS NO ENTRY POINT HERE" FROM
 *   EITHER HEADER THAT STILL CONTAINS IT. There are TWO, and both keep the
 *   sentence inside a `~~struck~~` block whose marker sits in the PRECEDING
 *   paragraph rather than beside the quote:
 *     · `useModelEditAuthority.ts` — "THE PARAGRAPH BELOW WAS TRUE AND IS NOW
 *       FALSE" (2026-09-08), kept so its reasoning is not re-derived
 *     · `ModelTabV2Panel.tsx` — "TRUE UNTIL 2026-09-08 AND IS NARROWED, NOT
 *       DELETED", whose struck text still reads "edge strength ... ha[s] no
 *       authority entry point, so `editConnectedIds` keeps their affordances
 *       disabled"
 *   Started at the quote rather than at the paragraph above it, both read as
 *   current — and one has already been copied into THIS file once as new text.
 *   The code settles it. In `ModelTabV2Panel`: the authority is constructed
 *   `useModelEditAuthority(activeAuthorityNodeId, editingRelationshipId)`, so an
 *   edge is addressed by a SEPARATE parameter and trap 21 is answered rather
 *   than ignored; a relationship row commits through
 *   `authority.proposeEdgeStrength(...)`; and `editConnectedIds` adds `edge.id`
 *   for every edge `edgeStrengthEditIsAssertable` accepts. The gate is neither
 *   factor-only nor node-id-only.
 *   ⚠ AND DO NOT BYPASS IT by calling `useEdgeMutations(edgeId).setStrength`
 *   direct. That setter is sanctioned and owns the emitter — but the REFUSAL
 *   `proposeEdgeStrength` puts in front of it is the whole implementation:
 *   without it an edit the builder cannot assert lands LOCAL-ONLY while the row
 *   reads as saved. Separately, and it is a DIFFERENT harm, that setter
 *   hard-codes `weightSource: 'user'` (`useInspectorMutations.ts`), so it is
 *   also the wrong route for a PRODUCER-stated value — `ModelTabBody.tsx`'s
 *   `accepted_pass2` note has the reasoning.
 *
 * ─── THIS CHANGE: the edge DIRECTION carrier ───
 *   IMPLEMENTED 2026-09-08 AT THE SEAM:
 *   ⚠ "GATED PER EDGE" REMOVED HERE, 9 Sep (review): the per-edge gate
 *   `edgeDirectionEditIsAssertable` is correct and tested, but it has no
 *   product CONSUMER yet — so describing the shipped affordance as gated per
 *   edge asserts a behaviour no user meets. The gate is real; its consumer is
 *   not built. Restore the phrase when a caller asks it.
 *     · setDirection            → `edge_strength_edit` (`direction_intent`)
 *       ⚠ NAMED CORRECTLY, 9 Sep (review): the writer that reaches the wire is
 *       `useInspectorMutations.setDirection`. `proposeEdgeDirection` is a
 *       CONTRACT method on this interface with no such carrier — naming it here
 *       claimed a wire for the wrong symbol, which is the two-names-one-concept
 *       defect this file exists to prevent.
 *       ⛔ THAT 9 Sep CORRECTION ALSO SAID "AND IT STAYS IN THE LOCAL-ONLY
 *       LIST". CORRECTED 10 Sep 2026 (independent review): IT IS NOT IN THAT
 *       LIST — the list below names four members and `proposeEdgeDirection` is
 *       not one of them, having been removed by the very diff that wrote the
 *       sentence. One file, three answers about one symbol, is exactly the
 *       failure this section guards against.
 *       ⛔⛔ AND IT IS NOT LOCAL-ONLY EITHER: IT HAS NO IMPLEMENTATION AT ALL.
 *       Repo-wide, `proposeEdgeDirection` has THREE occurrences and not one is
 *       a body — this comment, `ModelTabV2Panel.tsx:702`, and the bare
 *       declaration below. Contrast control from the same sweep, so this is a
 *       real absence rather than a blind probe: `proposeEdgeStrength` returns
 *       an implementation (`useModelEditAuthority.ts:710`), an export (`:743`)
 *       and a live call site (`ModelTabV2Panel.tsx:725`). It typechecks only
 *       because `useModelEditAuthority` returns `ModelEditAuthorityLive`, so TS
 *       never checks this interface against anything. CALLING IT DOES NOTHING.
 *       ⚠⚠ IT NEEDED NO NEW EVENT KIND, AND THE LIST ABOVE SAID OTHERWISE FOR
 *       LONGER THAN IT SHOULD HAVE. Derived at `@talchain/schemas` 0.54.0 — the
 *       version BOTH repos pin (UI `package.json:116`, CEE `package.json:97`;
 *       this said 0.50.0 until 10 Sep 2026, a pin the staging merge in this very
 *       head had already moved — the conclusion was re-derived at 0.54.0 and
 *       HOLDS, only the number was stale) — `edge_strength_edit` carries
 *       `direction_intent: 'preserve' | 'positive' | 'negative'` as a field of
 *       its own ("Direction is carried separately so a strength change cannot
 *       reverse an edge accidentally"), and CEE's `resolveEdgeStrengthTarget`
 *       resolves `effectDirection` from it before routing the write through the
 *       canonical `adjust_edge_strength` handler. So the carrier had been
 *       deployed since 0.42.0 and the direction control was reaching it with
 *       NOTHING: `useInspectorMutations.setDirection` did one local `updateEdge`,
 *       stamped `directionSource: 'user'`, and the claim vanished on reload.
 *       The emitter is `buildEdgeDirectionEditEvent`, which DELEGATES to the
 *       strength builder rather than assembling a second payload, and the
 *       affordance gate is `edgeDirectionEditIsAssertable` — asked of that
 *       builder, never a copy of its rules.
 *       ⚠ Reader-first was ALREADY SATISFIED rather than newly incurred: no new
 *       union member, so no `.strict()` discriminator an older CEE could reject.
 *
 *   NOT ALL LOCAL-ONLY — DERIVED PER MEMBER, 10 Sep 2026:
 *
 *   ⛔ THE FOUR-MEMBER "LOCAL-ONLY TODAY" LIST THAT STOOD HERE WAS WRONG ON
 *   THREE OF ITS FOUR MEMBERS, and the sentence under it was wrong about all
 *   three. Kept rather than deleted so it is not re-derived. It read:
 *   *"LOCAL-ONLY TODAY — the gap this design depends on closing: ·
 *   proposeEdgeLikelihood, proposeOptionIntervention, proposeGoalTarget,
 *   proposeFactorConfirmation — These currently terminate in the client store
 *   and reach CEE only as the debounced, VALUE-LESS `direct_graph_edit` ping.
 *   ⚠ UNLIKE DIRECTION ABOVE, EACH OF THESE GENUINELY NEEDS A NEW EVENT KIND —
 *   an olumi-schemas release, a CEE re-vendor and a sequenced two-service
 *   deploy. Checked at 0.50.0's `SystemEventKind`, whose sixteen members carry
 *   no field any of the four could ride."*
 *
 *   ⚠ THAT IS TRUE OF EXACTLY ONE OF THE FOUR. Re-derived member by member from
 *   THIS INTERFACE (enumerated from the type, never from a grep) against each
 *   body in `useModelEditAuthority.ts`, and against the vendored
 *   `@talchain/schemas` 0.54.0 — the version BOTH repos pin now (UI
 *   `package.json:116`, CEE `package.json:97`):
 *
 *     · proposeFactorConfirmation — LOCAL-ONLY, AND IT DOES STILL NEED A
 *       CARRIER. `useModelEditAuthority.ts:647-709`: it calls
 *       `mutations.setObservedSource('user_confirmed')` and returns
 *       `'committed'`, with no dispatch. Queue B depends on it. THE ORIGINAL
 *       SENTENCE IS TRUE OF THIS MEMBER AND ONLY THIS MEMBER.
 *     · proposeOptionIntervention — NOT LOCAL-ONLY. It DISPATCHES the typed
 *       `option_intervention_edit`, and that IS a `SystemEventKind` member at
 *       0.54.0. Implementation `useModelEditAuthority.ts:486-646`, builder
 *       `canvas/conversation/optionInterventionEdit.ts`, payload arm
 *       `v5/buildPayload.ts:456`, live call site `ModelTabV2Panel.tsx:839`
 *       which reads the outcome. It writes NOTHING locally, deliberately. So
 *       Queue A's wire dependency is SATISFIED, not outstanding.
 *     · proposeGoalTarget — NOT LOCAL-ONLY, AND IT NEEDED NO NEW EVENT KIND.
 *       `useModelEditAuthority.ts:413-429` dispatches a typed `add_constraint`
 *       through CEE's existing validated proposal/commit path and returns
 *       `'dispatched'`, deliberately without echoing the draft into the store.
 *     · proposeEdgeLikelihood — NOT LOCAL-ONLY EITHER: IT HAS NO
 *       IMPLEMENTATION. Two occurrences repo-wide — this comment and the bare
 *       declaration below. It is the SAME empty-declaration shape as
 *       `proposeEdgeDirection` above, and it carries the same trap: calling it
 *       does nothing, and TS will not say so.
 *
 *   ⚠⚠ AND THE COUNT WAS WRONG, WHICH IS HOW THE CONCLUSION SURVIVED:
 *   `SystemEventKind` has SEVENTEEN members at the pinned 0.54.0, not sixteen,
 *   and the seventeenth is `option_intervention_edit` — i.e. precisely the kind
 *   the old sentence said did not exist. A member count copied forward from a
 *   superseded pin is the hand-maintained mirror this file exists to prevent:
 *   re-derive it from the vendored tarball, never from this paragraph.
 */
export interface ModelEditAuthority {
  /** Existing. Scale is decided from the node's own cap/unit, not by the row. */
  proposeFactorValue(nodeId: string, typedValue: number): Promise<EditProposalHandle>

  /** Existing. Always commits BOTH bounds; fails closed on inverted bounds. */
  proposePriorRange(nodeId: string, min: number, max: number): Promise<EditProposalHandle>

  /**
   * Existing. ⚠ KEEP ITS PROVENANCE DISCIPLINE EXACTLY: accepting the reviewer's
   * estimate must stamp the value `cee`, NOT `user`. Stamping a producer's
   * number as the human's is provenance laundering, and the current
   * implementation refuses it deliberately.
   */
  resolveContestedEdge(
    edgeId: string,
    verdict: 'accepted_pass1' | 'accepted_pass2' | 'overridden' | 'dismissed',
    value?: number,
  ): Promise<EditProposalHandle>

  /**
   * Codex's lane. ⚠ `directionStated` is load-bearing and must not be inferred:
   * a MAGNITUDE CANNOT CARRY A SIGN. When nothing states a direction, the
   * magnitude is written alone and the direction and its stamp are left
   * untouched — the edge keeps reading "direction not stated" rather than being
   * handed a sign taken off a number.
   */
  proposeEdgeStrength(
    edgeId: string,
    signedMean: number,
    opts: { directionStated: boolean },
  ): Promise<EditProposalHandle>

  /**
   * ⛔ DECLARED ONLY — THERE IS NO IMPLEMENTATION. `p` in [0,1].
   * The label here read "NEW — local-only today (`setExistsProbability`)" until
   * 10 Sep 2026; that named a setter and implied a body this interface does not
   * have. `useModelEditAuthority` exposes no `proposeEdgeLikelihood`, so this
   * typechecks against nothing and CALLING IT DOES NOTHING. Implement it (or
   * route through the setter) before any surface asks for it.
   */
  proposeEdgeLikelihood(edgeId: string, p: number): Promise<EditProposalHandle>

  /**
   * ⛔ DECLARED ONLY — THERE IS NO IMPLEMENTATION, AND IT IS NOT THE DIRECTION
   * WRITER. The label here read "NEW — local-only today (`setDirection`)" until
   * 10 Sep 2026. Both halves misled: `setDirection` is NO LONGER local-only —
   * it is the writer that reaches the wire, via `edge_strength_edit`'s
   * `direction_intent` (§1 above) — and this method has no body of its own.
   * `useModelEditAuthority` exposes no `proposeEdgeDirection`; it typechecks
   * only because that hook returns `ModelEditAuthorityLive`, so TS never checks
   * this interface against anything. CALLING IT DOES NOTHING. A surface that
   * wants direction today goes through `useInspectorMutations.setDirection`.
   */
  proposeEdgeDirection(edgeId: string, direction: 'positive' | 'negative'): Promise<EditProposalHandle>

  /** NEW — local-only today (`setIntervention`). Queue A depends on this. */
  proposeOptionIntervention(
    optionId: string,
    factorId: string,
    value: number,
  ): Promise<EditProposalHandle>

  /** NEW — local-only today (`setGoalThresholdAndUpdateNode`). */
  proposeGoalTarget(nodeId: string, raw: number, unit?: string): Promise<EditProposalHandle>

  /**
   * NEW — a local annotation today, and stamped WRONG.
   *
   * ⚠ THIS MUST STAMP `user_confirmed`, NOT `user`. The Model tab's Confirm ✓
   * currently writes `setObservedSource('user')`, which the shared classifier
   * maps to the `edited` class — so the pill reads "User edited" for a gesture
   * that ratified somebody else's number. Pre-analysis writes `user_confirmed`
   * for the identical gesture and gets "Confirmed by you". Same act, two
   * stamps, decided by which surface the user happened to be standing on.
   */
  proposeFactorConfirmation(nodeId: string): Promise<EditProposalHandle>

  /**
   * The batch form the repair queues need.
   *
   * ⚠ NOT A CONVENIENCE. Without it, "Apply all shown" over eight rows is eight
   * turns, eight undo steps and eight analysis invalidations for ONE user
   * gesture. The queues are the design's answer to Paul's two repair cases, so
   * this operation is load-bearing, not an optimisation.
   *
   * Partial success must be reportable per item — a batch that reports one
   * aggregate verdict cannot tell the user which three of eight were refused.
   */
  proposeBatch(
    edits: ReadonlyArray<() => Promise<EditProposalHandle>>,
  ): Promise<readonly EditProposalHandle[]>
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — panel fronting: BUILT, AND ITS TYPES MOVED WITH IT (18 Aug 2026)
// ─────────────────────────────────────────────────────────────────────────────
//
// `PanelFrontingOutcome`, `FrontOlumiPanel` and `HandOffToOlumi` used to be
// declared here, unimplemented, against the day another lane built them. They
// are now implemented in `src/canvas/conversation/olumiHandOff.ts`, and the
// types went with the implementation.
//
// ⚠ THEY HAD TO MOVE, and the reason is a guard doing its job. This directory's
// boundary scan pins `ModelTabBody.tsx` as the ONLY file outside it that may
// reference `model-tab-v2/` at all — one mount path, no second one. An
// implementation living in the conversation layer and importing its interface
// from here made that scan RED, correctly: a type import is a real reference,
// and the alternative — widening the allowlist — would have traded a structural
// guarantee for one import's convenience.
//
// The deeper point, which is why this note stays: a contract declared where it
// is CONSUMED rather than where it is IMPLEMENTED has no owner. It reads as a
// commitment while nothing is bound to it — `HandOffToOlumi` sat here with ZERO
// implementations while all eleven Model-tab send-to-AI controls bypassed it
// entirely. Now the type and the code that satisfies it cannot drift apart,
// because they are the same file.
