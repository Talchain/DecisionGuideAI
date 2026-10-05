/**
 * The provisional read leg's STORE VIEW, and its option-identity containment check — moved verbatim out of
 * `hooks/useProvisionalAnalysisDelivery.ts` (which re-exports both, unchanged) so that non-React callers — the boot
 * path in `serverGraphHydration.ts` — use the ONE view without importing the hook's `AuthContext` chain.
 *
 * ⚠ KEEP THIS MODULE A LEAF: store + types only. #2308 imported the view from the hook and turned staging red: three
 * conversation specs mock `flags` without `isRequireLoginEnabled`, which `lib/poc.ts` reads at import via AuthContext.
 */
import { useCanvasStore } from '../store'
import type { ScenarioAnalysisApplyStore } from './applyScenarioAnalysisRead'

/**
 * ── OPTION-IDENTITY CONTAINMENT (issue #1204) ─────────────────────────────
 *
 * Are the options CEE's readiness NAMES actually present on the canvas whose
 * ids were snapshotted alongside it?
 *
 * ⚠ THIS IS THE SAME QUESTION `graphAcceptedForCanvas` ALREADY ASKS, measured
 * better — NOT a second concept smuggled under one name (trap 21). The field
 * asks *"is what the user is looking at the graph CEE is talking about?"*;
 * `lastAuthoritativeGraph !== null` is a proxy for it that this module's own
 * header already concedes is necessary-but-not-sufficient. If an option CEE
 * names is not on the canvas, the canvas is PROVABLY not that graph. The
 * precedent is `mergeServerGraph`'s refusal — *"ZERO overlap with a NON-EMPTY
 * canvas means these are two unrelated graphs"* — tightened from overlap to
 * containment, because an analysis that compared even ONE option the user does
 * not have is still an analysis of a different model, and the sentence on
 * screen is "Analysis reflects the current model."
 *
 * ⚠ THE TWO OPERANDS ARE WRITTEN BY ONE `set()` AND COME FROM DIFFERENT
 * SOURCES, which is what makes the comparison mean anything: `setCeeAnalysisReady`
 * stores CEE's payload and snapshots the LOCAL canvas ids in the same reducer
 * (`store.ts`). They therefore cannot skew against each other through later
 * canvas churn — the comparison is fixed at the instant CEE spoke.
 *
 * ⚠⚠ FAILS OPEN ON EVERY ABSENT OR UNUSABLE OPERAND, deliberately. Only
 * POSITIVE evidence of divergence may decline. No readiness, no options, no
 * snapshot, or an option carrying no usable id are all "cannot judge", and
 * inventing a decline there would trade one lie for a broad new gap — the
 * over-fix this seam has been repaired for before. The malformed-option case
 * is a DECISION, pinned by a named test, not an accident: if the product later
 * wants to refuse unidentifiable options, that is the line to change.
 *
 * Exported so the decision is testable directly rather than only through the
 * store, and so a future reader can see the rule instead of inferring it.
 */
export function ceeReadinessOptionsAreOnCanvas(
  // `readonly unknown[]`, deliberately: this validates a WIRE payload, and a
  // narrower element type here would be a claim about the producer that the
  // producer does not honour. Each element is narrowed at the point of use.
  ready: { options?: readonly unknown[] } | null | undefined,
  snapshotNodeIds: readonly string[] | null | undefined,
): boolean {
  if (ready == null) return true
  const options = ready.options
  if (!Array.isArray(options) || options.length === 0) return true
  if (snapshotNodeIds == null || snapshotNodeIds.length === 0) return true
  const onCanvas = new Set(snapshotNodeIds)
  // `every` over the JUDGEABLE options only: an id-less option is skipped
  // (it is not evidence of divergence), a well-formed one is checked.
  return options.every((o) => {
    const id = (o as { id?: unknown } | null | undefined)?.id
    if (typeof id !== 'string' || id.length === 0) return true
    return onCanvas.has(id)
  })
}


export function readProvisionalApplyStore(): ScenarioAnalysisApplyStore {
  const s = useCanvasStore.getState()
  return {
    setAnalysisStateV1: s.setAnalysisStateV1,
    resultsComplete: s.resultsComplete,
    // Named explicitly, like every member here — NOT spread. A drift in this
    // action's signature must RED `tsc` rather than resolve to `undefined` and
    // silently restore the very defect this binding was added to close.
    noteRunCompletedWithoutVerdict: s.noteRunCompletedWithoutVerdict,
    currentResultsHash: s.results?.hash ?? null,
    // B5 on the read leg: the verdicts beside the analysis this leg displays, stamped as the turn leg stamps them.
    setLimitVerdicts: s.setLimitVerdicts,
    // SC-24 on the read leg: the pair's comparison beside the analysis this leg displays, stamped as the turn leg does.
    setRunDelta: s.setRunDelta,
    // C10a: accepted new analyses clear a superseded turn's bound absence reason.
    setRunDeltaAbsence: s.setRunDeltaAbsence,
    currentScenarioId: s.currentScenarioId,
    // ⭐ THE WITHHOLDING THE APPLIER STAMPS AFTER ITS RESULTS WRITE (row 9 served FAIL, 30 Sep: R3's bc9640d4 cold-opened
    // with `leader_claim.permitted: false` and cards reading "best in 49% / 51%"). Absent here, the applier's `?.` call
    // no-op'd; the boot leg's own stamp had run before any report was held. Named explicitly, like every member.
    resultsWithholdLeaderClaim: s.resultsWithholdLeaderClaim,
    // ── Does the canvas on screen derive from a server graph we ACCEPTED? ──
    //
    // Read STRAIGHT FROM THE STORE here rather than threaded down from the
    // hydration path: this leg is structurally blind to acceptance, so it needs
    // the signal either way, and a store read keeps the change inside this file
    // instead of reaching into `serverGraphHydration`'s options.
    //
    // `lastAuthoritativeGraph` — NOT `serverGraphIdentity`. The latter is null
    // BOTH when nothing was accepted AND when an accepted merge carried no CEE
    // token, so it would decline on an honest canvas.
    //
    // ⚠⚠ BUT THIS FIELD IS NOT AN ACCEPTANCE FLAG, AND AN EARLIER VERSION OF
    // THIS COMMENT SAID IT WAS. It claimed acceptance is "defined structurally"
    // so the two "cannot drift apart". That is true of `mergeServerGraph` — the
    // accepted path is exactly the body that records — and FALSE OF THE FIELD,
    // which has THREE recorders and a seed. Derived at the bytes:
    //
    //   ⚠ RE-DERIVED AT `dead382d` WITH A CASE-INSENSITIVE SWEEP, AND THE
    //   CASE-SENSITIVE ONE THAT PRECEDED IT WAS BLIND. The action is
    //   `set**L**astAuthoritativeGraph`; a `grep "lastAuthoritativeGraph"` cannot
    //   see it, and reported a FALSE ZERO in `applyDraftResult.ts` — with a
    //   contrast control that FIRED, which is exactly why it was convincing. Any
    //   sweep for this field must be `grep -i`. Line numbers below are a
    //   hand-maintained mirror and will drift; the NAMES are the durable part.
    //
    //   RECORDERS (non-null) — complete manifest, `grep -rin setlastauthoritative`
    //   plus every direct property-assignment in `store.ts`, contrast control
    //   `setCeeAnalysisReady` = 42 non-test hits in the same run:
    //   `mergeServerGraph.ts:461`    accepted server merge  ← a genuine
    //                                server acceptance
    //   `useImportRegistration.ts`   a `registered` receipt (#1903) — CEE
    //                                stored exactly these elements; the
    //                                other genuine acceptance
    //   `mergeAppliedGraph.ts:606`   applied-edit receipt
    //   `store.ts:5504`              `loadScenario`'s scenario-switch seed,
    //                                property-assignment form. Seeded, never
    //                                nulled — see its own note there.
    //   `store.ts:7404`              `hydrateGraphSlice`'s COLD-LOAD SEED,
    //                                property-assignment form
    //   `applyDraftResult.ts:293`    a fresh DRAFT — and, through
    //                                `loadStarter.ts:216` (`applyStarter`), a
    //                                shipped STARTER TEMPLATE too. ⚠ NOT "the
    //                                local canvas CEE
    //                                has never seen" — an earlier version of this
    //                                comment said that and it is FALSE at the
    //                                bytes: `nodes`/`edges` are mapped from
    //                                `draftData` (`:209`,`:212`) and applied as a
    //                                wholesale replacement, so at the instant of
    //                                recording the canvas IS CEE's own draft. The
    //                                accurate distinction is narrower and still
    //                                decisive: CEE DRAFTED it, but never ACCEPTED
    //                                it as this scenario's authoritative SERVER
    //                                graph. A draft still defeats the guard.
    //
    //   NULLERS (all fail-safe — they can only make the guard MORE cautious):
    //   `store.ts:1934`              DECISION_CONTEXT_CLEAR (scenario reset)
    //   `store.ts:2761`              initial state
    //   `useConversation.ts:464`     nulled, and NOT on un-acceptance
    //
    // **A MERGE REFUSAL DOES NOT CLEAR IT.** So once any recorder has fired,
    // this reads `true` and the guards below do not fire — reachable mid-session
    // via draft → `recoverDraftFromServer` → refused merge → armed run.
    //
    // The field answers "which element identities may the reconciler remove?"
    // (`mergeAppliedGraph.ts:474-477`: fresh draft, prior receipt, OR DB
    // hydration — three sources, which is what I misread as one). This guard
    // asks "does the canvas derive from a server-accepted graph?" Two questions,
    // one name — trap 21, and I wrote the fused version.
    //
    // WHAT IT STILL BUYS: it is a genuine NECESSARY condition. `false` proves
    // divergence, and every case it catches is caught correctly. It is not
    // SUFFICIENT, so the guard is incomplete over its own defect class — pinned
    // as KNOWN-OPEN in
    // `hydrate/__tests__/provisionalDelivery.graphAcceptance.reachability.spec.ts`
    // rather than left to this comment. Closing it needs new state meaning
    // "derives from a server-accepted graph"; that is rowed, not done here.
    //
    // ⚠ AN EMPTY CANVAS IS NOT DIVERGENT. There is no local graph for a verdict
    // to misdescribe, and this is the case the zero-overlap guard itself calls
    // "the whole point of the feature" — it hydrates in full. Treating it as
    // divergent would withhold the verdict on a fresh scenario, which is the
    // over-fix that closes the lie by opening a gap.
    //
    // ⚠⚠ THE SECOND CONJUNCT CLOSES ISSUE #1204, AND THE SCOPE THIS FILE USED
    // TO CARRY WAS WRONG. The recorded scope was "reachable in code, CONDITIONAL
    // ON A REFUSED BOOT, which has not been observed live". NO REFUSED BOOT IS
    // REQUIRED, and the guard was dark for the plainest journey the product has:
    // guest · load one shipped starter · send one brief · first turn.
    //
    // THE MECHANISM, TRACED AT THE BYTES ON THAT JOURNEY:
    //   `StarterDecisions.tsx:111` → `loadStarter.ts:216` (`applyStarter`) →
    //   `applyDraftResult`, which at `:237` installs the starter's nodes and at
    //   `:293` UNCONDITIONALLY records
    //   `setLastAuthoritativeGraph(identityFromCanvasGraph(nodes, edges))` over
    //   those same nodes. `skipAutosave` does not gate it.
    // So one gesture both puts a graph CEE has never accepted on the canvas and
    // satisfies `lastAuthoritativeGraph !== null`: THE ACCEPTANCE PROXY IS
    // SATISFIED BY THE VERY GESTURE THAT CREATES THE HAZARD. No second event,
    // no refusal, no boot state is needed.
    //
    // ⚠ AND AN EARLIER VERSION OF THIS PARAGRAPH GOT THE MECHANISM WRONG, in a
    // way worth keeping because it is this estate's signature defect. It said the
    // record is seeded EMPTY-but-non-null by "creating a scenario", with the
    // starter's nodes landing after. Two errors: (1) that seed is
    // `store.ts:5504`, inside `loadScenario` — not scenario creation; and
    // (2) on the starter path the record is FULL, not empty, because the
    // recorder fires in the same `set()`-adjacent step that installs the nodes
    // ("`nodes`/`edges` are the graph being installed by this very `set`, so the
    // record and the canvas cannot disagree" — `store.ts:5501`). I could
    // construct no ordering yielding an empty record against a populated starter
    // canvas. The empty/full distinction is NOT cosmetic here — `store.ts:5491`
    // says the existence consumers read the difference between `null`, empty and
    // populated — which is why the wrong version is withdrawn rather than left
    // as harmless colour. The conclusion it was offered for is unchanged and now
    // rests on a derivation instead: non-null is non-null either way, and this
    // predicate reads only `!== null`.
    //
    // ⚠ WHAT IS MEASURED vs DERIVED. The harm was WITNESSED on the deployed
    // build (issue #1204). The chain above is DERIVED at the bytes in this repo,
    // not observed in a browser by the author of this comment. An earlier
    // version cited a live-measured field `derivedGraphAccepted`; that name
    // exists nowhere in this repo (contrast control: `graphAcceptedForCanvas`
    // resolves in 8 files in the same sweep), so no reader could reproduce it,
    // and it is withdrawn.
    //
    // STRICTLY STRONGER, NEVER LOOSER: `A'` implies `A`, so this can only ever
    // decline more, never accept something the previous rule refused. That
    // implication is asserted over the truth table in
    // `__tests__/provisionalDelivery.optionIdentityContainment.spec.ts` rather
    // than argued here.
    //
    // ⚠ WHAT THIS CONJUNCT STILL DOES NOT CATCH — stated so no later reader
    // mistakes it for a complete instrument:
    //  1. IT IS ONE-DIRECTIONAL. It checks CEE's options ⊆ the canvas snapshot.
    //     Canvas options CEE's readiness does NOT name still accept, so a
    //     currency claim can stand over an analysis that omits an option the
    //     user has. Same harm class, narrower door; not closed here.
    //  2. `goal_node_id` IS NOT AN OPERAND. A foreign goal with coincidentally
    //     matching option ids passes. (`validateCeeAnalysisReady` checks goal
    //     existence on the RESTORE paths; this conjunct does not.)
    //  3. IT COMPARES AGAINST A SNAPSHOT, NOT THE CURRENT CANVAS.
    //     `ceeAnalysisReadyNodeIds` is fixed at the instant CEE spoke, which is
    //     what makes the comparison skew-free — and also what makes canvas churn
    //     AFTER that instant invisible to it. Pre-existing; this change is
    //     strictly stronger and does not widen it.
    graphAcceptedForCanvas:
      s.nodes.length === 0 ||
      (s.lastAuthoritativeGraph !== null &&
        ceeReadinessOptionsAreOnCanvas(s.ceeAnalysisReady, s.ceeAnalysisReadyNodeIds)),
  }
}
