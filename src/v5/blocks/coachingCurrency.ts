/**
 * coachingCurrency — is this coaching card still about the model the user has?
 *
 * ## The defect this exists to close (guarantee theatre)
 *
 * `V5CoachingBlock` has rendered the sentence *"Your model has changed since this
 * was written — it may no longer apply."* since #644, and NO EXECUTION PATH COULD
 * REACH IT. The sentence is keyed on the producer's `freshness`, which CEE stamps
 * at EMISSION time — wire-measured 2026-08-12, `freshness` was `'fresh'` on 13 of
 * 13 coaching blocks across two scenarios — and a rendered transcript block is
 * immutable, so CEE can never re-stamp a card the user is already reading. The
 * user edits the model and keeps acting on advice about a model that no longer
 * exists, with nothing on screen saying so.
 *
 * ## Why the comparison is meaningful — CEE's hash against CEE's hash, only
 *
 * `guidanceStore.ts` §2b states the category error to avoid, and it is this
 * estate's own scar: *"The UI's own `generateGraphHash` is a DIFFERENT algorithm
 * over different inputs … Comparing the two would be the category error."* This
 * module therefore takes TWO CEE-PRODUCED VALUES and nothing else:
 *
 *   - `blockGraphHash`  — the block's `graph_hash_at_generation` (CEE `aag_v1`),
 *     carried verbatim through the parser sidecar by `adaptTypedCoachingBlock`.
 *   - `currentGraphHash` — `analysis_ready.current_graph_hash` (CEE), parsed into
 *     the canvas store by `analysisFreshness.ts`.
 *
 * That the two are the same hash family is MEASURED, not assumed: in both captured
 * staging scenarios the coaching block's `graph_hash_at_generation`, the response's
 * top-level `graph_hash` and `analysis_ready.current_graph_hash` were byte-identical
 * (`0b9ba6ac328d8b50`, then `94eefbc9b712082d`). Evidence:
 * `olumi-docs/PHASE0-EVIDENCE-2026-07-28/coaching-surface-2026-08-12/`.
 *
 * ⚠ THE ONE WAY TO BREAK THIS is to pass a UI-side hash as either argument. The
 * signature cannot prevent it (both are strings), so an EXECUTABLE PAIR pins it:
 * `V5CoachingBlock.currencyDirtyWindow.spec.tsx` §"the current hash is
 * CEE-sourced". The two members pin DIFFERENT things, and it is worth being exact
 * about which, because an earlier draft of this note was not:
 *
 *   - "moving the STORE's CEE hash flips the verdict" pins that the store hash is
 *     READ AT ALL. Measured: it REDs when the component stops reading it, and it
 *     stays GREEN under the UI-hash substitution — a single-arm assertion, and
 *     the substituted hash also differs from the block's, so it yields `changed`
 *     too and the test cannot tell them apart.
 *   - "moving the CANVAS GRAPH does not" is the member that catches the
 *     SUBSTITUTION, together with `stays SILENT while the hashes agree` in the
 *     sibling #670 spec. It holds the store hash fixed and moves the only input a
 *     UI-side hash could depend on, having first asserted that the UI hash of
 *     that graph differs — so a substitution has somewhere to show.
 *
 * Both were measured with an applied-check and a control; neither claim above is
 * inferred from the other.
 *
 * ⚠ This paragraph previously read *"the mutant kit pins it"*. It did not, and it
 * could not: a mutant kit runs in a throwaway worktree and leaves nothing in the
 * repository, so no reader could ever check the claim and no gate could ever
 * fail on it — a hand-maintained mirror (CLAUDE.md trap 12) inside a comment
 * about a load-bearing guarantee. The guarantee is the same; what changed is that
 * it now names something that exists and executes.
 *
 * ## The DIRTY WINDOW — where two CEE hashes are both blind
 *
 * Both hashes are stamped SERVER-SIDE, so neither moves when the user edits the
 * model locally. Between an analysis-affecting local edit and the next turn
 * carrying an `analysis_ready`, the two agree and this comparison alone resolves
 * `current` — silent — while every neighbouring surface has already downgraded.
 *
 * The client's first-hand knowledge of that edit is the store's
 * `analysisFreshnessDirty` overlay, and the reading of it that the neighbouring
 * surfaces consume is `classifyFreshnessForDisplay`. This module BORROWS that
 * reading rather than deriving a second one: two authorities answering "is the
 * analysis stale?" under one name is the estate's most expensive defect class
 * (trap 21).
 *
 * ⚠ AND THE BORROW IS GATED ON THE OVERLAY, because the two questions are still
 * different. `classifyFreshnessForDisplay` answers *"is the ANALYSIS current?"*;
 * this module asks *"is this advice still about the model you have?"*. They come
 * apart on a CEE-STATED `'stale'` with NO local edit — the analysis ran on an
 * older graph while the card was written about the current one, so the analysis
 * is stale and the card is fine. Consuming the verdict ungated would make the
 * card cry wolf on that state; gating on `dirty` restricts the borrow to exactly
 * the fact the hashes cannot see.
 *
 * ## Why the verdict vocabulary is borrowed, not minted
 *
 * `FreshnessDisplaySemantic` ('current' | 'changed' | 'cannot_confirm' | 'none')
 * already exists in `canvas/store/analysisFreshness.ts` for exactly this
 * distinction, and its doc-comment states the rule this obeys: *"'changed' must
 * never be claimed for a CEE-sourced 'unknown'"*. A second, parallel vocabulary
 * for the same question is the drift defect this estate keeps paying for.
 *
 * ## Why only the transcript — the CORRECTED mechanism
 *
 * ⚠ #670 argued that the `guidanceStore`-fed surfaces (guidance strip,
 * `NodeCoachingMarker`, `InspectorGuidanceSection`, Strengthen panel) need no
 * staleness notice because *"`evictStaleItems` removes items whose `valid_while`
 * no longer holds … those surfaces present only currently-valid items by
 * construction"*. THE CONCLUSION IS RIGHT AND THAT MECHANISM IS NOT THE REASON.
 * Derived at the bytes, 2026-08-12, at `32c0c517`:
 *
 *   - ⚠ NOT because `valid_while` is absent. CEE emits no `valid_while` OBJECT,
 *     but `extractPhase3FromV5Response.ts:479-489` SYNTHESISES one, mapping
 *     `graph_hash_at_generation` onto the legacy `valid_while.graph_hash` slot —
 *     37 occurrences in the wire corpus. An earlier draft of this note reasoned
 *     "no `valid_while` ⇒ nothing to evict", which is false at that middle step.
 *   - The `graph_hash` limb it therefore DOES populate requires `graphChanged:
 *     true`, and the ONLY production call site
 *     (`useAnalysisCompleteEvent.ts:39`) omits the argument, so it takes its
 *     `false` default on every real call — the limb never fires.
 *   - The `analysis_hash` limb WOULD fire, and it is the load-bearing one. It is
 *     inert only because CEE emits no `analysis_hash` on a coaching block: zero
 *     occurrences across the wire corpus, against 37 for the graph hash.
 *     ⚠ THAT IS A CORPUS FACT, NOT A STRUCTURAL ONE. If CEE ever starts emitting
 *     `analysis_hash`, this paragraph becomes wrong and `evictStaleItems` starts
 *     removing items on run completion — re-derive before relying on it.
 *   - And the call site fires on RUN COMPLETION, never on a model edit, which is
 *     what rules it out as the answer to "what keeps these surfaces clean when
 *     the user edits?" regardless of the limbs.
 *
 * The mechanism that actually keeps those surfaces clean is
 * `clearGuidanceItems()` (at `useGraphEditEvents.ts:293` when this was written;
 * derive the line, do not trust it), which drops EVERY item
 * on any structural local edit, ahead of its own 1.5 s debounce — plus, on an
 * assistant turn, `setGuidanceItems()` replacing the whole list
 * (`useConversation.ts:3716`). The `rehydrateGuidance` half of the #670 argument
 * is sound; the `evictStaleItems` half is not.
 *
 * ⚠ AND THE SKIP THAT MECHANISM HAS. `useGraphEditEvents` returns early while
 * `_externalMutationActive > 0` (`:245` at the time of writing — derive the
 * line, do not trust it), BEFORE reaching the clear, so an
 * accepted assistant patch fires no `clearGuidanceItems()`. Investigated: it does
 * NOT produce a transient lie the user can SEE. Both external-mutation paths pair
 * the suppression with a prune in the SAME synchronous task — manual accept
 * mutates at `ConversationPanel.tsx:289/362` and prunes at `:330/:388`, and
 * auto-apply replaces the entire list at `useConversation.ts:3716` before pruning
 * at `:3720`; both verified to contain ZERO `await`s between the two points.
 *
 * ⚠ THE CLAIM IS ABOUT THE PAINT BOUNDARY, NOT ABOUT RENDERING. A synchronous
 * React render between the two statements is not excluded in principle — what is
 * excluded is a browser PAINT, because the task cannot yield before the prune has
 * run. The user therefore cannot observe an intermediate frame. Stating it as "no
 * render can land in between", as an earlier draft did, over-claims: it asserts
 * something about React's scheduler that the `await` count does not establish.
 * What DOES survive
 * is an item targeting no patched element, and that is deliberate and documented
 * (`guidanceStore.ts:404-410`); the real defect in that area, a persist that
 * re-stamped survivors at the new hash, is already closed by `minting`.
 *
 * ## Absence is CANNOT-CONFIRM — never fresh, never stale
 *
 * 4 of the 13 wire-measured blocks carried no `graph_hash_at_generation`, and a
 * turn can arrive before any `analysis_ready`. Either gap means the question is
 * unanswerable, and the honest answer to an unanswerable question is to say so:
 * inferring `current` from absence would restore the exact silent-but-wrong state
 * this module exists to end, and inferring `changed` would cry wolf.
 *
 * ⚠ ONE DELIBERATE EXCEPTION — the run-turn rule below. A `run_analysis` card's
 * absence resolves HISTORICAL, not cannot-confirm, and the section says why.
 *
 * ## The RUN-TURN rule — a `run_analysis` card is about ONE run
 *
 * Contract: Reasoning & Coaching, programme-docs #63 5819380376 §3. A card whose
 * `source_handler` is `'run_analysis'` was written about a specific analysis
 * RUN, and it carries a dispatching action that talks about that run's result.
 * The hash pair above cannot tell two runs over the SAME graph apart (a rerun on
 * an unchanged model re-stamps nothing either hash sees), so for these cards
 * the verdict is CURRENT only when ALL THREE hold:
 *
 *   1. `analysis_state.run_state.kind === 'complete_current'` — CEE's own
 *      statement that the latest run is complete and current;
 *   2. `graph_hash_at_generation === analysis_ready.current_graph_hash` — the
 *      same CEE-vs-CEE comparison as above, never a UI hash;
 *   3. `created_at === run_state.computed_at` — exact string equality, as the
 *      producer wrote both; never parsed, never normalised, so a format drift
 *      fails CLOSED (historical), which is the safe direction.
 *
 * Anything else — including ANY of those five values being unknown — is
 * HISTORICAL: the verdict resolves to `'changed'`, so a face notice speaks and
 * the card's action goes inert beside it. Unknown is NOT cannot-confirm here,
 * by the contract — and the mechanics show why it cannot be: a cannot-confirm
 * card keeps a LIVE action (it has no face notice to disable it), so mapping
 * unknown there would leave a run-turn action clickable on a card nobody can
 * show is about the current run.
 *
 * ⚠ ONE SENTENCE PER FAILED LIMB, NOT ONE FOR ALL THREE. The first version of
 * this rule reused `FRESHNESS_NOTICE.stale` ("Your model has changed…") for
 * every failure, which is FALSE for a rerun on an unchanged model — the hashes
 * agree and only the run moved. `runTurnStaleReason` names the failed limb and
 * `RUN_TURN_NOTICE` carries the producer-authored sentence for each (R&C,
 * #63 5821034205); `resolveFreshnessNotice` places it after the producer's own
 * non-fresh verdict and before the generic derived sentence.
 *
 * Cards WITHOUT `source_handler === 'run_analysis'` never enter this rule: the
 * branch is skipped outright and the verdict is the pre-existing one, byte for
 * byte. When all three limbs hold, the verdict still falls through to the
 * dirty-window borrow above — "current for this run" is not "current for the
 * model the user has since edited".
 */
import type { AnalysisRunStateKind } from '@talchain/schemas/boundary'
import type { FreshnessDisplaySemantic } from '../../canvas/store/analysisFreshness'
import type { V5Phase3Freshness } from '../../canvas/conversation/types'

/**
 * The three answers a coaching card can honestly give about its own currency.
 * `'none'` — the fourth `FreshnessDisplaySemantic` member — is deliberately NOT
 * reachable here: it means "no analysis has been run", which is a statement about
 * the ANALYSIS, not about whether this card's model still exists.
 */
export type CoachingCurrency = Exclude<FreshnessDisplaySemantic, 'none'>

/**
 * Plain-English sentences for the freshness verdict — #644's copy, made
 * reachable by #670 and shared here VERBATIM when the mechanism was extended
 * to the other hash-carrying transcript cards (review_card / evidence /
 * exercise). `fresh` is deliberately absent from this map: a current card
 * says nothing, because a "this is current" badge on every card is noise that
 * teaches the reader to ignore the one time it matters.
 *
 * ⚠ ONE copy, exported from the mechanism module. A per-renderer copy of
 * these sentences is the same-named-twin defect this estate keeps paying for
 * (trap 12): four cards drifting to three wordings of the same fact.
 */
export const FRESHNESS_NOTICE: Partial<Record<string, string>> = {
  stale: 'Your model has changed since this was written — it may no longer apply.',
  pending: 'This is still being written.',
  failed: 'This could not be generated.',
}

/**
 * The producer's verdict WINS when it has said anything at all.
 *
 * `freshness` answers "did this card generate correctly?" (pending / failed)
 * and currency answers "is it still about your model?" — two questions, and
 * trap 21 is what happens when two questions share one channel. So the
 * derived verdict FILLS THE PRODUCER'S SILENCE and never overwrites its
 * speech. When both point at staleness they resolve to the same sentence, so
 * the notice renders once and cannot contradict itself.
 *
 * (Extracted verbatim from V5CoachingBlock when the mechanism was extended —
 * the resolution rule is part of the mechanism, not of any one card.)
 */
export function resolveFreshnessNotice(
  producerFreshness: V5Phase3Freshness | undefined,
  currency: CoachingCurrency,
  /**
   * A `run_analysis` card's failed limb (`runTurnStaleReason`). It sits
   * BETWEEN the two existing sources: the producer's own non-fresh verdict
   * still wins, and the run-turn sentence replaces the generic derived one,
   * which would otherwise say "your model has changed" about a same-model
   * rerun. Omitted / null — every other card — and the result is unchanged.
   */
  runTurnReason?: RunTurnStaleReason | null,
): string | undefined {
  return (
    (producerFreshness ? FRESHNESS_NOTICE[producerFreshness] : undefined) ??
    (runTurnReason ? RUN_TURN_NOTICE[runTurnReason] : undefined) ??
    (currency === 'changed' ? FRESHNESS_NOTICE.stale : undefined)
  )
}

/** A hash is usable only as a non-empty string; `''` is absence, not a value. */
function usableHash(v: string | undefined | null): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined
}

/**
 * The client's own reading of the local-edit window, taken from the SHARED
 * authority — never re-derived here.
 *
 * Both fields come from one place at the call site: `dirty` is the store's
 * `analysisFreshnessDirty`, and `displaySemantic` is
 * `classifyFreshnessForDisplay(analysisFreshness, analysisFreshnessDirty,
 * importPendingServerRegistration)` — the identical call `V7FreshnessStrip` makes.
 * `AnalysisFreshnessNotice` and `useAnalysisTrust` call the SAME function but feed
 * it `resolveTrustEffectiveState`'s orphan fold first, so "identical" is exact for
 * the strip alone; the one reachable divergence is recorded in
 * `V5CoachingBlock.currencyDirtyWindow.spec.tsx`. Passing them as
 * data keeps this module pure and testable; it does not make them a second
 * authority, and nothing here may recompute either one.
 */
export interface LocalEditWindow {
  /** The store's `analysisFreshnessDirty` overlay. */
  dirty: boolean
  /** What `classifyFreshnessForDisplay` said about that same state. */
  displaySemantic: FreshnessDisplaySemantic
}

/** The producer handler whose cards the run-turn rule governs. */
export const RUN_ANALYSIS_SOURCE_HANDLER = 'run_analysis'

/** Does the run-turn rule govern this card? Exact match on the producer's token. */
export function isRunTurnCoachingCard(sourceHandler: string | undefined | null): boolean {
  return sourceHandler === RUN_ANALYSIS_SOURCE_HANDLER
}

/**
 * The run-turn inputs: two from the CARD, two from CEE's `analysis_state` for
 * the current turn. Passed as data — like `LocalEditWindow` — so this module
 * stays pure; the store reads live in `useCoachingCurrency`.
 */
export interface RunTurnCurrencyInputs {
  /** The block's `source_handler`. The rule applies only to `'run_analysis'`. */
  sourceHandler: string | undefined | null
  /** The block's `created_at`, verbatim. */
  createdAt: string | undefined | null
  /** `analysis_state.run_state.kind`; absent when the turn stated no verdict. */
  runStateKind: AnalysisRunStateKind | undefined | null
  /** `analysis_state.run_state.computed_at` — carried only by the `complete_*` kinds. */
  runComputedAt: string | undefined | null
}

/**
 * WHICH limb of the three-part rule a `run_analysis` card failed — each one is
 * a different fact about the card, and each gets its own sentence.
 *
 *   · `model_changed`    — the model moved since the card was written.
 *   · `earlier_analysis` — the latest run is not complete-and-current, or a
 *                          value the rule needs is unknown: nothing on hand
 *                          ties the card to the analysis the user now has.
 *   · `earlier_run`      — same model, but a newer run has completed since.
 */
export type RunTurnStaleReason = 'model_changed' | 'earlier_analysis' | 'earlier_run'

/**
 * The notice per failed limb — PRODUCER-AUTHORED COPY, verbatim (Reasoning &
 * Coaching, programme-docs #63 5821034205). Never re-worded here: the
 * producer lane owns what this card says about itself.
 *
 * `model_changed` is deliberately the SAME sentence `FRESHNESS_NOTICE.stale`
 * already carries — it is the one limb for which "your model has changed" is
 * true. The other two exist because that sentence was FALSE for them: a
 * rerun on an unchanged model left every hash equal, yet the card said the
 * model had changed.
 */
export const RUN_TURN_NOTICE: Readonly<Record<RunTurnStaleReason, string>> = {
  model_changed: FRESHNESS_NOTICE.stale as string,
  earlier_analysis: 'Written about an earlier analysis — re-run to check it still holds.',
  earlier_run: 'Written about an earlier run of this model — the latest run may point somewhere else.',
}

/**
 * The three-part rule, classified — UNGATED on the handler (the two exported
 * readers below apply the gate). `null` ⇔ all three limbs hold on known values.
 *
 * PRECEDENCE, and it is the contract's (#63 5821034205):
 *   (a) both hashes known and different    → `model_changed` — the strongest,
 *       first-hand fact; it wins over whatever the run state says;
 *   (b) run not `complete_current`, or ANY value the rule needs is unknown
 *                                          → `earlier_analysis`;
 *   (c) otherwise the hashes are known and EQUAL, so the only limb left is the
 *       timestamp: `created_at !== computed_at` → `earlier_run`.
 */
function classifyRunTurn(
  blockGraphHash: string | undefined | null,
  currentGraphHash: string | undefined | null,
  runTurn: RunTurnCurrencyInputs,
): RunTurnStaleReason | null {
  const authored = usableHash(blockGraphHash)
  const current = usableHash(currentGraphHash)
  // (a)
  if (authored && current && authored !== current) return 'model_changed'
  const createdAt = usableStamp(runTurn.createdAt)
  const computedAt = usableStamp(runTurn.runComputedAt)
  // (b)
  if (
    runTurn.runStateKind !== 'complete_current' ||
    !authored ||
    !current ||
    createdAt === undefined ||
    computedAt === undefined
  ) {
    return 'earlier_analysis'
  }
  // (c) — hashes are known and equal here, by (a) and (b).
  if (createdAt !== computedAt) return 'earlier_run'
  return null
}

/**
 * Why a `run_analysis` card is HISTORICAL, or `null` — and `null` for every
 * card NOT authored by `run_analysis`, which the run-turn rule never governs.
 * On `null` the card's pre-existing currency logic (the dirty-window borrow and
 * its copy) applies exactly as before.
 */
export function runTurnStaleReason(
  blockGraphHash: string | undefined | null,
  currentGraphHash: string | undefined | null,
  runTurn: RunTurnCurrencyInputs,
): RunTurnStaleReason | null {
  if (!isRunTurnCoachingCard(runTurn.sourceHandler)) return null
  return classifyRunTurn(blockGraphHash, currentGraphHash, runTurn)
}

/**
 * The three-part rule (module header, "The RUN-TURN rule"). True only when all
 * three limbs hold on known values; every unknown is a `false`. The same
 * classification `runTurnStaleReason` reports — one definition, two readers.
 */
export function isRunTurnCardCurrent(
  blockGraphHash: string | undefined | null,
  currentGraphHash: string | undefined | null,
  runTurn: RunTurnCurrencyInputs,
): boolean {
  return classifyRunTurn(blockGraphHash, currentGraphHash, runTurn) === null
}

/** A timestamp is usable only as a non-blank string, and is compared VERBATIM — never parsed. */
function usableStamp(v: string | undefined | null): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined
}

/**
 * Compare the model this card was written about with the model CEE currently
 * reports, then — only where those two CEE hashes are structurally blind — fill
 * the silence with the shared authority's reading of the local-edit window.
 *
 * BOTH hash arguments must be CEE-produced — see the module header.
 *
 * @param blockGraphHash   the block's `graph_hash_at_generation`
 * @param currentGraphHash `analysis_ready.current_graph_hash` from the store
 * @param localEdits       the shared authority's reading; omit where unavailable
 * @param runTurn          the run-turn inputs; consulted ONLY when the card's
 *                         `source_handler` is `'run_analysis'` — omitted, or any
 *                         other handler, and the verdict is the pre-existing one
 */
export function deriveCoachingCurrency(
  blockGraphHash: string | undefined | null,
  currentGraphHash: string | undefined | null,
  localEdits?: LocalEditWindow,
  runTurn?: RunTurnCurrencyInputs,
): CoachingCurrency {
  // THE RUN-TURN RULE, first and only for its own cards. A `run_analysis` card
  // that fails any limb is HISTORICAL — `'changed'`, so the stale notice speaks
  // and the action goes inert — including when a limb is merely unknown (see
  // the module header for why unknown is not cannot-confirm here). Passing all
  // three falls through: the limbs have already proved both hashes present and
  // equal, so the only branch left to decide is the dirty-window borrow.
  if (runTurn && runTurnStaleReason(blockGraphHash, currentGraphHash, runTurn) !== null) {
    return 'changed'
  }
  const authored = usableHash(blockGraphHash)
  const current = usableHash(currentGraphHash)
  // Either side missing ⇒ the question cannot be answered. Stated, never guessed.
  //
  // ⚠ AND THE OVERLAY DOES NOT RESCUE IT. A local edit proves the MODEL moved; it
  // says nothing about whether this card was authored before or after that edit,
  // because the card's own hash is the missing half. Upgrading here would invent
  // a claim out of the exact absence this branch exists to report — and this is
  // not a silent state, so there is no silence to fill.
  if (!authored || !current) return 'cannot_confirm'
  // The hashes disagree: CEE's own evidence, first-hand and specific. Nothing the
  // overlay could add is stronger, so the borrow does not apply here either.
  if (authored !== current) return 'changed'
  // The hashes AGREE — the one verdict a server-stamped pair can reach while the
  // user's model has already moved underneath it. Fill that silence, and ONLY
  // when the client's own dirty overlay says the model moved after the last
  // `analysis_ready`. Without the overlay the agreement is the truth and the card
  // stays silent, which is the whole point of the gate (see the module header:
  // a CEE-stated 'stale' with a clean overlay must NOT reach the card).
  if (!localEdits?.dirty) return 'current'
  // Take the authority's word verbatim, including its refusal to assert 'changed'
  // under an import hold. `'none'` means it had no verdict to give, which is not
  // evidence of anything — silence stays silence.
  if (localEdits.displaySemantic === 'changed') return 'changed'
  if (localEdits.displaySemantic === 'cannot_confirm') return 'cannot_confirm'
  return 'current'
}

/**
 * STALE ADVICE IS INERT; A REFRESH IS NOT (Independent Review, programme-docs
 * #63 5820349265). The one card whose action exists BECAUSE the model moved is
 * CEE's stale-rerun card (`buildStaleRerunCoachingBlock`): always stamped
 * `freshness: 'stale'`, and after a stale analysis often the ONLY block CEE
 * emits. Disabling its "Re-run analysis" beside its own stale notice would leave
 * the user nothing to act on. The discriminator is the PRODUCER's typed intent —
 * `rerun_analysis` declares an action that acts on the model as it is NOW — so
 * the UI invents no rule of its own. Every other action on a stale card stays
 * inert.
 */
export const REFRESH_ACTION_INTENTS: ReadonlySet<string> = new Set(['rerun_analysis'])

export function isRefreshActionIntent(intent: string | undefined): boolean {
  return typeof intent === 'string' && REFRESH_ACTION_INTENTS.has(intent)
}
