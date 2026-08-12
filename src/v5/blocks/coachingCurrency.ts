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
 * CEE-sourced" moves the store's CEE hash and asserts the verdict flips, then
 * moves the CANVAS GRAPH (asserting first that the UI hash of that graph differs)
 * and asserts the verdict does NOT. Either case alone proves sensitivity to
 * something; the pair proves binding to the named source.
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
 *   - `evictStaleItems` gates entirely on `item.valid_while`; an item without one
 *     returns valid immediately (`guidanceStore.ts:580`). CEE emits NO
 *     `valid_while` — 13/13 blocks, measured twice — so on live data it removes
 *     nothing at all.
 *   - Its `graph_hash` limb additionally requires `graphChanged: true`, and its
 *     ONLY production call site (`useAnalysisCompleteEvent.ts:39`) omits the
 *     argument, so it takes its `false` default on every real call.
 *   - That call site fires on RUN COMPLETION, never on a model edit.
 *
 * The mechanism that actually keeps those surfaces clean is
 * `clearGuidanceItems()` at `useGraphEditEvents.ts:226`, which drops EVERY item
 * on any structural local edit, ahead of its own 1.5 s debounce — plus, on an
 * assistant turn, `setGuidanceItems()` replacing the whole list
 * (`useConversation.ts:3716`). The `rehydrateGuidance` half of the #670 argument
 * is sound; the `evictStaleItems` half is not.
 *
 * ⚠ AND THE SKIP THAT MECHANISM HAS. `useGraphEditEvents` returns early while
 * `_externalMutationActive > 0` (`:204-208`), BEFORE reaching the clear, so an
 * accepted assistant patch fires no `clearGuidanceItems()`. Investigated: it does
 * NOT produce a transient lie. Both external-mutation paths pair the suppression
 * with a prune in the SAME synchronous task — manual accept mutates at
 * `ConversationPanel.tsx:289/362` and prunes at `:330/:388` with no `await`
 * between, and auto-apply replaces the entire list at `useConversation.ts:3716`
 * before pruning at `:3720` — so no render can land in between. What DOES survive
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
 */
import type { FreshnessDisplaySemantic } from '../../canvas/store/analysisFreshness'

/**
 * The three answers a coaching card can honestly give about its own currency.
 * `'none'` — the fourth `FreshnessDisplaySemantic` member — is deliberately NOT
 * reachable here: it means "no analysis has been run", which is a statement about
 * the ANALYSIS, not about whether this card's model still exists.
 */
export type CoachingCurrency = Exclude<FreshnessDisplaySemantic, 'none'>

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
 * importPendingServerRegistration)` — the identical call `V7FreshnessStrip`,
 * `AnalysisFreshnessNotice` and `useAnalysisTrust` already make. Passing them as
 * data keeps this module pure and testable; it does not make them a second
 * authority, and nothing here may recompute either one.
 */
export interface LocalEditWindow {
  /** The store's `analysisFreshnessDirty` overlay. */
  dirty: boolean
  /** What `classifyFreshnessForDisplay` said about that same state. */
  displaySemantic: FreshnessDisplaySemantic
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
 */
export function deriveCoachingCurrency(
  blockGraphHash: string | undefined | null,
  currentGraphHash: string | undefined | null,
  localEdits?: LocalEditWindow,
): CoachingCurrency {
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
