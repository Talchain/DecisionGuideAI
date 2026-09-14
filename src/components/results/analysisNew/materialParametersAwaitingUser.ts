/**
 * WHICH PARAMETERS THE REFUSAL IS ABOUT — named, not counted.
 *
 * ## The header this supersedes, and why it is now stale
 *
 * `AtAGlance.tsx` carries a deliberate decision:
 *
 * > *"⚠ NO FACTOR IS NAMED, AND THE ROUTE REFLECTS THAT. Measured on the live
 * > wire, `missing_important_inputs` is EMPTY on this refusal and the sentence
 * > says 'at least ONE of them' — there is no particular estimate to point at
 * > … inventing one would be a deep link to an arbitrary row dressed as the
 * > answer."*
 *
 * That was correct when written, and **half of it is still correct.** CEE
 * #1450 publishes `semantic_signals.material_parameters_awaiting_user_node_ids`
 * — the parameters the comparison rests on whose value is not the user's — so
 * the first clause ("there is no particular estimate to point at") no longer
 * holds. **The second clause still binds and is honoured here:**
 *
 * ⛔ **THIS NAMES THE WHOLE SET AND NEVER PICKS A MEMBER.** The producer
 * publishes the ids in GRAPH ORDER and computes no priority, influence or
 * value-of-information ranking over them. Selecting one — the first, the
 * "top" — would be exactly the arbitrary row dressed as the answer that header
 * forbids, and the arbitrariness would be invisible because a single name reads
 * as a considered recommendation.
 *
 * ## Fail-closed at every step, because the cost is asymmetric
 *
 * A parameter WRONGLY NAMED sends the user to set a number that cannot lift the
 * refusal — the futile-instruction defect the remedy split exists to prevent,
 * and worse than the unnamed sentence because it spends the trust the refusal
 * just earned. A parameter wrongly OMITTED costs only today's wording. So every
 * unreadable case returns the empty set and the caller keeps the existing copy.
 *
 * ## ABSENT and EMPTY are different answers, and this collapses them DELIBERATELY
 *
 * On the wire they differ: absent means "this CEE predates the field", empty
 * means "it publishes it and the set is empty" (either the floor is met, or the
 * graph has no material parameters at all). **Both produce the same UI —
 * today's unnamed sentence — so one return value is honest here.** A caller
 * that ever needs to tell them apart must read the payload, not this.
 */

/** A parameter the refusal is about, resolved to something a reader can find. */
export interface NamedMaterialParameter {
  readonly id: string
  readonly label: string
}

/** Structural, unknown-safe read of one string array off an untyped object. */
function readIds(admission: unknown): readonly string[] {
  if (admission === null || typeof admission !== 'object') return []
  const signals = (admission as { semantic_signals?: unknown }).semantic_signals
  if (signals === null || typeof signals !== 'object') return []
  const raw = (signals as { material_parameters_awaiting_user_node_ids?: unknown })
    .material_parameters_awaiting_user_node_ids
  if (!Array.isArray(raw)) return []
  // ⚠ ONE BAD MEMBER VOIDS THE SET, rather than being skipped. A producer
  // emitting a non-string here is a producer we have misread, and naming the
  // members we happened to understand would be reporting a PARTIAL set as
  // though it were the whole one — the understatement-the-consumer-cannot-
  // detect defect, committed by the consumer this time.
  for (const id of raw) {
    if (typeof id !== 'string' || id.length === 0) return []
  }
  return raw as readonly string[]
}

/**
 * Resolve the published ids to labels the reader can actually find on screen.
 *
 * ⚠ AN ID WITH NO LABEL VOIDS THE SET TOO, for the same reason as above: the
 * graph the consumer holds and the graph CEE censused should be the same graph,
 * so an id that resolves to nothing means they are not — and a list that
 * silently drops the members it could not name would understate the work the
 * refusal is asking for.
 */
export function namedMaterialParametersAwaitingUser(
  admission: unknown,
  nodeLabels: ReadonlyMap<string, string> | undefined,
): readonly NamedMaterialParameter[] {
  const ids = readIds(admission)
  if (ids.length === 0) return []
  if (nodeLabels === undefined) return []

  const named: NamedMaterialParameter[] = []
  for (const id of ids) {
    const label = nodeLabels.get(id)?.trim()
    if (label === undefined || label.length === 0) return []
    named.push({ id, label })
  }
  return named
}
