/**
 * `serverStatedStrengthOf` — THE WIRE-SIDE GATE. What did the SERVER last state
 * for this edge's strength?
 *
 * ⭐ THIS EXISTS BECAUSE THE DISPLAY GATE WAS USED FOR A WIRE PAYLOAD, AND THE
 * FILE SAID NOT TO. `canvas/domain/edgeValueProvenance.ts` carries the header
 * **"NOT FOR WIRE PAYLOADS"**. #1287 built `edge_strength_edit.expected` from
 * `resolveEdgeSignedStrengthDisplay` anyway, on the reading that provenance and
 * numeric behaviour are different concerns — which is true, and is precisely
 * why the substitution was wrong. The two answer different questions:
 *
 *   · `resolveEdgeSignedStrengthDisplay` → *may a surface SPEAK this number, or
 *     is it a UI default?* A user's own entry is emphatically speakable, so it
 *     resolves `show: true`.
 *   · this module → *does the SERVER hold this number?* A user's own entry, not
 *     yet accepted by anything, emphatically does not.
 *
 * Under the first question `weightSource: 'user'` is a licence; under the second
 * it is a disqualification. One name, two questions — this estate's signature
 * defect (CLAUDE.md trap 21), and the fix is to name them apart rather than to
 * reconcile them. Nothing here is a second copy of a provenance rule: the
 * display gate keeps its whole job, and this module does not touch display.
 *
 * ── WHY `weightSource` CANNOT BE NARROWED INTO AN ANSWER ────────────────────
 * The tempting minimal fix is "accept `'cee'`, refuse `'user'`". It is not
 * sufficient, and the two counter-examples are live product paths, enumerated
 * at the bytes rather than imagined:
 *
 *   · `ModelTabBody.handleResolveContested` (`accepted_pass2`, :751) writes the
 *     producer's pass-2 mean LOCALLY and stamps `weightSource: 'cee'`. That
 *     stamp is CORRECT for its own question — the number really is the
 *     producer's — but the accompanying `edge_adjudication` event is persisted
 *     by CEE as a turn FACT that WRITES NO GRAPH, so the persisted edge still
 *     holds its pre-adjudication value.
 *   · `useModelActionApply` (`update_edge`, :358) writes a producer-PROPOSED
 *     weight with the same stamp, before any server write exists.
 *
 * So `'cee'` means "a producer originated this number", never "the server's
 * graph holds this number". Only INGESTION can answer the second question, so
 * the answer is recorded at ingestion (`edges.readServerStatedStrength`) and
 * merely read back here.
 *
 * ── THE TWO ACCEPTED SOURCES, AND WHY BOTH ─────────────────────────────────
 *   1. `serverStrength` — the tuple recorded by the three ingestion hops.
 *      Authoritative, and the only source present on the ordinary drafted edge:
 *      `mapDraftEdgeToCanvas` stores an absolute `weight` plus a separate
 *      `direction` and DROPS the raw wire spellings, so a gate reading only raw
 *      fields would refuse almost every real edge.
 *   2. raw `strength_mean` + `effect_direction` — back-compat for graphs
 *      persisted before (1) existed, and for `applyV5State`'s verbatim
 *      `graph_patch` merge, which spreads CEE's `after` unchanged. These two
 *      keys are producer-only by the same argument `edgeValueProvenance.ts`
 *      already makes for them: nothing in the UI fabricates either, neither
 *      default bag defines them, and no setter writes them. Checked against the
 *      two laundering writers above: NEITHER writes either key, so this arm is
 *      not a way back in.
 *
 * Everything else is refused — `weight`, `direction`, and every `*Source` stamp.
 *
 * ⚠ NO THIRD SOURCE MAY BE ADDED WITHOUT RE-ENUMERATING THE WRITERS. The claim
 * this module rests on is not "these fields look producer-ish" but "the complete
 * set of writers of these fields in `src/` was enumerated, and none of them is a
 * local edit". A new source is a new enumeration, not a new line.
 */
import { z } from 'zod'

import { EffectDirectionEnum } from '../domain/edges'

/**
 * The `expected` tuple, exactly as the contract shapes it — a signed mean the
 * server stated, and the direction it stated alongside.
 */
export interface ServerStatedStrength {
  readonly mean: number
  readonly effect_direction: 'positive' | 'negative'
}

/**
 * `expected.mean` is `z.number().finite().min(-1).max(1)` at
 * `@talchain/schemas` 0.50.0 (`dist/boundary/turn-payload.js:454`), which is the
 * version BOTH repos pin. The canvas clamps `weight` into [0, 2], so a value
 * outside the contract's domain is representable here and must be REFUSED
 * rather than clamped: clamping 1.5 to 1 would assert a number the server never
 * held, and CEE compares with a bare `!==`.
 */
const ServerStatedStrengthSchema = z
  .object({
    mean: z.number().finite().min(-1).max(1),
    effect_direction: EffectDirectionEnum,
  })
  .strict()

/**
 * Resolve the server-stated strength tuple for an edge, or `null` when nothing
 * proves what the server holds.
 *
 * `null` is the honest answer, not an error: the caller's duty is to decline to
 * assert, never to substitute a local value.
 */
export function serverStatedStrengthOf(
  data: Record<string, unknown> | undefined | null,
): ServerStatedStrength | null {
  if (!data) return null

  // 1. The recorded tuple. Parsed rather than trusted — it can arrive from a
  //    persisted graph written by an older build, and a malformed record must
  //    read as "unknown" rather than reach the wire.
  const recorded = ServerStatedStrengthSchema.safeParse(data.serverStrength)
  if (recorded.success) return recorded.data

  // 2. Back-compat: the raw producer spellings, when both are present and
  //    agree. The sign rule mirrors the contract's own `refineEdgeStrengthEdit`
  //    — a non-zero mean must agree with the stated direction — and zero is
  //    exempt because `-0 >= 0` is `true` in JavaScript, so a zero mean agrees
  //    with either direction and the contract keeps the field required there.
  const rawMean = data.strength_mean
  const rawDirection = data.effect_direction
  if (typeof rawMean !== 'number' || !Number.isFinite(rawMean)) return null
  if (rawDirection !== 'positive' && rawDirection !== 'negative') return null
  if (rawMean !== 0) {
    const impliedByMean = rawMean < 0 ? 'negative' : 'positive'
    if (impliedByMean !== rawDirection) return null
  }
  // ⚠ THE `return null` ABOVE IS ONE OF TWO VERY DIFFERENT FACTS, and until
  // 19 Sep 2026 the UI reported both as the same thing. See
  // `serverStatedStrengthDisagreesOnSign` below.


  const parsed = ServerStatedStrengthSchema.safeParse({
    mean: rawMean,
    effect_direction: rawDirection,
  })
  return parsed.success ? parsed.data : null
}

/**
 * ⭐⭐ DID THE SERVER STATE A STRENGTH WE CANNOT CARRY — as opposed to not
 * stating one at all?
 *
 * `serverStatedStrengthOf` returns `null` for BOTH, and the two are not the
 * same fact. Measured on the founder's own board, 19 Sep 2026:
 *
 *   e-10  Dilution and Control Risk -> goal   strength_mean 0.35  effect_direction 'negative'
 *   e-19  Funding Shortfall Risk    -> goal   strength_mean 0.75  effect_direction 'negative'
 *
 * A POSITIVE magnitude beside a NEGATIVE direction. CEE encodes magnitude and
 * direction separately; the shared contract requires a SIGNED mean (this
 * module's sign rule mirrors `refineEdgeStrengthEdit`), so the tuple is refused
 * — correctly, because building an event the contract rejects would fail the
 * whole turn, not just the field.
 *
 * ⛔⛔ **EVERY RISK -> GOAL EDGE IS AFFECTED**, because a risk is exactly the
 * kind of relationship that carries a negative direction. So the edge a person
 * most wants to correct — *"how badly does this risk hurt my goal?"* — is
 * precisely the one the strength editor will not take.
 *
 * ⚠ AND THE PRODUCT SAID SOMETHING FALSE WHILE REFUSING.
 * `INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON` reads *"This connection has no
 * strength on record… Ask Olumi to set its strength."* The server HAS stated
 * one — the canvas is drawing it, at that magnitude, in that direction — and
 * asking Olumi cannot help, because Olumi is what stated it. A person following
 * that instruction is sent back into the chat for something already on their
 * screen.
 *
 * ⭐ THIS PREDICATE CHANGES NO REFUSAL. The fence stays exactly where it is.
 * It exists so the SENTENCE beside the fence can tell the truth, and so the
 * condition has a name the producer fix can be measured against.
 */
export function serverStatedStrengthDisagreesOnSign(
  data: Record<string, unknown> | undefined | null,
): boolean {
  if (!data) return false
  // A recorded tuple has already been validated; this is only about the raw
  // producer spellings, which is where the disagreement lives.
  if (ServerStatedStrengthSchema.safeParse(data.serverStrength).success) return false
  const rawMean = data.strength_mean
  const rawDirection = data.effect_direction
  if (typeof rawMean !== 'number' || !Number.isFinite(rawMean) || rawMean === 0) return false
  if (rawDirection !== 'positive' && rawDirection !== 'negative') return false
  return (rawMean < 0 ? 'negative' : 'positive') !== rawDirection
}
