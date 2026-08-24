/**
 * Fixture: `HeroEvidenceModel` builder.
 *
 * ⭐ THIS IS `src/__fixtures__/v7EvidenceModel.ts`, RE-POINTED AND RENAMED.
 * The V7 retirement deleted the model type it built (`V7EvidenceModel`), and a
 * fixture named after a deleted directory sends the next reader hunting for a
 * component that no longer exists. The surviving evidence disclosure is
 * `analysis-hero/HeroEvidenceDisclosure`, so the builder follows its model.
 *
 * ⚠ IT LIVES INSIDE THE HERO MODULE, and that is forced rather than chosen.
 * `__tests__/inertness.spec.ts` permits exactly two importers of
 * `analysis-hero/**` repo-wide; a fixture under `src/__fixtures__/` that
 * imported `HeroEvidenceModel` would add an offender to that guard. Files under
 * the module directory are exempt, and `__fixtures__` is additionally skipped by
 * `__tests__/hygiene.spec.ts`'s production-source scan.
 *
 * ONE partial-over-defaults builder, for the reason the V7 original gave: three
 * specs carried byte-identical private copies which had ALREADY started to
 * drift within one PR. That is the hand-maintained mirror (trap 12) in fixture
 * form — the next field added to the model should be one compile error here,
 * not N of them across the suites.
 *
 * WHAT THE DEFAULTS MEAN (none of them is a neutral "empty"):
 *   · `resolveNext: null`     — the HONEST-GATE verdict, not an empty ranking.
 *   · `tradeOffs: null`       — no producer narrative (the live state).
 *   · `fragileEdgeRefs: []`   — this run found no fragile edges. NOT the same
 *     statement as "the analysis-graph projection is switched off".
 *   · `decisionVoi: 'not_computed'` — absence means not computed, never zero.
 */

import type { HeroEvidenceModel } from '../heroTypes'

export function heroEvidenceModel(
  partial: Partial<HeroEvidenceModel> = {},
): HeroEvidenceModel {
  return {
    drivers: partial.drivers ?? [],
    flipRisks: partial.flipRisks ?? [],
    fragileEdgeRefs: partial.fragileEdgeRefs ?? [],
    tradeOffs: partial.tradeOffs ?? null,
    resolveNext: partial.resolveNext ?? null,
    designationsWithheld: partial.designationsWithheld ?? false,
    decisionVoi: partial.decisionVoi ?? 'not_computed',
    // Absence of a readable suppression disclosure is SILENCE, never a
    // withholding claim — the same fail-closed direction as `decisionVoi`.
    attributionSuppression: partial.attributionSuppression ?? 'not_attested',
    assumedStrength:
      partial.assumedStrength ?? {
        selected: null,
        refusalReason: 'no_fragile_edges',
        assumedFragileCount: 0,
      },
  }
}

/**
 * One driver row, with every field the model requires.
 *
 * `isEstimate` has NO DEFAULT ON PURPOSE. It is the value-provenance field the
 * `est.` tag reads, and a fixture helper that quietly defaults it to
 * `'not_estimated'` would re-create, in the test corpus, exactly the silent
 * claim of user-authorship the field exists to prevent (see
 * `HeroDriverValueProvenance`). Every caller states it.
 */
export function heroDriverRow(
  isEstimate: HeroEvidenceModel['drivers'][number]['isEstimate'],
  partial: Partial<HeroEvidenceModel['drivers'][number]> = {},
): HeroEvidenceModel['drivers'][number] {
  return {
    rank: partial.rank ?? 1,
    label: partial.label ?? 'Price',
    targetId: partial.targetId ?? null,
    direction: partial.direction ?? null,
    influence: partial.influence ?? null,
    isEstimate,
  }
}
