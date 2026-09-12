/**
 * ⭐⭐ MAY THE PRODUCT CLAIM THIS ELEMENT AS OLUMI'S OWN?
 *
 * ── WHY THIS IS AN OWNER AND NOT A HELPER ───────────────────────────────────
 * THREE surfaces read one `provenance` field to answer this one question, and
 * on 12 Sep 2026 they gave three different answers about the same node:
 *
 *   | reader                                   | on `ai_inferred` + a quote   |
 *   |------------------------------------------|------------------------------|
 *   | `nodeProvenanceClaim` (canvas card)      | "Olumi suggested this"       |
 *   | `projectAuthoredEntities` (panel row)    | attributed to Olumi          |
 *   | `optionOriginDisclosure` (glance, #1533) | ⭐ correctly SILENT           |
 *
 * The third is right and the other two are wrong, so the fix is NOT to copy the
 * third's predicate twice more — that is the hand-maintained mirror this estate
 * keeps paying for (CLAUDE.md trap 12), and it is how the three drifted apart in
 * the first place. The predicate moves HERE and every reader asks it.
 *
 * ── THE DISTINCTION, DERIVED AT THE PRODUCER'S BYTES (CEE `2212ae05`) ────────
 * `ai_inferred` is the enum's CATCH-ALL. `transforms/schema-v3.ts:1178-1181`
 * stamps it for everything that is not `stated` AND `brief_binding: verified`,
 * so it means BOTH *"the model invented this"* AND *"the user stated it and the
 * brief check did not confirm it"*. Announcing the first sentence about the
 * second case tells a user their own thinking was ours — a fabrication in the
 * opposite direction, and a worse one, because the product is taking credit.
 *
 * ⭐ THE TWO ARE SEPARABLE, AND ONLY JUST. `schema-v3.ts:1190` lifts
 * `source_quote` onto the wire node OUTSIDE the enum decision, so an
 * unverified-stated node arrives carrying `ai_inferred` AND the user's words.
 * `draft/records/option-framing.ts` produces exactly that pair by construction:
 * its branch requires `provenance_class === 'stated'` with a string
 * `source_quote`, then spreads and overwrites the class to `ai_inferred`.
 *
 * ── ⭐ THE GATE SUPPRESSES NOTHING TRUE, AND THAT IS WHY IT IS SAFE ──────────
 * `RecordProvenance.source_quote` is declared *"Present iff `stated`"*
 * (`draft/records/projector.ts:250`), so a genuine invention NEVER carries one.
 * Measured over every `*.json` in this repo — 293 option nodes — 145 are
 * `ai_inferred` with no quote and **0** are `ai_inferred` with one. The gate
 * therefore removes no true disclosure from any captured graph, and Olumi's
 * inventions stay marked, which is the disclosure the founder valued.
 *
 * ── ⚠ IT IS KEYED ON **RECORDED**, NOT ON READABLE ──────────────────────────
 * Inherited from CEE rather than re-decided. A node carrying `source_quote: 99`
 * from a degraded JSONB read fails a string test, so a "is it a non-empty
 * string" gate does NOT fire and the user is told their own words were ours.
 * PRESENCE of the field is the producer saying this node came off a STATED
 * record. Fail-CLOSED: an unreadable quote declines, and declining costs only
 * silence.
 *
 * ── ⚠ WHAT THIS DOES NOT COVER, STATED RATHER THAN IMPLIED ──────────────────
 * `schema-v3.ts:1206-1210` stamps `ai_inferred` on an untyped option keyed only
 * on brief-substring containment, and sets NO `source_quote`. A quote-based gate
 * structurally CANNOT fire there. That limb's reachability is UNKNOWN and was
 * deliberately not derived; widening this gate to cover a path nobody has shown
 * is reachable would trade a measured guarantee for a guess.
 *
 * ⛔ NO SECOND CLASSIFIER. `classifyNodeProvenance` remains the ONE authority on
 * what a literal means; this asks it and applies one field's presence on top.
 */
import { classifyNodeProvenance } from './valueProvenance'

/**
 * One element's raw `provenance` literal, or `undefined`.
 *
 * ⚠ BOTH SHAPES. A React Flow node keeps its payload on `node.data`; a wire node
 * carries the field at top level, and this repo's fixtures hold both. Reading
 * one under-counts — `driverValueProvenance.nodeValueSource` takes the same
 * precaution for the same reason.
 */
export function readProvenanceLiteral(holder: unknown): string | undefined {
  const n = holder as Record<string, unknown> | null | undefined
  if (!n || typeof n !== 'object') return undefined
  const top = n.provenance
  if (typeof top === 'string') return top
  const data = n.data as Record<string, unknown> | null | undefined
  const nested = data && typeof data === 'object' ? data.provenance : undefined
  return typeof nested === 'string' ? nested : undefined
}

/**
 * Was a `source_quote` RECORDED on this element, in any readable or unreadable
 * form? Presence is the question, never content — see the header.
 */
export function sourceQuoteRecorded(holder: unknown): boolean {
  const n = holder as Record<string, unknown> | null | undefined
  if (!n || typeof n !== 'object') return false
  const data = n.data as Record<string, unknown> | null | undefined
  for (const candidate of [n, data]) {
    if (!candidate || typeof candidate !== 'object') continue
    // Both spellings: the CEE/PLoT wire uses `source_quote`; a canvas-normalised
    // node may carry `sourceQuote`.
    if (candidate.source_quote !== undefined && candidate.source_quote !== null) return true
    if (candidate.sourceQuote !== undefined && candidate.sourceQuote !== null) return true
  }
  return false
}

/**
 * ⛔ THE AMBIGUITY GATE. `ai_inferred` beside a recorded quote means the user DID
 * state something the brief check could not confirm. Neither "ours" nor "yours"
 * is safe, so every reader must say nothing.
 */
export function olumiAuthorshipIsAmbiguous(holder: unknown): boolean {
  const classified = classifyNodeProvenance(readProvenanceLiteral(holder))
  if (classified === null || classified.kind !== 'ai') return false
  return sourceQuoteRecorded(holder)
}

/**
 * May the product say this element is Olumi's own?
 *
 * ⚠ NOT THE NEGATION OF `olumiAuthorshipIsAmbiguous`, ON PURPOSE. There are
 * THREE states, not two: Olumi's (claim it), the user's (say nothing — a
 * separate and smaller claim this estate has repeatedly shipped wrongly), and
 * ambiguous (say nothing). Both predicates are FALSE for `from_brief`, and a
 * reader that treats one as `!` the other collapses a distinction the whole
 * mechanism exists to hold.
 */
export function mayClaimOlumiAuthorship(holder: unknown): boolean {
  const classified = classifyNodeProvenance(readProvenanceLiteral(holder))
  if (classified === null || classified.kind !== 'ai') return false
  return !sourceQuoteRecorded(holder)
}
