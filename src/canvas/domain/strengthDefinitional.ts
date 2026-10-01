/**
 * ⭐ A LINK THAT HOLDS BY DEFINITION IS NOBODY'S ESTIMATE (MG 0ebb952a, 1 Oct 2026).
 *
 * CEE writes some links that hold by arithmetic, not by belief: the parts of a
 * total (+1 per 1 in the shared unit, CEE #2445) and a risk's exposure counted
 * against the goal (−1 per 1, CEE #2386). On the wire their edge carries
 *
 *   provenance: { source, magnitude: 'olumi_estimate', natural_effect: {…}, definitional: true }
 *
 * `magnitude` is the sizer's author field and stays `olumi_estimate`, and the
 * UI never read `definitional`. So every link surface keyed on a CEE strength
 * called these links "Olumi's estimate", and the Model tab, the inspector and
 * Examine offered to adopt, confirm or examine them — while CEE refuses every
 * strength change on them. A definition is not anyone's estimate.
 *
 * ⭐ ONE READER AT EVERY INGESTION HOP (`mapDraftEdgeToCanvas`, `buildEdge`,
 * `DraftChat`) — the `strengthPlaceholderPatch` pattern, so the hops cannot
 * disagree. The fact is stored as `strengthDefinitional: true` on edge data. A
 * reload goes through hop 1 (`overlayEdge`), where the key is acquired metadata
 * under the server-absence rule (`mergeAppliedGraph`), like `strengthPlaceholder`.
 *
 * ⭐ ONE PREDICATE, `isStrengthDefinitional`, checked FIRST by every link reader
 * that would otherwise say "Olumi's estimate" or offer to confirm, adopt,
 * examine or size the strength.
 *
 * ⚠ LIVE ONLY WHILE THE WEIGHT IS STILL CEE'S. A strength a person set
 * (`weightSource: 'user'`) is theirs, and the flag cannot relabel it — the same
 * rule `isStrengthPlaceholder` keeps, with no writer of its own.
 *
 * ⚠ ABSENT ⇒ NOT KNOWN TO BE A DEFINITION. An edge without the label keeps
 * today's behaviour, so the failure is the old "estimate" wording, never a false
 * "by definition" on a real estimate.
 */
import { edgeValueSource } from './edgeValueProvenance'

/** The words every link surface says for a strength that holds by definition. */
export const BY_DEFINITION = 'By definition'

/**
 * The inspector's sentence for a strength that holds by definition (#2403 D4,
 * `coachingConfig`'s strength provenance). One spelling: a surface that would
 * otherwise hold a strength EDITOR says this instead, or `BY_DEFINITION` where
 * the room is only a chip or a hint (MG ruling, 1 Oct 2026).
 */
export const STRENGTH_HOLDS_BY_DEFINITION =
  'This link holds by definition: each unit of the cause counts as exactly one unit of the effect. It is arithmetic, not an estimate.'

/**
 * Does the wire edge say its link holds BY DEFINITION? The producer's own
 * `provenance.definitional === true`, nothing inferred.
 */
export function readWireStrengthIsDefinitional(
  wireEdge: Record<string, unknown> | undefined | null,
): boolean {
  const provenance = wireEdge?.provenance
  if (typeof provenance !== 'object' || provenance === null || Array.isArray(provenance)) return false
  return (provenance as Record<string, unknown>).definitional === true
}

/**
 * The edge-data patch an ingestion hop spreads: `{ strengthDefinitional: true }`
 * when the wire labelled a strength it actually SUPPLIED as holding by
 * definition, else nothing.
 */
export function strengthDefinitionalPatch(
  wireEdge: Record<string, unknown> | undefined | null,
  wireSuppliedStrength: boolean,
): { strengthDefinitional?: true } {
  if (!wireSuppliedStrength) return {}
  return readWireStrengthIsDefinitional(wireEdge) ? { strengthDefinitional: true } : {}
}

/** Does this edge's strength, as it stands now, hold by definition? See the header. */
export function isStrengthDefinitional(data: Record<string, unknown> | undefined | null): boolean {
  if (!data) return false
  if (data.strengthDefinitional !== true) return false
  return edgeValueSource(data, 'weight') === 'cee'
}
