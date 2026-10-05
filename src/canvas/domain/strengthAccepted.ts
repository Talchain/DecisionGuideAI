/**
 * ⭐ AN ACCEPTED OLUMI STRENGTH SAYS SO (gate 5 item 2, DL 0df0e1, 5 Oct 2026).
 *
 * When the user approves Olumi's suggested strength for a link, CEE records the approval as review, not authorship:
 * `provenance.reviewed_by_user = { intent: 'confirm', at, band? }`, with `source` / `magnitude` kept byte-identical
 * (served CEE 8feb2617 `adjust-edge-strength.ts:466-479`, `:500-512`). CEE's one classifier calls that class
 * `olumi_accepted` (`cee/magnitude/link-sizing.ts:41-48`), and Compare says "You accepted Olumi's estimate…". The
 * canvas dropped the review at ingestion, so the same link still read "Olumi's estimate" with an `est.` marker whose
 * own sentence is "Estimate not yet confirmed". One link, two verdicts.
 *
 * ⭐ ONE READER AT EVERY INGESTION HOP (`mapDraftEdgeToCanvas`, `buildEdge`, `DraftChat`), the `strengthPlaceholder`
 * pattern. The fact is stored as `strengthAccepted`: the canvas `weight` the user accepted.
 *
 * ⭐ STALENESS BY CONSTRUCTION, the same rule as `isStrengthPlaceholder`: the label is live only while the weight is
 * still CEE's and the magnitude drawn still equals the stored one. A person who sets the strength stamps
 * `weightSource: 'user'`; a new producer figure moves the magnitude. Either way the label retires with nothing written.
 *
 * ⚠ ABSENT ⇒ NOT KNOWN TO BE ACCEPTED. An edge without the review keeps today's reading: failure is under-claiming
 * the approval, never a false "you accepted it".
 */
import { edgeValueSource, resolveEdgeSignedStrengthDisplay } from './edgeValueProvenance'

/** Same tolerance `isStrengthPlaceholder` compares its key with. */
const SAME_WEIGHT_EPSILON = 1e-9

/**
 * Does the wire edge say its strength is Olumi's estimate the user ACCEPTED? CEE's `linkSizing` rule, transcribed:
 * `user_specified` or `user_stated` is the user's own (never accepted); `olumi_placeholder` is nobody's; any other
 * `olumi_*` magnitude with a `reviewed_by_user` confirm is accepted.
 */
export function readWireStrengthIsAccepted(
  wireEdge: Record<string, unknown> | undefined | null,
): boolean {
  const provenance = wireEdge?.provenance
  if (typeof provenance !== 'object' || provenance === null || Array.isArray(provenance)) return false
  const p = provenance as Record<string, unknown>
  if (p.source === 'user_specified' || p.magnitude === 'user_stated') return false
  if (p.magnitude === 'olumi_placeholder') return false
  if (typeof p.magnitude !== 'string' || !p.magnitude.startsWith('olumi_')) return false
  const review = p.reviewed_by_user
  return typeof review === 'object' && review !== null && (review as Record<string, unknown>).intent === 'confirm'
}

/**
 * The edge-data patch an ingestion hop spreads: `{ strengthAccepted: weight }` when the wire records the user's
 * acceptance of a strength it actually SUPPLIED, else nothing. `weight` is the hop's own resolved canvas weight.
 */
export function strengthAcceptedPatch(
  wireEdge: Record<string, unknown> | undefined | null,
  weight: number,
  wireSuppliedStrength: boolean,
): { strengthAccepted?: number } {
  if (!wireSuppliedStrength || !Number.isFinite(weight)) return {}
  return readWireStrengthIsAccepted(wireEdge) ? { strengthAccepted: weight } : {}
}

/** Is this edge's strength, as drawn now, Olumi's estimate the user accepted? See the header for the staleness rule. */
export function isStrengthAccepted(data: Record<string, unknown> | undefined | null): boolean {
  if (!data) return false
  const stored = data.strengthAccepted
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return false
  if (edgeValueSource(data, 'weight') !== 'cee') return false
  const display = resolveEdgeSignedStrengthDisplay(data)
  if (!display.show) return false
  return Math.abs(Math.abs(display.value) - stored) <= SAME_WEIGHT_EPSILON
}
