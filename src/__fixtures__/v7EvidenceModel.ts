/**
 * Fixture: `V7EvidenceModel` builder.
 *
 * ONE partial-over-defaults builder for the V7 evidence disclosure's model,
 * shared by every suite that renders `<V7EvidenceDisclosure/>`. Three specs
 * carried byte-identical private copies (the base suite, the projection suite,
 * the Resolve-next suite) and the copies had ALREADY started to drift within one
 * PR — each needed the same `resolveNext: null` default added, in three places,
 * with the same two-line rationale repeated. That is the hand-maintained mirror
 * (trap 12) in fixture form: the next field added to `V7EvidenceModel` is a
 * required-key compile error in N spec files instead of one.
 *
 * `null` for `resolveNext` is the HONEST-GATE verdict, not an empty ranking —
 * the distinction is documented on the field declaration in `buildV7Lenses.ts`.
 */

import type { V7EvidenceModel } from '../components/results/v7/buildV7Lenses'

export function v7EvidenceModel(partial: Partial<V7EvidenceModel> = {}): V7EvidenceModel {
  return {
    drivers: partial.drivers ?? [],
    flipRisks: partial.flipRisks ?? [],
    tradeOffs: partial.tradeOffs ?? [],
    resolveNext: partial.resolveNext ?? null,
    designationsWithheld: partial.designationsWithheld ?? false,
  }
}
