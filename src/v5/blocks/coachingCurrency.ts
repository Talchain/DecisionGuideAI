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
 * signature cannot prevent it (both are strings), so the mutant kit pins it: a
 * mutant that sources the current hash from the UI's `generateGraphHash` must RED.
 *
 * ## Why the verdict vocabulary is borrowed, not minted
 *
 * `FreshnessDisplaySemantic` ('current' | 'changed' | 'cannot_confirm' | 'none')
 * already exists in `canvas/store/analysisFreshness.ts` for exactly this
 * distinction, and its doc-comment states the rule this obeys: *"'changed' must
 * never be claimed for a CEE-sourced 'unknown'"*. A second, parallel vocabulary
 * for the same question is the drift defect this estate keeps paying for.
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
 * Compare the model this card was written about with the model CEE currently
 * reports. BOTH arguments must be CEE-produced hashes — see the module header.
 *
 * @param blockGraphHash   the block's `graph_hash_at_generation`
 * @param currentGraphHash `analysis_ready.current_graph_hash` from the store
 */
export function deriveCoachingCurrency(
  blockGraphHash: string | undefined | null,
  currentGraphHash: string | undefined | null,
): CoachingCurrency {
  const authored = usableHash(blockGraphHash)
  const current = usableHash(currentGraphHash)
  // Either side missing ⇒ the question cannot be answered. Stated, never guessed.
  if (!authored || !current) return 'cannot_confirm'
  return authored === current ? 'current' : 'changed'
}
