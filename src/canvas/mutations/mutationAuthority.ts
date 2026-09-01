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
  // schemas 0.50.0 — the canvas/palette/context-menu node creation.
  // `server_graph` because it has exactly what that value requires: a
  // receipt-bearing GraphV3 carrier (`structural_add`), a server-side write to
  // `scenarios.graph`, and a committed `edit_graph` fact. ⚠ CONDITIONAL ON THE
  // HASH, like both siblings and by the same mechanism: with no CEE-stamped
  // `graph_hash` seen this session the capture stands down and the creation is
  // local-only — the key names that precondition rather than implying the write
  // is unconditional.
  //
  // ⛔ IT DOES **NOT** COVER `addNodeWithEdge`. That action creates an edge too,
  // and `structural_add_edge` is `'reader_only_refusal'` at CEE — no writer. A
  // key claiming server authority for it would be false about the half that
  // still vanishes. Named apart deliberately (trap 21).
  canvasNodeAddWithServerHash: 'server_graph',
  priorRangeJudgement: 'disabled',
  canvasSelectionAndLayout: 'local_presentation',
  modelOptionIntervention: 'disabled',
  modelFactorConfirmation: 'disabled',
  postRunFactorValue: 'disabled',
  postRunFactorConfirmation: 'disabled',
  postRunAutoFix: 'disabled',
  preAnalysisFactorValue: 'disabled',
  preAnalysisFactorConfirmation: 'disabled',
  preAnalysisEdgeStrength: 'disabled',
  preAnalysisV3FactorValue: 'server_graph',
  preAnalysisV3FactorConfirmation: 'disabled',
  // schemas 0.50.0 — FLIPPED FROM `'disabled'`. This key gates the pre-analysis
  // Model panel's inline "Add option" / "Add risk" rows (`AddRow` in
  // `YourDecisionSection`), a complete and tested affordance that has been dark
  // for exactly one stated reason: a node creation had no receipt-bearing wire
  // carrier, so the control could not honestly present itself as a saved
  // shared-model edit. `structural_add` is that carrier, and the rows route
  // through `store.addNode`, which now captures it. The reason for the
  // disablement is spent.
  preAnalysisV3StructuralAdd: 'server_graph',
  analysisAssumedEdgeStrength: 'disabled',
  canvasEdgeStrength: 'disabled',
  canvasFactorConfirmation: 'disabled',
  goalSuccessTarget: 'disabled',
  canvasSemanticMutations: 'disabled',
  inspectorSemanticControls: 'disabled',
} as const satisfies Record<string, MutationAuthority>

export const SHARED_MODEL_AUTHORITY_COPY =
  'Change this through the Model tab or ask Olumi so the shared model stays in sync.'

export function hasServerGraphAuthority(authority: MutationAuthority): boolean {
  return authority === 'server_graph'
}
