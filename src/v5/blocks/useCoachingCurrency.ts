/**
 * useCoachingCurrency — THE ONE WAY a transcript card consults the currency
 * authority.
 *
 * #670 built the authority (`deriveCoachingCurrency`) and one consumer
 * (`V5CoachingBlock`). Extending the mechanism to the other hash-carrying
 * Phase 3 cards (review_card / evidence / exercise) would have meant four
 * copies of the SAME consumption boilerplate — three store subscriptions plus
 * the `classifyFreshnessForDisplay` call — and four copies is how one of them
 * eventually drops the import-hold argument, or reads a different store field,
 * and two surfaces answer "has your model moved?" differently on the same
 * turn. That is trap 21 by increments. So the consumption seam lives HERE,
 * once, and every renderer calls this hook.
 *
 * NOTHING IS DERIVED IN THIS FILE. The verdict is `deriveCoachingCurrency`'s
 * (see `coachingCurrency.ts` for the whole argument: CEE-hash-vs-CEE-hash,
 * the dirty-window borrow, why absence is cannot-confirm). The dirtiness
 * reading is `classifyFreshnessForDisplay`'s — byte-for-byte the call
 * `V7FreshnessStrip.tsx` makes. This hook only wires store state to the
 * authority's parameters.
 *
 * ⚠ BOTH HASH ARGUMENTS MUST BE CEE-PRODUCED. `blockGraphHash` is the block's
 * `graph_hash_at_generation`; the current hash read here is
 * `analysisFreshness.currentGraphHash` (`analysis_ready.current_graph_hash`).
 * The UI's own `generateGraphHash` is a different algorithm over different
 * inputs and MUST NOT be substituted on either side — the category error
 * `guidanceStore.ts` §2b names. The executable pin for this lives in
 * `V5CoachingBlock.currencyDirtyWindow.spec.tsx` §"the current hash is
 * CEE-sourced", which now guards the seam for all four consumers at once.
 */
import { useCanvasStore } from '../../canvas/store'
import { classifyFreshnessForDisplay } from '../../canvas/store/analysisFreshness'
import { deriveCoachingCurrency, type CoachingCurrency } from './coachingCurrency'

/**
 * Read at RENDER time, on store subscriptions, so a card already on screen
 * starts telling the truth the moment the model moves underneath it — the
 * same render-time contract `TargetRefPill` documents ("a pill never points
 * at a guess"). At ingest the two hashes are always equal, which is exactly
 * why an ingest-time verdict would be worthless.
 *
 * @param blockGraphHash the block's `graph_hash_at_generation` (CEE `aag_v1`)
 */
export function useCoachingCurrency(
  blockGraphHash: string | undefined | null,
): CoachingCurrency {
  const freshnessState = useCanvasStore((s) => s.analysisFreshness)
  const freshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const importHold = useCanvasStore((s) => s.importPendingServerRegistration)
  return deriveCoachingCurrency(blockGraphHash, freshnessState?.currentGraphHash, {
    dirty: freshnessDirty,
    displaySemantic: classifyFreshnessForDisplay(freshnessState, freshnessDirty, importHold),
  })
}
