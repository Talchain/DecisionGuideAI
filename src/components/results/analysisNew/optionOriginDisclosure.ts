/**
 * ⭐⭐ WHOSE OPTION IS WINNING — the disclosure at the moment the leader is named.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * A founder wrote *"Should we increase the Pro plan price from £49 to £59?"*.
 * The product invented **"Raise Price to £54 (Soft Increase)"** — a price he
 * never named — and the panel announced it as the answer at 73%, with nothing
 * on the surface saying the option was ours. Every honesty check was green,
 * because every honesty check on this surface is about the NUMBERS: the win
 * share is scoped (`comparisonScope`), the inputs are conditioned
 * (`glanceProvenanceCopy`), the entitlement is gated (`leaderDesignation`).
 * Not one of them answers *whose idea the winner was*.
 *
 * ⛔ THE FIX IS DISCLOSURE, NEVER EXCLUSION. Olumi inventing options is the
 * product working — it is ideation, and the founder specifically valued
 * learning that 9 of 14 elements on his model were Olumi's. Nothing here
 * suppresses, demotes, re-ranks or filters any option, and nothing here touches
 * the admission or refusal gates. This module can only ever ADD a sentence to a
 * leader the product has ALREADY decided it is entitled to name.
 *
 * ── ⚠ WHY THIS IS A THIRD AXIS AND NOT A SEVENTH `GlanceInputProvenance` KIND ─
 * The obvious-looking move is to add a kind to `GlanceInputProvenance`, which
 * already owns the glance's condition line. It is wrong twice.
 *
 *   1. DIFFERENT QUESTION (CLAUDE.md trap 21). `inputProvenance` answers *whose
 *      FIGURES did the simulation run on* — a per-FACTOR claim. This answers
 *      *whose OPTION is winning* — a claim about one ELEMENT. `analysisNewTypes
 *      .ts` already keeps `inputProvenance` and `condition` named apart for
 *      exactly this reason, in those words.
 *   2. IT WOULD DISPLACE, NOT ADD. `inputProvenance` is ONE value rendered in
 *      ONE `<p>` (`AtAGlance.tsx`). A seventh kind is mutually exclusive with
 *      the other six, so on precisely the runs where the leader was invented the
 *      surface would STOP saying what the figures rested on. Closing one silence
 *      by opening another is the trade this estate keeps making.
 *
 * ── THE PREDICATE IS CEE'S, INHERITED RATHER THAN RE-DECIDED ─────────────────
 * CEE already answers this question in chat, and its module
 * (`cee/context-integrity/structure-origin-answer.ts`) is the ratified
 * authority. Its rules are reproduced here — not re-derived — because the two
 * surfaces must not disagree about one node:
 *
 *   · `from_brief` / `user_set` → the element is the USER'S. Silent (see below).
 *   · `ai_inferred` + NO `source_quote` recorded → Olumi's. **We say so.**
 *   · `ai_inferred` + a `source_quote` RECORDED → ⛔ AMBIGUOUS, SAY NOTHING.
 *   · anything else (absent, object-shaped, unknown literal) → say nothing.
 *
 * ⚠⚠ THE AMBIGUITY GATE IS THE LOAD-BEARING HALF, AND OMITTING IT WOULD SHIP A
 * FABRICATION. `ai_inferred` is the enum's CATCH-ALL: CEE's producer assigns it
 * both to *"the model invented this"* AND to *"the user stated it but the brief
 * check came back `unverified`/`unchecked`"* (`schema-v3.ts:1209`,
 * `bindOptionLabelToBrief`). Telling a user that their OWN option "was Olumi's
 * suggestion" is a fabrication in the opposite direction, and a worse one. The
 * two are separable only because `projectNodeProvenance` lifts `source_quote`
 * OUTSIDE the enum decision (`schema-v3.ts:1145`), so an unverified-stated node
 * carries `ai_inferred` AND a quote. Where both are present we decline.
 *
 * ⚠ AND IT IS KEYED ON **RECORDED**, NOT ON READABLE. CEE found this by driving
 * a malformed input one seam past its guard: a node carrying `source_quote: 99`
 * from a degraded JSONB read fails a string test, so a "is it a non-empty
 * string" gate does NOT fire, and the user is told their own words were ours.
 * The PRESENCE of the field is the producer saying this node came off a STATED
 * record, so presence alone closes the gate. Fail-CLOSED: an unreadable quote
 * declines, and declining costs only silence.
 *
 * ── WHY SILENCE FOR `from_brief` AND `user_set` ──────────────────────────────
 * Deliberate, and it is the smaller claim. The user-authorship direction is the
 * one this estate has repeatedly shipped wrongly (`driverValueProvenance` maps
 * `brief` to `undetermined` for exactly this reason: extraction FROM a brief is
 * not the same act as a user stating a thing). Announcing "this one is yours"
 * is a claim we would have to defend on every path that can stamp those
 * literals; announcing "this one is ours" is a disclosure against our own
 * interest, and it is the only direction the founder's question asks about.
 * A later lane may widen this; it must do so with its own evidence.
 *
 * ⛔ NO COUNT, NO PROPORTION, NO SECOND CLASSIFIER. This reads one closed
 * vocabulary string (via `classifyNodeProvenance`, the estate's ONE owner of
 * what these literals mean) and one field's presence. Nothing else.
 */

import { classifyNodeProvenance } from '../../../canvas/domain/valueProvenance'

/**
 * The only thing this axis can say.
 *
 * ⚠ A ONE-MEMBER UNION ON PURPOSE, NOT AN UNFINISHED ENUM. Every other state —
 * the user's, ambiguous, unstamped, unknown — resolves to `null`, which the
 * surface renders as nothing at all. A second member may be added only with
 * evidence for the claim it makes; see "WHY SILENCE" above.
 */
export type OptionOrigin = 'ai_suggested'

/**
 * The sentence, and it is the whole sentence.
 *
 * ⚠ NO TIME AND NO PROCESS CLAUSE. CEE's round 2 appended *"I put it forward
 * while drafting the model from your brief"* and its own derived guard caught
 * it: the enum records that the content is not the user's stated words, and
 * records NOTHING about WHEN the element was introduced or what it was drafted
 * from — `ai_inferred` is equally the literal for an element Olumi minted on a
 * later `edit_graph` turn at the user's own instruction. The bare, warranted
 * sentence is the whole answer.
 *
 * ⚠ IT NAMES OLUMI, NOT "AI". The surrounding register is Olumi's throughout
 * (`GLANCE_PROVENANCE_COPY`: "On inputs Olumi estimated"), and the canvas card
 * for this same fact already says "Olumi suggested this"
 * (`STRUCTURAL_PROVENANCE_LABEL.ai`). British English; no em dashes.
 */
export const OPTION_ORIGIN_COPY: Record<OptionOrigin, string> = {
  ai_suggested: 'Olumi suggested this option, you did not name it',
}

/** One node's raw `provenance` literal, or undefined. */
function rawProvenance(node: unknown): string | undefined {
  const n = node as Record<string, unknown> | null | undefined
  if (!n || typeof n !== 'object') return undefined
  // ⚠ BOTH SHAPES. A React Flow node keeps its payload on `node.data`; a wire
  // node carries the field at top level, and this repo's fixtures hold both.
  // `driverValueProvenance.nodeValueSource` takes the same precaution for the
  // same reason — reading one under-counts.
  const top = n.provenance
  if (typeof top === 'string') return top
  const data = n.data as Record<string, unknown> | null | undefined
  const nested = data && typeof data === 'object' ? data.provenance : undefined
  return typeof nested === 'string' ? nested : undefined
}

/**
 * Was a `source_quote` RECORDED on this node, in any readable or unreadable
 * form? Presence is the question, never content — see the header.
 */
function quoteRecorded(node: unknown): boolean {
  const n = node as Record<string, unknown> | null | undefined
  if (!n || typeof n !== 'object') return false
  const data = n.data as Record<string, unknown> | null | undefined
  const holders: Array<Record<string, unknown> | null | undefined> = [n, data]
  for (const holder of holders) {
    if (!holder || typeof holder !== 'object') continue
    // Both spellings: the CEE/PLoT wire uses `source_quote`; a canvas-normalised
    // node may carry `sourceQuote`.
    if (holder.source_quote !== undefined && holder.source_quote !== null) return true
    if (holder.sourceQuote !== undefined && holder.sourceQuote !== null) return true
  }
  return false
}

/**
 * Whose option is this? `null` means SAY NOTHING, and it is the common answer.
 *
 * ⚠ NOTHING IS CLASSIFIED HERE. `classifyNodeProvenance` remains the one
 * authority on what a literal means; this asks it, then applies CEE's
 * ambiguity gate on top. An unknown literal returns `null` from the classifier
 * and is a FINDING, not a patch site — widening the vocabulary here would blind
 * the guard that owns it.
 */
export function optionOriginFromNode(node: unknown): OptionOrigin | null {
  const classified = classifyNodeProvenance(rawProvenance(node))
  if (classified === null) return null
  // The user's element. Silent by design, not by omission.
  if (classified.kind !== 'ai') return null
  // ⛔ THE AMBIGUITY GATE. `ai_inferred` beside a recorded quote means the user
  // DID state something the brief check could not confirm. Neither "ours" nor
  // "yours" is safe, so we say nothing.
  if (quoteRecorded(node)) return null
  return 'ai_suggested'
}

/**
 * Node id → origin, for every node that has one. Built once by the store-aware
 * hook from the SAME `nodes` slice `buildNodeValueSourceMap` already reads, so
 * this adds no store subscription and cannot disagree with the canvas about a
 * node.
 *
 * ⚠ SPARSE ON PURPOSE. A node absent from this map is a node with nothing
 * honest to say, which is exactly how `null` must render.
 */
export function buildNodeOriginMap(
  nodes: ReadonlyArray<unknown> | null | undefined,
): ReadonlyMap<string, OptionOrigin> {
  const map = new Map<string, OptionOrigin>()
  for (const node of nodes ?? []) {
    const n = node as Record<string, unknown> | null | undefined
    const id = n?.id
    if (typeof id !== 'string' || id.length === 0) continue
    const origin = optionOriginFromNode(node)
    if (origin !== null) map.set(id, origin)
  }
  return map
}
