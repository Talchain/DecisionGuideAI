/**
 * ⭐ A STRENGTH SIZED FROM THE USER'S OWN STATED FIGURE IS NOT "OLUMI'S ESTIMATE" (gate 5 item 2, Codex r1 P1-2).
 *
 * CEE labels a strength it sized from a figure the user stated with `provenance.magnitude: 'user_stated'` (served
 * 21-FIGURE-COLD-READ: "−£300/month per customer" from the brief). Until now the canvas knew it only through
 * `edgeSizePhrase(...).usersFigure`, which needs a COMPLETE size phrase. A missing direction, a contradictory sign
 * or a partial natural effect made the phrase null, and every surface fell back to "Olumi's estimate". The fact is
 * now stored on its own, independent of whether the phrase can be said.
 *
 * ⭐ ONE READER AT EVERY INGESTION HOP, the `strengthPlaceholder` / `strengthAccepted` pattern. Stored as
 * `strengthStated`: the canvas `weight` the stated figure sized.
 *
 * ⭐ STALENESS BY CONSTRUCTION, the same rule: live only while the weight is still CEE's and the magnitude drawn still
 * equals the stored one. A person's own setting, or a new producer figure, retires it with nothing written.
 *
 * ⚠ ABSENT ⇒ NOT KNOWN TO BE THE USER'S FIGURE. Failure is under-claiming, never "yours" on Olumi's number.
 */
import { edgeValueSource, resolveEdgeSignedStrengthDisplay } from './edgeValueProvenance'

const SAME_WEIGHT_EPSILON = 1e-9

/**
 * Does the wire edge say its strength was sized from the user's own stated figure? `user_specified` outranks it (the
 * person SET the strength; `readWireEdgeStrengthAuthor` owns that), exactly as in CEE's `linkSizing`.
 */
export function readWireStrengthIsStated(wireEdge: Record<string, unknown> | undefined | null): boolean {
  const provenance = wireEdge?.provenance
  if (typeof provenance !== 'object' || provenance === null || Array.isArray(provenance)) return false
  const p = provenance as Record<string, unknown>
  return p.source !== 'user_specified' && p.magnitude === 'user_stated'
}

/** The edge-data patch an ingestion hop spreads: `{ strengthStated: weight }` when the wire says so, else nothing. */
export function strengthStatedPatch(
  wireEdge: Record<string, unknown> | undefined | null,
  weight: number,
  wireSuppliedStrength: boolean,
): { strengthStated?: number } {
  if (!wireSuppliedStrength || !Number.isFinite(weight)) return {}
  return readWireStrengthIsStated(wireEdge) ? { strengthStated: weight } : {}
}

/** Is this edge's strength, as drawn now, the one sized from the user's own figure? See the header for staleness. */
export function isStrengthStated(data: Record<string, unknown> | undefined | null): boolean {
  if (!data) return false
  const stored = data.strengthStated
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return false
  if (edgeValueSource(data, 'weight') !== 'cee') return false
  const display = resolveEdgeSignedStrengthDisplay(data)
  if (!display.show) return false
  return Math.abs(Math.abs(display.value) - stored) <= SAME_WEIGHT_EPSILON
}
