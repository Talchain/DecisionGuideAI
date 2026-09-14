/**
 * Analysis (New) — which science-grounded METHOD a finding warrants, if any.
 *
 * ⭐⭐ WHY THIS EXISTS, AND WHY IT IS THE POINT OF THE SURFACE.
 *
 * The seven techniques in `METHOD_CATALOGUE` are the product's differentiator —
 * Olumi recommends *techniques*, not answers — and they ship buried in a
 * dropdown, disconnected from the findings that should trigger them. The card
 * that says "a 13% chance the result flips" names no technique at all, while
 * "Consider the opposite" sits two clicks away in a menu with no idea that
 * finding exists. Attaching the method to its trigger is the wiring that makes
 * the claim legible, and it is wiring: both halves already ship.
 *
 * ⚠⚠ THE MAP IS DELIBERATELY SHORT, AND THE GAPS ARE THE FEATURE. A method is
 * attached ONLY where the recommendation and the technique are the SAME MOVE,
 * judged against the catalogue's own `description`. Three of the eight
 * recommendation builders qualify. Every other finding renders NO method chip.
 *
 * That restraint is not caution for its own sake. A method chip is a claim that
 * decision science prescribes this move here; attaching one by rough
 * resemblance would put a fabricated scientific label on screen, which is
 * precisely the defect class `StrengthenTheReasoning` was built to avoid
 * ("NOTHING HERE IS AUTHORED"). Absence is not zero — a finding with no
 * matching technique says nothing rather than guessing.
 *
 * ⚠ KEYED ON THE RECOMMENDATION ID, NOT ON `helpType`. Two reasons, and the
 * second is the load-bearing one:
 *
 *   1. Four of the eight builders mint per-target ids
 *      (`strengthen:flip:${edgeId}`, `strengthen:lehi:${factorId}`), so the
 *      match is on a PREFIX and the id remains the stable identity.
 *   2. `helpType` is a five-value enum — `clarify | broaden | challenge |
 *      evaluate | commit` — and three separate builders emit `clarify` for
 *      three unrelated moves (define a success measure, give a factor a range,
 *      relay verbatim producer copy). Selecting a named technique off an enum
 *      that coarse would attach the same method to findings that have nothing
 *      in common. The id distinguishes them; the enum cannot.
 */

import { METHOD_CATALOGUE, type MethodEntry } from '../decision-overview/actionsCatalogue'
import {
  biasSignal,
  resolveBiasSignal,
  type KnownBiasCode,
} from '../../../canvas/shared/biasSignalTitles'

/**
 * Recommendation-id prefix → method id, with the justification for each.
 *
 * ⚠ ADDING A ROW IS A PRODUCT CLAIM, NOT A CONVENIENCE. Before adding one, read
 * the catalogue entry's `description` and satisfy yourself the finding IS that
 * technique rather than merely adjacent to it. If it takes a paragraph to argue,
 * the answer is no.
 */
const METHOD_BY_RECOMMENDATION_PREFIX: ReadonlyArray<readonly [string, string]> = [
  // "Pressure-test {the designated option}" IS a pre-mortem: the catalogue's own
  // description is "imagine failure and capture plausible causes", which is
  // what pressure-testing an option means. ⚠ The title now NAMES that option
  // rather than describing it by rank ("the option that scored highest"), which
  // strengthens this row rather than weakening it: the technique arrives
  // pointed at a named subject instead of at a placing.
  ['strengthen:robustness', 'pre_mortem'],

  // "Find a route that works differently" and "generate an option that works
  // through a materially different mechanism" are the same instruction; the
  // catalogue's wording is very nearly the recommendation's own.
  ['strengthen:broaden', 'different_option'],

  // "Test the assumption about {factor}" against "build the strongest honest
  // case AGAINST the option that scored highest — what evidence or reasoning
  // would change my mind?". Both ask what would overturn the current answer;
  // the finding names the specific assumption to start from.
  //
  // ⚠ THE CATALOGUE ENTRY STILL WRITES ITS SUBJECT AS A RANK POSITION, and that
  // is a KNOWN, UNFIXED instance of the referent defect the engine's own copy
  // has just left. It is not repairable here: `METHOD_CATALOGUE` is STATIC,
  // dispatches from `ActionsMenu` with no run and no `leaderClaimWithheld`
  // gate, and therefore has no option to name. Rewording it to be leader-free
  // would also flip the premise of the ⛔ CONFIRMATION BIAS rejection below,
  // which turns on this description asserting that something is ahead. That is
  // a product decision about the technique, not a copy edit, and is out of this
  // change's scope.
  ['strengthen:flip', 'consider_opposite'],
]

/**
 * Producer `signal_code` → method id, for PHASE-3 rows.
 *
 * ⭐⭐ WHY A SECOND MAP RATHER THAN MORE PREFIXES. Phase-3 rows all share one id
 * shape — `strengthen:phase3:${block_id}` — so a prefix cannot distinguish a
 * producer pre-mortem card from a producer assumption check. The header above
 * rejects `helpType` as a key because it is too coarse; `signal_code` is the
 * opposite problem solved: it is the producer's OWN name for the move, finer
 * than the id and authored upstream rather than here.
 *
 * The consequence is the point. Until now every technique chip in the product
 * hung off one of the UI's three deterministic triggers, so a producer finding
 * — the majority of what the panel shows, occupying the whole top band — could
 * never name a technique, however plainly it was one. Three of seven techniques
 * were reachable from a finding. This makes the producer's own cards carry
 * their method, and unlocks a FOURTH: `review_bias`, which had no trigger at
 * all and was reachable only from a menu you had to already know you wanted.
 *
 * ⚠ THE SAME RESTRAINT RULE APPLIES, and it is doing work here. `FRAGILE_RESULT`
 * is deliberately ABSENT: `strengthen:robustness` earns `pre_mortem` because
 * that recommendation's instruction IS "build the strongest case against the
 * leader", whereas a producer fragility card states a fact about the run and
 * may prescribe something else entirely. Same kind of thinking (both are
 * `challenge`), different move — and a method chip claims the move, not the
 * kind.
 */
const METHOD_BY_SIGNAL_CODE: ReadonlyArray<readonly [string, string]> = [
  // Name-identical, and the catalogue's description ("imagine failure and
  // capture plausible causes") is what the producer's PRE_MORTEM card is.
  ['PRE_MORTEM', 'pre_mortem'],

  // `review_bias` IS "review the decision for cognitive bias"; a producer
  // COGNITIVE_BIAS signal is that move, named by the producer. This is the
  // technique's first and only trigger.
  ['COGNITIVE_BIAS', 'review_bias'],

  // Identical to the existing `strengthen:broaden` → `different_option` row,
  // reached from the producer's own code instead of the UI's bias gate.
  ['LOW_OPTION_COUNT', 'different_option'],
]

/**
 * Canonical BIAS CODE → method id: the corrective for the bias the producer
 * actually named on THIS card.
 *
 * ⭐⭐ WHY THIS MAP EXISTS WHEN `COGNITIVE_BIAS → review_bias` ALREADY SHIPS.
 * Because that row answers a coarser question, and answering the coarse one
 * made the finer one invisible. A bias card's `signal_code` is `COGNITIVE_BIAS`
 * for every bias the registry names, so the generic technique — "Review a
 * possible bias", whose own description is "Use only biases grounded in this
 * brief or model" — was the best the surface could offer on a run where the
 * producer had ALREADY done that review and named the result. The product knew
 * it was looking at an anchor and still offered to go looking for a bias.
 *
 * The bias identity was on the wire the whole time, in the card's title, and
 * `biasFindingTypes` already inverts the registry to recover it — but it had
 * exactly ONE reader (`buildRecommendations.ts`'s narrow-framing gate) whose
 * `NARROW_TYPES` covers three of the sixteen codes. So thirteen named biases,
 * anchoring and overconfidence among them, gated nothing anywhere.
 *
 * ⚠⚠ THE SAME RESTRAINT RULE AS BOTH MAPS ABOVE, AND IT IS DOING MOST OF THE
 * WORK HERE. Two rows, not sixteen. A row earns its place only where the
 * technique IS the literature's corrective for that bias AND the catalogue's own
 * `description` says so — not where the two are merely both about thinking
 * harder. Every unwired bias keeps the generic `review_bias` chip it gets today,
 * which is a true and useful thing to offer; none loses anything.
 *
 * ⚠ WHY EACH ROW, AND WHY THE NEAR MISSES ARE OUT:
 *
 *   ANCHORING → `outside_view`. An anchor is an inside-view number exerting pull
 *     from where the estimate STARTED. The catalogue's description is "compare
 *     with a relevant reference class", and replacing a self-generated starting
 *     point with a reference class is not a way of mitigating an anchor — it is
 *     the move itself. It is also reference-class forecasting's stated purpose
 *     in the planning literature that named this bias. This is the technique's
 *     FIRST trigger of any kind: `outside_view` shipped in the catalogue
 *     reachable only from a menu the user had to already know they wanted.
 *
 *   OVERCONFIDENCE → `pre_mortem`. Overconfidence is under-weighted failure
 *     modes; the catalogue's description is "imagine failure and capture
 *     plausible causes". The premortem was devised as the corrective for exactly
 *     this, and prospective hindsight is the mechanism. `pre_mortem` already has
 *     two triggers (`strengthen:robustness` and the producer's `PRE_MORTEM`
 *     code); a third route to a technique is not a new claim, it is the same
 *     claim reached from another finding.
 *
 *   ⛔ CONFIRMATION BIAS → `consider_opposite` is REJECTED, though the
 *     debiasing literature points straight at it. THIS catalogue's
 *     `consider_opposite` is not the literature's generic move: its description
 *     is "build the strongest case against the option that SCORED HIGHEST", so
 *     invoking it asserts that something is currently ahead. That is a leader
 *     claim, and leader claims are permissioned here — `strengthen:robustness`
 *     is gated on `leaderClaimWithheld` for precisely this reason, and a bias
 *     card carries no such gate and may arrive before any ranking exists.
 *     Wiring it would smuggle an unpermissioned leader designation in behind a
 *     science label (CLAUDE.md trap 21). Both rows above are leader-free.
 *
 *   ⛔ OPTIMISM BIAS is REJECTED as a separate title with a genuinely contested
 *     corrective — the planning-fallacy literature prescribes a reference class,
 *     the failure-generation literature a premortem. It took a paragraph to
 *     argue, so per the rule above the answer is no.
 *
 * ⭐⭐⭐ AND THE REASON TWO ROWS IS NOT MERELY RESTRAINT BUT THE WHOLE REACHABLE
 * SET — derived at the producer, which is the only place this question can be
 * answered (CLAUDE.md trap 16-inverse: a branch can be live while the data
 * cannot reach it; a sweep of THIS repo would have said "sixteen biases, wire
 * two of them, leave fourteen on the table").
 *
 * `olumi-schemas` `main` @ `cc5c9e84` (0.54.0, the version CEE pins — no skew):
 *   `BiasType = z.enum(['anchoring', 'narrow_framing', 'status_quo_bias', 'overconfidence'])`
 * and CEE ENFORCES it by DROPPING a non-conforming signal rather than asserting
 * a different bias about the user (`coaching-contract-conformance.ts:234-262`,
 * on the always-on unified pipeline). CEE's own title registry holds ten names
 * that are character-exact with `BIAS_SIGNAL_REGISTRY`'s
 * (`draft-bias-signal-blocks.ts:92-108`) — but six of them are unreachable,
 * because the contract cannot emit their codes.
 *
 * So FOUR bias titles can reach a user today, and after this change all four are
 * accounted for:
 *   Narrow framing  → `strengthen:broaden` / `different_option`  (already shipped)
 *   Anchoring       → `outside_view`                             (this map)
 *   Overconfidence  → `pre_mortem`                               (this map)
 *   Status quo bias → the generic `review_bias`                  (no corrective argued)
 *
 * Wiring `sunk_cost`, `confirmation_bias`, `optimism_bias`, `availability_bias`,
 * `authority_bias` or `blind_spots` would therefore ship DARK. Widening the set
 * is a SCHEMAS change to `BiasType`, not a UI one — do that first, and only then
 * argue a corrective for what it admits.
 *
 * ⚠ ALSO DERIVED, AND IT CLOSES AN OBVIOUS NEXT IDEA: the producer does NOT name
 * a corrective per bias on this block. `CoachingBlockSchema` is `.strict()` with
 * no bias or technique field, and `bias_signal` blocks emit no
 * `action_intent`/`action_label` at all. Per-bias interventions with citations DO
 * exist in CEE (`src/cee/bias/library.ts`, `typical_interventions`) but on a
 * different route (`/assist/v1/bias-check`) whose key space does not align with
 * the coaching registry's. Selecting the method here is the UI's job today.
 *
 * ⚠ KEYED ON A `KnownBiasCode`, SO A REGISTRY RENAME IS A COMPILE ERROR rather
 * than a silent no-op — the failure mode this module's guard spec exists for
 * (trap 12). Matching goes THROUGH the registry's title equivalence, never by
 * string-comparing codes: several codes share one title by design, and the
 * resolver hands us whichever the registry happens to list first. 'Overconfidence'
 * resolves to `confidence`, NOT `overconfidence` — so a hand-picked spelling
 * would have missed the very row it was written for, and listing both aliases
 * here would be the hand-maintained mirror. One code per bias; the registry
 * supplies the rest.
 */
const METHOD_BY_BIAS_CODE: ReadonlyArray<readonly [KnownBiasCode, string]> = [
  ['anchoring', 'outside_view'],
  ['overconfidence', 'pre_mortem'],
]

/** Registry title of a mapped code, normalised — the comparison key. */
const biasTitleKey = (code: KnownBiasCode): string =>
  biasSignal(code).title.trim().toLowerCase()

/**
 * The method a producer-named bias warrants, or `undefined`.
 *
 * Resolves the incoming code through `resolveBiasSignal` — the registry's one
 * guarded wire-input lookup, which carries the trim/lowercase and own-key
 * guards — then compares TITLES, so every alias of a mapped bias resolves
 * identically and an unrecognised code yields nothing.
 */
function methodIdForBiasCode(biasCode: string | undefined): string | undefined {
  if (!biasCode) return undefined
  const title = resolveBiasSignal(biasCode)?.title
  if (!title) return undefined
  const key = title.trim().toLowerCase()
  return METHOD_BY_BIAS_CODE.find(([code]) => biasTitleKey(code) === key)?.[1]
}

/**
 * The method this finding warrants, or `null` when none genuinely does.
 *
 * `null` is the common case by design — see the header. Callers must render
 * nothing at all for it, never a placeholder or a default technique.
 *
 * `signalCode` is the producer's code on a phase-3 row and `biasCode` the
 * canonical bias its title named (both absent on the UI's own triggers).
 *
 * ⭐⭐ PRECEDENCE IS id → biasCode → signalCode, AND THE MIDDLE TERM'S POSITION
 * IS THE WHOLE CHANGE. A bias card carries BOTH a `biasCode` and
 * `signalCode: 'COGNITIVE_BIAS'`, so the two maps both answer and the order
 * decides which wins. The specific corrective must outrank the generic one: a
 * producer that has already reviewed the reasoning and named an anchor should
 * offer the reference class, not an offer to go looking for a bias. Put the
 * other way round, `METHOD_BY_BIAS_CODE` would be unreachable on every card
 * that could use it — dark on arrival.
 *
 * ⚠ SO THIS IS NOT STRICTLY ADDITIVE, UNLIKE THE `signalCode` CHANGE BEFORE IT,
 * AND THAT IS DELIBERATE RATHER THAN OVERLOOKED. Two findings DO change the
 * technique they name: a producer Anchoring card moves `review_bias` →
 * `outside_view`, and an Overconfidence card `review_bias` → `pre_mortem`. Every
 * other bias, and every non-bias finding, is untouched — the id map still wins
 * outright, so no UI trigger can change, and a bias with no row keeps the
 * generic chip. The two deliberate changes are pinned by name in
 * `biasMethodReachesTheProducersBias.spec.ts`, so neither can drift silently.
 */
export function methodForRecommendation(
  recommendationId: string,
  signalCode?: string,
  biasCode?: string,
): MethodEntry | null {
  if (!recommendationId) return null
  const byPrefix = METHOD_BY_RECOMMENDATION_PREFIX.find(([prefix]) =>
    recommendationId === prefix || recommendationId.startsWith(`${prefix}:`),
  )
  const methodId =
    byPrefix?.[1] ??
    methodIdForBiasCode(biasCode) ??
    (signalCode
      ? METHOD_BY_SIGNAL_CODE.find(([code]) => code === signalCode)?.[1]
      : undefined)
  if (!methodId) return null
  return METHOD_CATALOGUE.find((m) => m.id === methodId) ?? null
}

/**
 * Exposed for the drift guard: every method id above must exist in the
 * catalogue. A rename in `actionsCatalogue.ts` would otherwise silently reduce
 * this module to returning `null` for everything — the failure would be a
 * feature quietly disappearing, with no test to catch it (CLAUDE.md trap 12).
 */
export const MAPPED_METHOD_IDS: readonly string[] = [
  ...METHOD_BY_RECOMMENDATION_PREFIX.map(([, methodId]) => methodId),
  // The signal-code map is covered by the SAME guard, deliberately. It is a
  // second list of catalogue ids and would otherwise be exactly the
  // hand-maintained mirror the guard exists to catch — a rename in
  // `actionsCatalogue.ts` would silently reduce every producer finding to no
  // chip, with nothing red.
  ...METHOD_BY_SIGNAL_CODE.map(([, methodId]) => methodId),
  // And the bias map, for the same reason and with an extra one: `outside_view`
  // has no other trigger anywhere in the product, so a rename would take the
  // technique's ONLY route with it and leave nothing red.
  ...METHOD_BY_BIAS_CODE.map(([, methodId]) => methodId),
]

/**
 * Exposed for the guard: the canonical bias codes this module claims to answer.
 * Typed as `KnownBiasCode` at the map, so a registry rename is already a compile
 * error; this lets a spec pin that the map is non-empty and that every row
 * actually resolves — the hollowed-out-map failure the header describes.
 */
export const MAPPED_BIAS_CODES: readonly KnownBiasCode[] = METHOD_BY_BIAS_CODE.map(
  ([code]) => code,
)

/** Exposed for the same guard: the producer codes this module claims to know. */
export const MAPPED_SIGNAL_CODES: readonly string[] = METHOD_BY_SIGNAL_CODE.map(
  ([code]) => code,
)

/** Exposed for the same guard, so a prefix typo is visible to a test. */
export const MAPPED_RECOMMENDATION_PREFIXES: readonly string[] =
  METHOD_BY_RECOMMENDATION_PREFIX.map(([prefix]) => prefix)
