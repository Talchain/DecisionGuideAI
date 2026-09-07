/**
 * Central product authority for user-visible model mutations.
 *
 * A control may look like a shared-model edit only when it has a
 * receipt-bearing GraphV3 carrier. Keeping this policy independent of any
 * particular editor prevents the Model tab, Inspector and post-run surfaces
 * from inventing different definitions of "saved".
 *
 * ⭐⭐ THE QUESTION THIS TABLE ANSWERS, IN ONE SENTENCE, BECAUSE GETTING IT
 * WRONG NEARLY COST US TWO WORKING FEATURES (26 Aug 2026):
 *
 *     "MAY THIS CONTROL **LOOK LIKE** A SHARED-MODEL EDIT?"
 *
 * It does NOT answer *"may this write happen?"*. Those are two different
 * questions, and this is a PRESENTATION authority: every one of its consumers
 * reads it into a `*_CONNECTED` boolean and uses that to decide what to RENDER
 * — whether to show an affordance, disable it, or show honest copy instead.
 * Not one consumer gates a store write with it.
 *
 * ⚠⚠ SO DO NOT WIRE IT INTO A WRITER. A proposal to make
 * `useModelEditAuthority` consult this table was withdrawn after measurement:
 * it would have used the answer to the first question to gate the second, and
 * turned OFF `proposeOptionIntervention` and `proposeFactorConfirmation`.
 * Both are marked `'disabled'` here — correctly, because neither has a
 * receipt-bearing wire carrier — and BOTH ARE GENUINELY WORKING WRITES:
 * `interventions` and `observedState` are `purposes: ['stale']` in
 * `canvas/domain/analyticalNodeFields.ts`, "persisted by hash-by-default",
 * absent from the three-field ephemeral denylist, and read by
 * `hasAnalyticalNodeChange` (live in `store.ts`, `analyticalChange.ts`,
 * `graphChangeDiff.ts`, `applyPatch.ts`). They persist, survive reload and are
 * analysis-affecting. Disabling them would have removed the only way to say
 * what an option does and the only way to confirm a factor value.
 *
 * `'disabled'` here therefore means *"this control must not present itself as
 * a saved shared-model edit"* — never *"this write is fake"*. When a key has
 * no consumer, that is UNENFORCED POLICY, not dead policy; the two need
 * opposite treatments, so check which one you are looking at before deleting.
 *
 * ⭐ A DIFFERENT AUTHORITY GOVERNS THE INSPECTOR. Whether the Inspector's
 * controls are reachable at all is decided structurally by
 * `InspectorRouter`'s unconditional `<fieldset disabled>`, not by this table
 * or by any manifest — see `ui/inspector-v2/useInspectorMutations.ts`.
 */
export type MutationAuthority =
  | 'server_graph'
  | 'server_fact'
  | 'local_presentation'
  | 'disabled'

export const CANONICAL_EDIT_AUTHORITY = {
  modelFactorValue: 'server_graph',
  modelGoalMinimumTarget: 'server_graph',
  structuralDeleteWithServerHash: 'server_graph',
  // schemas 0.50.0 — the canvas/inspector rename. `server_graph` because it has
  // exactly what that value requires and nothing weaker: a receipt-bearing
  // GraphV3 carrier (`structural_rename`), a server-side write to
  // `scenarios.graph`, and a committed `edit_graph` fact. ⚠ CONDITIONAL ON THE
  // HASH, like its delete sibling and by the same mechanism: with no
  // CEE-stamped `graph_hash` seen this session the capture stands down and the
  // rename is local-only — the key names that precondition rather than implying
  // the write is unconditional.
  canvasNodeRenameWithServerHash: 'server_graph',
  // schemas 0.50.0 — the canvas/palette/context-menu node add. `server_graph`
  // because it has exactly what that value requires and nothing weaker: a
  // receipt-bearing GraphV3 carrier (`structural_add`), a server-side write to
  // `scenarios.graph`, and a committed `edit_graph` fact. ⚠ CONDITIONAL ON THE
  // HASH like its two siblings, and by the same mechanism — with no CEE-stamped
  // `graph_hash` seen this session the gesture is DEFERRED rather than dropped,
  // and the user is told the model does not hold it yet. The key names that
  // precondition rather than implying the write is unconditional.
  canvasNodeAddWithServerHash: 'server_graph',
  priorRangeJudgement: 'disabled',
  canvasSelectionAndLayout: 'local_presentation',
  modelOptionIntervention: 'server_graph',
  modelFactorConfirmation: 'disabled',
  postRunFactorValue: 'disabled',
  postRunFactorConfirmation: 'disabled',
  postRunAutoFix: 'disabled',
  preAnalysisFactorValue: 'disabled',
  preAnalysisFactorConfirmation: 'disabled',
  preAnalysisEdgeStrength: 'disabled',
  preAnalysisV3FactorValue: 'server_graph',
  preAnalysisV3FactorConfirmation: 'disabled',
  // schemas 0.50.0 — FLIPPED FROM `'disabled'`, and the flip is what lights up a
  // COMPLETE, ALREADY-TESTED affordance that has been dark since it was written.
  // `YourDecisionSection` renders its inline "Add option" / "Add risk" rows only
  // when this key has server-graph authority; with the key `'disabled'` users
  // got a fallback "ask Olumi" link instead. The rows were never wrong — they
  // were missing a durable carrier, exactly as the rename lane found its
  // `EditableLabel`. `structural_add` supplies it.
  preAnalysisV3StructuralAdd: 'server_graph',
  analysisAssumedEdgeStrength: 'disabled',
  // ⚠ DELIBERATELY **NOT** FLIPPED by the 2026-09-07 edge-strength emitter lane,
  // and the reasoning is recorded here so the next lane does not re-open the
  // question or, worse, flip it for the wrong surface.
  //
  // That lane wired `useEdgeMutations.setStrength` to emit `edge_strength_edit`,
  // so an edge-strength edit now genuinely reaches a CEE writer. The tempting
  // conclusion is that this key should become `'server_graph'`. It should not,
  // for two derived reasons and one structural one:
  //
  //  1. THIS KEY NAMES A DIFFERENT SURFACE. Its `entrySurfaces` is
  //     `['canvas edge label']` and its `requiredEvidence` is "double-click
  //     opens read-only details and writes no edge data" — a claim about the
  //     LABEL, which still writes nothing. The emitter sits in the panel that
  //     double-click opens, which is a separate surface with its own authority.
  //     Flipping this key would license the label to present ITSELF as a saved
  //     shared-model edit, which the lane did not make true (trap 21: write down
  //     the question each authority answers before reconciling them).
  //  2. ⚠⚠ THIS REASON HAS EXPIRED — KEPT, STRUCK, AND NOT QUIETLY DELETED.
  //     It read: "THE PANEL IS INERT ANYWAY. `InspectorRouter` wraps every
  //     panel, `EdgePanel` included, in an UNCONDITIONAL `<fieldset disabled>`.
  //     The user-reachable strength editor today is the Model tab's weight chip
  //     (`model-tab/RelationshipsSection.tsx`), not the inspector's slider."
  //     That was true when written and is FALSE now: the edge branch hands the
  //     panel its own authority, and the inspector's strength control is
  //     operable on any edge whose strength the server has stated. A reason
  //     that has stopped holding is struck where the next reader will see it,
  //     because a deleted one leaves a conclusion standing on evidence nobody
  //     can check.
  //     ⭐ THE CONCLUSION IS UNCHANGED, and that is the point of writing three
  //     reasons rather than one: 1 and 3 are untouched, and either alone is
  //     sufficient. This key names the canvas edge LABEL, which still writes
  //     nothing, and no code reads this key.
  //  3. THIS TABLE HAS NO CODE CONSUMER FOR THIS KEY. Swept 2026-09-07: outside
  //     its own definition, `canvasEdgeStrength` appears only in
  //     `__tests__/mutationAuthority.spec.ts` (contrast control:
  //     `canvasNodeAddWithServerHash` has 4 references and a live consumer). Per
  //     this file's own header that is UNENFORCED POLICY, not dead policy — so
  //     flipping it would change no behaviour while asserting something false.
  //
  // What the emitter reports instead is `EdgeStrengthCommitOutcome`
  // (`ui/inspector-v2/useInspectorMutations.ts`), which names the four states a
  // strength commit can land in. A returned token the seam actually produces is
  // a stronger honesty mechanism than a presentation row nothing reads.
  canvasEdgeStrength: 'disabled',
  canvasFactorConfirmation: 'disabled',
  goalSuccessTarget: 'disabled',
  canvasSemanticMutations: 'disabled',
  inspectorSemanticControls: 'disabled',
} as const satisfies Record<string, MutationAuthority>

export const SHARED_MODEL_AUTHORITY_COPY =
  'Change this through the Model tab or ask Olumi so the shared model stays in sync.'

/**
 * The sentence for a canvas gesture that changes the model's STRUCTURE —
 * adding, removing, rewiring or duplicating an element.
 *
 * ⚠⚠ DELIBERATELY NOT `SHARED_MODEL_AUTHORITY_COPY`, AND THE REASON IS
 * MEASURED, NOT STYLISTIC. That constant names TWO destinations, and only one
 * of them is true for a structural edit:
 *
 *   · "the Model tab" — FALSE here. `ModelTabV2Panel.tsx:235` builds
 *     `editConnectedIds` as `nodeKind(node) === 'factor'` and nothing else,
 *     under its own comment "the rows whose edit has a canonical transaction
 *     at this tip: factors". A sweep of `model-tab-v2/` for structural
 *     add/delete controls returns ZERO against a firing contrast control
 *     (`editConnectedIds`, 16 hits) — so the sweep can see that directory, and
 *     what it sees is a surface that edits factor VALUES and cannot add,
 *     remove or rewire anything.
 *   · "ask Olumi" — TRUE. `structural_add` is a real receipt-bearing carrier
 *     (`canvasNodeAddWithServerHash`, `preAnalysisV3StructuralAdd`, both
 *     `'server_graph'`), and `YourDecisionSection` renders live add rows on it.
 *
 * So `SHARED_MODEL_AUTHORITY_COPY` stays correct where it already ships — the
 * factor-value surfaces, which is exactly the scope `sectionWriterNotice.ts`
 * calls "correct on the canvas" — and structural gestures get this sentence
 * instead. A plausible-but-wrong destination is worse than no reason at all:
 * it sends the user to a tab that cannot do the thing, and they learn the
 * product lies rather than that it is constrained.
 *
 * ⚠ IT DOES NOT PROMISE A CANVAS CONTROL. It names the writer that exists, in
 * the same voice as the rest of the estate, and stops there.
 */
export const CANVAS_STRUCTURAL_EDIT_NOTICE =
  "The canvas can't save this to the shared model — ask Olumi to make the change."

/** The short form for an inline menu row, where the full sentence will not fit. */
export const CANVAS_STRUCTURAL_EDIT_SHORT_REASON = 'ask Olumi'

export function hasServerGraphAuthority(authority: MutationAuthority): boolean {
  return authority === 'server_graph'
}
