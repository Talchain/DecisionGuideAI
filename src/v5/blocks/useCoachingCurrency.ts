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
 * The card's own run-turn provenance, verbatim from the block. Only a
 * `v5_coaching` block carries it today; every other caller omits it and gets
 * the pre-existing verdict unchanged.
 */
export interface CoachingCardProvenance {
  /** The block's `source_handler`. */
  sourceHandler?: string
  /** The block's `created_at`. */
  createdAt?: string
}

/**
 * Read at RENDER time, on store subscriptions, so a card already on screen
 * starts telling the truth the moment the model moves underneath it — the
 * same render-time contract `TargetRefPill` documents ("a pill never points
 * at a guess"). At ingest the two hashes are always equal, which is exactly
 * why an ingest-time verdict would be worthless.
 *
 * @param blockGraphHash the block's `graph_hash_at_generation` (CEE `aag_v1`)
 * @param provenance     the block's `source_handler` / `created_at`; only a
 *                       `'run_analysis'` handler changes the verdict (the
 *                       run-turn rule in `coachingCurrency.ts`)
 */
export function useCoachingCurrency(
  blockGraphHash: string | undefined | null,
  provenance?: CoachingCardProvenance,
): CoachingCurrency {
  const freshnessState = useCanvasStore((s) => s.analysisFreshness)
  const freshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const importHold = useCanvasStore((s) => s.importPendingServerRegistration)
  /*
    The run-turn rule's two CEE inputs, read VERBATIM off this turn's
    `analysis_state` verdict. Selected as PRIMITIVES so a card re-renders only
    when the run's kind or its `computed_at` actually changes, never on a new
    verdict object carrying the same run.

    ⚠ A DIRECT SLICE READ, NOT `useAnalysisState()`, and deliberately so: the
    composed selector subscribes to a dozen slices and would make every card in
    the transcript pay for the full composition, and it reshapes nothing this
    rule needs — `run_state.kind` / `computed_at` are the producer's own fields
    and nothing here derives from them beyond equality. The same verbatim read
    `useProvisionalAnalysisDelivery` makes. A narrow accessor beside
    `useAnalysisReadinessAuthority` in `analysisStateSelector.ts` would be the
    doctrinal home for it; that module is outside this change.
  */
  const runStateKind = useCanvasStore((s) => s.analysisStateV1?.run_state?.kind)
  const runComputedAt = useCanvasStore((s) => {
    const runState = s.analysisStateV1?.run_state
    return runState && 'computed_at' in runState ? runState.computed_at : undefined
  })
  return deriveCoachingCurrency(
    blockGraphHash,
    freshnessState?.currentGraphHash,
    {
      dirty: freshnessDirty,
      displaySemantic: classifyFreshnessForDisplay(freshnessState, freshnessDirty, importHold),
    },
    provenance
      ? {
          sourceHandler: provenance.sourceHandler,
          createdAt: provenance.createdAt,
          runStateKind,
          runComputedAt,
        }
      : undefined,
  )
}
